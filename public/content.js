// Content script for AI Translate Extension
// Simplified guided workflow with unified toast system

(function() {
  'use strict';

  // Page detection logic
  function detectPageType(url) {
    // Email pages
    if (url.includes('/path_email_rules/path_email_rules.php?')) {
      return {
        type: 'email',
        mode: 'text',
        label: 'Email Translation',
        icon: '📧',
        description: 'Detected email rules page'
      };
    }
    
    // Home pages
    if (url.includes('/manage_translations.php?')) {
      return {
        type: 'homepage',
        mode: 'file',
        label: 'Home Page',
        icon: '🏠',
        description: 'Detected homepage translation'
      };
    }
    
    // Learning Channel
    if (url.includes('/training/training_manage_translations.php?')) {
      return {
        type: 'learning-channel',
        mode: 'file',
        label: 'Learning Channel',
        icon: '📚',
        description: 'Detected learning channel'
      };
    }
    
    // BlendedX
    const blendedxPattern = /\/administration\/training\/guided(\/session)?\/\d+\/translations/;
    if (blendedxPattern.test(url)) {
      return {
        type: 'blendedx',
        mode: 'file',
        label: 'BlendedX',
        icon: '🎓',
        description: 'Detected BlendedX training'
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
        description: 'Detected Meta-Skills Avatar AI editor'
      };
    }
    
    return {
      type: 'unknown',
      mode: 'file',
      label: 'General',
      icon: '🤖',
      description: 'No specific page detected'
    };
  }

  // Detect current page
  const pageContext = detectPageType(window.location.href);

  // ========== EMAIL CONTENT EXTRACTION ==========
  
  // Handle email content extraction request
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_EMAIL_CONTENT') {
      (async () => {
        let content = null;
        
        if (pageContext.type === 'meta-skills') {
          content = await extractMetaSkillsJSON();
        } else if (pageContext.type === 'email') {
          content = extractEmailContent();
        }
        
        if (content) {
          sendResponse({
            success: true,
            content: content,
            sourceLanguage: null
          });
        } else {
          sendResponse({
            success: false,
            message: 'No content found on this page'
          });
        }
      })();
      return true;
    }
  });

  // Sidebar state tracking
  let isSidebarOpen = false;

  // ========== UNIFIED TOAST SYSTEM ==========

  function removeToast() {
    const existing = document.getElementById('ai-translate-toast');
    if (existing) {
      existing.remove();
    }
  }

  function showWaitingToast() {
    removeToast();
    
    const toast = document.createElement('div');
    toast.id = 'ai-translate-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;';
    
    const shadow = toast.attachShadow({ mode: 'open' });
    
    // Get context label from pageContext
    const contextLabel = pageContext.label || 'Content';
    
    shadow.innerHTML = `
      <style>
        .toast-container {
          position: relative;
          width: fit-content;
          max-width: 420px;
          min-width: 360px;
        }
        
        .toast {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(139, 92, 246, 0.95) 100%);
          border-radius: 16px;
          padding: 3px;
          box-shadow: 
            0 10px 30px rgba(99, 102, 241, 0.25),
            0 0 40px rgba(139, 92, 246, 0.15);
          animation: slideInRight 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
                     floatPulse 3s ease-in-out 0.5s infinite;
          position: relative;
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(120%) rotate(3deg);
            opacity: 0;
          }
          to {
            transform: translateX(0) rotate(0deg);
            opacity: 1;
          }
        }
        
        @keyframes floatPulse {
          0%, 100% {
            transform: translateY(0px);
            box-shadow: 
              0 10px 30px rgba(99, 102, 241, 0.25),
              0 0 40px rgba(139, 92, 246, 0.15);
          }
          50% {
            transform: translateY(-3px);
            box-shadow: 
              0 14px 35px rgba(99, 102, 241, 0.3),
              0 0 50px rgba(139, 92, 246, 0.2);
          }
        }
        
        .toast::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 16px;
          padding: 3px;
          background: linear-gradient(45deg, rgba(99, 102, 241, 0.8), rgba(139, 92, 246, 0.8), rgba(99, 102, 241, 0.8));
          background-size: 200% 200%;
          animation: gradientRotate 4s ease infinite;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0.4;
        }
        
        @keyframes gradientRotate {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .toast-inner {
          background: white;
          backdrop-filter: blur(10px);
          border-radius: 14px;
          padding: 16px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          grid-template-rows: auto;
          gap: 12px;
          align-items: center;
          position: relative;
        }
        
        .toast-icon-circle {
          grid-column: 1;
          grid-row: 1;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
          animation: iconBounce 2s ease-in-out infinite;
        }
        
        @keyframes iconBounce {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.08) rotate(-3deg); }
          75% { transform: scale(0.96) rotate(3deg); }
        }
        
        .toast-content-area {
          grid-column: 2;
          grid-row: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
        }
        
        .toast-title-bold {
          font-size: 15px;
          font-weight: 600;
          color: #1e293b;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }
        
        .toast-subtitle {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
          line-height: 1.4;
          margin-top: 1px;
        }
        
        .toast-action-btn {
          grid-column: 3;
          grid-row: 1;
          padding: 10px 18px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
          white-space: nowrap;
        }
        
        .toast-action-btn::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.25);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        
        .toast-action-btn:hover::before {
          width: 200px;
          height: 200px;
        }
        
        .toast-action-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
        }
        
        .toast-action-btn:active {
          transform: scale(0.95);
        }
        
        .btn-text {
          position: relative;
          z-index: 1;
        }
        
        .btn-arrow {
          position: relative;
          z-index: 1;
          transition: transform 0.3s;
          font-size: 14px;
        }
        
        .toast-action-btn:hover .btn-arrow {
          transform: translateX(3px);
        }
        
        .toast-close-btn {
          position: absolute;
          top: -8px;
          left: -8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          border: 2px solid rgba(99, 102, 241, 0.3);
          color: #64748b;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 100;
          line-height: 1;
          padding: 0;
          opacity: 0;
          animation: fadeInButton 0.3s ease-out 0.4s forwards;
        }
        
        @keyframes fadeInButton {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .toast-close-btn:hover {
          background: #fee2e2;
          border-color: #ef4444;
          color: #ef4444;
          transform: scale(1.15) rotate(90deg);
          box-shadow: 0 6px 16px rgba(239, 68, 68, 0.3);
        }
        
        .toast-close-btn:active {
          transform: scale(1.05) rotate(90deg);
        }
      </style>
      
      <div class="toast-container">
        <button class="toast-close-btn" data-action="close">×</button>
        <div class="toast">
          <div class="toast-inner">
            <div class="toast-icon-circle">🌍</div>
            <div class="toast-content-area">
              <div class="toast-title-bold">Translate ${contextLabel}</div>
              <div class="toast-subtitle">Ready to process</div>
            </div>
            <button class="toast-action-btn" data-action="quick-translate">
              <span class="btn-text">Start</span>
              <span class="btn-arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    `;
    
    shadow.querySelector('[data-action="close"]').onclick = () => removeToast();
    shadow.querySelector('[data-action="quick-translate"]').onclick = handleQuickTranslate;
    
    document.body.appendChild(toast);
  }

  function showBriefLoadingToast() {
    const toast = document.getElementById('ai-translate-toast');
    if (!toast) return;
    
    const shadow = toast.shadowRoot;
    
    shadow.innerHTML = `
      <style>
        .toast-container {
          position: relative;
          width: fit-content;
          max-width: 320px;
          min-width: 280px;
        }
        
        .toast {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.95) 0%, rgba(192, 132, 252, 0.95) 100%);
          border-radius: 16px;
          padding: 3px;
          box-shadow: 
            0 10px 30px rgba(168, 85, 247, 0.25),
            0 0 40px rgba(192, 132, 252, 0.15);
          animation: slideInRight 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(120%) rotate(3deg);
            opacity: 0;
          }
          to {
            transform: translateX(0) rotate(0deg);
            opacity: 1;
          }
        }
        
        .toast-inner {
          background: white;
          backdrop-filter: blur(10px);
          border-radius: 14px;
          padding: 16px;
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 12px;
          align-items: center;
          position: relative;
        }
        
        .toast-icon-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #a855f7 0%, #c084fc 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
          animation: spinPulse 1.5s ease-in-out infinite;
        }
        
        @keyframes spinPulse {
          0%, 100% {
            transform: rotate(0deg) scale(1);
          }
          50% {
            transform: rotate(180deg) scale(1.08);
          }
        }
        
        .toast-content-area {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
        }
        
        .toast-title-bold {
          font-size: 15px;
          font-weight: 600;
          color: #1e293b;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }
        
        .toast-subtitle {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
          line-height: 1.4;
          margin-top: 1px;
        }
        
        .toast-close-btn {
          position: absolute;
          top: -8px;
          left: -8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          border: 2px solid rgba(168, 85, 247, 0.3);
          color: #64748b;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 100;
          line-height: 1;
          padding: 0;
          opacity: 0;
          animation: fadeInButton 0.3s ease-out 0.4s forwards;
        }
        
        @keyframes fadeInButton {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .toast-close-btn:hover {
          background: #fee2e2;
          border-color: #ef4444;
          color: #ef4444;
          transform: scale(1.15) rotate(90deg);
          box-shadow: 0 6px 16px rgba(239, 68, 68, 0.3);
        }
      </style>
      
      <div class="toast-container">
        <button class="toast-close-btn" data-action="close">×</button>
        <div class="toast">
          <div class="toast-inner">
            <div class="toast-icon-circle">⚡</div>
            <div class="toast-content-area">
              <div class="toast-title-bold">Processing...</div>
              <div class="toast-subtitle">Please wait</div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    shadow.querySelector('[data-action="close"]').onclick = () => removeToast();
  }

  function showSuccessToastWithOpenButton(filename) {
    removeToast();
    
    const toast = document.createElement('div');
    toast.id = 'ai-translate-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;';
    
    const shadow = toast.attachShadow({ mode: 'open' });
    
    shadow.innerHTML = `
      <style>
        .toast-container {
          position: relative;
          width: fit-content;
          max-width: 420px;
          min-width: 360px;
        }
        
        .toast {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(52, 211, 153, 0.95) 100%);
          border-radius: 16px;
          padding: 3px;
          box-shadow: 
            0 10px 30px rgba(16, 185, 129, 0.25),
            0 0 40px rgba(52, 211, 153, 0.15);
          animation: slideInRight 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(120%) rotate(3deg);
            opacity: 0;
          }
          to {
            transform: translateX(0) rotate(0deg);
            opacity: 1;
          }
        }
        
        .toast-inner {
          background: white;
          backdrop-filter: blur(10px);
          border-radius: 14px;
          padding: 16px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          grid-template-rows: auto;
          gap: 12px;
          align-items: center;
          position: relative;
        }
        
        .toast-icon-circle {
          grid-column: 1;
          grid-row: 1;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
          animation: successPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        @keyframes successPop {
          0% {
            transform: scale(0) rotate(-180deg);
          }
          50% {
            transform: scale(1.2) rotate(10deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
          }
        }
        
        .toast-content-area {
          grid-column: 2;
          grid-row: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
        }
        
        .toast-title-bold {
          font-size: 15px;
          font-weight: 600;
          color: #1e293b;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }
        
        .toast-subtitle {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
          line-height: 1.4;
          margin-top: 1px;
        }
        
        .toast-action-btn {
          grid-column: 3;
          grid-row: 1;
          padding: 10px 18px;
          background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
          white-space: nowrap;
        }
        
        .toast-action-btn::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.25);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        
        .toast-action-btn:hover::before {
          width: 200px;
          height: 200px;
        }
        
        .toast-action-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
        }
        
        .toast-action-btn:active {
          transform: scale(0.95);
        }
        
        .btn-text {
          position: relative;
          z-index: 1;
        }
        
        .btn-arrow {
          position: relative;
          z-index: 1;
          transition: transform 0.3s;
          font-size: 14px;
        }
        
        .toast-action-btn:hover .btn-arrow {
          transform: translateX(3px);
        }
        
        .toast-close-btn {
          position: absolute;
          top: -8px;
          left: -8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          border: 2px solid rgba(16, 185, 129, 0.3);
          color: #64748b;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 100;
          line-height: 1;
          padding: 0;
          opacity: 0;
          animation: fadeInButton 0.3s ease-out 0.4s forwards;
        }
        
        @keyframes fadeInButton {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .toast-close-btn:hover {
          background: #fee2e2;
          border-color: #ef4444;
          color: #ef4444;
          transform: scale(1.15) rotate(90deg);
          box-shadow: 0 6px 16px rgba(239, 68, 68, 0.3);
        }
        
        .toast-close-btn:active {
          transform: scale(1.05) rotate(90deg);
        }
      </style>
      
      <div class="toast-container">
        <button class="toast-close-btn" data-action="close">×</button>
        <div class="toast">
          <div class="toast-inner">
            <div class="toast-icon-circle">✓</div>
            <div class="toast-content-area">
              <div class="toast-title-bold">File Ready!</div>
              <div class="toast-subtitle">Translation prepared</div>
            </div>
            <button class="toast-action-btn" data-action="open-sidebar">
              <span class="btn-text">Open</span>
              <span class="btn-arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    `;
    
    shadow.querySelector('[data-action="close"]').onclick = () => removeToast();
    shadow.querySelector('[data-action="open-sidebar"]').onclick = () => {
      chrome.runtime.sendMessage({ type: 'OPEN_SIDEBAR' });
      removeToast();
    };
    
    document.body.appendChild(toast);
  }

  async function handleQuickTranslate() {
    console.log('⚡ Quick Translate clicked');
    
    // Check if this is an email or meta-skills page
    if (pageContext.type === 'email' || pageContext.type === 'meta-skills') {
      // Text mode: Extract content and open sidepanel
      let extractedContent = null;
      
      if (pageContext.type === 'meta-skills') {
        extractedContent = await extractMetaSkillsJSON();
      } else {
        extractedContent = extractEmailContent();
      }
      
      if (extractedContent) {
        console.log(`📧 Extracting ${pageContext.type} content and opening sidepanel`);
        
        // Store the text content
        chrome.runtime.sendMessage({
          type: 'AUTO_LOAD_TEXT',
          content: extractedContent,
          pageContext: pageContext,
          sourceLanguage: null
        });
        
        // Open sidepanel immediately
        chrome.runtime.sendMessage({ type: 'OPEN_SIDEBAR' });
        removeToast();
      } else {
        console.log('⚠️ No content found');
        showErrorToast('Could not extract JSON content from editor');
      }
    } else {
      // File pages: existing quick translate flow
      // 1. Show brief loading state
      showBriefLoadingToast();
      
      // 2. Build download URL with export parameter
      const downloadUrl = window.location.href.endsWith('/translations')
        ? window.location.href + '/download'
        : window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'export=excel';
      
      console.log('📥 Downloading from:', downloadUrl);
      
      // 3. Extract filename from page
      let filename = 'training_export.xml';
      const titleElement = document.querySelector('.content-title, h1, .page-title');
      if (titleElement) {
        const title = titleElement.textContent.trim();
        const sanitized = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        filename = `training_${sanitized}.xml`;
      } else {
        // Try to extract context_id from URL
        const match = downloadUrl.match(/context_id=(\d+)/);
        if (match) {
          filename = `training_${match[1]}.xml`;
        }
      }
      
      // 4. Capture file in background
      chrome.runtime.sendMessage({
        type: 'CAPTURE_FILE',
        url: downloadUrl,
        filename: filename,
        pageContext: pageContext
      });
      
      // 5. Open sidebar if not already open
      if (!isSidebarOpen) {
        console.log('🔓 Opening sidebar...');
        chrome.runtime.sendMessage({ type: 'OPEN_SIDEBAR' });
      } else {
        console.log('✅ Sidebar already open, will load file directly');
      }
      
      // 6. Remove toast after 800ms (silent success)
      setTimeout(() => removeToast(), 800);
    }
  }

  function showReadyToast(filename) {
    const toast = document.getElementById('ai-translate-toast');
    
    if (!toast) {
      // Create new toast if dismissed
      const newToast = document.createElement('div');
      newToast.id = 'ai-translate-toast';
      newToast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;';
      
      const shadow = newToast.attachShadow({ mode: 'open' });
      shadow.innerHTML = getReadyToastHTML(filename);
      attachReadyToastListeners(shadow);
      
      document.body.appendChild(newToast);
    } else {
      // Update existing toast with smooth transition
      const shadow = toast.shadowRoot;
      const toastElement = shadow.querySelector('.toast');
      
      // Fade out
      toastElement.style.transition = 'opacity 0.2s, transform 0.2s';
      toastElement.style.opacity = '0';
      toastElement.style.transform = 'scale(0.95)';
      
      setTimeout(() => {
        shadow.innerHTML = getReadyToastHTML(filename);
        attachReadyToastListeners(shadow);
        
        // Fade in
        const newElement = shadow.querySelector('.toast');
        newElement.style.transition = 'opacity 0.2s, transform 0.2s';
        requestAnimationFrame(() => {
          newElement.style.opacity = '1';
          newElement.style.transform = 'scale(1)';
        });
      }, 200);
    }
  }

  function getReadyToastHTML(filename) {
    return `
      <style>
        .toast-container {
          position: relative;
          width: fit-content;
          max-width: 320px;
          min-width: 280px;
        }
        
        .toast {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.95) 0%, rgba(192, 132, 252, 0.95) 100%);
          border-radius: 16px;
          padding: 3px;
          box-shadow: 
            0 10px 30px rgba(168, 85, 247, 0.25),
            0 0 40px rgba(192, 132, 252, 0.15);
          animation: slideInRight 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(120%) rotate(3deg);
            opacity: 0;
          }
          to {
            transform: translateX(0) rotate(0deg);
            opacity: 1;
          }
        }
        
        .toast-inner {
          background: white;
          backdrop-filter: blur(10px);
          border-radius: 14px;
          padding: 16px;
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 12px;
          align-items: center;
          position: relative;
        }
        
        .toast-icon-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #a855f7 0%, #c084fc 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
          animation: spinPulse 1.5s ease-in-out infinite;
        }
        
        @keyframes spinPulse {
          0%, 100% {
            transform: rotate(0deg) scale(1);
          }
          50% {
            transform: rotate(180deg) scale(1.08);
          }
        }
        
        .toast-content-area {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
        }
        
        .toast-title-bold {
          font-size: 15px;
          font-weight: 600;
          color: #1e293b;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }
        
        .toast-subtitle {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
          line-height: 1.4;
          margin-top: 1px;
        }
        
        .toast-close-btn {
          position: absolute;
          top: -8px;
          left: -8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          border: 2px solid rgba(168, 85, 247, 0.3);
          color: #64748b;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 100;
          line-height: 1;
          padding: 0;
          opacity: 0;
          animation: fadeInButton 0.3s ease-out 0.4s forwards;
        }
        
        @keyframes fadeInButton {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .toast-close-btn:hover {
          background: #fee2e2;
          border-color: #ef4444;
          color: #ef4444;
          transform: scale(1.15) rotate(90deg);
          box-shadow: 0 6px 16px rgba(239, 68, 68, 0.3);
        }
      </style>
      
      <div class="toast-container">
        <button class="toast-close-btn" data-action="close">×</button>
        <div class="toast">
          <div class="toast-inner">
            <div class="toast-icon-circle">⚡</div>
            <div class="toast-content-area">
              <div class="toast-title-bold">Loading...</div>
              <div class="toast-subtitle">Please wait</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function attachReadyToastListeners(shadow) {
    shadow.querySelector('[data-action="close"]').onclick = () => removeToast();
    shadow.querySelector('[data-action="open"]').onclick = () => {
      // Set pending load flag IMMEDIATELY so sidepanel shows loading right away
      chrome.storage.local.set({ pendingFileLoad: true });
      
      // For email/meta-skills pages, use AUTO_LOAD_TEXT flow
      if (pageContext.type === 'email' || pageContext.type === 'meta-skills') {
        const content = pageContext.type === 'email' 
          ? extractEmailContent() 
          : null; // Meta-skills would need async, handle separately if needed
          
        if (content) {
          console.log(`📧 Auto-extracting ${pageContext.type} content on Open Translator click`);
          // Store the text content using unified flow
          chrome.runtime.sendMessage({
            type: 'AUTO_LOAD_TEXT',
            content: content,
            pageContext: pageContext,
            sourceLanguage: pageContext.detectedSourceLanguage || null
          });
          
          // Open sidebar
          chrome.runtime.sendMessage({ type: 'OPEN_SIDEBAR' });
          removeToast();
          return;
        }
      }
      
      // For file pages, use existing flow
      chrome.runtime.sendMessage({ type: 'OPEN_SIDEBAR' });
      removeToast();
    };
  }

  function showErrorToast(errorMessage) {
    const toast = document.getElementById('ai-translate-toast');
    if (!toast) return;
    
    const shadow = toast.shadowRoot;
    shadow.innerHTML = `
      <style>
        .toast-container {
          position: relative;
          width: fit-content;
          max-width: 420px;
          min-width: 360px;
        }
        
        .toast {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(248, 113, 113, 0.95) 100%);
          border-radius: 16px;
          padding: 3px;
          box-shadow: 
            0 10px 30px rgba(239, 68, 68, 0.25),
            0 0 40px rgba(248, 113, 113, 0.15);
          animation: slideInRight 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
                     shake 0.5s 0.5s;
          position: relative;
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(120%) rotate(3deg);
            opacity: 0;
          }
          to {
            transform: translateX(0) rotate(0deg);
            opacity: 1;
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        
        .toast-inner {
          background: white;
          backdrop-filter: blur(10px);
          border-radius: 14px;
          padding: 16px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          grid-template-rows: auto auto;
          gap: 12px;
          align-items: center;
          position: relative;
        }
        
        .toast-icon-circle {
          grid-column: 1;
          grid-row: 1 / 3;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
          animation: errorShake 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        @keyframes errorShake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-12deg); }
          75% { transform: rotate(12deg); }
        }
        
        .toast-content-area {
          grid-column: 2;
          grid-row: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
        }
        
        .toast-title-bold {
          font-size: 15px;
          font-weight: 600;
          color: #1e293b;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }
        
        .toast-subtitle {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
          line-height: 1.4;
          margin-top: 1px;
        }
        
        .toast-action-btn {
          grid-column: 2 / 4;
          grid-row: 2;
          padding: 10px 18px;
          background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          overflow: hidden;
          white-space: nowrap;
          margin-top: 4px;
        }
        
        .toast-action-btn::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.25);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        
        .toast-action-btn:hover::before {
          width: 200px;
          height: 200px;
        }
        
        .toast-action-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);
        }
        
        .toast-action-btn:active {
          transform: scale(0.95);
        }
        
        .btn-text {
          position: relative;
          z-index: 1;
        }
        
        .btn-icon {
          position: relative;
          z-index: 1;
          transition: transform 0.3s;
          font-size: 14px;
        }
        
        .toast-action-btn:hover .btn-icon {
          transform: rotate(360deg);
        }
        
        .toast-close-btn {
          position: absolute;
          top: -8px;
          left: -8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          border: 2px solid rgba(239, 68, 68, 0.3);
          color: #64748b;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 100;
          line-height: 1;
          padding: 0;
          opacity: 0;
          animation: fadeInButton 0.3s ease-out 0.4s forwards;
        }
        
        @keyframes fadeInButton {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .toast-close-btn:hover {
          background: #fee2e2;
          border-color: #ef4444;
          color: #ef4444;
          transform: scale(1.15) rotate(90deg);
          box-shadow: 0 6px 16px rgba(239, 68, 68, 0.3);
        }
        
        .toast-close-btn:active {
          transform: scale(1.05) rotate(90deg);
        }
      </style>
      
      <div class="toast-container">
        <button class="toast-close-btn" data-action="close">×</button>
        <div class="toast">
          <div class="toast-inner">
            <div class="toast-icon-circle">!</div>
            <div class="toast-content-area">
              <div class="toast-title-bold">Download Failed</div>
              <div class="toast-subtitle">${errorMessage || 'Check your connection'}</div>
            </div>
            <button class="toast-action-btn" data-action="retry">
              <span class="btn-text">Retry</span>
              <span class="btn-icon">↻</span>
            </button>
          </div>
        </div>
      </div>
    `;
    
    shadow.querySelector('[data-action="close"]').onclick = () => removeToast();
    shadow.querySelector('[data-action="retry"]').onclick = () => handleQuickTranslate();
  }

  // ========== PASSIVE LINK CAPTURE ==========

  // Listen for clicks on export links (don't prevent default)
  document.addEventListener('click', (e) => {
    const target = e.target.closest('a');
    if (!target || !target.href) return;
    
    // Check if it's an export link
    const isExportLink = 
      target.href.includes('export=excel') ||
      target.href.includes('/translations/download');
    
    if (!isExportLink) return;
    
    console.log('📥 Export link clicked:', target.href);
    
    // DON'T prevent default - let browser download normally
    // Trigger the same Quick Translate flow for consistent behavior
    handleQuickTranslate();
  }, true);

  // ========== EMAIL EXTRACTION ==========

  function extractEmailContent() {
    const textarea = document.querySelector('textarea#htmlEditor_message_editor');
    if (textarea && textarea.value) {
      return textarea.value;
    }
    return null;
  }

  // ========== META-SKILLS JSON EXTRACTION ==========

  // Helper function to wait for an element to appear in the DOM
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  async function extractMetaSkillsJSON() {
    console.log('🔍 Waiting for CodeMirror editor to load...');
    
    const cmContent = await waitForElement('[data-language="json"].cm-content', 5000);
    
    if (!cmContent) {
      console.log('❌ CodeMirror JSON editor not found after waiting');
      return null;
    }
    
    console.log('✅ Editor found, extracting via selection...');
    
    try {
      // Save current selection to restore later
      const selection = window.getSelection();
      const originalRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      
      // Focus the editor content
      cmContent.focus();
      
      // Create a range that selects all content
      const range = document.createRange();
      range.selectNodeContents(cmContent);
      selection.removeAllRanges();
      selection.addRange(range);
      
      console.log('📋 Selected all content, extracting text...');
      
      // Try modern clipboard API first
      let jsonString = null;
      
      try {
        // Execute copy command
        const copySuccess = document.execCommand('copy');
        
        if (copySuccess) {
          // Read from clipboard using modern API
          jsonString = await navigator.clipboard.readText();
          console.log('✅ Copied via modern clipboard API');
        }
      } catch (clipboardError) {
        console.log('⚠️ Modern clipboard API failed, trying alternative...');
      }
      
      // Fallback: get the selected text directly (THIS is what works!)
      if (!jsonString || jsonString.trim().length === 0) {
        jsonString = selection.toString();
        console.log('✅ Extracted via selection.toString()');
      }
      
      // Restore original selection
      selection.removeAllRanges();
      if (originalRange) {
        selection.addRange(originalRange);
      }
      
      if (!jsonString || jsonString.trim().length === 0) {
        console.log('❌ No content extracted');
        return null;
      }
      
      console.log('✅ Extracted JSON:', jsonString.substring(0, 100) + '...');
      console.log('📏 Total length:', jsonString.length);
      
      // Validate JSON
      try {
        JSON.parse(jsonString);
        console.log('✅ JSON is valid');
        return jsonString;
      } catch (e) {
        console.error('❌ Invalid JSON:', e);
        return null;
      }
      
    } catch (error) {
      console.error('❌ Extraction failed:', error);
      return null;
    }
  }

  // ========== MESSAGE LISTENERS ==========

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TRIGGER_QUICK_TRANSLATE') {
      // Check if we can load from this page
      if (pageContext.type === 'unknown') {
        sendResponse({ success: false, message: 'Not a translation page. Please navigate to a CKLS translation page.' });
        return true;
      }
      
      // Trigger the existing Quick Translate flow
      handleQuickTranslate();
      sendResponse({ success: true });
      return true;
    }
    
    if (message.type === 'FILE_READY') {
      // File captured successfully
      console.log('✅ File ready:', message.filename);
      
      // Check sidebar state to decide what to do
      if (isSidebarOpen) {
        // Sidebar is open - just remove toast, file will auto-load
        console.log('📂 Sidebar open - removing toast, file will auto-load');
        removeToast();
      } else {
        // Sidebar is closed - show success toast with open button
        console.log('💡 Sidebar closed - showing success toast');
        showSuccessToastWithOpenButton(message.filename);
      }
      
    } else if (message.type === 'FILE_ERROR') {
      // File capture failed - show error toast
      showErrorToast(message.error);
      
    } else if (message.type === 'SIDEBAR_STATE_CHANGED') {
      // Track sidebar state
      isSidebarOpen = message.visible;
      console.log('📊 Sidebar state:', isSidebarOpen ? 'open' : 'closed');
      
      // Update waiting toast subtitle if visible
      const existingToast = document.getElementById('ai-translate-toast');
      if (existingToast && existingToast.shadowRoot) {
        const hintElement = existingToast.shadowRoot.querySelector('.toast-hint');
        if (hintElement) {
          const currentHint = hintElement.textContent;
          // Only update if it's the waiting toast (not error/loading)
          if (currentHint.includes('start translating') || currentHint.includes('load file')) {
            hintElement.textContent = isSidebarOpen 
              ? 'Click to load file' 
              : 'Click to start translating';
          }
        }
      }
    }
  });

  // ========== INITIALIZATION ==========

  function initializeExtension() {
    console.log('🎯 AI Translate Extension initialized');
    console.log('📄 Page type:', pageContext.type);
    
    if (pageContext.type === 'unknown') {
      console.log('ℹ️ Not a translation page, extension inactive');
      return;
    }
    
    if (pageContext.type === 'email') {
      // Email pages: show waiting toast immediately
      console.log('📧 Email page detected');
      setTimeout(() => showWaitingToast(), 500);
    } else if (pageContext.type === 'meta-skills') {
      // Meta-Skills pages: wait for JSON editor before showing toast
      console.log('🎨 Meta-Skills page detected, waiting for JSON editor...');
      waitForElement('[data-language="json"].cm-content', 5000).then(editor => {
        if (editor) {
          console.log('✅ JSON editor visible, showing toast');
          showWaitingToast();
        } else {
          console.log('⚠️ JSON editor not found, toast not shown');
        }
      });
    } else if (pageContext.type !== 'unknown') {
      // All file pages: show waiting toast
      console.log('✅ Showing waiting toast');
      setTimeout(() => showWaitingToast(), 500);
    }
  }

  // Start when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
  } else {
    initializeExtension();
  }
  
})();
