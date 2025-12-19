import { TmxMemory, TmxMatch } from '@/types/tmx';

/**
 * Find TMX matches for a given source text
 */
export function findTmxMatches(
  sourceText: string,
  targetLang: string,
  tmxMemory: TmxMemory,
  fuzzyThreshold: number = 70
): TmxMatch[] {
  const matches: TmxMatch[] = [];
  
  // Normalize the source text for comparison
  const normalizedSource = normalizeText(sourceText);
  
  // Filter units for the target language
  const relevantUnits = tmxMemory.units.filter(
    unit => unit.targetLang === targetLang || unit.targetLang.startsWith(targetLang.split('-')[0])
  );
  
  for (const unit of relevantUnits) {
    const normalizedUnitSource = normalizeText(unit.sourceText);
    
    // Check for exact match
    if (normalizedUnitSource === normalizedSource) {
      matches.push({
        unit,
        matchScore: 100,
        matchType: 'exact',
        sourceText: unit.sourceText,
        targetText: unit.targetText,
      });
      continue;
    }
    
    // Calculate fuzzy match score
    const score = calculateSimilarity(normalizedSource, normalizedUnitSource);
    
    if (score >= fuzzyThreshold) {
      matches.push({
        unit,
        matchScore: Math.round(score),
        matchType: score >= 95 ? 'exact' : 'fuzzy',
        sourceText: unit.sourceText,
        targetText: unit.targetText,
      });
    }
  }
  
  // Sort by match score (highest first)
  matches.sort((a, b) => b.matchScore - a.matchScore);
  
  return matches;
}

/**
 * Normalize text for comparison (lowercase, trim, remove extra spaces)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/<[^>]*>/g, ''); // Remove HTML tags
}

/**
 * Calculate similarity score between two strings using Levenshtein distance
 * Returns a score from 0-100
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 100;
  
  const distance = levenshteinDistance(longer, shorter);
  return ((longer.length - distance) / longer.length) * 100;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Apply TMX translations to subtitles based on matches
 */
export function applyTmxTranslations(
  sourceTexts: string[],
  targetLang: string,
  tmxMemory: TmxMemory,
  autoApplyThreshold: number = 95
): Map<number, string> {
  const appliedTranslations = new Map<number, string>();
  
  sourceTexts.forEach((sourceText, index) => {
    const matches = findTmxMatches(sourceText, targetLang, tmxMemory, autoApplyThreshold);
    
    if (matches.length > 0 && matches[0].matchScore >= autoApplyThreshold) {
      appliedTranslations.set(index, matches[0].targetText);
    }
  });
  
  return appliedTranslations;
}

