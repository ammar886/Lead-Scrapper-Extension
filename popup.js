/**
 * Pastry Lead Scraper - Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const licenseBadge = document.getElementById('license-badge');
  const sourceBadge = document.getElementById('detected-source-badge');
  const pageTitlePreview = document.getElementById('page-title-preview');
  const extractBtn = document.getElementById('quick-extract-btn');
  const extractLabel = document.getElementById('quick-extract-label');
  const statusEl = document.getElementById('quick-extract-status');
  const totalLeadsEl = document.getElementById('popup-total-leads');
  const dupLeadsEl = document.getElementById('popup-dup-leads');
  const openDashboardBtn = document.getElementById('open-dashboard-btn');

  let currentTab = null;
  let detectedSource = 'website';

  // 1. Check license status
  const license = await getLicenseStatus();
  if (license.isActive) {
    licenseBadge.textContent = 'Active';
    licenseBadge.className = 'badge badge-active';
    licenseBadge.title = `Licensed: ${license.key}`;
  } else {
    licenseBadge.textContent = 'Activation Required';
    licenseBadge.className = 'badge badge-inactive';
    licenseBadge.title = 'Please activate your license in the dashboard.';
  }

  // 2. Load stats
  async function refreshStats() {
    try {
      const stats = await getStats();
      totalLeadsEl.textContent = stats.total;
      dupLeadsEl.textContent = stats.duplicatesPrevented;
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  }
  await refreshStats();

  // 3. Inspect active tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      currentTab = tabs[0];
      const url = currentTab.url || '';
      pageTitlePreview.textContent = currentTab.title || url;

      if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) {
        sourceBadge.textContent = 'Browser Page';
        sourceBadge.className = 'badge badge-inactive';
        extractBtn.disabled = true;
        extractLabel.textContent = 'Unsupported Page';
      } else {
        if (url.includes('google.') && (url.includes('/maps') || url.includes('maps.'))) {
          detectedSource = 'google_maps';
          sourceBadge.textContent = 'Google Maps';
        } else if (url.includes('yelp.')) {
          detectedSource = 'yelp';
          sourceBadge.textContent = 'Yelp';
          // Query tab for access-restricted state
          chrome.tabs.sendMessage(currentTab.id, { action: 'PING' }, (pingRes) => {
            if (!chrome.runtime.lastError && pingRes && (pingRes.blocked || pingRes.status === 'Yelp access restricted')) {
              sourceBadge.textContent = 'Yelp access restricted';
              sourceBadge.className = 'badge badge-warning';
              extractLabel.textContent = 'Yelp access restricted';
              showStatus('Yelp access restricted. Complete verification in the tab.', 'warning');
            }
          });
        } else {
          detectedSource = 'website';
          sourceBadge.textContent = 'Website';
        }

        extractBtn.disabled = false;
        extractLabel.textContent = `Extract Leads (${sourceBadge.textContent})`;
      }
    }
  } catch (err) {
    console.error('Error querying active tab:', err);
    pageTitlePreview.textContent = 'Unable to inspect active tab';
  }

  // 4. Quick Extract action
  extractBtn.addEventListener('click', async () => {
    if (!currentTab || !currentTab.id) return;

    extractBtn.disabled = true;
    extractLabel.textContent = 'Extracting leads...';
    statusEl.className = 'status-msg hidden';

    chrome.runtime.sendMessage({
      action: 'TRIGGER_EXTRACTION',
      tabId: currentTab.id
    }, async (response) => {
      extractBtn.disabled = false;
      extractLabel.textContent = `Extract Leads (${sourceBadge.textContent})`;

      if (chrome.runtime.lastError) {
        showStatus(chrome.runtime.lastError.message, 'error');
        return;
      }

      if (response && response.success) {
        const added = response.saveResult ? response.saveResult.added : response.count;
        const dups = response.saveResult ? response.saveResult.duplicates : 0;
        let msg = `Extracted and saved ${added} new lead${added === 1 ? '' : 's'}!`;
        if (dups > 0) {
          msg += ` (${dups} duplicate${dups === 1 ? '' : 's'} prevented)`;
        }
        showStatus(msg, 'success');
        await refreshStats();
      } else if (response && (response.blocked || response.status === 'Yelp access restricted')) {
        showStatus('Yelp access restricted. Anti-bot or CAPTCHA challenge detected on Yelp.', 'warning');
      } else {
        const errorMsg = (response && response.error) || 'No business records could be extracted from this page.';
        showStatus(errorMsg, 'error');
      }
    });
  });

  function showStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = `status-msg ${type === 'success' ? 'status-success' : 'status-error'}`;
  }

  // 5. Open full dashboard
  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
});

