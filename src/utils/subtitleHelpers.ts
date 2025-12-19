import type { HtmlTagMap } from '@/types/subtitle';

/**
 * Detect subtitle file format from content
 */
export function detectSubtitleFormat(content: string): 'srt' | 'vtt' | 'unknown' {
  const trimmed = content.trim();
  
  // Check for WEBVTT header
  if (trimmed.startsWith('WEBVTT')) {
    return 'vtt';
  }
  
  // Check for SRT format patterns (starts with number, then timecode)
  const srtPattern = /^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/m;
  if (srtPattern.test(trimmed)) {
    return 'srt';
  }
  
  // Check for VTT timecode pattern (period instead of comma)
  const vttPattern = /\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/m;
  if (vttPattern.test(trimmed)) {
    return 'vtt';
  }
  
  return 'unknown';
}

/**
 * Detect text encoding from content
 */
export function detectEncoding(content: string): string {
  // Check for UTF-8 BOM (Byte Order Mark)
  if (content.charCodeAt(0) === 0xFEFF) {
    return 'UTF-8-BOM';
  }
  
  // Default to UTF-8
  return 'UTF-8';
}

/**
 * Validate file size against limit (5MB)
 */
export function validateFileSize(file: File, maxSizeMB: number = 5): boolean {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxBytes;
}

/**
 * Strip HTML tags from text and return mapping for restoration
 * @deprecated Use extractTextFromHTML instead - this placeholder-based approach causes DeepL to duplicate content
 */
export function stripHtmlTags(text: string): { stripped: string; tags: HtmlTagMap } {
  console.warn('stripHtmlTags is deprecated. Use extractTextFromHTML instead to avoid translation duplication issues.');
  
  const tags: HtmlTagMap = {};
  let counter = 0;
  let stripped = text;
  
  // Common subtitle HTML tags: <i>, <b>, <u>, <font>, </i>, </b>, </u>, </font>
  const tagPattern = /<\/?([ibuIBU]|font[^>]*)>/g;
  
  stripped = text.replace(tagPattern, (match) => {
    const placeholder = `__HTML_TAG_${counter}__`;
    tags[placeholder] = match;
    counter++;
    return placeholder;
  });
  
  return { stripped, tags };
}

/**
 * Restore HTML tags to translated text
 * @deprecated Use restoreHTMLStructure instead - this function is paired with the deprecated stripHtmlTags
 */
export function restoreHtmlTags(text: string, tags: HtmlTagMap): string {
  console.warn('restoreHtmlTags is deprecated. Use restoreHTMLStructure instead.');
  
  let restored = text;
  
  for (const [placeholder, tag] of Object.entries(tags)) {
    restored = restored.replace(placeholder, tag);
  }
  
  return restored;
}

/**
 * Parse timecode to milliseconds
 */
export function timecodeToMs(timecode: string): number {
  // Handle both SRT (comma) and VTT (period) formats
  const normalized = timecode.replace(',', '.');
  const parts = normalized.split(':');
  
  if (parts.length !== 3) {
    return 0;
  }
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const secondsParts = parts[2].split('.');
  const seconds = parseInt(secondsParts[0], 10);
  const milliseconds = secondsParts[1] ? parseInt(secondsParts[1], 10) : 0;
  
  return (hours * 3600 + minutes * 60 + seconds) * 1000 + milliseconds;
}

/**
 * Format milliseconds to SRT timecode (comma-separated)
 */
export function msToSrtTimecode(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Format milliseconds to VTT timecode (period-separated)
 */
export function msToVttTimecode(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Validate timecode format
 */
export function isValidTimecode(timecode: string): boolean {
  // SRT format: 00:00:00,000
  const srtPattern = /^\d{2}:\d{2}:\d{2},\d{3}$/;
  
  // VTT format: 00:00:00.000
  const vttPattern = /^\d{2}:\d{2}:\d{2}\.\d{3}$/;
  
  return srtPattern.test(timecode) || vttPattern.test(timecode);
}

/**
 * Extract voice tag from VTT text
 */
export function extractVoiceTag(text: string): { voiceTag: string | undefined; textWithoutTag: string } {
  const voiceTagPattern = /^<v\s+([^>]+)>(.*)<\/v>$/is;
  const match = text.match(voiceTagPattern);
  
  if (match) {
    return {
      voiceTag: match[1].trim(),
      textWithoutTag: match[2].trim()
    };
  }
  
  // Check for opening tag only
  const openTagPattern = /^<v\s+([^>]+)>(.*)/is;
  const openMatch = text.match(openTagPattern);
  
  if (openMatch) {
    return {
      voiceTag: openMatch[1].trim(),
      textWithoutTag: openMatch[2].trim()
    };
  }
  
  return {
    voiceTag: undefined,
    textWithoutTag: text
  };
}

/**
 * Apply line break strategy
 */
export function applyLineBreakStrategy(
  text: string,
  strategy: 'preserve' | 'auto' | 'single',
  maxCharsPerLine: number
): string {
  if (strategy === 'preserve') {
    return text;
  }
  
  if (strategy === 'single') {
    return text.replace(/\n/g, ' ');
  }
  
  // Auto-wrap strategy
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.join('\n');
}

/**
 * Validate HTML tags in subtitle text
 * Strict validation - rejects malformed HTML
 */
export function validateSubtitleHTML(text: string, subtitleIndex: number): Array<import('@/types/subtitle').ValidationIssue> {
  const issues: Array<import('@/types/subtitle').ValidationIssue> = [];
  
  // Check if HTML exists
  if (!/<[^>]+>/.test(text)) {
    return issues; // No HTML, nothing to validate
  }
  
  // Extract all HTML tags
  const tagPattern = /<\/?([a-z][a-z0-9]*)[^>]*>/gi;
  const tags: Array<{ tag: string; isClosing: boolean; position: number; fullMatch: string }> = [];
  let match;
  
  while ((match = tagPattern.exec(text)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1].toLowerCase();
    const isClosing = fullMatch.startsWith('</');
    
    tags.push({
      tag: tagName,
      isClosing,
      position: match.index,
      fullMatch
    });
  }
  
  // Validate tags using a stack
  const stack: Array<{ tag: string; position: number; fullMatch: string }> = [];
  
  for (const tagInfo of tags) {
    if (!tagInfo.isClosing) {
      // Opening tag - push to stack
      stack.push(tagInfo);
    } else {
      // Closing tag - must match the last opening tag
      if (stack.length === 0) {
        // Closing tag without opening
        issues.push({
          type: 'malformed-html',
          subtitleIndex,
          message: `Closing tag ${tagInfo.fullMatch} has no matching opening tag`,
          severity: 'error',
          htmlSnippet: text.substring(Math.max(0, tagInfo.position - 20), tagInfo.position + 30),
          suggestedFix: `Remove ${tagInfo.fullMatch} or add opening <${tagInfo.tag}> before it`
        });
      } else {
        const lastOpening = stack[stack.length - 1];
        
        if (lastOpening.tag !== tagInfo.tag) {
          // Mismatched tags
          issues.push({
            type: 'malformed-html',
            subtitleIndex,
            message: `Mismatched HTML tags: <${lastOpening.tag}> closed with </${tagInfo.tag}>`,
            severity: 'error',
            htmlSnippet: text.substring(lastOpening.position, tagInfo.position + tagInfo.fullMatch.length),
            suggestedFix: `Change </${tagInfo.tag}> to </${lastOpening.tag}> or change <${lastOpening.tag}> to <${tagInfo.tag}>`
          });
        }
        
        stack.pop();
      }
    }
  }
  
  // Check for unclosed tags
  if (stack.length > 0) {
    stack.forEach(unclosedTag => {
      issues.push({
        type: 'malformed-html',
        subtitleIndex,
        message: `Unclosed HTML tag: ${unclosedTag.fullMatch}`,
        severity: 'error',
        htmlSnippet: text.substring(unclosedTag.position, Math.min(text.length, unclosedTag.position + 50)),
        suggestedFix: `Add </${unclosedTag.tag}> at the end or remove ${unclosedTag.fullMatch}`
      });
    });
  }
  
  return issues;
}

/**
 * Extract pure text from HTML subtitle with segment tracking
 * Returns pure text + structure for restoration
 * 
 * Example:
 *   Input:  "<b>Bold text</b> and <u>underlined</u>"
 *   Output: {
 *     pureText: "Bold text and underlined",
 *     structure: {
 *       segments: [
 *         { type: 'tag', content: '<b>' },
 *         { type: 'text', content: 'Bold text', textIndex: 0 },
 *         { type: 'tag', content: '</b>' },
 *         { type: 'text', content: ' and ', textIndex: 1 },
 *         { type: 'tag', content: '<u>' },
 *         { type: 'text', content: 'underlined', textIndex: 2 },
 *         { type: 'tag', content: '</u>' }
 *       ],
 *       textSegments: ["Bold text", " and ", "underlined"]
 *     }
 *   }
 */
export function extractTextFromHTML(html: string): { pureText: string; structure: import('@/types/subtitle').HTMLStructure | null } {
  // Check if HTML exists
  if (!/<[^>]+>/.test(html)) {
    return { 
      pureText: html, 
      structure: null 
    };
  }
  
  // Parse HTML into segments: tags and text
  const segments: Array<{ type: 'tag' | 'text'; content: string; textIndex?: number }> = [];
  const textSegments: string[] = [];
  const tagPattern = /(<[^>]+>)|([^<]+)/g;
  let match;
  
  while ((match = tagPattern.exec(html)) !== null) {
    if (match[1]) {
      // HTML tag
      segments.push({ type: 'tag', content: match[1] });
    } else if (match[2]) {
      // Text content - always preserve it (even if just whitespace)
      const text = match[2];
      const textIndex = textSegments.length;
      segments.push({ type: 'text', content: text, textIndex });
      textSegments.push(text);
    }
  }
  
  // Join text segments with space for translation
  const pureText = textSegments.join(' ');
  
  // Store structure with segment tracking
  const structure: import('@/types/subtitle').HTMLStructure = {
    hasHtml: true,
    template: html,
    segments,
    textSegments
  };
  
  return { pureText, structure };
}

/**
 * Restore HTML structure with translated text (segment-based)
 * Splits translated text proportionally based on original segment lengths
 */
export function restoreHTMLStructure(
  translatedText: string, 
  structure: import('@/types/subtitle').HTMLStructure | null,
  _lineBreakStrategy?: 'preserve' | 'auto' | 'single'
): string {
  if (!structure || !structure.hasHtml) {
    return translatedText;
  }
  
  const { segments, textSegments } = structure;
  
  if (!textSegments || textSegments.length === 0) {
    return translatedText;
  }
  
  // Calculate original segment lengths (trimmed for accuracy)
  const originalLengths = textSegments.map(seg => seg.trim().length);
  const totalOriginalLength = originalLengths.reduce((a, b) => a + b, 0);
  
  if (totalOriginalLength === 0) {
    return translatedText;
  }
  
  // Calculate proportions for each segment
  const proportions = originalLengths.map(len => len / totalOriginalLength);
  
  // Split translated text proportionally
  const translatedSegments: string[] = [];
  const translatedTrimmed = translatedText.trim();
  const translatedLength = translatedTrimmed.length;
  let currentPos = 0;
  
  for (let i = 0; i < proportions.length; i++) {
    if (i === proportions.length - 1) {
      // Last segment gets everything remaining
      translatedSegments.push(translatedTrimmed.substring(currentPos));
    } else {
      // Calculate target length based on proportion
      const targetLength = Math.round(translatedLength * proportions[i]);
      let endPos = currentPos + targetLength;
      
      // Try to find word boundary near target position
      const searchRadius = Math.min(15, Math.floor(targetLength * 0.3));
      let bestBreak = endPos;
      let foundSpace = false;
      
      // Search for space around target position
      for (let j = endPos; j <= Math.min(translatedLength - 1, endPos + searchRadius); j++) {
        if (translatedTrimmed[j] === ' ') {
          bestBreak = j;
          foundSpace = true;
          break;
        }
      }
      
      if (!foundSpace) {
        // Search backwards
        for (let j = endPos; j >= Math.max(currentPos + 1, endPos - searchRadius); j--) {
          if (translatedTrimmed[j] === ' ') {
            bestBreak = j;
            foundSpace = true;
            break;
          }
        }
      }
      
      // Extract segment
      const segment = translatedTrimmed.substring(currentPos, bestBreak).trim();
      translatedSegments.push(segment);
      
      // Move position past the space
      currentPos = bestBreak + 1;
      while (currentPos < translatedLength && translatedTrimmed[currentPos] === ' ') {
        currentPos++;
      }
    }
  }
  
  // Reconstruct HTML by placing translated segments in their positions
  const result: string[] = [];
  let segmentIndex = 0;
  
  for (const segment of segments) {
    if (segment.type === 'tag') {
      result.push(segment.content);
    } else {
      // Text segment - use translated version
      if (segmentIndex < translatedSegments.length) {
        // Preserve whitespace structure from original if it was whitespace-only
        const originalText = textSegments[segment.textIndex!];
        if (originalText.trim() === '') {
          // Keep original whitespace
          result.push(originalText);
        } else {
          // Use translated text
          result.push(translatedSegments[segmentIndex]);
        }
        segmentIndex++;
      }
    }
  }
  
  return result.join('');
}

/**
 * Count characters excluding HTML tags
 */
export function countCharsWithoutTags(text: string): number {
  const withoutTags = text.replace(/<\/?[^>]+>/g, '');
  return withoutTags.length;
}

/**
 * Calculate reading speed (characters per second)
 */
export function calculateReadingSpeed(text: string, durationMs: number): number {
  if (durationMs === 0) return 0;
  
  const charCount = countCharsWithoutTags(text);
  const durationSeconds = durationMs / 1000;
  
  return charCount / durationSeconds;
}

