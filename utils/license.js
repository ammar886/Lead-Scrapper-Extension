/**
 * Pastry Lead Scraper - License Verification System (Demo Prototype)
 *
 * IMPORTANT SECURITY NOTICE:
 * This client-side license validation is designed exclusively as an MVP demo.
 * In production, licenses should be cryptographically validated via a secure backend
 * authentication service (e.g., asymmetric signatures, JWT, or licensing API)
 * with periodic token revocation and hardware-bound telemetry.
 */

let storageModule;
if (typeof module !== 'undefined' && module.exports) {
  storageModule = require('./storage.js');
} else if (typeof window !== 'undefined' && window.PastryStorage) {
  storageModule = window.PastryStorage;
}

const VALID_LICENSES = [
  'PASTRY-DEMO-2026',
  'PASTRY-TEST-001',
  'PASTRY-TEST-002'
];

/**
 * Validates a license key string against valid demonstration keys.
 * Case-insensitive, trims whitespace.
 * @param {string} key
 * @returns {boolean}
 */
function validateLicense(key) {
  if (!key || typeof key !== 'string') return false;
  const cleaned = key.trim().toUpperCase();
  return VALID_LICENSES.includes(cleaned);
}

/**
 * Activates the extension using the provided license key.
 * Stores activation record in persistent local storage.
 * @param {string} key
 * @returns {Promise<{success: boolean, message: string, license?: Object}>}
 */
async function activateLicense(key) {
  if (!key || typeof key !== 'string') {
    return { success: false, message: 'Please enter a valid license key.' };
  }

  const cleaned = key.trim().toUpperCase();
  if (!validateLicense(cleaned)) {
    return {
      success: false,
      message: 'Invalid license key. Please check your key or use a demo key (e.g. PASTRY-DEMO-2026).'
    };
  }

  const licenseData = {
    key: cleaned,
    status: 'active',
    activatedAt: new Date().toISOString(),
    type: 'Demo Evaluation License'
  };

  const storage = storageModule || (typeof window !== 'undefined' ? window.PastryStorage : null);
  if (storage && storage.saveLicense) {
    await storage.saveLicense(licenseData);
  }

  return {
    success: true,
    message: 'License successfully activated!',
    license: licenseData
  };
}

/**
 * Deactivates the current license and resets activation state in storage.
 * Useful for testing activation flow.
 * @returns {Promise<{success: boolean}>}
 */
async function deactivateLicense() {
  const storage = storageModule || (typeof window !== 'undefined' ? window.PastryStorage : null);
  if (storage && storage.clearLicense) {
    await storage.clearLicense();
  }
  return { success: true };
}

/**
 * Retrieves the current license activation status from storage.
 * @returns {Promise<{isActive: boolean, key: string|null, activatedAt: string|null}>}
 */
async function getLicenseStatus() {
  const storage = storageModule || (typeof window !== 'undefined' ? window.PastryStorage : null);
  if (!storage || !storage.getLicense) {
    return { isActive: false, key: null, activatedAt: null };
  }

  const license = await storage.getLicense();
  if (license && license.status === 'active' && validateLicense(license.key)) {
    return {
      isActive: true,
      key: license.key,
      activatedAt: license.activatedAt,
      type: license.type || 'Demo Evaluation License'
    };
  }

  return { isActive: false, key: null, activatedAt: null };
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VALID_LICENSES,
    validateLicense,
    activateLicense,
    deactivateLicense,
    getLicenseStatus
  };
}

if (typeof window !== 'undefined') {
  window.PastryLicense = {
    VALID_LICENSES,
    validateLicense,
    activateLicense,
    deactivateLicense,
    getLicenseStatus
  };
  window.validateLicense = validateLicense;
  window.activateLicense = activateLicense;
  window.deactivateLicense = deactivateLicense;
  window.getLicenseStatus = getLicenseStatus;
}
