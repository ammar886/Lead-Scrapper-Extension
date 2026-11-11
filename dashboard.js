/**
 * LeadHero - Dashboard Application Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements - Header & Theme
  const headerLicensePill = document.getElementById('header-license-pill');
  const licensePillText = document.getElementById('license-pill-text');
  const headerExtractBtn = document.getElementById('header-extract-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const themeButtons = document.querySelectorAll('[data-theme-choice]');

  // DOM Elements - Search Config
  const searchConfigForm = document.getElementById('search-config-form');
  const keywordInput = document.getElementById('keyword-input');
  const locationInput = document.getElementById('location-input');
  const quickChips = document.querySelectorAll('.quick-chip');
  const workflowBanner = document.getElementById('extraction-workflow-banner');
  const closeWorkflowBanner = document.getElementById('close-workflow-banner');
  const sourceStatusBanner = document.getElementById('source-status-banner');
  const sourceStatusTitle = document.getElementById('source-status-title');
  const sourceStatusDesc = document.getElementById('source-status-desc');
  const closeSourceStatusBtn = document.getElementById('close-source-status-btn');
  const yelpStatusPill = document.getElementById('yelp-status-pill');
  const yelpStatFooter = document.getElementById('yelp-stat-footer');

  // DOM Elements - Statistics
  const statTotal = document.getElementById('stat-total');
  const statYelp = document.getElementById('stat-yelp');
  const statGoogle = document.getElementById('stat-google');
  const statWebsite = document.getElementById('stat-website');
  const statDuplicates = document.getElementById('stat-duplicates');

  // DOM Elements - Table & Toolbar
  const tableSearchInput = document.getElementById('table-search-input');
  const sourceFilterSelect = document.getElementById('source-filter-select');
  const selectionCounter = document.getElementById('selection-counter');
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  const leadsTableBody = document.getElementById('leads-table-body');
  const tableEmptyState = document.getElementById('table-empty-state');
  const emptySearchTriggerBtn = document.getElementById('empty-search-trigger-btn');

  // DOM Elements - Exports & Bulk Actions
  const copySelectedBtn = document.getElementById('copy-selected-btn');
  const copyAllBtn = document.getElementById('copy-all-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const exportXlsxBtn = document.getElementById('export-xlsx-btn');
  const deleteSelectedBtn = document.getElementById('delete-selected-btn');
  const clearAllBtn = document.getElementById('clear-all-btn');

  // DOM Elements - Modals
  const licenseModal = document.getElementById('license-modal');
  const licenseForm = document.getElementById('license-form');
  const licenseKeyInput = document.getElementById('license-key-input');
  const licenseErrorMsg = document.getElementById('license-error-msg');
  const demoKeyChips = document.querySelectorAll('.demo-key-chip');

  const settingsModal = document.getElementById('settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const settingsKeyDisplay = document.getElementById('settings-key-display');
  const settingsDateDisplay = document.getElementById('settings-date-display');
  const deactivateLicenseBtn = document.getElementById('deactivate-license-btn');
  const settingsResetAllBtn = document.getElementById('settings-reset-all-btn');

  const confirmModal = document.getElementById('confirm-modal');
  const confirmModalTitle = document.getElementById('confirm-modal-title');
  const confirmModalMessage = document.getElementById('confirm-modal-message');
  const confirmModalCancel = document.getElementById('confirm-modal-cancel');
  const confirmModalConfirm = document.getElementById('confirm-modal-confirm');

  // State
  let allBusinesses = [];
  let filteredBusinesses = [];
  const selectedIds = new Set();
  let currentSort = { column: 'collectedAt', asc: false };
  let pendingConfirmAction = null;

  /* ================= 0. THEME MANAGEMENT (LIGHT / DARK) ================= */
  function applyTheme(theme) {
    const normalized = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', normalized);
    themeButtons.forEach((btn) => {
      const choice = btn.getAttribute('data-theme-choice');
      if (choice === normalized) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  }

  async function initTheme() {
    try {
      const cached = localStorage.getItem('leadhero_theme');
      if (cached === 'dark' || cached === 'light') {
        applyTheme(cached);
      }
    } catch (e) {}

    if (typeof getTheme === 'function') {
      const saved = await getTheme();
      applyTheme(saved);
    }
  }

  themeButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const choice = btn.getAttribute('data-theme-choice');
      applyTheme(choice);
      if (typeof saveTheme === 'function') {
        await saveTheme(choice);
      }
    });
  });

  /* ================= 1. TOAST NOTIFICATIONS ================= */
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = type === 'success' ? '✓' : type === 'error' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* ================= 2. LICENSE SYSTEM ================= */
  async function checkLicenseStatus() {
    const license = await getLicenseStatus();
    if (license.isActive) {
      licenseModal.classList.add('hidden');
      headerLicensePill.className = 'license-status-pill pill-active';
      licensePillText.textContent = `Active: ${license.key}`;
      settingsKeyDisplay.textContent = license.key;
      settingsDateDisplay.textContent = license.activatedAt ? new Date(license.activatedAt).toLocaleString() : 'Active';
      return true;
    } else {
      licenseModal.classList.remove('hidden');
      headerLicensePill.className = 'license-status-pill pill-inactive';
      licensePillText.textContent = 'Activation Required';
      return false;
    }
  }

  // Demo key chips quick-fill
  demoKeyChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const key = chip.getAttribute('data-key');
      licenseKeyInput.value = key;
      licenseErrorMsg.classList.add('hidden');
    });
  });

  // License form submission
  licenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = licenseKeyInput.value.trim();
    licenseErrorMsg.classList.add('hidden');

    const res = await activateLicense(key);
    if (res.success) {
      showToast('License successfully activated! Welcome to LeadHero.', 'success');
      await checkLicenseStatus();
      await refreshAllData();
    } else {
      licenseErrorMsg.textContent = res.message;
      licenseErrorMsg.classList.remove('hidden');
    }
  });

  // Settings Modal Open/Close
  settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  // Deactivate license
  deactivateLicenseBtn.addEventListener('click', async () => {
    settingsModal.classList.add('hidden');
    await deactivateLicense();
    showToast('License deactivated. Activation screen restored.', 'info');
    await checkLicenseStatus();
  });

  // Reset all data & deduplication stats
  settingsResetAllBtn.addEventListener('click', () => {
    askConfirmation(
      'Reset All Data',
      'This will permanently delete all collected business leads and reset the deduplication prevention counter. Are you sure?',
      async () => {
        await clearBusinesses(true);
        settingsModal.classList.add('hidden');
        showToast('All leads and stats have been cleared.', 'info');
        await refreshAllData();
      }
    );
  });

  /* ================= 3. DATA REFRESH & STATS ================= */
  async function refreshAllData() {
    allBusinesses = await getBusinesses();
    const stats = await getStats();

    // Update stats counters
    statTotal.textContent = stats.total;
    statYelp.textContent = stats.yelp;
    statGoogle.textContent = stats.google_maps;
    statWebsite.textContent = stats.website;
    statDuplicates.textContent = stats.duplicatesPrevented;

    applyFilters();
  }

  /* ================= 4. FILTERING & SORTING ================= */
  function applyFilters() {
    const query = tableSearchInput.value.trim().toLowerCase();
    const sourceFilter = sourceFilterSelect.value;

    filteredBusinesses = allBusinesses.filter((b) => {
      // Source match
      if (sourceFilter !== 'all' && b.source !== sourceFilter) {
        return false;
      }
      // Text match
      if (query) {
        const nameMatch = (b.name || '').toLowerCase().includes(query);
        const phoneMatch = (b.phone || '').toLowerCase().includes(query);
        const catMatch = (b.category || '').toLowerCase().includes(query);
        const addrMatch = (b.address || '').toLowerCase().includes(query);
        return nameMatch || phoneMatch || catMatch || addrMatch;
      }
      return true;
    });

    // Apply sorting
    filteredBusinesses.sort((a, b) => {
      let valA = a[currentSort.column] || '';
      let valB = b[currentSort.column] || '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return currentSort.asc ? -1 : 1;
      if (valA > valB) return currentSort.asc ? 1 : -1;
      return 0;
    });

    renderTable();
  }

  tableSearchInput.addEventListener('input', applyFilters);
  sourceFilterSelect.addEventListener('change', applyFilters);

  // Column header sorting
  document.querySelectorAll('.th-sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-col');
      if (currentSort.column === col) {
        currentSort.asc = !currentSort.asc;
      } else {
        currentSort.column = col;
        currentSort.asc = true;
      }
      applyFilters();
    });
  });

  /* ================= 5. TABLE RENDERING ================= */
  function renderTable() {
    leadsTableBody.innerHTML = '';

    if (filteredBusinesses.length === 0) {
      tableEmptyState.classList.remove('hidden');
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
      updateSelectionUI();
      return;
    }

    tableEmptyState.classList.add('hidden');

    const fragment = document.createDocumentFragment();

    filteredBusinesses.forEach((lead) => {
      const tr = document.createElement('tr');
      const isSelected = selectedIds.has(lead.id);
      if (isSelected) tr.classList.add('row-selected');

      // 1. Checkbox
      const tdCheck = document.createElement('td');
      tdCheck.className = 'td-checkbox';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isSelected;
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedIds.add(lead.id);
          tr.classList.add('row-selected');
        } else {
          selectedIds.delete(lead.id);
          tr.classList.remove('row-selected');
        }
        updateSelectionUI();
      });
      tdCheck.appendChild(checkbox);
      tr.appendChild(tdCheck);

      // 2. Business Name
      const tdName = document.createElement('td');
      tdName.innerHTML = `<span class="lead-name">${escapeHtml(lead.name || 'Unnamed')}</span>`;
      tr.appendChild(tdName);

      // 3. Phone Number
      const tdPhone = document.createElement('td');
      const displayPhone = lead.phone ? formatPhoneDisplay(lead.phone) : '—';
      tdPhone.innerHTML = `<span class="lead-phone">${escapeHtml(displayPhone)}</span>`;
      tr.appendChild(tdPhone);

      // 4. Category
      const tdCat = document.createElement('td');
      tdCat.innerHTML = `<span class="lead-category" title="${escapeHtml(lead.category)}">${escapeHtml(lead.category || 'Local Business')}</span>`;
      tr.appendChild(tdCat);

      // 5. Business Link
      const tdBizLink = document.createElement('td');
      if (lead.businessLink) {
        tdBizLink.innerHTML = `<a href="${escapeHtml(lead.businessLink)}" target="_blank" rel="noopener noreferrer" class="external-link">View Profile ↗</a>`;
      } else {
        tdBizLink.innerHTML = `<span class="lead-date">—</span>`;
      }
      tr.appendChild(tdBizLink);

      // 6. Address / Area
      const tdAddr = document.createElement('td');
      tdAddr.innerHTML = `<span class="lead-address" title="${escapeHtml(lead.address)}">${escapeHtml(lead.address || '—')}</span>`;
      tr.appendChild(tdAddr);

      // 7. Website
      const tdWeb = document.createElement('td');
      if (lead.website) {
        let cleanHost = lead.website;
        try {
          cleanHost = new URL(lead.website).hostname.replace(/^www\./, '');
        } catch (e) {}
        tdWeb.innerHTML = `<a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener noreferrer" class="external-link">${escapeHtml(cleanHost)} ↗</a>`;
      } else {
        tdWeb.innerHTML = `<span class="lead-date">—</span>`;
      }
      tr.appendChild(tdWeb);

      // 8. Source Badge
      const tdSource = document.createElement('td');
      const sourceClass = lead.source === 'google_maps' ? 'source-badge-google'
        : lead.source === 'yelp' ? 'source-badge-yelp'
        : 'source-badge-website';
      const sourceLabel = lead.source === 'google_maps' ? 'Google Maps'
        : lead.source === 'yelp' ? 'Yelp'
        : 'Website';
      tdSource.innerHTML = `<span class="source-badge ${sourceClass}">${sourceLabel}</span>`;
      tr.appendChild(tdSource);

      // 9. Date Collected
      const tdDate = document.createElement('td');
      let dateStr = '—';
      if (lead.collectedAt) {
        try {
          dateStr = new Date(lead.collectedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) {}
      }
      tdDate.innerHTML = `<span class="lead-date">${dateStr}</span>`;
      tr.appendChild(tdDate);

      // 10. Actions
      const tdActions = document.createElement('td');
      tdActions.className = 'td-actions';
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon-delete';
      delBtn.title = 'Delete record';
      delBtn.innerHTML = `
        <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      delBtn.addEventListener('click', async () => {
        await deleteBusiness(lead.id);
        selectedIds.delete(lead.id);
        showToast(`Deleted ${lead.name}`, 'info');
        await refreshAllData();
      });
      tdActions.appendChild(delBtn);
      tr.appendChild(tdActions);

      fragment.appendChild(tr);
    });

    leadsTableBody.appendChild(fragment);
    updateSelectionUI();
  }

  function updateSelectionUI() {
    const totalVisible = filteredBusinesses.length;
    const selectedVisible = filteredBusinesses.filter((b) => selectedIds.has(b.id)).length;

    selectionCounter.textContent = `${selectedVisible} of ${totalVisible} selected`;

    if (totalVisible === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
      copySelectedBtn.disabled = true;
      deleteSelectedBtn.disabled = true;
      return;
    }

    if (selectedVisible === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
      copySelectedBtn.disabled = true;
      deleteSelectedBtn.disabled = true;
    } else if (selectedVisible === totalVisible) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
      copySelectedBtn.disabled = false;
      deleteSelectedBtn.disabled = false;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
      copySelectedBtn.disabled = false;
      deleteSelectedBtn.disabled = false;
    }
  }

  // Select all checkbox handler
  selectAllCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    filteredBusinesses.forEach((lead) => {
      if (isChecked) selectedIds.add(lead.id);
      else selectedIds.delete(lead.id);
    });
    renderTable();
  });

  /* ================= 6. SEARCH WORKFLOW ================= */
  // Quick keyword and location chip clicks
  quickChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      if (chip.hasAttribute('data-keyword')) {
        keywordInput.value = chip.getAttribute('data-keyword');
      }
      if (chip.hasAttribute('data-location')) {
        locationInput.value = chip.getAttribute('data-location');
      }
    });
  });

  searchConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const keyword = keywordInput.value.trim();
    const location = locationInput.value.trim();

    if (!keyword) {
      showToast('Please enter a keyword or trade (e.g. Plumber)', 'error');
      keywordInput.focus();
      return;
    }
    if (!location) {
      showToast('Please enter a location (e.g. Houston, Texas)', 'error');
      locationInput.focus();
      return;
    }

    // Checked sources
    const selectedSourceEls = document.querySelectorAll('input[name="source"]:checked');
    const sources = Array.from(selectedSourceEls).map((el) => el.value);

    if (sources.length === 0) {
      showToast('Please select at least one source (Google Maps, Yelp, or Website)', 'error');
      return;
    }

    let openedCount = 0;

    // 1. Google Maps URL
    if (sources.includes('google_maps')) {
      const mapsQuery = `${keyword} in ${location}`;
      const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(mapsQuery)}`;
      openUrlInNewTab(mapsUrl);
      openedCount++;
    }

    // 2. Yelp URL
    if (sources.includes('yelp')) {
      const yelpUrl = `https://www.yelp.com/search?find_desc=${encodeURIComponent(keyword)}&find_loc=${encodeURIComponent(location)}`;
      openUrlInNewTab(yelpUrl);
      openedCount++;
    }

    // 3. Business Websites (informational)
    if (sources.includes('website')) {
      showToast('Business Websites source selected: navigate to any target business website in your browser and click "Extract Leads".', 'info', 5000);
    }

    if (openedCount > 0) {
      workflowBanner.classList.remove('hidden');
      showToast(`Opened ${openedCount} source search tab${openedCount === 1 ? '' : 's'}. Click "Extract" on those pages!`, 'success');
    }
  });

  closeWorkflowBanner.addEventListener('click', () => {
    workflowBanner.classList.add('hidden');
  });

  if (closeSourceStatusBtn) {
    closeSourceStatusBtn.addEventListener('click', () => {
      if (sourceStatusBanner) sourceStatusBanner.classList.add('hidden');
    });
  }

  function displaySourceStatus(title, desc) {
    if (sourceStatusTitle) sourceStatusTitle.textContent = title;
    if (sourceStatusDesc) sourceStatusDesc.textContent = desc;
    if (sourceStatusBanner) sourceStatusBanner.classList.remove('hidden');
  }

  function hideSourceStatusBanner() {
    if (sourceStatusBanner) sourceStatusBanner.classList.add('hidden');
  }

  function updateYelpRestrictedCard() {
    if (yelpStatusPill) {
      yelpStatusPill.textContent = 'Yelp access restricted';
      yelpStatusPill.className = 'stat-trend badge-stat-amber';
    }
    if (yelpStatFooter) {
      yelpStatFooter.textContent = 'Active page restricted by anti-bot';
    }
  }

  emptySearchTriggerBtn.addEventListener('click', () => {
    keywordInput.value = 'Plumber';
    locationInput.value = 'Houston, Texas';
    searchConfigForm.dispatchEvent(new Event('submit'));
  });

  function openUrlInNewTab(url) {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url, active: true });
    } else {
      window.open(url, '_blank');
    }
  }

  /* ================= 7. DIRECT ACTIVE TAB EXTRACTION ================= */
  headerExtractBtn.addEventListener('click', async () => {
    headerExtractBtn.disabled = true;
    const originalText = headerExtractBtn.innerHTML;
    headerExtractBtn.innerHTML = `<span>⏳ Extracting...</span>`;

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'TRIGGER_EXTRACTION' }, async (response) => {
        headerExtractBtn.disabled = false;
        headerExtractBtn.innerHTML = originalText;

        if (chrome.runtime.lastError) {
          showToast(chrome.runtime.lastError.message, 'error');
          return;
        }

        if (response && response.success) {
          const added = response.saveResult ? response.saveResult.added : response.count;
          const dups = response.saveResult ? response.saveResult.duplicates : 0;
          let msg = `Extracted and saved ${added} lead${added === 1 ? '' : 's'}!`;
          if (dups > 0) msg += ` (${dups} duplicate${dups === 1 ? '' : 's'} prevented)`;
          showToast(msg, 'success');
          hideSourceStatusBanner();
          await refreshAllData();
        } else if (response && (response.blocked || response.status === 'Yelp access restricted')) {
          displaySourceStatus(
            'Yelp access restricted',
            'Yelp is currently presenting an access-denied or CAPTCHA challenge on the active tab. Extraction was halted immediately to prevent saving empty or fabricated records. Please complete the verification in your Yelp tab or use an authorized Yelp Fusion API.'
          );
          updateYelpRestrictedCard();
          showToast('Yelp access restricted. Extraction stopped.', 'error', 5000);
        } else {
          showToast((response && response.error) || 'No leads could be extracted from the active tab.', 'error');
        }
      });
    } else {
      headerExtractBtn.disabled = false;
      headerExtractBtn.innerHTML = originalText;
      showToast('Chrome runtime messaging unavailable in standalone preview.', 'error');
    }
  });

  /* ================= 8. EXPORT CONTROLS ================= */
  const exportHelper = window.LeadHeroExport || window.PastryExport;

  // Export CSV
  exportCsvBtn.addEventListener('click', () => {
    const recordsToExport = selectedIds.size > 0
      ? filteredBusinesses.filter((b) => selectedIds.has(b.id))
      : filteredBusinesses;

    if (recordsToExport.length === 0) {
      showToast('No records available to export.', 'error');
      return;
    }

    try {
      exportHelper.exportToCSV(recordsToExport, 'leadhero-business-leads.csv');
      showToast(`Exported ${recordsToExport.length} leads to leadhero-business-leads.csv`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Export XLSX
  exportXlsxBtn.addEventListener('click', () => {
    const recordsToExport = selectedIds.size > 0
      ? filteredBusinesses.filter((b) => selectedIds.has(b.id))
      : filteredBusinesses;

    if (recordsToExport.length === 0) {
      showToast('No records available to export.', 'error');
      return;
    }

    try {
      exportHelper.exportToXLSX(recordsToExport, 'leadhero-business-leads.xlsx');
      showToast(`Exported ${recordsToExport.length} leads to leadhero-business-leads.xlsx`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Copy All (TSV)
  copyAllBtn.addEventListener('click', async () => {
    if (filteredBusinesses.length === 0) {
      showToast('No records available to copy.', 'error');
      return;
    }
    try {
      const res = await exportHelper.copyToClipboard(filteredBusinesses);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Copy Selected (TSV)
  copySelectedBtn.addEventListener('click', async () => {
    const selectedRecords = filteredBusinesses.filter((b) => selectedIds.has(b.id));
    if (selectedRecords.length === 0) {
      showToast('Please select at least one record to copy.', 'error');
      return;
    }
    try {
      const res = await exportHelper.copyToClipboard(selectedRecords);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Delete Selected
  deleteSelectedBtn.addEventListener('click', () => {
    const count = selectedIds.size;
    if (count === 0) return;

    askConfirmation(
      'Delete Selected Records',
      `Are you sure you want to delete ${count} selected lead record${count === 1 ? '' : 's'}?`,
      async () => {
        const deleted = await deleteSelectedBusinesses(Array.from(selectedIds));
        selectedIds.clear();
        showToast(`Deleted ${deleted} record${deleted === 1 ? '' : 's'}.`, 'info');
        await refreshAllData();
      }
    );
  });

  // Clear All
  clearAllBtn.addEventListener('click', () => {
    if (allBusinesses.length === 0) {
      showToast('No records to clear.', 'info');
      return;
    }

    askConfirmation(
      'Clear All Records',
      `Are you sure you want to delete all ${allBusinesses.length} business lead records? This cannot be undone.`,
      async () => {
        await clearBusinesses(false);
        selectedIds.clear();
        showToast('All business leads have been cleared.', 'info');
        await refreshAllData();
      }
    );
  });

  /* ================= 9. CONFIRMATION MODAL HELPER ================= */
  function askConfirmation(title, message, onConfirm) {
    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    pendingConfirmAction = onConfirm;
    confirmModal.classList.remove('hidden');
  }

  confirmModalCancel.addEventListener('click', () => {
    confirmModal.classList.add('hidden');
    pendingConfirmAction = null;
  });

  confirmModalConfirm.addEventListener('click', async () => {
    confirmModal.classList.add('hidden');
    if (typeof pendingConfirmAction === 'function') {
      await pendingConfirmAction();
      pendingConfirmAction = null;
    }
  });

  /* ================= 10. ESCAPE HTML HELPER ================= */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Listen for storage changes from background or popup to update stats and theme in real time
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes.leadhero_businesses || changes.leadhero_stats) {
          refreshAllData();
        }
        if (changes.leadhero_theme && changes.leadhero_theme.newValue) {
          applyTheme(changes.leadhero_theme.newValue);
        }
      }
    });
  }

  /* ================= INITIALIZATION ================= */
  await initTheme();
  await checkLicenseStatus();
  await refreshAllData();
});
