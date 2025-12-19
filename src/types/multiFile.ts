/**
 * Multi-File Processing Types
 * Type definitions for batch file processing and deduplication
 */

// File data structure after parsing
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

// Deduplication statistics
export interface DeduplicationStats {
  totalFiles: number;
  totalStrings: number;
  uniqueStrings: number;
  duplicateStrings: number;
  deduplicationPercentage: number;
  savedApiCalls: number;
  characterSavings: number;
  estimatedCostSavings?: number;
  // NEW: Character counting with DNT terms
  totalCharacters?: number;
  sourceCharacters?: number;
  extractedCharacters?: number;
  translatedCharacters?: number;
  // NEW: Optimization fields (fill mode, glossary, TMX)
  stringsAlreadyFilled?: number;
  glossaryMatches?: number;
  tmxMatches?: number;
  actualStringsToTranslate?: number;
  actualApiCalls?: number;
  totalSavedCalls?: number;
  // NEW: Source content copied (no translatable text)
  sourceCopiedRows?: number;
}

// File extraction result
export interface FileExtraction {
  fileIndex: number;
  extracted: Array<{
    id: string;
    rowIndex: number;
    extracted: string;
  }>;
  rebuilt: Array<{
    rowIndex: number;
    template: string;
  }>;
}

// Unique string map for deduplication
export interface UniqueStringMap {
  [text: string]: Array<{
    fileIndex: number;
    rowIndex: number;
    id: string;
  }>;
}

// File processing status
export type FileStatus = 'pending' | 'processing' | 'ready' | 'error' | 'translating' | 'completed';

// File list item for UI
export interface FileListItem {
  file: File;
  fileData?: FileData;
  status: FileStatus;
  error?: string;
  progress?: number;
}

