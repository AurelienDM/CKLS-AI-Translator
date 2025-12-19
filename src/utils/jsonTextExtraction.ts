import { JsonSchema } from './jsonSchemas';

interface ExtractedItem {
  id: string;
  path: string; // JSONPath for this item
  extracted: string;
}

interface JsonExtractionResult {
  extracted: ExtractedItem[];
  template: any; // JSON with placeholders
  detectedSchema: JsonSchema | null;
}

/**
 * Detect if text is JSON matching a known schema
 */
export function detectJsonSchema(text: string, schemas: JsonSchema[]): JsonSchema | null {
  console.log('🔍 detectJsonSchema called');
  console.log('Text length:', text.length);
  console.log('Text preview (first 300 chars):', text.substring(0, 300));
  
  // First check if it's valid JSON
  try {
    const parsed = JSON.parse(text);
    console.log('✅ JSON is valid. Has "name"?', 'name' in parsed, 'Has "episodes"?', 'episodes' in parsed);
  } catch (e) {
    console.log('❌ JSON parse failed:', e);
    return null;
  }
  
  // Test against each schema pattern
  for (const schema of schemas) {
    console.log('Testing schema:', schema.name);
    console.log('Pattern:', schema.detectPattern);
    const matches = schema.detectPattern.test(text);
    console.log('Pattern matches:', matches);
    
    if (matches) {
      console.log('✅ Schema matched:', schema.name);
      return schema;
    }
  }
  
  console.log('❌ No schema matched');
  return null;
}

/**
 * Match a path against a JSONPath-style pattern
 * Supports: $.name, $.episodes[*].name, etc.
 */
function matchesPattern(path: string, pattern: string): boolean {
  // Normalize both paths to start with $
  const normalizedPath = path.startsWith('$') ? path : `$.${path}`;
  const normalizedPattern = pattern.startsWith('$') ? pattern : `$.${pattern}`;
  
  // Convert pattern to regex
  // $.episodes[*].name -> ^\$.episodes\[\d+\].name$
  const regexPattern = normalizedPattern
    .replace(/\$/g, '\\$') // Escape dollar signs first!
    .replace(/\./g, '\\.') // Escape dots
    .replace(/\[\*\]/g, '\\[\\d+\\]') // [*] -> [\d+]
    .replace(/\*/g, '.*'); // * -> .*
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizedPath);
}

/**
 * Walk a JSON object and extract values at specified paths
 */
function walkAndExtract(
  obj: any,
  path: string,
  extractPaths: string[],
  extracted: ExtractedItem[],
  idCounter: { count: number }
): any {
  // Base case: primitives
  if (obj === null || typeof obj !== 'object') {
    // Check if current path matches any extraction pattern
    const shouldExtract = extractPaths.some(pattern => matchesPattern(path, pattern));
    
    if (shouldExtract && typeof obj === 'string' && obj.trim()) {
      const id = `T${idCounter.count++}`;
      extracted.push({
        id,
        path,
        extracted: obj
      });
      return `{${id}}`;
    }
    
    return obj;
  }
  
  // Array case
  if (Array.isArray(obj)) {
    return obj.map((item, index) => 
      walkAndExtract(item, `${path}[${index}]`, extractPaths, extracted, idCounter)
    );
  }
  
  // Object case
  const result: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const childPath = path ? `${path}.${key}` : key;
      result[key] = walkAndExtract(obj[key], childPath, extractPaths, extracted, idCounter);
    }
  }
  
  return result;
}

/**
 * Extract translatable text from JSON according to schema
 */
export function extractJsonText(
  jsonString: string,
  schema: JsonSchema
): JsonExtractionResult {
  try {
    // Parse JSON
    const parsed = JSON.parse(jsonString);
    
    const extracted: ExtractedItem[] = [];
    const idCounter = { count: 1 };
    
    // Walk and extract
    const template = walkAndExtract(parsed, '$', schema.translatablePaths, extracted, idCounter);
    
    return {
      extracted,
      template,
      detectedSchema: schema
    };
    
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error}`);
  }
}

/**
 * Rebuild JSON from template and translations
 */
export function rebuildJsonFromTemplate(
  template: any,
  translations: Record<string, string>,
  targetLocale?: string
): string {
  function rebuild(obj: any, currentPath: string = '$'): any {
    if (obj === null || typeof obj !== 'object') {
      // Check if it's a placeholder
      if (typeof obj === 'string') {
        const match = obj.match(/^\{(T\d+)\}$/);
        if (match) {
          const id = match[1];
          return translations[id] || obj;
        }
      }
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map((item, index) => rebuild(item, `${currentPath}[${index}]`));
    }
    
    const result: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const childPath = `${currentPath}.${key}`;
        
        // Special handling for locale field
        if (key === 'locale' && targetLocale) {
          result[key] = targetLocale;  // Always update locale when targetLocale is provided
        } else {
          result[key] = rebuild(obj[key], childPath);
        }
      }
    }
    
    return result;
  }
  
  const rebuilt = rebuild(template);
  return JSON.stringify(rebuilt, null, 2);  // Keep 2-space indentation
}

/**
 * Extract source locale from JSON
 * Returns the value of the "locale" field if it exists
 */
export function extractSourceLocaleFromJson(jsonString: string): string | null {
  try {
    const json = JSON.parse(jsonString);
    if (json.locale && typeof json.locale === 'string') {
      return json.locale;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Convert locale code to ISO language code
 * e.g., "en-US" -> "en", "fr-FR" -> "fr"
 */
export function localeToISO(locale: string): string {
  return locale.split('-')[0].toLowerCase();
}

