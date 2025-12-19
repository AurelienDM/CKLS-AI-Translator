// API Endpoints
export const TRANSLATOR_API_URL = "https://api.cognitive.microsofttranslator.com/languages?api-version=3.0&scope=translation";

// Default Do-Not-Translate Terms
export const DEFAULT_DNT_TERMS = [
    "Blendedx",
    "Feedback",
    "CrossKnowledge",
    "Learning Channel",
    "Path to performance"
];

// CKLS Language Codes
export const CKLS_CODES = [
    "ar-EG", "ar-KW", "ar-SA", "bg-BG", "cs-CZ", "da-DK", "de-DE", "en-GB", "en-US",
    "es-CO", "es-ES", "et-EE", "fi-FI", "fr-FR", "fr-CA", "hu-HU", "id-ID", "it-IT", 
    "ja-JP", "ko-KR", "lt-LT", "lv-LV", "ms-MY", "nb-NO", "nl-NL", "pl-PL", "pt-BR", 
    "pt-PT", "ro-RO", "ru-RU", "sk-SK", "sl-SI", "sv-SE", "th-TH", "tr-TR", "uk-UA", 
    "vi-VN", "zh-CHS", "zh-CN"
];

// Fallback Language Names (used if API fails)
export const FALLBACK_LANGUAGE_NAMES: Record<string, string> = {
    "en": "English",
    "fr": "French",
    "nl": "Dutch",
    "de": "German",
    "es": "Spanish",
    "it": "Italian",
    "pt": "Portuguese",
    "pt-BR": "Portuguese (Brazil)",
    "da": "Danish",
    "sv": "Swedish",
    "no": "Norwegian",
    "fi": "Finnish",
    "pl": "Polish",
    "cs": "Czech",
    "ru": "Russian",
    "tr": "Turkish",
    "ar": "Arabic",
    "zh": "Chinese (Simplified)",
    "zh-CHS": "Chinese (Simplified)",
    "zh-CN": "Chinese (Simplified)",
    "zh-Hans": "Chinese (Simplified)",
    "zh-Hant": "Chinese (Traditional)",
    "ja": "Japanese",
    "ko": "Korean"
};

