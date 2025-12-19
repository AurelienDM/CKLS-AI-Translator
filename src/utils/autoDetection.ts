export interface DntCandidate {
  term: string;
  reason: string;
  pattern: string;
  frequency: number;
  confidence: 'high' | 'medium' | 'low';
  score: number;
}

export interface AutoDetectionResult {
  candidates: DntCandidate[];
  totalScanned: number;
}

// Common words to filter out from proper noun detection
const COMMON_WORDS = new Set([
  'Introduction', 'Welcome', 'Next', 'Download', 'Title', 'Button', 'Menu', 
  'Page', 'Editorial', 'Survey', 'Activity', 'Text', 'Label', 'Field',
  'General', 'Settings', 'Features', 'Step', 'Before', 'After', 'Please',
  'Thank', 'Click', 'Select', 'Choose', 'Enter', 'Submit', 'Cancel'
]);

// Font names to exclude from detection (HTML emails)
const FONT_NAMES = new Set([
  'Arial', 'Helvetica', 'Times', 'Georgia', 'Verdana', 
  'Courier', 'Tahoma', 'Impact', 'Comic', 'Sans', 'Serif',
  'Trebuchet', 'Palatino', 'Garamond', 'Bookman', 'Monaco'
]);

// Common JSON property keys to exclude
const JSON_KEYS = new Set([
  'name', 'description', 'locale', 'environment', 'scene',
  'hideSubtitles', 'branding', 'colors', 'panelBackground',
  'buttonBackground', 'foregrounds', 'webappBackground',
  'episodes', 'dialog', 'characters', 'settings', 'metadata'
]);

/**
 * Check if a term should be excluded from DNT detection
 * Filters out technical patterns like color codes, font names, JSON syntax
 */
function shouldExcludeTerm(term: string): boolean {
  if (!term || term.length === 0) return true;
  
  // Hex color codes (#000000, #fff, #ffffff, etc.)
  if (/^#[0-9a-fA-F]{3,8}$/.test(term)) {
    return true;
  }
  
  // Font names (common web fonts)
  if (FONT_NAMES.has(term)) {
    return true;
  }
  
  // JSON syntax characters (quotes, colons, brackets, braces)
  if (/["':{}[\],]/.test(term)) {
    return true;
  }
  
  // Common JSON property keys
  if (JSON_KEYS.has(term)) {
    return true;
  }
  
  // URL-like patterns (already caught by URL detection, but extra safety)
  // Don't exclude full URLs, but exclude domain-only if it looks generic
  if (/^(www|http|https|ftp)/.test(term.toLowerCase())) {
    return true;
  }
  
  // Email addresses
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(term)) {
    return true;
  }
  
  return false;
}

/**
 * Calculate confidence score and level for a term
 */
function calculateConfidence(
  frequency: number,
  patternScore: number,
  termLength: number
): { score: number; confidence: 'high' | 'medium' | 'low' } {
  let score = 0;
  
  // Frequency score (max 50 points)
  score += Math.min(frequency * 10, 50);
  
  // Pattern type score (30-50 points)
  score += patternScore;
  
  // Length bonus
  if (termLength >= 8) {
    score += 10;
  } else if (termLength >= 4) {
    score += 5;
  }
  
  // Assign confidence level
  let confidence: 'high' | 'medium' | 'low';
  if (score >= 70) {
    confidence = 'high';
  } else if (score >= 40) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  
  return { score, confidence };
}

/**
 * Detect high-confidence Do-Not-Translate terms from rows
 */
export function detectDntTerms(
  rows: { rowIndex: number; original: string }[],
  existingDnt: string[] = []
): AutoDetectionResult {
  
  const existingSet = new Set(existingDnt);
  
  // First pass: collect all terms with frequency counts
  // Scan ORIGINAL rows to get accurate frequency (not extracted text)
  const termFrequency = new Map<string, { count: number; reason: string; pattern: string; patternScore: number }>();
  
  rows.forEach(row => {
    const text = row.original?.trim() || '';
    if (!text) return;

    // Pattern 1: Curly brace placeholders {variable}
    const placeholders = text.match(/\{[^}]+\}/g) || [];
    placeholders.forEach(match => {
      if (!existingSet.has(match) && !shouldExcludeTerm(match)) {
        const existing = termFrequency.get(match) || { count: 0, reason: 'Placeholder variable', pattern: '{variable}', patternScore: 50 };
        existing.count++;
        termFrequency.set(match, existing);
      }
    });

    // Pattern 2: Full URLs
    const urls = text.match(/https?:\/\/[^\s<>"]+/gi) || [];
    urls.forEach(match => {
      if (!existingSet.has(match) && !shouldExcludeTerm(match)) {
        const existing = termFrequency.get(match) || { count: 0, reason: 'Full URL', pattern: 'https://...', patternScore: 50 };
        existing.count++;
        termFrequency.set(match, existing);
      }
    });

    // Pattern 3: Domain names (if not already caught as URL)
    const domains = text.match(/[a-zA-Z0-9][a-zA-Z0-9-]*\.(com|org|net|io|app|dev|co|edu|gov)\b/gi) || [];
    domains.forEach(match => {
      if (!existingSet.has(match) && !termFrequency.has(match) && !shouldExcludeTerm(match)) {
        const existing = termFrequency.get(match) || { count: 0, reason: 'Domain name', pattern: 'domain.com', patternScore: 45 };
        existing.count++;
        termFrequency.set(match, existing);
      }
    });

    // Pattern 4: Multi-word proper names (before tokenizing into words)
    const properNames = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || [];
    properNames.forEach(match => {
      if (!existingSet.has(match) && !COMMON_WORDS.has(match.split(' ')[0]) && !shouldExcludeTerm(match)) {
        const existing = termFrequency.get(match) || { count: 0, reason: 'Multi-word proper name', pattern: 'Name Name', patternScore: 50 };
        existing.count++;
        termFrequency.set(match, existing);
      }
    });

    // Pattern 5: Version numbers
    const versions = text.match(/\bv?\d+\.\d+(?:\.\d+)?\b/gi) || [];
    versions.forEach(match => {
      if (!existingSet.has(match) && !shouldExcludeTerm(match)) {
        const existing = termFrequency.get(match) || { count: 0, reason: 'Version number', pattern: 'v1.2.3', patternScore: 40 };
        existing.count++;
        termFrequency.set(match, existing);
      }
    });

    // Pattern 6: Social handles
    const handles = text.match(/@[a-zA-Z0-9_]+/g) || [];
    handles.forEach(match => {
      if (!existingSet.has(match) && !shouldExcludeTerm(match)) {
        const existing = termFrequency.get(match) || { count: 0, reason: 'Social media handle', pattern: '@handle', patternScore: 45 };
        existing.count++;
        termFrequency.set(match, existing);
      }
    });

    // Pattern 7: Hashtags (but exclude color codes like #ffffff)
    const hashtags = text.match(/#[a-zA-Z0-9_]+/g) || [];
    hashtags.forEach(match => {
      if (!existingSet.has(match) && !shouldExcludeTerm(match)) {
        const existing = termFrequency.get(match) || { count: 0, reason: 'Hashtag', pattern: '#tag', patternScore: 40 };
        existing.count++;
        termFrequency.set(match, existing);
      }
    });

    // Pattern 8-12: Context-aware word detection
    // Track capitalized words with position information
    const wordStats = new Map<string, { 
      total: number, 
      midSentence: number 
    }>();

    // Scan for capitalized words with context
    // Pattern captures: (preceding context)(capitalized word)
    const contextPattern = /(^|[.!?]\s+|[^.!?]\s+)([A-Z][a-z]+)/g;

    for (const match of text.matchAll(contextPattern)) {
      const precedingContext = match[1];
      const word = match[2];
      
      // Determine if this is mid-sentence
      // Mid-sentence = preceded by something other than start/sentence-ending punctuation
      const isMidSentence = precedingContext && 
                            precedingContext.trim().length > 0 && 
                            !/^[.!?]/.test(precedingContext.trim());
      
      const stats = wordStats.get(word) || { total: 0, midSentence: 0 };
      stats.total++;
      if (isMidSentence) stats.midSentence++;
      
      wordStats.set(word, stats);
    }

    // Now apply hybrid filtering for capitalized words
    wordStats.forEach((stats, word) => {
      // Skip if already processed or in common words
      if (existingSet.has(word) || termFrequency.has(word) || COMMON_WORDS.has(word) || shouldExcludeTerm(word)) {
        return;
      }
      
      // Skip short words
      if (word.length < 4) return;
      
      // Hybrid rule: Include if EITHER:
      // 1. High frequency (≥3 occurrences) - likely brand/product name
      // 2. Appears mid-sentence at least once - proven proper noun
      const isHighFrequency = stats.total >= 3;
      const isMidSentenceProperNoun = stats.midSentence > 0;
      
      if (isHighFrequency || isMidSentenceProperNoun) {
        const existing = termFrequency.get(word) || { 
          count: stats.total, 
          reason: isHighFrequency ? 'High-frequency proper noun' : 'Mid-sentence proper noun', 
          pattern: 'Capitalized', 
          patternScore: 30 
        };
        termFrequency.set(word, existing);
      }
    });

    // Tokenize for other patterns (ALL_CAPS, camelCase, PascalCase)
    // These don't have the sentence-start problem
    const words = text.match(/[a-zA-Z0-9_]+/g) || [];
    words.forEach(word => {
      if (existingSet.has(word) || termFrequency.has(word) || shouldExcludeTerm(word)) return;

      // ALL_CAPS with underscores (constants)
      if (/^[A-Z][A-Z0-9_]+$/.test(word) && word.length >= 3 && word.includes('_')) {
        const existing = termFrequency.get(word) || { count: 0, reason: 'ALL_CAPS constant', pattern: 'CONSTANT_NAME', patternScore: 45 };
        existing.count++;
        termFrequency.set(word, existing);
        return;
      }

      // ALL_CAPS acronyms (without underscores)
      if (/^[A-Z]{2,}$/.test(word) && word.length >= 2) {
        const existing = termFrequency.get(word) || { count: 0, reason: 'ALL_CAPS acronym', pattern: 'ACRONYM', patternScore: 40 };
        existing.count++;
        termFrequency.set(word, existing);
        return;
      }

      // Lenient PascalCase (includes CrossKnowledge, BlendedX)
      if (/^[A-Z][a-z]*[A-Z]/.test(word) && word.length >= 3) {
        const existing = termFrequency.get(word) || { count: 0, reason: 'PascalCase identifier', pattern: 'PascalCase', patternScore: 45 };
        existing.count++;
        termFrequency.set(word, existing);
        return;
      }

      // camelCase (starts lowercase, has uppercase)
      if (/^[a-z]+[A-Z]/.test(word) && word.length >= 3) {
        const existing = termFrequency.get(word) || { count: 0, reason: 'camelCase identifier', pattern: 'camelCase', patternScore: 40 };
        existing.count++;
        termFrequency.set(word, existing);
        return;
      }
    });
  });

  // Second pass: calculate scores and create candidates
  const candidates: DntCandidate[] = [];
  
  termFrequency.forEach((data, term) => {
    const { score, confidence } = calculateConfidence(
      data.count,
      data.patternScore,
      term.length
    );
    
    candidates.push({
      term,
      reason: data.reason,
      pattern: data.pattern,
      frequency: data.count,
      confidence,
      score
    });
  });

  // Sort by frequency (highest first), then by score
  candidates.sort((a, b) => {
    if (b.frequency !== a.frequency) {
      return b.frequency - a.frequency;
    }
    return b.score - a.score;
  });

  return {
    candidates,
    totalScanned: rows.length
  };
}
