/**
 * LeadHero - Normalization & Deduplication Utilities
 * Ensures standard record structures across Google Maps, Yelp, and Websites.
 */

/**
 * Generates a unique record ID.
 * @returns {string} Unique identifier
 */
function generateId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `leadhero_${timestamp}_${randomPart}`;
}

/**
 * Normalizes phone numbers by removing formatting (spaces, hyphens, parentheses, periods, etc.)
 * Handles standard US numbers and international formats.
 * @param {string} phone
 * @returns {string} Normalized digits or empty string
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  
  // Extract text and trim
  let cleaned = phone.trim();

  // If starts with tel: prefix, remove it
  if (cleaned.toLowerCase().startsWith('tel:')) {
    cleaned = cleaned.substring(4);
  }

  // Remove common extension patterns (e.g., ext 123, x123)
  cleaned = cleaned.split(/(?:ext|x|#)\s*\d+/i)[0];

  const hasLeadingPlus = cleaned.startsWith('+');
  // Strip all non-digits
  const digits = cleaned.replace(/\D/g, '');

  if (!digits) return '';

  // Standardize 10-digit North American numbers to +1XXXXXXXXXX
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  // Standardize 11-digit starting with 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return hasLeadingPlus ? `+${digits}` : digits;
}

/**
 * Formats a normalized phone number for display (e.g., +1 (713) 555-1234)
 * @param {string} phone
 * @returns {string} Formatted phone string
 */
function formatPhoneDisplay(phone) {
  if (!phone) return '—';
  const norm = normalizePhone(phone);
  if (norm.startsWith('+1') && norm.length === 12) {
    const d = norm.substring(2);
    return `+1 (${d.substring(0, 3)}) ${d.substring(3, 6)}-${d.substring(6)}`;
  }
  return phone;
}

/**
 * Normalizes text strings (lowercase, collapse whitespace, strip punctuation)
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes business name for deduplication (removes common business suffixes)
 * @param {string} name
 * @returns {string}
 */
function normalizeBusinessName(name) {
  if (!name) return '';
  let norm = normalizeText(name);
  // Remove common corporate suffixes
  norm = norm.replace(/\b(llc|inc|corp|corporation|co|ltd|limited|services|company)\b/gi, '').trim();
  return norm.replace(/\s+/g, ' ');
}

/**
 * Normalizes address for deduplication
 * @param {string} address
 * @returns {string}
 */
function normalizeAddress(address) {
  if (!address) return '';
  let norm = normalizeText(address);
  // Standard street abbreviations
  norm = norm
    .replace(/\bstreet\b/g, 'st')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\blane\b/g, 'ln')
    .replace(/\bsuite\b/g, 'ste')
    .replace(/\bhighway\b/g, 'hwy')
    .replace(/\bparkway\b/g, 'pkwy')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\bcircle\b/g, 'cir');

  // Common US state names to 2-letter codes
  norm = norm
    .replace(/\btexas\b/g, 'tx')
    .replace(/\bcalifornia\b/g, 'ca')
    .replace(/\bflorida\b/g, 'fl')
    .replace(/\bnew york\b/g, 'ny')
    .replace(/\billinois\b/g, 'il')
    .replace(/\barizona\b/g, 'az')
    .replace(/\bgeorgia\b/g, 'ga')
    .replace(/\bcolorado\b/g, 'co')
    .replace(/\bwashington\b/g, 'wa')
    .replace(/\bohio\b/g, 'oh');

  return norm.replace(/\s+/g, ' ').trim();
}

/**
 * Cleans and validates URLs
 * @param {string} url
 * @returns {string} Clean URL or empty string
 */
function cleanUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let cleaned = url.trim();
  
  // Handle Yelp redirection URLs like /biz_redir?url=https%3A%2F%2Fexample.com...
  if (cleaned.includes('/biz_redir?url=') || cleaned.includes('biz_redir?')) {
    try {
      const parsed = new URL(cleaned, 'https://www.yelp.com');
      const target = parsed.searchParams.get('url');
      if (target) cleaned = decodeURIComponent(target);
    } catch (e) {
      // fallback regex
      const match = cleaned.match(/url=([^&]+)/);
      if (match) cleaned = decodeURIComponent(match[1]);
    }
  }

  // Handle Google Maps redirection URLs
  if (cleaned.includes('google.com/url?') || cleaned.includes('google.com/url?q=')) {
    try {
      const parsed = new URL(cleaned);
      const target = parsed.searchParams.get('q') || parsed.searchParams.get('url');
      if (target) cleaned = decodeURIComponent(target);
    } catch (e) {
      // fallback
    }
  }

  // Ensure scheme
  if (cleaned && !cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    if (cleaned.startsWith('//')) {
      cleaned = 'https:' + cleaned;
    } else if (cleaned.includes('.') && !cleaned.includes(' ')) {
      cleaned = 'https://' + cleaned;
    }
  }

  // Validate URL format
  try {
    const u = new URL(cleaned);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return u.href;
    }
  } catch (e) {
    // Return empty if invalid
  }

  return '';
}

const INVALID_BUSINESS_SIGNATURES = [
  'access to this page has been denied',
  'access denied',
  'attention required',
  'just a moment',
  'security check',
  'verify you are human',
  'are you human',
  'human verification',
  'bot detection',
  'pardon our interruption',
  'robot or human',
  'cloudflare',
  '403 forbidden',
  '404 not found',
  'page not found'
];

/**
 * Validates whether a business record has genuine business data
 * and is not an error page or CAPTCHA artifact.
 * @param {Object} record
 * @returns {boolean}
 */
function isValidRecord(record) {
  if (!record || typeof record !== 'object') return false;
  const name = (record.name || '').toLowerCase().trim();
  if (!name || name === 'unnamed business') {
    return Boolean(record.phone && record.website);
  }
  for (const sig of INVALID_BUSINESS_SIGNATURES) {
    if (name.includes(sig)) return false;
  }
  return true;
}

/**
 * Normalizes a raw business record into the standard Pastry schema.
 * All missing fields are handled gracefully without fabricating data.
 * @param {Object} raw
 * @returns {Object} Standard business record
 */
function createBusinessRecord(raw = {}) {
  let name = typeof raw.name === 'string' ? raw.name.trim() : '';

  // Reject blocked / error signatures as business names
  if (name) {
    const lower = name.toLowerCase();
    for (const sig of INVALID_BUSINESS_SIGNATURES) {
      if (lower.includes(sig)) {
        name = '';
        break;
      }
    }
  }

  const phone = typeof raw.phone === 'string' ? raw.phone.trim() : '';
  const category = typeof raw.category === 'string' ? raw.category.trim() : '';
  const address = typeof raw.address === 'string' ? raw.address.trim() : '';
  const website = cleanUrl(raw.website || '');
  const businessLink = cleanUrl(raw.businessLink || '');
  
  // Valid sources: "google_maps" | "yelp" | "website"
  let source = 'website';
  if (raw.source === 'google_maps' || raw.source === 'yelp' || raw.source === 'website') {
    source = raw.source;
  } else if (typeof raw.source === 'string') {
    source = raw.source.toLowerCase().includes('yelp') ? 'yelp'
      : raw.source.toLowerCase().includes('maps') ? 'google_maps'
      : 'website';
  }

  const collectedAt = raw.collectedAt && !isNaN(Date.parse(raw.collectedAt))
    ? new Date(raw.collectedAt).toISOString()
    : new Date().toISOString();

  return {
    id: raw.id || generateId(),
    name: name || 'Unnamed Business',
    phone: phone,
    category: category || 'Uncategorized',
    businessLink: businessLink,
    address: address || '',
    website: website,
    source: source,
    collectedAt: collectedAt,
    // Provenance metadata (sources where this business was seen)
    sources: raw.sources && Array.isArray(raw.sources) ? Array.from(new Set(raw.sources)) : [source]
  };
}

/**
 * Determines whether two business records represent the same entity according to requirements:
 * 1. Normalize phone numbers by removing spaces, parentheses, hyphens and other formatting.
 * 2. If both records have phone numbers, compare normalized phone numbers.
 * 3. If phone numbers are missing, compare normalized business name and address.
 * @param {Object} a
 * @param {Object} b
 * @returns {boolean} True if duplicate
 */
function areDuplicates(a, b) {
  if (!a || !b) return false;

  const phoneA = normalizePhone(a.phone);
  const phoneB = normalizePhone(b.phone);

  // 2. If both records have phone numbers, compare normalized phone numbers
  if (phoneA && phoneB) {
    return phoneA === phoneB;
  }

  // 3. If phone numbers are missing, compare normalized business name and address
  const nameA = normalizeBusinessName(a.name);
  const nameB = normalizeBusinessName(b.name);
  const addrA = normalizeAddress(a.address);
  const addrB = normalizeAddress(b.address);

  // Both must have a non-empty name
  if (nameA && nameB && nameA === nameB) {
    // If both have address, compare address
    if (addrA && addrB) {
      if (addrA === addrB || addrA.includes(addrB) || addrB.includes(addrA)) {
        return true;
      }
      // Token overlap check for resilient address comparison
      const tokensA = new Set(addrA.split(' ').filter(Boolean));
      const tokensB = new Set(addrB.split(' ').filter(Boolean));
      let intersection = 0;
      tokensA.forEach((t) => { if (tokensB.has(t)) intersection++; });
      const minTokens = Math.min(tokensA.size, tokensB.size);
      if (minTokens > 0 && (intersection / minTokens) >= 0.6) {
        return true;
      }
    }
    // If neither has an address, but both share identical website or businessLink domain
    if (a.website && b.website) {
      try {
        const hostA = new URL(a.website).hostname.replace(/^www\./, '');
        const hostB = new URL(b.website).hostname.replace(/^www\./, '');
        if (hostA && hostA === hostB) return true;
      } catch (e) {}
    }
  }

  return false;
}

// Export for ES modules and Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateId,
    normalizePhone,
    formatPhoneDisplay,
    normalizeText,
    normalizeBusinessName,
    normalizeAddress,
    cleanUrl,
    createBusinessRecord,
    areDuplicates,
    isValidRecord,
    INVALID_BUSINESS_SIGNATURES
  };
}

if (typeof window !== 'undefined') {
  const api = {
    generateId,
    normalizePhone,
    formatPhoneDisplay,
    normalizeText,
    normalizeBusinessName,
    normalizeAddress,
    cleanUrl,
    createBusinessRecord,
    areDuplicates,
    isValidRecord,
    INVALID_BUSINESS_SIGNATURES
  };
  window.LeadHeroNormalize = api;
  window.PastryNormalize = api;
  window.normalizePhone = normalizePhone;
  window.formatPhoneDisplay = formatPhoneDisplay;
  window.createBusinessRecord = createBusinessRecord;
  window.areDuplicates = areDuplicates;
  window.isValidRecord = isValidRecord;
}

