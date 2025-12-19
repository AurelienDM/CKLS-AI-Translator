// Shared type definitions used across the application

export interface GlossaryEntry {
  translations: Record<string, string>; // All languages equal: "en-US" -> "hello", "fr-FR" -> "bonjour"
}

export interface FileData {
  fileName: string;
  workbook: any;
  sourceISO: string;
  sourceCKLS: string;
  existingLanguages: string[];
  fileTitleRaw: string;
  fileTitleSlug: string;
  normalizedTitle: string;
  isHomePage: boolean;
  stringCount?: number;
}

export interface TextTranslationResult {
  translations: Record<string, string>; // targetLang -> translated text
  sourceText: string;
}

// Re-export subtitle types
export * from './subtitle';
