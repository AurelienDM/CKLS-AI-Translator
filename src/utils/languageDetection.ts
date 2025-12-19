/**
 * Language Detection Utilities
 * Auto-detect source language using Google Cloud Translation API
 */

/**
 * Auto-detect source language using Google Cloud Translation API
 * @param text - Text to detect language from
 * @param apiKey - Google API key
 * @returns Detected language code and confidence
 */
export async function detectLanguageWithAI(
  text: string,
  apiKey: string
): Promise<{ language: string; confidence: number }> {
  // Take first 1000 chars for detection (API limit)
  const sampleText = text.slice(0, 1000);
  
  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: sampleText })
      }
    );

    if (!response.ok) {
      throw new Error('Language detection failed');
    }

    const data = await response.json();
    const detection = data.data.detections[0][0];
    
    return {
      language: detection.language, // ISO code like 'en', 'fr'
      confidence: detection.confidence
    };
  } catch (error) {
    console.error('Auto-detect failed:', error);
    // Fallback to English
    return { language: 'en', confidence: 0 };
  }
}

/**
 * Convert ISO language code to CKLS format
 * @param isoCode - ISO language code (e.g., 'en', 'fr')
 * @returns CKLS format (e.g., 'en-GB', 'fr-FR')
 */
export function isoToCkls(isoCode: string): string {
  const mapping: Record<string, string> = {
    'en': 'en-GB',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'es': 'es-ES',
    'it': 'it-IT',
    'pt': 'pt-BR',
    'nl': 'nl-NL',
    'pl': 'pl-PL',
    'ru': 'ru-RU',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
    'ar': 'ar-SA',
    'sv': 'sv-SE',
    'da': 'da-DK',
    'fi': 'fi-FI',
    'no': 'nb-NO',
    'tr': 'tr-TR',
    'el': 'el-GR',
    'cs': 'cs-CZ',
    'hu': 'hu-HU',
    'ro': 'ro-RO',
    'sk': 'sk-SK',
    'bg': 'bg-BG',
    'hr': 'hr-HR',
    'sl': 'sl-SI',
    'et': 'et-EE',
    'lv': 'lv-LV',
    'lt': 'lt-LT',
    'th': 'th-TH',
    'vi': 'vi-VN',
    'id': 'id-ID',
    'ms': 'ms-MY',
    'uk': 'uk-UA',
    'he': 'he-IL',
  };
  
  return mapping[isoCode] || `${isoCode}-${isoCode.toUpperCase()}`;
}

/**
 * Get language name from CKLS code
 * @param cklsCode - CKLS format code (e.g., 'en-GB')
 * @param languageNames - Map of ISO codes to language names
 * @returns Human-readable language name
 */
export function getLanguageName(
  cklsCode: string,
  languageNames: Record<string, string>
): string {
  const isoCode = cklsCode.split('-')[0].toLowerCase();
  return languageNames[isoCode] || cklsCode;
}

