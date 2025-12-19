import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle2, AlertCircle, FileText, Languages, X, Download } from 'lucide-react';
import { rebuildFromTemplates } from '@/modules/translationEngine';
import { rebuildJsonFromTemplate } from '@/utils/jsonTextExtraction';

interface CorrectionEntry {
    sourceText: string;
    translation: string;
    correction: string;
}

type CorrectionMap = Record<string, CorrectionEntry>; // T-ID -> entry

// Working file types
type WorkingFileType = 'xml' | 'json-text' | 'json-json' | 'json-file' | null;

interface TextWorkingData {
    type: 'text' | 'html';
    sourceLanguage: string;
    sourceText: string;
    template?: string;  // Template with {T1}, {T2} placeholders for HTML reconstruction
    segments: Array<{ id: string; text: string }>;
    translations?: Record<string, Record<string, string>>;  // Per-language translations {langCode: {segmentId: translation}}
}

interface JsonWorkingData {
    type: 'json';
    schemaName: string;
    sourceLanguage: string;
    template: any;
    extracted: Array<{ id: string; text: string; path?: string }>;
    translations?: Record<string, Record<string, string>>;  // Per-language translations {langCode: {segmentId: translation}}
}

interface FileWorkingData {
    type: 'file';
    sourceSheetName: string;
    sourceLanguage: string;
    targetLanguages: string[];
    matrix: any[][];
    templatesByRow: Record<number, string>;
    idsByRow: Record<number, string[]>;
}

export function ImportCorrectionsSimple() {
    const [workingXML, setWorkingXML] = useState<string>('');
    const [workingXMLFileName, setWorkingXMLFileName] = useState<string>('');
    const [workingFileType, setWorkingFileType] = useState<WorkingFileType>(null);
    const [textWorkingData, setTextWorkingData] = useState<TextWorkingData | JsonWorkingData | null>(null);
    const [fileWorkingData, setFileWorkingData] = useState<FileWorkingData | null>(null);
    const [csvFiles, setCsvFiles] = useState<Record<string, CorrectionMap>>({});
    const [csvFileNames, setCsvFileNames] = useState<Record<string, string>>({});
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isDraggingXML, setIsDraggingXML] = useState(false);
    const [isDraggingCSV, setIsDraggingCSV] = useState(false);
    
    const xmlInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);
    
    // Handle working file upload (XML or JSON)
    const handleWorkingFileUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            
            if (file.name.endsWith('.json')) {
                // JSON working file (text, json, or file mode)
                try {
                    const data = JSON.parse(content);
                    if (data.type === 'json') {
                        setWorkingFileType('json-json');
                        setTextWorkingData(data as JsonWorkingData);
                        setFileWorkingData(null);
                    } else if (data.type === 'text' || data.type === 'html') {
                        setWorkingFileType('json-text');
                        setTextWorkingData(data as TextWorkingData);
                        setFileWorkingData(null);
                    } else if (data.type === 'file') {
                        // File mode JSON template (new format)
                        setWorkingFileType('json-file');
                        setFileWorkingData(data as FileWorkingData);
                        setTextWorkingData(null);
                    } else {
                        setError('Invalid working file format');
                        return;
                    }
                    setWorkingXML(''); // Clear XML
                    setWorkingXMLFileName(file.name);
                    setError('');
                } catch (e) {
                    setError('Failed to parse JSON working file');
                }
            } else {
                // XML mode working file (legacy support)
                setWorkingFileType('xml');
                setWorkingXML(content);
                setTextWorkingData(null);
                setFileWorkingData(null);
                setWorkingXMLFileName(file.name);
                setError('');
            }
        };
        reader.readAsText(file);
    };
    
    
    // Handle XLSX/CSV upload (multiple files supported)
    const handleReviewFileUpload = (files: FileList) => {
        let filesProcessed = 0;
        const newCsvFiles: Record<string, CorrectionMap> = { ...csvFiles };
        const newCsvFileNames: Record<string, string> = { ...csvFileNames };
        
        Array.from(files).forEach(file => {
            const isXLSX = file.name.endsWith('.xlsx');
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    let parsed: { language: string; corrections: CorrectionMap };
                    
                    if (isXLSX) {
                        // Parse XLSX file
                        const data = new Uint8Array(event.target?.result as ArrayBuffer);
                        parsed = parseXLSX(data, file.name);
                    } else {
                        // Parse CSV file (legacy support)
                        const csvText = event.target?.result as string;
                        parsed = parseCSV(csvText, file.name);
                    }
                    
                    newCsvFiles[parsed.language] = parsed.corrections;
                    newCsvFileNames[parsed.language] = file.name;
                    
                    filesProcessed++;
                    if (filesProcessed === files.length) {
                        setCsvFiles(newCsvFiles);
                        setCsvFileNames(newCsvFileNames);
                        setError('');
                    }
                } catch (err) {
                    setError(`Failed to parse ${file.name}: ${(err as Error).message}`);
                }
            };
            
            if (isXLSX) {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file);
            }
        });
    };
    
    // Parse XLSX file and extract corrections
    const parseXLSX = (data: Uint8Array, filename: string): { language: string; corrections: CorrectionMap } => {
        const XLSX = (window as any).XLSX;
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Extract language from filename (e.g., "fr-FR.xlsx" -> "fr-FR")
        const filenameMatch = filename.match(/^([a-z]{2}-[A-Z]{2})\.xlsx$/);
        if (!filenameMatch) {
            throw new Error('Could not extract language from filename. Expected format: fr-FR.xlsx');
        }
        const language = filenameMatch[1];
        
        // Get first sheet (should be "Review")
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        if (rows.length < 2) {
            throw new Error('XLSX file is empty or has no data rows');
        }
        
        const corrections: CorrectionMap = {};
        const header = rows[0];
        
        // Detect column indices
        const idCol = header.findIndex((h: string) => h === 'ID');
        const sourceCol = header.findIndex((h: string) => h === 'Source' || h === 'Source Text');
        const translationCol = header.findIndex((h: string) => h === 'Translation');
        const correctionCol = header.findIndex((h: string) => h === 'Correction');
        
        // Check if we have the required columns
        if (idCol === -1 || sourceCol === -1) {
            throw new Error('XLSX file missing required columns (ID, Source)');
        }
        
        // Parse data rows
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            
            const id = String(row[idCol] || '').trim();
            const sourceText = String(row[sourceCol] || '').trim();
            const translation = translationCol >= 0 ? String(row[translationCol] || '').trim() : '';
            const correction = correctionCol >= 0 ? String(row[correctionCol] || '').trim() : '';
            
            if (id && sourceText) {
                corrections[id] = {
                    sourceText,
                    translation,
                    correction
                };
            }
        }
        
        console.log(`  📄 Parsed ${Object.keys(corrections).length} corrections for ${language} from XLSX`);
        
        return { language, corrections };
    };
    
    // Parse CSV and extract corrections
    const parseCSV = (csvText: string, filename: string): { language: string; corrections: CorrectionMap } => {
        const lines = csvText.split('\n');
        let language = '';
        const corrections: CorrectionMap = {};
        let hasPathColumn = false;  // Detect if CSV has Path column (JSON mode vs text mode)
        
        // Extract language from filename (e.g., "fr-FR.csv" -> "fr-FR")
        // Supports both new format (fr-FR.csv) and old format (ClientReview_fr-FR_*.csv)
        const filenameMatch = filename.match(/^([a-z]{2}-[A-Z]{2})\.csv$/) || 
                              filename.match(/ClientReview_([a-z]{2}-[A-Z]{2})_/);
        if (filenameMatch) {
            language = filenameMatch[1];
        }
        
        for (const line of lines) {
            // Extract language from header (legacy support for old CSVs)
            if (line.startsWith('# Language:')) {
                // Strip any trailing commas that may have been added by Excel/CSV editors
                language = line.replace('# Language:', '').trim().split(',')[0];
                continue;
            }
            
            // Detect CSV format from header row
            if (line.startsWith('ID,')) {
                // Check if header has Path or Context column (6 columns) or not (5 columns)
                // 6-column: ID,Path/Context,Source,Translation,Correction,Status
                // 5-column: ID,Source,Translation,Correction,Status
                hasPathColumn = line.includes('Path') || line.includes('Context');
                continue;
            }
            
            // Skip comments, empty lines, and Excel separator declaration
            if (line.startsWith('#') || line.startsWith('sep=') || !line.trim()) {
                continue;
            }
            
            // Parse data row based on detected format
            const parts = parseCSVLine(line);
            
            let id: string, sourceText: string, translation: string, correction: string;
            
            if (hasPathColumn && parts.length >= 6) {
                // 6-column format: ID, Path, Source, Translation, Correction, Status
                [id, , sourceText, translation, correction] = parts;
            } else if (parts.length >= 5) {
                // 5-column format: ID, Source, Translation, Correction, Status
                [id, sourceText, translation, correction] = parts;
            } else {
                continue; // Skip malformed rows
            }
            
            if (id && sourceText) {
                corrections[id] = {
                    sourceText,
                    translation: translation || '',
                    correction: correction || ''
                };
            }
        }
        
        if (!language) {
            throw new Error('Could not find language in CSV header');
        }
        
        console.log(`  📄 Parsed ${Object.keys(corrections).length} corrections for ${language}`);
        
        return { language, corrections };
    };
    
    // Simple CSV line parser (handles quoted fields)
    const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        
        return result.map(s => s.trim());
    };
    
    // Remove CSV file
    const removeCSVFile = (lang: string) => {
        const newCsvFiles = { ...csvFiles };
        const newCsvFileNames = { ...csvFileNames };
        delete newCsvFiles[lang];
        delete newCsvFileNames[lang];
        setCsvFiles(newCsvFiles);
        setCsvFileNames(newCsvFileNames);
    };
    
    // Drag and drop handlers for XML
    const handleXMLDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingXML(true);
    };
    
    const handleXMLDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingXML(false);
    };
    
    const handleXMLDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingXML(false);
        const files = e.dataTransfer.files;
        if (files.length > 0 && (files[0].name.endsWith('.xml') || files[0].name.endsWith('.json'))) {
            handleWorkingFileUpload(files[0]);
        }
    };
    
    // Drag and drop handlers for CSV
    const handleCSVDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingCSV(true);
    };
    
    const handleCSVDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingCSV(false);
    };
    
    const handleCSVDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingCSV(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleReviewFileUpload(files);
        }
    };
    
    // Apply text mode corrections and download final files
    const applyTextCorrections = () => {
        if (!textWorkingData) {
            setError('Please upload template file first');
            return;
        }
        
        if (Object.keys(csvFiles).length === 0) {
            setError('Please upload at least one review file (XLSX)');
            return;
        }
        
        try {
            console.log(`🔄 Applying text mode corrections from ${Object.keys(csvFiles).length} language(s):`);
            
            const JSZip = (window as any).JSZip;
            const zip = new JSZip();
            
            if (textWorkingData.type === 'json') {
                // JSON mode - rebuild using template
                const jsonData = textWorkingData as JsonWorkingData;
                
                Object.entries(csvFiles).forEach(([lang, corrections]) => {
                    // Get stored translations for this language (fallback if segment not in CSV)
                    const storedTranslations = jsonData.translations?.[lang] || {};
                    
                    // Build translations map from corrections, with fallback to stored translations
                    const translations: Record<string, string> = {};
                    
                    // First, populate with stored translations
                    Object.entries(storedTranslations).forEach(([id, text]) => {
                        translations[id] = text;
                    });
                    
                    // Then, override with CSV corrections/translations
                    Object.entries(corrections).forEach(([id, entry]) => {
                        // Use correction if provided, otherwise use translation from CSV
                        translations[id] = entry.correction || entry.translation || translations[id];
                    });
                    
                    // Rebuild JSON using template
                    const rebuiltJson = rebuildJsonFromTemplate(
                        jsonData.template,
                        translations,
                        lang  // Use language code as locale
                    );
                    
                    const filename = `${jsonData.schemaName.replace(/\s+/g, '_')}_${lang}.json`;
                    zip.file(filename, rebuiltJson);
                    console.log(`  ✅ Generated ${filename}`);
                });
            } else {
                // Text/HTML mode - rebuild using template or direct segment replacement
                const textData = textWorkingData as TextWorkingData;
                
                Object.entries(csvFiles).forEach(([lang, corrections]) => {
                    let correctedText: string;
                    
                    // Get stored translations for this language (fallback if segment not in CSV)
                    const storedTranslations = textData.translations?.[lang] || {};
                    
                    if (textData.template) {
                        // Use template with placeholders for proper HTML reconstruction
                        correctedText = textData.template;
                        textData.segments.forEach(segment => {
                            const correction = corrections[segment.id];
                            // Priority: 1) CSV correction, 2) CSV translation, 3) stored translation, 4) source text
                            const replacementText = correction 
                                ? (correction.correction || correction.translation || storedTranslations[segment.id] || segment.text)
                                : (storedTranslations[segment.id] || segment.text);
                            
                            // Replace placeholder {T1}, {T2}, etc. with corrected text
                            correctedText = correctedText.replace(`{${segment.id}}`, replacementText);
                        });
                    } else {
                        // Fallback: join segments (for backwards compatibility)
                        const correctedSegments = textData.segments.map(segment => {
                            const correction = corrections[segment.id];
                            if (correction) {
                                return correction.correction || correction.translation || storedTranslations[segment.id] || segment.text;
                            }
                            return storedTranslations[segment.id] || segment.text;
                        });
                        correctedText = correctedSegments.join('\n\n');
                    }
                    
                    // Use language code as filename
                    const filename = `${lang}.txt`;
                    zip.file(filename, correctedText);
                    console.log(`  ✅ Generated ${filename}`);
                });
            }
            
            // Download ZIP
            zip.generateAsync({ type: 'blob' }).then((blob: Blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                const timestamp = Math.floor(Date.now() / 1000);
                const langs = Object.keys(csvFiles).sort().join('_');
                link.download = `text_${langs}_${timestamp}.zip`;
                link.click();
                URL.revokeObjectURL(url);
            });
            
            setStatus(`✅ Success! Applied corrections to ${Object.keys(csvFiles).length} language(s)`);
            setError('');
        } catch (err) {
            setError('Error applying text corrections: ' + (err as Error).message);
            console.error('Error details:', err);
        }
    };

    // Apply corrections and download final XML (for XML mode)
    const applyXMLCorrections = () => {
        if (!workingXML) {
            setError('Please upload template file first');
            return;
        }
        
        if (Object.keys(csvFiles).length === 0) {
            setError('Please upload at least one review file (XLSX)');
            return;
        }
        
        try {
            console.log(`🔄 Applying corrections from ${Object.keys(csvFiles).length} language(s):`);
            Object.keys(csvFiles).forEach(lang => {
                const count = Object.keys(csvFiles[lang]).length;
                console.log(`   - ${lang}: ${count} corrections`);
            });
            
            // Parse working XML as workbook
            const XLSX = (window as any).XLSX;
            const workbook = XLSX.read(workingXML, { type: 'string' });
            
            // Load source sheet (not hidden sheets)
            const sourceSheetName = workbook.SheetNames.find(
                (n: string) => !n.startsWith('_')
            );
            
            if (!sourceSheetName) {
                throw new Error('Could not find source sheet in working XML');
            }
            
            const sourceSheet = workbook.Sheets[sourceSheetName];
            const matrix = XLSX.utils.sheet_to_json(sourceSheet, { 
                header: 1, 
                raw: false 
            });
            
            console.log(`  📄 Source sheet: ${sourceSheetName}`);
            
            // Load templates from _Templates sheet
            const templatesSheet = workbook.Sheets['_Templates'];
            if (!templatesSheet) {
                throw new Error('Missing _Templates sheet in template file. Please regenerate the review package.');
            }
            
            const templatesMatrix = XLSX.utils.sheet_to_json(templatesSheet, {
                header: 1,
                raw: false
            });
            
            const templatesByRow: Record<number, string> = {};
            for (let i = 1; i < templatesMatrix.length; i++) {
                const row = templatesMatrix[i] as any[];
                const rowNum = parseInt(row[0]);
                const template = row[1];
                if (rowNum && template) {
                    templatesByRow[rowNum] = template;
                }
            }
            
            console.log(`  📋 Loaded ${Object.keys(templatesByRow).length} templates`);
            
            // Load extracted IDs from _ExtractedIDs sheet
            const idsSheet = workbook.Sheets['_ExtractedIDs'];
            if (!idsSheet) {
                throw new Error('Missing _ExtractedIDs sheet in template file. Please regenerate the review package.');
            }
            
            const idsMatrix = XLSX.utils.sheet_to_json(idsSheet, {
                header: 1,
                raw: false
            });
            
            const idsByRow: Record<number, string[]> = {};
            for (let i = 1; i < idsMatrix.length; i++) {
                const row = idsMatrix[i] as any[];
                const rowNum = parseInt(row[0]);
                const idsStr = row[1];
                if (rowNum && idsStr) {
                    idsByRow[rowNum] = idsStr.split(',');
                }
            }
            
            console.log(`  🔢 Loaded ${Object.keys(idsByRow).length} ID mappings`);
            
            // Build translations object from CSV corrections
            const translationsByLang: Record<string, Record<string, string>> = {};
            Object.entries(csvFiles).forEach(([lang, corrections]) => {
                translationsByLang[lang] = {};
                Object.entries(corrections).forEach(([id, entry]) => {
                    // Use correction if provided, otherwise use translation
                    translationsByLang[lang][id] = entry.correction || entry.translation;
                });
            });
            
            // Build langCols array
            const headerRow = matrix[0] as any[];
            const langCols = Object.keys(translationsByLang).map(lang => ({
                key: lang,
                colIndex: headerRow.indexOf(lang)
            }));
            
            // Build existingLanguagesModes to force overwriting of existing columns
            // Normalize language codes to match what rebuildFromTemplates expects (lowercase)
            const existingLanguagesModes: Record<string, 'keep' | 'fill-empty' | 'overwrite-all'> = {};
            Object.keys(translationsByLang).forEach(lang => {
                // Normalize: fr-FR -> fr-fr, it-IT -> it-it
                const normalizedLang = lang.toLowerCase();
                existingLanguagesModes[normalizedLang] = 'overwrite-all';
            });
            
            console.log(`  🌐 Rebuilding with ${langCols.length} language(s)...`);
            console.log(`  🔧 Existing language modes:`, existingLanguagesModes);
            
            // Rebuild using template system
            const { finalMatrix } = rebuildFromTemplates(
                templatesByRow,
                idsByRow,
                translationsByLang,
                langCols,
                matrix,
                {}, // targetMapping (not needed for review)
                [], // existingLanguages (not needed)
                'overwrite-all', // Always overwrite with corrections
                existingLanguagesModes // Force overwrite mode for all languages
            );
            
            console.log('  ✅ Templates rebuilt successfully');
            
            // Convert back to XML
            const finalSheet = XLSX.utils.aoa_to_sheet(finalMatrix);
            const finalWB = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(finalWB, finalSheet, sourceSheetName);
            
            let xmlString = XLSX.write(finalWB, {
                type: 'string',
                bookType: 'xlml'
            });
            
            // Clean up XML declaration
            xmlString = xmlString.replace(
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
                '<?xml version="1.0" encoding="UTF-8"?>'
            );
            
            // Download with descriptive filename: {title}_{languages}_{timestamp}.xml
            const blob = new Blob([xmlString], { type: 'application/xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            // Build filename with languages
            const timestamp = Math.floor(Date.now() / 1000);
            const langs = Object.keys(csvFiles).sort().join('_');
            const baseTitle = workingXMLFileName.replace(/\.(xml|json)$/i, '').replace(/^template[_.]?/i, '') || 'translation';
            const cleanTitle = baseTitle || 'translation';
            link.download = `${cleanTitle}_${langs}_${timestamp}.xml`;
            link.click();
            URL.revokeObjectURL(url);
            
            setStatus(`✅ Success! Applied corrections to ${Object.keys(csvFiles).length} language(s)`);
            setError('');
        } catch (err) {
            setError('Error applying corrections: ' + (err as Error).message);
            console.error('Error details:', err);
        }
    };
    
    // Apply corrections for JSON file mode (new format)
    const applyFileJSONCorrections = () => {
        if (!fileWorkingData) {
            setError('Please upload template file first');
            return;
        }
        
        if (Object.keys(csvFiles).length === 0) {
            setError('Please upload at least one review file (XLSX)');
            return;
        }
        
        try {
            console.log(`🔄 Applying corrections from ${Object.keys(csvFiles).length} language(s) (JSON file mode):`);
            Object.keys(csvFiles).forEach(lang => {
                const count = Object.keys(csvFiles[lang]).length;
                console.log(`   - ${lang}: ${count} corrections`);
            });
            
            const XLSX = (window as any).XLSX;
            
            // Data is already parsed from JSON
            const { sourceSheetName, matrix, templatesByRow, idsByRow } = fileWorkingData;
            
            console.log(`  📄 Source sheet: ${sourceSheetName}`);
            console.log(`  📋 Templates: ${Object.keys(templatesByRow).length}`);
            console.log(`  🔢 ID mappings: ${Object.keys(idsByRow).length}`);
            
            // Build translations object from XLSX corrections
            const translationsByLang: Record<string, Record<string, string>> = {};
            Object.entries(csvFiles).forEach(([lang, corrections]) => {
                translationsByLang[lang] = {};
                Object.entries(corrections).forEach(([id, entry]) => {
                    // Use correction if provided, otherwise use translation
                    translationsByLang[lang][id] = entry.correction || entry.translation;
                });
            });
            
            // Build langCols array
            const headerRow = matrix[0] as any[];
            const langCols = Object.keys(translationsByLang).map(lang => ({
                key: lang,
                colIndex: headerRow.indexOf(lang)
            }));
            
            // Build existingLanguagesModes to force overwriting of existing columns
            const existingLanguagesModes: Record<string, 'keep' | 'fill-empty' | 'overwrite-all'> = {};
            Object.keys(translationsByLang).forEach(lang => {
                const normalizedLang = lang.toLowerCase();
                existingLanguagesModes[normalizedLang] = 'overwrite-all';
            });
            
            console.log(`  🌐 Rebuilding with ${langCols.length} language(s)...`);
            
            // Rebuild using template system
            const { finalMatrix } = rebuildFromTemplates(
                templatesByRow,
                idsByRow,
                translationsByLang,
                langCols,
                matrix,
                {}, // targetMapping (not needed for review)
                [], // existingLanguages (not needed)
                'overwrite-all',
                existingLanguagesModes
            );
            
            console.log('  ✅ Templates rebuilt successfully');
            
            // Convert to XML output
            const finalSheet = XLSX.utils.aoa_to_sheet(finalMatrix);
            const finalWB = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(finalWB, finalSheet, sourceSheetName);
            
            let xmlString = XLSX.write(finalWB, {
                type: 'string',
                bookType: 'xlml'
            });
            
            // Clean up XML declaration
            xmlString = xmlString.replace(
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
                '<?xml version="1.0" encoding="UTF-8"?>'
            );
            
            // Download with descriptive filename
            const blob = new Blob([xmlString], { type: 'application/xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            const timestamp = Math.floor(Date.now() / 1000);
            const langs = Object.keys(csvFiles).sort().join('_');
            const baseTitle = workingXMLFileName.replace(/\.(xml|json)$/i, '').replace(/^template[_.]?/i, '') || 'translation';
            const cleanTitle = baseTitle || 'translation';
            link.download = `${cleanTitle}_${langs}_${timestamp}.xml`;
            link.click();
            URL.revokeObjectURL(url);
            
            setStatus(`✅ Success! Applied corrections to ${Object.keys(csvFiles).length} language(s)`);
            setError('');
        } catch (err) {
            setError('Error applying corrections: ' + (err as Error).message);
            console.error('Error details:', err);
        }
    };

    // Unified apply corrections handler
    const applyCorrections = () => {
        if (workingFileType === 'json-text' || workingFileType === 'json-json') {
            applyTextCorrections();
        } else if (workingFileType === 'xml') {
            applyXMLCorrections();
        } else if (workingFileType === 'json-file') {
            applyFileJSONCorrections();
        } else {
            setError('Please upload a template file first');
        }
    };
    
    const totalStrings = Object.values(csvFiles)
        .reduce((sum, map) => sum + Object.keys(map).length, 0);
    const totalCorrections = Object.values(csvFiles)
        .reduce((sum, map) => sum + Object.values(map).filter(e => e.correction).length, 0);
    
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
                    <Languages className="w-6 h-6 text-primary" />
                    Review Translation
                </h2>
                <p className="text-muted-foreground">
                    Import reviewed translations and apply corrections to generate the final output
                </p>
            </div>
            
            {/* Two-column dropzone layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Template File Dropzone */}
                <Card className="border-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                1
                            </div>
                            Template File
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* Dropzone */}
                        <div
                            onDragOver={handleXMLDragOver}
                            onDragLeave={handleXMLDragLeave}
                            onDrop={handleXMLDrop}
                            onClick={() => xmlInputRef.current?.click()}
                            className={`
                                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                                transition-all duration-200
                                ${isDraggingXML 
                                    ? 'border-primary bg-primary/10 scale-[1.02]' 
                                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                                }
                            `}
                        >
                            <FileText className={`w-12 h-12 mx-auto mb-3 ${isDraggingXML ? 'text-primary' : 'text-muted-foreground'}`} />
                            <p className="text-sm font-medium mb-1">
                                {isDraggingXML ? 'Drop template here' : 'Drop template file here'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                or click to browse
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                                template.xml or template.json from the Review ZIP
                            </p>
                        </div>
                        
                        <input
                            ref={xmlInputRef}
                            type="file"
                            accept=".xml,.json"
                            onChange={(e) => e.target.files?.[0] && handleWorkingFileUpload(e.target.files[0])}
                            className="hidden"
                        />
                        
                        {/* Display uploaded file */}
                        {(workingXML || textWorkingData || fileWorkingData) && (
                            <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-green-900 dark:text-green-100 truncate">
                                        {workingXMLFileName}
                                    </p>
                                    <p className="text-xs text-green-700 dark:text-green-300">
                                        {workingFileType === 'xml' ? 'Template ready (XML - legacy)' : 
                                         workingFileType === 'json-file' ? 'Template ready (File mode)' :
                                         workingFileType === 'json-json' ? 'Template ready (JSON)' : 
                                         workingFileType === 'json-text' && textWorkingData?.type === 'html' ? 'Template ready (HTML)' :
                                         workingFileType === 'json-text' ? 'Template ready (Text)' : 'Template loaded'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                
                {/* Right: Review Files Dropzone */}
                <Card className="border-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                2
                            </div>
                            Review Files (XLSX)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* Dropzone */}
                        <div
                            onDragOver={handleCSVDragOver}
                            onDragLeave={handleCSVDragLeave}
                            onDrop={handleCSVDrop}
                            onClick={() => csvInputRef.current?.click()}
                            className={`
                                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                                transition-all duration-200
                                ${isDraggingCSV 
                                    ? 'border-primary bg-primary/10 scale-[1.02]' 
                                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                                }
                            `}
                        >
                            <Upload className={`w-12 h-12 mx-auto mb-3 ${isDraggingCSV ? 'text-primary' : 'text-muted-foreground'}`} />
                            <p className="text-sm font-medium mb-1">
                                {isDraggingCSV ? 'Drop XLSX files here' : 'Drop XLSX files here'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                (Multiple files supported)
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                                One file per language (fr-FR.xlsx, it-IT.xlsx...)
                            </p>
                        </div>
                        
                        <input
                            ref={csvInputRef}
                            type="file"
                            accept=".xlsx,.csv"
                            multiple
                            onChange={(e) => e.target.files && handleReviewFileUpload(e.target.files)}
                            className="hidden"
                        />
                        
                        {/* Display uploaded CSV files */}
                        {Object.keys(csvFiles).length > 0 && (
                            <div className="space-y-2">
                                {Object.entries(csvFiles).map(([lang, corrections]) => (
                                    <div 
                                        key={lang}
                                        className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border"
                                    >
                                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="font-mono text-xs">
                                                    {lang}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {Object.keys(corrections).length} strings
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {csvFileNames[lang]}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeCSVFile(lang);
                                            }}
                                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            {/* Summary Stats */}
            {Object.keys(csvFiles).length > 0 && (
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
                    <div className="flex-1">
                        <p className="text-sm font-medium">Ready to apply</p>
                        <p className="text-xs text-muted-foreground">
                            {Object.keys(csvFiles).length} language{Object.keys(csvFiles).length > 1 ? 's' : ''} • {totalStrings} total strings • {totalCorrections} with corrections
                        </p>
                    </div>
                </div>
            )}
            
            {/* Error */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
            )}
            
            {/* Success Status */}
            {status && (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-900 dark:text-green-100">Success</AlertTitle>
                    <AlertDescription className="text-green-800 dark:text-green-200">
                        {status}
                    </AlertDescription>
                </Alert>
            )}
            
            {/* Apply button */}
            <Button
                onClick={applyCorrections}
                disabled={(!workingXML && !textWorkingData && !fileWorkingData) || Object.keys(csvFiles).length === 0}
                className="w-full"
                size="lg"
            >
                <Download className="mr-2 h-5 w-5" />
                Apply Corrections & Download
            </Button>
            
            {/* Help Card */}
            <Card className="bg-muted/30 border-muted">
                <CardContent className="pt-6">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs">💡</span>
                        </div>
                        How it works
                    </h3>
                    <ol className="text-xs text-muted-foreground space-y-2 ml-7">
                        <li className="flex gap-2">
                            <span className="font-semibold text-foreground">1.</span>
                            <span>After translating, export the Review Package (ZIP)</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-semibold text-foreground">2.</span>
                            <span>Share the XLSX files with your client for review</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-semibold text-foreground">3.</span>
                            <span>Upload template file + corrected XLSX files here</span>
                        </li>
                    </ol>
                    
                    <div className="mt-4 pt-4 border-t border-muted">
                        <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
                            <span>📝</span>
                            How to edit review files
                        </h4>
                        <div className="text-xs text-muted-foreground space-y-2">
                            <p>Open the XLSX in Excel, Google Sheets, or any spreadsheet app:</p>
                            <div className="bg-muted rounded-md p-2 font-mono text-[10px] overflow-x-auto">
                                <div className="grid grid-cols-5 gap-2 text-center border-b border-muted-foreground/20 pb-1 mb-1">
                                    <span className="font-semibold">ID</span>
                                    <span className="font-semibold">Source</span>
                                    <span className="font-semibold">Translation</span>
                                    <span className="font-semibold text-primary">Correction</span>
                                    <span className="font-semibold">Status</span>
                                </div>
                                <div className="grid grid-cols-5 gap-2 text-center">
                                    <span>T1</span>
                                    <span>Hello</span>
                                    <span>Bonjour</span>
                                    <span className="text-primary">Salut</span>
                                    <span>New</span>
                                </div>
                            </div>
                            <p className="mt-2">
                                <span className="font-medium text-foreground">→ Fill the "Correction" column</span> with your fixes. Leave empty if correct.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
