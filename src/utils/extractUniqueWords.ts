/**
 * Utility for extracting unique words from content for DNT prefill suggestions
 * Language-agnostic: uses patterns instead of hardcoded stop words
 */

export interface WordSuggestion {
  word: string;
  frequency: number;
  isLikelyProperNoun: boolean;
}

/**
 * Extract unique words from already-extracted text strings
 * These are the same strings that get sent to the translation API
 * 
 * @param extractedTexts - Array of clean text strings (from extraction pipeline)
 * @param existingDnt - Terms already in the DNT list (to exclude from suggestions)
 * @param minLength - Minimum word length to include (default: 3)
 * @returns Array of word suggestions sorted by proper noun status then frequency
 */
export function extractUniqueWordsFromTexts(
  extractedTexts: string[],
  existingDnt: string[] = [],
  minLength: number = 3
): WordSuggestion[] {
  const existingSet = new Set(existingDnt.map(t => t.toLowerCase()));
  const wordData = new Map<string, { 
    count: number; 
    original: string; 
    isLikelyProperNoun: boolean;
  }>();

  for (const text of extractedTexts) {
    if (!text?.trim()) continue;

    // Extract words with context to detect mid-sentence capitalization
    // Pattern captures: (preceding context)(word)
    const wordPattern = /(?:^|[.!?]\s+|\s+)([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ0-9'-]*)/g;
    
    let match;
    while ((match = wordPattern.exec(text)) !== null) {
      const word = match[1];
      const lowerWord = word.toLowerCase();
      const precedingContext = match[0].substring(0, match[0].length - word.length);
      
      // Skip if too short or already in DNT
      if (word.length < minLength) continue;
      if (existingSet.has(lowerWord)) continue;
      
      // Detect if likely a proper noun:
      // - Capitalized but NOT at start of sentence
      // - Mixed case (PascalCase, camelCase)
      // - ALL CAPS (2+ letters)
      const isStartOfSentence = /^$|[.!?]\s*$/.test(precedingContext.trim());
      const isCapitalized = /^[A-ZÀ-Ý]/.test(word);
      const isMixedCase = /^[A-Z][a-z]*[A-Z]/.test(word) || /^[a-z]+[A-Z]/.test(word);
      const isAllCaps = /^[A-ZÀ-Ý]{2,}$/.test(word);
      
      const isLikelyProperNoun = (isCapitalized && !isStartOfSentence) || isMixedCase || isAllCaps;

      const existing = wordData.get(lowerWord);
      if (existing) {
        existing.count++;
        // If seen as proper noun at least once, mark it
        if (isLikelyProperNoun) existing.isLikelyProperNoun = true;
      } else {
        wordData.set(lowerWord, {
          count: 1,
          original: word,
          isLikelyProperNoun
        });
      }
    }
  }

  // Convert to array
  const suggestions: WordSuggestion[] = [];
  wordData.forEach((data) => {
    suggestions.push({
      word: data.original,
      frequency: data.count,
      isLikelyProperNoun: data.isLikelyProperNoun
    });
  });

  // Sort: proper nouns first, then by frequency (descending), then alphabetically
  suggestions.sort((a, b) => {
    // Proper nouns get priority
    if (a.isLikelyProperNoun !== b.isLikelyProperNoun) {
      return a.isLikelyProperNoun ? -1 : 1;
    }
    // Then by frequency (highest first)
    if (b.frequency !== a.frequency) {
      return b.frequency - a.frequency;
    }
    // Then alphabetically
    return a.word.localeCompare(b.word);
  });

  return suggestions;
}

/**
 * Filter suggestions based on user input (prefix match)
 * 
 * @param suggestions - Full list of word suggestions
 * @param query - User's search query
 * @param limit - Maximum number of results to return (default: 8)
 * @returns Filtered suggestions matching the query prefix
 */
export function filterSuggestions(
  suggestions: WordSuggestion[],
  query: string,
  limit: number = 8
): WordSuggestion[] {
  if (!query.trim()) return [];
  
  const lowerQuery = query.toLowerCase();
  
  return suggestions
    .filter(s => s.word.toLowerCase().startsWith(lowerQuery))
    .slice(0, limit);
}

