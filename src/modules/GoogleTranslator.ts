/**
 * Google Cloud Translation Module
 * Handles translation using Google Cloud Translation API v2
 */

import { readColumnD } from './FileHandler';
import { extractTextAndBuildPlaceholders, applyGlossarySubstitutions, restoreGlossarySubstitutions } from '../utils/textExtraction';
import { TranslationConfig, TranslationResult, TranslationController, LanguageSupport } from '../types/translation';

/**
 * Google Cloud Translation supported language codes
 * Source: https://cloud.google.com/translate/docs/languages
 */
export const GOOGLE_SUPPORTED_LANGUAGES: LanguageSupport = {
  'af': 'af',      // Afrikaans
  'sq': 'sq',      // Albanian
  'am': 'am',      // Amharic
  'ar': 'ar',      // Arabic
  'hy': 'hy',      // Armenian
  'az': 'az',      // Azerbaijani
  'eu': 'eu',      // Basque
  'be': 'be',      // Belarusian
  'bn': 'bn',      // Bengali
  'bs': 'bs',      // Bosnian
  'bg': 'bg',      // Bulgarian
  'ca': 'ca',      // Catalan
  'ceb': 'ceb',    // Cebuano
  'zh': 'zh-CN',   // Chinese (Simplified)
  'zh-CHS': 'zh-CN',
  'zh-CN': 'zh-CN',
  'zh-Hans': 'zh-CN',
  'zh-TW': 'zh-TW',
  'zh-Hant': 'zh-TW',
  'co': 'co',      // Corsican
  'hr': 'hr',      // Croatian
  'cs': 'cs',      // Czech
  'da': 'da',      // Danish
  'nl': 'nl',      // Dutch
  'en': 'en',      // English
  'en-GB': 'en',
  'en-US': 'en',
  'eo': 'eo',      // Esperanto
  'et': 'et',      // Estonian
  'fi': 'fi',      // Finnish
  'fr': 'fr',      // French
  'fy': 'fy',      // Frisian
  'gl': 'gl',      // Galician
  'ka': 'ka',      // Georgian
  'de': 'de',      // German
  'el': 'el',      // Greek
  'gu': 'gu',      // Gujarati
  'ht': 'ht',      // Haitian Creole
  'ha': 'ha',      // Hausa
  'haw': 'haw',    // Hawaiian
  'he': 'he',      // Hebrew
  'hi': 'hi',      // Hindi
  'hmn': 'hmn',    // Hmong
  'hu': 'hu',      // Hungarian
  'is': 'is',      // Icelandic
  'ig': 'ig',      // Igbo
  'id': 'id',      // Indonesian
  'ga': 'ga',      // Irish
  'it': 'it',      // Italian
  'ja': 'ja',      // Japanese
  'jv': 'jv',      // Javanese
  'kn': 'kn',      // Kannada
  'kk': 'kk',      // Kazakh
  'km': 'km',      // Khmer
  'rw': 'rw',      // Kinyarwanda
  'ko': 'ko',      // Korean
  'ku': 'ku',      // Kurdish
  'ky': 'ky',      // Kyrgyz
  'lo': 'lo',      // Lao
  'la': 'la',      // Latin
  'lv': 'lv',      // Latvian
  'lt': 'lt',      // Lithuanian
  'lb': 'lb',      // Luxembourgish
  'mk': 'mk',      // Macedonian
  'mg': 'mg',      // Malagasy
  'ms': 'ms',      // Malay
  'ml': 'ml',      // Malayalam
  'mt': 'mt',      // Maltese
  'mi': 'mi',      // Maori
  'mr': 'mr',      // Marathi
  'mn': 'mn',      // Mongolian
  'my': 'my',      // Myanmar (Burmese)
  'ne': 'ne',      // Nepali
  'no': 'no',      // Norwegian
  'nb': 'no',      // Norwegian (Bokmål)
  'ny': 'ny',      // Nyanja (Chichewa)
  'or': 'or',      // Odia (Oriya)
  'ps': 'ps',      // Pashto
  'fa': 'fa',      // Persian
  'pl': 'pl',      // Polish
  'pt': 'pt',      // Portuguese
  'pt-BR': 'pt',
  'pt-PT': 'pt',
  'pa': 'pa',      // Punjabi
  'ro': 'ro',      // Romanian
  'ru': 'ru',      // Russian
  'sm': 'sm',      // Samoan
  'gd': 'gd',      // Scots Gaelic
  'sr': 'sr',      // Serbian
  'st': 'st',      // Sesotho
  'sn': 'sn',      // Shona
  'sd': 'sd',      // Sindhi
  'si': 'si',      // Sinhala (Sinhalese)
  'sk': 'sk',      // Slovak
  'sl': 'sl',      // Slovenian
  'so': 'so',      // Somali
  'es': 'es',      // Spanish
  'su': 'su',      // Sundanese
  'sw': 'sw',      // Swahili
  'sv': 'sv',      // Swedish
  'tl': 'tl',      // Tagalog (Filipino)
  'tg': 'tg',      // Tajik
  'ta': 'ta',      // Tamil
  'tt': 'tt',      // Tatar
  'te': 'te',      // Telugu
  'th': 'th',      // Thai
  'tr': 'tr',      // Turkish
  'tk': 'tk',      // Turkmen
  'uk': 'uk',      // Ukrainian
  'ur': 'ur',      // Urdu
  'ug': 'ug',      // Uyghur
  'uz': 'uz',      // Uzbek
  'vi': 'vi',      // Vietnamese
  'cy': 'cy',      // Welsh
  'xh': 'xh',      // Xhosa
  'yi': 'yi',      // Yiddish
  'yo': 'yo',      // Yoruba
  'zu': 'zu'       // Zulu
};

/**
 * Validate if target languages are supported by Google Cloud Translation
 */
export function validateGoogleLanguages(targetLanguages: string[]): {
  supported: string[];
  unsupported: string[];
} {
  const supported: string[] = [];
  const unsupported: string[] = [];
  
  targetLanguages.forEach(lang => {
    if (GOOGLE_SUPPORTED_LANGUAGES[lang] || GOOGLE_SUPPORTED_LANGUAGES[lang.toLowerCase()]) {
      supported.push(lang);
    } else {
      unsupported.push(lang);
    }
  });
  
  return { supported, unsupported };
}

/**
 * Map language code to Google Cloud Translation format
 */
export function mapToGoogleCode(langCode: string): string {
  const code = langCode.toLowerCase();
  return GOOGLE_SUPPORTED_LANGUAGES[code] || GOOGLE_SUPPORTED_LANGUAGES[langCode] || langCode.toLowerCase();
}

/**
 * Translate text using Google Cloud Translation API
 */
async function translateWithGoogle(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  signal: AbortSignal,
  retryCount: number = 0
): Promise<string> {
  const baseUrl = 'https://translation.googleapis.com/language/translate/v2';
  
  // API key must be passed as URL parameter, not in body
  const url = `${baseUrl}?key=${encodeURIComponent(apiKey)}`;
  
  const requestBody = {
    q: text,
    source: sourceLang.toLowerCase().split('-')[0],
    target: mapToGoogleCode(targetLang),
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
        // Rate limit hit, wait and retry
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
    
    // Retry on network errors
    if (retryCount < 3 && (error.message.includes('network') || error.message.includes('fetch'))) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return translateWithGoogle(text, sourceLang, targetLang, apiKey, signal, retryCount + 1);
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
      results[id] = await translateWithGoogle(text, sourceLang, targetLang, apiKey, controller.signal);
    } catch (error: any) {
      console.error(`Failed to translate text ${id}:`, error);
      results[id] = `[Translation failed: ${error.message}]`;
    }
    
    if (onProgress) {
      onProgress();
    }
    
    // Small delay between requests to respect rate limits
    if (i < batch.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * Translate all texts using Google Cloud Translation API
 */
export async function translateAllWithGoogle(config: TranslationConfig): Promise<TranslationResult> {
  const {
    workbook,
    targetLanguagesCKLS,
    sourceISO,
    sourceCKLS,
    doNotTranslate,
    predefinedTranslations,
    apiKey,
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
    
    // Check if source and target are the same base language (e.g., en-US → en-GB)
    const sourceBase = (sourceISO || sourceCKLS || 'en').split('-')[0].toLowerCase();
    const targetBase = targetLang.split('-')[0].toLowerCase();
    
    if (sourceBase === targetBase) {
      // Same language family - copy source text directly instead of translating
      console.log(`⚠️ Skipping Google translation for ${targetLang}: same base language as source (${sourceBase})`);
      
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
      
        // No glossary matches - translate normally
        toTranslate.push({ id: item.id, text: sourceText });
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
      
      // Delay between batches
      if (i + batchSize < toTranslate.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
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
 * Translate plain text/HTML using Google Cloud Translation API
 * Extracts text from HTML, translates pieces, rebuilds HTML
 * @param text - Text to translate
 * @param sourceISO - Source language ISO code
 * @param targetLanguagesCKLS - Array of target language codes in CKLS format
 * @param apiKey - Google Cloud Translation API key
 * @param doNotTranslate - Terms to preserve
 * @param controller - Optional translation controller for pause/cancel
 * @param onProgress - Optional progress callback
 * @returns Map of target language to translated text
 */
export async function translateTextWithGoogle(
  text: string,
  sourceISO: string,
  targetLanguagesCKLS: string[],
  apiKey: string,
  doNotTranslate: string[] = [],
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
    
    // Calculate total operations for proper progress tracking
    const totalOperations = extracted.length * targetLanguagesCKLS.length;
    let currentOperation = 0;
    
    for (let langIndex = 0; langIndex < targetLanguagesCKLS.length; langIndex++) {
      const targetCKLS = targetLanguagesCKLS[langIndex];
      const targetISO = mapToGoogleCode(targetCKLS);
      
      if (controller && controller.cancelled) {
        throw new Error('Translation cancelled');
      }
      
      while (controller && controller.paused) {
        await new Promise(resolve => setTimeout(resolve, 100));
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
        
        const response = await fetch(
          `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              q: item.extracted,
              source: detectedSourceISO,
              target: targetISO,
              format: 'text'
            })
          }
        );
        
        if (!response.ok) {
          throw new Error(`Translation failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        translatedPieces[item.id] = data.data.translations[0].translatedText;
        
        // Increment operation counter after successful translation
        currentOperation++;
        
        await new Promise(resolve => setTimeout(resolve, 50));
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
  
  const translations: Record<string, string> = {};
  
  // Calculate total operations for proper progress tracking
  const totalOperations = extracted.length * targetLanguagesCKLS.length;
  let currentOperation = 0;
  
  // Translate each target language
  for (let langIndex = 0; langIndex < targetLanguagesCKLS.length; langIndex++) {
    const targetCKLS = targetLanguagesCKLS[langIndex];
    const targetISO = mapToGoogleCode(targetCKLS);
    
    if (controller && controller.cancelled) {
      throw new Error('Translation cancelled');
    }
    
    while (controller && controller.paused) {
      await new Promise(resolve => setTimeout(resolve, 100));
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
        const response = await fetch(
          `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              q: item.extracted,
              source: sourceISO,
              target: targetISO,
              format: 'text'
            })
          }
        );
        
        if (!response.ok) {
          throw new Error(`Translation failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        translatedPieces[item.id] = data.data.translations[0].translatedText;
        
        // Increment operation counter after successful translation
        currentOperation++;
        
        // Small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error: any) {
        console.error(`Error translating piece ${item.id}:`, error);
        throw new Error(`Failed to translate: ${error.message}`);
      }
    }
    
    // Rebuild HTML with translations
    const template = rebuilt[0]?.template || text;
    let translatedText = template;
    Object.entries(translatedPieces).forEach(([id, translation]) => {
      translatedText = translatedText.replace(`{${id}}`, translation);
    });
    
    translations[targetCKLS] = translatedText;
  }
  
  // Final progress update
  if (onProgress) {
    onProgress(totalOperations, totalOperations, '');
  }
  
  return translations;
}

