/**
 * API Key Validation Utilities
 * Tests API keys against real APIs to ensure they are valid and functional
 */

interface ValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
}

/**
 * Validate DeepL API Key
 * Tests the key with a simple translation request
 */
export async function validateDeepLKey(apiKey: string): Promise<ValidationResult> {
  if (!apiKey || apiKey.trim() === '') {
    return {
      valid: false,
      error: 'API key is required'
    };
  }

  try {
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: 'Hello',
        target_lang: 'FR',
      }),
    });

    if (response.ok) {
      return {
        valid: true,
        message: 'DeepL API key is valid and working'
      };
    }

    if (response.status === 403) {
      return {
        valid: false,
        error: 'Invalid API key or authentication failed'
      };
    }

    if (response.status === 456) {
      return {
        valid: false,
        error: 'Quota exceeded. Please check your DeepL account.'
      };
    }

    const errorData = await response.json().catch(() => null);
    return {
      valid: false,
      error: errorData?.message || `API error: ${response.status}`
    };
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        valid: false,
        error: 'Network error. Please check your internet connection.'
      };
    }
    return {
      valid: false,
      error: error.message || 'Failed to validate API key'
    };
  }
}

/**
 * Validate Google Translation API Key
 * Tests the key with a simple translation request
 */
export async function validateGoogleKey(apiKey: string): Promise<ValidationResult> {
  if (!apiKey || apiKey.trim() === '') {
    return {
      valid: false,
      error: 'API key is required'
    };
  }

  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: 'Hello',
        target: 'fr',
      }),
    });

    if (response.ok) {
      return {
        valid: true,
        message: 'Google Translation API key is valid and working'
      };
    }

    if (response.status === 400) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.error?.message || 'Bad request';
      
      if (errorMessage.includes('API key not valid')) {
        return {
          valid: false,
          error: 'Invalid API key. Please check your key.'
        };
      }
      
      return {
        valid: false,
        error: errorMessage
      };
    }

    if (response.status === 403) {
      return {
        valid: false,
        error: 'API key invalid or translation API not enabled for this project'
      };
    }

    if (response.status === 429) {
      return {
        valid: false,
        error: 'Rate limit exceeded. Please try again later.'
      };
    }

    const errorData = await response.json().catch(() => null);
    const errorMessage = errorData?.error?.message || `API error: ${response.status}`;
    
    return {
      valid: false,
      error: errorMessage
    };
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        valid: false,
        error: 'Network error. Please check your internet connection.'
      };
    }
    return {
      valid: false,
      error: error.message || 'Failed to validate API key'
    };
  }
}

