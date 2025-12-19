import { extractTextAndBuildPlaceholders, findPredefinedTranslation } from '@/utils/textExtraction';

/**
 * Extract text and build placeholders for translation
 * Re-exports the utility function for convenience
 */
export { extractTextAndBuildPlaceholders, findPredefinedTranslation };

/**
 * Build translation formula for Excel
 * @param cellRef - Cell reference (e.g., "C3")
 * @param sourceLang - Source language code
 * @param targetLang - Target language code
 * @param useCopilot - Use COPILOT formula instead of TRANSLATE
 * @param langName - Language name (for COPILOT)
 * @param customInstructions - Custom translation instructions
 * @returns Formula object for XLSX
 */
export function buildTranslationFormula(
    cellRef: string,
    sourceLang: string,
    targetLang: string,
    useCopilot: boolean = false,
    langName: string = "",
    customInstructions: string = ""
): { f: string; t?: string } {
    if (useCopilot) {
        // Build the instruction prompt
        let prompt = `Translate this text to ${langName}.`;
        
        if (customInstructions) {
            // Add custom instructions
            prompt += ` ${customInstructions}`;
        } else {
            // Default: keep similar character count (existing behavior)
            prompt += ` Keep the meaning but try to keep the same number of characters as the source (" & LEN(${cellRef}) & " characters). If impossible, keep it within +/- 10%.`;
        }
        
        const formula = `COPILOT(${cellRef}, "${prompt}")`;
        return { f: formula };
    } else {
        const formula = `TRANSLATE(${cellRef},"${sourceLang}","${targetLang}")`;
        return { f: formula, t: "n" };
    }
}

/**
 * Rebuild HTML from templates and translations
 * @param templatesByRow - Templates indexed by row number
 * @param idsByRow - IDs indexed by row number
 * @param translationsByLang - Translations indexed by language, then by ID
 * @param langCols - Array of {key, colIndex} objects
 * @param originalMatrix - Original matrix from workbook
 * @param targetMapping - MS code to CKLS code mapping
 * @param existingLanguages - Existing languages for auto-mapping
 * @param overwriteMode - 'overwrite' | 'replace-empty' | 'complete' (default: 'replace-empty')
 * @returns Object with final matrix and statistics
 */
export function rebuildFromTemplates(
    templatesByRow: Record<number, string>,
    idsByRow: Record<number, string[]>,
    translationsByLang: Record<string, Record<string, string>>,
    langCols: Array<{ key: string; colIndex: number }>,
    originalMatrix: any[][],
    targetMapping: Record<string, string>,
    _existingLanguages: string[],
    overwriteMode: string = 'replace-empty',
    existingLanguagesModes?: Record<string, 'keep' | 'fill-empty' | 'overwrite-all'>
): {
    finalMatrix: any[][];
    stats: {
        sourceCopiedRows: number;
        sourceColumnIndex: number;
        copiedRowDetails: Array<{
            rowNumber: number;
            excelRow: number;
            language: string;
            reason: string;
            content: string;
        }>;
    };
} {
    const finalMatrix = originalMatrix.map(r => r ? r.slice() : []);
    const headerOrig = finalMatrix[0];
    
    // Track source content copying
    let sourceCopiedRowsCount = 0;
    const sourceColIndex = 3; // Column D (default)
    const copiedRowDetails: Array<{
        rowNumber: number;
        excelRow: number;
        language: string;
        reason: string;
        content: string;
    }> = [];
    
    // Debug: Log what modes were received
    console.log('🎯 rebuildFromTemplates called with:');
    console.log('  - existingLanguagesModes:', existingLanguagesModes);
    console.log('  - global overwriteMode:', overwriteMode);
    
    // Map to track which columns already exist
    const existingColIndexes: Record<string, number> = {}; // {cklsCode: columnIndex}
    
    // Scan existing columns to find matching languages
    for (let colIdx = 0; colIdx < headerOrig.length; colIdx++) {
        const headerValue = headerOrig[colIdx];
        if (headerValue && typeof headerValue === 'string') {
            // Extract CKLS code from header (e.g., "en-GB", "FR-FR", etc.)
            const match = headerValue.match(/\b([a-z]{2}-[A-Z]{2})\b/i);
            if (match) {
                const normalizedCode = normalizeCklsCode(match[1]);
                existingColIndexes[normalizedCode] = colIdx;
            }
        }
    }
    
    // Process each target language
    langCols.forEach(({ key, colIndex }) => {
        // Skip if this language has no translations
        // This prevents corrupting columns that weren't translated
        if (!translationsByLang[key] || Object.keys(translationsByLang[key]).length === 0) {
            console.log(`⏭️  Skipping ${key} - no translations provided`);
            return;
        }
        
        const cklsCode = targetMapping[key] || key;
        const normalizedCkls = normalizeCklsCode(cklsCode);
        
        // Use explicitly provided colIndex only if it's a valid positive column number (> 0)
        // colIndex of 0 or -1 means "not set" or "invalid", so fall back to auto-detection
        const explicitColIdx = colIndex !== undefined && colIndex > 0 ? colIndex : undefined;
        const autoDetectedColIdx = existingColIndexes[normalizedCkls];
        const existingColIdx = explicitColIdx !== undefined ? explicitColIdx : autoDetectedColIdx;
        
        let targetColIdx: number;
        const isExistingLanguage = existingColIdx !== undefined;
        
        if (isExistingLanguage) {
            // Language column exists
            targetColIdx = existingColIdx;
            const mode = existingLanguagesModes?.[normalizedCkls] || 'not set';
            const detectionMethod = explicitColIdx !== undefined ? 'explicit colIndex' : 'auto-detected';
            console.log(`🔍 Language ${cklsCode} (normalized: ${normalizedCkls}) exists at column ${existingColIdx} (${detectionMethod})`);
            console.log(`   Mode for this language: ${mode}`);
        } else {
            // Add new column
            targetColIdx = headerOrig.length;
            headerOrig.push(cklsCode);
            console.log(`✨ Adding new language column: ${cklsCode}`);
        }
        
        // Fill in translated content for each row
        for (let r = 1; r < finalMatrix.length; r++) {
            const excelRow = r + 1;
            const ids = idsByRow[excelRow] || [];
            const baseTemplate = templatesByRow[excelRow];
            
            // Handle rows with no template (no translatable text extracted)
            if (!baseTemplate) {
                const sourceContent = originalMatrix[r]?.[sourceColIndex];
                const fieldType = originalMatrix[r]?.[2]; // Column C = Field type
                const currentTargetContent = finalMatrix[r][targetColIdx];
                const isTargetEmpty = !currentTargetContent || String(currentTargetContent).trim() === '';
                
                // Check if this is a URL field - URLs should always be copied to all languages
                const isUrlField = fieldType && String(fieldType).toUpperCase() === 'URL';
                
                let shouldCopySource = false;
                let copyReason = '';
                
                if (isUrlField && sourceContent) {
                    // Always copy URLs regardless of mode - URLs don't need translation
                    shouldCopySource = true;
                    copyReason = 'URL field - no translation needed';
                    console.log(`🔗 Row ${excelRow}, ${cklsCode}: Copying URL (${String(sourceContent).substring(0, 80)}...)`);
                } else if (isExistingLanguage) {
                    const languageMode = existingLanguagesModes?.[normalizedCkls];
                    
                    if (languageMode === 'fill-empty' && isTargetEmpty && sourceContent) {
                        shouldCopySource = true;
                        copyReason = 'fill-empty mode, target was empty';
                        sourceCopiedRowsCount++;
                        console.log(`📋 Row ${excelRow}, ${cklsCode}: Copying source content (no translatable text, fill-empty mode)`);
                    } else if (languageMode === 'overwrite-all' && sourceContent) {
                        shouldCopySource = true;
                        copyReason = 'overwrite-all mode';
                        sourceCopiedRowsCount++;
                        console.log(`📋 Row ${excelRow}, ${cklsCode}: Copying source content (no translatable text, overwrite-all mode)`);
                    }
                } else {
                    if (isTargetEmpty && sourceContent) {
                        shouldCopySource = true;
                        copyReason = 'new language column, target was empty';
                        sourceCopiedRowsCount++;
                        console.log(`📋 Row ${excelRow}, ${cklsCode}: Copying source content to new column (no translatable text)`);
                    } else {
                        finalMatrix[r][targetColIdx] = "";
                    }
                }
                
                if (shouldCopySource) {
                    finalMatrix[r][targetColIdx] = sourceContent;
                    
                    // Track detailed information
                    copiedRowDetails.push({
                        rowNumber: r,
                        excelRow: excelRow,
                        language: cklsCode,
                        reason: copyReason,
                        content: String(sourceContent).substring(0, 100)
                    });
                }
                
                continue;
            }
            
            // Build the new translated HTML
            let newTranslatedHtml = baseTemplate;
            
            // Special case: If template has no placeholders but we have IDs with translations,
            // this means the row had pre-existing content and the correction should replace it entirely
            const templateHasPlaceholders = ids.some(id => baseTemplate.includes(`{${id}}`));
            
            if (!templateHasPlaceholders && ids.length > 0) {
                // Template has no placeholders - use the first translation directly as the cell content
                // This handles cases where pre-existing content needs to be corrected
                const firstId = ids[0];
                const directTranslation = translationsByLang[key]?.[firstId];
                if (directTranslation) {
                    newTranslatedHtml = directTranslation;
                    console.log(`🔄 Row ${excelRow}, ${key}: Direct replacement (no placeholders) - using ${firstId}: "${directTranslation.substring(0, 50)}..."`);
                }
            } else {
                // Normal case: Replace placeholders with translations
                ids.forEach(id => {
                    // Use optional chaining - translations may not exist for languages set to "keep"
                    const translated = translationsByLang[key]?.[id] || "";
                    newTranslatedHtml = newTranslatedHtml.replace(`{${id}}`, translated);
                });
            }
            
            // Clean up any remaining DNT markers from the final output
            // These markers (<<<__DNT__term__>>>) should be replaced with just the term
            // Handle both complete markers and incomplete/malformed ones
            newTranslatedHtml = newTranslatedHtml.replace(/<<<__DNT__(.*?)(?:__>>>|$)/g, "$1");
            
            // Check what's currently in the cell
            const existingValue = finalMatrix[r][targetColIdx];
            
            // Decision logic
            let shouldWrite = true;
            
            if (existingValue) {
                const trimmedValue = String(existingValue).trim();
                
                if (trimmedValue === "") {
                    // Empty cell → always fill
                    shouldWrite = true;
                }
                else if (isTranslationFormula(trimmedValue)) {
                    // Cell has a formula (=TRANSLATE or =COPILOT)
                    // → Always replace with actual HTML content
                    // Formulas are NOT final translations, they're placeholders
                    shouldWrite = true;
                }
                else {
                    // Cell has actual translated content (real HTML/text)
                    // → Check overwrite mode (per-language if available, otherwise global)
                    const languageMode = existingLanguagesModes?.[normalizedCkls];
                    
                    if (languageMode) {
                        // Use per-language setting
                        if (languageMode === 'keep') {
                            shouldWrite = false;
                            console.log(`Row ${r}, ${cklsCode}: Keeping existing translation (per-language: keep)`);
                        } else if (languageMode === 'fill-empty') {
                            // Already has content, so don't overwrite
                            shouldWrite = false;
                            console.log(`Row ${r}, ${cklsCode}: Preserving existing translation (per-language: fill-empty)`);
                        } else if (languageMode === 'overwrite-all') {
                            shouldWrite = true;
                            console.log(`Row ${r}, ${cklsCode}: Overwriting existing translation (per-language: overwrite-all)`);
                        }
                    } else {
                        // Use global overwrite mode (legacy)
                        if (overwriteMode === 'replace-empty') {
                            shouldWrite = false;
                            console.log(`Row ${r}, ${cklsCode}: Preserving existing translation (global: replace-empty)`);
                        } else if (overwriteMode === 'overwrite') {
                            shouldWrite = true;
                            console.log(`Row ${r}, ${cklsCode}: Overwriting existing translation (global: overwrite)`);
                        }
                    }
                }
            }
            
            // Write if appropriate
            if (shouldWrite) {
                finalMatrix[r][targetColIdx] = newTranslatedHtml;
            }
        }
    });
    
    // Log summary of all copied rows
    if (copiedRowDetails.length > 0) {
        console.log('\n📋 ═══════════════════════════════════════════════════════');
        console.log('📋 SOURCE CONTENT COPIED (No Translatable Text Found)');
        console.log('📋 ═══════════════════════════════════════════════════════');
        console.log(`📋 Total rows with source content copied: ${sourceCopiedRowsCount}`);
        console.log(`📋 Total copy operations: ${copiedRowDetails.length}\n`);
        
        // Group by row for cleaner display
        const byRow = new Map<number, typeof copiedRowDetails>();
        copiedRowDetails.forEach(detail => {
            if (!byRow.has(detail.excelRow)) {
                byRow.set(detail.excelRow, []);
            }
            byRow.get(detail.excelRow)!.push(detail);
        });
        
        // Log each row with all its language copies
        byRow.forEach((details, excelRow) => {
            console.log(`📋 Row ${excelRow}:`);
            details.forEach(detail => {
                const preview = detail.content.length > 80 
                    ? detail.content.substring(0, 77) + '...'
                    : detail.content;
                console.log(`   └─ ${detail.language}: "${preview}"`);
                console.log(`      Reason: ${detail.reason}`);
            });
            console.log('');
        });
        
        const sortedRows = Array.from(new Set(copiedRowDetails.map(d => d.excelRow))).sort((a, b) => a - b);
        console.log(`📋 Affected Excel Rows: ${sortedRows.join(', ')}`);
        console.log('📋 ═══════════════════════════════════════════════════════\n');
    }
    
    return {
        finalMatrix,
        stats: {
            sourceCopiedRows: sourceCopiedRowsCount,
            sourceColumnIndex: sourceColIndex,
            copiedRowDetails: copiedRowDetails
        }
    };
}

/**
 * Normalize CKLS code to lowercase-uppercase format (e.g., "EN-GB" -> "en-GB")
 * @private
 */
function normalizeCklsCode(code: string): string {
    if (!code || typeof code !== 'string') return '';
    const parts = code.split('-');
    if (parts.length !== 2) return code.toLowerCase();
    return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
}

/**
 * Check if a cell value is a translation formula
 * These should always be replaced with actual content, regardless of overwrite mode
 * 
 * Examples that return true:
 *   - "=TRANSLATE(C3,"en","fr")"
 *   - "=COPILOT(C3, "Translate to French")"
 *   - "TRANSLATE(C3,"en","fr")" (without = prefix)
 * 
 * Examples that return false:
 *   - "<p>Bonjour le monde</p>" (actual translated HTML)
 *   - "Hello world" (actual text)
 *   - "" (empty)
 *   - null (empty)
 */
function isTranslationFormula(value: any): boolean {
    if (!value || typeof value !== 'string') return false;
    
    const str = value.trim();
    
    // Check for Excel formulas starting with =
    if (str.startsWith('=TRANSLATE(') || str.startsWith('=COPILOT(')) {
        return true;
    }
    
    // Check for formula text without = (sometimes Excel strips the = when reading)
    if (str.startsWith('TRANSLATE(') || str.startsWith('COPILOT(')) {
        return true;
    }
    
    return false;
}

/**
 * Filter rows to skip those that already have content in fill-empty mode
 * @param rows - All rows to potentially translate
 * @param originalMatrix - Original workbook matrix
 * @param targetLangs - Target language CKLS codes
 * @param existingColIndexes - Map of CKLS codes to column indices
 * @param languageModes - Per-language overwrite modes
 * @returns Object with filtered rows and skip count
 */
export function filterRowsForFillMode(
    rows: any[],
    originalMatrix: any[][],
    targetLangs: string[],
    existingColIndexes: Record<string, number>,
    languageModes: Record<string, 'keep' | 'fill-empty' | 'overwrite-all'>
): { rowsToTranslate: any[], skippedCount: number } {
    const rowsToTranslate: any[] = [];
    let skippedCount = 0;
    
    for (const row of rows) {
        let needsTranslation = false;
        
        // Check each target language
        for (const targetLang of targetLangs) {
            const normalizedLang = normalizeCklsCode(targetLang);
            const mode = languageModes[normalizedLang];
            const colIdx = existingColIndexes[normalizedLang];
            
            // If language doesn't exist yet, or mode is not fill-empty, need translation
            if (!colIdx || mode !== 'fill-empty') {
                needsTranslation = true;
                break;
            }
            
            // Check if cell is empty or has a formula (formulas should be replaced)
            const cellValue = originalMatrix[row.rowIndex] && originalMatrix[row.rowIndex][colIdx];
            const isEmpty = !cellValue || String(cellValue).trim() === '';
            const hasFormula = isTranslationFormula(cellValue);
            
            if (isEmpty || hasFormula) {
                needsTranslation = true;
                break;
            }
        }
        
        if (needsTranslation) {
            rowsToTranslate.push(row);
        } else {
            skippedCount++;
        }
    }
    
    return { rowsToTranslate, skippedCount };
}

