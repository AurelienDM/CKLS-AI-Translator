// TMX (Translation Memory Exchange) types

export interface TmxTranslationUnit {
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  creationDate?: string;
  changeDate?: string;
  quality?: number; // 0-100
  usageCount?: number;
  context?: string[];
}

export interface TmxMemory {
  fileName: string;
  sourceLang: string;
  targetLangs: string[]; // All available target languages
  units: TmxTranslationUnit[];
  header?: {
    creationTool?: string;
    creationDate?: string;
    segmentationType?: string;
  };
}

export interface TmxMatch {
  unit: TmxTranslationUnit;
  matchScore: number; // 0-100 (100 = exact match)
  matchType: 'exact' | 'fuzzy' | 'partial';
  sourceText: string;
  targetText: string;
}

export interface SubtitleTmxLink {
  tmxFileName: string;
  enabled: boolean;
  autoApplyThreshold: number; // Auto-apply matches above this score (e.g., 95)
  showFuzzyMatches: boolean;
  fuzzyMatchThreshold: number; // Show fuzzy matches above this score (e.g., 70)
}

