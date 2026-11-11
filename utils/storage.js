/**
 * LeadHero - Storage Module
 * Uses chrome.storage.local for persistent data management with duplicate prevention and theme preferences.
 * Compatible with Node.js and standalone environments for automated testing.
 */

// Handle node/browser environment for require/import of normalize helpers
let normalizeUtils;
if (typeof module !== 'undefined' && module.exports) {
  normalizeUtils = require('./normalize.js');
} else if (typeof window !== 'undefined' && (window.LeadHeroNormalize || window.PastryNormalize)) {
  normalizeUtils = window.LeadHeroNormalize || window.PastryNormalize;
} else if (typeof areDuplicates === 'function') {
  normalizeUtils = { areDuplicates, createBusinessRecord };
}

const STORAGE_KEYS = {
  BUSINESSES: 'leadhero_businesses',
  LICENSE: 'leadhero_license',
  STATS: 'leadhero_stats',
  THEME: 'leadhero_theme'
};

/**
 * Low-level storage adapter that abstracts chrome.storage.local,
 * localStorage, or in-memory fallback.
 */
const StorageAdapter = {
  isChromeStorageAvailable() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  },

  async get(keys) {
    if (this.isChromeStorageAvailable()) {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            console.error('Storage get error:', chrome.runtime.lastError);
            resolve({});
          } else {
            resolve(result || {});
          }
        });
      });
    }

    // Fallback: localStorage
    if (typeof localStorage !== 'undefined') {
      const result = {};
      const keyList = Array.isArray(keys) ? keys : [keys];
      keyList.forEach((k) => {
        try {
          const val = localStorage.getItem(k);
          if (val !== null) result[k] = JSON.parse(val);
        } catch (e) {
          console.error('localStorage parse error:', e);
        }
      });
      return result;
    }

    // Fallback: Memory
    if (!this._memoryStore) this._memoryStore = {};
    const result = {};
    const keyList = Array.isArray(keys) ? keys : [keys];
    keyList.forEach((k) => {
      if (this._memoryStore[k] !== undefined) {
        result[k] = this._memoryStore[k];
      }
    });
    return result;
  },

  async set(items) {
    if (this.isChromeStorageAvailable()) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set(items, () => {
          if (chrome.runtime.lastError) {
            console.error('Storage set error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }

    // Fallback: localStorage
    if (typeof localStorage !== 'undefined') {
      Object.entries(items).forEach(([k, v]) => {
        try {
          localStorage.setItem(k, JSON.stringify(v));
        } catch (e) {
          console.error('localStorage set error:', e);
        }
      });
      return;
    }

    // Fallback: Memory
    if (!this._memoryStore) this._memoryStore = {};
    Object.assign(this._memoryStore, items);
  },

  async remove(keys) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    if (this.isChromeStorageAvailable()) {
      return new Promise((resolve) => {
        chrome.storage.local.remove(keyList, () => resolve());
      });
    }
    if (typeof localStorage !== 'undefined') {
      keyList.forEach((k) => localStorage.removeItem(k));
      return;
    }
    if (this._memoryStore) {
      keyList.forEach((k) => delete this._memoryStore[k]);
    }
  }
};

/**
 * Fetches all saved business records.
 * @returns {Promise<Array>}
 */
async function getBusinesses() {
  const data = await StorageAdapter.get([STORAGE_KEYS.BUSINESSES]);
  return Array.isArray(data[STORAGE_KEYS.BUSINESSES]) ? data[STORAGE_KEYS.BUSINESSES] : [];
}

/**
 * Saves a single business record, preventing duplicates and rejecting invalid/blocked records.
 * @param {Object} rawBusiness
 * @returns {Promise<{saved: boolean, duplicate: boolean, invalid?: boolean, record: Object}>}
 */
async function saveBusiness(rawBusiness) {
  const normHelper = normalizeUtils || (typeof window !== 'undefined' ? (window.LeadHeroNormalize || window.PastryNormalize) : null);
  const record = normHelper.createBusinessRecord(rawBusiness);

  // Reject empty, fabricated, or blocked/error records
  if (normHelper.isValidRecord && !normHelper.isValidRecord(record)) {
    return { saved: false, duplicate: false, invalid: true, record: null };
  }

  const [businesses, stats] = await Promise.all([getBusinesses(), getStats()]);

  // Check for duplicate
  const duplicateIndex = businesses.findIndex((existing) => normHelper.areDuplicates(existing, record));

  if (duplicateIndex !== -1) {
    // Retain source provenance if new source
    const existing = businesses[duplicateIndex];
    if (!existing.sources) existing.sources = [existing.source];
    if (!existing.sources.includes(record.source)) {
      existing.sources.push(record.source);
    }
    // Update any previously missing field
    if (!existing.phone && record.phone) existing.phone = record.phone;
    if (!existing.website && record.website) existing.website = record.website;
    if (!existing.address && record.address) existing.address = record.address;

    businesses[duplicateIndex] = existing;
    stats.duplicatesPrevented = (stats.duplicatesPrevented || 0) + 1;

    await StorageAdapter.set({
      [STORAGE_KEYS.BUSINESSES]: businesses,
      [STORAGE_KEYS.STATS]: stats
    });

    return { saved: false, duplicate: true, record: existing };
  }

  // Not a duplicate - prepend to list
  businesses.unshift(record);
  await StorageAdapter.set({
    [STORAGE_KEYS.BUSINESSES]: businesses
  });

  return { saved: true, duplicate: false, record };
}

/**
 * Saves an array of business records, preventing duplicates within the batch and storage.
 * @param {Array<Object>} rawBusinesses
 * @returns {Promise<{added: number, duplicates: number, total: number}>}
 */
async function saveBusinesses(rawBusinesses) {
  if (!Array.isArray(rawBusinesses) || rawBusinesses.length === 0) {
    const list = await getBusinesses();
    return { added: 0, duplicates: 0, total: list.length };
  }

  const normHelper = normalizeUtils || (typeof window !== 'undefined' ? (window.LeadHeroNormalize || window.PastryNormalize) : null);
  const [businesses, stats] = await Promise.all([getBusinesses(), getStats()]);

  let addedCount = 0;
  let duplicatesCount = 0;

  for (const raw of rawBusinesses) {
    if (!raw) continue;
    const record = normHelper.createBusinessRecord(raw);

    // Reject invalid, empty, or blocked/error records
    if (normHelper.isValidRecord && !normHelper.isValidRecord(record)) {
      continue;
    }

    // Skip empty or useless names
    if (!record.name || record.name === 'Unnamed Business') {
      if (!record.phone && !record.website) continue;
    }

    const dupIndex = businesses.findIndex((existing) => normHelper.areDuplicates(existing, record));

    if (dupIndex !== -1) {
      duplicatesCount++;
      const existing = businesses[dupIndex];
      if (!existing.sources) existing.sources = [existing.source];
      if (!existing.sources.includes(record.source)) {
        existing.sources.push(record.source);
      }
      if (!existing.phone && record.phone) existing.phone = record.phone;
      if (!existing.website && record.website) existing.website = record.website;
      if (!existing.address && record.address) existing.address = record.address;
      businesses[dupIndex] = existing;
    } else {
      businesses.unshift(record);
      addedCount++;
    }
  }

  stats.duplicatesPrevented = (stats.duplicatesPrevented || 0) + duplicatesCount;

  await StorageAdapter.set({
    [STORAGE_KEYS.BUSINESSES]: businesses,
    [STORAGE_KEYS.STATS]: stats
  });

  return {
    added: addedCount,
    duplicates: duplicatesCount,
    total: businesses.length
  };
}

/**
 * Deletes a business record by its ID.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function deleteBusiness(id) {
  const businesses = await getBusinesses();
  const initialLen = businesses.length;
  const filtered = businesses.filter((b) => b.id !== id);
  if (filtered.length !== initialLen) {
    await StorageAdapter.set({ [STORAGE_KEYS.BUSINESSES]: filtered });
    return true;
  }
  return false;
}

/**
 * Deletes multiple business records by their IDs.
 * @param {Array<string>} ids
 * @returns {Promise<number>} Number of records deleted
 */
async function deleteSelectedBusinesses(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const idSet = new Set(ids);
  const businesses = await getBusinesses();
  const initialLen = businesses.length;
  const filtered = businesses.filter((b) => !idSet.has(b.id));
  const deletedCount = initialLen - filtered.length;
  if (deletedCount > 0) {
    await StorageAdapter.set({ [STORAGE_KEYS.BUSINESSES]: filtered });
  }
  return deletedCount;
}

/**
 * Clears all business records from storage.
 * @param {boolean} resetDuplicateStats If true, resets duplicates prevented counter
 * @returns {Promise<void>}
 */
async function clearBusinesses(resetDuplicateStats = false) {
  await StorageAdapter.set({ [STORAGE_KEYS.BUSINESSES]: [] });
  if (resetDuplicateStats) {
    await StorageAdapter.set({ [STORAGE_KEYS.STATS]: { duplicatesPrevented: 0 } });
  }
}

/**
 * Computes dashboard statistics from stored businesses and deduplication stats.
 * @returns {Promise<{total: number, yelp: number, google_maps: number, website: number, duplicatesPrevented: number}>}
 */
async function getStats() {
  const [data, statsData] = await Promise.all([
    StorageAdapter.get([STORAGE_KEYS.BUSINESSES]),
    StorageAdapter.get([STORAGE_KEYS.STATS])
  ]);

  const businesses = Array.isArray(data[STORAGE_KEYS.BUSINESSES]) ? data[STORAGE_KEYS.BUSINESSES] : [];
  const stats = statsData[STORAGE_KEYS.STATS] || {};

  let yelp = 0;
  let google_maps = 0;
  let website = 0;

  businesses.forEach((b) => {
    if (b.source === 'yelp') yelp++;
    else if (b.source === 'google_maps') google_maps++;
    else website++;
  });

  return {
    total: businesses.length,
    yelp,
    google_maps,
    website,
    duplicatesPrevented: Number(stats.duplicatesPrevented) || 0
  };
}

/**
 * Retrieves the current license information.
 * @returns {Promise<Object|null>}
 */
async function getLicense() {
  const data = await StorageAdapter.get([STORAGE_KEYS.LICENSE]);
  return data[STORAGE_KEYS.LICENSE] || null;
}

/**
 * Saves license state to storage.
 * @param {Object} license
 * @returns {Promise<void>}
 */
async function saveLicense(license) {
  await StorageAdapter.set({ [STORAGE_KEYS.LICENSE]: license });
}

/**
 * Clears license state from storage (deactivation).
 * @returns {Promise<void>}
 */
async function clearLicense() {
  await StorageAdapter.remove([STORAGE_KEYS.LICENSE]);
}

/**
 * Retrieves the saved UI theme ('light' or 'dark').
 * @returns {Promise<'light'|'dark'>}
 */
async function getTheme() {
  const data = await StorageAdapter.get([STORAGE_KEYS.THEME]);
  const stored = data[STORAGE_KEYS.THEME];
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return 'light';
}

/**
 * Saves the UI theme ('light' or 'dark') persistently.
 * @param {'light'|'dark'} theme
 * @returns {Promise<'light'|'dark'>}
 */
async function saveTheme(theme) {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  await StorageAdapter.set({ [STORAGE_KEYS.THEME]: normalized });
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, normalized);
    } catch (e) {}
  }
  return normalized;
}

// Export for module systems and global browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEYS,
    StorageAdapter,
    getBusinesses,
    saveBusiness,
    saveBusinesses,
    deleteBusiness,
    deleteSelectedBusinesses,
    clearBusinesses,
    getStats,
    getLicense,
    saveLicense,
    clearLicense,
    getTheme,
    saveTheme
  };
}

if (typeof window !== 'undefined') {
  const storageApi = {
    STORAGE_KEYS,
    StorageAdapter,
    getBusinesses,
    saveBusiness,
    saveBusinesses,
    deleteBusiness,
    deleteSelectedBusinesses,
    clearBusinesses,
    getStats,
    getLicense,
    saveLicense,
    clearLicense,
    getTheme,
    saveTheme
  };
  window.LeadHeroStorage = storageApi;
  window.PastryStorage = storageApi;
  window.getBusinesses = getBusinesses;
  window.saveBusiness = saveBusiness;
  window.saveBusinesses = saveBusinesses;
  window.deleteBusiness = deleteBusiness;
  window.deleteSelectedBusinesses = deleteSelectedBusinesses;
  window.clearBusinesses = clearBusinesses;
  window.getStats = getStats;
  window.getLicense = getLicense;
  window.saveLicense = saveLicense;
  window.clearLicense = clearLicense;
  window.getTheme = getTheme;
  window.saveTheme = saveTheme;
}
