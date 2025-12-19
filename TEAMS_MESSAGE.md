# Microsoft Teams Channel Message - Updated

Edge Add-on extension for translating CKLS (Home Pages, Learning Channels, Blendedx, Emails, Video subtitles and Meta-Skills Avatar) using AI-powered translation APIs (DeepL, Google, or Microsoft Excel formulas).

⚠️ Note: This is a personal project to test AI translation API capabilities. It is NOT an official CrossKnowledge plugin.

---

## 📥 Download Extension

🔗 Download AI Translator.zip from SharePoint

Unzip the file to access the extension.

---

## 🚀 Quick Install (60 seconds)

1. Unzip the downloaded file
2. Open Edge → `edge://extensions/`
3. Enable Developer mode (bottom-left toggle)
4. Click "Load unpacked" → Select the unzipped folder
5. Click the extension icon to open

---

## ✨ Features

### 🎯 Core Translation Capabilities
- **Context-Aware Detection**: Automatic page detection recognizes CKLS pages (Email, Home Pages, Learning Channels, BlendedX, Meta-Skills)
- **Multi-Format Support**: 
  - Excel/XML files (Home Pages, Learning Channels, BlendedX)
  - **Video Subtitles (.srt/.vtt)** ⚠️ Alpha feature
  - Text/JSON/HTML content (Email, Meta-Skills Avatar)

### 🔄 Translation Methods
- **DeepL API** ⭐ **RECOMMENDED**: Direct translation (faster, requires API key)
  - ✅ **Free API tested and working**
  - ⚠️ **Pro API not tested yet**
  - Best translation quality and performance
- **Google Cloud Translate API**: Direct translation (requires API key)
- **Excel Builder**: Generate Excel with formulas → Calculate in Excel → Upload back → Get XML

### 📋 Advanced Features

**Translation Management:**
- **Multi-Language Glossary**: Predefine translations across multiple target languages
- **Do-Not-Translate (DNT) List**: Protect specific terms from translation (CSV/TXT import supported)
- **🤖 Auto-Detect DNT Terms**: Automatically detects and suggests terms that should not be translated:
  - Placeholder variables: `{variable}`, `{00|Job Title}`
  - URLs and domain names: `https://example.com`, `example.com`
  - Proper nouns: Multi-word names (e.g., "CrossKnowledge", "BlendedX")
  - Version numbers: `v1.2.3`, `2.0.1`
  - Social handles: `@username`, `#hashtag`
  - Technical identifiers: `PascalCase`, `camelCase`, `ALL_CAPS` constants, acronyms
  - High-frequency proper nouns detected from context
- **📚 Translation Memory (TMX)**: Reuse previous translations to save API costs
  - Import TMX files (Translation Memory eXchange format)
  - Auto-apply exact matches (configurable threshold, default 95%)
  - Fuzzy matching support (configurable threshold, default 70%)
  - Multi-language TMX support
  - Export translations as TMX files for future reuse
  - Statistics show TMX matches and API calls saved
- **Custom Translation Instructions**: Per-language translation guidelines
- **Translation Deduplication**: Automatically identifies duplicate strings to save API calls
- **Translation Metrics**: Real-time calculation of strings, characters, and API calls needed

**Overwrite Options:**
- Keep-all: Preserve existing translations
- Overwrite-empty: Only translate empty cells
- Overwrite-all: Replace all translations

**Multi-File Processing:**
- Batch process multiple Excel/XML files simultaneously
- Batch process multiple subtitle files with cross-file deduplication

### 🎬 Subtitle Features (Alpha)
- **Format Support**: .srt and .vtt files
- **BBC Standards Validation**: Automatic validation against BBC subtitle standards (37 chars/line, 2 lines max)
- **Timing Analysis**: Detects overlaps, reading speed issues, and gaps
- **Manual Subtitle Splitting Tool**: Fix timing issues before translation
- **HTML Tag Preservation**: Maintains formatting tags in subtitles
- **VTT Support**: Preserves NOTE/STYLE blocks and voice tags
- **Auto-DNT for Voice Tags**: Automatically adds voice tags to Do-Not-Translate list
- **TMX Integration**: Link TMX files to reuse previous subtitle translations
- **TMX Export**: Export translated subtitles as TMX files for future projects
- **ZIP Output**: Downloads organized by language folders (fr/, es/, etc.)

### 📝 Review Mode
- **Client Review File Generation**: Export CSV or XLSX files for client review
- **Status Tracking**: 
  - "Pending" - Newly translated by AI, needs review
  - "Approved" - Translation confirmed correct
  - "Needs Correction" - Requires fixes
  - "From Original File" - Pre-existing translation (not AI-translated)
- **Original Translation Tracking**: Distinguishes between AI-translated and pre-existing translations
- **Import Corrections**: Upload reviewed files to apply corrections automatically
- **Multi-Language Review**: Single CSV file with all languages or separate files per language

### 📊 Translation Statistics
- Real-time progress tracking
- API call savings from deduplication, glossary, fill mode, and TMX matches
- TMX match statistics (how many strings reused from translation memory)
- Character count per language
- Translation completion status

---

## ✨ How to Use

### Step 1: Upload File
Upload CKLS .xlsx/.xml/.srt/.vtt file (Home Page, Learning Channel, Blendedx, Video subtitles) → Select target languages

### Step 2: Configure Translation Rules
- Set up glossary terms
- Configure Do-Not-Translate terms:
  - **Use "Auto-detect" button** to automatically find placeholders, URLs, proper nouns, and technical terms
  - Review and accept suggested DNT terms
  - Manually add additional terms or import from CSV/TXT
- **Link Translation Memory (TMX)** (optional, for subtitles):
  - Import TMX files in Settings → Subtitles tab
  - Link a TMX file to your project
  - Configure auto-apply threshold (default: 95% for exact matches)
  - Enable fuzzy matching to see suggestions (default: 70% threshold)
- Add custom translation instructions per language
- Choose translation options (overwrite mode, etc.)

### Step 3: Choose Translation Method

**Option A: DeepL/Google API** (Direct translation - faster, requires API key)
- ⭐ **DeepL is recommended** for best translation quality
- Click "Start Translation"
- Monitor progress in real-time
- **💡 Tip**: You can browse other pages while translation is running - click on toast notifications to return to the extension
- Download translated XML files
- Generate review package for client approval

**Option B: Excel Builder** (No API needed)
- Generate Excel with TRANSLATE() or COPILOT() formulas
- Open in Excel → Wait for formulas to calculate
- Upload translated Excel back
- Generate final XML file for CKLS upload

---

## 🔑 Get Free API Keys

### DeepL ⭐ **RECOMMENDED**
🔗 Sign up: https://www.deepl.com/en/pro-api#api-pricing
- ✅ **500,000 characters/month FREE**
- ✅ **Free API tested and working**
- ⚠️ **Pro API not tested yet**
- Best translation quality and performance

### Google Cloud Translate
🔗 Sign up: https://cloud.google.com/translate
- ✅ **500,000 characters/month FREE**

### Microsoft Excel (No API needed)
- Uses Excel's built-in TRANSLATE/COPILOT functions
- Requires Microsoft 365 subscription

---

## 📋 Requirements

- Microsoft Edge (or any Chromium browser)
- For API translation: DeepL (Free API) or Google API key
- For Excel method: Microsoft Excel + Microsoft 365 subscription

---

## 🐛 Bug Reports & Feedback

Found a bug or have suggestions? Please report:

- **What happened**: Brief description of the issue
- **Steps to reproduce**: What you did before the bug occurred
- **File info**: File type, size, number of languages
- **Browser console errors**: Press F12 → Check Console tab for red errors

Post reports in this channel or message me directly. Your feedback helps improve the tool!

---

## 📌 Version Notes

- **Current Version**: v2.20251205
- **Subtitle Feature**: Alpha (fully functional but may have edge cases)
- **DeepL API**: Free tier tested ✅ | Pro tier not tested ⚠️
- **Review Mode**: Fully functional with CSV and XLSX support

