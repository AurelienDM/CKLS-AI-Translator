// Page detection utility for identifying CKLS page types

export type PageType = 'email' | 'homepage' | 'learning-channel' | 'blendedx' | 'meta-skills' | 'unknown';

export interface PageContext {
  type: PageType;
  mode: 'file' | 'text';
  label: string;
  icon: string;
  description?: string;
  detectedSourceLanguage?: string;
}

/**
 * Detect page type based on URL patterns
 */
export function detectPageType(url: string): PageContext {
  // Email pages
  if (url.includes('/path_email_rules/path_email_rules.php?')) {
    let detectedSourceLanguage: string | undefined;
    
    try {
      const urlObj = new URL(url);
      const forceTranslation = urlObj.searchParams.get('force_translation');
      if (forceTranslation) {
        detectedSourceLanguage = forceTranslation; // e.g., "en-US"
        console.log('🌐 Detected source language from URL:', detectedSourceLanguage);
      }
    } catch (error) {
      console.error('Failed to parse URL for source language:', error);
    }
    
    return {
      type: 'email',
      mode: 'text',
      label: 'Email Translation',
      icon: '📧',
      description: 'Detected email rules page - optimized for text-based translation',
      detectedSourceLanguage
    };
  }
  
  // Home pages
  if (url.includes('/manage_translations.php?')) {
    return {
      type: 'homepage',
      mode: 'file',
      label: 'Home Page',
      icon: '🏠',
      description: 'Detected homepage translation - optimized for file-based translation'
    };
  }
  
  // Learning Channel
  if (url.includes('/training/training_manage_translations.php?')) {
    return {
      type: 'learning-channel',
      mode: 'file',
      label: 'Learning Channel',
      icon: '📚',
      description: 'Detected learning channel - optimized for file-based translation'
    };
  }
  
  // BlendedX (with dynamic IDs using regex)
  const blendedxPattern = /\/administration\/training\/guided(\/session)?\/\d+\/translations/;
  if (blendedxPattern.test(url)) {
    return {
      type: 'blendedx',
      mode: 'file',
      label: 'BlendedX',
      icon: '🎓',
      description: 'Detected BlendedX training - optimized for file-based translation'
    };
  }
  
  // Meta-Skills Avatar AI Editor
  const metaSkillsPattern = /meta-skills\.io\/dashboard\/trainings\/\d+\/editor/;
  if (metaSkillsPattern.test(url)) {
    return {
      type: 'meta-skills',
      mode: 'text',
      label: 'Meta-Skills',
      icon: '🎭',
      description: 'Detected Meta-Skills Avatar AI editor - optimized for text-based translation'
    };
  }
  
  // Unknown page type
  return {
    type: 'unknown',
    mode: 'file',
    label: 'General',
    icon: '🌐',
    description: 'No specific page detected - use any mode'
  };
}

/**
 * Get current page context from active tab
 * Works in extension sidebar context
 */
export async function getCurrentPageContext(): Promise<PageContext> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
        if (tabs[0]?.url) {
          resolve(detectPageType(tabs[0].url));
        } else {
          resolve(detectPageType(''));
        }
      });
    } else {
      // Fallback for development or non-extension context
      resolve(detectPageType(window.location.href));
    }
  });
}

