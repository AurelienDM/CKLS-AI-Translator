import type { SubtitleFileData, SrtSubtitle, ValidationIssue } from '@/types/subtitle';
import { detectEncoding, isValidTimecode, validateSubtitleHTML } from '@/utils/subtitleHelpers';

/**
 * Parse SRT subtitle file
 */
export function parseSrtFile(content: string, fileName: string): SubtitleFileData {
  const encoding = detectEncoding(content);
  const subtitles: SrtSubtitle[] = [];
  const validationIssues: ValidationIssue[] = [];
  
  // Remove BOM if present
  const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
  
  // Split into blocks by double newline
  const blocks = cleanContent.split(/\n\s*\n/).filter(block => block.trim());
  
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex].trim();
    const lines = block.split('\n');
    
    if (lines.length < 3) {
      // Need at least: index, timecode, text
      validationIssues.push({
        type: 'invalid-format',
        subtitleIndex: blockIndex + 1,
        message: `Block has less than 3 lines (expected: index, timecode, text)`,
        severity: 'error'
      });
      continue;
    }
    
    // Parse index
    const indexLine = lines[0].trim();
    const index = parseInt(indexLine, 10);
    
    if (isNaN(index)) {
      validationIssues.push({
        type: 'missing-index',
        subtitleIndex: blockIndex + 1,
        message: `Invalid or missing subtitle index: "${indexLine}"`,
        severity: 'error'
      });
      continue;
    }
    
    // Parse timecode
    const timecodeLine = lines[1].trim();
    const timecodeMatch = timecodeLine.match(/^(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})$/);
    
    if (!timecodeMatch) {
      validationIssues.push({
        type: 'malformed-timecode',
        subtitleIndex: index,
        message: `Invalid timecode format: "${timecodeLine}" (expected format: 00:00:00,000 --> 00:00:00,000)`,
        severity: 'error'
      });
      continue;
    }
    
    const startTime = timecodeMatch[1];
    const endTime = timecodeMatch[2];
    
    // Validate timecode formats
    if (!isValidTimecode(startTime) || !isValidTimecode(endTime)) {
      validationIssues.push({
        type: 'malformed-timecode',
        subtitleIndex: index,
        message: `Malformed timecode values: "${startTime}" --> "${endTime}"`,
        severity: 'error'
      });
      continue;
    }
    
    // Extract text lines (everything after timecode)
    const textLines = lines.slice(2);
    const text = textLines.join('\n');
    
    if (!text.trim()) {
      validationIssues.push({
        type: 'invalid-format',
        subtitleIndex: index,
        message: 'Subtitle has no text content',
        severity: 'warning'
      });
    }
    
    // Validate HTML if present
    if (/<[^>]+>/.test(text)) {
      const htmlIssues = validateSubtitleHTML(text, index);
      validationIssues.push(...htmlIssues);
    }
    
    subtitles.push({
      index,
      startTime,
      endTime,
      text,
      originalLines: textLines
    });
  }
  
  // Check for duplicate indices
  const indices = new Set<number>();
  subtitles.forEach(sub => {
    if (indices.has(sub.index)) {
      validationIssues.push({
        type: 'invalid-format',
        subtitleIndex: sub.index,
        message: `Duplicate subtitle index: ${sub.index}`,
        severity: 'warning'
      });
    }
    indices.add(sub.index);
  });
  
  return {
    fileName,
    format: 'srt',
    encoding,
    subtitles,
    validationIssues,
    timingIssues: [] // Will be populated by timing analyzer
  };
}

/**
 * Parse SRT file from File object
 */
export async function parseSrtFileFromFile(file: File): Promise<SubtitleFileData> {
  const content = await file.text();
  return parseSrtFile(content, file.name);
}

