import { readColumnD } from './FileHandler';
import { 
    extractTextAndBuildPlaceholders, 
    buildTranslationFormula,
    rebuildFromTemplates
} from './translationEngine';
import { applyGlossarySubstitutions } from '@/utils/textExtraction';
import { extractFromMultipleFiles, buildUniqueStringMap } from './MultiFileHandler';
import type { AppState } from '@/contexts/AppContext';
import { extractJsonText, rebuildJsonFromTemplate } from '@/utils/jsonTextExtraction';
import { extractTextFromHTML } from '@/utils/subtitleHelpers';

// Global XLSX object from loaded library
declare const XLSX: any;

// Global JSZip object from loaded library
declare const JSZip: any;

/**
 * Escape CSV field value (handle commas, quotes, newlines)
 */
function escapeCSV(value: string): string {
    if (!value) return '';
    
    // Convert to string if not already
    const text = String(value);
    
    // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    
    return text;
}

/**
 * Get COPILOT instruction from multi-select options
 */
function getInstructionForLanguage(lang: string, state: AppState): string {
  if (!state.useCopilotInstructions) return '';
  
  const options = state.copilotOptions[lang];
  if (!options) return '';
  
  const parts: string[] = [];
  
  // Tone options (mutually exclusive)
  if (options.formal) {
    parts.push("Use a formal, professional tone appropriate for business communications. Maintain respectful language.");
  } else if (options.informal) {
    parts.push("Use a casual, conversational tone that feels natural and friendly. Use everyday language.");
  }
  
  // Additional options
  if (options.contextAware) {
    parts.push("Keep the same character length as the original text to maintain formatting and layout.");
  }
  
  if (options.custom) {
    const customText = state.copilotCustomInstructions[lang];
    if (customText) {
      parts.push(customText);
    }
  }
  
  return parts.join(" ");
}

/**
 * Generate Excel 2004 XML Spreadsheet format (SpreadsheetML)
 * This format is required for CKLS uploads
 * @param data - 2D array of worksheet data
 * @param sheetName - Name of the worksheet
 * @returns XML string in SpreadsheetML format
 */
function generateExcel2004XML(data: any[][], sheetName: string = "Sheet1"): string {
    // Escape XML special characters
    const escapeXML = (str: any): string => {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    // Build XML header
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
    xml += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
    xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += ' xmlns:html="http://www.w3.org/TR/REC-html40">\n';
    
    // Add DocumentProperties
    xml += ' <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">\n';
    xml += '  <Author>AI Translate</Author>\n';
    xml += `  <Created>${new Date().toISOString()}</Created>\n`;
    xml += ' </DocumentProperties>\n';
    
    // Add Styles
    xml += ' <Styles>\n';
    xml += '  <Style ss:ID="Default" ss:Name="Normal">\n';
    xml += '   <Alignment ss:Vertical="Bottom"/>\n';
    xml += '  </Style>\n';
    xml += ' </Styles>\n';
    
    // Start Worksheet
    xml += ` <Worksheet ss:Name="${escapeXML(sheetName)}">\n`;
    
    // Calculate column count
    const maxCols = Math.max(...data.map(row => row.length));
    
    xml += `  <Table ss:ExpandedColumnCount="${maxCols}" ss:ExpandedRowCount="${data.length}">\n`;
    
    // Add Rows
    data.forEach((row) => {
        xml += '   <Row>\n';
        
        // Iterate through ALL columns (not just existing cells)
        // This prevents column misalignment when some rows have fewer cells
        for (let colIdx = 0; colIdx < maxCols; colIdx++) {
            const cell = row[colIdx];
            let cellValue = cell === null || cell === undefined ? '' : String(cell);
            let cellType = 'String';
            
            // Detect number type
            if (typeof cell === 'number') {
                cellType = 'Number';
            } else if (typeof cell === 'string' && !isNaN(Number(cell)) && cell.trim() !== '') {
                // Check if it looks like a number but should be treated as string
                // (e.g., has leading zeros, or is an ID)
                const hasLeadingZero = cell.trim().startsWith('0') && cell.trim().length > 1;
                if (!hasLeadingZero) {
                    cellType = 'Number';
                    cellValue = String(Number(cell));
                }
            }
            
            xml += `    <Cell><Data ss:Type="${cellType}">${escapeXML(cellValue)}</Data></Cell>\n`;
        }
        
        xml += '   </Row>\n';
    });
    
    xml += '  </Table>\n';
    xml += ' </Worksheet>\n';
    xml += '</Workbook>\n';
    
    return xml;
}

/**
 * Generate Phase 1 workbook with translation formulas
 * @param state - Application state
 * @returns Object with filename and targetMapping
 */
export function generatePhase1Workbook(state: AppState): { filename: string; targetMapping: Record<string, string> } {
    const {
        workbook,
        targetLanguagesCKLS,
        sourceLanguageISO,
        fileTitleSlug,
        doNotTranslate,
        predefinedTranslations,
        useCopilot,
        languageNames
    } = state;
    
    if (!workbook) {
        throw new Error("Upload a source workbook first.");
    }
    
    if (!targetLanguagesCKLS.length) {
        throw new Error("Select at least one target language.");
    }
    
    // Read column D
    const rows = readColumnD(workbook);
    
    // Extract text and build placeholders
    const { extracted, rebuilt } = extractTextAndBuildPlaceholders(rows, doNotTranslate);
    
    // Get original sheet
    const originalSheetName = workbook.SheetNames[0];
    const originalSheet = workbook.Sheets[originalSheetName];
    const originalMatrix = XLSX.utils.sheet_to_json(originalSheet, { header: 1, raw: true });
    
    const sourceLang = sourceLanguageISO || "en";
    
    // Build target mapping: map full CKLS codes to themselves
    // This prevents issues when multiple languages share the same base code (e.g., en-US, en-GB)
    const targetMapping: Record<string, string> = {};
    targetLanguagesCKLS.forEach(cklsCode => {
        targetMapping[cklsCode] = cklsCode;
    });
    
    // Use full CKLS codes as column headers to avoid duplicates
    const headerLangCodes = targetLanguagesCKLS;
    
    const headerWarn = [
        "⚠ Excel Online auto-translates", "", "", "",
        ...Array(headerLangCodes.length).fill("")
    ];
    
    const headerCols = [
        "ID", "Row", "ExtractedText", "template_html",
        ...headerLangCodes
    ];
    
    let exData: any[][] = [headerWarn, headerCols];
    
    // Build data rows
    extracted.forEach((e, i) => {
        const template = rebuilt.find(r => r.rowIndex === e.rowIndex)?.template || "";
        const row: any[] = [e.id, e.rowIndex, e.extracted, template];
        
        const cellRef = `C${i + 3}`;
        
        targetLanguagesCKLS.forEach((targetLang) => {
            // Apply enhanced glossary substitutions (handles full text, phrases, and words)
            const glossaryResult = applyGlossarySubstitutions(
                e.extracted,
                sourceLang,
                targetLang,
                predefinedTranslations
            );
            
            if (glossaryResult.hasSubstitutions && glossaryResult.processedText === "__GLOSSARY_FULL__") {
                // Full glossary match - use the translation directly
                row.push(glossaryResult.substitutions["__GLOSSARY_FULL__"]);
                return;
            }
            
            // Note: For partial glossary matches in Excel workbooks, we still generate
            // the formula since Excel would need to handle the placeholders.
            // The API translation methods will handle partial matches properly.
            
            // Get base language code for language name lookup and formulas
            const baseLang = targetLang.split('-')[0].toLowerCase();
            const langName = languageNames[baseLang] || targetLang;
            
            // Use COPILOT mode if enabled
            const useCopilotMode = useCopilot;
            const customInstructions = getInstructionForLanguage(targetLang, state);
            
            const formula = buildTranslationFormula(
                cellRef, 
                sourceLang, 
                baseLang, // Use base language code for TRANSLATE formula
                useCopilotMode, 
                langName, 
                customInstructions
            );
            row.push(formula);
        });
        
        exData.push(row);
    });
    
    // Create workbook
    const sheetExtracted = XLSX.utils.aoa_to_sheet(exData);
    const wbOut = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbOut, XLSX.utils.aoa_to_sheet(originalMatrix), "Original");
    XLSX.utils.book_append_sheet(wbOut, sheetExtracted, "Extracted_Text");
    
    const base = fileTitleSlug || "translations";
    const fname = `${base}__open-in-excel.xlsx`;
    XLSX.writeFile(wbOut, fname, { bookType: "xlsx" });
    
    return { filename: fname, targetMapping };
}

/**
 * Generate Phase 1 workbook with translation formulas for multiple files (deduplicated)
 * @param state - Application state with filesData
 * @returns Object with filename, targetMapping, and stats
 */
export function generatePhase1WorkbookMultiFile(state: AppState): { 
    filename: string; 
    targetMapping: Record<string, string>;
    uniqueStrings: number;
    totalFiles: number;
} {
    const {
        filesData,
        targetLanguagesCKLS,
        sourceLanguageISO,
        doNotTranslate,
        predefinedTranslations,
        useCopilot,
        languageNames
    } = state;
    
    if (!filesData || filesData.length === 0) {
        throw new Error("Upload source files first.");
    }
    
    if (!targetLanguagesCKLS.length) {
        throw new Error("Select at least one target language.");
    }
    
    // Extract strings from all files
    const fileExtractions = extractFromMultipleFiles(filesData, doNotTranslate);
    
    // Build unique string map (deduplication)
    const uniqueStringMap = buildUniqueStringMap(fileExtractions);
    
    const sourceLang = sourceLanguageISO || "en";
    
    // Build target mapping: map full CKLS codes to themselves
    // This prevents issues when multiple languages share the same base code (e.g., en-US, en-GB)
    const targetMapping: Record<string, string> = {};
    targetLanguagesCKLS.forEach(cklsCode => {
        targetMapping[cklsCode] = cklsCode;
    });
    
    // Use full CKLS codes as column headers to avoid duplicates
    const headerLangCodes = targetLanguagesCKLS;
    
    const headerWarn = [
        "⚠ Excel Online auto-translates", "", "", "", "",
        ...Array(headerLangCodes.length).fill("")
    ];
    
    const headerCols = [
        "ID", "FileIndices", "ExtractedText", "RowIndex", "template_html",
        ...headerLangCodes
    ];
    
    let exData: any[][] = [headerWarn, headerCols];
    
    // Build data rows from unique strings
    let idCounter = 1;
    uniqueStringMap.forEach((locations, text) => {
        // Build comma-separated list of file indices
        const fileIndices = [...new Set(locations.map(loc => loc.fileIndex))].sort().join(',');
        
        // Use first occurrence for rowIndex (for reference)
        const firstRowIndex = locations[0].rowIndex;
        
        const row: any[] = [
            `str_${idCounter++}`,
            fileIndices,
            text,
            firstRowIndex,
            "" // template_html not used in multi-file mode
        ];
        
        const cellRef = `C${exData.length + 1}`; // Reference to ExtractedText column
        
        targetLanguagesCKLS.forEach((targetLang) => {
            // Apply enhanced glossary substitutions (handles full text, phrases, and words)
            const glossaryResult = applyGlossarySubstitutions(
                text,
                sourceLang,
                targetLang,
                predefinedTranslations
            );
            
            if (glossaryResult.hasSubstitutions && glossaryResult.processedText === "__GLOSSARY_FULL__") {
                // Full glossary match - use the translation directly
                row.push(glossaryResult.substitutions["__GLOSSARY_FULL__"]);
                return;
            }
            
            // Note: For partial glossary matches in Excel workbooks, we still generate
            // the formula since Excel would need to handle the placeholders.
            // The API translation methods will handle partial matches properly.
            
            // Get base language code for language name lookup and formulas
            const baseLang = targetLang.split('-')[0].toLowerCase();
            const langName = languageNames[baseLang] || targetLang;
            
            // Use COPILOT mode if enabled
            const useCopilotMode = useCopilot;
            const customInstructions = getInstructionForLanguage(targetLang, state);
            
            const formula = buildTranslationFormula(
                cellRef, 
                sourceLang, 
                baseLang, // Use base language code for TRANSLATE formula
                useCopilotMode, 
                langName, 
                customInstructions
            );
            row.push(formula);
        });
        
        exData.push(row);
    });
    
    // Create workbook with single sheet
    const sheetExtracted = XLSX.utils.aoa_to_sheet(exData);
    const wbOut = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbOut, sheetExtracted, "Extracted_Text");
    
    const fname = `multifile_${filesData.length}files__open-in-excel.xlsx`;
    XLSX.writeFile(wbOut, fname, { bookType: "xlsx" });
    
    return { 
        filename: fname, 
        targetMapping,
        uniqueStrings: uniqueStringMap.size,
        totalFiles: filesData.length
    };
}

/**
 * Generate final workbook from translated data
 * @param state - Application state
 * @param translatedWorkbook - Uploaded workbook with translations
 * @param format - Output format ("xml" or "xlsx")
 * @returns Generated filename or null on error
 */
export function generateFinalWorkbook(
    state: AppState,
    translatedWorkbook: any,
    format: "xml" | "xlsx" = "xml"
): string | null {
    const {
        fileTitleSlug,
        targetMapping,
        detectedExisting,
        overwriteMode
    } = state;
    
    if (!translatedWorkbook) {
        throw new Error("Upload a translated workbook first.");
    }
    
    const exSheet = translatedWorkbook.Sheets["Extracted_Text"];
    const origSheet = translatedWorkbook.Sheets["Original"];
    
    if (!exSheet || !origSheet) {
        throw new Error("Workbook must contain 'Original' and 'Extracted_Text' sheets.");
    }
    
    const exMatrix = XLSX.utils.sheet_to_json(exSheet, { header: 1, raw: false });
    if (exMatrix.length < 3) {
        throw new Error("Extracted_Text sheet seems empty.");
    }
    
    const headerRow = exMatrix[1];
    
    // Helper function to check if a language column has any actual translations
    const hasTranslationsForLanguage = (colIndex: number): boolean => {
        for (let r = 2; r < exMatrix.length; r++) {
            const cellValue = exMatrix[r][colIndex];
            if (cellValue && String(cellValue).trim() !== '') {
                return true;
            }
        }
        return false;
    };
    
    // Only include columns that have actual translations (non-empty)
    const langCols: Array<{ key: string; colIndex: number }> = [];
    for (let c = 4; c < headerRow.length; c++) {
        const key = headerRow[c];
        if (key && hasTranslationsForLanguage(c)) {
            langCols.push({ key, colIndex: c });
        }
    }
    
    if (!langCols.length) {
        throw new Error("No translated language columns found in Extracted_Text.");
    }
    
    // Parse extracted data
    const idsByRow: Record<number, string[]> = {};
    const templatesByRow: Record<number, string> = {};
    const translationsByLang: Record<string, Record<string, string>> = {};
    
    langCols.forEach(({ key }) => {
        translationsByLang[key] = {};
    });
    
    for (let r = 2; r < exMatrix.length; r++) {
        const row = exMatrix[r];
        if (!row || !row[0]) continue;
        
        const id = row[0];
        const rowIndex = row[1];
        const template = row[3] || "";
        
        if (!idsByRow[rowIndex]) idsByRow[rowIndex] = [];
        idsByRow[rowIndex].push(id);
        templatesByRow[rowIndex] = template;
        
        langCols.forEach(({ key, colIndex }) => {
            const val = row[colIndex] || "";
            translationsByLang[key][id] = val;
        });
    }
    
    // Get original matrix
    const origMatrix = XLSX.utils.sheet_to_json(origSheet, { header: 1, raw: true });
    
    // Rebuild with translations
    const { finalMatrix, stats } = rebuildFromTemplates(
        templatesByRow,
        idsByRow,
        translationsByLang,
        langCols,
        origMatrix,
        targetMapping,
        detectedExisting,
        overwriteMode,
        state.existingLanguagesModes
    );
    
    console.log(`📊 Source content copied: ${stats.sourceCopiedRows} rows`);
    
    // Create and download workbook
    const base = fileTitleSlug || "Feuille1";
    let fname: string;
    
    if (format === "xml") {
        fname = `${base}__upload-to-ckls.xml`;
        
        // Generate Excel 2004 XML format
        const xmlContent = generateExcel2004XML(finalMatrix, "Feuille1");
        const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fname;
        link.click();
        URL.revokeObjectURL(link.href);
    } else {
        fname = `${base}__upload-to-ckls.xlsx`;
        const wbOut = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wbOut, XLSX.utils.aoa_to_sheet(finalMatrix), "Feuille1");
        XLSX.writeFile(wbOut, fname, { bookType: "xlsx" });
    }
    
    return fname;
}

/**
 * Generate final workbooks from translated multi-file Excel
 * Distributes translations back to original files and generates ZIP
 * @param state - Application state
 * @param translatedWorkbook - Uploaded workbook with translations
 * @param format - Output format ("xml" or "xlsx")
 * @returns Object with ZIP filename
 */
export function generateFinalWorkbookMultiFile(
    state: AppState,
    translatedWorkbook: any,
    format: "xml" | "xlsx" = "xml"
): { filename: string } {
    const {
        filesData,
        targetMapping,
        detectedExisting,
        overwriteMode,
        doNotTranslate
    } = state;
    
    if (!translatedWorkbook) {
        throw new Error("Upload a translated workbook first.");
    }
    
    if (!filesData || filesData.length === 0) {
        throw new Error("No original files data available.");
    }
    
    const exSheet = translatedWorkbook.Sheets["Extracted_Text"];
    
    if (!exSheet) {
        throw new Error("Workbook must contain 'Extracted_Text' sheet.");
    }
    
    const exMatrix = XLSX.utils.sheet_to_json(exSheet, { header: 1, raw: false });
    if (exMatrix.length < 3) {
        throw new Error("Extracted_Text sheet seems empty.");
    }
    
    // Parse header to find language columns
    const headerRow = exMatrix[1];
    
    // Helper function to check if a language column has any actual translations
    const hasTranslationsForLanguage = (colIndex: number): boolean => {
        for (let r = 2; r < exMatrix.length; r++) {
            const cellValue = exMatrix[r][colIndex];
            if (cellValue && String(cellValue).trim() !== '') {
                return true;
            }
        }
        return false;
    };
    
    // Only include columns that have actual translations (non-empty)
    const langCols: Array<{ key: string; colIndex: number }> = [];
    for (let c = 5; c < headerRow.length; c++) { // Start at 5 (after ID, FileIndices, ExtractedText, RowIndex, template_html)
        const key = headerRow[c];
        if (key && hasTranslationsForLanguage(c)) {
            langCols.push({ key, colIndex: c });
        }
    }
    
    if (!langCols.length) {
        throw new Error("No translated language columns found in Extracted_Text.");
    }
    
    // Parse all unique strings and their translations
    const uniqueTranslations: Record<string, {
        fileIndices: number[];
        text: string;
        translations: Record<string, string>; // lang -> translation
    }> = {};
    
    for (let r = 2; r < exMatrix.length; r++) {
        const row = exMatrix[r];
        if (!row || !row[0]) continue;
        
        const id = row[0];
        const fileIndicesStr = row[1] || "";
        const text = row[2] || "";
        
        // Parse file indices
        const fileIndices = fileIndicesStr.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
        
        uniqueTranslations[id] = {
            fileIndices,
            text,
            translations: {}
        };
        
        langCols.forEach(({ key, colIndex }) => {
            const val = row[colIndex] || "";
            uniqueTranslations[id].translations[key] = val;
        });
    }
    
    // Re-extract from each file to rebuild with translations
    const fileExtractions = extractFromMultipleFiles(filesData, doNotTranslate);
    
    try {
        // Global JSZip object
        const zip = new (window as any).JSZip();
        
        // Process each file
        filesData.forEach((fileData, fileIndex) => {
            const extraction = fileExtractions.find(e => e.fileIndex === fileIndex);
            if (!extraction) {
                throw new Error(`Could not find extraction data for file ${fileIndex}`);
            }
            
            // Build templates and IDs by row for this file
            const templatesByRow: Record<number, string> = {};
            const idsByRow: Record<number, string[]> = {};
            
            extraction.rebuilt.forEach((item: any) => {
                templatesByRow[item.rowIndex] = item.template;
            });
            
            extraction.extracted.forEach((item: any) => {
                const rowIndex = item.rowIndex;
                if (!idsByRow[rowIndex]) {
                    idsByRow[rowIndex] = [];
                }
                idsByRow[rowIndex].push(item.id);
            });
            
            // Build translations for this file by matching extracted text to unique translations
            const translationsByLang: Record<string, Record<string, string>> = {};
            langCols.forEach(({ key }) => {
                translationsByLang[key] = {};
            });
            
            // For each extracted item in this file, find its translation from uniqueTranslations
            extraction.extracted.forEach((item: any) => {
                const text = item.extracted;
                
                // Find matching unique translation by text content and fileIndex
                const matchingUnique = Object.values(uniqueTranslations).find(
                    ut => ut.text === text && ut.fileIndices.includes(fileIndex)
                );
                
                if (matchingUnique) {
                    langCols.forEach(({ key }) => {
                        translationsByLang[key][item.id] = matchingUnique.translations[key] || "";
                    });
                }
            });
            
            // Get original matrix
            const originalSheetName = fileData.workbook.SheetNames[0];
            const originalSheet = fileData.workbook.Sheets[originalSheetName];
            const origMatrix = XLSX.utils.sheet_to_json(originalSheet, { header: 1, raw: true });
            
            // Rebuild with translations
            const { finalMatrix, stats } = rebuildFromTemplates(
                templatesByRow,
                idsByRow,
                translationsByLang,
                langCols,
                origMatrix,
                targetMapping,
                detectedExisting,
                overwriteMode,
                state.existingLanguagesModes
            );
            
            console.log(`📊 File ${fileIndex}: Source content copied: ${stats.sourceCopiedRows} rows`);
            
            // Generate XML/XLSX file content
            let fileContent: string | ArrayBuffer;
            if (format === "xml") {
                fileContent = generateExcel2004XML(finalMatrix, "Feuille1");
            } else {
                const wbOut = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wbOut, XLSX.utils.aoa_to_sheet(finalMatrix), "Feuille1");
                fileContent = XLSX.write(wbOut, { bookType: "xlsx", type: "binary" });
            }
            
            // Add to ZIP
            const baseFileName = fileData.fileTitleSlug || fileData.fileName.replace(/\.(xlsx|xml)$/i, '');
            const outputFileName = format === "xml" 
                ? `${baseFileName}__upload-to-ckls.xml`
                : `${baseFileName}__upload-to-ckls.xlsx`;
            
            zip.file(outputFileName, fileContent, { binary: format !== "xml" });
        });
        
        // Generate ZIP file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const zipFileName = `translated_${filesData.length}files_${timestamp}.zip`;
        
        // Generate and download ZIP
        zip.generateAsync({ type: "blob" }).then((content: Blob) => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = zipFileName;
            link.click();
            URL.revokeObjectURL(link.href);
        });
        
        return { filename: zipFileName };
        
    } catch (err) {
        console.error("Error generating multi-file ZIP:", err);
        throw err;
    }
}

/**
 * Generate output file from DeepL translations
 * Supports both single file and multi-file (array) results
 * @param state - Application state
 * @param result - DeepL translation results
 * @returns Object with filename and statistics
 */
export function generateDeepLOutput(state: AppState, result: any): { 
    filename: string; 
    stats: { sourceCopiedRows: number } 
} {
    const { extracted, rebuilt, translations } = result;
    const { workbook, fileTitleSlug, targetMapping, detectedExisting, overwriteMode } = state;
    
    if (!workbook) {
        throw new Error("No workbook available.");
    }
    
    // Get original sheet
    const originalSheetName = workbook.SheetNames[0];
    const originalSheet = workbook.Sheets[originalSheetName];
    const originalMatrix = XLSX.utils.sheet_to_json(originalSheet, { header: 1, raw: true });
    
    // Build templates and IDs by row
    const templatesByRow: Record<number, string> = {};
    const idsByRow: Record<number, string[]> = {};
    
    // Get templates from rebuilt array
    rebuilt.forEach((item: any) => {
        templatesByRow[item.rowIndex] = item.template;
    });
    
    // Get IDs from extracted array (grouped by rowIndex)
    extracted.forEach((item: any) => {
        const rowIndex = item.rowIndex;
        if (!idsByRow[rowIndex]) {
            idsByRow[rowIndex] = [];
        }
        idsByRow[rowIndex].push(item.id);
    });
    
    // Rebuild with translations
    // Include ALL existing languages + translated languages to preserve columns
    const translatedLangs = Object.keys(translations);
    const allLanguagesToProcess = [...new Set([...detectedExisting, ...translatedLangs])];
    const langCols = allLanguagesToProcess.map(key => ({ key, colIndex: 0 }));
    
    console.log('📊 generateDeepLOutput - Languages to process:', {
        detectedExisting,
        translatedLangs,
        allLanguagesToProcess
    });
    
    const { finalMatrix, stats } = rebuildFromTemplates(
        templatesByRow,
        idsByRow,
        translations,
        langCols,
        originalMatrix,
        targetMapping,
        detectedExisting,
        overwriteMode,
        state.existingLanguagesModes
    );
    
    console.log(`📊 Source content copied: ${stats.sourceCopiedRows} rows`);
    
    // Create and download workbook
    const base = fileTitleSlug || "Feuille1";
    const timestamp = Math.floor(Date.now() / 1000);
    const langs = Object.keys(translations).sort().join('_');
    const fname = `${base}_${langs}_${timestamp}.xml`;
    
    // Generate Excel 2004 XML format
    const xmlContent = generateExcel2004XML(finalMatrix, "Feuille1");
    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fname;
    link.click();
    URL.revokeObjectURL(link.href);
    
    return { 
        filename: fname, 
        stats: { sourceCopiedRows: stats.sourceCopiedRows } 
    };
}

/**
 * Generate output file from Google Cloud Translation translations
 * Supports both single file and multi-file (array) results
 * @param state - Application state
 * @param extracted - Extracted items with IDs
 * @param rebuilt - Template items
 * @param translations - Translation map [targetLang][id] = translation
 * @returns Object with filename and statistics
 */
export function generateGoogleOutput(
    state: AppState,
    extracted: any[],
    rebuilt: any[],
    translations: Record<string, Record<string, string>>
): { filename: string; stats: { sourceCopiedRows: number } } {
    const { workbook, fileTitleSlug, targetMapping, detectedExisting, overwriteMode } = state;
    
    if (!workbook) {
        throw new Error("No workbook available.");
    }
    
    // Get original sheet
    const originalSheetName = workbook.SheetNames[0];
    const originalSheet = workbook.Sheets[originalSheetName];
    const originalMatrix = XLSX.utils.sheet_to_json(originalSheet, { header: 1, raw: true });
    
    // Build templates and IDs by row
    const templatesByRow: Record<number, string> = {};
    const idsByRow: Record<number, string[]> = {};
    
    // Get templates from rebuilt array
    rebuilt.forEach((item: any) => {
        templatesByRow[item.rowIndex] = item.template;
    });
    
    // Get IDs from extracted array (grouped by rowIndex)
    extracted.forEach((item: any) => {
        const rowIndex = item.rowIndex;
        if (!idsByRow[rowIndex]) {
            idsByRow[rowIndex] = [];
        }
        idsByRow[rowIndex].push(item.id);
    });
    
    // Rebuild with translations
    // Include ALL existing languages + translated languages to preserve columns
    const translatedLangs = Object.keys(translations);
    const allLanguagesToProcess = [...new Set([...detectedExisting, ...translatedLangs])];
    const langCols = allLanguagesToProcess.map(key => ({ key, colIndex: 0 }));
    
    console.log('📊 generateGoogleOutput - Languages to process:', {
        detectedExisting,
        translatedLangs,
        allLanguagesToProcess
    });
    
    const { finalMatrix, stats } = rebuildFromTemplates(
        templatesByRow,
        idsByRow,
        translations,
        langCols,
        originalMatrix,
        targetMapping,
        detectedExisting,
        overwriteMode,
        state.existingLanguagesModes
    );
    
    console.log(`📊 Source content copied: ${stats.sourceCopiedRows} rows`);
    
    // Create and download workbook
    const base = fileTitleSlug || "Feuille1";
    const timestamp = Math.floor(Date.now() / 1000);
    const langs = Object.keys(translations).sort().join('_');
    const fname = `${base}_${langs}_${timestamp}.xml`;
    
    // Generate Excel 2004 XML format
    const xmlContent = generateExcel2004XML(finalMatrix, "Feuille1");
    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fname;
    link.click();
    URL.revokeObjectURL(link.href);
    
    return { 
        filename: fname, 
        stats: { sourceCopiedRows: stats.sourceCopiedRows } 
    };
}

/**
 * Generate ZIP file containing multiple translated XML files
 * @param state - Application state
 * @param results - Array of translation results, one per file
 * @returns Object with filename and statistics
 */
export function generateMultiFileZipOutput(
    state: AppState,
    results: Array<{
        fileIndex: number;
        fileName: string;
        extracted: any[];
        rebuilt: any[];
        translations: Record<string, Record<string, string>>;
    }>
): { filename: string; stats: { sourceCopiedRows: number } } {
    const { targetMapping, detectedExisting, overwriteMode, filesData } = state;

    if (!filesData || filesData.length === 0) {
        throw new Error("No files data available");
    }

    try {
        // Create ZIP instance
        const zip = new JSZip();
        
        // Aggregate stats from all files
        let totalSourceCopiedRows = 0;

        // Process each file result
        results.forEach((result) => {
            const fileData = filesData[result.fileIndex];
            const workbook = fileData.workbook;

            // Get original sheet
            const originalSheetName = workbook.SheetNames[0];
            const originalSheet = workbook.Sheets[originalSheetName];
            const originalMatrix = XLSX.utils.sheet_to_json(originalSheet, { header: 1, raw: true });

            // Build templates and IDs by row
            const templatesByRow: Record<number, string> = {};
            const idsByRow: Record<number, string[]> = {};

            result.rebuilt.forEach((item: any) => {
                templatesByRow[item.rowIndex] = item.template;
            });

            result.extracted.forEach((item: any) => {
                const rowIndex = item.rowIndex;
                if (!idsByRow[rowIndex]) {
                    idsByRow[rowIndex] = [];
                }
                idsByRow[rowIndex].push(item.id);
            });

            // Rebuild with translations
            // Include ALL existing languages + translated languages to preserve columns
            const translatedLangs = Object.keys(result.translations);
            const allLanguagesToProcess = [...new Set([...detectedExisting, ...translatedLangs])];
            const langCols = allLanguagesToProcess.map(key => ({ key, colIndex: 0 }));

            const { finalMatrix, stats } = rebuildFromTemplates(
                templatesByRow,
                idsByRow,
                result.translations,
                langCols,
                originalMatrix,
                targetMapping,
                detectedExisting,
                overwriteMode,
                state.existingLanguagesModes
            );

            console.log(`📊 File ${result.fileIndex}: Source content copied: ${stats.sourceCopiedRows} rows`);
            
            // Aggregate stats
            totalSourceCopiedRows += stats.sourceCopiedRows;

            // Generate XML using Excel 2004 XML format
            const xmlData = generateExcel2004XML(finalMatrix, "Feuille1");

            // Add to ZIP with original filename (clean, no language suffix)
            const baseFileName = fileData.fileTitleSlug || result.fileName.replace(/\.(xlsx|xml)$/i, '');
            const xmlFileName = `${baseFileName}.xml`;

            zip.file(xmlFileName, xmlData, { binary: false });
        });
        
        console.log(`📊 Total source content copied across all files: ${totalSourceCopiedRows} rows`);

        // Generate ZIP file with languages in name
        const timestamp = Math.floor(Date.now() / 1000);
        const langs = Object.keys(results[0].translations).sort().join('_');
        const zipFileName = `translations_${langs}_${timestamp}.zip`;

        // Generate and download ZIP
        zip.generateAsync({ type: "blob" }).then((content: Blob) => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = zipFileName;
            link.click();
            URL.revokeObjectURL(link.href);
        });

        return { 
            filename: zipFileName,
            stats: { sourceCopiedRows: totalSourceCopiedRows }
        };

    } catch (err) {
        console.error("Error generating multi-file ZIP:", err);
        throw err;
    }
}

/**
 * Generate Phase 1 workbook from text input
 * @param state - Application state
 * @returns Object with filename and targetMapping
 */
export function generatePhase1WorkbookFromText(state: AppState): { filename: string; targetMapping: Record<string, string> } {
    const {
        textInput,
        targetLanguagesCKLS,
        sourceLanguageISO,
        useCopilot,
        languageNames,
        detectedContentType,
        jsonSchema,
        doNotTranslate
    } = state;
    
    if (!textInput) {
        throw new Error("No text input provided.");
    }
    
    if (!targetLanguagesCKLS.length) {
        throw new Error("Select at least one target language.");
    }
    
    // Check if we're handling JSON
    if (detectedContentType === 'json' && jsonSchema) {
        return generatePhase1WorkbookFromJSON(state);
    } else if (detectedContentType === 'json' && !jsonSchema) {
        // JSON detected but no schema matched
        throw new Error(
            'JSON format not recognized for Excel Builder. ' +
            'Only Meta-Skills Avatar AI JSON is currently supported.'
        );
    }
    
    // Handle HTML or plain text (existing logic)
    // Extract text and build placeholders for HTML/text content
    const rows = [{ rowIndex: 2, original: textInput }];
    const { extracted } = extractTextAndBuildPlaceholders(rows, doNotTranslate);
    
    // Create new workbook
    const workbook = XLSX.utils.book_new();
    
    // Create worksheet data
    const wsData: any[][] = [];
    
    // Header row: ID | Source | Target1 | Target2 ...
    const headers = ['ID', 'Source', ...targetLanguagesCKLS.map(lang => {
        const isoCode = lang.split('-')[0];
        const langName = languageNames[isoCode] || lang;
        return `${langName} (${lang})`;
    })];
    wsData.push(headers);
    
    // If we have extracted items, create rows for each
    if (extracted.length > 0) {
        extracted.forEach((item: any, index: number) => {
            const rowNum = index + 2; // Excel rows start at 1, header is row 1
            const cellRef = `B${rowNum}`; // Source is in column B
            
            const dataRow: any[] = [item.id, item.extracted];
            
            // Add translation formulas for each target language
            targetLanguagesCKLS.forEach((targetLang) => {
                const targetISO = targetLang.split('-')[0];
                const langName = languageNames[targetISO] || targetLang;
                
                // Get custom instructions if enabled
                const customInstructions = getInstructionForLanguage(targetLang, state);
                
                // Build formula
                const formula = buildTranslationFormula(
                    cellRef,
                    sourceLanguageISO,
                    targetISO,
                    useCopilot,
                    langName,
                    customInstructions
                );
                
                dataRow.push(formula);
            });
            
            wsData.push(dataRow);
        });
    } else {
        // No extracted items, just use source text as-is (fallback)
        const dataRow: any[] = ['T1', textInput];
        
        targetLanguagesCKLS.forEach((targetLang) => {
            const targetISO = targetLang.split('-')[0];
            const cellRef = 'B2';
            const langName = languageNames[targetISO] || targetLang;
            const customInstructions = getInstructionForLanguage(targetLang, state);
            
            const formula = buildTranslationFormula(
                cellRef,
                sourceLanguageISO,
                targetISO,
                useCopilot,
                langName,
                customInstructions
            );
            
            dataRow.push(formula);
        });
        
        wsData.push(dataRow);
    }
    
    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    worksheet['!cols'] = [
        { wch: 10 }, // ID column
        { wch: 50 }, // Source text column
        ...targetLanguagesCKLS.map(() => ({ wch: 50 }))
    ];
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Text_Translation');
    
    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `text_translation_${timestamp}.xlsx`;
    
    // Download
    XLSX.writeFile(workbook, filename);
    
    // Build target mapping: map full CKLS codes to themselves
    // This prevents issues when multiple languages share the same base code (e.g., en-US, en-GB)
    const targetMapping: Record<string, string> = {};
    targetLanguagesCKLS.forEach(ckls => {
        targetMapping[ckls] = ckls;
    });
    
    return { filename, targetMapping };
}

/**
 * Generate Phase 1 workbook from JSON input
 * @param state - Application state
 * @returns Object with filename and targetMapping
 */
function generatePhase1WorkbookFromJSON(state: AppState): { filename: string; targetMapping: Record<string, string> } {
    const {
        textInput,
        targetLanguagesCKLS,
        sourceLanguageISO,
        useCopilot,
        languageNames,
        jsonSchema
    } = state;
    
    if (!jsonSchema) {
        throw new Error("JSON schema not detected.");
    }
    
    // Extract JSON text
    const { extracted } = extractJsonText(textInput, jsonSchema);
    
    if (!extracted || extracted.length === 0) {
        throw new Error("No translatable content found in JSON.");
    }
    
    // Create new workbook
    const workbook = XLSX.utils.book_new();
    
    // Create worksheet data
    const wsData: any[][] = [];
    
    // Header row: ID | JSONPath | Source | Target1 | Target2 ...
    const headers = ['ID', 'JSONPath', 'Source', ...targetLanguagesCKLS.map(lang => {
        const isoCode = lang.split('-')[0];
        const langName = languageNames[isoCode] || lang;
        return `${langName} (${lang})`;
    })];
    wsData.push(headers);
    
    // Add rows for each extracted item
    extracted.forEach((item: any, index: number) => {
        const rowNum = index + 2; // Excel rows start at 1, header is row 1
        const cellRef = `C${rowNum}`; // Source is in column C (after ID and JSONPath)
        
        const dataRow: any[] = [item.id, item.path, item.extracted];
        
        // Add translation formulas for each target language
        targetLanguagesCKLS.forEach((targetLang) => {
            const targetISO = targetLang.split('-')[0];
            const langName = languageNames[targetISO] || targetLang;
            
            // Get custom instructions if enabled
            const customInstructions = getInstructionForLanguage(targetLang, state);
            
            // Build formula
            const formula = buildTranslationFormula(
                cellRef,
                sourceLanguageISO,
                targetISO,
                useCopilot,
                langName,
                customInstructions
            );
            
            dataRow.push(formula);
        });
        
        wsData.push(dataRow);
    });
    
    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    worksheet['!cols'] = [
        { wch: 10 }, // ID column
        { wch: 40 }, // JSONPath column
        { wch: 50 }, // Source text column
        ...targetLanguagesCKLS.map(() => ({ wch: 50 }))
    ];
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'JSON_Translation');
    
    // Generate filename
    const schemaName = jsonSchema.name.replace(/\s+/g, '_').toLowerCase();
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${schemaName}_translation_${timestamp}.xlsx`;
    
    // Download
    XLSX.writeFile(workbook, filename);
    
    // Build target mapping: map full CKLS codes to themselves
    // This prevents issues when multiple languages share the same base code (e.g., en-US, en-GB)
    const targetMapping: Record<string, string> = {};
    targetLanguagesCKLS.forEach(ckls => {
        targetMapping[ckls] = ckls;
    });
    
    return { filename, targetMapping };
}

/**
 * Generate final text output from translated Excel
 * @param state - Application state
 * @param translatedWorkbook - Workbook with translations
 * @returns Filename of generated text file
 */
export function generateFinalTextOutput(state: AppState, translatedWorkbook: any): string {
    const { sourceLanguageCKLS, detectedContentType, jsonSchema, textInput } = state;
    
    if (!translatedWorkbook) {
        throw new Error("Upload the translated Excel file first.");
    }
    
    // Check if we're handling JSON
    if (detectedContentType === 'json' && jsonSchema) {
        return generateFinalJSONOutput(state, translatedWorkbook);
    }
    
    // Handle HTML or plain text (existing logic)
    // Read the sheet
    const sheetName = translatedWorkbook.SheetNames[0];
    const sheet = translatedWorkbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (data.length < 2) {
        throw new Error("Invalid Excel file: missing data rows.");
    }
    
    // Get headers and data rows
    const headers = data[0] as string[];
    
    // Build translations map: { id: { langCode: translation } }
    const translationsByID: Record<string, Record<string, string>> = {};
    
    for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
        const row = data[rowIdx] as any[];
        const id = row[0]; // ID in first column
        
        if (!id) continue;
        
        translationsByID[id] = {};
        
        // Extract translations from remaining columns
        for (let colIdx = 2; colIdx < headers.length; colIdx++) {
            const header = headers[colIdx];
            const translation = row[colIdx] || '';
            
            // Extract CKLS code from header (e.g., "French (fr-FR)" -> "fr-FR")
            const match = header.match(/\(([a-z]{2}-[A-Z]{2})\)/i);
            if (match) {
                const cklsCode = match[1];
                translationsByID[id][cklsCode] = translation;
            }
        }
    }
    
    // Now rebuild for each target language
    const rows = [{ rowIndex: 2, original: textInput }];
    const { extracted, rebuilt } = extractTextAndBuildPlaceholders(rows, state.doNotTranslate);
    
    // Build final translations for each language
    const finalTranslations: Record<string, string> = {};
    
    // Get list of target languages from first translation set
    const firstID = Object.keys(translationsByID)[0];
    if (firstID) {
        const targetLangs = Object.keys(translationsByID[firstID]);
        
        targetLangs.forEach(langCode => {
            // Build translation map for this language: { id: translation }
            const langTranslations: Record<string, string> = {};
            Object.entries(translationsByID).forEach(([id, translations]) => {
                langTranslations[id] = translations[langCode] || '';
            });
            
            // Rebuild text with translations
            let result = rebuilt[0]?.template || textInput;
            extracted.forEach((item: any) => {
                const translation = langTranslations[item.id] || item.extracted;
                result = result.replace(`{${item.id}}`, translation);
            });
            
            finalTranslations[langCode] = result;
        });
    }
    
    // Format for download
    const lines: string[] = [];
    
    lines.push('='.repeat(80));
    lines.push('AI TRANSLATE - TEXT TRANSLATION RESULTS');
    lines.push('='.repeat(80));
    lines.push('');
    
    lines.push(`SOURCE (${sourceLanguageCKLS.toUpperCase()})`);
    lines.push('-'.repeat(80));
    lines.push(textInput);
    lines.push('');
    lines.push('');
    
    Object.entries(finalTranslations).forEach(([lang, text]) => {
        lines.push(`TRANSLATED (${lang.toUpperCase()})`);
        lines.push('-'.repeat(80));
        lines.push(text);
        lines.push('');
        lines.push('');
    });
    
    lines.push('='.repeat(80));
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('='.repeat(80));
    
    const content = lines.join('\n');
    
    // Generate filename
    const date = new Date().toISOString().slice(0, 10);
    const filename = `translation_${date}.txt`;
    
    // Download
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return filename;
}

/**
 * Generate final JSON output from translated Excel
 * @param state - Application state
 * @param translatedWorkbook - Workbook with translations
 * @returns Filename of generated JSON file
 */
function generateFinalJSONOutput(state: AppState, translatedWorkbook: any): string {
    const { jsonSchema, textInput } = state;
    
    if (!jsonSchema) {
        throw new Error("JSON schema not found.");
    }
    
    // Read the sheet
    const sheetName = translatedWorkbook.SheetNames[0];
    const sheet = translatedWorkbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (data.length < 2) {
        throw new Error("Invalid Excel file: missing data rows.");
    }
    
    // Get headers
    const headers = data[0] as string[];
    
    // Extract translations by language
    const translationsByLang: Record<string, Record<string, string>> = {};
    
    // Find which columns correspond to which languages
    for (let colIdx = 3; colIdx < headers.length; colIdx++) {
        const header = headers[colIdx];
        
        // Extract CKLS code from header (e.g., "French (fr-FR)" -> "fr-FR")
        const match = header.match(/\(([a-z]{2}-[A-Z]{2})\)/i);
        if (match) {
            const cklsCode = match[1];
            translationsByLang[cklsCode] = {};
            
            // Extract translations for this language
            for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
                const row = data[rowIdx] as any[];
                const id = row[0]; // ID in first column
                const translation = row[colIdx] || '';
                
                if (id) {
                    translationsByLang[cklsCode][id] = translation;
                }
            }
        }
    }
    
    // Extract original JSON to get template
    const { template } = extractJsonText(textInput, jsonSchema);
    
    // Generate a JSON file for each target language
    const jszip = new JSZip();
    
    Object.entries(translationsByLang).forEach(([langCode, translations]) => {
        // Use langCode directly as the target locale (e.g., "fr-FR")
        const targetLocale = langCode;
        
        // Rebuild JSON with translations
        const rebuiltJSON = rebuildJsonFromTemplate(template, translations, targetLocale);
        
        // Add to zip
        const filename = `${jsonSchema.name.replace(/\s+/g, '_')}_${langCode}.json`;
        jszip.file(filename, rebuiltJSON);
    });
    
    // Generate ZIP filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const zipFilename = `${jsonSchema.name.replace(/\s+/g, '_')}_translated_${timestamp}.zip`;
    
    // Generate and download ZIP
    jszip.generateAsync({ type: "blob" }).then((content: Blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = zipFilename;
        link.click();
        URL.revokeObjectURL(link.href);
    });
    
    return zipFilename;
}

// ============================================================================
// CLIENT REVIEW FILE GENERATION
// ============================================================================

/**
 * Translation statistics type (matches Step3's TranslationStats)
 */
interface TranslationStats {
    startTime: number;
    endTime: number | null;
    totalStrings: number;
    uniqueStrings: number;
    duplicateStrings: number;
    totalCharacters: number;
    sourceCharacters?: number;
    translatedCharacters?: number;
    languages: number;
    apiCallsSaved: number;
    tmxMatched?: number;
    tmxSavedApiCalls?: number;
    languageResults?: Record<string, {
        successCount: number;
        failureCount: number;
        totalStrings: number;
        successRate: number;
    }>;
    sourceCopiedRows?: number;
}

/**
 * Get current date stamp in YYYY-MM-DD format
 */
function getDateStamp(): string {
    const now = new Date();
    return now.toISOString().slice(0, 10);
}


/**
 * Apply styling and protection to review sheet
 */
function applyReviewSheetStyling(ws: any, dataRowCount: number): void {
    // Set column widths
    ws['!cols'] = [
        { wch: 15 },  // A: ID
        { wch: 40 },  // B: Source Text
        { wch: 40 },  // C: Current Translation
        { wch: 20 },  // D: Status (with dropdown)
        { wch: 40 },  // E: Correction
        { wch: 30 }   // F: Notes
    ];
    
    // Freeze header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    
    // Add data validation for Status column (dropdown)
    // Note: xlsx library has limited support for writing data validation
    // This may not work in all Excel versions - users can manually add validation if needed
    for (let R = 2; R <= dataRowCount + 1; ++R) {
        const cellAddress = `D${R}`;
        if (ws[cellAddress]) {
            if (!ws[cellAddress].s) ws[cellAddress].s = {};
            // Try to add validation at cell level
            ws[cellAddress].s.dataValidation = {
                type: 'list',
                allowBlank: false,
                showDropDown: true,
                formulae: ['"Pending,Approved,Needs Correction"']
            };
        }
    }
    
    // Apply sheet protection
    ws['!protect'] = {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertColumns: false,
        insertRows: false,
        deleteColumns: false,
        deleteRows: false,
        password: '' // No password - easy to unprotect if needed
    };
    
    // Lock/unlock individual cells
    // Columns A, B, C are locked (read-only)
    // Columns D, E, F are unlocked (editable)
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[cellAddress] || ws[cellAddress].t === undefined) continue;
            
            // Initialize cell style
            if (!ws[cellAddress].s) ws[cellAddress].s = {};
            if (!ws[cellAddress].s.protection) ws[cellAddress].s.protection = {};
            
            // Lock columns A (0), B (1), C (2)
            // Unlock columns D (3), E (4), F (5)
            if (C <= 2) {
                ws[cellAddress].s.protection.locked = true;
            } else if (C >= 3 && C <= 5) {
                ws[cellAddress].s.protection.locked = false;
            }
        }
    }
}

/**
 * Generate the summary/instructions sheet
 */
function generateSummarySheet(
    state: AppState,
    translationStats: TranslationStats,
    selectedMethod: string
): any {
    const rows: any[][] = [];
    
    // Header
    rows.push(['═'.repeat(80)]);
    rows.push(['CLIENT REVIEW FILE - VERSION 1']);
    rows.push(['Please review translations and mark corrections']);
    rows.push(['═'.repeat(80)]);
    rows.push([]);
    
    // Project Information
    rows.push(['PROJECT INFORMATION']);
    rows.push(['─'.repeat(80)]);
    rows.push([`• File Name: ${state.fileTitleRaw || state.fileTitleSlug}`]);
    rows.push([`• Source Language: ${state.sourceLanguageCKLS}`]);
    rows.push([`• Target Languages: ${state.targetLanguagesCKLS.join(', ')}`]);
    rows.push([`• Translation Date: ${new Date().toLocaleString()}`]);
    
    const methodName = selectedMethod === 'deepl' ? 'DeepL AI' : 
                       selectedMethod === 'google' ? 'Google Cloud Translation' : 'Excel';
    rows.push([`• Translation Method: ${methodName}`]);
    rows.push([`• Version: 1`]);
    rows.push([`• Total Instances: ${translationStats.totalStrings} (across all languages)`]);
    rows.push([]);
    
    // Translation Statistics
    rows.push(['TRANSLATION STATISTICS']);
    rows.push(['─'.repeat(80)]);
    rows.push([`• Total Strings: ${translationStats.totalStrings}`]);
    rows.push([`• Unique Strings: ${translationStats.uniqueStrings}`]);
    rows.push([`• Duplicates: ${translationStats.duplicateStrings} (${Math.round((translationStats.duplicateStrings / translationStats.totalStrings) * 100)}%)`]);
    rows.push([`• Total Characters: ${translationStats.totalCharacters}`]);
    rows.push([`• Languages: ${translationStats.languages}`]);
    rows.push([`• Glossary Terms Applied: ${state.predefinedTranslations.length}`]);
    rows.push([`• Do-Not-Translate Terms: ${state.doNotTranslate.length}`]);
    rows.push([]);
    
    // Glossary Terms in Use
    if (state.predefinedTranslations.length > 0) {
        rows.push(['GLOSSARY TERMS IN USE']);
        rows.push(['─'.repeat(80)]);
        rows.push(['These terms are pre-defined and should NOT be corrected in this review:']);
        
        state.predefinedTranslations.forEach(entry => {
            const sourceTerm = entry.translations[state.sourceLanguageCKLS];
            const translations: string[] = [];
            state.targetLanguagesCKLS.forEach(lang => {
                if (entry.translations[lang]) {
                    translations.push(`${lang}: "${entry.translations[lang]}"`);
                }
            });
            rows.push([`• "${sourceTerm}" → ${translations.join(', ')}`]);
        });
        rows.push([]);
        rows.push(['⚠️ IMPORTANT: Glossary terms take precedence. If you need to change']);
        rows.push(['a glossary translation, please contact your translator to update']);
        rows.push(['the master glossary instead of correcting it here.']);
        rows.push([]);
    }
    
    // How to Use
    rows.push(['HOW TO USE THIS FILE']);
    rows.push(['─'.repeat(80)]);
    rows.push(['1. 📋 Select a language review tab (e.g., "fr-FR Review")']);
    rows.push(['2. 👀 Review each translation row by row']);
    rows.push(['3. 📝 For each string:']);
    rows.push(['   • Column D (Status): Click dropdown and select:']);
    rows.push(['     - "Approved" = Translation is correct']);
    rows.push(['     - "Needs Correction" = Translation needs fixing']);
    rows.push(['     - "Already Translated" = Was already correct (pre-filled)']);
    rows.push(['     - "Pending" = Not yet reviewed']);
    rows.push(['   • Column E (Correction): If "Needs Correction", type the correct translation']);
    rows.push(['   • Column F (Notes): Optional - add context or explanation']);
    rows.push(['4. 💾 Save the file when done']);
    rows.push(['5. 🔄 Upload it using: Extension Options > Import Corrections tab']);
    rows.push(['6. ✅ Corrections will be applied in your next translation (version 2)']);
    rows.push([]);
    
    // Important Notes
    rows.push(['IMPORTANT NOTES']);
    rows.push(['─'.repeat(80)]);
    rows.push(['• 🔒 Columns A, B, C are LOCKED to prevent accidental changes']);
    rows.push(['• ✏️ Only edit columns D (Status), E (Correction), F (Notes)']);
    rows.push(['• 📊 Strings appearing multiple times show: "Rows: 5, 12, 23" in Notes']);
    rows.push(['• 🎯 One correction applies to all instances of the same string']);
    rows.push(['• ⚠️ To unlock columns: Review tab > Unprotect Sheet (no password)']);
    rows.push([]);
    
    // Status Definitions
    rows.push(['STATUS DEFINITIONS']);
    rows.push(['─'.repeat(80)]);
    rows.push(['• Pending: Not yet reviewed (default for new translations)']);
    rows.push(['• Approved: Translation is correct, no changes needed']);
    rows.push(['• Needs Correction: Fill in column E with the correct translation']);
    rows.push(['• Already Translated: String was already translated (fill-empty mode)']);
    rows.push([]);
    
    // Contact
    rows.push(['CONTACT']);
    rows.push(['─'.repeat(80)]);
    rows.push(['Questions? Contact your translator for assistance.']);
    
    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Apply styling
    ws['!cols'] = [{ wch: 100 }];
    
    return ws;
}

/**
 * Generate a language-specific review sheet
 */
function generateLanguageReviewSheet(
    _appState: AppState,
    translatedWorkbook: any,
    targetLang: string,
    alreadyTranslatedMap?: Map<string, string>,
    originalTranslationValues?: Map<string, string>
): any {
    const exSheet = translatedWorkbook.Sheets["Extracted_Text"];
    if (!exSheet) {
        throw new Error("Translated workbook must contain 'Extracted_Text' sheet");
    }
    
    const exMatrix = XLSX.utils.sheet_to_json(exSheet, { header: 1, raw: false });
    if (exMatrix.length < 3) {
        throw new Error("Extracted_Text sheet is empty");
    }
    
    const headerRow = exMatrix[1] as any[];
    
    // Find column index for target language
    let langColumnIndex = -1;
    for (let c = 4; c < headerRow.length; c++) {
        if (headerRow[c] === targetLang) {
            langColumnIndex = c;
            break;
        }
    }
    
    if (langColumnIndex === -1) {
        throw new Error(`Language ${targetLang} not found in Extracted_Text sheet`);
    }
    
    // Build deduplicated string map
    interface StringData {
        sourceText: string;
        translation: string;
        originalTranslation?: string;
        wasAlreadyTranslated: boolean;
        rowNumbers: number[];
    }
    
    const stringMap = new Map<string, StringData>();
    
    for (let r = 2; r < exMatrix.length; r++) {
        const row = exMatrix[r] as any[];
        if (!row || !row[0]) continue;
        
        const stringId = row[0];
        const originalRow = parseInt(row[1]) || r;
        const sourceText = row[2] || '';
        const translation = row[langColumnIndex] || '';
        
        // Check if this string was already translated (copied from original file)
        const wasAlreadyTranslated = alreadyTranslatedMap?.has(`${stringId}_${targetLang}`) || false;
        const originalTranslation = originalTranslationValues?.get(`${stringId}_${targetLang}`);
        
        if (!stringMap.has(stringId)) {
            stringMap.set(stringId, {
                sourceText,
                translation,
                originalTranslation,
                wasAlreadyTranslated,
                rowNumbers: []
            });
        }
        
        stringMap.get(stringId)!.rowNumbers.push(originalRow);
    }
    
    // Build review sheet rows
    const reviewRows: any[][] = [];
    
    // Header row with clear instructions
    reviewRows.push([
        'ID',
        'Source Text',
        'Translation',
        'Status',
        'Correction',
        'Notes'
    ]);
    
    // Sort by string ID for consistency
    const sortedEntries = Array.from(stringMap.entries()).sort((a, b) => {
        return a[0].localeCompare(b[0]);
    });
    
    // Data rows
    sortedEntries.forEach(([stringId, data]) => {
        // Determine default status
        let defaultStatus = 'Pending';
        let translationDisplay = data.translation;
        
        if (data.wasAlreadyTranslated && data.originalTranslation) {
            // This string was copied from the original file, not translated by API
            defaultStatus = 'Approved';
            translationDisplay = data.originalTranslation; // Show the original copied value
        }
        
        // Build context info (show row numbers if multiple instances)
        const rowInfo = data.rowNumbers.length > 1 
            ? `Rows: ${data.rowNumbers.join(', ')}` 
            : `Row: ${data.rowNumbers[0]}`;
        
        // Main row
        reviewRows.push([
            stringId,
            data.sourceText,
            translationDisplay,
            defaultStatus,
            '', // Empty correction field for client to fill
            rowInfo // Row context in notes
        ]);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(reviewRows);
    
    // Apply styling and protection
    applyReviewSheetStyling(ws, sortedEntries.length);
    
    return ws;
}

/**
 * Generate complete review workbook for client
 */
export function generateReviewWorkbook(
    appState: AppState,
    translatedWorkbook: any,
    translationStats: TranslationStats,
    selectedMethod: string,
    alreadyTranslatedMap?: Map<string, string>
): string {
    if (!translatedWorkbook) {
        throw new Error("No translated workbook provided");
    }
    
    if (!translationStats) {
        throw new Error("No translation statistics provided");
    }
    
    // Get original translation values if available
    const originalTranslationValues = (translatedWorkbook as any)._originalTranslationValues;
    
    // Create new workbook
    const wb = XLSX.utils.book_new();
    
    // Add summary sheet
    const summarySheet = generateSummarySheet(appState, translationStats, selectedMethod);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Review Instructions & Summary");
    
    // Add language review sheets (alphabetically sorted)
    const sortedLanguages = appState.targetLanguagesCKLS.sort((a, b) => a.localeCompare(b));
    
    sortedLanguages.forEach(lang => {
        const reviewSheet = generateLanguageReviewSheet(
            appState, 
            translatedWorkbook, 
            lang, 
            alreadyTranslatedMap,
            originalTranslationValues
        );
        XLSX.utils.book_append_sheet(wb, reviewSheet, `${lang} Review`);
    });
    
    // Generate filename
    const dateStamp = getDateStamp();
    const filename = `ClientReview_${appState.fileTitleSlug}_v1_${dateStamp}.xlsx`;
    
    // Download workbook
    XLSX.writeFile(wb, filename);
    
    return filename;
}

/**
 * Convert TranslationResult to a workbook structure for review file generation
 * This allows review files to be generated after API translations (DeepL/Google)
 */
export function convertTranslationResultToWorkbook(
    translationResult: any,
    targetLanguages: string[],
    originalTranslations?: Record<string, Record<string, string>> | null,
    originalWorkbook?: any
): any {
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // If original workbook is provided, copy the source sheet and populate with translations
    if (originalWorkbook && originalWorkbook.SheetNames && originalWorkbook.Sheets) {
        const sourceSheetName = originalWorkbook.SheetNames.find(
            (name: string) => name !== 'Extracted_Text'
        ) || originalWorkbook.SheetNames[0];
        
        if (sourceSheetName && originalWorkbook.Sheets[sourceSheetName]) {
            console.log(`📄 Copying source sheet: ${sourceSheetName}`);
            
            // Get the source sheet data
            const sourceSheet = originalWorkbook.Sheets[sourceSheetName];
            const sourceMatrix = XLSX.utils.sheet_to_json(sourceSheet, { 
                header: 1, 
                raw: false,
                defval: '' 
            });
            
            // Find language columns in header
            const headerRow = sourceMatrix[0] as any[];
            const langColumns: Record<string, number> = {};
            targetLanguages.forEach(lang => {
                const colIdx = headerRow.indexOf(lang);
                if (colIdx !== -1) {
                    langColumns[lang] = colIdx;
                }
            });
            
            // Create a map of row number to translations
            const rowTranslations: Record<number, Record<string, string>> = {};
            
            // Map translations using the correct data structure
            translationResult.extracted.forEach((item: any) => {
                const rebuiltItem = translationResult.rebuilt.find((r: any) => r.rowIndex === item.rowIndex);
                if (rebuiltItem) {
                    rowTranslations[rebuiltItem.rowIndex] = {};
                    targetLanguages.forEach(lang => {
                        // Access translations correctly: translations[lang][itemId]
                        rowTranslations[rebuiltItem.rowIndex][lang] = 
                            translationResult.translations[lang]?.[item.id] || '';
                    });
                }
            });
            
            // Populate the source sheet with translations
            const populatedMatrix = sourceMatrix.map((row: any[], rowIdx: number) => {
                if (rowIdx === 0) return [...row]; // Keep header
                
                const newRow = [...row];
                const excelRowNumber = rowIdx + 1; // Excel is 1-indexed
                
                // If we have translations for this row, populate them
                if (rowTranslations[excelRowNumber]) {
                    Object.entries(langColumns).forEach(([lang, colIdx]) => {
                        if (rowTranslations[excelRowNumber][lang]) {
                            newRow[colIdx] = rowTranslations[excelRowNumber][lang];
                        }
                    });
                }
                
                return newRow;
            });
            
            // Add the populated source sheet to the workbook
            const populatedSheet = XLSX.utils.aoa_to_sheet(populatedMatrix);
            XLSX.utils.book_append_sheet(wb, populatedSheet, sourceSheetName);
            console.log(`✅ Added source sheet with translations: ${sourceSheetName}`);
        }
    }
    
    // Build Extracted_Text sheet data
    const extractedData: any[][] = [];
    
    // Header rows (row 0 and row 1)
    extractedData.push(['ID', 'Row', 'Source', 'Template', ...targetLanguages]);
    extractedData.push(['ID', 'Row', 'Source', 'Template', ...targetLanguages]);
    
    // Build maps for tracking original translations
    const alreadyTranslatedMap = new Map<string, string>();
    const originalTranslationValues = new Map<string, string>();
    
    // Data rows
    translationResult.extracted.forEach((item: any) => {
        const rebuiltItem = translationResult.rebuilt.find((r: any) => r.rowIndex === item.rowIndex);
        const row = [
            item.id,
            item.rowIndex,
            item.extracted,
            rebuiltItem?.template || '',
            ...targetLanguages.map(lang => {
                const currentTranslation = translationResult.translations[lang]?.[item.id] || '';
                
                // Check if there was an original translation in the source file
                if (originalTranslations && originalTranslations[lang] && originalTranslations[lang][item.id]) {
                    const originalValue = originalTranslations[lang][item.id];
                    
                    // Mark as already translated (copied from original)
                    alreadyTranslatedMap.set(`${item.id}_${lang}`, 'true');
                    originalTranslationValues.set(`${item.id}_${lang}`, originalValue);
                }
                
                return currentTranslation;
            })
        ];
        extractedData.push(row);
    });
    
    // Create sheet
    const extractedSheet = XLSX.utils.aoa_to_sheet(extractedData);
    XLSX.utils.book_append_sheet(wb, extractedSheet, 'Extracted_Text');
    
    // Attach the maps to the workbook for later use in review file generation
    (wb as any)._alreadyTranslatedMap = alreadyTranslatedMap;
    (wb as any)._originalTranslationValues = originalTranslationValues;
    
    // Attach DeepL translation tracking if available
    if ((translationResult as any).deeplTranslatedMap) {
        (wb as any)._deeplTranslatedMap = (translationResult as any).deeplTranslatedMap;
        console.log('✅ Attached DeepL tracking map to workbook:', (translationResult as any).deeplTranslatedMap.size, 'strings tracked');
    }
    
    return wb;
}

/**
 * Generate CSV review file (Option B: Single file with all languages)
 * Each language gets 3 columns: Translation, Status, Correction
 */
export function generateCSVReviewFile(
    appState: AppState,
    translatedWorkbook: any,
    _translationStats: any,
    _selectedMethod: string
): string {
    if (!translatedWorkbook) {
        throw new Error("No translated workbook provided");
    }
    
    // Get DeepL translation tracking map (explicit tracking of what DeepL translated)
    const deeplTranslatedMap = (translatedWorkbook as any)._deeplTranslatedMap as Map<string, Set<string>> | undefined;
    
    console.log('📊 CSV Generation - DeepL Translation Tracking:');
    if (deeplTranslatedMap) {
        console.log(`  ✅ DeepL tracking available: ${deeplTranslatedMap.size} strings tracked`);
        
        // Count translations per language
        const langCounts: Record<string, number> = {};
        deeplTranslatedMap.forEach((languages) => {
            languages.forEach(lang => {
                langCounts[lang] = (langCounts[lang] || 0) + 1;
            });
        });
        console.log('  📈 Per-language counts:', langCounts);
    } else {
        console.warn('  ⚠️ No DeepL tracking map found - review file may be incomplete');
    }
    
    const exSheet = translatedWorkbook.Sheets["Extracted_Text"];
    if (!exSheet) {
        throw new Error("Translated workbook must contain 'Extracted_Text' sheet");
    }
    
    const exMatrix = XLSX.utils.sheet_to_json(exSheet, { header: 1, raw: false });
    if (exMatrix.length < 3) {
        throw new Error("Extracted_Text sheet is empty");
    }
    
    const headerRow = exMatrix[1] as any[];
    const targetLanguages = appState.targetLanguagesCKLS.sort((a, b) => a.localeCompare(b));
    
    // Build language column indices map
    const langColumnIndices: Record<string, number> = {};
    for (let c = 4; c < headerRow.length; c++) {
        const lang = headerRow[c];
        if (targetLanguages.includes(lang)) {
            langColumnIndices[lang] = c;
        }
    }
    
    // Build per-language string data (only DeepL-translated strings)
    interface StringEntry {
        stringId: string;
        sourceText: string;
        translation: string;
        rowNumbers: number[];
    }
    
    const languageData: Record<string, StringEntry[]> = {};
    
    // Initialize language arrays
    targetLanguages.forEach(lang => {
        languageData[lang] = [];
    });
    
    // Track processed strings per language to deduplicate
    const processedPerLang: Record<string, Set<string>> = {};
    targetLanguages.forEach(lang => {
        processedPerLang[lang] = new Set();
    });
    
    for (let r = 2; r < exMatrix.length; r++) {
        const row = exMatrix[r] as any[];
        if (!row || !row[0]) continue;
        
        const stringId = row[0];
        const rowNumber = parseInt(row[1]) || r;
        const sourceText = row[2] || '';
        
        // Process each target language
        targetLanguages.forEach(lang => {
            const colIdx = langColumnIndices[lang];
            const translationText = colIdx !== undefined ? (row[colIdx] || '') : '';
            
            // Include ALL translations (DeepL + pre-existing)
            if (translationText) {
                // Check if we've already added this string for this language
                if (!processedPerLang[lang].has(stringId)) {
                    languageData[lang].push({
                        stringId,
                        sourceText,
                        translation: translationText,
                        rowNumbers: [rowNumber]
                    });
                    processedPerLang[lang].add(stringId);
                } else {
                    // Add row number to existing entry
                    const existing = languageData[lang].find(e => e.stringId === stringId);
                    if (existing) {
                        existing.rowNumbers.push(rowNumber);
                    }
                }
            }
        });
    }
    
    // Log translation counts per language
    targetLanguages.forEach(lang => {
        const count = languageData[lang].length;
        console.log(`✅ ${lang}: ${count} translations included in review file`);
    });
    
    // Generate CSV files
    const dateStamp = getDateStamp();
    const csvFiles: { filename: string; content: string }[] = [];
    
    targetLanguages.forEach(lang => {
        const entries = languageData[lang];
        
        // Skip if no entries for this language (all were pre-existing)
        if (entries.length === 0) {
            console.log(`⚠️ No new translations for ${lang} - skipping review file`);
            return;
        }
        
        const csvLines: string[] = [];
        
        // Add instruction header
        csvLines.push('# CLIENT REVIEW FILE');
        csvLines.push('# Instructions:');
        csvLines.push('#   1. Review each translation below');
        csvLines.push('#   2. If correction needed: fill Correction column');
        csvLines.push('#   3. If correct as-is: leave Correction column empty');
        csvLines.push('#   4. Save and return this CSV with working XML');
        csvLines.push('#');
        csvLines.push(`# Project: ${appState.fileTitleRaw || appState.fileTitleSlug}`);
        csvLines.push(`# Language: ${lang}`);
        csvLines.push(`# File: ${appState.fileTitleRaw}`);
        csvLines.push(`# Date: ${new Date().toISOString().split('T')[0]}`);
        csvLines.push('#');
        
        // Add DNT (Do Not Translate) terms section
        if (appState.doNotTranslate && appState.doNotTranslate.length > 0) {
            csvLines.push('# ═══════════════════════════════════════════════════════════════');
            csvLines.push('# DO NOT TRANSLATE (DNT) - These terms were preserved as-is:');
            csvLines.push('# ───────────────────────────────────────────────────────────────');
            appState.doNotTranslate.forEach(term => {
                csvLines.push(`#   • ${term}`);
            });
            csvLines.push('#');
        }
        
        // Add Glossary section for this language
        if (appState.predefinedTranslations && appState.predefinedTranslations.length > 0) {
            const glossaryForLang = appState.predefinedTranslations.filter(
                entry => entry.translations[lang] || entry.translations[appState.sourceLanguageCKLS]
            );
            
            if (glossaryForLang.length > 0) {
                csvLines.push('# ═══════════════════════════════════════════════════════════════');
                csvLines.push('# GLOSSARY - Predefined translations used:');
                csvLines.push('# ───────────────────────────────────────────────────────────────');
                glossaryForLang.forEach(entry => {
                    const sourceTerm = entry.translations[appState.sourceLanguageCKLS] || Object.values(entry.translations)[0];
                    const targetTerm = entry.translations[lang];
                    if (sourceTerm && targetTerm) {
                        csvLines.push(`#   • "${sourceTerm}" → "${targetTerm}"`);
                    } else if (sourceTerm) {
                        csvLines.push(`#   • "${sourceTerm}" (no ${lang} translation defined)`);
                    }
                });
                csvLines.push('#');
            }
        }
        
        csvLines.push('#');
        
        // Header row
        csvLines.push('ID,Context,Source Text,Translation,Correction,Status');
        
        // Sort entries by string ID
        const sortedEntries = entries.sort((a, b) => a.stringId.localeCompare(b.stringId));
        
        // Data rows
        sortedEntries.forEach(entry => {
            // Context: show row numbers where this string appears
            const context = entry.rowNumbers.length > 1 
                ? `Rows: ${entry.rowNumbers.join(', ')}` 
                : `Row: ${entry.rowNumbers[0]}`;
            
            // Extract clean text from HTML for CSV readability
            const cleanSourceText = entry.sourceText.includes('<') && entry.sourceText.includes('>')
                ? extractTextFromHTML(entry.sourceText).pureText
                : entry.sourceText;

            const cleanTranslation = entry.translation.includes('<') && entry.translation.includes('>')
                ? extractTextFromHTML(entry.translation).pureText
                : entry.translation;
            
            const rowValues = [
                entry.stringId,
                context,
                cleanSourceText,
                cleanTranslation,
                '' // Empty correction field
            ];
            
            csvLines.push(rowValues.map(v => escapeCSV(String(v))).join(','));
        });
        
        const csvContent = 'sep=,\r\n' + csvLines.join('\r\n');
        const filename = `ClientReview_${lang}_${appState.fileTitleSlug}_${dateStamp}_v1.csv`;
        
        csvFiles.push({ filename, content: csvContent });
    });
    
    // Download files
    if (csvFiles.length === 0) {
        console.warn('⚠️ No review files generated - all translations were pre-existing');
        return 'No review files needed';
    } else if (csvFiles.length === 1) {
        // Single language - download CSV directly
        const { filename, content } = csvFiles[0];
        // Add UTF-8 BOM for proper character encoding in Excel and other CSV readers
        const csvWithBOM = '\uFEFF' + content;
        const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
        
        console.log(`✅ CSV review file generated: ${filename}`);
        return filename;
    } else {
        // Multiple languages - create ZIP
        const zip = new JSZip();
        
        csvFiles.forEach(({ filename, content }) => {
            // Add UTF-8 BOM for proper character encoding in Excel and other CSV readers
            const csvWithBOM = '\uFEFF' + content;
            zip.file(filename, csvWithBOM);
        });
        
        const zipFilename = `ClientReview_${appState.fileTitleSlug}_${dateStamp}_v1.zip`;
        
        zip.generateAsync({ type: "blob" }).then((content: Blob) => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = zipFilename;
            link.click();
            URL.revokeObjectURL(link.href);
        });
        
        console.log(`✅ CSV review files packaged: ${zipFilename} (${csvFiles.length} languages)`);
        return zipFilename;
    }
}

/**
 * Generate working XML with placeholders for multi-language review
 * Replaces translations with {{T1-fr}}, {{T1-it}} style placeholders
 */
export function generateWorkingXML(
    appState: AppState,
    translatedWorkbook: any
): string {
    const XLSX = (window as any).XLSX;
    
    if (!translatedWorkbook) {
        throw new Error("No translated workbook provided");
    }
    
    console.log('📝 Generating working XML with placeholders from SOURCE sheet...');
    
    // 1. Get SOURCE sheet (skip Extracted_Text internal sheet)
    const sourceSheetName = translatedWorkbook.SheetNames.find(
        (name: string) => name !== 'Extracted_Text'
    ) || translatedWorkbook.SheetNames[translatedWorkbook.SheetNames.length - 1];
    
    if (sourceSheetName === 'Extracted_Text') {
        throw new Error("Could not find source sheet in workbook. Only Extracted_Text sheet found.");
    }
    
    const sourceSheet = translatedWorkbook.Sheets[sourceSheetName];
    console.log(`  📄 Using source sheet: ${sourceSheetName}`);
    
    const matrix = XLSX.utils.sheet_to_json(sourceSheet, { 
        header: 1, 
        raw: false,
        defval: '' 
    });
    
    console.log(`  📄 Source sheet: ${sourceSheetName}, Rows: ${matrix.length}`);
    
    // 2. Find/Add language columns in header
    const headerRow = matrix[0] as any[];
    const langColumns: Record<string, number> = {};
    const missingLanguages: string[] = [];
    
    // Check which target languages exist in the header
    appState.targetLanguagesCKLS.forEach(lang => {
        const colIdx = headerRow.indexOf(lang);
        if (colIdx !== -1) {
            langColumns[lang] = colIdx;
        } else {
            missingLanguages.push(lang);
        }
    });
    
    // Add missing language columns to the matrix
    if (missingLanguages.length > 0) {
        console.log(`  ➕ Adding missing language columns: ${missingLanguages.join(', ')}`);
        
        missingLanguages.forEach(lang => {
            const newColIdx = headerRow.length;
            langColumns[lang] = newColIdx;
            
            // Add header for new column
            headerRow.push(lang);
            
            // Add empty cells for all data rows
            for (let rowIdx = 1; rowIdx < matrix.length; rowIdx++) {
                const row = matrix[rowIdx] as any[];
                row[newColIdx] = ''; // Empty cell for new language
            }
        });
    }
    
    console.log(`  🌐 Found ${Object.keys(langColumns).length} target language(s): ${Object.keys(langColumns).join(', ')}`);
    Object.entries(langColumns).forEach(([lang, colIdx]) => {
        console.log(`     - ${lang}: Column ${colIdx}`);
    });
    
    // 3. Build row → T-ID mapping from Extracted_Text sheet
    const extractedSheet = translatedWorkbook.Sheets['Extracted_Text'];
    if (!extractedSheet) {
        throw new Error("Missing Extracted_Text sheet in translated workbook");
    }
    
    const extractedMatrix = XLSX.utils.sheet_to_json(extractedSheet, { 
        header: 1, 
        raw: false 
    });
    
    const rowToTID: Record<number, string> = {};
    for (let r = 2; r < extractedMatrix.length; r++) {
        const row = extractedMatrix[r] as any[];
        const tID = row[0];              // Column A: T1, T2, etc.
        const rowNum = parseInt(row[1]); // Column B: original row number
        if (tID && rowNum) {
            rowToTID[rowNum] = tID;
        }
    }
    
    console.log(`  🔢 Mapped ${Object.keys(rowToTID).length} T-IDs to row numbers`);
    
    // Find source language column index
    const sourceColIdx = headerRow.indexOf(appState.sourceLanguageCKLS);
    console.log(`  📌 Source language column (${appState.sourceLanguageCKLS}): ${sourceColIdx}`);
    
    // 4. Extract text with template system
    console.log('  🔧 Using template system for extraction...');
    
    // Build extraction data for rows that have T-IDs
    interface RowData {
        rowIndex: number;
        original: string;
    }
    
    const rowsToExtract: RowData[] = [];
    for (let rowIdx = 1; rowIdx < matrix.length; rowIdx++) {
        const row = matrix[rowIdx] as any[];
        const excelRowNumber = rowIdx + 1;
        const tID = rowToTID[excelRowNumber];
        
        if (tID && sourceColIdx !== -1) {
            const sourceContent = row[sourceColIdx] || '';
            rowsToExtract.push({
                rowIndex: excelRowNumber,
                original: sourceContent
            });
        }
    }
    
    console.log(`  📦 Extracting ${rowsToExtract.length} rows with template system...`);
    
    // Extract with templates (includes DNT support)
    const { extracted, rebuilt } = extractTextAndBuildPlaceholders(
        rowsToExtract,
        appState.doNotTranslate || []
    );
    
    console.log(`  ✅ Extracted ${extracted.length} text segments`);
    console.log(`  ✅ Built ${rebuilt.length} templates`);
    
    // Map extracted IDs to row numbers
    const extractedByRow: Record<number, string[]> = {};
    extracted.forEach(item => {
        if (!extractedByRow[item.rowIndex]) {
            extractedByRow[item.rowIndex] = [];
        }
        extractedByRow[item.rowIndex].push(item.id);
    });
    
    // 5. Replace target language cells with templates containing language-specific placeholders
    let placeholderCount = 0;
    const placeholdersByLang: Record<string, number> = {};
    
    let htmlOnlyCellCount = 0;
    
    const workingMatrix = matrix.map((row: any[], rowIdx: number) => {
        if (rowIdx === 0) return [...row]; // Keep header
        
        const newRow = [...row];
        const excelRowNumber = rowIdx + 1;
        const template = rebuilt.find(r => r.rowIndex === excelRowNumber)?.template;
        
        if (template) {
            // Replace each target language column with language-specific template
            Object.entries(langColumns).forEach(([lang, colIdx]) => {
                const langShort = lang.split('-')[0]; // fr-FR → fr
                
                // Replace {T1} with {{T1-fr}}, {T2} with {{T2-fr}}, etc.
                let langTemplate = template;
                const ids = extractedByRow[excelRowNumber] || [];
                ids.forEach(id => {
                    langTemplate = langTemplate.replace(
                        new RegExp(`\\{${id}\\}`, 'g'),
                        `{{${id}-${langShort}}}`
                    );
                });
                
                newRow[colIdx] = langTemplate;
                placeholderCount++;
                placeholdersByLang[lang] = (placeholdersByLang[lang] || 0) + 1;
            });
        } else {
            // No template = no extractable text
            // Check if source cell has HTML content (HTML-only cells like <iframe>)
            const sourceContent = String(row[sourceColIdx] || '').trim();
            const hasHTML = /<[^>]+>/.test(sourceContent);
            const hasExtractedIDs = extractedByRow[excelRowNumber]?.length > 0;
            
            // If has HTML but no extracted text, copy HTML to all target language columns
            if (hasHTML && !hasExtractedIDs && sourceContent) {
                Object.entries(langColumns).forEach(([_lang, colIdx]) => {
                    newRow[colIdx] = sourceContent;
                });
                htmlOnlyCellCount++;
            }
        }
        
        return newRow;
    });
    
    console.log(`  ✨ Created ${placeholderCount} placeholders total`);
    console.log(`  ✨ Created placeholders by language:`);
    Object.entries(placeholdersByLang).forEach(([lang, count]) => {
        console.log(`     - ${lang}: ${count} placeholders`);
    });
    if (htmlOnlyCellCount > 0) {
        console.log(`  📋 Copied ${htmlOnlyCellCount} HTML-only cells (no translatable text)`);
    }
    
    // 6. Convert to JSON structure (consistent with text mode)
    const templatesByRow: Record<number, string> = {};
    rebuilt.forEach(r => {
        templatesByRow[r.rowIndex] = r.template;
    });
    
    const workingData = {
        type: 'file',
        sourceSheetName: sourceSheetName,
        sourceLanguage: appState.sourceLanguageCKLS,
        targetLanguages: appState.targetLanguagesCKLS,
        matrix: workingMatrix,
        templatesByRow: templatesByRow,
        idsByRow: extractedByRow
    };
    
    console.log(`  📋 Output sheet name: ${sourceSheetName} (preserved from source)`);
    console.log('✅ Working JSON generated successfully');
    
    return JSON.stringify(workingData, null, 2);
}

/**
 * Generate working XML for legacy support
 * @deprecated Use generateWorkingJSON instead
 */
export function generateWorkingXMLLegacy(
    _appState: AppState,
    translatedWorkbook: any
): string {
    const XLSX = (window as any).XLSX;
    
    if (!translatedWorkbook) {
        throw new Error("No translated workbook provided");
    }
    
    console.log('📝 Generating working XML (legacy)...');
    
    // Get SOURCE sheet
    const sourceSheetName = translatedWorkbook.SheetNames.find(
        (name: string) => name !== 'Extracted_Text'
    ) || translatedWorkbook.SheetNames[translatedWorkbook.SheetNames.length - 1];
    
    const sourceSheet = translatedWorkbook.Sheets[sourceSheetName];
    const matrix = XLSX.utils.sheet_to_json(sourceSheet, { 
        header: 1, 
        raw: false,
        defval: '' 
    });
    
    // Convert to XML
    const workingSheet = XLSX.utils.aoa_to_sheet(matrix);
    const workingWB = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workingWB, workingSheet, sourceSheetName);
    
    let xmlString = XLSX.write(workingWB, {
        type: 'string',
        bookType: 'xlml',
        bookSST: false
    });
    
    xmlString = xmlString.replace(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<?xml version="1.0" encoding="UTF-8"?>'
    );
    
    return formatWorkingXML(xmlString);
}

/**
 * Format XML with proper line breaks for readability
 * The XLSX library outputs minified XML, this makes it human-readable
 */
function formatWorkingXML(xml: string): string {
    return xml
        // Add line break after each closing tag
        .replace(/></g, '>\n<')
        // Add indentation for Row elements
        .replace(/(<Row[^>]*>)/g, '\n   $1')
        .replace(/(<\/Row>)/g, '$1\n')
        // Add indentation for Cell elements
        .replace(/(<Cell[^>]*>)/g, '\n    $1')
        // Clean up multiple consecutive newlines
        .replace(/\n\n+/g, '\n')
        // Trim whitespace
        .trim();
}

/**
 * Helper: Generate CSV for single language using extracted segments
 * Includes ALL translations (both pre-existing and newly translated) for easier review
 */
/**
 * Generate XLSX file for a single language review
 * Returns binary data that can be added to ZIP
 */
function generateXLSXForLanguage(
    _appState: AppState,
    translationResult: any,
    targetLang: string,
    translatedWorkbook: any
): Uint8Array {
    const XLSX = (window as any).XLSX;
    
    // Build data rows
    const rows: any[][] = [];
    
    // Header row
    rows.push(['ID', 'Context', 'Source Text', 'Translation', 'Correction', 'Status']);
    
    // Get tracking maps to identify pre-existing translations
    const alreadyTranslatedMap = translatedWorkbook?._alreadyTranslatedMap || new Map();
    
    let newCount = 0;
    let preExistingCount = 0;
    
    // Get the translated workbook matrix and find the target language column
    const sheetName = translatedWorkbook.SheetNames.find((n: string) => !n.startsWith('_'));
    const sheet = translatedWorkbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][];
    const headerRow = matrix[0] || [];
    const targetColIdx = headerRow.findIndex((h: any) => h === targetLang);
    
    // Data rows - include ALL translations (both new and pre-existing)
    if (translationResult && translationResult.extracted) {
        translationResult.extracted.forEach((item: any) => {
            let translation = translationResult.translations?.[targetLang]?.[item.id] || '';
            
            // Check if this was already translated in the original XML
            const wasAlreadyTranslated = alreadyTranslatedMap.has(`${item.id}_${targetLang}`);
            
            // If no new translation but was pre-existing, get from the translated workbook matrix
            if (!translation && wasAlreadyTranslated && targetColIdx >= 0) {
                const rowIdx = item.rowIndex - 1; // rowIndex is 1-based Excel row, matrix is 0-based
                const cellValue = matrix[rowIdx]?.[targetColIdx];
                if (cellValue && typeof cellValue === 'string' && !cellValue.includes('{{')) {
                    // Only use if it's actual content, not a placeholder
                    translation = cellValue;
                }
            }
            
            const status = wasAlreadyTranslated ? 'Pre-existing' : 'New';
            
            // Include ALL translations (both new and pre-existing)
            if (translation) {
                rows.push([
                    item.id,
                    `Row: ${item.rowIndex}`,
                    item.extracted, // Clean text without HTML/DNT
                    translation,
                    '', // Empty correction field
                    status
                ]);
                
                if (wasAlreadyTranslated) {
                    preExistingCount++;
                } else {
                    newCount++;
                }
            }
        });
    }
    
    console.log(`  📊 ${targetLang}: ${newCount} new, ${preExistingCount} pre-existing (${newCount + preExistingCount} total)`);
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Set column widths for better readability
    ws['!cols'] = [
        { wch: 8 },   // ID
        { wch: 12 },  // Context
        { wch: 50 },  // Source Text
        { wch: 50 },  // Translation
        { wch: 50 },  // Correction
        { wch: 12 }   // Status
    ];
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Review');
    
    // Generate binary data
    const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    
    return new Uint8Array(xlsxData);
}

/**
 * Generate README.txt content for review package
 * Contains instructions, DNT terms, and Glossary
 */
function generateReadmeContent(
    appState: AppState,
    targetLanguages: string[]
): string {
    const lines: string[] = [];
    
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('                    TRANSLATION REVIEW PACKAGE');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');
    lines.push(`File: ${appState.fileTitleRaw}`);
    lines.push(`Source Language: ${appState.sourceLanguageCKLS}`);
    lines.push(`Target Languages: ${targetLanguages.join(', ')}`);
    lines.push(`Date: ${new Date().toISOString().split('T')[0]}`);
    lines.push('');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('                        INSTRUCTIONS');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('');
    lines.push('How to review translations:');
    lines.push('');
    lines.push('  1. Open the CSV file for the language you want to review');
    lines.push('  2. Review each translation in the "Translation" column');
    lines.push('  3. If a correction is needed → fill the "Correction" column');
    lines.push('  4. If the translation is correct → leave "Correction" empty');
    lines.push('  5. Save the CSV file');
    lines.push('  6. Return ALL XLSX files + template.json to import corrections');
    lines.push('');
    lines.push('CSV Columns:');
    lines.push('  • ID: Unique identifier for each text segment');
    lines.push('  • Context: Location in the source file (row number)');
    lines.push('  • Source Text: Original text (for reference)');
    lines.push('  • Translation: AI-generated translation');
    lines.push('  • Correction: YOUR CORRECTIONS GO HERE');
    lines.push('  • Status: "New" or "Pre-existing" translation');
    lines.push('');
    
    // Always show DNT section
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('              DO NOT TRANSLATE (DNT) TERMS');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('');
    if (appState.doNotTranslate && appState.doNotTranslate.length > 0) {
        lines.push('The following terms were preserved as-is in all translations:');
        lines.push('');
        appState.doNotTranslate.forEach(term => {
            lines.push(`  • ${term}`);
        });
    } else {
        lines.push('  (No DNT terms were defined for this translation)');
    }
    lines.push('');
    
    // Always show Glossary section
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('                   GLOSSARY / PREDEFINED');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('');
    if (appState.predefinedTranslations && appState.predefinedTranslations.length > 0) {
        lines.push('The following terms used predefined translations:');
        lines.push('');
        
        targetLanguages.forEach(lang => {
            const glossaryForLang = appState.predefinedTranslations!.filter(
                entry => entry.translations[lang] || entry.translations[appState.sourceLanguageCKLS]
            );
            
            if (glossaryForLang.length > 0) {
                lines.push(`[${lang}]`);
                glossaryForLang.forEach(entry => {
                    const sourceTerm = entry.translations[appState.sourceLanguageCKLS] || Object.values(entry.translations)[0];
                    const targetTerm = entry.translations[lang];
                    if (sourceTerm && targetTerm) {
                        lines.push(`  • "${sourceTerm}" → "${targetTerm}"`);
                    } else if (sourceTerm) {
                        lines.push(`  • "${sourceTerm}" (no ${lang} translation)`);
                    }
                });
                lines.push('');
            }
        });
    } else {
        lines.push('  (No glossary terms were defined for this translation)');
        lines.push('');
    }
    
    lines.push('═══════════════════════════════════════════════════════════════');
    
    // Use CRLF for Windows compatibility
    return lines.join('\r\n');
}

/**
 * Generate complete review package as ZIP
 * Contains: XLSX files (one per language) + template.json + README.txt
 */
export async function generateReviewPackageZip(
    appState: AppState,
    translatedWorkbook: any,
    translationResult: any, // Contains extracted array and translations
    _translationStats: any,
    _selectedMethod: string
): Promise<Blob> {
    const JSZip = (window as any).JSZip;
    const zip = new JSZip();
    
    console.log('📦 Generating review package...');
    
    // Generate README.txt with instructions, DNT, and Glossary
    const readmeContent = generateReadmeContent(appState, appState.targetLanguagesCKLS);
    zip.file('README.txt', readmeContent);
    console.log(`  ✅ Added README.txt`);
    
    // Generate per-language XLSX files (native Unicode support, works on Mac & Windows)
    appState.targetLanguagesCKLS.forEach(lang => {
        const xlsxData = generateXLSXForLanguage(
            appState,
            translationResult,
            lang,
            translatedWorkbook
        );
        
        const xlsxFilename = `${lang}.xlsx`;
        zip.file(xlsxFilename, xlsxData);
        console.log(`  ✅ Added ${xlsxFilename}`);
    });
    
    // Generate template JSON (contains matrix and placeholders for reconstruction)
    const templateJSON = generateWorkingXML(appState, translatedWorkbook); // Function now returns JSON
    zip.file('template.json', templateJSON);
    console.log(`  ✅ Added template.json`);
    
    const blob = await zip.generateAsync({ type: 'blob' });
    console.log('✅ Review package ZIP generated successfully');
    
    return blob;
}

/**
 * Generate review package ZIP for text mode translations
 * Contains: CSV files (one per language) + template.json for reconstruction
 */
export async function generateTextReviewPackageZip(
    sourceText: string,
    translations: Record<string, string>,  // {langCode: translatedText}
    contentType: 'json' | 'html' | 'text',
    jsonSchema?: any | null,
    sourceLanguage?: string
): Promise<Blob> {
    const JSZip = (window as any).JSZip;
    const zip = new JSZip();
    
    console.log('📦 Generating text mode review package...');
    console.log(`  Content type: ${contentType}`);
    console.log(`  Languages: ${Object.keys(translations).join(', ')}`);
    
    interface ExtractedSegment {
        id: string;
        text: string;
        path?: string;
    }
    
    let segments: ExtractedSegment[] = [];
    let template: any = null;
    let schemaName: string | null = null;
    let htmlTemplate: string | null = null;
    
    // Extract segments based on content type
    if (contentType === 'json' && jsonSchema) {
        // JSON mode - use extractJsonText to get segments and template
        const { extracted, template: jsonTemplate } = extractJsonText(sourceText, jsonSchema);
        template = jsonTemplate;
        schemaName = jsonSchema.name;
        
        segments = extracted.map((item: any) => ({
            id: item.id,
            text: item.extracted,  // ExtractedItem uses 'extracted' property
            path: item.path
        }));
        
        console.log(`  📋 Extracted ${segments.length} JSON segments`);
    } else {
        // HTML/text mode - use extractTextAndBuildPlaceholders for proper text extraction
        // This handles HTML tags properly and extracts individual text nodes
        const rowData = [{ rowIndex: 0, original: sourceText }];
        const { extracted, rebuilt } = extractTextAndBuildPlaceholders(rowData, []);
        
        // Map extracted items to our segment format
        segments = extracted.map(item => ({
            id: item.id,
            text: item.extracted
        }));
        
        // Store the template for reconstruction
        if (rebuilt.length > 0) {
            htmlTemplate = rebuilt[0].template;
        }
        
        console.log(`  📋 Extracted ${segments.length} text segments from HTML/text`);
    }
    
    // Helper to extract segments from translated HTML/text using the same extraction logic
    const extractTranslatedSegments = (translatedText: string): string[] => {
        const rowData = [{ rowIndex: 0, original: translatedText }];
        const { extracted } = extractTextAndBuildPlaceholders(rowData, []);
        return extracted.map(item => item.extracted);
    };
    
    // Generate README.txt with instructions for text mode
    const readmeLines: string[] = [];
    readmeLines.push('═══════════════════════════════════════════════════════════════');
    readmeLines.push('                    TRANSLATION REVIEW PACKAGE');
    readmeLines.push('═══════════════════════════════════════════════════════════════');
    readmeLines.push('');
    readmeLines.push(`Source Language: ${sourceLanguage || 'unknown'}`);
    readmeLines.push(`Content Type: ${contentType}`);
    readmeLines.push(`Target Languages: ${Object.keys(translations).join(', ')}`);
    readmeLines.push(`Date: ${new Date().toISOString().split('T')[0]}`);
    readmeLines.push('');
    readmeLines.push('───────────────────────────────────────────────────────────────');
    readmeLines.push('                        INSTRUCTIONS');
    readmeLines.push('───────────────────────────────────────────────────────────────');
    readmeLines.push('');
    readmeLines.push('How to review translations:');
    readmeLines.push('');
    readmeLines.push('  1. Open the XLSX file for the language you want to review');
    readmeLines.push('  2. Review each translation in the "Translation" column');
    readmeLines.push('  3. If a correction is needed → fill the "Correction" column');
    readmeLines.push('  4. If the translation is correct → leave "Correction" empty');
    readmeLines.push('  5. Save the XLSX file');
    readmeLines.push('  6. Return ALL XLSX files + template.json to import corrections');
    readmeLines.push('');
    readmeLines.push('Columns:');
    if (contentType === 'json') {
        readmeLines.push('  • ID: Unique identifier for each text segment');
        readmeLines.push('  • Path: JSON path to the text segment');
    } else {
        readmeLines.push('  • ID: Unique identifier for each text segment');
    }
    readmeLines.push('  • Source: Original text (for reference)');
    readmeLines.push('  • Translation: AI-generated translation');
    readmeLines.push('  • Correction: YOUR CORRECTIONS GO HERE');
    readmeLines.push('  • Status: Review status');
    readmeLines.push('');
    readmeLines.push('═══════════════════════════════════════════════════════════════');
    
    zip.file('README.txt', readmeLines.join('\r\n'));
    console.log(`  ✅ Added README.txt`);
    
    // Generate XLSX for each language (native Unicode support, works on Mac & Windows)
    Object.entries(translations).forEach(([langCode, translatedText]) => {
        const rows: any[][] = [];
        
        // Header row
        if (contentType === 'json' && jsonSchema) {
            rows.push(['ID', 'Path', 'Source', 'Translation', 'Correction', 'Status']);
        } else {
            rows.push(['ID', 'Source', 'Translation', 'Correction', 'Status']);
        }
        
        // For JSON mode, we need to parse the translated JSON and extract segments
        if (contentType === 'json' && jsonSchema) {
            try {
                const translatedExtraction = extractJsonText(translatedText, jsonSchema);
                const translatedSegments = translatedExtraction.extracted;
                
                segments.forEach((segment, index) => {
                    const translatedSegment = translatedSegments[index];
                    const translation = translatedSegment ? translatedSegment.extracted : '';
                    
                    rows.push([
                        segment.id,
                        segment.path || '',
                        segment.text,
                        translation,
                        '', // Correction (empty)
                        'REVIEW'
                    ]);
                });
            } catch (error) {
                console.warn(`  ⚠️ Failed to parse translated JSON for ${langCode}:`, error);
                // Fallback: just use the raw translated text
                segments.forEach(segment => {
                    rows.push([
                        segment.id,
                        segment.path || '',
                        segment.text,
                        '', // No translation available
                        '',
                        'REVIEW'
                    ]);
                });
            }
        } else {
            // Text mode - extract segments from translated HTML/text
            const translatedSegments = extractTranslatedSegments(translatedText);
            
            segments.forEach((segment, index) => {
                const translation = translatedSegments[index] || '';
                
                rows.push([
                    segment.id,
                    segment.text,
                    translation,
                    '', // Correction (empty)
                    'REVIEW'
                ]);
            });
        }
        
        // Create XLSX workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);
        
        // Set column widths
        if (contentType === 'json') {
            ws['!cols'] = [
                { wch: 8 },   // ID
                { wch: 30 },  // Path
                { wch: 50 },  // Source
                { wch: 50 },  // Translation
                { wch: 50 },  // Correction
                { wch: 12 }   // Status
            ];
        } else {
            ws['!cols'] = [
                { wch: 8 },   // ID
                { wch: 50 },  // Source
                { wch: 50 },  // Translation
                { wch: 50 },  // Correction
                { wch: 12 }   // Status
            ];
        }
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Review');
        
        const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const xlsxFilename = `${langCode}.xlsx`;
        zip.file(xlsxFilename, new Uint8Array(xlsxData));
        console.log(`  ✅ Added ${xlsxFilename}`);
    });
    
    // Build translations map per language (for reconstruction fallback)
    const translationsMap: Record<string, Record<string, string>> = {};
    
    Object.entries(translations).forEach(([langCode, translatedText]) => {
        translationsMap[langCode] = {};
        
        if (contentType === 'json' && jsonSchema) {
            try {
                const translatedExtraction = extractJsonText(translatedText, jsonSchema);
                translatedExtraction.extracted.forEach((item: any, index: number) => {
                    if (segments[index]) {
                        translationsMap[langCode][segments[index].id] = item.extracted;
                    }
                });
            } catch (e) {
                console.warn(`  ⚠️ Failed to extract translations for ${langCode}`);
            }
        } else {
            // HTML/text mode
            const translatedSegments = extractTranslatedSegments(translatedText);
            segments.forEach((segment, index) => {
                translationsMap[langCode][segment.id] = translatedSegments[index] || '';
            });
        }
    });
    
    // Generate working_text.json
    let workingData: any;
    
    if (contentType === 'json' && jsonSchema) {
        workingData = {
            type: 'json',
            schemaName: schemaName,
            sourceLanguage: sourceLanguage || 'unknown',
            template: template,
            extracted: segments,
            translations: translationsMap  // Store translations per language
        };
    } else {
        // HTML/text mode - include template with placeholders for reconstruction
        workingData = {
            type: contentType === 'html' ? 'html' : 'text',
            sourceLanguage: sourceLanguage || 'unknown',
            sourceText: sourceText,
            template: htmlTemplate,  // Template with {T1}, {T2}, etc. placeholders
            segments: segments,
            translations: translationsMap  // Store translations per language
        };
    }
    
    const templateFilename = 'template.json';
    zip.file(templateFilename, JSON.stringify(workingData, null, 2));
    console.log(`  ✅ Added ${templateFilename}`);
    
    const blob = await zip.generateAsync({ type: 'blob' });
    console.log('✅ Text review package ZIP generated successfully');
    
    return blob;
}

