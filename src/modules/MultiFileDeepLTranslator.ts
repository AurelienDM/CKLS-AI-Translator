/**
 * Multi-File DeepL Translation Module
 * Handles translation of multiple files using DeepL API with smart deduplication
 */

import { validateDeepLLanguages, mapToDeepLCode, isDeepLProKey } from './DeepLTranslator';
import { applyGlossarySubstitutions, restoreGlossarySubstitutions } from '@/utils/textExtraction';
import { extractFromMultipleFiles, buildUniqueStringMap } from './MultiFileHandler';
import { MultiFileTranslationConfig, MultiFileTranslationResult } from './MultiFileTranslator';

/**
 * Translate multiple files using DeepL with smart deduplication
 * Extracts unique strings across all files and translates each unique string only once
 */
export async function translateMultipleFilesWithDeepL(
  config: MultiFileTranslationConfig
): Promise<MultiFileTranslationResult[]> {
  const {
    filesData,
    targetLanguagesCKLS,
    sourceISO,
    sourceCKLS,
    doNotTranslate,
    predefinedTranslations,
    apiKey,
    formalitySettings = {},
    useFormalitySettings = false,
    deeplStyleOptions = {},
    useDeeplStyleRules = false,
    deeplRequestDelay = 500,
    existingLanguagesModes = {},
    controller,
    onProgress
  } = config;

  // Validate languages
  const validation = validateDeepLLanguages(targetLanguagesCKLS);
  if (validation.unsupported.length > 0) {
    throw new Error(
      `Unsupported languages for DeepL: ${validation.unsupported.join(', ')}`
    );
  }

  // Phase 1: Extract from all files
  if (onProgress) {
    onProgress(0, 0, '', 'extracting');
  }

  const fileExtractions = extractFromMultipleFiles(filesData, doNotTranslate);
  const stringMap = buildUniqueStringMap(fileExtractions);
  let uniqueStrings = Array.from(stringMap.keys());
  
  // Phase 1.5: Filter strings based on fill-empty mode optimization
  let skippedStrings = 0;
  
  // Check if any target languages have modes configured
  const hasModes = targetLanguagesCKLS.some(lang => {
    const normalized = lang.toLowerCase().replace(/^([a-z]{2})-([a-z]{2})$/i, 
      (_, p1, p2) => `${p1.toLowerCase()}-${p2.toUpperCase()}`);
    return existingLanguagesModes[normalized] !== undefined;
  });
  
  console.log('🔍 Fill mode check - Has modes:', hasModes);
  console.log('🔍 Fill mode check - Target languages:', targetLanguagesCKLS);
  console.log('🔍 Fill mode check - Language modes received:', existingLanguagesModes);
  
  if (hasModes) {
    
    const stringsToTranslate = new Set<string>();
    
    // Check each unique string to see if any of its occurrences need translation
    uniqueStrings.forEach(text => {
      const locations = stringMap.get(text) || [];
      let needsTranslation = false;
      
      // Check each occurrence location
      for (const location of locations) {
        const fileData = filesData[location.fileIndex];
        const sheet = fileData.workbook.Sheets[fileData.workbook.SheetNames[0]];
        const json = (window as any).XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const headerRow = json[0] || [];
        
        // Build existing column map for this file
        const existingColIndexes: Record<string, number> = {};
        for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
          const headerValue = headerRow[colIdx];
          if (headerValue && typeof headerValue === 'string') {
            const match = headerValue.match(/\b([a-z]{2}-[A-Z]{2})\b/i);
            if (match) {
              const normalizedCode = match[1].toLowerCase().replace(/^([a-z]{2})-([a-z]{2})$/i, 
                (_, p1, p2) => `${p1.toLowerCase()}-${p2.toUpperCase()}`);
              existingColIndexes[normalizedCode] = colIdx;
            }
          }
        }
        
        // Check if this row needs translation for any target language
        for (const targetLang of targetLanguagesCKLS) {
          const normalizedLang = targetLang.toLowerCase().replace(/^([a-z]{2})-([a-z]{2})$/i, 
            (_, p1, p2) => `${p1.toLowerCase()}-${p2.toUpperCase()}`);
          const mode = existingLanguagesModes[normalizedLang];
          const colIdx = existingColIndexes[normalizedLang];
          
          // If language doesn't exist yet, or mode is not fill-empty, need translation
          if (colIdx === undefined || mode !== 'fill-empty') {
            needsTranslation = true;
            break;
          }
          
          // Check if cell is empty or has a formula
          const rowData = json[location.rowIndex];
          const cellValue = rowData && rowData[colIdx];
          const isEmpty = !cellValue || String(cellValue).trim() === '';
          const isFormula = cellValue && typeof cellValue === 'string' && 
            (cellValue.startsWith('=TRANSLATE(') || cellValue.startsWith('=COPILOT('));
          
          if (isEmpty || isFormula) {
            needsTranslation = true;
            break;
          }
        }
        
        if (needsTranslation) {
          break; // One occurrence needs translation, so include this string
        }
      }
      
      if (needsTranslation) {
        stringsToTranslate.add(text);
      } else {
        skippedStrings++;
      }
    });
    
    uniqueStrings = Array.from(stringsToTranslate);
    
    console.log(`✂️ Fill mode optimization: ${skippedStrings} strings already filled, ${uniqueStrings.length} strings need translation`);
  }

  // Prepare shared translations object
  const sharedTranslations: Record<string, Record<string, string>> = {};
  targetLanguagesCKLS.forEach(lang => {
    sharedTranslations[lang] = {};
  });

  // Track which strings were translated by DeepL API (not glossary, not from original)
  // Map: text -> Set of languages that were translated by DeepL
  const deeplTranslatedTexts = new Map<string, Set<string>>();

  // Initialize language results tracking for success/failure rates
  // Use uniqueStrings.length AFTER filtering to get accurate totals
  const languageResults: Record<string, { successCount: number; failureCount: number; totalStrings: number; successRate: number }> = {};
  targetLanguagesCKLS.forEach(lang => {
    languageResults[lang] = { 
      successCount: 0, 
      failureCount: 0, 
      totalStrings: uniqueStrings.length, // This is now the filtered count
      successRate: 0 
    };
  });

  // Calculate total operations
  const totalOps = uniqueStrings.length * targetLanguagesCKLS.length;
  let currentOp = 0;

  // Phase 2: Translate unique strings only
  for (const targetLang of targetLanguagesCKLS) {
    if (controller && controller.cancelled) {
      throw new Error('Translation cancelled');
    }

    if (onProgress) {
      onProgress(currentOp, totalOps, targetLang, 'translating');
    }

    // Get formality parameter for this language
    let formality: string | null = null;
    
    if (useDeeplStyleRules && !isDeepLProKey(apiKey)) {
      // Free account with formality toggle enabled
      const styleOptions = deeplStyleOptions[targetLang];
      if (styleOptions) {
        if (styleOptions.formal) {
          formality = 'more';
        } else if (styleOptions.informal) {
          formality = 'less';
        }
      }
      console.log('🔍 Multi-file Free API formality check:', { targetLang, styleOptions, formality });
    } else if (useFormalitySettings) {
      // Fallback: old formality settings (legacy)
      formality = getFormalityParameter(targetLang, formalitySettings, useFormalitySettings);
    }

    // Process each unique string
    for (const text of uniqueStrings) {
      await controller.waitIfPaused();

      if (controller.cancelled) {
        throw new Error('Translation cancelled');
      }

      // Apply glossary substitutions (handles full text, phrases, and words)
      const glossaryResult = applyGlossarySubstitutions(
        text,
        sourceCKLS,
        targetLang,
        predefinedTranslations
      );

      if (glossaryResult.hasSubstitutions) {
        // If full match, use it directly
        if (glossaryResult.processedText === "__GLOSSARY_FULL__") {
          sharedTranslations[targetLang][text] = glossaryResult.substitutions["__GLOSSARY_FULL__"];
          languageResults[targetLang].successCount++;
        } else {
          // Has partial substitutions - translate the processed text, then restore
          try {
            const translated = await translateWithDeepL(
              glossaryResult.processedText,
              sourceISO || 'en',
              targetLang,
              apiKey,
              controller.signal,
              formality,
              deeplRequestDelay
            );
            // Restore glossary substitutions
            sharedTranslations[targetLang][text] = restoreGlossarySubstitutions(
              translated,
              glossaryResult.substitutions
            );
            languageResults[targetLang].successCount++;
            
            // Track that this text was translated by DeepL for this language
            if (!deeplTranslatedTexts.has(text)) {
              deeplTranslatedTexts.set(text, new Set());
            }
            deeplTranslatedTexts.get(text)!.add(targetLang);
          } catch (error: any) {
            console.error(`Failed to translate "${text}":`, error);
            sharedTranslations[targetLang][text] = `[Translation failed: ${error.message}]`;
            languageResults[targetLang].failureCount++;
          }

          // Delay between requests to respect rate limits
          await new Promise(resolve => setTimeout(resolve, deeplRequestDelay));
        }
      } else {
        // No glossary matches - translate normally
        try {
          const translated = await translateWithDeepL(
            text,
            sourceISO || 'en',
            targetLang,
            apiKey,
            controller.signal,
            formality,
            deeplRequestDelay
          );
          sharedTranslations[targetLang][text] = translated;
          languageResults[targetLang].successCount++;
          
          // Track that this text was translated by DeepL for this language
          if (!deeplTranslatedTexts.has(text)) {
            deeplTranslatedTexts.set(text, new Set());
          }
          deeplTranslatedTexts.get(text)!.add(targetLang);
        } catch (error: any) {
          console.error(`Failed to translate "${text}":`, error);
          sharedTranslations[targetLang][text] = `[Translation failed: ${error.message}]`;
          languageResults[targetLang].failureCount++;
        }

        // Delay between requests to respect rate limits (500ms for Free API)
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      currentOp++;
      if (onProgress) {
        onProgress(currentOp, totalOps, targetLang, 'translating');
      }
    }
  }

  // Calculate success rates for each language
  targetLanguagesCKLS.forEach(lang => {
    const result = languageResults[lang];
    result.successRate = result.totalStrings > 0 
      ? Math.round((result.successCount / result.totalStrings) * 100) 
      : 0;
  });

  // Phase 3: Apply translations to each file
  if (onProgress) {
    onProgress(totalOps, totalOps, '', 'rebuilding');
  }

  // Convert text-based DeepL tracking to ID-based tracking
  const deeplTranslatedMap = new Map<string, Set<string>>(); // stringId -> Set of languages
  
  fileExtractions.forEach(extraction => {
    extraction.extracted.forEach(item => {
      const text = item.extracted;
      
      // Check if this text was translated by DeepL for any languages
      if (deeplTranslatedTexts.has(text)) {
        const languages = deeplTranslatedTexts.get(text)!;
        
        if (!deeplTranslatedMap.has(item.id)) {
          deeplTranslatedMap.set(item.id, new Set());
        }
        
        // Add all languages that translated this text
        languages.forEach(lang => {
          deeplTranslatedMap.get(item.id)!.add(lang);
        });
      }
    });
  });
  
  console.log(`✅ DeepL Translation Tracking: ${deeplTranslatedMap.size} unique strings tracked across ${targetLanguagesCKLS.length} languages`);

  const results: MultiFileTranslationResult[] = fileExtractions.map((extraction, fileIndex) => {
    const fileData = filesData[fileIndex];
    
    // Build per-file translations by mapping shared translations to IDs
    const fileTranslations: Record<string, Record<string, string>> = {};
    
    targetLanguagesCKLS.forEach(lang => {
      fileTranslations[lang] = {};
      
      extraction.extracted.forEach(item => {
        const text = item.extracted;
        const translatedText = sharedTranslations[lang][text];
        
        if (translatedText) {
          fileTranslations[lang][item.id] = translatedText;
        }
      });
    });

    return {
      fileIndex,
      fileName: fileData.fileName,
      extracted: extraction.extracted,
      rebuilt: extraction.rebuilt,
      translations: fileTranslations,
      languageResults: fileIndex === 0 ? languageResults : undefined, // Only attach to first file to avoid duplication
      deeplTranslatedMap: fileIndex === 0 ? deeplTranslatedMap : undefined // Attach tracking to first file
    };
  });

  return results;
}

// Helper functions for formality detection
function isFormalitySupported(langCode: string): boolean {
  const baseCode = langCode.split('-')[0].toLowerCase();
  const supported = ['de', 'fr', 'it', 'es', 'nl', 'pl', 'pt', 'ru', 'ja', 'vi'];
  return supported.includes(baseCode);
}

function getFormalityParameter(
  targetLang: string,
  formalitySettings: Record<string, 'less' | 'more' | null>,
  useFormalitySettings: boolean
): string | null {
  if (!useFormalitySettings) return null;
  return formalitySettings[targetLang] || null;
}

// Internal DeepL translation function
async function translateWithDeepL(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  signal: AbortSignal,
  formality: string | null,
  requestDelay: number = 500,
  retryCount = 0
): Promise<string> {
  const isFreeKey = apiKey.endsWith(':fx');
  const baseUrl = isFreeKey 
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  const params = new URLSearchParams({
    auth_key: apiKey,
    text: text,
    source_lang: sourceLang.toUpperCase().split('-')[0],
    target_lang: mapToDeepLCode(targetLang)
  });

  // Add formality if specified and supported
  if (formality && isFormalitySupported(targetLang)) {
    params.append('formality', formality);
  }

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
      signal
    });

    if (!response.ok) {
      if (response.status === 429 && retryCount < 3) {
        // Rate limit hit, wait and retry with exponential backoff
        const waitTime = 1000 * (retryCount + 1);
        console.log(`⚠️ Rate limit hit (429), retrying in ${waitTime}ms... (attempt ${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return translateWithDeepL(text, sourceLang, targetLang, apiKey, signal, formality, requestDelay, retryCount + 1);
      }

      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as any).message || response.statusText || `HTTP ${response.status}`;
      throw new Error(`DeepL API error: ${errorMessage}`);
    }

    const data = await response.json();
    return data.translations[0].text;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Translation cancelled');
    }

    if (retryCount < 3 && (error.message.includes('network') || error.message.includes('fetch'))) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return translateWithDeepL(text, sourceLang, targetLang, apiKey, signal, formality, requestDelay, retryCount + 1);
    }

    throw error;
  }
}

