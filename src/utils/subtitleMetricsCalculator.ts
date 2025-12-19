import { TranslationMetrics } from './metricsCalculator';
import { SubtitleFileData } from '@/types/subtitle';
import { TmxMemory } from '@/types/tmx';

export interface SubtitleMetricsOptions {
  targetCount: number;
  tmxMemory?: TmxMemory;
  tmxMatchThreshold?: number;
}

/**
 * Calculate translation metrics for subtitle files
 * @param subtitleFiles - Array of parsed subtitle files
 * @param options - Configuration options including target language count and TMX
 * @returns Metrics object with counts and calculations
 */
export function calculateSubtitleMetrics(
  subtitleFiles: SubtitleFileData[],
  options: SubtitleMetricsOptions
): TranslationMetrics {
  const { targetCount = 0, tmxMemory } = options;
  
  // Return empty metrics if no files or no targets
  if (!subtitleFiles || subtitleFiles.length === 0 || targetCount === 0) {
    return {
      totalStrings: 0,
      uniqueStrings: 0,
      duplicateStrings: 0,
      totalCharacters: 0,
      totalRawCharacters: 0,
      sourceCharacters: 0,
      extractedCharacters: 0,
      translatedCharacters: 0,
      averageLength: 0,
      totalApiCalls: 0,
      languages: 0,
      totalTranslatedChars: 0,
      deduplicationPercentage: 0
    };
  }
  
  try {
    // Extract all subtitle texts
    const allSubtitles = subtitleFiles.flatMap(file => file.subtitles);
    const totalStrings = allSubtitles.length;
    
    // Track duplicates by using a Set
    const uniqueSet = new Set<string>();
    let totalRawCharacters = 0;
    
    allSubtitles.forEach(subtitle => {
      const text = subtitle.text.trim();
      uniqueSet.add(text);
      totalRawCharacters += text.length;
    });
    
    const uniqueStrings = uniqueSet.size;
    const duplicateStrings = totalStrings - uniqueStrings;
    
    // Calculate characters for unique strings only
    const uniqueArray = Array.from(uniqueSet);
    const totalCharacters = uniqueArray.reduce((sum, text) => sum + text.length, 0);
    
    const averageLength = uniqueStrings > 0 
      ? Math.round(totalCharacters / uniqueStrings) 
      : 0;
    
    const deduplicationPercentage = totalStrings > 0
      ? Math.round((duplicateStrings / totalStrings) * 100)
      : 0;
    
    const languages = targetCount;
    
    // Calculate TMX matches if TMX memory is provided
    let tmxMatched = 0;
    if (tmxMemory && tmxMemory.units.length > 0) {
      // This is a rough estimate - actual matching happens during translation
      // For metrics, we'll estimate based on exact text matches
      const tmxSourceTexts = new Set(tmxMemory.units.map(u => u.sourceText.toLowerCase().trim()));
      uniqueArray.forEach(text => {
        if (tmxSourceTexts.has(text.toLowerCase().trim())) {
          tmxMatched++;
        }
      });
    }
    
    // API calls = (unique strings - TMX matches) × languages
    const stringsNeedingTranslation = uniqueStrings - tmxMatched;
    const totalApiCalls = stringsNeedingTranslation * languages;
    const totalTranslatedChars = totalCharacters * languages;
    const savedApiCalls = (duplicateStrings * languages) + (tmxMatched * languages);
    
    return {
      totalStrings,
      uniqueStrings,
      duplicateStrings,
      totalCharacters,
      totalRawCharacters,
      sourceCharacters: totalRawCharacters, // All subtitle text (with duplicates)
      extractedCharacters: totalCharacters, // Unique subtitle text only
      translatedCharacters: Math.round(totalCharacters * 1.1 * languages), // Estimated with expansion
      averageLength,
      totalApiCalls,
      languages,
      totalTranslatedChars,
      deduplicationPercentage,
      savedApiCalls,
      characterSavings: totalRawCharacters - totalCharacters
    };
  } catch (error) {
    console.error('Error calculating subtitle metrics:', error);
    return {
      totalStrings: 0,
      uniqueStrings: 0,
      duplicateStrings: 0,
      totalCharacters: 0,
      totalRawCharacters: 0,
      sourceCharacters: 0,
      extractedCharacters: 0,
      translatedCharacters: 0,
      averageLength: 0,
      totalApiCalls: 0,
      languages: 0,
      totalTranslatedChars: 0,
      deduplicationPercentage: 0
    };
  }
}

