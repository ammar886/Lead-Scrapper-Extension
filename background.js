/**
 * Pastry Lead Scraper - Background Service Worker (Manifest V3)
 * Orchestrates tab management, lead persistence, and inter-component messaging.
 */

// Import storage & normalization scripts into the service worker
importScripts('./utils/normalize.js', './utils/storage.js', './utils/license.js');

/**
 * Handle extension install / update.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Pastry Lead Scraper] Installed. Reason:', details.reason);

  // Initialize storage stats if not set
  const stats = await getStats();
  if (stats.duplicatesPrevented === undefined) {
    await StorageAdapter.set({ [STORAGE_KEYS.STATS]: { duplicatesPrevented: 0 } });
  }

  // Open the dashboard tab upon initial installation for a seamless welcome experience
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  }
});

/**
 * Message routing dispatcher.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const action = request.action;

  // 1. Save extracted leads from content script
  if (action === 'SAVE_EXTRACTED_LEADS') {
    (async () => {
      try {
        const leads = request.leads || [];
        const result = await saveBusinesses(leads);
        sendResponse({ success: true, ...result });
      } catch (err) {
        console.error('[Background] Failed to save leads:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep asynchronous channel open
  }

  // 2. Open search tab for Google Maps, Yelp, or business websites
  if (action === 'OPEN_SEARCH_TAB') {
    (async () => {
      try {
        const { url } = request;
        if (!url) {
          sendResponse({ success: false, error: 'No URL provided' });
          return;
        }
        const tab = await chrome.tabs.create({ url, active: true });
        sendResponse({ success: true, tabId: tab.id });
      } catch (err) {
        console.error('[Background] Failed to open tab:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 3. Trigger extraction on a specific tab (or active tab)
  if (action === 'TRIGGER_EXTRACTION') {
    (async () => {
      try {
        let tabId = request.tabId;
        if (!tabId) {
          // Query active tab in current window
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!activeTab || !activeTab.id) {
            sendResponse({ success: false, error: 'No active tab detected.' });
            return;
          }
          tabId = activeTab.id;
        }

        // Try sending message to content script
        let extractedResult = null;
        try {
          extractedResult = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_LEADS' }, (res) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(res);
              }
            });
          });
        } catch (injectionError) {
          // Content script not yet injected (e.g. tab was open before extension installed)
          console.log('[Background] Injecting content scripts into tab:', tabId);
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: [
                'utils/normalize.js',
                'utils/extractWebsite.js',
                'utils/extractGoogleMaps.js',
                'utils/extractYelp.js',
                'content.js'
              ]
            });

            // Re-attempt extraction message after brief delay for script initialization
            await new Promise((r) => setTimeout(r, 400));
            extractedResult = await new Promise((resolve, reject) => {
              chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_LEADS' }, (res) => {
                if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                else resolve(res);
              });
            });
          } catch (execErr) {
            console.error('[Background] Script injection failed:', execErr);
            sendResponse({
              success: false,
              error: 'Cannot extract from this tab. Please make sure the tab is a standard website or refresh the page.'
            });
            return;
          }
        }

        sendResponse(extractedResult);
      } catch (err) {
        console.error('[Background] Extraction trigger failed:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 4. Open dashboard tab
  if (action === 'OPEN_DASHBOARD') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    sendResponse({ success: true });
    return false;
  }

  return false;
});

