export interface JsonSchema {
  name: string;
  detectPattern: RegExp;
  translatablePaths: string[];
  localeMapping?: Record<string, Record<string, string>>;
}

export const META_SKILLS_SCHEMA: JsonSchema = {
  name: "Meta-Skills Avatar AI",
  
  // Auto-detect Meta-Skills JSON format
  detectPattern: /^\s*\{[\s\S]*"name"\s*:\s*"[^"]*"[\s\S]*"episodes"\s*:\s*\[/m,
  
  // JSONPath-style paths to translatable fields
  // Note: systemPrompt is intentionally excluded (remains in English)
  translatablePaths: [
    "$.name",
    "$.episodes[*].name",
    "$.episodes[*].description",
    "$.episodes[*].slides[*].name",
    "$.episodes[*].slides[*].content.intro.title",
    "$.episodes[*].slides[*].content.intro.description",
    "$.episodes[*].slides[*].content.openingLine",
    "$.episodes[*].slides[*].content.instruction",
    "$.episodes[*].slides[*].content.placeholderText",
    "$.episodes[*].slides[*].content.title",
    "$.episodes[*].slides[*].content.description",
    "$.episodes[*].slides[*].content.feedbackPoints[*].title",
    "$.episodes[*].slides[*].content.feedbackPoints[*].prompt",
  ],
  
  // Auto-map locale codes based on target language
  localeMapping: {
    "$.locale": {
      "en-US": "fr-FR",
      "en-GB": "fr-FR",
      "fr-FR": "en-US",
      "de": "de-DE",
      "es": "es-ES",
      "it": "it-IT",
      "pt": "pt-PT",
      "nl": "nl-NL",
      "pl": "pl-PL",
      "ru": "ru-RU",
      "ja": "ja-JP",
      "zh": "zh-CN",
      "ko": "ko-KR",
    }
  }
};

// Export all available schemas
export const JSON_SCHEMAS = [META_SKILLS_SCHEMA];

