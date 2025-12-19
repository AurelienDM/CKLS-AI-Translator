import { GlossaryEntry } from '@/types';
import { parseFile } from '@/modules/FileHandler';
import { matchGlossaryLanguage } from './glossaryHelpers';

/**
 * Detect and strip BOM (Byte Order Mark) from text
 */
function stripBOM(text: string): string {
  if (text.charCodeAt(0) === 0xFEFF) {
    return text.slice(1);
  }
  return text;
}

/**
 * Parse CSV line with proper quote handling
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map(s => s.trim());
}

/**
 * Import glossary from file with encoding detection and language matching
 */
export async function importGlossaryFromFile(
  file: File,
  languageNames: Record<string, string>,
  availableLanguages?: string[]
): Promise<{
  entries: GlossaryEntry[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  
  try {
    // Handle CSV files
    if (file.name.toLowerCase().endsWith('.csv')) {
      const arrayBuffer = await file.arrayBuffer();
      
      // Try UTF-8 first, then UTF-16
      let text: string;
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        text = decoder.decode(arrayBuffer);
      } catch {
        const decoder = new TextDecoder('utf-16le');
        text = decoder.decode(arrayBuffer);
        warnings.push('File was encoded in UTF-16, converted to UTF-8');
      }
      
      text = stripBOM(text);
      const lines = text.trim().split('\n');
      
      if (lines.length < 2) {
        throw new Error('CSV must have at least a header row and one data row');
      }

      const header = parseCsvLine(lines[0]);
      const langCodes = header.map(h => h.trim()); // All columns are language codes
      
      if (langCodes.length === 0) {
        throw new Error('CSV must have at least one language column');
      }

      const entries: GlossaryEntry[] = [];
      let skippedRows = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        if (values.length < 1) continue;

        const translations: Record<string, string> = {};
        let hasAnyTranslation = false;
        
        for (let j = 0; j < langCodes.length; j++) {
          const csvLangCode = langCodes[j];
          const translation = values[j]?.trim();
          
          if (!translation) continue;
          
          hasAnyTranslation = true;
          
          // If availableLanguages provided, match to them
          if (availableLanguages && availableLanguages.length > 0) {
            const matchedCode = matchGlossaryLanguage(csvLangCode, availableLanguages, languageNames);
            if (matchedCode) {
              translations[matchedCode] = translation;
            }
          } else {
            // No filtering, use original lang codes
            translations[csvLangCode] = translation;
          }
        }

        // Only add entry if it has at least one translation
        if (hasAnyTranslation && Object.keys(translations).length > 0) {
          entries.push({ translations });
        } else if (hasAnyTranslation) {
          skippedRows++;
        }
      }
      
      if (skippedRows > 0) {
        warnings.push(`Skipped ${skippedRows} rows with no matching language codes`);
      }

      return { entries, warnings };
    }
    
    // Handle Excel/XML files
    else if (file.name.match(/\.(xlsx|xml)$/i)) {
      const workbook = await parseFile(file);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = (window as any).XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[];

      if (json.length < 2) {
        throw new Error('File must have at least a header row and one data row');
      }

      const header = json[0] || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const langCodes = header.map((h: any) => String(h || '').trim()); // All columns are language codes
      
      if (langCodes.length === 0) {
        throw new Error('File must have at least one language column');
      }

      const entries: GlossaryEntry[] = [];
      let skippedRows = 0;

      for (let i = 1; i < json.length; i++) {
        const row = json[i];
        const translations: Record<string, string> = {};
        let hasAnyTranslation = false;

        for (let j = 0; j < langCodes.length; j++) {
          const csvLangCode = langCodes[j];
          const translation = row[j]?.toString().trim();

          if (!translation) continue;
          
          hasAnyTranslation = true;

          if (availableLanguages && availableLanguages.length > 0) {
            const matchedCode = matchGlossaryLanguage(csvLangCode, availableLanguages, languageNames);
            if (matchedCode) {
              translations[matchedCode] = translation;
            }
          } else {
            translations[csvLangCode] = translation;
          }
        }

        // Only add entry if it has at least one translation
        if (hasAnyTranslation && Object.keys(translations).length > 0) {
          entries.push({ translations });
        } else if (hasAnyTranslation) {
          skippedRows++;
        }
      }
      
      if (skippedRows > 0) {
        warnings.push(`Skipped ${skippedRows} rows with no matching language codes`);
      }

      return { entries, warnings };
    }
    
    else {
      throw new Error('Unsupported file format. Please use CSV, XLSX, or XML files.');
    }
  } catch (error) {
    throw new Error(`Failed to import glossary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Import do-not-translate terms from file
 */
export async function importDoNotTranslateFromFile(
  file: File
): Promise<{
  terms: string[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Try UTF-8 first, then UTF-16
    let text: string;
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      text = decoder.decode(arrayBuffer);
    } catch {
      const decoder = new TextDecoder('utf-16le');
      text = decoder.decode(arrayBuffer);
      warnings.push('File was encoded in UTF-16, converted to UTF-8');
    }
    
    text = stripBOM(text);
    
    // Handle CSV (comma-separated)
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    let terms: string[];
    
    if (isCsv) {
      // Parse as CSV - extract first column only
      const lines = text.trim().split('\n');
      terms = lines
        .map(line => parseCsvLine(line)[0]?.trim())
        .filter(term => term && term.length > 0);
    } else {
      // Parse as TXT - one term per line
      terms = text
        .split('\n')
        .map(line => line.trim())
        .filter(term => term && term.length > 0);
    }
    
    // Remove duplicates
    const uniqueTerms = Array.from(new Set(terms));
    
    if (uniqueTerms.length < terms.length) {
      warnings.push(`Removed ${terms.length - uniqueTerms.length} duplicate terms`);
    }

    return { terms: uniqueTerms, warnings };
  } catch (error) {
    throw new Error(`Failed to import terms: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export glossary to CSV with UTF-8 encoding
 */
export function exportGlossaryToCSV(entries: GlossaryEntry[]): Blob {
  if (entries.length === 0) {
    throw new Error('No glossary entries to export');
  }
  
  // Collect all unique language codes
  const allLangCodes = new Set<string>();
  entries.forEach(entry => {
    Object.keys(entry.translations).forEach(lang => allLangCodes.add(lang));
  });
  
  const sortedLangCodes = Array.from(allLangCodes).sort();
  
  // Build CSV - all columns are language codes (no "source" column)
  const header = sortedLangCodes.join(',');
  const rows = entries.map(entry => {
    const values = sortedLangCodes.map(lang => {
      const translation = entry.translations[lang] || '';
      return `"${translation.replace(/"/g, '""')}"`;
    });
    return values.join(',');
  });
  
  const csv = [header, ...rows].join('\n');
  
  // Add UTF-8 BOM for Excel compatibility
  const bom = '\uFEFF';
  return new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Export glossary to XLSX format
 */
export function exportGlossaryToXLSX(entries: GlossaryEntry[]): Blob {
  if (entries.length === 0) {
    throw new Error('No glossary entries to export');
  }
  
  // Collect all unique language codes
  const allLangCodes = new Set<string>();
  entries.forEach(entry => {
    Object.keys(entry.translations).forEach(lang => allLangCodes.add(lang));
  });
  
  const sortedLangCodes = Array.from(allLangCodes).sort();
  
  // Build worksheet data (array of arrays)
  const worksheetData: any[][] = [];
  
  // Header row - all columns are language codes (no "source")
  worksheetData.push(sortedLangCodes);
  
  // Data rows
  entries.forEach(entry => {
    const row = sortedLangCodes.map(lang => entry.translations[lang] || '');
    worksheetData.push(row);
  });
  
  // Create workbook
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (window as any).XLSX;
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Glossary');
  
  // Generate XLSX file
  const xlsxData = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  
  return new Blob([xlsxData], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

/**
 * Export do-not-translate terms to TXT
 */
export function exportDoNotTranslateToTXT(terms: string[]): Blob {
  if (terms.length === 0) {
    throw new Error('No terms to export');
  }
  
  const text = terms.join('\n');
  
  // Add UTF-8 BOM for consistency
  const bom = '\uFEFF';
  return new Blob([bom + text], { type: 'text/plain;charset=utf-8;' });
}

