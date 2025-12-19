# Enhanced Glossary Matching - Test Guide

## Implementation Summary

The glossary system has been enhanced to support:
1. **Full text matching** (existing behavior preserved)
2. **Multi-word phrase matching** (prioritized)
3. **Individual word matching** within sentences

## Files Modified

### Core Functions
- `src/utils/textExtraction.ts` - Added:
  - `GlossarySubstitution` interface
  - `applyGlossarySubstitutions()` function
  - `restoreGlossarySubstitutions()` function

### Translation Modules Updated
- `src/modules/GoogleTranslator.ts` - Google Translate API
- `src/modules/DeepLTranslator.ts` - DeepL API
- `src/modules/MultiFileTranslator.ts` - Multi-file Google translation
- `src/modules/MultiFileDeepLTranslator.ts` - Multi-file DeepL translation
- `src/modules/WorkbookGenerator.ts` - Excel workbook generation

## How It Works

### Example Scenario

**Glossary Entries:**
```
Entry 1: "water"
  - en-US: "water"
  - fr-FR: "eau"
  - es-ES: "agua"

Entry 2: "drink water"
  - en-US: "drink water"
  - fr-FR: "boire de l'eau"
  - es-ES: "beber agua"
```

**Input Text:** "I need to drink water every day"

**Processing Steps:**

1. **Check for full match**: ❌ No exact match for entire sentence
2. **Sort glossary terms by length** (longest first):
   - "drink water" (11 chars)
   - "water" (5 chars)
3. **Apply substitutions**:
   - Match "drink water" → Replace with `__GLOSS_0__`
   - Result: "I need to __GLOSS_0__ every day"
   - Substitutions: `{"__GLOSS_0__": "boire de l'eau"}` (for French)
4. **Send to translation API**: "I need to __GLOSS_0__ every day"
5. **Receive translation**: "J'ai besoin de __GLOSS_0__ tous les jours"
6. **Restore substitutions**: Replace `__GLOSS_0__` with "boire de l'eau"
7. **Final result**: "J'ai besoin de boire de l'eau tous les jours"

## Testing Instructions

### Prerequisites
1. Load the extension in your browser
2. Navigate to Settings → Glossary

### Test Case 1: Single Word in Sentence

**Setup:**
1. Add glossary entry:
   - en-US: "water"
   - fr-FR: "eau"

**Steps:**
1. Go to Step 1
2. Input text: "Please bring me some water"
3. Select source: en-US, target: fr-FR
4. Go to Step 2 (ensure glossary is loaded)
5. Go to Step 3 and translate with Google or DeepL

**Expected Result:**
- The word "water" should be translated as "eau" from the glossary
- Result should be something like: "S'il vous plaît, apportez-moi de l'eau"

### Test Case 2: Multi-Word Phrase Priority

**Setup:**
1. Add two glossary entries:
   - Entry 1: "water" → "eau"
   - Entry 2: "mineral water" → "eau minérale"

**Steps:**
1. Input text: "I prefer mineral water"
2. Translate to French

**Expected Result:**
- "mineral water" phrase should be matched (not just "water")
- Result: "Je préfère eau minérale"

### Test Case 3: Full Text Match

**Setup:**
1. Add glossary entry with complete sentence:
   - en-US: "Hello world"
   - fr-FR: "Bonjour le monde"

**Steps:**
1. Input text: "Hello world"
2. Translate to French

**Expected Result:**
- Entire text matches glossary entry
- Result: "Bonjour le monde" (no API call needed)

### Test Case 4: Case Sensitivity

**Setup:**
1. Add glossary entry:
   - en-US: "water"
   - fr-FR: "eau"

**Steps:**
1. Input text: "Water is essential"
2. Translate to French

**Expected Result:**
- "Water" (capitalized) should NOT match "water" (lowercase) due to case-sensitive matching
- Regular translation should occur

**Note:** This is the intended behavior based on user preference (option B - case-sensitive).

### Test Case 5: Excel Workbook Generation

**Setup:**
1. Add glossary entry:
   - en-US: "water"
   - fr-FR: "eau"

**Steps:**
1. Upload CKLS file with cell containing "water"
2. Generate Phase 1 Excel workbook
3. Open the generated Excel file

**Expected Result:**
- If "water" appears alone in a cell, it should be pre-filled with "eau" (no formula)
- If "water" appears in a sentence, a translation formula should be generated

### Test Case 6: Multi-File Translation

**Setup:**
1. Add glossary entry:
   - en-US: "water"
   - fr-FR: "eau"

**Steps:**
1. Upload multiple CKLS files containing the word "water"
2. Translate with deduplication enabled

**Expected Result:**
- "water" should be translated as "eau" from glossary
- Should only query the glossary once (deduplication working)

## Verification Checklist

- [ ] Single words within sentences use glossary
- [ ] Multi-word phrases are prioritized over single words
- [ ] Full text matches work (existing behavior)
- [ ] Case sensitivity works as expected
- [ ] Excel workbook pre-fills glossary matches
- [ ] Multi-file deduplication preserves glossary matches
- [ ] Both Google Translate and DeepL use enhanced glossary
- [ ] No regression in existing glossary functionality

## Technical Verification

### Code Pattern Verification

All translation modules should follow this pattern:

```typescript
// 1. Apply glossary substitutions
const glossaryResult = applyGlossarySubstitutions(
  sourceText,
  sourceCKLS,
  targetLang,
  predefinedTranslations
);

// 2. Handle full matches
if (glossaryResult.hasSubstitutions && 
    glossaryResult.processedText === "__GLOSSARY_FULL__") {
  return glossaryResult.substitutions["__GLOSSARY_FULL__"];
}

// 3. Translate with placeholders
const translated = await translateAPI(glossaryResult.processedText, ...);

// 4. Restore substitutions
if (glossaryResult.substitutions) {
  translated = restoreGlossarySubstitutions(translated, glossaryResult.substitutions);
}
```

### Files to Verify Pattern

- ✅ GoogleTranslator.ts (lines ~308-370)
- ✅ DeepLTranslator.ts (lines ~268-320)
- ✅ MultiFileTranslator.ts (lines ~91-145)
- ✅ MultiFileDeepLTranslator.ts (lines ~73-125)
- ✅ WorkbookGenerator.ts (lines ~167-195, ~303-335)

## Known Limitations

1. **Excel Workbook Partial Matches**: When generating Excel workbooks, only full text matches are pre-filled. Partial matches (words within sentences) still use formulas since Excel can't handle the placeholder restoration.

2. **Case Sensitivity**: Currently set to case-sensitive matching. To change to case-insensitive, modify the regex patterns in `applyGlossarySubstitutions()` to include the 'i' flag.

3. **Placeholder Conflicts**: If source text naturally contains strings like `__GLOSS_0__`, it could cause conflicts. This is extremely unlikely but worth noting.

## Success Criteria

✅ All files compile without errors (verified)
✅ No linter errors (verified)
✅ Enhanced glossary functions properly integrated
✅ Backward compatibility maintained (full text matching still works)
✅ Multi-word phrases prioritized correctly (longest first sort)
✅ Case-sensitive matching implemented as requested

## Next Steps for User

1. Reload the browser extension
2. Run the test cases above
3. Verify that glossary entries are now matched within sentences
4. Report any issues or unexpected behavior

---

**Implementation Date:** November 26, 2025
**Implementation Status:** Complete
**Test Status:** Ready for manual testing

