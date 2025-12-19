import { detectLangCodeFromHeader, slugify, normalizeFileTitle } from '@/utils/fileHelpers';
import { inferCklsFromHeader } from '@/utils/languageMapping';

export interface ParsedLanguageInfo {
  sourceISO: string;
  sourceCKLS: string;
  existingLanguages: string[];
  fileTitleRaw: string;
  fileTitleSlug: string;
  normalizedTitle: string;
  isHomePage: boolean;
}

export interface RowData {
  rowIndex: number;
  original: string;
}

/**
 * Parse file and return workbook
 * @param file - File to parse
 * @returns Workbook object
 */
export async function parseFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file provided"));
      return;
    }
    
    if (!file.name.match(/\.(xlsx|xml)$/i)) {
      reject(new Error("File must be .xlsx or .xml"));
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        let workbook;
        const result = e.target?.result;
        
        if (!result) {
          reject(new Error("Failed to read file content"));
          return;
        }
        
        if (file.name.toLowerCase().endsWith(".xml")) {
          workbook = (window as any).XLSX.read(result, { type: "string" });
        } else {
          workbook = (window as any).XLSX.read(new Uint8Array(result as ArrayBuffer), { type: "array" });
        }
        resolve(workbook);
      } catch (err: any) {
        reject(new Error("Unable to read workbook: " + err.message));
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    
    if (file.name.toLowerCase().endsWith(".xml")) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

/**
 * Detect languages from workbook
 * @param workbook - XLSX workbook object
 * @param languageNames - Map of language codes to names
 * @param fileName - Optional uploaded file name (preferred over cell reading)
 * @returns Object with language detection results
 */
export function detectLanguages(
  workbook: any,
  languageNames: Record<string, string>,
  fileName?: string
): ParsedLanguageInfo {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = (window as any).XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const header = json[0] || [];
  
  // Debug logging for auto-loaded files
  console.log('=== LANGUAGE DETECTION DEBUG ===');
  console.log('Header array:', header);
  console.log('Header length:', header.length);
  console.log('Column D (index 3):', header[3]);
  console.log('Column E (index 4):', header[4]);
  console.log('Column F (index 5):', header[5]);
  console.log('================================');
  
  // Get file title from uploaded file name (preferred) or fallback to cell D2
  const fileTitleRaw = fileName 
    ? fileName.replace(/\.(xlsx|xml)$/i, '')
    : (json[1] && json[1][3]) ? String(json[1][3]) : "";
  const fileTitleSlug = slugify(fileTitleRaw);
  const titleInfo = normalizeFileTitle(fileTitleRaw);
  
  // Detect source language (column D / index 3)
  const headerSource = header[3];
  let detected = detectLangCodeFromHeader(headerSource, languageNames);
  if (!detected) detected = "en";
  
  const sourceISO = detected;
  const sourceCKLS = inferCklsFromHeader(headerSource, detected);
  
  // Detect existing languages (columns after source)
  const existingLanguages: string[] = [];
  console.log('Detecting existing languages from columns 4+...');
  for (let i = 4; i < header.length; i++) {
    console.log(`  Column ${i}: "${header[i]}"`);
    const msCode = detectLangCodeFromHeader(header[i], languageNames);
    console.log(`    → Detected MS code: ${msCode}`);
    if (!msCode) {
      console.log(`    → Skipped (no MS code)`);
      continue;
    }
    
    const ckls = inferCklsFromHeader(header[i], msCode);
    console.log(`    → Inferred CKLS code: ${ckls}`);
    if (ckls && !existingLanguages.includes(ckls)) {
      existingLanguages.push(ckls);
      console.log(`    → Added to existing languages`);
    } else {
      console.log(`    → Not added (${!ckls ? 'no CKLS' : 'already exists'})`);
    }
  }
  console.log('Final existing languages:', existingLanguages);
  
  return {
    sourceISO,
    sourceCKLS,
    existingLanguages,
    fileTitleRaw,
    fileTitleSlug,
    normalizedTitle: titleInfo.normalizedTitle,
    isHomePage: titleInfo.isHomePage
  };
}

/**
 * Read column D from workbook
 * @param workbook - XLSX workbook object
 * @returns Array of row objects with rowIndex and original text
 */
export function readColumnD(workbook: any): RowData[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = (window as any).XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  const rows: RowData[] = [];
  for (let r = 1; r < json.length; r++) {
    rows.push({
      rowIndex: r + 1,
      original: json[r][3] || ""
    });
  }
  
  return rows;
}

/**
 * Get cell value from workbook by reference
 * @param workbook - XLSX workbook object
 * @param cellRef - Cell reference (e.g., "D34")
 * @returns Cell value or null
 */
export function getCellValue(workbook: any, cellRef: string): string | null {
  if (!workbook) return null;
  
  let ref = cellRef.trim().replace(/^=/, "").toUpperCase();
  
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return null;
  
  const cell = sheet[ref];
  if (!cell || cell.v == null || cell.v === "") {
    return null;
  }
  
  return String(cell.v);
}

