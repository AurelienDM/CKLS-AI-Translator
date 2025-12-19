import { CKLS_CODES } from './constants';

// Microsoft Translator to CKLS Code Mapping
export const TRANSLATOR_TO_CKLS_DEFAULT: Record<string, string> = {
    "ar": "ar-SA",
    "bg": "bg-BG",
    "cs": "cs-CZ",
    "da": "da-DK",
    "de": "de-DE",
    "en": "en-GB",
    "es": "es-ES",
    "et": "et-EE",
    "fi": "fi-FI",
    
    // French
    "fr": "fr-FR",
    "fr-ca": "fr-CA",
    "fr-CA": "fr-CA",
    
    // Portuguese - Microsoft Translator's "pt" defaults to Brazilian Portuguese
    "pt": "pt-BR",
    "pt-br": "pt-BR",
    "pt-BR": "pt-BR",
    "pt-PT": "pt-PT",
    
    // Other languages
    "hu": "hu-HU",
    "id": "id-ID",
    "it": "it-IT",
    "ja": "ja-JP",
    "ko": "ko-KR",
    "lt": "lt-LT",
    "lv": "lv-LV",
    "ms": "ms-MY",
    "nb": "nb-NO",
    "nl": "nl-NL",
    "pl": "pl-PL",
    "ro": "ro-RO",
    "ru": "ru-RU",
    "sk": "sk-SK",
    "sl": "sl-SI",
    "sv": "sv-SE",
    "th": "th-TH",
    "tr": "tr-TR",
    "uk": "uk-UA",
    "vi": "vi-VN",
    "zh": "zh-CN",
    "zh-CHS": "zh-CHS",
    "zh-CN": "zh-CN",
    "zh-Hans": "zh-CN"
};

/**
 * Extract base language code (e.g., "en" from "en-GB")
 */
export function baseLang(code: string): string {
    return String(code || "").split(/[-_]/)[0];
}

/**
 * Infer CKLS code from header value and Microsoft Translator code
 */
export function inferCklsFromHeader(headerVal: string, msCode: string): string {
    const raw = String(headerVal || "");
    
    // Try to extract a CKLS code pattern (xx-XX) from the header
    const match = raw.match(/\b[a-z]{2}-[A-Z]{2}\b/);
    if (match && CKLS_CODES.includes(match[0])) {
        return match[0];
    }
    
    // Try uppercase MS code
    const msUpper = String(msCode || "").toUpperCase();
    if (CKLS_CODES.includes(msUpper)) {
        return msUpper;
    }
    
    // Try mapping from translator code
    if (msCode) {
        const mapped = TRANSLATOR_TO_CKLS_DEFAULT[msCode] || TRANSLATOR_TO_CKLS_DEFAULT[baseLang(msCode)];
        if (mapped && CKLS_CODES.includes(mapped)) {
            return mapped;
        }
    }
    
    return msUpper || "—";
}

/**
 * Auto-map Microsoft Translator code to CKLS code
 */
export function autoMapMsToCkls(msCode: string, existingLanguages: string[] = []): string {
    if (!msCode) return "";
    
    const base = baseLang(msCode);
    
    // First, check if any existing language matches the base
    for (const ex of existingLanguages) {
        if (baseLang(ex) === base && CKLS_CODES.includes(ex)) {
            return ex;
        }
    }
    
    // Try direct mapping
    if (TRANSLATOR_TO_CKLS_DEFAULT[msCode]) {
        const cand = TRANSLATOR_TO_CKLS_DEFAULT[msCode];
        if (CKLS_CODES.includes(cand)) return cand;
    }
    
    // Try base language mapping
    if (TRANSLATOR_TO_CKLS_DEFAULT[base]) {
        const cand2 = TRANSLATOR_TO_CKLS_DEFAULT[base];
        if (CKLS_CODES.includes(cand2)) return cand2;
    }
    
    // Find first CKLS code with matching base
    for (const ck of CKLS_CODES) {
        if (baseLang(ck) === base) return ck;
    }
    
    return "";
}

