/**
 * Language Analysis Utility
 * Analyzes workbook columns to calculate translation completion statistics
 */

export interface LanguageCompletionStats {
  code: string;              // "pt-BR"
  totalCells: number;        // 120
  filledCells: number;       // 102
  emptyCells: number;        // 18
  formulaCells: number;      // 5 (cells with =TRANSLATE or =COPILOT)
  percentage: number;        // 85
}

/**
 * Check if a cell value is a translation formula
 */
function isTranslationFormula(value: any): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith('=TRANSLATE') || 
         trimmed.startsWith('=COPILOT') ||
         trimmed.toLowerCase().startsWith('=translate') ||
         trimmed.toLowerCase().startsWith('=copilot');
}

/**
 * Normalize CKLS code for comparison
 */
function normalizeCklsCode(code: string): string {
  if (!code || typeof code !== 'string') return '';
  const parts = code.split('-');
  if (parts.length !== 2) return code.toLowerCase();
  return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
}

/**
 * Analyze translation completion for existing languages in workbook
 * @param workbook - XLSX workbook object
 * @param existingLanguages - Array of existing language codes (e.g., ["pt-BR", "de-DE"])
 * @returns Object mapping language codes to completion statistics
 */
export function analyzeLanguageCompletion(
  workbook: any,
  existingLanguages: string[]
): Record<string, LanguageCompletionStats> {
  const stats: Record<string, LanguageCompletionStats> = {};
  
  if (!workbook || !existingLanguages || existingLanguages.length === 0) {
    return stats;
  }

  try {
    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON array
    const json = (window as any).XLSX.utils.sheet_to_json(sheet, { 
      header: 1, 
      defval: '' 
    });
    
    if (json.length === 0) {
      return stats;
    }

    // Get header row to find column indices
    const header = json[0] || [];
    
    // Map each existing language to its column index
    const languageColumns: Record<string, number> = {};
    
    for (let colIdx = 4; colIdx < header.length; colIdx++) {
      const headerValue = header[colIdx];
      if (headerValue && typeof headerValue === 'string') {
        // Extract CKLS code from header
        const match = headerValue.match(/\b([a-z]{2}-[A-Z]{2})\b/i);
        if (match) {
          const normalizedCode = normalizeCklsCode(match[1]);
          
          // Check if this matches any of our existing languages
          for (const existingLang of existingLanguages) {
            const normalizedExisting = normalizeCklsCode(existingLang);
            if (normalizedCode === normalizedExisting) {
              languageColumns[existingLang] = colIdx;
              break;
            }
          }
        }
      }
    }

    console.log('Language columns found:', languageColumns);

    // Analyze each existing language
    for (const langCode of existingLanguages) {
      const colIdx = languageColumns[langCode];
      
      if (colIdx === undefined) {
        console.warn(`Column not found for language: ${langCode}`);
        // Set default stats for languages not found
        stats[langCode] = {
          code: langCode,
          totalCells: 0,
          filledCells: 0,
          emptyCells: 0,
          formulaCells: 0,
          percentage: 0
        };
        continue;
      }

      let totalCells = 0;
      let filledCells = 0;
      let emptyCells = 0;
      let formulaCells = 0;

      // Loop through rows (skip header row at index 0)
      for (let rowIdx = 1; rowIdx < json.length; rowIdx++) {
        const row = json[rowIdx];
        if (!row) continue;

        const cellValue = row[colIdx];
        totalCells++;

        if (cellValue === undefined || cellValue === null || cellValue === '') {
          emptyCells++;
        } else if (isTranslationFormula(cellValue)) {
          formulaCells++;
          emptyCells++; // Count formulas as empty (they're placeholders)
        } else {
          // Has actual content
          const trimmed = String(cellValue).trim();
          if (trimmed.length > 0) {
            filledCells++;
          } else {
            emptyCells++;
          }
        }
      }

      // Calculate percentage (exclude formula cells from total)
      const effectiveTotal = totalCells;
      const percentage = effectiveTotal > 0 
        ? Math.round((filledCells / effectiveTotal) * 100)
        : 0;

      stats[langCode] = {
        code: langCode,
        totalCells,
        filledCells,
        emptyCells,
        formulaCells,
        percentage
      };

      console.log(`Stats for ${langCode}:`, stats[langCode]);
    }

    return stats;
  } catch (error) {
    console.error('Error analyzing language completion:', error);
    return stats;
  }
}

/**
 * Aggregate completion stats across multiple files
 * @param filesData - Array of file data with workbooks
 * @param existingLanguages - Array of language codes to analyze
 * @returns Aggregated completion statistics
 */
export function aggregateCompletionStats(
  filesData: Array<{ workbook: any; existingLanguages: string[] }>,
  allExistingLanguages: string[]
): Record<string, LanguageCompletionStats> {
  if (filesData.length === 0) {
    return {};
  }

  // Collect stats from each file
  const allStats: Record<string, LanguageCompletionStats[]> = {};
  
  for (const fileData of filesData) {
    const fileStats = analyzeLanguageCompletion(fileData.workbook, fileData.existingLanguages);
    
    for (const [langCode, stats] of Object.entries(fileStats)) {
      if (!allStats[langCode]) {
        allStats[langCode] = [];
      }
      allStats[langCode].push(stats);
    }
  }

  // Calculate averages
  const aggregated: Record<string, LanguageCompletionStats> = {};
  
  for (const langCode of allExistingLanguages) {
    const langStats = allStats[langCode] || [];
    
    if (langStats.length === 0) {
      aggregated[langCode] = {
        code: langCode,
        totalCells: 0,
        filledCells: 0,
        emptyCells: 0,
        formulaCells: 0,
        percentage: 0
      };
      continue;
    }

    // Sum up all values
    const totals = langStats.reduce(
      (acc, stat) => ({
        totalCells: acc.totalCells + stat.totalCells,
        filledCells: acc.filledCells + stat.filledCells,
        emptyCells: acc.emptyCells + stat.emptyCells,
        formulaCells: acc.formulaCells + stat.formulaCells
      }),
      { totalCells: 0, filledCells: 0, emptyCells: 0, formulaCells: 0 }
    );

    // Calculate average percentage
    const percentage = totals.totalCells > 0
      ? Math.round((totals.filledCells / totals.totalCells) * 100)
      : 0;

    aggregated[langCode] = {
      code: langCode,
      ...totals,
      percentage
    };
  }

  return aggregated;
}

