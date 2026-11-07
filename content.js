/**
 * Pastry Lead Scraper - Content Script
 * Executes on target web pages (Google Maps, Yelp, and arbitrary business websites).
 * Communicates with the extension popup, dashboard, and background service worker.
 */

(function () {
  // Prevent duplicate injection
  if (window.__PASTRY_SCRAPER_INJECTED__) return;
  window.__PASTRY_SCRAPER_INJECTED__ = true;

  console.log('[Pastry Lead Scraper] Content script active on:', window.location.href);

  /**
   * Detect the source type of current page.
   */
  function detectSource() {
    const host = window.location.hostname.toLowerCase();
    const path = window.location.pathname.toLowerCase();

    if (host.includes('google.') && (path.includes('/maps') || host.startsWith('maps.'))) {
      return 'google_maps';
    }
    if (host.includes('yelp.')) {
      return 'yelp';
    }
    return 'website';
  }

  /**
   * Performs extraction based on detected page type.
   */
  function performExtraction() {
    const source = detectSource();
    let rawLeads = [];

    try {
      if (source === 'google_maps') {
        if (typeof extractGoogleMaps === 'function') {
          rawLeads = extractGoogleMaps(document, window.location);
        } else if (window.PastryExtractGoogleMaps) {
          rawLeads = window.PastryExtractGoogleMaps.extractGoogleMaps(document, window.location);
        }
      } else if (source === 'yelp') {
        // Detect access restriction or CAPTCHA gate before parsing
        const blockDetector = typeof detectYelpBlock === 'function'
          ? detectYelpBlock
          : (window.PastryExtractYelp ? window.PastryExtractYelp.detectYelpBlock : null);

        if (blockDetector && blockDetector(document).isBlocked) {
          console.warn('[Pastry Lead Scraper] Yelp access restricted. Extraction stopped.');
          return {
            success: false,
            blocked: true,
            status: 'Yelp access restricted',
            source: 'yelp',
            error: 'Yelp access restricted. Anti-bot or CAPTCHA challenge detected on this Yelp page.',
            leads: []
          };
        }

        let yelpRes = [];
        if (typeof extractYelp === 'function') {
          yelpRes = extractYelp(document, window.location);
        } else if (window.PastryExtractYelp) {
          yelpRes = window.PastryExtractYelp.extractYelp(document, window.location);
        }

        // Check if extractor reported a block
        if (yelpRes && (yelpRes.blocked || yelpRes.status === 'Yelp access restricted')) {
          return {
            success: false,
            blocked: true,
            status: 'Yelp access restricted',
            source: 'yelp',
            error: 'Yelp access restricted. Anti-bot or CAPTCHA challenge detected on this Yelp page.',
            leads: []
          };
        }

        rawLeads = Array.isArray(yelpRes) ? yelpRes : (yelpRes.leads || []);
      } else {
        // Individual business website
        if (typeof extractWebsite === 'function') {
          const single = extractWebsite(document, window.location);
          if (single && (single.name || single.phone || single.website)) {
            rawLeads = [single];
          }
        } else if (window.PastryExtractWebsite) {
          const single = window.PastryExtractWebsite.extractWebsite(document, window.location);
          if (single && (single.name || single.phone || single.website)) {
            rawLeads = [single];
          }
        }
      }
    } catch (err) {
      console.error('[Pastry Lead Scraper] Extraction error:', err);
      return {
        success: false,
        error: err.message,
        leads: [],
        source
      };
    }

    // Normalize each lead and reject blocked/invalid titles
    const normHelper = typeof createBusinessRecord === 'function'
      ? createBusinessRecord
      : (window.PastryNormalize ? window.PastryNormalize.createBusinessRecord : (x) => ({ ...x, id: 'pastry_' + Date.now() }));

    const isValidHelper = typeof isValidRecord === 'function'
      ? isValidRecord
      : (window.PastryNormalize ? window.PastryNormalize.isValidRecord : () => true);

    const normalizedLeads = [];
    for (const item of (rawLeads || [])) {
      if (!item) continue;
      item.source = source;
      const normalized = normHelper(item);
      if (isValidHelper(normalized)) {
        normalizedLeads.push(normalized);
      }
    }

    return {
      success: normalizedLeads.length > 0,
      blocked: false,
      status: normalizedLeads.length > 0 ? 'Success' : 'No leads detected',
      source,
      leads: normalizedLeads,
      count: normalizedLeads.length
    };
  }

  /**
   * Listen for incoming messages from Popup, Dashboard, or Background.
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'PING') {
      const source = detectSource();
      const isYelp = source === 'yelp';
      const isBlocked = isYelp && typeof detectYelpBlock === 'function' && detectYelpBlock(document).isBlocked;

      sendResponse({
        status: isBlocked ? 'Yelp access restricted' : 'ready',
        blocked: Boolean(isBlocked),
        source: source,
        url: window.location.href,
        title: document.title
      });
      return true;
    }

    if (request.action === 'EXTRACT_LEADS') {
      const result = performExtraction();

      if (result.blocked) {
        sendResponse({
          success: false,
          blocked: true,
          status: 'Yelp access restricted',
          source: 'yelp',
          error: 'Yelp access restricted. Anti-bot or CAPTCHA challenge detected on this Yelp page.',
          leads: []
        });
        return true;
      }

      if (result.success && result.leads.length > 0) {
        // Forward leads to background to save persistently
        chrome.runtime.sendMessage({
          action: 'SAVE_EXTRACTED_LEADS',
          leads: result.leads
        }, (saveRes) => {
          sendResponse({
            ...result,
            saveResult: saveRes
          });
        });
        return true; // Keep message channel open for async response
      } else {
        let failureReason = 'No business details could be detected on this page.';
        const source = detectSource();
        if (source === 'google_maps') {
          failureReason = 'Google Maps profile or feed not found. Please click on a specific place or search for businesses first.';
        } else if (source === 'yelp') {
          failureReason = 'Yelp business profile or search list not found. Please navigate to a business page or search results.';
        } else {
          failureReason = 'Could not locate standard business information or schema markup on this website.';
        }

        sendResponse({
          success: false,
          blocked: false,
          status: 'No business details found',
          error: failureReason,
          source: source,
          leads: []
        });
      }
      return true;
    }

    return false;
  });

  /**
   * Inject a non-intrusive floating Quick Action button on target pages.
   */
  function injectFloatingWidget() {
    // Only inject on top window, not inside iframes
    if (window.self !== window.top) return;

    // Check if widget already exists
    if (document.getElementById('pastry-scraper-floating-btn')) return;

    const source = detectSource();
    const container = document.createElement('div');
    container.id = 'pastry-scraper-floating-btn';
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 8px;
      background: #1E1B4B;
      color: #FFFFFF;
      padding: 8px 14px;
      border-radius: 9999px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.2);
      transition: all 0.2s ease-in-out;
      user-select: none;
    `;

    const iconSpan = document.createElement('span');
    iconSpan.innerHTML = '🥐';
    iconSpan.style.fontSize = '15px';

    const textSpan = document.createElement('span');
    textSpan.id = 'pastry-floating-label';
    // If currently on an access-restricted Yelp page, flag upfront
    const isYelp = source === 'yelp';
    const initialBlocked = isYelp && typeof detectYelpBlock === 'function' && detectYelpBlock(document).isBlocked;
    if (initialBlocked) {
      textSpan.textContent = '⚠️ Yelp access restricted';
      container.style.background = '#92400E'; // Dark amber
    } else {
      textSpan.textContent = source === 'website' ? 'Extract Website Lead' : `Extract from ${source === 'yelp' ? 'Yelp' : 'Google Maps'}`;
    }

    container.onclick = async () => {
      textSpan.textContent = 'Extracting...';
      const extraction = performExtraction();

      if (extraction.blocked) {
        textSpan.textContent = '⚠️ Yelp access restricted';
        container.style.background = '#92400E'; // Dark amber
        setTimeout(() => {
          textSpan.textContent = '⚠️ Yelp access restricted';
        }, 3000);
        return;
      }

      if (extraction.success && extraction.leads.length > 0) {
        chrome.runtime.sendMessage({
          action: 'SAVE_EXTRACTED_LEADS',
          leads: extraction.leads
        }, (saveRes) => {
          const added = saveRes ? saveRes.added : extraction.leads.length;
          const dups = saveRes ? saveRes.duplicates : 0;
          textSpan.textContent = `✓ ${added} Saved${dups > 0 ? ` (${dups} dup)` : ''}!`;
          container.style.background = '#065F46'; // Forest green
          setTimeout(() => {
            textSpan.textContent = source === 'website' ? 'Extract Website Lead' : `Extract from ${source === 'yelp' ? 'Yelp' : 'Google Maps'}`;
            container.style.background = '#1E1B4B';
          }, 3500);
        });
      } else {
        textSpan.textContent = 'No leads detected';
        container.style.background = '#991B1B'; // Dark red
        setTimeout(() => {
          textSpan.textContent = source === 'website' ? 'Extract Website Lead' : `Extract from ${source === 'yelp' ? 'Yelp' : 'Google Maps'}`;
          container.style.background = '#1E1B4B';
        }, 3000);
      }
    };

    document.body.appendChild(container);
  }

  // Inject floating widget when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(injectFloatingWidget, 1000));
  } else {
    setTimeout(injectFloatingWidget, 1000);
  }
})();

