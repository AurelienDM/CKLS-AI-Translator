/**
 * Text Handler
 * Processes plain text input for translation (email, text content, etc.)
 */

import { JSON_SCHEMAS } from '@/utils/jsonSchemas';
import type { JsonSchema as JsonSchemaType } from '@/utils/jsonSchemas';
import { detectJsonSchema, extractJsonText } from '@/utils/jsonTextExtraction';

interface ProcessedTextData {
  sourceText: string;
  wordCount: number;
  charCount: number;
  cleanedText: string;
  contentType: 'html' | 'json' | 'plain';
  jsonSchema?: JsonSchemaType | null;
  jsonExtraction?: any;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
 * Process text input and prepare for translation
 * @param text - Raw text input
 * @param doNotTranslate - Terms to preserve
 * @returns Processed text data
 */
export function processTextInput(
  text: string,
  doNotTranslate: string[] = []
): ProcessedTextData {
  const sourceText = text.trim();
  
  if (!sourceText) {
    throw new Error('Please enter some text to translate');
  }

  // Auto-detect curly brace placeholders
  const detectedPlaceholders = detectCurlyBracePlaceholders(sourceText);
  const allDntTerms = [...doNotTranslate, ...detectedPlaceholders];

  // Detect content type
  let contentType: 'html' | 'json' | 'plain' = 'plain';
  let jsonSchema: JsonSchemaType | null = null;
  let jsonExtraction: any = null;
  
  console.log('📝 processTextInput called');
  console.log('Source text length:', sourceText.length);
  
  // Check for JSON first
  const detectedSchema = detectJsonSchema(sourceText, JSON_SCHEMAS);
  console.log('Detected schema:', detectedSchema);
  
  if (detectedSchema) {
    console.log('✅ JSON schema detected:', detectedSchema.name);
    contentType = 'json';
    jsonSchema = detectedSchema;
    try {
      jsonExtraction = extractJsonText(sourceText, detectedSchema);
      console.log('✅ JSON extraction succeeded. Extracted items:', jsonExtraction.extracted.length);
    } catch (error) {
      console.error('❌ JSON extraction failed:', error);
      // Fall back to plain text if extraction fails
      contentType = 'plain';
    }
  } else if (/<\/?[a-z][\s\S]*>/i.test(sourceText)) {
    // Check for HTML
    console.log('📄 Detected as HTML');
    contentType = 'html';
  } else {
    console.log('📝 Detected as plain text');
  }
  
  console.log('Final contentType:', contentType);

  // Calculate stats
  const wordCount = sourceText.split(/\s+/).filter(w => w.length > 0).length;
  const charCount = sourceText.length;

  // Clean text (preserve DNT terms) - only for non-JSON content
  let cleanedText = sourceText;
  
  if (contentType !== 'json') {
    // Mark DNT terms for preservation during translation (including auto-detected placeholders)
    const dntMarkers: Array<{ marker: string; original: string }> = [];
    allDntTerms.forEach((term, index) => {
      if (term.trim()) {
        const marker = `__DNT_${index}__`;
        const regex = new RegExp(escapeRegex(term), 'gi');
        cleanedText = cleanedText.replace(regex, (match) => {
          dntMarkers.push({ marker, original: match });
          return marker;
        });
      }
    });
  }

  return {
    sourceText,
    wordCount,
    charCount,
    cleanedText,
    contentType,
    jsonSchema,
    jsonExtraction,
  };
}

/**
 * Restore DNT markers back to original terms
 * @param translatedText - Text with DNT markers
 * @param dntMarkers - Array of marker-to-original mappings
 * @returns Text with restored terms
 */
export function restoreDntTerms(
  translatedText: string,
  dntMarkers: Array<{ marker: string; original: string }>
): string {
  let result = translatedText;
  dntMarkers.forEach(({ marker, original }) => {
    result = result.replace(new RegExp(marker, 'g'), original);
  });
  return result;
}

/**
 * Format text for download as .txt file
 * Clean, paste-ready output with minimal formatting
 * @param translations - Map of language to translated text
 * @returns Formatted text content
 */
export function formatTextForDownload(
  translations: Record<string, string>
): string {
  const entries = Object.entries(translations);
  
  // If only one language, don't add language prefix
  if (entries.length === 1) {
    return entries[0][1];
  }
  
  // Multiple languages: add language prefix for each
  const lines: string[] = [];
  entries.forEach(([lang, text]) => {
    lines.push(`[${lang}]`);
    lines.push(text);
    lines.push('');
  });
  
  return lines.join('\n');
}

/**
 * Download text as .txt file
 * @param content - Text content
 * @param filename - File name
 */
export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate filename for text translation with date
 * @returns Filename in format translation_YYYY-MM-DD.txt
 */
export function generateTextFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `translation_${date}.txt`;
}

