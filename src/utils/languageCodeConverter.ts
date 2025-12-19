import { CKLS_CODES } from './constants';

/**
 * Convert URL language code to CKLS format
 * URL might use "en-US", CKLS might need "en-GB"
 */
export function convertUrlToCKLS(urlCode: string): string {
  // Direct mapping for known variations
  const mapping: Record<string, string> = {
    'en-US': 'en-GB',  // US English → UK English
    // Add more mappings if CKLS uses different codes
  };
  
  // Return mapped value or original if no mapping exists
  return mapping[urlCode] || urlCode;
}

/**
 * Extract ISO 639-1 code from CKLS code
 * e.g., "en-GB" → "en"
 */
export function extractISOCode(cklsCode: string): string {
  return cklsCode.split('-')[0];
}

/**
 * Validate if CKLS code exists in supported languages
 */
export function isValidCKLSCode(cklsCode: string): boolean {
  return CKLS_CODES.includes(cklsCode);
}

