# AI Translator Extension - Testing Guide

## ✅ Build Complete!

The extension has been successfully built and is ready to test in Edge.

## Quick Start: Load in Edge Browser

### 1. Open Edge Extensions Page
- Open Microsoft Edge browser
- Navigate to: `edge://extensions/`
- **Toggle "Developer mode"** (bottom left corner)

### 2. Load the Extension
- Click **"Load unpacked"** button
- Navigate to and select the `dist` folder:
  ```
  /Users/aureliendarie/Documents/Cursor_projets/AI Translate Extension/dist
  ```
- Extension will appear in your extensions list

### 3. Open the Side Panel
- Click the extension icon in your toolbar (or from extensions menu)
- Side panel (400px width) will open on the right side
- You should see the 3-step progress stepper

## Testing Checklist

### ✅ Step 1: File Upload & Language Selection

**Test: Upload .xlsx file**
1. Drag & drop or click to upload a CKLS Excel file
2. ✓ File name displays correctly
3. ✓ Workbook parses successfully
4. ✓ Source language detected correctly
5. ✓ Language list populates with names + CKLS codes (e.g., "French (fr-FR)")
6. ✓ Can select multiple target languages
7. ✓ Selected languages show as removable badges
8. ✓ "Next" button becomes enabled

**Test: Navigation Persistence**
1. Navigate to Step 2
2. Navigate back to Step 1
3. ✓ Uploaded file info persists
4. ✓ Selected languages persist and display correctly

### ✅ Step 2: Translation Rules & Glossary

**Test Translation Summary:**
- ✓ Metrics calculate and display (strings, characters, languages)
- ✓ Character counts are accurate
- ✓ Shows correct number of target languages

**Test Multi-Language Glossary:**
1. ✓ Shows input fields for each selected target language
2. ✓ Can add entries with translations for multiple languages
3. ✓ Can remove entries
4. ✓ Download template button creates CSV with correct columns
5. ✓ Import CSV works with multi-language entries
6. ✓ Only entries matching selected languages are imported

**Test Do-Not-Translate:**
- ✓ Can add/remove terms
- ✓ Can import from CSV/TXT
- ✓ Terms persist across navigation

**Test Custom Instructions:**
- ✓ Toggle switch works (TRANSLATE ↔ COPILOT)
- ✓ Shows one instruction field per target language
- ✓ Instructions persist

**Test Overwrite Options:**
- ✓ Can select different modes (keep-all, overwrite-empty, overwrite-all)
- ✓ Selection persists

### ✅ Step 3: Excel Builder Workflow

**Phase 1: Generate Excel**
1. ✓ "Generate Excel File" button works
2. ✓ File downloads with correct name format: `originalname__open-in-excel.xlsx`
3. ✓ File name uses uploaded file name (not cell D2)
4. Open in Excel and verify:
   - ✓ Sheet "Original" contains source data
   - ✓ Sheet "Extracted_Text" has correct structure
   - ✓ Formulas are correct (TRANSLATE or COPILOT)
   - ✓ Glossary entries use direct text (no formulas)
   - ✓ DNT terms are excluded from extraction
5. ✓ Formulas auto-calculate in Excel
6. ✓ UI advances to Phase 2 instructions

**Phase 2: Upload Translated Excel**
1. Save the Excel file after formulas calculate
2. ✓ Upload button accepts .xlsx files
3. ✓ Validates file has required sheets
4. ✓ Shows uploaded file name
5. ✓ UI advances to Phase 3

**Phase 3: Generate Final XML**
1. ✓ "Generate Final XML" button works
2. ✓ File downloads with format: `originalname__upload-to-ckls.xml`
3. Open XML and verify:
   - ✓ Contains "Feuille1" sheet
   - ✓ Translations are in correct CKLS language columns
   - ✓ HTML is properly reconstructed
   - ✓ Language code mapping is correct (MS → CKLS)
4. ✓ Success message displays
5. ✓ "Start Over" button resets to Phase 1

### ✅ Persistence Test (chrome.storage)

1. Add glossary entries
2. Add DNT terms
3. Set custom instructions
4. Select overwrite mode
5. Close side panel
6. Close Edge browser completely
7. Reopen browser and extension
8. Verify all settings persisted:
   - ✓ Glossary entries intact
   - ✓ DNT terms intact
   - ✓ Custom instructions intact
   - ✓ Overwrite mode intact

**Note:** File uploads and workbook data should NOT persist (by design).

### ✅ Error Handling

- ✓ Upload invalid file → Shows clear error message
- ✓ Upload Excel without required sheets → Shows validation error
- ✓ Generate without selecting languages → Shows requirement message

### ✅ Edge Cases

- ✓ Very long file names
- ✓ Special characters in file names
- ✓ Files with many languages (10+)
- ✓ Large files (1000+ strings)
- ✓ Empty glossary entries

## Troubleshooting

### Extension won't load
- Check that you selected the `dist` folder (not the project root)
- Check browser console for errors
- Verify manifest.json is in dist folder

### Side panel doesn't open
- Check that "Side Panel" is the default action in manifest.json
- Try clicking the extension icon multiple times
- Check Edge extension permissions

### Files not downloading
- Check browser download permissions
- Check for popup blockers
- Look in Edge Downloads folder

### Formulas not calculating in Excel
- Open in Excel Desktop (not Excel Online for first calculation)
- Wait a few minutes for formulas to calculate
- Enable "Enable Content" if prompted
- Check internet connection (formulas call Microsoft APIs)

### Storage not persisting
- Check chrome.storage permissions in manifest.json
- Check browser console for storage errors
- Try clearing extension storage and re-adding data

## Known Limitations

1. **DeepL/Google Translation**: Not yet implemented (UI placeholders only)
2. **Multi-file mode**: Not yet implemented
3. **Formula calculation**: Requires Excel Desktop or Excel Online with good internet connection
4. **API keys**: No validation UI yet for DeepL/Google APIs

## Next Steps

After verifying all tests pass:

1. **Production Use**: Extension is ready for real-world translation workflows
2. **DeepL/Google Integration**: Implement if API-based translation is needed
3. **Documentation**: Create user guide for non-technical users
4. **Distribution**: Package for internal distribution or Edge Add-ons store

## File Structure

```
dist/
├── index.html          # Extension entry point
├── manifest.json       # Extension configuration
├── assets/
│   ├── index.js       # Compiled React app
│   └── index.css      # Compiled styles
├── lib/
│   ├── xlsx.full.min.js   # Excel library
│   └── jszip.min.js       # ZIP library
└── icons/
    ├── icon16.png     # Toolbar icon
    ├── icon48.png     # Extensions page
    └── icon128.png    # Chrome Web Store
```

## Success Criteria

✅ Extension loads without errors in Edge
✅ Side panel opens and displays correctly  
✅ Complete workflow: Upload → Configure → Generate Excel → Upload → Generate XML
✅ File naming uses original file name throughout
✅ Persistence works correctly via chrome.storage
✅ No critical bugs blocking usage
✅ Ready for real-world use with Excel Builder

---

**Version**: 1.0.1  
**Last Updated**: November 19, 2025  
**Status**: ✅ Build Complete - Ready for Testing

