/**
 * API Key Validation
 * Validates API keys for translation services
 */

import { ApiValidationResult } from '../types/translation';

/**
 * DeepL Quota Information
 */
export interface DeepLQuotaInfo {
  characterCount: number;
  characterLimit: number;
  remaining: number;
  percentageUsed: number;
  isFreeKey: boolean;
  lastUpdated: number; // timestamp
}

/**
 * Validate Google Cloud Translation API key by making a test translation call
 */
export async function validateGoogleApiKey(apiKey: string): Promise<ApiValidationResult> {
  if (!apiKey || apiKey.trim().length < 10) {
    return {
      valid: false,
      error: 'API key is too short'
    };
  }
  
  try {
    const baseUrl = 'https://translation.googleapis.com/language/translate/v2';
    const url = `${baseUrl}?key=${encodeURIComponent(apiKey)}`;
    
    const requestBody = {
      q: 'test',
      source: 'en',
      target: 'de',
      format: 'text'
    };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data.translations && data.data.translations.length > 0) {
        return {
          valid: true,
          message: 'API key is valid'
        };
      }
    }
    
    // Handle specific error codes
    if (response.status === 400) {
      const errorData = await response.json().catch(() => ({}));
      return {
        valid: false,
        error: errorData.error?.message || 'Invalid request'
      };
    } else if (response.status === 403) {
      return {
        valid: false,
        error: 'Invalid API key or Cloud Translation API not enabled'
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return {
        valid: false,
        error: errorData.error?.message || `API error: ${response.status}`
      };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        valid: false,
        error: 'Request timeout - please check your connection'
      };
    }
    
    return {
      valid: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * Validate DeepL API key by checking usage endpoint
 */
export async function validateDeepLApiKey(apiKey: string): Promise<ApiValidationResult> {
  if (!apiKey || apiKey.trim().length < 10) {
    return {
      valid: false,
      error: 'API key is too short'
    };
  }

  // Determine endpoint based on API key
  const isFreeKey = apiKey.endsWith(':fx');
  const baseUrl = isFreeKey 
    ? 'https://api-free.deepl.com/v2/usage'
    : 'https://api.deepl.com/v2/usage';

  try {
    const params = new URLSearchParams({
      auth_key: apiKey
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${baseUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      
      // Check usage info
      const characterCount = data.character_count || 0;
      const characterLimit = data.character_limit || 0;
      const remaining = characterLimit - characterCount;

      if (characterLimit > 0 && remaining <= 0) {
        return {
          valid: false,
          error: 'Character limit reached'
        };
      }

      return {
        valid: true,
        message: isFreeKey 
          ? `Valid (Free tier: ${remaining.toLocaleString()} characters remaining)`
          : `Valid (${remaining.toLocaleString()} characters remaining)`
      };
    }

    // Handle specific error codes
    if (response.status === 403) {
      return {
        valid: false,
        error: 'Invalid API key or authentication failed'
      };
    } else if (response.status === 456) {
      return {
        valid: false,
        error: 'Character limit exceeded'
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return {
        valid: false,
        error: (errorData as any).message || `API error: ${response.status}`
      };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        valid: false,
        error: 'Request timeout - please check your connection'
      };
    }

    return {
      valid: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * Fetch DeepL quota/usage information
 * Returns quota details or null if fetch fails
 */
export async function fetchDeepLQuota(apiKey: string): Promise<DeepLQuotaInfo | null> {
  if (!apiKey || apiKey.trim().length < 10) {
    return null;
  }

  const isFreeKey = apiKey.endsWith(':fx');
  const baseUrl = isFreeKey 
    ? 'https://api-free.deepl.com/v2/usage'
    : 'https://api.deepl.com/v2/usage';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(baseUrl, {
      method: 'GET',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const characterCount = data.character_count || 0;
    const characterLimit = data.character_limit || 500000;
    const remaining = characterLimit - characterCount;
    const percentageUsed = characterLimit > 0 ? (characterCount / characterLimit) * 100 : 0;

    return {
      characterCount,
      characterLimit,
      remaining,
      percentageUsed,
      isFreeKey,
      lastUpdated: Date.now()
    };
  } catch {
    return null;
  }
}

