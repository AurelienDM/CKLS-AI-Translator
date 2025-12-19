import { TRANSLATOR_API_URL, FALLBACK_LANGUAGE_NAMES } from '@/utils/constants';

export interface LanguageData {
  languageNames: Record<string, string>;
  allLanguageOptions: Array<{ code: string; name: string }>;
}

/**
 * Fetch language names from Microsoft Translator API
 * Falls back to hardcoded names if API fails
 */
export async function fetchLanguageNames(): Promise<LanguageData> {
  try {
    const response = await fetch(TRANSLATOR_API_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    const languageNames: Record<string, string> = {};
    const translation = data.translation;
    
    for (const code in translation) {
      languageNames[code] = translation[code].name;
    }
    
    const allLanguageOptions = Object.keys(languageNames)
      .map(code => ({ code, name: languageNames[code] }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return { languageNames, allLanguageOptions };
    
  } catch (error) {
    console.warn("Failed to fetch language names from API, using fallback:", error);
    
    // Use fallback language names
    const languageNames = { ...FALLBACK_LANGUAGE_NAMES };
    const allLanguageOptions = Object.keys(languageNames)
      .map(code => ({ code, name: languageNames[code] }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return { languageNames, allLanguageOptions };
  }
}

