/**
 * Multi-File Translator
 * Handles translation of multiple files with smart deduplication
 */

import { applyGlossarySubstitutions, restoreGlossarySubstitutions } from '@/utils/textExtraction';
import { extractFromMultipleFiles, buildUniqueStringMap } from './MultiFileHandler';
import type { FileData } from '@/types/multiFile';
import type { GlossaryEntry } from '@/types';
import type { TranslationController } from '@/utils/TranslationController';

export interface MultiFileTranslationConfig {
  filesData: FileData[];
  targetLanguagesCKLS: string[];
  sourceISO: string;
  sourceCKLS: string; // Source language in CKLS format for glossary matching
  doNotTranslate: string[];
  predefinedTranslations: GlossaryEntry[];
  apiKey: string;
  formalitySettings?: Record<string, 'less' | 'more' | null>;
  useFormalitySettings?: boolean;
  deeplStyleOptions?: Record<string, any>;
  useDeeplStyleRules?: boolean;
  deeplRequestDelay?: number; // milliseconds between requests (100, 300, or 500)
  existingLanguagesModes?: Record<string, 'keep' | 'fill-empty' | 'overwrite-all'>; // Per-language overwrite modes
  controller: TranslationController;
  onProgress?: (current: number, total: number, currentLang: string, phase: string, fileIndex?: number) => void;
}

export interface MultiFileTranslationResult {
  fileIndex: number;
  fileName: string;
  extracted: Array<{
    id: string;
    rowIndex: number;
    extracted: string;
  }>;
  rebuilt: Array<{
    rowIndex: number;
    template: string;
  }>;
  translations: Record<string, Record<string, string>>;
  languageResults?: Record<string, {
    successCount: number;
    failureCount: number;
    totalStrings: number;
    successRate: number;
  }>;
  deeplTranslatedMap?: Map<string, Set<string>>; // stringId -> Set of languages translated by DeepL
}

/**
 * Translate multiple files with Google Cloud Translation
 * Uses smart deduplication to translate unique strings only once
 * @param config - Translation configuration
 * @returns Array of translation results, one per file
 */
export async function translateMultipleFilesWithGoogle(
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
    controller,
    onProgress
  } = config;

  // Phase 1: Extract from all files
  if (onProgress) {
    onProgress(0, 0, '', 'extracting');
  }

  const fileExtractions = extractFromMultipleFiles(filesData, doNotTranslate);
  const stringMap = buildUniqueStringMap(fileExtractions);
  const uniqueStrings = Array.from(stringMap.keys());

  // Prepare shared translations object
  const sharedTranslations: Record<string, Record<string, string>> = {};
  targetLanguagesCKLS.forEach(lang => {
    sharedTranslations[lang] = {};
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
        } else {
          // Has partial substitutions - translate the processed text, then restore
          try {
            const translated = await translateWithGoogle(
              glossaryResult.processedText,
              sourceISO || 'en',
              targetLang,
              apiKey,
              controller.signal
            );
            // Restore glossary substitutions
            sharedTranslations[targetLang][text] = restoreGlossarySubstitutions(
              translated,
              glossaryResult.substitutions
            );
          } catch (error: any) {
            console.error(`Failed to translate "${text}":`, error);
            sharedTranslations[targetLang][text] = `[Translation failed: ${error.message}]`;
          }

          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } else {
        // No glossary matches - translate normally
        try {
          const translated = await translateWithGoogle(
            text,
            sourceISO || 'en',
            targetLang,
            apiKey,
            controller.signal
          );
          sharedTranslations[targetLang][text] = translated;
        } catch (error: any) {
          console.error(`Failed to translate "${text}":`, error);
          sharedTranslations[targetLang][text] = `[Translation failed: ${error.message}]`;
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      currentOp++;
      if (onProgress) {
        onProgress(currentOp, totalOps, targetLang, 'translating');
      }
    }
  }

  // Phase 3: Apply translations to each file
  if (onProgress) {
    onProgress(totalOps, totalOps, '', 'rebuilding');
  }

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
      translations: fileTranslations
    };
  });

  return results;
}

// Re-export the translateWithGoogle function for internal use
async function translateWithGoogle(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  signal: AbortSignal,
  retryCount = 0
): Promise<string> {
  const baseUrl = 'https://translation.googleapis.com/language/translate/v2';
  const url = `${baseUrl}?key=${encodeURIComponent(apiKey)}`;

  const requestBody = {
    q: text,
    source: sourceLang.toLowerCase().split('-')[0],
    target: targetLang.toLowerCase().split('-')[0],
    format: 'text'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.ok) {
      if (response.status === 429 && retryCount < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return translateWithGoogle(text, sourceLang, targetLang, apiKey, signal, retryCount + 1);
      }

      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;
      throw new Error(`Google Cloud Translation API error: ${errorMessage}`);
    }

    const data = await response.json();
    return data.data.translations[0].translatedText;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Translation cancelled');
    }

    if (retryCount < 3 && (error.message.includes('network') || error.message.includes('fetch'))) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return translateWithGoogle(text, sourceLang, targetLang, apiKey, signal, retryCount + 1);
    }

    throw error;
  }
}

