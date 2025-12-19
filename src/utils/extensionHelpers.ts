/**
 * Extension Helper Functions
 */

/**
 * Open extension options page with optional tab navigation
 * @param tab - Optional tab to open (glossary, dnt, api-keys, settings)
 */
export function openOptionsPage(tab?: string): void {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    // Store which tab to open (fallback for initial load)
    if (tab) {
      localStorage.setItem('optionsTabToOpen', tab);
    }
    
    // Try to send message to already-open options page
    chrome.runtime.sendMessage({ 
      type: 'NAVIGATE_TO_TAB', 
      tab: tab || 'settings' 
    }).catch(() => {
      // If message fails (no receiver), that's fine - localStorage will handle it
    });
    
    // Open the options page (or focus it if already open)
    chrome.runtime.openOptionsPage();
  }
}

