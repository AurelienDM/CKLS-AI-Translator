/**
 * Extension Storage Helper
 * Uses chrome.storage.local for data persistence in extension
 * Falls back to localStorage for web development
 */

// Type declaration for chrome API
declare const chrome: any;

export async function saveToStorage(key: string, value: any): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    });
  } else {
    // Fallback to localStorage for web development
    localStorage.setItem(key, JSON.stringify(value));
    return Promise.resolve();
  }
}

export async function getFromStorage(key: string): Promise<any> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result: any) => {
        resolve(result[key]);
      });
    });
  } else {
    // Fallback to localStorage for web development
    const value = localStorage.getItem(key);
    return Promise.resolve(value ? JSON.parse(value) : null);
  }
}

export async function clearStorage(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => resolve());
    });
  } else {
    localStorage.clear();
    return Promise.resolve();
  }
}

