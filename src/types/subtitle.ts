// Subtitle Translation Types and Interfaces

export interface SrtSubtitle {
  index: number;
  startTime: string; // Format: "00:01:30,500" (comma-separated for SRT)
  endTime: string;
  text: string;
  originalLines: string[]; // Preserve line breaks
}

export interface VttSubtitle extends SrtSubtitle {
  startTime: string; // Format: "00:01:30.500" (period-separated for VTT)
  endTime: string;
  cueIdentifier?: string; // Optional ID before timecode
  cueSettings?: string; // e.g., "position:50% align:center"
  voiceTag?: string; // e.g., "John" from <v John>
}

export interface VttMetadata {
  noteBlocks: string[]; // All NOTE blocks
  styleBlocks: string[]; // All STYLE blocks
  header: string; // "WEBVTT" or "WEBVTT - Title"
}

export interface ValidationIssue {
  type: 'malformed-timecode' | 'missing-index' | 'encoding-error' | 'invalid-format' | 'file-too-large' | 'too-many-subtitles' | 'malformed-html';
  subtitleIndex: number;
  message: string;
  severity: 'error' | 'warning';
  htmlSnippet?: string;
  suggestedFix?: string;
}

export interface TimingIssue {
  type: 'overlap' | 'too-fast' | 'too-slow' | 'gap-too-small' | 'length-overflow';
  subtitleIndex: number;
  details: string;
  suggestedFix?: string;
  nextSubtitleIndex?: number; // For overlap issues
  charCount?: number; // For length-overflow issues
  translatedText?: string; // For length-overflow issues
}

export interface SubtitleFileData {
  fileName: string;
  format: 'srt' | 'vtt';
  encoding: string;
  subtitles: (SrtSubtitle | VttSubtitle)[];
  vttMetadata?: VttMetadata;
  validationIssues: ValidationIssue[];
  timingIssues: TimingIssue[];
}

export interface SubtitleSettings {
  // Character limits (BBC standards)
  maxCharsPerLine: number; // Default: 37 (BBC standard)
  maxLinesPerSubtitle: number; // Default: 2
  
  // Timing validation
  enableOverlapDetection: boolean;
  minGapBetweenCues: number; // milliseconds, default: 100
  overlapResolution: 'warn' | 'shorten-prev' | 'delay-next';
  
  // Reading speed (chars/second)
  enableReadingSpeedCheck: boolean;
  minCharsPerSecond: number; // Default: 15 (BBC)
  maxCharsPerSecond: number; // Default: 21 (BBC)
  
  // Formatting
  preserveHtmlTags: boolean;
  lineBreakStrategy: 'preserve' | 'auto' | 'single';
  
  // VTT-specific options
  preserveVttNoteBlocks: boolean;
  preserveVttStyleBlocks: boolean;
  preserveVttCueSettings: boolean;
  treatVoiceTagsAsDNT: boolean;
  
  // Output
  outputFormat: 'match-input' | 'srt' | 'vtt' | 'both';
  outputEncoding: 'UTF-8' | 'UTF-8-BOM' | 'ISO-8859-1';
  addLanguageCodeToFilename: boolean;
}

export interface PerformanceLimits {
  maxFileSizeMB: 5;
  maxSubtitlesPerFile: 2000;
  maxFilesInBatch: 10;
  maxTotalSubtitles: 5000;
}

export const PERFORMANCE_LIMITS: PerformanceLimits = {
  maxFileSizeMB: 5,
  maxSubtitlesPerFile: 2000,
  maxFilesInBatch: 10,
  maxTotalSubtitles: 5000
};

// BBC Standards (default settings)
export const BBC_SUBTITLE_STANDARDS: SubtitleSettings = {
  maxCharsPerLine: 37,
  maxLinesPerSubtitle: 2,
  enableOverlapDetection: true,
  minGapBetweenCues: 100,
  overlapResolution: 'warn',
  enableReadingSpeedCheck: true,
  minCharsPerSecond: 15,
  maxCharsPerSecond: 21,
  preserveHtmlTags: true,
  lineBreakStrategy: 'preserve',
  preserveVttNoteBlocks: true,
  preserveVttStyleBlocks: false,
  preserveVttCueSettings: false,
  treatVoiceTagsAsDNT: true,
  outputFormat: 'match-input',
  outputEncoding: 'UTF-8',
  addLanguageCodeToFilename: true
};

// Subtitle text item for translation processing
export interface SubtitleTextItem {
  fileIndex: number; // Which file (0, 1, 2...)
  subtitleIndex: number; // Which subtitle in that file
  text: string; // The actual subtitle text
  timecode: {
    start: string;
    end: string;
  };
  formatting?: {
    htmlTags?: string[];
    vttCueSettings?: string;
  };
}

// Translation result
export interface SubtitleTranslationResult {
  fileName: string;
  format: 'srt' | 'vtt';
  vttMetadata?: VttMetadata;
  translatedVersions: Record<string, (SrtSubtitle | VttSubtitle)[]>; // langCode -> subtitles
}

// HTML tag mapping for preservation during translation
export interface HtmlTagMap {
  [placeholder: string]: string;
}

// HTML structure for pure text extraction with segment tracking
export interface HTMLStructure {
  hasHtml: boolean;
  template: string; // Original HTML for reference
  segments: Array<{
    type: 'tag' | 'text';
    content: string;
    textIndex?: number; // Index in textSegments array (only for type='text')
  }>;
  textSegments: string[]; // Array of pure text segments to translate
}

// Deduplication statistics
export interface SubtitleDeduplicationStats {
  totalFiles: number;
  totalSubtitles: number;
  uniqueTexts: number;
  duplicates: number;
  savingsPercentage: number;
}

