# 🚀 Quick Start - Load Extension in 60 Seconds

## Step 1: Open Edge Extensions Page (10 seconds)

1. Open **Microsoft Edge** browser
2. Type in address bar: `edge://extensions/`
3. Press Enter

## Step 2: Enable Developer Mode (5 seconds)

Look at the **bottom left corner** of the page and toggle:

```
☐ Developer mode  →  ☑ Developer mode
```

## Step 3: Load the Extension (15 seconds)

1. Click the **"Load unpacked"** button (top of page)
2. Navigate to and select this folder:
   ```
   /Users/aureliendarie/Documents/Cursor_projets/AI Translate Extension/dist
   ```
3. Click **"Select Folder"**

## Step 4: Open the Extension (5 seconds)

**Option A**: Click the extension icon in your toolbar

**Option B**: Click the puzzle piece icon (🧩) → Find "AI Translator" → Click it

## Step 5: Test It! (25 seconds)

You should see a **side panel** (400px wide) with:

- ✅ A progress stepper showing 3 steps
- ✅ "Upload & Select Languages" header
- ✅ A drag & drop file upload zone
- ✅ Clean, modern UI with Shadcn styling

### Try This Now:

1. Drag any CKLS `.xlsx` file into the upload zone
2. Watch it parse and detect the source language
3. Select some target languages from the dropdown
4. Click "Next" to proceed to Step 2

## ✅ Success! Your extension is running.

For complete testing instructions, see: **TESTING_GUIDE.md**

For technical details, see: **BUILD_SUMMARY.md**

---

## Troubleshooting

**Extension not showing?**
- Refresh the extensions page
- Check that you selected the `dist` folder (not the project root)
- Look for any error messages in red

**Side panel not opening?**
- Click the extension icon again
- Try right-click → "Open side panel"
- Check browser console (F12) for errors

**Need help?**
- Check the full **TESTING_GUIDE.md** for detailed instructions
- Look for errors in Edge DevTools (F12)
- Verify the `dist/manifest.json` file exists

---

**Happy translating! 🎉**

