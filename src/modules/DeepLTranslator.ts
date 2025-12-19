/**
 * DeepL Translation Module
 * Handles translation using DeepL API with formality support
 */

import { readColumnD } from './FileHandler';
import { extractTextAndBuildPlaceholders, applyGlossarySubstitutions, restoreGlossarySubstitutions } from '@/utils/textExtraction';
import { TranslationConfig, TranslationResult, TranslationController, LanguageSupport } from '@/types/translation';
import { createStyleRule, updateStyleRule, StyleRuleConfig } from './DeepLStyleRules';

/**
 * Instruction texts for DeepL Style Rules
 */
const DEEPL_INSTRUCTION_TEXTS = {
  formal: "Use a formal, professional tone appropriate for business communications. Maintain respectful language and proper address forms.",
  informal: "Use a casual, conversational tone that feels natural and friendly. Use everyday language.",
  contextAware: "Maintain the structure, formatting, and approximate length of the original text. Preserve line breaks and text flow.",
  technical: "Preserve technical terminology and specialized vocabulary. Do not simplify technical terms.",
};

/**
 * DeepL supported language codes
 * Source: https://www.deepl.com/docs-api/translate-text/
 */
export const DEEPL_SUPPORTED_LANGUAGES: LanguageSupport = {
  'bg': 'BG',      // Bulgarian
  'bg-BG': 'BG',
  'cs': 'CS',      // Czech
  'cs-CZ': 'CS',
  'da': 'DA',      // Danish
  'da-DK': 'DA',
  'de': 'DE',      // German
  'de-DE': 'DE',
  'el': 'EL',      // Greek
  'en': 'EN-GB',   // English (British)
  'en-GB': 'EN-GB',
  'en-US': 'EN-US',
  'es': 'ES',      // Spanish
  'es-ES': 'ES',
  'es-CO': 'ES',
  'et': 'ET',      // Estonian
  'et-EE': 'ET',
  'fi': 'FI',      // Finnish
  'fi-FI': 'FI',
  'fr': 'FR',      // French
  'fr-FR': 'FR',
  'fr-CA': 'FR',
  'hu': 'HU',      // Hungarian
  'hu-HU': 'HU',
  'id': 'ID',      // Indonesian
  'id-ID': 'ID',
  'it': 'IT',      // Italian
  'it-IT': 'IT',
  'ja': 'JA',      // Japanese
  'ja-JP': 'JA',
  'ko': 'KO',      // Korean
  'ko-KR': 'KO',
  'lt': 'LT',      // Lithuanian
  'lt-LT': 'LT',
  'lv': 'LV',      // Latvian
  'lv-LV': 'LV',
  'nb': 'NB',      // Norwegian (Bokmål)
  'nb-NO': 'NB',
  'nl': 'NL',      // Dutch
  'nl-NL': 'NL',
  'pl': 'PL',      // Polish
  'pl-PL': 'PL',
  'pt': 'PT-PT',   // Portuguese
  'pt-BR': 'PT-BR',
  'pt-PT': 'PT-PT',
  'ro': 'RO',      // Romanian
  'ro-RO': 'RO',
  'ru': 'RU',      // Russian
  'ru-RU': 'RU',
  'sk': 'SK',      // Slovak
  'sk-SK': 'SK',
  'sl': 'SL',      // Slovenian
  'sl-SI': 'SL',
  'sv': 'SV',      // Swedish
  'sv-SE': 'SV',
  'tr': 'TR',      // Turkish
  'tr-TR': 'TR',
  'uk': 'UK',      // Ukrainian
  'uk-UA': 'UK',
  'zh': 'ZH',      // Chinese (simplified)
  'zh-Hans': 'ZH',
  'zh-CHS': 'ZH',
  'zh-CN': 'ZH'
};

/**
 * Validate if target languages are supported by DeepL
 */
export function validateDeepLLanguages(targetLanguages: string[]): {
  supported: string[];
  unsupported: string[];
} {
  const supported: string[] = [];
  const unsupported: string[] = [];
  
  targetLanguages.forEach(lang => {
    if (DEEPL_SUPPORTED_LANGUAGES[lang] || DEEPL_SUPPORTED_LANGUAGES[lang.toLowerCase()]) {
      supported.push(lang);
    } else {
      unsupported.push(lang);
    }
  });
  
  return { supported, unsupported };
}

/**
 * Map language code to DeepL format
 */
export function mapToDeepLCode(langCode: string): string {
  const code = langCode.toLowerCase();
  return DEEPL_SUPPORTED_LANGUAGES[code] || DEEPL_SUPPORTED_LANGUAGES[langCode] || langCode.toUpperCase();
}

/**
 * Check if formality is supported for target language
 * DeepL supports formality for: DE, FR, IT, ES, NL, PL, PT, RU, JA, VI
 */
function isFormalitySupported(langCode: string): boolean {
  const baseCode = langCode.split('-')[0].toLowerCase();
  const supported = ['de', 'fr', 'it', 'es', 'nl', 'pl', 'pt', 'ru', 'ja', 'vi'];
  return supported.includes(baseCode);
}

/**
 * Check if DeepL API key is Pro tier
 * Free keys end with ':fx'
 */
export function isDeepLProKey(apiKey: string): boolean {
  return apiKey.length > 0 && !apiKey.endsWith(':fx');
}

/**
 * Check if Style Rules feature is available
 * Style Rules are only available with DeepL Pro API
 */
export function isStyleRulesAvailable(apiKey: string): boolean {
  return isDeepLProKey(apiKey);
}

/**
 * Get formality parameter for DeepL API
 */
function getFormalityParameter(
  targetLang: string,
  formalitySettings: Record<string, 'less' | 'more' | null>,
  useFormalitySettings: boolean
): string | null {
  if (!useFormalitySettings) return null;
  return formalitySettings[targetLang] || null;
}

/**
 * Translate text using DeepL API
 */
async function translateWithDeepL(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  signal: AbortSignal,
  styleRuleId: string | null = null,
  formality: string | null = null,
  retryCount: number = 0
): Promise<string> {
  // Determine endpoint based on API key
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
  
  // Pro API: Use Style Rules if available
  if (isDeepLProKey(apiKey) && styleRuleId) {
    params.append('style_id', styleRuleId);
  }
  // Fallback: Use simple formality
  else if (formality && isFormalitySupported(targetLang)) {
    params.append('formality', formality);
  }
  
  // Debug logging to verify formality is being sent
  console.log('🔍 DeepL API Request:', {
    targetLang,
    formality,
    styleRuleId,
    isFormalitySupported: isFormalitySupported(targetLang),
    isProKey: isDeepLProKey(apiKey),
    params: Object.fromEntries(params.entries())
  });
  
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
        return translateWithDeepL(text, sourceLang, targetLang, apiKey, signal, styleRuleId, formality, retryCount + 1);
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
    
    // Retry on network errors
    if (retryCount < 3 && (error.message.includes('network') || error.message.includes('fetch'))) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return translateWithDeepL(text, sourceLang, targetLang, apiKey, signal, styleRuleId, formality, retryCount + 1);
    }
    
    throw error;
  }
}

/**
 * Translate batch of texts with delay
 */
async function translateBatch(
  batch: Array<{ id: string; text: string }>,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  controller: TranslationController,
  styleRuleId: string | null,
  formality: string | null,
  deeplRequestDelay: number,
  onProgress?: () => void
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  
  for (let i = 0; i < batch.length; i++) {
    await controller.waitIfPaused();
    
    if (controller.cancelled) {
      throw new Error('Translation cancelled');
    }
    
    const { id, text } = batch[i];
    
    try {
      results[id] = await translateWithDeepL(text, sourceLang, targetLang, apiKey, controller.signal, styleRuleId, formality);
    } catch (error: any) {
      console.error(`Failed to translate text ${id}:`, error);
      results[id] = `[Translation failed: ${error.message}]`;
    }
    
    if (onProgress) {
      onProgress();
    }
    
    // Delay between requests to respect rate limits
    if (i < batch.length - 1) {
      await new Promise(resolve => setTimeout(resolve, deeplRequestDelay));
    }
  }
  
  return results;
}

/**
 * Build instruction text from style options
 */
function buildInstructionText(options: any, customText: string): string {
  const parts: string[] = [];
  
  if (options.formal) parts.push(DEEPL_INSTRUCTION_TEXTS.formal);
  if (options.informal) parts.push(DEEPL_INSTRUCTION_TEXTS.informal);
  if (options.contextAware) parts.push(DEEPL_INSTRUCTION_TEXTS.contextAware);
  if (options.technical) parts.push(DEEPL_INSTRUCTION_TEXTS.technical);
  if (options.custom && customText) parts.push(customText);
  
  return parts.join(" ");
}

/**
 * Ensure style rule exists (create or update)
 * Returns style rule ID or null if failed
 */
async function ensureStyleRule(
  apiKey: string,
  targetLang: string,
  options: any,
  customText: string,
  existingId: string | null
): Promise<string | null> {
  // Build instruction text
  const instruction = buildInstructionText(options, customText);
  
  // Skip if no options selected
  if (!options.formal && !options.informal && !options.contextAware && !options.technical && !options.custom) {
    return null;
  }
  
  const config: StyleRuleConfig = {
    name: `${targetLang} Translation Rules`,
    language: mapToDeepLCode(targetLang),
    formality: options.formal 
      ? 'use_formal_tone' 
      : options.informal 
      ? 'use_casual_tone' 
      : undefined,
    custom_instructions: instruction ? [{
      label: "Translation guidelines",
      prompt: instruction
    }] : []
  };
  
  try {
    if (existingId) {
      // Update existing style rule
      await updateStyleRule(apiKey, existingId, config);
      console.log(`✅ Updated style rule for ${targetLang}: ${existingId}`);
      return existingId;
    } else {
      // Create new style rule
      const rule = await createStyleRule(apiKey, config);
      console.log(`✅ Created style rule for ${targetLang}: ${rule.style_id}`);
      return rule.style_id;
    }
  } catch (error) {
    console.error(`Failed to manage style rule for ${targetLang}:`, error);
    return null;
  }
}

/**
 * Translate all texts using DeepL API
 */
export async function translateAllWithDeepL(config: TranslationConfig): Promise<TranslationResult> {
  const {
    workbook,
    targetLanguagesCKLS,
    sourceISO,
    sourceCKLS,
    doNotTranslate,
    predefinedTranslations,
    apiKey,
    formalitySettings = {},
    useFormalitySettings = false,
    deeplStyleOptions = {},
    deeplCustomInstructions = {},
    deeplStyleRuleIds = {},
    useDeeplStyleRules = false,
    onProgress,
    controller,
    fileTitleSlug: _fileTitleSlug
  } = config;
  
  
  // Extract texts from workbook
  const rows = readColumnD(workbook);
  const { extracted, rebuilt } = extractTextAndBuildPlaceholders(rows, doNotTranslate);
  
  // Prepare translations object
  const translations: Record<string, Record<string, string>> = {};
  targetLanguagesCKLS.forEach(lang => {
    translations[lang] = {};
  });
  
  // Calculate total operations
  const totalOperations = extracted.length * targetLanguagesCKLS.length;
  let currentOperation = 0;
  
  // Process each target language
  for (const targetLang of targetLanguagesCKLS) {
    if (controller && controller.cancelled) {
      throw new Error('Translation cancelled');
    }
    
    // Check if source and target are the same base language (e.g., en-US → en-GB, pt-PT → pt-BR)
    const sourceBase = (sourceISO || sourceCKLS || 'en').split('-')[0].toLowerCase();
    const targetBase = targetLang.split('-')[0].toLowerCase();
    
    if (sourceBase === targetBase) {
      // Same language family - copy source text directly instead of translating
      console.log(`⚠️ Skipping DeepL translation for ${targetLang}: same base language as source (${sourceBase})`);
      
      for (const item of extracted) {
        translations[targetLang][item.id] = item.extracted;
        currentOperation++;
        if (onProgress) {
          onProgress(currentOperation, totalOperations, targetLang);
        }
      }
      
      continue; // Skip to next language
    }
    
    // Separate texts into predefined and to-translate
    const toTranslate: Array<{ id: string; text: string; substitutions?: Record<string, string> }> = [];
    
    for (const item of extracted) {
      const sourceText = item.extracted;
      
      // Apply glossary substitutions (handles full text, phrases, and words)
      const glossaryResult = applyGlossarySubstitutions(
        sourceText,
        sourceCKLS,
        targetLang,
        predefinedTranslations
      );
      
      if (glossaryResult.hasSubstitutions) {
        // If full match, use it directly
        if (glossaryResult.processedText === "__GLOSSARY_FULL__") {
          translations[targetLang][item.id] = glossaryResult.substitutions["__GLOSSARY_FULL__"];
          currentOperation++;
          if (onProgress) {
            onProgress(currentOperation, totalOperations, targetLang);
          }
          continue; // Skip to next item
        } else {
          // Has partial substitutions - translate the processed text, then restore
          toTranslate.push({
            id: item.id,
            text: glossaryResult.processedText,
            substitutions: glossaryResult.substitutions
          });
          continue; // Skip to next item
        }
      }
      
      // No glossary matches or corrections - translate normally
        toTranslate.push({ id: item.id, text: sourceText });
    }
    
    // Get style rule ID or formality parameter
    let styleRuleId: string | null = null;
    let formality: string | null = null;
    
    if (useDeeplStyleRules && isDeepLProKey(apiKey)) {
      // Pro account with Style Rules enabled
      const styleOptions = deeplStyleOptions[targetLang];
      if (styleOptions) {
        styleRuleId = await ensureStyleRule(
          apiKey,
          targetLang,
          styleOptions,
          deeplCustomInstructions[targetLang] || '',
          deeplStyleRuleIds[targetLang] || null
        );
      }
    } else if (useDeeplStyleRules && !isDeepLProKey(apiKey)) {
      // Free account with formality toggle enabled
      const styleOptions = deeplStyleOptions[targetLang];
      console.log('🔍 Single-file Free API formality check:', { targetLang, styleOptions, deeplStyleOptionsKeys: Object.keys(deeplStyleOptions) });
      if (styleOptions) {
        if (styleOptions.formal) {
          formality = 'more';
        } else if (styleOptions.informal) {
          formality = 'less';
        }
      }
    } else if (useFormalitySettings) {
      // Fallback: old formality settings (legacy)
      formality = getFormalityParameter(targetLang, formalitySettings, useFormalitySettings);
    }
    
    // Translate in batches
    const batchSize = 5;
    for (let i = 0; i < toTranslate.length; i += batchSize) {
      const batch = toTranslate.slice(i, i + batchSize);
      
      const batchResults = await translateBatch(
        batch.map(b => ({ id: b.id, text: b.text })),
        sourceISO || 'en',
        targetLang,
        apiKey,
        controller,
        styleRuleId,
        formality,
        config.deeplRequestDelay || 500,
        () => {
          currentOperation++;
          if (onProgress) {
            onProgress(currentOperation, totalOperations, targetLang);
          }
        }
      );
      
      // Restore glossary substitutions and merge results
      for (const item of batch) {
        let translated = batchResults[item.id];
        if (item.substitutions && Object.keys(item.substitutions).length > 0) {
          translated = restoreGlossarySubstitutions(translated, item.substitutions);
        }
        translations[targetLang][item.id] = translated;
      }
      
      // Delay between batches to avoid rate limiting
      if (i + batchSize < toTranslate.length) {
        await new Promise(resolve => setTimeout(resolve, config.deeplRequestDelay || 500));
      }
    }
  }
  
  return {
    extracted,
    rebuilt,
    translations
  };
}

/**
 * Translate plain text/HTML using DeepL API
 * Extracts text from HTML, translates pieces, rebuilds HTML
 * @param text - Text to translate
 * @param sourceISO - Source language ISO code
 * @param targetLanguagesCKLS - Array of target language codes in CKLS format
 * @param apiKey - DeepL API key
 * @param doNotTranslate - Terms to preserve
 * @param translationInstructions - Optional custom instructions per language
 * @param controller - Optional translation controller for pause/cancel
 * @param onProgress - Optional progress callback
 * @returns Map of target language to translated text
 */
export async function translateTextWithDeepL(
  text: string,
  sourceISO: string,
  targetLanguagesCKLS: string[],
  apiKey: string,
  doNotTranslate: string[] = [],
  formalitySettings?: Record<string, 'less' | 'more' | null>,
  useFormalitySettings?: boolean,
  deeplStyleOptions?: Record<string, any>,
  deeplCustomInstructions?: Record<string, string>,
  deeplStyleRuleIds?: Record<string, string>,
  useDeeplStyleRules?: boolean,
  deeplRequestDelay?: number,
  controller?: TranslationController,
  onProgress?: (current: number, total: number, currentLang: string) => void,
  contentType?: 'html' | 'json' | 'plain',
  jsonSchema?: any
): Promise<Record<string, string>> {
  // If JSON content, use JSON-specific handling
  if (contentType === 'json') {
    const { extractJsonText, rebuildJsonFromTemplate, extractSourceLocaleFromJson, localeToISO } = await import('@/utils/jsonTextExtraction');
    
    // Only use schema-based extraction if we have a schema
    if (jsonSchema) {
    
    const { extracted, template } = extractJsonText(text, jsonSchema);
    const translations: Record<string, string> = {};
    
    // Detect source language from JSON's locale field
    const sourceLocale = extractSourceLocaleFromJson(text);
    const detectedSourceISO = sourceLocale ? localeToISO(sourceLocale) : sourceISO;
    
    const apiUrl = apiKey.endsWith(':fx')
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';
    
    // Calculate total operations for proper progress tracking
    const totalOperations = extracted.length * targetLanguagesCKLS.length;
    let currentOperation = 0;
    
    for (let langIndex = 0; langIndex < targetLanguagesCKLS.length; langIndex++) {
      const targetCKLS = targetLanguagesCKLS[langIndex];
      const targetDeepL = mapToDeepLCode(targetCKLS);
      
      if (controller && controller.cancelled) {
        throw new Error('Translation cancelled');
      }
      
      while (controller && controller.paused) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Get style rule ID or formality parameter
      let styleRuleId: string | null = null;
      let formality: string | null = null;
      
      if (useDeeplStyleRules && isDeepLProKey(apiKey)) {
        // Pro account with Style Rules enabled
        const styleOptions = deeplStyleOptions?.[targetCKLS];
        if (styleOptions) {
          styleRuleId = await ensureStyleRule(
            apiKey,
            targetCKLS,
            styleOptions,
            deeplCustomInstructions?.[targetCKLS] || '',
            deeplStyleRuleIds?.[targetCKLS] || null
          );
        }
      } else if (useDeeplStyleRules && !isDeepLProKey(apiKey)) {
        // Free account with formality toggle enabled
        const styleOptions = deeplStyleOptions?.[targetCKLS];
        if (styleOptions) {
          if (styleOptions.formal) {
            formality = 'more';
          } else if (styleOptions.informal) {
            formality = 'less';
          }
        }
      } else if (useFormalitySettings) {
        // Fallback: old formality settings (legacy)
        formality = getFormalityParameter(targetCKLS, formalitySettings || {}, useFormalitySettings || false);
      }
      
      const translatedPieces: Record<string, string> = {};
      
      for (const item of extracted) {
        // Check for cancellation/pause before each string
        if (controller && controller.cancelled) {
          throw new Error('Translation cancelled');
        }
        
        while (controller && controller.paused) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Update progress for each string being translated
        if (onProgress) {
          onProgress(currentOperation, totalOperations, targetCKLS);
        }
        
        const body: any = {
          text: [item.extracted],
          source_lang: detectedSourceISO.toUpperCase(),
          target_lang: targetDeepL,
          preserve_formatting: true
        };
        
        // Pro API: Use Style Rules if available
        if (styleRuleId) {
          body.style_id = styleRuleId;
        }
        // Fallback: Use simple formality
        else if (formality) {
          body.formality = formality;
        }
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`DeepL API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        translatedPieces[item.id] = data.translations[0].text;
        
        // Increment operation counter after successful translation
        currentOperation++;
        
        await new Promise(resolve => setTimeout(resolve, deeplRequestDelay || 500));
      }
      
      // Use targetCKLS directly as the target locale (e.g., "fr-FR")
      const targetLocale = targetCKLS;
      
      // Rebuild JSON with translations
      const translatedJson = rebuildJsonFromTemplate(
        template,
        translatedPieces,
        targetLocale
      );
      
      translations[targetCKLS] = translatedJson;
    }
    
    // Final progress update
    if (onProgress) {
      onProgress(totalOperations, totalOperations, '');
    }
    
    return translations;
    } else {
      // JSON without recognized schema - not supported
      throw new Error(
        'JSON format not recognized for API translation. ' +
        'Only Meta-Skills Avatar AI JSON is currently supported.'
      );
    }
  }
  
  // Extract text from HTML (same as file translation)
  const { extracted, rebuilt } = extractTextAndBuildPlaceholders(
    [{ rowIndex: 1, original: text }],
    doNotTranslate
  );
  
  // DEBUG: Log what was extracted
  console.log('🔍 DeepL Text Mode - Extracted items:', extracted.map(e => ({
    id: e.id,
    text: e.extracted,
    length: e.extracted.length
  })));
  console.log('🔍 DeepL Text Mode - DNT terms:', doNotTranslate);
  console.log('🔍 DeepL Text Mode - Rebuilt template:', rebuilt);
  
  const translations: Record<string, string> = {};
  
  // Determine API endpoint
  const apiUrl = apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';
  
  // Calculate total operations for proper progress tracking
  const totalOperations = extracted.length * targetLanguagesCKLS.length;
  let currentOperation = 0;
  
  // Translate each target language
  for (let langIndex = 0; langIndex < targetLanguagesCKLS.length; langIndex++) {
    const targetCKLS = targetLanguagesCKLS[langIndex];
    const targetDeepL = mapToDeepLCode(targetCKLS);
    
    if (controller && controller.cancelled) {
      throw new Error('Translation cancelled');
    }
    
    while (controller && controller.paused) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Get style rule ID or formality parameter
    let styleRuleId: string | null = null;
    let formality: string | null = null;
    
    if (useDeeplStyleRules && isDeepLProKey(apiKey)) {
      // Pro account with Style Rules enabled
      const styleOptions = deeplStyleOptions?.[targetCKLS];
      if (styleOptions) {
        styleRuleId = await ensureStyleRule(
          apiKey,
          targetCKLS,
          styleOptions,
          deeplCustomInstructions?.[targetCKLS] || '',
          deeplStyleRuleIds?.[targetCKLS] || null
        );
      }
    } else if (useDeeplStyleRules && !isDeepLProKey(apiKey)) {
      // Free account with formality toggle enabled
      const styleOptions = deeplStyleOptions?.[targetCKLS];
      if (styleOptions) {
        if (styleOptions.formal) {
          formality = 'more';
        } else if (styleOptions.informal) {
          formality = 'less';
        }
      }
    } else if (useFormalitySettings) {
      // Fallback: old formality settings (legacy)
      formality = getFormalityParameter(targetCKLS, formalitySettings || {}, useFormalitySettings || false);
    }
    
    // Translate each extracted text piece
    const translatedPieces: Record<string, string> = {};
    
    for (const item of extracted) {
      // Check for cancellation/pause before each string
      if (controller && controller.cancelled) {
        throw new Error('Translation cancelled');
      }
      
      while (controller && controller.paused) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Update progress for each string being translated
      if (onProgress) {
        onProgress(currentOperation, totalOperations, targetCKLS);
      }
      
      try {
        // Use URL-encoded format (same as file translation) for better language detection
        const params = new URLSearchParams({
          text: item.extracted,
          source_lang: sourceISO.toUpperCase().split('-')[0],
          target_lang: targetDeepL,
          preserve_formatting: '1',
          split_sentences: '0'
        });
        
        // Pro API: Use Style Rules if available
        if (styleRuleId) {
          params.append('style_id', styleRuleId);
        }
        // Fallback: Use simple formality
        else if (formality) {
          params.append('formality', formality);
        }
        
        // DEBUG: Log what's being sent to DeepL
        console.log('🔍 Sending to DeepL:', {
          id: item.id,
          text: item.extracted,
          textLength: item.extracted.length,
          source_lang: params.get('source_lang'),
          target_lang: params.get('target_lang'),
          apiUrl,
          params: Object.fromEntries(params.entries())
        });
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ DeepL API error:', response.status, errorText);
          throw new Error(`DeepL API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        translatedPieces[item.id] = data.translations[0].text;
        
        // DEBUG: Log the translation result
        console.log('✅ DeepL response for', item.id, ':', {
          original: item.extracted,
          translated: data.translations[0].text,
          detectedSourceLang: data.translations[0].detected_source_language
        });
        
        // Increment operation counter after successful translation
        currentOperation++;
        
        // Delay between API calls to respect rate limits
        await new Promise(resolve => setTimeout(resolve, deeplRequestDelay || 500));
        
      } catch (error: any) {
        console.error(`Error translating piece ${item.id}:`, error);
        throw new Error(`Failed to translate: ${error.message}`);
      }
    }
    
    // Rebuild HTML with translations
    const template = rebuilt[0]?.template || text;
    let translatedText = template;
    
    // DEBUG: Log rebuilding process
    console.log('🔧 Rebuilding with template:', template.substring(0, 200));
    console.log('🔧 Translation pieces to insert:', translatedPieces);
    
    Object.entries(translatedPieces).forEach(([id, translation]) => {
      translatedText = translatedText.replace(`{${id}}`, translation);
    });
    
    console.log('✅ Final translated text for', targetCKLS, ':', translatedText.substring(0, 200));
    
    translations[targetCKLS] = translatedText;
  }
  
  // Final progress update
  if (onProgress) {
    onProgress(totalOperations, totalOperations, '');
  }
  
  return translations;
}

