import type { SrtSubtitle, VttSubtitle, SubtitleSettings, TimingIssue } from '@/types/subtitle';
import { timecodeToMs, calculateReadingSpeed, countCharsWithoutTags } from '@/utils/subtitleHelpers';

/**
 * Analyze timing issues in subtitles
 */
export function analyzeTimingIssues(
  subtitles: (SrtSubtitle | VttSubtitle)[],
  settings: SubtitleSettings
): TimingIssue[] {
  const issues: TimingIssue[] = [];
  
  for (let i = 0; i < subtitles.length; i++) {
    const subtitle = subtitles[i];
    const startMs = timecodeToMs(subtitle.startTime);
    const endMs = timecodeToMs(subtitle.endTime);
    const durationMs = endMs - startMs;
    
    // Check for invalid duration
    if (durationMs <= 0) {
      issues.push({
        type: 'overlap',
        subtitleIndex: subtitle.index,
        details: `Invalid duration: start time is after or equal to end time`,
        suggestedFix: 'Check timecodes'
      });
      continue;
    }
    
    // Check overlap with next subtitle
    if (settings.enableOverlapDetection && i < subtitles.length - 1) {
      const nextSubtitle = subtitles[i + 1];
      const nextStartMs = timecodeToMs(nextSubtitle.startTime);
      const gap = nextStartMs - endMs;
      
      if (gap < 0) {
        // Overlap detected
        const overlapMs = Math.abs(gap);
        issues.push({
          type: 'overlap',
          subtitleIndex: subtitle.index,
          nextSubtitleIndex: nextSubtitle.index,
          details: `Overlaps with next subtitle by ${overlapMs}ms`,
          suggestedFix: settings.overlapResolution === 'shorten-prev'
            ? `Shorten end time by ${overlapMs}ms`
            : settings.overlapResolution === 'delay-next'
            ? `Delay next subtitle by ${overlapMs}ms`
            : 'Manual review required'
        });
      } else if (gap < settings.minGapBetweenCues) {
        // Gap too small
        const missingGap = settings.minGapBetweenCues - gap;
        issues.push({
          type: 'gap-too-small',
          subtitleIndex: subtitle.index,
          nextSubtitleIndex: nextSubtitle.index,
          details: `Gap is ${gap}ms (minimum: ${settings.minGapBetweenCues}ms)`,
          suggestedFix: `Increase gap by ${missingGap}ms`
        });
      }
    }
    
    // Check reading speed
    if (settings.enableReadingSpeedCheck) {
      const readingSpeed = calculateReadingSpeed(subtitle.text, durationMs);
      
      if (readingSpeed > settings.maxCharsPerSecond) {
        issues.push({
          type: 'too-fast',
          subtitleIndex: subtitle.index,
          details: `Reading speed: ${readingSpeed.toFixed(1)} chars/sec (max: ${settings.maxCharsPerSecond})`,
          suggestedFix: `Increase duration to ${Math.ceil((countCharsWithoutTags(subtitle.text) / settings.maxCharsPerSecond) * 1000)}ms or split subtitle`
        });
      } else if (readingSpeed < settings.minCharsPerSecond && readingSpeed > 0) {
        issues.push({
          type: 'too-slow',
          subtitleIndex: subtitle.index,
          details: `Reading speed: ${readingSpeed.toFixed(1)} chars/sec (min: ${settings.minCharsPerSecond})`,
          suggestedFix: `Decrease duration to ${Math.ceil((countCharsWithoutTags(subtitle.text) / settings.minCharsPerSecond) * 1000)}ms`
        });
      }
    }
  }
  
  return issues;
}

/**
 * Check if a translated subtitle exceeds character limit (length overflow)
 */
export function checkLengthOverflow(
  translatedText: string,
  settings: SubtitleSettings,
  subtitleIndex: number
): TimingIssue | null {
  const lines = translatedText.split('\n');
  
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const charCount = countCharsWithoutTags(line);
    
    if (charCount > settings.maxCharsPerLine) {
      return {
        type: 'length-overflow',
        subtitleIndex,
        details: `Line ${lineIndex + 1}: ${charCount} chars (max: ${settings.maxCharsPerLine})`,
        charCount,
        translatedText,
        suggestedFix: 'Split into multiple lines or abbreviate'
      };
    }
  }
  
  // Check total lines
  if (lines.length > settings.maxLinesPerSubtitle) {
    return {
      type: 'length-overflow',
      subtitleIndex,
      details: `${lines.length} lines (max: ${settings.maxLinesPerSubtitle})`,
      translatedText,
      suggestedFix: 'Combine or abbreviate lines'
    };
  }
  
  return null;
}

/**
 * Get summary statistics for timing issues
 */
export function getTimingIssueSummary(issues: TimingIssue[]): {
  overlapCount: number;
  tooFastCount: number;
  tooSlowCount: number;
  gapTooSmallCount: number;
  lengthOverflowCount: number;
  totalCount: number;
} {
  return {
    overlapCount: issues.filter(i => i.type === 'overlap').length,
    tooFastCount: issues.filter(i => i.type === 'too-fast').length,
    tooSlowCount: issues.filter(i => i.type === 'too-slow').length,
    gapTooSmallCount: issues.filter(i => i.type === 'gap-too-small').length,
    lengthOverflowCount: issues.filter(i => i.type === 'length-overflow').length,
    totalCount: issues.length
  };
}

