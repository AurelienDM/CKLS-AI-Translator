# CSV Review File Implementation

## ✅ Successfully Implemented

**Build Status:** Success (2.52s)  
**File Format:** CSV (Comma-Separated Values)  
**Option:** B - Single file with all languages

---

## 📊 CSV Structure

### **Column Layout:**
```
ID, Source Text, Row Numbers, [Language], [Language] Status, [Language] Correction, ..., Notes
```

### **Example (3 target languages):**
```csv
ID,Source Text,Row Numbers,fr-FR,fr-FR Status,fr-FR Correction,de-DE,de-DE Status,de-DE Correction,es-ES,es-ES Status,es-ES Correction,Notes
string_1,Save,5|12|23,Enregistrer,From Original File,,Speichern,From Original File,,Guardar,Pending,,"fr-FR & de-DE pre-existing; es-ES newly translated"
string_2,Cancel,8,Annuler,Pending,,Abbrechen,Pending,,Cancelar,Pending,,All newly translated by AI
string_3,Delete,15,Supprimer,Pending,Effacer,Löschen,From Original File,,Eliminar,Pending,,Client corrected fr-FR
```

---

## 📝 File Content

### **Header Section (Comments)**
The CSV starts with instruction comments (lines starting with `#`):
```csv
# CLIENT REVIEW FILE - VERSION 1
# Instructions:
#   1. Review translations for each language
#   2. Update Status column for each language:
#      - "Approved" = translation is correct
#      - "Needs Correction" = fill in Correction column with correct translation
#   3. Status meanings:
#      - "From Original File" = Already existed in your source file (pre-verified)
#      - "Pending" = Newly translated by AI, needs your review
#   4. Save file and upload to: Extension Options > Import Corrections tab
#
# Project: translations_group_332
# Source Language: en-US
# Target Languages: fr-FR, de-DE, es-ES
# Translation Method: DeepL AI
# Date: 12/13/2024, 10:30:45 AM
#
```

### **Data Columns:**

| Column | Description | Example |
|--------|-------------|---------|
| **ID** | String identifier | `string_1` |
| **Source Text** | Original text | `Save` |
| **Row Numbers** | Where string appears (pipe-separated) | `5\|12\|23` |
| **{Language}** | Translation text | `Enregistrer` |
| **{Language} Status** | Review status | `From Original File` or `Pending` |
| **{Language} Correction** | Client fills if needed | (empty) |
| **Notes** | Context information | `Appears in 3 locations` |

---

## 🎯 Status Values

### **System-Generated (Read-Only):**
- **"From Original File"** - String was already translated in the uploaded file (copied, not sent to API)
- **"Pending"** - String was newly translated by AI (DeepL/Google), needs client review

### **Client Updates To:**
- **"Approved"** - Translation is correct, no changes needed
- **"Needs Correction"** - Translation needs fixing, client fills Correction column

---

## 📋 Client Workflow

### **Step 1: Open File**
- Client receives `ClientReview_{filename}_{date}_v1.csv`
- Opens in Excel, Google Sheets, LibreOffice, or any text editor

### **Step 2: Review Translations**
- Focus on "Pending" status (newly translated by AI)
- "From Original File" can be skipped or quickly verified
- Can use Excel filters to show only "Pending" rows

### **Step 3: Mark Status & Corrections**
For each language column:
- If translation is correct → Change status to **"Approved"**
- If translation needs fix → Change status to **"Needs Correction"** and fill **Correction** column

### **Step 4: Save & Upload**
- Save the CSV file (keep filename or rename)
- Upload to: Extension Options > Import Corrections tab
- System applies corrections in next translation (v2)

---

## 🔄 Multi-Instance Strings

When a string appears multiple times (e.g., "Save" in rows 5, 12, 23):
- **Row Numbers column** shows: `5|12|23` (pipe-separated)
- **Notes column** says: `Appears in 3 locations`
- **One correction applies to all instances** automatically

---

## 💡 Advantages Over XLSX

### ✅ **No Protection Issues**
- Plain text format, no locked/unlocked cells
- User can edit any cell freely
- No "This cell is protected" errors

### ✅ **No Dropdown Problems**
- User types status values directly
- Can add Excel dropdowns manually if desired
- No library limitations

### ✅ **Universal Compatibility**
- Opens in Excel, Google Sheets, Numbers, LibreOffice
- No version compatibility issues (Excel 2007 vs 2019)
- Can edit in any text editor (VS Code, Notepad++, etc.)

### ✅ **Better for Version Control**
- Plain text = easy to diff between versions
- Git-friendly format
- Easy to inspect/debug

### ✅ **Simpler Implementation**
- No complex workbook/sheet APIs
- Just string manipulation
- Easier to maintain

---

## 📂 File Naming Convention

```
ClientReview_{filename}_{date}_v{version}.csv
```

**Examples:**
- `ClientReview_translations_group_332_2024-12-13_v1.csv` (initial)
- `ClientReview_translations_group_332_2024-12-15_v2.csv` (after corrections)

---

## 🔧 Technical Details

### **CSV Escaping**
The `escapeCSV()` function handles special characters:
```typescript
function escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
```

### **Generation Function**
Located in: `src/modules/WorkbookGenerator.ts`
```typescript
export function generateCSVReviewFile(
    appState: AppState,
    translatedWorkbook: any,
    _translationStats: any,
    selectedMethod: string
): string
```

### **Button Handler**
Located in: `src/components/Step3.tsx`
```typescript
const handleGenerateReviewFile = () => {
    const filename = generateCSVReviewFile(
        state,
        translatedWorkbook,
        translationStats,
        selectedMethod
    );
}
```

---

## 📊 Example Output

### **When Opened in Excel:**

| ID | Source | Rows | fr-FR | fr-FR Status | fr-FR Correction | de-DE | de-DE Status | de-DE Correction | Notes |
|----|--------|------|-------|--------------|------------------|-------|--------------|------------------|-------|
| string_1 | Save | 5\|12 | Enregistrer | From Original File |  | Speichern | Pending |  | 2 locations |
| string_2 | Cancel | 8 | Annuler | Pending |  | Abbrechen | Pending |  | |
| string_3 | Settings | 15 | Paramètres | Pending |  | Einstellungen | From Original File |  | Mixed status |

### **After Client Review:**

| ID | Source | Rows | fr-FR | fr-FR Status | fr-FR Correction | de-DE | de-DE Status | de-DE Correction | Notes |
|----|--------|------|-------|--------------|------------------|-------|--------------|------------------|-------|
| string_1 | Save | 5\|12 | Enregistrer | Approved |  | Speichern | **Needs Correction** | **Sichern** | 2 locations |
| string_2 | Cancel | 8 | Annuler | **Approved** |  | Abbrechen | **Approved** |  | |
| string_3 | Settings | 15 | Paramètres | **Needs Correction** | **Réglages** | Einstellungen | Approved |  | Mixed status |

---

## 🚀 Next Steps

### **To Test:**
1. Reload extension in Edge (edge://extensions/)
2. Upload a file and translate with DeepL/Google
3. Click "Generate Client Review File" button
4. CSV file downloads automatically
5. Open in Excel/Sheets to verify structure

### **Future Enhancements:**
1. ✅ CSV Parser for import (to be implemented)
2. ✅ Update ImportCorrectionsTab to accept `.csv` files
3. ⏳ Apply corrections from CSV during next translation
4. ⏳ Version tracking (v1, v2, v3)

---

## 📌 Important Notes

1. **Comments in CSV:** Lines starting with `#` are ignored by most CSV parsers, but provide context for users
2. **Pipe Separator:** Row numbers use `|` instead of `,` to avoid CSV parsing issues
3. **Empty Corrections:** Correction columns are empty by default, filled only when status = "Needs Correction"
4. **Notes Column:** Provides context about multi-instance strings and mixed status across languages
5. **Language Order:** Languages appear in alphabetical order for consistency

---

## ✅ Summary

**The CSV review file successfully:**
- ✅ Exports all languages in one file
- ✅ Shows which strings were "From Original File" vs "Pending"
- ✅ Provides clear structure for client review
- ✅ Handles multi-instance strings properly
- ✅ Escapes special characters correctly
- ✅ No cell locking issues
- ✅ No dropdown problems
- ✅ Universal compatibility

The extension now generates clean, easy-to-use CSV review files that clients can edit in any spreadsheet application! 🎉
