/**
 * Translation Types
 * Type definitions for DeepL and Google Cloud Translation services
 */

import { GlossaryEntry } from './index';

// Translation configuration for API calls
export interface TranslationConfig {
  workbook: any;
  targetLanguagesCKLS: string[];
  sourceISO: string;
  sourceCKLS: string; // Source language in CKLS format for glossary matching
  doNotTranslate: string[];
  predefinedTranslations: GlossaryEntry[];
  apiKey: string;
  formalitySettings?: Record<string, 'less' | 'more' | null>;
  useFormalitySettings?: boolean;
  deeplStyleOptions?: Record<string, any>;
  deeplCustomInstructions?: Record<string, string>;
  deeplStyleRuleIds?: Record<string, string>;
  useDeeplStyleRules?: boolean;
  deeplRequestDelay?: number; // milliseconds between requests (100, 300, or 500)
  fileTitleSlug?: string; // For loading client corrections
  onProgress?: (current: number, total: number, currentLang: string, phase?: string) => void;
  controller: TranslationController;
}

// Translation result from API
export interface TranslationResult {
  extracted: Array<{
    id: string;
    rowIndex: number;
    extracted: string;
  }>;
  rebuilt: Array<{
    rowIndex: number;
    template: string;
  }>;
  translations: Record<string, Record<string, string>>; // [targetLang][id] = translation
  fileTitleSlug?: string;
}

// Progress tracking structure
export interface TranslationProgress {
  current: number;
  total: number;
  currentLang: string;
  phase: string;
  percentage: number;
  estimatedTimeRemaining?: number;
}

// API key validation result
export interface ApiValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
}

// Language support mapping
export interface LanguageSupport {
  [key: string]: string;
}

// DeepL formality levels
export type FormalityLevel = 'more' | 'less' | 'default' | 'prefer_more' | 'prefer_less' | null;

// Translation controller interface
export interface TranslationController {
  pause(): void;
  resume(): void;
  cancel(): void;
  waitIfPaused(): Promise<void>;
  readonly cancelled: boolean;
  readonly paused: boolean;
  readonly signal: AbortSignal;
}

// Multi-file translation config
export interface MultiFileTranslationConfig {
  filesData: Array<{
    fileName: string;
    workbook: any;
    sourceISO: string;
    sourceCKLS: string;
    existingLanguages: string[];
    fileTitleRaw: string;
    fileTitleSlug: string;
    normalizedTitle: string;
    isHomePage: boolean;
  }>;
  targetLanguagesCKLS: string[];
  sourceISO: string;
  sourceCKLS: string;
  doNotTranslate: string[];
  predefinedTranslations: GlossaryEntry[];
  apiKey: string;
  formalitySettings?: Record<string, 'less' | 'more' | null>;
  useFormalitySettings?: boolean;
  deeplRequestDelay?: number; // milliseconds between requests (100, 300, or 500)
  controller: TranslationController;
  onProgress?: (current: number, total: number, currentLang: string, phase: string, fileIndex?: number) => void;
}

// Multi-file translation result
export interface MultiFileTranslationResult extends TranslationResult {
  fileIndex: number;
  fileName: string;
}

