import { extractTextAndBuildPlaceholders } from './textExtraction';
import { RowData } from '@/modules/FileHandler';
import type { GlossaryEntry } from '@/types/index';
import type { TmxMemory } from '@/types/tmx';

export interface TranslationMetrics {
  totalStrings: number;
  uniqueStrings: number;
  duplicateStrings: number;
  totalCharacters: number;
  totalRawCharacters: number;
  sourceCharacters: number; // NEW: Original characters (with DNT terms)
  extractedCharacters: number; // NEW: Extracted characters (without DNT terms)
  translatedCharacters: number; // NEW: Estimated translated characters
  averageLength: number;
  totalApiCalls: number; // Original calculation (all strings)
  actualApiCalls?: number; // NEW: Actual after optimizations
  languages: number;
  totalTranslatedChars: number;
  deduplicationPercentage: number;
  savedApiCalls?: number;
  characterSavings?: number;
  // NEW FIELDS for optimization tracking:
  stringsAlreadyFilled?: number;
  glossaryMatches?: number;
  tmxMatches?: number;
  actualStringsToTranslate?: number;
  totalSavedCalls?: number; // Dedup + filled + glossary + TMX
  sourceCopiedRows?: number;
}

/**
 * Check if a text has glossary matches for all target languages
 * @param text - Source text to check
 * @param sourceLang - Source language code
 * @param targetLangs - Target language codes
 * @param glossary - Array of glossary entries
 * @returns Object with match info
 */
function checkGlossaryMatch(
  text: string,
  sourceLang: string,
  targetLangs: string[],
  glossary: GlossaryEntry[]
): { hasMatch: boolean; matchCount: number } {
  if (!glossary || glossary.length === 0 || !text) {
    return { hasMatch: false, matchCount: 0 };
  }

  const normalizedText = text.trim().toLowerCase();
  let matchCount = 0;

  // Check each glossary entry
  for (const entry of glossary) {
    const sourceText = entry.translations[sourceLang];
    if (sourceText && sourceText.trim().toLowerCase() === normalizedText) {
      // Found source match, now check if all target languages have translations
      const allTargetsHaveTranslations = targetLangs.every(lang => {
        return entry.translations[lang] && entry.translations[lang].trim() !== '';
      });
      
      if (allTargetsHaveTranslations) {
        matchCount = targetLangs.length;
        return { hasMatch: true, matchCount };
      }
    }
  }

  return { hasMatch: false, matchCount: 0 };
}

/**
 * Check if a text has TMX matches
 * @param text - Source text to check
 * @param targetLangs - Target language codes
 * @param tmxMemory - TMX memory object
 * @returns Object with match info
 */
function checkTmxMatch(
  text: string,
  targetLangs: string[],
  tmxMemory: TmxMemory
): { hasMatch: boolean; matchCount: number } {
  if (!tmxMemory || !tmxMemory.units || tmxMemory.units.length === 0 || !text) {
    return { hasMatch: false, matchCount: 0 };
  }

  const normalizedText = text.trim().toLowerCase();
  const matchedLangs = new Set<string>();

  // Simple exact match for preview (full TMX matching happens during translation)
  for (const unit of tmxMemory.units) {
    const sourceText = unit.sourceText?.trim().toLowerCase();
    if (sourceText === normalizedText) {
      // Check if target language is in our target list
      if (targetLangs.includes(unit.targetLang) && unit.targetText && unit.targetText.trim() !== '') {
        matchedLangs.add(unit.targetLang);
      }
    }
  }

  const matchCount = matchedLangs.size;
  return { hasMatch: matchCount > 0, matchCount };
}

/**
 * Analyze which cells are already filled and don't need translation
 * @param rows - Array of row data
 * @param workbooks - Array of workbooks
 * @param targetLanguages - Target language codes
 * @param existingLanguagesModes - Per-language overwrite modes
 * @returns Map of row index to whether it's filled
 */
function analyzeFilledCells(
  rows: RowData[],
  workbooks: any[],
  targetLanguages: string[],
  existingLanguagesModes: Record<string, 'keep' | 'fill-empty' | 'overwrite-all'>
): Map<number, boolean> {
  const filledRows = new Map<number, boolean>();

  if (!workbooks || workbooks.length === 0 || !targetLanguages || targetLanguages.length === 0) {
    return filledRows;
  }

  // For simplicity, assume single workbook for now (multi-file handled separately)
  const workbook = workbooks[0];
  if (!workbook) return filledRows;

  try {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = (window as any).XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const headerRow = json[0] || [];

    // Build existing column map
    const existingColIndexes: Record<string, number> = {};
    for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
      const headerValue = headerRow[colIdx];
      if (headerValue && typeof headerValue === 'string') {
        const match = headerValue.match(/\b([a-z]{2}-[A-Z]{2})\b/i);
        if (match) {
          const normalizedCode = match[1].toLowerCase().replace(/^([a-z]{2})-([a-z]{2})$/i,
            (_, p1, p2) => `${p1.toLowerCase()}-${p2.toUpperCase()}`);
          existingColIndexes[normalizedCode] = colIdx;
        }
      }
    }

    // Check each row
    rows.forEach(row => {
      let isCompletelyFilled = true;

      for (const targetLang of targetLanguages) {
        const normalizedLang = targetLang.toLowerCase().replace(/^([a-z]{2})-([a-z]{2})$/i,
          (_, p1, p2) => `${p1.toLowerCase()}-${p2.toUpperCase()}`);
        const mode = existingLanguagesModes[normalizedLang];
        const colIdx = existingColIndexes[normalizedLang];

        // Language doesn't exist yet - not filled
        if (colIdx === undefined) {
          isCompletelyFilled = false;
          break;
        }

        // Check mode
        if (mode === 'overwrite-all') {
          // Will be overwritten - treat as not filled
          isCompletelyFilled = false;
          break;
        }

        if (mode === 'keep' || mode === 'fill-empty') {
          // Check if cell has content
          const rowData = json[row.rowIndex];
          const cellValue = rowData && rowData[colIdx];
          const isEmpty = !cellValue || String(cellValue).trim() === '';
          const isFormula = cellValue && typeof cellValue === 'string' &&
            (cellValue.startsWith('=TRANSLATE(') || cellValue.startsWith('=COPILOT('));

          if (isEmpty || isFormula) {
            // Cell is empty or has formula - needs translation
            if (mode === 'fill-empty') {
              isCompletelyFilled = false;
              break;
            }
          }
          // If mode is 'keep', even empty cells are "kept" (not translated)
        }
      }

      filledRows.set(row.rowIndex, isCompletelyFilled);
    });
  } catch (error) {
    console.error('Error analyzing filled cells:', error);
  }

  return filledRows;
}

/**
 * Calculate translation metrics for the current rows and targets
 * @param rows - Array of row data from the workbook
 * @param targetCount - Number of target languages
 * @param doNotTranslate - Array of do-not-translate terms
 * @param options - Optional parameters for optimization analysis
 * @returns Metrics object with counts and calculations
 */
export function calculateTranslationMetrics(
  rows: RowData[],
  targetCount: number = 0,
  doNotTranslate: string[] = [],
  options?: {
    workbooks?: any[];
    targetLanguages?: string[];
    existingLanguagesModes?: Record<string, 'keep' | 'fill-empty' | 'overwrite-all'>;
    glossary?: GlossaryEntry[];
    sourceLang?: string;
    tmxMemory?: TmxMemory;
    tmxMatchThreshold?: number;
  }
): TranslationMetrics {
  // Return empty metrics if no rows or no targets
  if (!rows || rows.length === 0 || targetCount === 0) {
    return {
      totalStrings: 0,
      uniqueStrings: 0,
      duplicateStrings: 0,
      totalCharacters: 0,
      totalRawCharacters: 0,
      sourceCharacters: 0,
      extractedCharacters: 0,
      translatedCharacters: 0,
      averageLength: 0,
      totalApiCalls: 0,
      actualApiCalls: 0,
      languages: 0,
      totalTranslatedChars: 0,
      deduplicationPercentage: 0,
      stringsAlreadyFilled: 0,
      glossaryMatches: 0,
      tmxMatches: 0,
      actualStringsToTranslate: 0,
      totalSavedCalls: 0
    };
  }
  
  try {
    // STEP 1: Count source characters from original rows (includes DNT terms)
    let sourceCharacters = 0;
    rows.forEach(row => {
      sourceCharacters += (row.original?.length || 0);
    });
    
    // STEP 2: Extract texts for deduplication (removes DNT terms)
    const { extracted } = extractTextAndBuildPlaceholders(rows, doNotTranslate);
    
    // Track duplicates by using a Set
    const uniqueSet = new Set<string>();
    let totalRawCharacters = 0;
    
    extracted.forEach(item => {
      uniqueSet.add(item.extracted);
      totalRawCharacters += (item.extracted?.length || 0);
    });
    
    // Calculate metrics
    const totalStrings = extracted.length;
    const uniqueStrings = uniqueSet.size;
    const duplicateStrings = totalStrings - uniqueStrings;
    
    // Calculate characters for unique strings only (extracted)
    const uniqueArray = Array.from(uniqueSet);
    const extractedCharacters = uniqueArray.reduce((sum, text) => {
      return sum + (text?.length || 0);
    }, 0);
    
    // Legacy totalCharacters field (keep for compatibility)
    const totalCharacters = extractedCharacters;
    
    // STEP 3: Estimate translated characters with 10% expansion factor
    // (most target languages are slightly longer than source)
    const translatedCharacters = Math.round(sourceCharacters * 1.1 * targetCount);
    
    const averageLength = uniqueStrings > 0 
      ? Math.round(extractedCharacters / uniqueStrings) 
      : 0;
    
    const deduplicationPercentage = totalStrings > 0
      ? Math.round((duplicateStrings / totalStrings) * 100)
      : 0;
    
    const languages = targetCount;
    const totalApiCalls = uniqueStrings * languages;
    const totalTranslatedChars = extractedCharacters * languages;
    const savedApiCalls = duplicateStrings * languages;
    
    // STEP 4: Calculate optimizations if options provided
    let stringsAlreadyFilled = 0;
    let glossaryMatches = 0;
    let tmxMatches = 0;
    let actualStringsToTranslate = uniqueStrings;
    let actualApiCalls = totalApiCalls;
    let totalSavedCalls = savedApiCalls || 0;

    if (options && (options.workbooks || options.glossary || options.tmxMemory)) {
      const { 
        workbooks, 
        targetLanguages, 
        existingLanguagesModes, 
        glossary, 
        sourceLang, 
        tmxMemory
      } = options;

      // Analyze filled cells
      if (workbooks && targetLanguages && existingLanguagesModes) {
        const filledRowsMap = analyzeFilledCells(rows, workbooks, targetLanguages, existingLanguagesModes);
        
        // Count unique strings that are from completely filled rows
        const filledStringSet = new Set<string>();
        extracted.forEach(item => {
          if (filledRowsMap.get(item.rowIndex)) {
            filledStringSet.add(item.extracted);
          }
        });
        stringsAlreadyFilled = filledStringSet.size;
      }

      // Check glossary matches
      if (glossary && sourceLang && targetLanguages) {
        const glossaryMatchSet = new Set<string>();
        uniqueArray.forEach(text => {
          const match = checkGlossaryMatch(text, sourceLang, targetLanguages, glossary);
          if (match.hasMatch) {
            glossaryMatchSet.add(text);
          }
        });
        glossaryMatches = glossaryMatchSet.size;
      }

      // Check TMX matches
      if (tmxMemory && targetLanguages) {
        const tmxMatchSet = new Set<string>();
        uniqueArray.forEach(text => {
          // Check if this text has matches for any of the target languages
          const match = checkTmxMatch(text, targetLanguages, tmxMemory);
          if (match.hasMatch) {
            tmxMatchSet.add(text);
          }
        });
        tmxMatches = tmxMatchSet.size;
      }

      // Calculate actual strings to translate
      // (unique - already filled - glossary matches - TMX matches)
      actualStringsToTranslate = Math.max(0, uniqueStrings - stringsAlreadyFilled - glossaryMatches - tmxMatches);
      actualApiCalls = actualStringsToTranslate * languages;
      
      // Calculate total saved calls
      totalSavedCalls = (savedApiCalls || 0) + 
                        (stringsAlreadyFilled * languages) + 
                        (glossaryMatches * languages) + 
                        (tmxMatches * languages);
    }
    
    return {
      totalStrings,
      uniqueStrings,
      duplicateStrings,
      totalCharacters,
      totalRawCharacters,
      sourceCharacters,
      extractedCharacters,
      translatedCharacters,
      averageLength,
      totalApiCalls,
      actualApiCalls: options ? actualApiCalls : undefined,
      languages,
      totalTranslatedChars,
      deduplicationPercentage,
      savedApiCalls,
      characterSavings: totalRawCharacters - extractedCharacters,
      stringsAlreadyFilled: options ? stringsAlreadyFilled : undefined,
      glossaryMatches: options ? glossaryMatches : undefined,
      tmxMatches: options ? tmxMatches : undefined,
      actualStringsToTranslate: options ? actualStringsToTranslate : undefined,
      totalSavedCalls: options ? totalSavedCalls : undefined,
    };
  } catch (error) {
    console.error('Error calculating metrics:', error);
    return {
      totalStrings: 0,
      uniqueStrings: 0,
      duplicateStrings: 0,
      totalCharacters: 0,
      totalRawCharacters: 0,
      sourceCharacters: 0,
      extractedCharacters: 0,
      translatedCharacters: 0,
      averageLength: 0,
      totalApiCalls: 0,
      actualApiCalls: 0,
      languages: 0,
      totalTranslatedChars: 0,
      deduplicationPercentage: 0,
      stringsAlreadyFilled: 0,
      glossaryMatches: 0,
      tmxMatches: 0,
      actualStringsToTranslate: 0,
      totalSavedCalls: 0
    };
  }
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Format character count (e.g., "45.6k" or "1.2M")
 */
export function formatCharCount(chars: number): string {
  if (chars >= 1000000) {
    return (chars / 1000000).toFixed(1) + 'M';
  } else if (chars >= 1000) {
    return (chars / 1000).toFixed(1) + 'k';
  }
  return chars.toString();
}

/**
 * Calculate estimated cost for translation
 * @param totalChars - Total characters to translate
 * @param apiType - 'deepl' or 'google'
 * @returns Estimated cost in USD
 */
export function calculateEstimatedCost(totalChars: number): number {
  // DeepL: ~$20 per 1M characters (Pro)
  // Google: ~$20 per 1M characters
  const costPerMillionChars = 20;
  return (totalChars / 1000000) * costPerMillionChars;
}

/**
 * Calculate quota percentage
 * @param totalChars - Total characters to translate
 * @param quotaLimit - Quota limit (default 500k for free tiers)
 * @returns Percentage (0-100)
 */
export function calculateQuotaPercentage(totalChars: number, quotaLimit: number = 500000): number {
  return Math.min((totalChars / quotaLimit) * 100, 100);
}

