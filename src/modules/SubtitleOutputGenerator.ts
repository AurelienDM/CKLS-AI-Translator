/**
 * Subtitle Output Generator
 * Generates .srt and .vtt subtitle files with translations
 */

import JSZip from 'jszip';
import type { SubtitleTranslationResult, SubtitleSettings, SrtSubtitle, VttSubtitle, VttMetadata } from '@/types/subtitle';
import { applyLineBreakStrategy } from '@/utils/subtitleHelpers';

// Debug flag - set to true to enable detailed output generation logging
const DEBUG_SUBTITLE_OUTPUT = false;

/**
 * Generate SRT file content
 */
export function generateSrtContent(
  subtitles: SrtSubtitle[],
  settings: SubtitleSettings
): string {
  if (DEBUG_SUBTITLE_OUTPUT) {
    console.log('\n🎬 GENERATING SRT CONTENT');
    console.log('   Total subtitles:', subtitles.length);
    console.log('   Line break strategy:', settings.lineBreakStrategy);
  }
  
  let content = '';
  
  for (const subtitle of subtitles) {
    if (DEBUG_SUBTITLE_OUTPUT) {
      console.log(`\n   📝 Subtitle #${subtitle.index}`);
      console.log(`      Original text:`, subtitle.text);
      console.log(`      Text length:`, subtitle.text.length, 'chars');
    }
    
    // Apply line break strategy
    const text = applyLineBreakStrategy(
      subtitle.text,
      settings.lineBreakStrategy,
      settings.maxCharsPerLine
    );
    
    if (DEBUG_SUBTITLE_OUTPUT) {
      console.log(`      After line break:`, text);
      console.log(`      After length:`, text.length, 'chars');
      console.log(`      Changed:`, text !== subtitle.text);
    }
    
    content += `${subtitle.index}\n`;
    content += `${subtitle.startTime} --> ${subtitle.endTime}\n`;
    content += `${text}\n\n`;
  }
  
  if (DEBUG_SUBTITLE_OUTPUT) {
    console.log('\n   ✅ SRT generation complete\n');
  }
  return content;
}

/**
 * Generate VTT file content
 */
export function generateVttContent(
  subtitles: VttSubtitle[],
  metadata: VttMetadata | undefined,
  settings: SubtitleSettings
): string {
  let content = '';
  
  // Add header
  content += metadata?.header || 'WEBVTT';
  content += '\n\n';
  
  // Add NOTE blocks if setting enabled
  if (settings.preserveVttNoteBlocks && metadata?.noteBlocks) {
    for (const noteBlock of metadata.noteBlocks) {
      content += noteBlock + '\n\n';
    }
  }
  
  // Add STYLE blocks if setting enabled
  if (settings.preserveVttStyleBlocks && metadata?.styleBlocks) {
    for (const styleBlock of metadata.styleBlocks) {
      content += styleBlock + '\n\n';
    }
  }
  
  // Add cues
  for (const subtitle of subtitles) {
    // Add cue identifier if present
    if (subtitle.cueIdentifier) {
      content += subtitle.cueIdentifier + '\n';
    }
    
    // Add timecode
    content += subtitle.startTime + ' --> ' + subtitle.endTime;
    
    // Add cue settings if enabled
    if (settings.preserveVttCueSettings && subtitle.cueSettings) {
      content += ' ' + subtitle.cueSettings;
    }
    content += '\n';
    
    // Apply line break strategy
    const text = applyLineBreakStrategy(
      subtitle.text,
      settings.lineBreakStrategy,
      settings.maxCharsPerLine
    );
    
    content += text + '\n\n';
  }
  
  return content;
}

/**
 * Apply encoding to content
 */
export function applyEncoding(content: string, encoding: string): string {
  if (encoding === 'UTF-8-BOM') {
    return '\uFEFF' + content;
  }
  // For ISO-8859-1, browser will handle encoding when downloading
  return content;
}

/**
 * Generate subtitle ZIP file with language folders
 */
export async function generateSubtitleZip(
  results: SubtitleTranslationResult[],
  targetLanguages: string[],
  settings: SubtitleSettings
): Promise<Blob> {
  const zip = new JSZip();
  
  // Create folder for each language
  for (const langCode of targetLanguages) {
    const langFolder = zip.folder(langCode);
    
    if (!langFolder) continue;
    
    // Add each file to the language folder
    for (const result of results) {
      const translatedSubtitles = result.translatedVersions[langCode];
      
      if (!translatedSubtitles) continue;
      
      // Determine output format
      let outputFormat = result.format;
      if (settings.outputFormat === 'srt') {
        outputFormat = 'srt';
      } else if (settings.outputFormat === 'vtt') {
        outputFormat = 'vtt';
      }
      // 'match-input' keeps original format
      // 'both' will create both versions
      
      // Generate filename
      let baseFileName = result.fileName.replace(/\.(srt|vtt)$/i, '');
      
      if (settings.addLanguageCodeToFilename) {
        baseFileName += `_${langCode}`;
      }
      
      // Generate content based on format
      if (settings.outputFormat === 'both') {
        // Generate both SRT and VTT
        const srtContent = applyEncoding(
          generateSrtContent(translatedSubtitles as SrtSubtitle[], settings),
          settings.outputEncoding
        );
        langFolder.file(`${baseFileName}.srt`, srtContent);
        
        const vttContent = applyEncoding(
          generateVttContent(translatedSubtitles as VttSubtitle[], result.vttMetadata, settings),
          settings.outputEncoding
        );
        langFolder.file(`${baseFileName}.vtt`, vttContent);
      } else {
        // Generate single format
        let content: string;
        
        if (outputFormat === 'srt') {
          content = generateSrtContent(translatedSubtitles as SrtSubtitle[], settings);
        } else {
          content = generateVttContent(translatedSubtitles as VttSubtitle[], result.vttMetadata, settings);
        }
        
        content = applyEncoding(content, settings.outputEncoding);
        langFolder.file(`${baseFileName}.${outputFormat}`, content);
      }
    }
  }
  
  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Generate individual subtitle file (for single file/language download)
 */
export function generateIndividualSubtitleFile(
  result: SubtitleTranslationResult,
  langCode: string,
  settings: SubtitleSettings
): { content: string; filename: string } {
  const translatedSubtitles = result.translatedVersions[langCode];
  
  // Determine output format
  let outputFormat = result.format;
  if (settings.outputFormat === 'srt') {
    outputFormat = 'srt';
  } else if (settings.outputFormat === 'vtt') {
    outputFormat = 'vtt';
  }
  
  // Generate filename
  let baseFileName = result.fileName.replace(/\.(srt|vtt)$/i, '');
  
  if (settings.addLanguageCodeToFilename) {
    baseFileName += `_${langCode}`;
  }
  
  const filename = `${baseFileName}.${outputFormat}`;
  
  // Generate content
  let content: string;
  
  if (outputFormat === 'srt') {
    content = generateSrtContent(translatedSubtitles as SrtSubtitle[], settings);
  } else {
    content = generateVttContent(translatedSubtitles as VttSubtitle[], result.vttMetadata, settings);
  }
  
  content = applyEncoding(content, settings.outputEncoding);
  
  return { content, filename };
}

