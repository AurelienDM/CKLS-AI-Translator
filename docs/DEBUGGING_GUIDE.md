# Debugging Guide for Auto-Load Feature

## Recent Changes

### 1. Added Debug Logging for Language Detection
**File:** `src/modules/FileHandler.ts`

Added console logging to see exactly what XLSX.read() returns when parsing XML files:

```typescript
console.log('=== LANGUAGE DETECTION DEBUG ===');
console.log('Header array:', header);
console.log('Header length:', header.length);
console.log('Column D (index 3):', header[3]);
console.log('Column E (index 4):', header[4]);
console.log('Column F (index 5):', header[5]);
console.log('================================');
```

### 2. Strengthened Link Click Interception
**File:** `public/content.js`

Improved click prevention to stop browser download:
- Added `e.stopImmediatePropagation()` - stops ALL event handlers
- Added `return false` - extra prevention
- Already using capture phase (`true`) to intercept early

## Testing Instructions

### Step 1: Rebuild the Extension

```bash
cd "/Users/aureliendarie/Documents/Cursor_projets/AI Translate Extension"
npm run build
```

### Step 2: Reload Extension in Chrome
1. Go to `chrome://extensions/`
2. Find "AI Translator - CKLS Translation Tool"
3. Click the reload icon 🔄

### Step 3: Test Auto-Load Feature

1. **Navigate to Learning Channel page**
   - Example: `https://demonstration.eu.crossknowledge.com/i18n/training/training_manage_translations.php?context_classname=Training&context_id=4280`

2. **Open Browser Console**
   - Press F12 or Right-click → Inspect
   - Go to "Console" tab
   - Keep it open to see debug logs

3. **Click the export link**
   - Look for link containing `export=excel`
   - Click it

4. **Observe the results:**

   ✅ **Expected Behavior:**
   - No file download in browser
   - Toast notification appears: "✅ File ready [Open] [Dismiss]"
   - Console shows debug logs starting with `=== LANGUAGE DETECTION DEBUG ===`

   ❌ **If file downloads:**
   - Link interception failed
   - Check console for errors
   - Verify content.js is loaded

5. **Check Console Output**

   You should see something like:
   ```
   === LANGUAGE DETECTION DEBUG ===
   Header array: ['source_id', 'Context', 'Field', 'fr-FR', 'en-GB', 'it-IT']
   Header length: 6
   Column D (index 3): fr-FR
   Column E (index 4): en-GB
   Column F (index 5): it-IT
   ================================
   Detecting existing languages from columns 4+...
     Column 4: "en-GB"
       → Detected MS code: en
       → Inferred CKLS code: en-GB
       → Added to existing languages
     Column 5: "it-IT"
       → Detected MS code: it
       → Inferred CKLS code: it-IT
       → Added to existing languages
   Final existing languages: ['en-GB', 'it-IT']
   ```

6. **Click "Open" in Toast**
   - Sidebar should open
   - File should auto-load
   - Language picker should appear

7. **Verify Language Detection**
   - Check that Source Language shows correctly (e.g., fr-FR)
   - Check that Existing Languages are listed (e.g., en-GB, it-IT)

## What to Report

### If Link Still Downloads:
- Does console show any errors?
- Does the toast appear at all?
- Is content.js loaded? (Check Sources tab in DevTools)

### If Existing Languages Don't Show:
- Copy the entire console debug output
- Specifically the header array values
- Check if they're empty, undefined, or wrong values

### If Everything Works:
- Report success! 🎉
- We can then remove the debug logging

## Common Issues

### Issue: Console shows empty header array
**Cause:** XML not parsed correctly by XLSX.read()
**Fix:** May need to add specific XML parsing options

### Issue: Header array has undefined values
**Cause:** XML structure different than expected
**Fix:** May need to adjust column indices or add defval option

### Issue: Link still downloads despite interception
**Cause:** CKLS might use JavaScript redirect or form submit
**Fix:** May need to intercept at a different level or use different approach

## Next Steps After Testing

Based on your console output, we can:
1. Fix the actual root cause if header array is wrong
2. Remove debug logging if everything works
3. Add additional handling if edge cases are found

