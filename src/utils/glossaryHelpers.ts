import { TRANSLATOR_TO_CKLS_DEFAULT } from './languageMapping';

/**
 * Match a glossary language code from a file to a selected target CKLS code
 * Handles various input formats:
 * - Exact CKLS codes: "fr-FR" → "fr-FR"
 * - ISO codes: "fr" → "fr-FR" (if fr-FR is selected)
 * - Language names: "French" → "fr-FR"
 * - Case insensitive matching
 * 
 * @param inputCode - Language code from glossary file (e.g., "fr", "fr-FR", "French")
 * @param selectedTargets - Array of CKLS codes selected in Step 1 (e.g., ["fr-FR", "de-DE"])
 * @param languageNames - Map of ISO codes to language names (e.g., {"fr": "French"})
 * @returns Matched CKLS code or null if no match found
 */
export function matchGlossaryLanguage(
  inputCode: string,
  selectedTargets: string[],
  languageNames: Record<string, string>
): string | null {
  if (!inputCode || !selectedTargets.length) return null;
  
  const normalized = inputCode.trim().toLowerCase();
  
  // 1. Try exact match (case-insensitive)
  const exactMatch = selectedTargets.find(t => t.toLowerCase() === normalized);
  if (exactMatch) {
    console.log(`  ✓ Exact match: "${inputCode}" → "${exactMatch}"`);
    return exactMatch;
  }
  
  // 2. Try base language matching (e.g., "en" → "en-GB")
  const baseCode = normalized.split(/[-_]/)[0];
  const baseMatch = selectedTargets.find(t => t.toLowerCase().startsWith(baseCode + '-'));
  if (baseMatch) {
    console.log(`  ✓ Base match: "${inputCode}" (${baseCode}) → "${baseMatch}"`);
    return baseMatch;
  }
  
  // 3. Try matching by language name (e.g., "French" → "fr-FR")
  for (const [isoCode, name] of Object.entries(languageNames)) {
    if (name.toLowerCase() === normalized) {
      // Find the CKLS code in selected targets that starts with this ISO code
      const cklsMatch = selectedTargets.find(t => t.toLowerCase().startsWith(isoCode + '-'));
      if (cklsMatch) {
        console.log(`  ✓ Name match: "${inputCode}" (${name}) → "${cklsMatch}"`);
        return cklsMatch;
      }
    }
  }
  
  // 4. Try using TRANSLATOR_TO_CKLS_DEFAULT mapping (e.g., "pt" → "pt-BR")
  const mappedCkls = TRANSLATOR_TO_CKLS_DEFAULT[normalized] || TRANSLATOR_TO_CKLS_DEFAULT[baseCode];
  if (mappedCkls) {
    const mappedMatch = selectedTargets.find(t => t.toLowerCase() === mappedCkls.toLowerCase());
    if (mappedMatch) {
      console.log(`  ✓ Mapping match: "${inputCode}" → "${mappedCkls}" → "${mappedMatch}"`);
      return mappedMatch;
    }
  }
  
  // 5. No match found
  console.log(`  ✗ No match for: "${inputCode}"`);
  return null;
}

