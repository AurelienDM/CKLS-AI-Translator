import type { SubtitleFileData, SubtitleSettings, ValidationIssue } from '@/types/subtitle';
import { PERFORMANCE_LIMITS } from '@/types/subtitle';
import { countCharsWithoutTags } from '@/utils/subtitleHelpers';

/**
 * Validate subtitle file against settings and performance limits
 */
export function validateSubtitleFile(
  file: SubtitleFileData,
  settings: SubtitleSettings
): ValidationIssue[] {
  const issues: ValidationIssue[] = [...file.validationIssues]; // Start with parser issues
  
  // Check subtitle count against performance limits
  if (file.subtitles.length > PERFORMANCE_LIMITS.maxSubtitlesPerFile) {
    issues.push({
      type: 'too-many-subtitles',
      subtitleIndex: 0,
      message: `File contains ${file.subtitles.length} subtitles, exceeding limit of ${PERFORMANCE_LIMITS.maxSubtitlesPerFile}`,
      severity: 'error'
    });
  }
  
  // Validate each subtitle
  for (const subtitle of file.subtitles) {
    // Check character count per line
    const lines = subtitle.text.split('\n');
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const charCount = countCharsWithoutTags(line);
      
      if (charCount > settings.maxCharsPerLine) {
        issues.push({
          type: 'invalid-format',
          subtitleIndex: subtitle.index,
          message: `Line ${lineIndex + 1} exceeds character limit: ${charCount} chars (max: ${settings.maxCharsPerLine})`,
          severity: 'warning'
        });
      }
    }
    
    // Check number of lines
    if (lines.length > settings.maxLinesPerSubtitle) {
      issues.push({
        type: 'invalid-format',
        subtitleIndex: subtitle.index,
        message: `Subtitle has ${lines.length} lines, exceeding limit of ${settings.maxLinesPerSubtitle} lines`,
        severity: 'warning'
      });
    }
  }
  
  return issues;
}

/**
 * Validate multiple subtitle files as a batch
 */
export function validateSubtitleBatch(
  files: SubtitleFileData[],
  settings: SubtitleSettings
): {
  allIssues: Map<string, ValidationIssue[]>;
  hasErrors: boolean;
  totalSubtitles: number;
} {
  const allIssues = new Map<string, ValidationIssue[]>();
  let hasErrors = false;
  let totalSubtitles = 0;
  
  // Check file count
  if (files.length > PERFORMANCE_LIMITS.maxFilesInBatch) {
    const issue: ValidationIssue = {
      type: 'invalid-format',
      subtitleIndex: 0,
      message: `Too many files: ${files.length} (max: ${PERFORMANCE_LIMITS.maxFilesInBatch})`,
      severity: 'error'
    };
    allIssues.set('__batch__', [issue]);
    hasErrors = true;
  }
  
  // Validate each file
  for (const file of files) {
    const fileIssues = validateSubtitleFile(file, settings);
    totalSubtitles += file.subtitles.length;
    
    if (fileIssues.length > 0) {
      allIssues.set(file.fileName, fileIssues);
      
      // Check if any issues are errors
      if (fileIssues.some(issue => issue.severity === 'error')) {
        hasErrors = true;
      }
    }
  }
  
  // Check total subtitle count
  if (totalSubtitles > PERFORMANCE_LIMITS.maxTotalSubtitles) {
    const issue: ValidationIssue = {
      type: 'too-many-subtitles',
      subtitleIndex: 0,
      message: `Total subtitles across all files: ${totalSubtitles} (max: ${PERFORMANCE_LIMITS.maxTotalSubtitles})`,
      severity: 'error'
    };
    
    const batchIssues = allIssues.get('__batch__') || [];
    batchIssues.push(issue);
    allIssues.set('__batch__', batchIssues);
    hasErrors = true;
  }
  
  return {
    allIssues,
    hasErrors,
    totalSubtitles
  };
}

/**
 * Check if file size is within limits
 */
export function validateFileSize(file: File): ValidationIssue | null {
  const maxBytes = PERFORMANCE_LIMITS.maxFileSizeMB * 1024 * 1024;
  
  if (file.size > maxBytes) {
    return {
      type: 'file-too-large',
      subtitleIndex: 0,
      message: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds limit of ${PERFORMANCE_LIMITS.maxFileSizeMB}MB`,
      severity: 'error'
    };
  }
  
  return null;
}

