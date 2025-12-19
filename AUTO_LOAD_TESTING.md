# Auto-Load Feature Testing Guide

## Overview
This document provides instructions for testing the new auto-load feature that automatically downloads and loads CKLS Learning Channel export files into the extension.

## What Was Implemented

### 1. Background Script Enhancements
- Direct file fetching from CKLS server (bypasses download system)
- UTF-8 safe text encoding using modern TextEncoder API
- Base64 encoding with proper character preservation for storage
- Automatic cleanup of old files (after 5 minutes)
- Message handlers for file checking and clearing
- No downloads appear in browser (cleaner UX)

### 3. Content Script Features
- **Export Link Interception**: Automatically intercepts clicks on Learning Channel export links
- **Toast Notification**: Minimal, clean notification that appears for 3 seconds
- **Badge Indicator**: Small blue dot on floating icon when file is ready
- **Shadow DOM**: All UI elements use isolated Shadow DOM for style encapsulation

### 4. Sidebar Integration
- Auto-loads files from storage on mount
- Properly handles XML vs XLSX encoding (XML as UTF-8 text, XLSX as binary)
- Automatically clears storage after successful load
- Seamless integration with existing file upload flow

## Testing Steps

### Prerequisites
1. Build the extension:
   ```bash
   cd "/Users/aureliendarie/Documents/Cursor_projets/AI Translate Extension"
   npm run build
   ```

2. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

### Test Scenario 1: Basic Auto-Load Flow

1. **Navigate to Learning Channel page**
   - Go to: `https://demonstration.eu.crossknowledge.com/i18n/training/training_manage_translations.php?context_classname=Training&context_id=4280`
   - (You'll need valid CKLS credentials)

2. **Click the export link**
   - Look for the download link at the bottom of the page
   - URL should contain: `export=excel`
   - Click the link

3. **Verify toast notification**
   - ✅ Toast should appear in top-right corner
   - ✅ Should show "File ready" with [Open] and [Dismiss] buttons
   - ✅ Should auto-dismiss after 3 seconds

4. **Test "Open" button**
   - Click [Open] before toast auto-dismisses
   - ✅ Sidebar should open
   - ✅ File should be automatically loaded
   - ✅ Language picker should appear with detected source language
   - ✅ No badge dot should appear

5. **Verify file is ready**
   - ✅ File should be listed in the file list
   - ✅ Should be able to select target languages and proceed

### Test Scenario 2: Badge Indicator Flow

1. **Navigate to Learning Channel page**
   - Same URL as above

2. **Click the export link**
   - Toast appears

3. **Click "Dismiss" button**
   - ✅ Toast should fade out
   - ✅ Blue badge dot should appear on floating icon (top-right of icon)

4. **Click floating icon**
   - ✅ Action menu should open
   - ✅ Badge dot should disappear

5. **Click "Translate Learning Channel"**
   - ✅ Sidebar should open
   - ✅ File should be automatically loaded

### Test Scenario 3: Auto-Dismiss Flow

1. **Navigate to Learning Channel page**
2. **Click the export link**
3. **Wait 3 seconds without clicking**
   - ✅ Toast should fade out automatically
   - ✅ Blue badge dot should appear on floating icon
   - ✅ File should remain in storage

4. **Click floating icon and open translator**
   - ✅ File should load automatically

### Test Scenario 4: Multiple Downloads

1. **Click export link**
2. **Wait for toast to appear**
3. **Click export link again** (before opening translator)
   - ✅ Old file should be replaced
   - ✅ New toast should appear
   - ✅ No duplicate files

### Test Scenario 5: Storage Cleanup

1. **Click export link**
2. **Dismiss toast** (badge appears)
3. **Wait 5+ minutes without opening translator**
4. **Click floating icon**
   - ✅ File should be cleaned up from storage
   - ✅ Badge should disappear
   - ✅ Opening translator shows empty file upload

## Visual Verification

### Toast Notification Appearance
- Position: Top-right (24px from top and right)
- Background: White
- Shadow: Subtle (0 4px 12px rgba(0,0,0,0.15))
- Content: Single line with icon, text, and two buttons
- Animation: Slides in from right, fades out when dismissed

### Badge Dot Appearance
- Position: Top-right of floating icon (4px from edges)
- Size: 10px diameter
- Color: Blue (#3b82f6)
- Border: 2px white border
- Only visible when file is ready and not viewing

### Floating Icon
- Should not pulse when file is auto-loaded (to keep it minimal)
- Badge should be clearly visible but not overwhelming

## Known Behaviors

1. **File Format**: Files are XML (despite URL parameter saying `export=excel`)
2. **No Browser Download**: File is fetched directly - won't appear in browser downloads
3. **Storage Duration**: Files auto-delete after 5 minutes if not used
4. **One File at a Time**: Only one auto-loaded file stored at once
5. **Page Specific**: Currently only works on Learning Channel pages
6. **Network Required**: Must be able to fetch from CKLS server (authenticated session required)

## Troubleshooting

### Toast doesn't appear
- Check console for errors
- Verify link URL contains `training_manage_translations.php` and `export=excel`
- Check if content script is loaded (inspect floating icon)

### File doesn't load in sidebar
- Check browser console for errors
- Verify `CHECK_AUTO_LOADED_FILE` message is being sent
- Check Chrome storage: `chrome.storage.local.get(['autoLoadedFile'])`

### Badge doesn't appear/disappear correctly
- Check if shadow root reference is being stored correctly
- Inspect shadow DOM to verify badge element exists

### Network errors
- Verify you're logged into CKLS (authentication required)
- Check browser console for CORS or network errors
- Ensure you have access to the export URL

### Source language or existing languages not detected correctly
- **FIXED**: Multiple issues resolved:
  1. **UTF-8 Encoding**: Now uses modern TextEncoder/TextDecoder API
     - Storage: `TextEncoder().encode(text)` → base64
     - Retrieval: base64 → `TextDecoder('utf-8').decode(uint8Array)`
  2. **CKLS Code Detection**: Updated `detectLangCodeFromHeader()` to recognize CKLS patterns
     - Now matches CKLS codes like "de-DE", "es-ES", "fr-FR", "pt-BR"
     - Extracts base language code (e.g., "de" from "de-DE")
     - Looks up base code in languageNames (which contains ISO codes)
     - `inferCklsFromHeader()` then converts back to full CKLS code
- This preserves all special characters, accents, and language headers correctly
- If still occurring, check browser console for file parsing errors

## Next Steps

After confirming Learning Channel works:
1. Add support for BlendedX pages
2. Add support for Homepage translation pages
3. Consider adding setting to disable auto-load
4. Add toast notification customization options

## Console Debugging

To debug in the browser console:

```javascript
// Check for auto-loaded file
chrome.storage.local.get(['autoLoadedFile'], (result) => {
  console.log('Auto-loaded file:', result);
});

// Clear auto-loaded file manually
chrome.storage.local.remove(['autoLoadedFile']);

// Check if content script is loaded
document.getElementById('ai-translate-floating-assistant');
```

