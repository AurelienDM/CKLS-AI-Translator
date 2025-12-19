import { escapeRegex } from './fileHelpers';
import { GlossaryEntry } from '@/types';

interface RowData {
    rowIndex: number;
    original: string;
}

interface ExtractedItem {
    id: string;
    rowIndex: number;
    extracted: string;
}

interface RebuiltItem {
    rowIndex: number;
    template: string;
}

/**
 * Detect curly brace placeholders in text
 * Matches patterns like {training_name}, {url}, {00|Job Title}, etc.
 */
function detectCurlyBracePlaceholders(text: string): string[] {
    const pattern = /\{[^}]+\}/g;
    const matches = text.match(pattern);
    return matches || [];
}

/**
 * Extract text from rows and build placeholders for translation
 */
export function extractTextAndBuildPlaceholders(
    rows: RowData[], 
    dntTerms: string[] = []
): { extracted: ExtractedItem[]; rebuilt: RebuiltItem[] } {
    let idCount = 1;
    const extracted: ExtractedItem[] = [];
    const rebuilt: RebuiltItem[] = [];

    for (const row of rows) {
        const text = row.original || "";
        const isHTML = /<\/?[a-z][\s\S]*>/i.test(text);

        // ENHANCED: Auto-detect curly brace placeholders and add to DNT terms
        const detectedPlaceholders = detectCurlyBracePlaceholders(text);
        const allDntTerms = [...dntTerms, ...detectedPlaceholders];

        // Deduplicate DNT terms (case-insensitive) to prevent nested markers
        // Keep the first occurrence of each unique term (case-insensitive)
        const uniqueDntTerms: string[] = [];
        const seenLowercase = new Set<string>();
        allDntTerms.forEach(term => {
            if (!term) return;
            const lowerTerm = term.toLowerCase();
            if (!seenLowercase.has(lowerTerm)) {
                seenLowercase.add(lowerTerm);
                uniqueDntTerms.push(term);
            }
        });

        // Non-HTML cells (plain text) with DNT support
        if (!isHTML) {
            let working = text;

            // Temporarily mark Do-Not-Translate terms (including auto-detected placeholders)
            uniqueDntTerms.forEach(term => {
                if (!term) return;
                const re = new RegExp(escapeRegex(term), "gi");
                working = working.replace(re, match => `<<<__DNT__${match}__>>>`);
            });

            // Text to translate = everything except the DNT markers
            const toTranslate = working
                .replace(/<<<__DNT__.*?__>>>/g, "")
                .trim();

            // Nothing left to translate => keep as-is
            if (!toTranslate) {
                rebuilt.push({ rowIndex: row.rowIndex, template: text });
                continue;
            }

            const id = `T${idCount++}`;
            extracted.push({
                id,
                rowIndex: row.rowIndex,
                extracted: toTranslate
            });

            // Replace only the first occurrence of the translatable chunk with the placeholder
            let placeholdered = working.replace(toTranslate, `{${id}}`);

            // Restore DNT markers back to their original literal text
            placeholdered = placeholdered.replace(/<<<__DNT__(.*?)__>>>/g, "$1");

            rebuilt.push({
                rowIndex: row.rowIndex,
                template: placeholdered
            });

            continue;
        }

        // HTML cells (entity-safe + DNT support)
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "text/html");

            const textNodes: Text[] = [];
            (function walk(node: Node) {
                if (node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.trim()) {
                    textNodes.push(node as Text);
                }
                node.childNodes && node.childNodes.forEach(walk);
            })(doc.body);

            if (!textNodes.length) {
                // Nothing to translate in this HTML cell
                rebuilt.push({ rowIndex: row.rowIndex, template: text });
                continue;
            }

            textNodes.forEach(node => {
                const original = node.nodeValue || "";

                // Split the node text into pieces of: "text" (potentially translatable) or "dnt" (Do-Not-Translate parts)
                let pieces: Array<{ type: string; value: string }> = [{ type: "text", value: original }];

                // Use uniqueDntTerms to prevent nested markers from case-insensitive duplicates
                uniqueDntTerms.forEach(term => {
                    if (!term) return;
                    const regex = new RegExp(escapeRegex(term), "gi");
                    const newPieces: Array<{ type: string; value: string }> = [];

                    pieces.forEach(piece => {
                        if (piece.type !== "text") {
                            newPieces.push(piece);
                            return;
                        }

                        let lastIndex = 0;
                        let match;

                        while ((match = regex.exec(piece.value)) !== null) {
                            if (match.index > lastIndex) {
                                newPieces.push({
                                    type: "text",
                                    value: piece.value.substring(lastIndex, match.index)
                                });
                            }
                            newPieces.push({
                                type: "dnt",
                                value: match[0]
                            });
                            lastIndex = regex.lastIndex;
                        }

                        if (lastIndex < piece.value.length) {
                            newPieces.push({
                                type: "text",
                                value: piece.value.substring(lastIndex)
                            });
                        }
                    });

                    pieces = newPieces;
                });

                // Build the final content for this text node
                let finalNodeText = "";

                pieces.forEach(piece => {
                    const value = piece.value || "";

                    if (piece.type === "dnt") {
                        finalNodeText += value;
                    } else {
                        if (value.trim()) {
                            const cleaned = value.trim();
                            const id = `T${idCount++}`;

                            extracted.push({
                                id,
                                rowIndex: row.rowIndex,
                                extracted: cleaned
                            });

                            // Preserve leading and trailing whitespace in the template
                            const leadingSpace = value.match(/^\s*/)?.[0] || '';
                            const trailingSpace = value.match(/\s*$/)?.[0] || '';
                            finalNodeText += leadingSpace + `{${id}}` + trailingSpace;
                        } else {
                            finalNodeText += value;
                        }
                    }
                });

                node.nodeValue = finalNodeText;
            });

            const template = doc.body.innerHTML;
            rebuilt.push({
                rowIndex: row.rowIndex,
                template: template || text
            });

        } catch (e) {
            rebuilt.push({
                rowIndex: row.rowIndex,
                template: text
            });
        }
    }

    return { extracted, rebuilt };
}

/**
 * Find predefined translation for source text in specific target language
 * @param srcText - The source text to match
 * @param sourceLang - The source language CKLS code from Step 1
 * @param targetLang - The target language CKLS code
 * @param glossary - Array of glossary entries
 */
export function findPredefinedTranslation(
    srcText: string,
    sourceLang: string,
    targetLang: string,
    glossary: GlossaryEntry[] = []
): string | null {
    const text = (srcText || "").trim();
    if (!text) return null;

    for (const entry of glossary) {
        // Check if the entry has the source language
        const entrySourceText = entry.translations[sourceLang];
        if (entrySourceText && entrySourceText.trim() === text) {
            // Return the translation for the target language
            return entry.translations[targetLang] || null;
        }
    }
    return null;
}

/**
 * Enhanced glossary matching result
 */
export interface GlossarySubstitution {
    processedText: string; // Text with glossary terms replaced by placeholders
    substitutions: Record<string, string>; // Map of placeholder to translation
    hasSubstitutions: boolean;
}

/**
 * Apply glossary substitutions to source text before translation
 * Handles full text matches, multi-word phrases, and individual words
 * Multi-word phrases are prioritized over single words
 * 
 * @param srcText - The source text to process
 * @param sourceLang - The source language CKLS code
 * @param targetLang - The target language CKLS code
 * @param glossary - Array of glossary entries
 * @returns GlossarySubstitution with processed text and substitution map
 */
export function applyGlossarySubstitutions(
    srcText: string,
    sourceLang: string,
    targetLang: string,
    glossary: GlossaryEntry[] = []
): GlossarySubstitution {
    const text = (srcText || "").trim();
    
    if (!text || glossary.length === 0) {
        return {
            processedText: text,
            substitutions: {},
            hasSubstitutions: false
        };
    }

    // 1. Try full text match first (fastest, most accurate)
    const fullMatch = findPredefinedTranslation(text, sourceLang, targetLang, glossary);
    if (fullMatch) {
        return {
            processedText: "__GLOSSARY_FULL__",
            substitutions: { "__GLOSSARY_FULL__": fullMatch },
            hasSubstitutions: true
        };
    }

    // 2. Build a list of glossary terms sorted by length (longest first)
    // This ensures multi-word phrases are matched before individual words
    const glossaryTerms: Array<{ source: string; target: string; length: number }> = [];
    
    for (const entry of glossary) {
        const sourceText = entry.translations[sourceLang];
        const targetText = entry.translations[targetLang];
        
        if (sourceText && targetText) {
            glossaryTerms.push({
                source: sourceText.trim(),
                target: targetText.trim(),
                length: sourceText.trim().length
            });
        }
    }
    
    // Sort by length (longest first) to match phrases before individual words
    glossaryTerms.sort((a, b) => b.length - a.length);
    
    // 3. Find and replace glossary terms with placeholders
    let processedText = text;
    const substitutions: Record<string, string> = {};
    let placeholderCount = 0;
    
    for (const term of glossaryTerms) {
        // Create a regex that matches the term as a whole word/phrase
        // Use word boundaries for single words, but not for phrases
        const isMultiWord = term.source.includes(' ');
        const escapedTerm = escapeRegex(term.source);
        
        // For multi-word: match anywhere
        // For single word: match with word boundaries
        // Case-sensitive matching as per user preference
        const pattern = isMultiWord 
            ? new RegExp(`${escapedTerm}`, 'g')
            : new RegExp(`\\b${escapedTerm}\\b`, 'g');
        
        // Check if this term exists in the text
        if (pattern.test(processedText)) {
            const placeholder = `__GLOSS_${placeholderCount}__`;
            
            // Reset regex lastIndex before replacing
            pattern.lastIndex = 0;
            processedText = processedText.replace(pattern, placeholder);
            substitutions[placeholder] = term.target;
            placeholderCount++;
        }
    }
    
    return {
        processedText,
        substitutions,
        hasSubstitutions: Object.keys(substitutions).length > 0
    };
}

/**
 * Restore glossary substitutions after translation
 * Replaces placeholders with actual glossary translations
 * 
 * @param translatedText - The translated text containing placeholders
 * @param substitutions - Map of placeholder to translation
 * @returns Final text with glossary translations restored
 */
export function restoreGlossarySubstitutions(
    translatedText: string,
    substitutions: Record<string, string>
): string {
    let result = translatedText;
    
    for (const [placeholder, translation] of Object.entries(substitutions)) {
        // Replace all occurrences of the placeholder
        result = result.replace(new RegExp(escapeRegex(placeholder), 'g'), translation);
    }
    
    return result;
}

