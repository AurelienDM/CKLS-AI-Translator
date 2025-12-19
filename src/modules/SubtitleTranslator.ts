/**
 * Subtitle Translation Module
 * Handles translation of subtitle files using DeepL/Google with smart deduplication
 */

import type { SubtitleFileData, SubtitleSettings, SubtitleTextItem, SubtitleTranslationResult } from '@/types/subtitle';
import type { GlossaryEntry } from '@/types';
import type { TmxMemory, SubtitleTmxLink } from '@/types/tmx';
import { mapToDeepLCode, validateDeepLLanguages, isDeepLProKey } from './DeepLTranslator';
import { applyGlossarySubstitutions, restoreGlossarySubstitutions } from '@/utils/textExtraction';
import { extractTextFromHTML, restoreHTMLStructure } from '@/utils/subtitleHelpers';
import { findTmxMatches } from './TmxMatcher';

// Debug flag - set to true to enable detailed translation logging
const DEBUG_SUBTITLE_TRANSLATION = false;

export interface SubtitleTranslationConfig {
  subtitleFiles: SubtitleFileData[];
  targetLanguagesCKLS: string[];
  sourceISO: string;
  sourceCKLS: string;
  apiKey: string;
  doNotTranslate: string[];
  predefinedTranslations: GlossaryEntry[];
  subtitleSettings: SubtitleSettings;
  deeplStyleOptions?: Record<string, any>;
  useDeeplStyleRules?: boolean;
  deeplRequestDelay?: number;
  tmxMemory?: TmxMemory;
  tmxLink?: SubtitleTmxLink;
  controller: {
    cancelled: boolean;
    paused: boolean;
    signal: AbortSignal;
    waitIfPaused: () => Promise<void>;
  };
  onProgress: (current: number, total: number, lang: string, phase: string) => void;
}

/**
 * Extract all subtitle texts from all files
 */
function extractTextsFromSubtitleFiles(files: SubtitleFileData[]): SubtitleTextItem[] {
  const allItems: SubtitleTextItem[] = [];
  
  files.forEach((file, fileIndex) => {
    file.subtitles.forEach((subtitle, subtitleIndex) => {
      allItems.push({
        fileIndex,
        subtitleIndex,
        text: subtitle.text,
        timecode: {
          start: subtitle.startTime,
          end: subtitle.endTime
        },
        formatting: {
          htmlTags: [],
          vttCueSettings: (subtitle as any).cueSettings
        }
      });
    });
  });
  
  return allItems;
}

/**
 * Build unique string map for deduplication
 */
function buildUniqueSubtitleMap(items: SubtitleTextItem[]): Map<string, SubtitleTextItem[]> {
  const stringMap = new Map<string, SubtitleTextItem[]>();
  
  items.forEach(item => {
    const cleanText = item.text.trim();
    
    if (!stringMap.has(cleanText)) {
      stringMap.set(cleanText, []);
    }
    
    stringMap.get(cleanText)!.push(item);
  });
  
  return stringMap;
}

/**
 * Translate subtitles with DeepL API
 */
export async function translateSubtitlesWithDeepL(
  config: SubtitleTranslationConfig
): Promise<SubtitleTranslationResult[]> {
  const {
    subtitleFiles,
    targetLanguagesCKLS,
    sourceISO,
    sourceCKLS,
    apiKey,
    doNotTranslate,
    predefinedTranslations,
    subtitleSettings,
    deeplRequestDelay = 500,
    controller,
    onProgress
  } = config;

  // Validate languages
  const validation = validateDeepLLanguages(targetLanguagesCKLS);
  if (validation.unsupported.length > 0) {
    throw new Error(`Unsupported languages for DeepL: ${validation.unsupported.join(', ')}`);
  }

  // Phase 1: Extract all subtitle texts
  onProgress(0, 0, '', 'extracting');
  
  const allItems = extractTextsFromSubtitleFiles(subtitleFiles);
  
  // Auto-add voice tags to DNT list if setting enabled
  const dntTerms = [...doNotTranslate];
  if (subtitleSettings.treatVoiceTagsAsDNT) {
    subtitleFiles.forEach(file => {
      if (file.format === 'vtt') {
        file.subtitles.forEach(sub => {
          const vttSub = sub as any;
          if (vttSub.voiceTag && !dntTerms.includes(vttSub.voiceTag)) {
            dntTerms.push(vttSub.voiceTag);
          }
        });
      }
    });
  }
  
  // Build unique string map for deduplication
  const stringMap = buildUniqueSubtitleMap(allItems);
  const uniqueTexts = Array.from(stringMap.keys());
  
  console.log(`📊 Subtitle Translation Stats:`);
  console.log(`   Total subtitles: ${allItems.length}`);
  console.log(`   Unique texts: ${uniqueTexts.length}`);
  console.log(`   Duplicates saved: ${allItems.length - uniqueTexts.length}`);
  
  // Prepare shared translations object
  const sharedTranslations: Record<string, Record<string, string>> = {};
  targetLanguagesCKLS.forEach(lang => {
    sharedTranslations[lang] = {};
  });
  
  // ========== TMX INTEGRATION ==========
  // Phase 1.5: Pre-fill from TMX
  let tmxStats = { total: uniqueTexts.length, matched: 0, remaining: uniqueTexts.length };

  if (config.tmxMemory && config.tmxLink?.enabled) {
    console.log('\n📚 TMX PRE-FILL PHASE');
    console.log(`   TMX file: ${config.tmxMemory.fileName}`);
    console.log(`   TMX units: ${config.tmxMemory.units.length}`);
    
    for (const targetLang of targetLanguagesCKLS) {
      console.log(`\n   🌍 Checking TMX for ${targetLang}...`);
      let matchedForLang = 0;
      
      uniqueTexts.forEach((text) => {
        const matches = findTmxMatches(
          text, 
          targetLang, 
          config.tmxMemory!, 
          config.tmxLink!.autoApplyThreshold
        );
        
        // Auto-apply if match score meets threshold
        if (matches.length > 0 && 
            matches[0].matchScore >= config.tmxLink!.autoApplyThreshold) {
          sharedTranslations[targetLang][text] = matches[0].targetText;
          matchedForLang++;
          
          if (DEBUG_SUBTITLE_TRANSLATION) {
            console.log(`      ✅ TMX match [${matches[0].matchScore}%]: "${text.substring(0, 40)}..."`);
            console.log(`         → "${matches[0].targetText.substring(0, 40)}..."`);
          }
        }
      });
      
      console.log(`   ✅ ${targetLang}: ${matchedForLang} matches from TMX`);
    }
    
    // Calculate how many unique texts still need translation
    const firstLang = targetLanguagesCKLS[0];
    tmxStats.matched = Object.keys(sharedTranslations[firstLang]).length;
    tmxStats.remaining = tmxStats.total - tmxStats.matched;
    
    console.log('\n📊 TMX STATISTICS:');
    console.log(`   Total unique texts: ${tmxStats.total}`);
    console.log(`   Matched by TMX: ${tmxStats.matched} (${Math.round(tmxStats.matched/tmxStats.total*100)}%)`);
    console.log(`   Needs translation: ${tmxStats.remaining} (${Math.round(tmxStats.remaining/tmxStats.total*100)}%)`);
    console.log(`   API calls saved: ${tmxStats.matched * targetLanguagesCKLS.length}`);
  }
  // ========== END TMX INTEGRATION ==========
  
  // Calculate total operations (adjusted for TMX)
  const totalOps = tmxStats.remaining * targetLanguagesCKLS.length;
  let currentOp = 0;
  
  // Phase 2: Translate unique strings only
  for (const targetLang of targetLanguagesCKLS) {
    if (controller.cancelled) {
      throw new Error('Translation cancelled');
    }
    
    onProgress(currentOp, totalOps, targetLang, 'translating');
    
    const targetDeepL = mapToDeepLCode(targetLang);
    
    // Translate each unique text
    for (const text of uniqueTexts) {
      await controller.waitIfPaused();
      
      if (controller.cancelled) {
        throw new Error('Translation cancelled');
      }
      
      // ⭐ SKIP if already translated by TMX
      if (sharedTranslations[targetLang][text]) {
        if (DEBUG_SUBTITLE_TRANSLATION) {
          console.log(`   ⏭️  Skipping (TMX): "${text.substring(0, 40)}..."`);
        }
        continue; // Don't call API!
      }
      
      // Step 1: Extract pure text from HTML (no placeholders)
      const { pureText: textWithoutHtml, structure: htmlStructure } = extractTextFromHTML(text);
      
      if (DEBUG_SUBTITLE_TRANSLATION) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 SUBTITLE TRANSLATION DEBUG');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📥 ORIGINAL TEXT:', text);
        console.log('   Length:', text.length, 'chars');
        console.log('   Preview:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
        console.log('\n🏷️  STEP 1: PURE TEXT EXTRACTED');
        console.log('   Pure text:', textWithoutHtml);
        console.log('   Has HTML:', htmlStructure?.hasHtml || false);
        console.log('   HTML structure:', htmlStructure);
      }
      
      // Step 2: Apply glossary substitutions
      const glossaryResult = applyGlossarySubstitutions(
        textWithoutHtml,
        sourceCKLS,
        targetLang,
        predefinedTranslations
      );
      
      if (DEBUG_SUBTITLE_TRANSLATION) {
        console.log('\n📚 STEP 2: GLOSSARY APPLIED');
        console.log('   Processed text:', glossaryResult.processedText);
        console.log('   Has substitutions:', glossaryResult.hasSubstitutions);
      }
      
      // Check for full match
      if (glossaryResult.hasSubstitutions && glossaryResult.processedText === "__GLOSSARY_FULL__") {
        const fullTranslation = glossaryResult.substitutions["__GLOSSARY_FULL__"];
        const restored = htmlStructure
          ? restoreHTMLStructure(fullTranslation, htmlStructure, subtitleSettings.lineBreakStrategy)
          : fullTranslation;
        
        if (DEBUG_SUBTITLE_TRANSLATION) {
          console.log('\n✨ FULL GLOSSARY MATCH - SKIPPING API');
          console.log('   Full translation:', fullTranslation);
          console.log('   After HTML restore:', restored);
        }
        
        sharedTranslations[targetLang][text] = restored;
        currentOp++;
        continue;
      }
      
      // Step 3: Translate with DeepL API
      try {
        const apiUrl = isDeepLProKey(apiKey) 
          ? 'https://api.deepl.com/v2/translate'
          : 'https://api-free.deepl.com/v2/translate';

        const body: any = {
          text: [glossaryResult.processedText],
          source_lang: sourceISO.toUpperCase(),
          target_lang: targetDeepL,
          preserve_formatting: true
        };

        if (DEBUG_SUBTITLE_TRANSLATION) {
          console.log('\n🌐 STEP 3: SENDING TO DEEPL API');
          console.log('   API URL:', apiUrl);
          console.log('   Text sent:', glossaryResult.processedText);
          console.log('   Source lang:', sourceISO.toUpperCase());
          console.log('   Target lang:', targetDeepL);
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`DeepL API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const translated = data.translations[0].text;
        
        if (DEBUG_SUBTITLE_TRANSLATION) {
          console.log('\n✅ STEP 3: DEEPL RESPONSE');
          console.log('   Translated text:', translated);
          console.log('   Length:', translated.length, 'chars');
        }
        
        // Step 4: Restore glossary substitutions
        const withGlossary = glossaryResult.hasSubstitutions
          ? restoreGlossarySubstitutions(translated, glossaryResult.substitutions)
          : translated;
        
        if (DEBUG_SUBTITLE_TRANSLATION) {
          console.log('\n📚 STEP 4: GLOSSARY RESTORED');
          console.log('   After glossary restore:', withGlossary);
          console.log('   Changed:', withGlossary !== translated);
        }
        
        // Step 5: Restore HTML structure
        const final = htmlStructure
          ? restoreHTMLStructure(withGlossary, htmlStructure, subtitleSettings.lineBreakStrategy)
          : withGlossary;
        
        if (DEBUG_SUBTITLE_TRANSLATION) {
          console.log('\n🏷️  STEP 5: HTML STRUCTURE RESTORED');
          console.log('   Final text:', final);
          console.log('   Length:', final.length, 'chars');
          console.log('   Changed:', final !== withGlossary);
          console.log('\n📤 FINAL RESULT STORED');
          console.log('   Key (original):', text.substring(0, 50) + '...');
          console.log('   Value (translated):', final.substring(0, 100) + (final.length > 100 ? '...' : ''));
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }
        
        sharedTranslations[targetLang][text] = final;
      } catch (error: any) {
        console.error(`Failed to translate: "${text}"`, error);
        sharedTranslations[targetLang][text] = `[Translation failed: ${error.message}]`;
      }
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, deeplRequestDelay));
      
      currentOp++;
      onProgress(currentOp, totalOps, targetLang, 'translating');
    }
  }
  
  // Phase 3: Reconstruct subtitle files with translations
  console.log('\n🔄 PHASE 3: RECONSTRUCTING SUBTITLE FILES');
  console.log('   Files to process:', subtitleFiles.length);
  console.log('   Target languages:', targetLanguagesCKLS.join(', '));
  onProgress(totalOps, totalOps, '', 'rebuilding');
  
  const results: SubtitleTranslationResult[] = subtitleFiles.map((file, fileIndex) => {
    console.log(`\n   📁 Processing file ${fileIndex + 1}: ${file.fileName}`);
    console.log(`      Subtitles in file: ${file.subtitles.length}`);
    
    const translatedVersions: Record<string, any[]> = {};
    
    targetLanguagesCKLS.forEach(lang => {
      console.log(`\n      🌍 Creating ${lang} version`);
      translatedVersions[lang] = file.subtitles.map((subtitle, subIndex) => {
        const originalText = subtitle.text;
        const translatedText = sharedTranslations[lang][originalText];
        
        if (subIndex < 3) { // Only log first 3 subtitles per language to avoid spam
          console.log(`         Sub #${subtitle.index}:`);
          console.log(`            Original: ${originalText.substring(0, 60)}${originalText.length > 60 ? '...' : ''}`);
          console.log(`            Translated: ${translatedText ? translatedText.substring(0, 60) + (translatedText.length > 60 ? '...' : '') : 'NOT FOUND'}`);
          console.log(`            Found in map: ${!!translatedText}`);
        }
        
        return {
          ...subtitle,
          text: translatedText || originalText
        };
      });
      console.log(`      ✅ ${lang} version complete: ${translatedVersions[lang].length} subtitles`);
    });
    
    return {
      fileName: file.fileName,
      format: file.format,
      vttMetadata: file.vttMetadata,
      translatedVersions
    };
  });
  
  console.log('\n✅ PHASE 3 COMPLETE - All subtitle files reconstructed\n');
  
  return results;
}

/**
 * Translate subtitles with Google Translate API (simplified version)
 */
export async function translateSubtitlesWithGoogle(
  _config: SubtitleTranslationConfig
): Promise<SubtitleTranslationResult[]> {
  // For now, this would follow the same pattern as DeepL
  // but use Google Translate API instead
  throw new Error('Google Translate for subtitles not yet implemented');
}

