# AI Translator - CKLS Translation Tool

A professional Microsoft Edge extension for translating CKLS (CrossKnowledge Learning Suite) content using AI-powered translation and Excel formula generation.

![Version](https://img.shields.io/badge/version-2.20251208-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)
![Platform](https://img.shields.io/badge/platform-Edge%20%7C%20Chrome-orange)

## ✨ Features

- **📤 Drag & Drop Upload** - Support for `.xlsx` and `.xml` CKLS files
- **🌍 Multi-Language Support** - Automatic language detection with CKLS code mapping
- **📚 Glossary Management** - Multi-language glossary with import/export functionality
- **🚫 Do-Not-Translate Lists** - Exclude specific terms from translation
- **📝 Custom Instructions** - Per-language translation instructions
- **⚡ Excel Formula Generation** - TRANSLATE() or COPILOT() formulas for Excel
- **📦 XML Export** - Generate ready-to-upload XML files for CKLS

## 🚀 Installation

### Load Extension in Microsoft Edge

1. **Open Edge Extensions Page**
   - Open Microsoft Edge browser
   - Type `edge://extensions/` in the address bar
   - Press Enter

2. **Enable Developer Mode**
   - Look at the **bottom left corner** of the page
   - Toggle **Developer mode** to ON

3. **Load the Extension**
   - Click **"Load unpacked"** button (top of page)
   - Navigate to and select the `dist` folder from this project
   - Click **"Select Folder"**

4. **Open the Extension**
   - Click the extension icon in your toolbar, OR
   - Click the puzzle piece icon (🧩) → Find "AI Translator" → Click it

The extension will open as a **side panel** (400px wide).

### Load Extension in Google Chrome

1. Navigate to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist` folder
4. Click the extension icon to open

## 📖 How to Use

### Complete Workflow

1. **Step 1: Upload & Select Languages**
   - Drag & drop your CKLS Excel/XML file
   - Source language is auto-detected
   - Select target languages from the dropdown

2. **Step 2: Configure Translation Rules**
   - Set up glossary terms (predefined translations)
   - Add Do-Not-Translate terms
   - Configure custom instructions per language
   - Choose TRANSLATE or COPILOT mode
   - Select overwrite options

3. **Step 3: Generate & Translate**
   - **Phase 1**: Download Excel with translation formulas
   - **Phase 2**: Open in Excel Desktop/Online, wait for formulas to calculate
   - **Phase 3**: Upload the translated Excel back to the extension
   - **Phase 4**: Download the final XML file

4. **Upload to CKLS**
   - Import the generated XML file into your CKLS platform

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Build Commands

```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run dev:clean    # Clean build + start dev server
npm run build        # Build for production (creates dist/)
npx tsc -b           # Type check only
```

### Tech Stack

- **Framework**: React 19 + TypeScript
- **UI Library**: Shadcn UI (Tailwind CSS v3)
- **Build Tool**: Vite 7
- **Extension Type**: Side Panel (Manifest V3)
- **Libraries**: SheetJS (XLSX), JSZip

## 📁 Project Structure

```
AI Translate Extension/
├── dist/                    # Production build (load this in Edge)
├── src/
│   ├── components/          # React components
│   ├── contexts/            # Global state (AppContext)
│   ├── modules/             # Core logic (FileHandler, WorkbookGenerator, etc.)
│   ├── utils/               # Utility functions
│   └── types/               # TypeScript definitions
├── public/
│   ├── manifest.json        # Extension configuration
│   ├── lib/                 # Local libraries (xlsx, jszip)
│   └── icons/               # Extension icons
└── docs/                    # Documentation files
```

## 📚 Documentation

Additional documentation is available in the `docs/` folder:

- [Quick Start Guide](docs/QUICK_START.md) - Get started in 60 seconds
- [Testing Guide](docs/TESTING_GUIDE.md) - Comprehensive testing instructions
- [Build Summary](docs/BUILD_SUMMARY.md) - Technical build details
- [Debugging Guide](docs/DEBUGGING_GUIDE.md) - Troubleshooting help

## 🐛 Troubleshooting

**Extension not showing?**
- Refresh the extensions page
- Ensure you selected the `dist` folder (not the project root)
- Check for error messages in red

**Side panel not opening?**
- Click the extension icon again
- Try right-click → "Open side panel"
- Check browser console (F12) for errors

**Formulas not calculating?**
- Requires Excel Desktop or Excel Online with internet connection
- Wait a few seconds for formulas to populate

## 📄 License

Private - Internal use only

---

**Happy translating! 🎉**
