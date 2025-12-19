import type { SubtitleFileData, VttSubtitle, ValidationIssue } from '@/types/subtitle';
import { detectEncoding, extractVoiceTag, validateSubtitleHTML } from '@/utils/subtitleHelpers';

/**
 * Parse WebVTT subtitle file
 */
export function parseVttFile(content: string, fileName: string): SubtitleFileData {
  const encoding = detectEncoding(content);
  const subtitles: VttSubtitle[] = [];
  const validationIssues: ValidationIssue[] = [];
  const noteBlocks: string[] = [];
  const styleBlocks: string[] = [];
  
  // Remove BOM if present
  const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
  
  // Extract header
  const lines = cleanContent.split('\n');
  const firstLine = lines[0].trim();
  
  if (!firstLine.startsWith('WEBVTT')) {
    validationIssues.push({
      type: 'invalid-format',
      subtitleIndex: 0,
      message: 'File does not start with WEBVTT header',
      severity: 'error'
    });
    return {
      fileName,
      format: 'vtt',
      encoding,
      subtitles: [],
      vttMetadata: {
        header: firstLine,
        noteBlocks: [],
        styleBlocks: []
      },
      validationIssues,
      timingIssues: []
    };
  }
  
  const header = firstLine;
  
  // Split into blocks
  const blocks = cleanContent.split(/\n\s*\n/).filter(block => block.trim());
  
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex].trim();
    const blockLines = block.split('\n');
    
    // Skip WEBVTT header block
    if (blockLines[0].startsWith('WEBVTT')) {
      continue;
    }
    
    // Handle NOTE blocks
    if (blockLines[0].startsWith('NOTE')) {
      noteBlocks.push(block);
      continue;
    }
    
    // Handle STYLE blocks
    if (blockLines[0].startsWith('STYLE')) {
      styleBlocks.push(block);
      continue;
    }
    
    // Parse cue
    let lineIndex = 0;
    let cueIdentifier: string | undefined;
    
    // Check if first line is a cue identifier (not a timecode)
    if (blockLines.length > 1 && !blockLines[0].includes('-->')) {
      cueIdentifier = blockLines[0].trim();
      lineIndex = 1;
    }
    
    // Parse timecode line
    if (lineIndex >= blockLines.length) {
      validationIssues.push({
        type: 'invalid-format',
        subtitleIndex: blockIndex + 1,
        message: 'Missing timecode line',
        severity: 'error'
      });
      continue;
    }
    
    const timecodeLine = blockLines[lineIndex].trim();
    const timecodeMatch = timecodeLine.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})(.*)$/);
    
    if (!timecodeMatch) {
      validationIssues.push({
        type: 'malformed-timecode',
        subtitleIndex: blockIndex + 1,
        message: `Invalid VTT timecode format: "${timecodeLine}" (expected format: 00:00:00.000 --> 00:00:00.000)`,
        severity: 'error'
      });
      continue;
    }
    
    const startTime = timecodeMatch[1];
    const endTime = timecodeMatch[2];
    const cueSettings = timecodeMatch[3].trim() || undefined;
    
    // Validate timecode formats (VTT uses periods)
    const vttTimecodePattern = /^\d{2}:\d{2}:\d{2}\.\d{3}$/;
    if (!vttTimecodePattern.test(startTime) || !vttTimecodePattern.test(endTime)) {
      validationIssues.push({
        type: 'malformed-timecode',
        subtitleIndex: blockIndex + 1,
        message: `Malformed VTT timecode values: "${startTime}" --> "${endTime}"`,
        severity: 'error'
      });
      continue;
    }
    
    // Extract text lines (everything after timecode)
    const textLines = blockLines.slice(lineIndex + 1);
    const text = textLines.join('\n');
    
    if (!text.trim()) {
      validationIssues.push({
        type: 'invalid-format',
        subtitleIndex: blockIndex + 1,
        message: 'Cue has no text content',
        severity: 'warning'
      });
    }
    
    // Validate HTML if present
    if (/<[^>]+>/.test(text)) {
      const htmlIssues = validateSubtitleHTML(text, blockIndex + 1);
      validationIssues.push(...htmlIssues);
    }
    
    // Extract voice tag if present
    const { voiceTag, textWithoutTag } = extractVoiceTag(text);
    
    // Use sequential index for VTT (they don't have explicit indices)
    const index = subtitles.length + 1;
    
    subtitles.push({
      index,
      startTime,
      endTime,
      text: voiceTag ? textWithoutTag : text,
      originalLines: textLines,
      cueIdentifier,
      cueSettings,
      voiceTag
    });
  }
  
  return {
    fileName,
    format: 'vtt',
    encoding,
    subtitles,
    vttMetadata: {
      header,
      noteBlocks,
      styleBlocks
    },
    validationIssues,
    timingIssues: [] // Will be populated by timing analyzer
  };
}

/**
 * Parse VTT file from File object
 */
export async function parseVttFileFromFile(file: File): Promise<SubtitleFileData> {
  const content = await file.text();
  return parseVttFile(content, file.name);
}

