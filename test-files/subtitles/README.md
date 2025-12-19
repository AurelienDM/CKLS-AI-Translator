# Subtitle Test Files

This directory contains sample subtitle files for testing the AI Translate Extension's subtitle translation feature.

## Test Files

### 1. `sample_valid.srt`
- **Purpose**: Clean, BBC-compliant subtitle file
- **Features**: 
  - 5 subtitles
  - 37 characters/line maximum
  - Proper timing with no overlaps
  - Comfortable reading speed (<21 chars/sec)
- **Use for**: Basic translation testing, verifying proper output format

### 2. `sample_with_html.srt`
- **Purpose**: Test HTML tag preservation
- **Features**:
  - Contains `<i>`, `<b>`, `<u>` tags
  - Combined formatting (bold + italic)
  - 5 subtitles
- **Use for**: Verifying HTML tags are stripped during translation and restored in output

### 3. `sample_overlap.srt`
- **Purpose**: Test timing overlap detection
- **Features**:
  - 2 overlapping subtitle pairs
  - 5 total subtitles
- **Use for**: Testing timing validation, overlap detection in Step 2

### 4. `sample_fast.srt`
- **Purpose**: Test reading speed validation
- **Features**:
  - 3 subtitles exceeding 21 chars/sec (BBC limit)
  - 2 subtitles with proper speed
- **Use for**: Testing reading speed warnings in validation

### 5. `sample.vtt`
- **Purpose**: WebVTT format with advanced features
- **Features**:
  - NOTE blocks (should be kept)
  - STYLE block (user option to keep/remove)
  - Voice tags `<v John>`, `<v Mary>` (should be kept as DNT)
  - Positioning settings `align:start position:10%`
  - 5 cues
- **Use for**: Testing VTT-specific features, voice tag DNT, positioning preservation

### 6. `sample_malformed.srt`
- **Purpose**: Test error handling
- **Features**:
  - Missing arrow separator
  - Wrong timecode separators
  - Invalid hour value (>24)
  - End time before start time
  - Missing timecode entirely
- **Use for**: Testing validation error modal, parser error handling

## Manual Testing Checklist

1. ✅ Upload single `.srt` file - verify parsing and language selection
2. ✅ Upload batch of 3 files - verify deduplication stats calculation
3. ✅ Mixed `.srt` + `.vtt` batch - verify both formats handled
4. ✅ Upload malformed file - verify validation modal appears
5. ✅ Review timing issues modal - verify overlaps and reading speed issues displayed
6. ✅ Test manual split tool - modify a long subtitle
7. ✅ Translate with glossary entries - verify glossary preservation
8. ✅ Translate with DNT terms - verify DNT preservation
9. ✅ Download ZIP - verify language folder structure
10. ✅ Verify settings persistence - change settings, reload page, verify retained

## Expected Behavior

### Validation
- `sample_malformed.srt` should trigger validation modal with 4-5 errors
- `sample_overlap.srt` should show 2 timing issues in Step 2 modal
- `sample_fast.srt` should show 3 reading speed warnings

### Translation
- All HTML tags in `sample_with_html.srt` should be preserved
- Voice tags in `sample.vtt` should appear in DNT list automatically
- Deduplication should reduce API calls for repeated subtitle texts

### Output
- ZIP should contain language-specific folders (e.g., `fr/`, `es/`, `de/`)
- Each folder should contain all translated subtitle files
- SRT files should maintain `.srt` extension
- VTT files should maintain `WEBVTT` header and structure

