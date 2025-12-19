# CSV Review File - Status Detection Fix

## ✅ Issue Fixed

**Problem:** All strings in the CSV review file showed status "Pending", even though some translations existed in the original uploaded file (fill-empty mode).

**Root Cause:** React state (`originalTranslations`) was being updated asynchronously with `setState()`, so when `convertTranslationResultToWorkbook()` was called, it was receiving the OLD/empty value instead of the newly extracted translations.

---

## 🔧 Solution Implemented

### **Changed Approach:**
Instead of relying on React state (which updates asynchronously), we now use a **local closure variable** that captures the extracted translations immediately and passes it directly to the conversion function.

### **Code Changes:**

#### **1. In `executeDeepLTranslation()` (Step3.tsx ~line 870)**

**Before:**
```typescript
const origTranslations: Record<string, Record<string, string>> = {};
// ... extract translations ...
setOriginalTranslations(origTranslations);  // Async state update

// Later...
convertTranslationResultToWorkbook(result, langs, originalTranslations);  // OLD value!
```

**After:**
```typescript
let extractedOriginalTranslations: Record<string, Record<string, string>> = {};
// ... extract translations ...
console.log('Extracted original translations:', extractedOriginalTranslations);

// Later...
convertTranslationResultToWorkbook(result, langs, extractedOriginalTranslations);  // NEW value!
```

#### **2. Added Debug Logging**

Added console logs to track what's being extracted:
```typescript
console.log('Extracted original translations:', extractedOriginalTranslations);
console.log('Sample:', Object.keys(extractedOriginalTranslations).map(lang => 
  `${lang}: ${Object.keys(extractedOriginalTranslations[lang]).length} strings`
));
```

And in `generateCSVReviewFile()`:
```typescript
console.log('CSV Generation - alreadyTranslatedMap size:', alreadyTranslatedMap.size);
console.log('CSV Generation - originalTranslationValues size:', originalTranslationValues.size);
```

#### **3. Enhanced Status Detection Logic**

In `generateCSVReviewFile()` (WorkbookGenerator.ts ~line 2040):
```typescript
const mapKey = `${stringId}_${lang}`;
const wasAlreadyTranslated = alreadyTranslatedMap.has(mapKey);
const originalValue = originalTranslationValues.get(mapKey);

// Debug for first few entries
if (r < 5) {
    console.log(`String ${stringId} (${lang}): wasAlreadyTranslated=${wasAlreadyTranslated}, originalValue="${originalValue}"`);
}

// Set status based on tracking
let status = 'Pending';
if (wasAlreadyTranslated && originalValue) {
    status = 'From Original File';
}
```

---

## 📋 How It Works Now

### **Step 1: Extract Original Translations**
When translation starts (in `executeDeepLTranslation()`):
```typescript
// Read from state.filesData[0].workbook
// Extract "Extracted_Text" sheet
// For each target language column (starting at column 4):
//   - If cell has content → store in extractedOriginalTranslations[lang][stringId]
```

**Example Result:**
```javascript
extractedOriginalTranslations = {
  "fr-FR": {
    "T25": "Que voulez-vous apprendre ?",
    "T32": "Nos aventures Plug & Play...",
    "T36": "Apprenez tout ce qu'il faut savoir sur",
    // ... more strings
  }
}
```

### **Step 2: Pass to Workbook Conversion**
```typescript
const reviewWorkbook = convertTranslationResultToWorkbook(
  result,
  state.targetLanguagesCKLS,
  extractedOriginalTranslations  // ← Direct local variable, not async state!
);
```

### **Step 3: Build Tracking Maps**
In `convertTranslationResultToWorkbook()`:
```typescript
// For each string and language:
if (originalTranslations && originalTranslations[lang] && originalTranslations[lang][item.id]) {
    const originalValue = originalTranslations[lang][item.id];
    
    // Mark as already translated
    alreadyTranslatedMap.set(`${item.id}_${lang}`, 'true');
    originalTranslationValues.set(`${item.id}_${lang}`, originalValue);
}
```

### **Step 4: Generate CSV with Correct Status**
In `generateCSVReviewFile()`:
```typescript
const wasAlreadyTranslated = alreadyTranslatedMap.has(`${stringId}_${lang}`);
const originalValue = originalTranslationValues.get(`${stringId}_${lang}`);

// If tracked AND has original value → "From Original File"
// Otherwise → "Pending"
let status = 'Pending';
if (wasAlreadyTranslated && originalValue) {
    status = 'From Original File';
}
```

---

## 🎯 Expected Result

### **CSV Output (After Fix):**

```csv
ID,Source Text,Row Numbers,fr-FR,fr-FR Status,fr-FR Correction,Notes
T1,Hi,2,,Pending,,Newly translated
T25,What do you want to learn?,8,Que voulez-vous apprendre ?,From Original File,,Pre-existing
T32,Our Plug & Play adventures...,14,Nos aventures Plug & Play...,From Original File,,Pre-existing
T36,Learn everything to know about,18,Apprenez tout ce qu'il faut savoir sur,From Original File,,Pre-existing
T47,What are you looking for today?,7,,Pending,,Newly translated
```

### **Status Breakdown:**
- **"From Original File"** - Strings that existed in the uploaded file (fr-FR column had content)
- **"Pending"** - Strings that were newly translated by DeepL API (fr-FR column was empty)

---

## 🧪 Testing Steps

1. **Reload Extension:**
   - Go to `edge://extensions/`
   - Click refresh on "AI Translator"

2. **Prepare Test File:**
   - Use an Excel/XML file where fr-FR has some cells already filled
   - Leave some fr-FR cells empty

3. **Configure Translation:**
   - Select fr-FR as target language
   - Choose **"Fill-empty"** mode for fr-FR

4. **Translate:**
   - Upload file
   - Translate with DeepL

5. **Generate CSV:**
   - Click "Generate Client Review File"
   - Open the downloaded CSV

6. **Verify:**
   - ✅ Strings that were pre-filled show "From Original File"
   - ✅ Strings that were empty show "Pending"
   - ✅ Console logs show extraction working

---

## 🔍 Debug Information

### **Console Logs to Check:**

1. **During Translation Start:**
```
Extracted original translations: { "fr-FR": { "T25": "...", ... } }
Sample: fr-FR: 15 strings
```

2. **During CSV Generation:**
```
CSV Generation - alreadyTranslatedMap size: 15
CSV Generation - originalTranslationValues size: 15
Sample entries: ["T25_fr-FR", "T32_fr-FR", ...]
```

3. **Per-String Status:**
```
String T25 (fr-FR): wasAlreadyTranslated=true, originalValue="Que voulez-vous apprendre ?"
String T1 (fr-FR): wasAlreadyTranslated=false, originalValue=""
```

---

## 📊 Build Info

**Build Status:** ✅ Success (2.98s)  
**Exit Code:** 0  
**Bundle Size:** 440.69 kB → 119.52 kB gzipped  

---

## 🎉 Summary

The fix ensures that:
1. ✅ Original translations are captured BEFORE translation starts
2. ✅ Local variable (not async state) is used to pass data
3. ✅ Tracking maps correctly identify pre-existing vs. new translations
4. ✅ CSV shows accurate status for each string and language
5. ✅ Debug logging helps verify the extraction is working

The CSV review file will now correctly distinguish between strings that were already translated (from the original file) and strings that were newly translated by the AI! 🎉
