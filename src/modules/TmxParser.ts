import { TmxMemory } from '@/types/tmx';

/**
 * Parse TMX file and extract translation units
 */
export async function parseTmxFile(file: File): Promise<TmxMemory> {
  const text = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, 'text/xml');
  
  // Check for parsing errors
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid TMX file format: ' + parserError.textContent);
  }
  
  // Extract header information
  const header = xmlDoc.querySelector('header');
  const sourceLang = header?.getAttribute('srclang') || 'en-US';
  
  const tmxMemory: TmxMemory = {
    fileName: file.name,
    sourceLang: normalizeLanguageCode(sourceLang),
    targetLangs: [],
    units: [],
    header: {
      creationTool: header?.getAttribute('creationtool') || undefined,
      creationDate: header?.getAttribute('creationdate') || undefined,
      segmentationType: header?.getAttribute('segtype') || undefined,
    },
  };
  
  // Extract all translation units
  const tuElements = xmlDoc.querySelectorAll('tu');
  const targetLangsSet = new Set<string>();
  
  tuElements.forEach((tu) => {
    const tuvElements = tu.querySelectorAll('tuv');
    
    if (tuvElements.length < 2) return; // Need at least source and one target
    
    // Extract metadata
    const creationDate = tu.getAttribute('creationdate') || undefined;
    const changeDate = tu.getAttribute('changedate') || undefined;
    const usageCount = parseInt(tu.getAttribute('usagecount') || '0');
    
    // Extract quality
    const qualityProp = tu.querySelector('prop[type*="Quality"]');
    const quality = qualityProp ? parseInt(qualityProp.textContent || '0') : undefined;
    
    // Extract context
    const contextProps = Array.from(tu.querySelectorAll('prop[type="x-ContextContent"]'));
    const context = contextProps.map(prop => prop.textContent || '');
    
    // Extract source and targets
    const sourceElement = Array.from(tuvElements).find(
      tuv => normalizeLanguageCode(tuv.getAttribute('xml:lang') || '') === tmxMemory.sourceLang
    );
    
    if (!sourceElement) return;
    
    const sourceText = extractSegmentText(sourceElement);
    
    // Create translation units for each target language
    tuvElements.forEach((tuv) => {
      const lang = normalizeLanguageCode(tuv.getAttribute('xml:lang') || '');
      
      if (lang === tmxMemory.sourceLang) return; // Skip source
      
      targetLangsSet.add(lang);
      
      const targetText = extractSegmentText(tuv);
      
      tmxMemory.units.push({
        sourceText,
        targetText,
        sourceLang: tmxMemory.sourceLang,
        targetLang: lang,
        creationDate,
        changeDate,
        quality,
        usageCount,
        context: context.length > 0 ? context : undefined,
      });
    });
  });
  
  tmxMemory.targetLangs = Array.from(targetLangsSet);
  
  console.log(`✅ Parsed TMX: ${tmxMemory.units.length} units, ${tmxMemory.targetLangs.length} target languages`);
  
  return tmxMemory;
}

/**
 * Extract text from a <tuv> segment element
 */
function extractSegmentText(tuvElement: Element): string {
  const seg = tuvElement.querySelector('seg');
  if (!seg) return '';
  
  // Get inner HTML to preserve formatting tags
  return seg.innerHTML
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

/**
 * Normalize language codes to match CKLS format
 * en-US -> en-US
 * fr-FR -> fr-FR
 * etc.
 */
function normalizeLanguageCode(code: string): string {
  if (!code) return '';
  
  // TMX uses xml:lang format (e.g., "en-US", "fr-FR")
  // Keep the same format for now
  return code.trim();
}

/**
 * Export subtitle translations to TMX format
 */
export function exportToTmx(
  sourceSubtitles: string[],
  translatedSubtitles: Record<string, string[]>,
  sourceLang: string
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15) + 'Z';
  
  let tmx = `<?xml version="1.0" encoding="utf-8"?>
<tmx version="1.4">
  <header 
    creationtool="AI Translate Extension" 
    creationtoolversion="2.0" 
    datatype="subtitle" 
    segtype="sentence" 
    adminlang="${sourceLang}" 
    srclang="${sourceLang}" 
    creationdate="${timestamp}">
  </header>
  <body>
`;

  // Create translation units
  sourceSubtitles.forEach((sourceText, index) => {
    tmx += `    <tu creationdate="${timestamp}">\n`;
    tmx += `      <tuv xml:lang="${sourceLang}">\n`;
    tmx += `        <seg>${escapeXml(sourceText)}</seg>\n`;
    tmx += `      </tuv>\n`;
    
    // Add all target languages
    Object.entries(translatedSubtitles).forEach(([targetLang, translations]) => {
      if (translations[index]) {
        tmx += `      <tuv xml:lang="${targetLang}">\n`;
        tmx += `        <seg>${escapeXml(translations[index])}</seg>\n`;
        tmx += `      </tuv>\n`;
      }
    });
    
    tmx += `    </tu>\n`;
  });

  tmx += `  </body>
</tmx>`;

  return tmx;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

