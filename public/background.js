// Track sidebar state per window
const sidebarStates = new Map();

// Handle download with Save As dialog AND capture for extension
async function handleDownloadAndCapture(url, pageContext, saveAs, tab) {
  try {
    // Fetch first to get the original filename
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    // Try to extract original filename from Content-Disposition header
    let filename = generateFilename(url, pageContext);
    const contentDisposition = response.headers.get('Content-Disposition');
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d+'')?([^;\r\n"']*)['"]?/i);
      if (filenameMatch && filenameMatch[1]) {
        filename = decodeURIComponent(filenameMatch[1].trim());
        console.log('📄 Using server filename:', filename);
      }
    }
    
    // 1. Download to disk using chrome.downloads API
    const downloadId = await chrome.downloads.download({
      url: url,
      saveAs: saveAs || false,
      filename: filename
    });
    
    console.log('✅ Browser download initiated:', downloadId);
    
    // 2. Store in memory for extension use
    const text = await response.text();
    
    // Store in chrome.storage
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(text);
    const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
    const base64 = btoa(binaryString);
    
    const contextId = extractContextId(url);
    
    await chrome.storage.local.set({
      autoLoadedFile: {
        filename: filename,
        content: base64,
        timestamp: Date.now(),
        pageType: pageContext.type,
        contextId: contextId,
        source: 'page-download'
      }
    });
    
    // 3. Notify content script file is ready
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'FILE_READY',
        filename: filename
      }).catch(() => {});
    }
    
  } catch (error) {
    console.error('Download and capture failed:', error);
    
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'FILE_ERROR',
        error: error.message
      }).catch(() => {});
    }
  }
}

// Handle file capture (parallel to browser download, or standalone)
async function handleCaptureFile(url, pageContext, filename, tab) {
  try {
    // Fetch the file directly from the server
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Try to extract original filename from Content-Disposition header
    let actualFilename = filename;
    const contentDisposition = response.headers.get('Content-Disposition');
    
    if (contentDisposition) {
      // Try to extract filename from Content-Disposition header
      // Matches: filename="file.xml", filename=file.xml, filename*=UTF-8''file.xml
      const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d+'')?([^;\r\n"']*)['"]?/i);
      if (filenameMatch && filenameMatch[1]) {
        actualFilename = decodeURIComponent(filenameMatch[1].trim());
        console.log('📄 Using server filename:', actualFilename);
      }
    }
    
    // Fallback to provided filename or generate one
    if (!actualFilename) {
      const contextId = extractContextId(url);
      actualFilename = filename || generateFilename(url, pageContext);
      console.log('📄 Using fallback filename:', actualFilename);
    }
    
    // Read as text for XML files
    const text = await response.text();
    
    // Convert to base64 using TextEncoder (modern UTF-8 safe method)
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(text);
    const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
    const base64 = btoa(binaryString);
    
    // Store in chrome.storage
    const contextId = extractContextId(url);
    const fileData = {
      filename: actualFilename,
      content: base64,
      timestamp: Date.now(),
      pageType: pageContext.type,
      contextId: contextId,
      source: 'quick-load'
    };
    
    await chrome.storage.local.set({ autoLoadedFile: fileData });
    
    // Notify sidepanel that file is ready (broadcasts to all extension contexts)
    chrome.runtime.sendMessage({
      type: 'FILE_READY_SIDEPANEL',
      filename: actualFilename
    }).catch(() => {
      // Sidepanel might not be open, that's okay
      console.log('Sidepanel not open, file will load via polling');
    });
    
    // Also notify content script that file is ready
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'FILE_READY',
        filename: actualFilename
      }).catch(() => {
        // Content script might not be ready
      });
    }
    
  } catch (error) {
    console.error('Capture failed:', error);
    // Notify user of error
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'FILE_ERROR',
        error: error.message
      }).catch(() => {});
    }
  }
}

// Generate filename based on page type and context
function generateFilename(url, pageContext) {
  const contextId = extractContextId(url);
  const prefix = pageContext.type === 'blendedx' ? 'blendedx' :
                 pageContext.type === 'learning-channel' ? 'training' :
                 pageContext.type === 'homepage' ? 'homepage' : 'translations';
  return `${prefix}_${contextId || 'export'}.xml`;
}

// Handle automatic text loading
async function handleAutoLoadText(content, pageContext, sourceLanguage, tab) {
  try {
    console.log('📧 Storing auto-loaded text with source language:', sourceLanguage);
    
    // Store text content in chrome.storage
    const textData = {
      content: content,
      timestamp: Date.now(),
      pageType: pageContext.type,
      mode: 'text',
      sourceLanguage: sourceLanguage
    };
    
    await chrome.storage.local.set({ autoLoadedText: textData });
    
    // Notify content script that text is ready
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'TEXT_READY',
        sourceLanguage: sourceLanguage
      }).catch(() => {
        // Content script might not be ready
      });
    }
    
  } catch (error) {
    console.error('Auto-load text failed:', error);
    // Notify user of error
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'FILE_ERROR',
        error: error.message
      }).catch(() => {});
    }
  }
}

// Extract context ID from URL
function extractContextId(url) {
  const match = url.match(/context_id=(\d+)/);
  return match ? match[1] : null;
}

// Cleanup old auto-loaded content (after 5 minutes)
setInterval(async () => {
  const result = await chrome.storage.local.get(['autoLoadedFile', 'autoLoadedText']);
  
  // Cleanup old file
  if (result.autoLoadedFile) {
    const age = Date.now() - result.autoLoadedFile.timestamp;
    if (age > 5 * 60 * 1000) { // 5 minutes
      await chrome.storage.local.remove(['autoLoadedFile']);
      console.log('Cleaned up old auto-loaded file');
    }
  }
  
  // Cleanup old text
  if (result.autoLoadedText) {
    const age = Date.now() - result.autoLoadedText.timestamp;
    if (age > 5 * 60 * 1000) { // 5 minutes
      await chrome.storage.local.remove(['autoLoadedText']);
      console.log('Cleaned up old auto-loaded text');
    }
  }
}, 60 * 1000); // Check every minute

// Listen for clicks on the extension icon
chrome.action.onClicked.addListener(async (tab) => {
  const windowId = tab.windowId;
  
  // Check current state (default to closed if not tracked)
  const isOpen = sidebarStates.get(windowId) || false;
  
  if (isOpen) {
    // Close the side panel by setting behavior to default
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      enabled: false
    });
    // Re-enable it immediately so it can be opened again
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      enabled: true
    });
    sidebarStates.set(windowId, false);
    
    // Notify content script that sidebar is closed
    chrome.tabs.sendMessage(tab.id, {
      type: 'SIDEBAR_STATE_CHANGED',
      visible: false
    }).catch(() => {
      // Content script might not be loaded, that's okay
    });
  } else {
    // Open the side panel
    await chrome.sidePanel.open({ windowId: windowId });
    sidebarStates.set(windowId, true);
    
    // Notify content script that sidebar is open
    chrome.tabs.sendMessage(tab.id, {
      type: 'SIDEBAR_STATE_CHANGED',
      visible: true
    }).catch(() => {
      // Content script might not be loaded, that's okay
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_SIDEBAR') {
    // Open sidebar when floating button is clicked
    chrome.windows.getCurrent((window) => {
      chrome.sidePanel.open({ windowId: window.id });
      sidebarStates.set(window.id, true);
      
      // Notify content script that sidebar is now open
      if (sender.tab) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'SIDEBAR_STATE_CHANGED',
          visible: true
        }).catch(() => {});
      }
    });
  } else if (message.type === 'DOWNLOAD_AND_CAPTURE') {
    // Handle download with Save As dialog + extension capture
    handleDownloadAndCapture(message.url, message.pageContext, message.saveAs, sender.tab);
  } else if (message.type === 'CAPTURE_FILE') {
    // Handle file capture (parallel to browser download)
    handleCaptureFile(message.url, message.pageContext, message.filename, sender.tab);
  } else if (message.type === 'AUTO_LOAD_TEXT') {
    // Handle automatic text loading from Email pages
    handleAutoLoadText(message.content, message.pageContext, message.sourceLanguage, sender.tab);
  } else if (message.type === 'CHECK_AUTO_LOADED_FILE') {
    // Check if there's an auto-loaded file in storage
    chrome.storage.local.get(['autoLoadedFile'], (result) => {
      sendResponse({ hasFile: !!result.autoLoadedFile, file: result.autoLoadedFile });
    });
    return true; // Keep channel open for async response
  } else if (message.type === 'CLEAR_AUTO_LOADED_FILE') {
    // Clear the auto-loaded file from storage
    chrome.storage.local.remove(['autoLoadedFile'], () => {
      sendResponse({ success: true });
    });
    return true;
  } else if (message.type === 'CHECK_AUTO_LOADED_TEXT') {
    // Check if there's an auto-loaded text in storage
    chrome.storage.local.get(['autoLoadedText'], (result) => {
      sendResponse({ hasText: !!result.autoLoadedText, text: result.autoLoadedText });
    });
    return true; // Keep channel open for async response
  } else if (message.type === 'CLEAR_AUTO_LOADED_TEXT') {
    // Clear the auto-loaded text from storage
    chrome.storage.local.remove(['autoLoadedText'], () => {
      sendResponse({ success: true });
    });
    return true;
  } else if (message.type === 'GET_SIDEBAR_STATE') {
    // Get current sidebar state for active window
    chrome.windows.getCurrent((window) => {
      const isOpen = sidebarStates.get(window.id) || false;
      sendResponse({ isOpen: isOpen });
    });
    return true; // Keep channel open for async response
  }
  return true; // Keep message channel open for async response
});

// Clean up state when window is closed
chrome.windows.onRemoved.addListener((windowId) => {
  sidebarStates.delete(windowId);
});
