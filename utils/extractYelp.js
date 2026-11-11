/**
 * LeadHero - Yelp Extraction & Provider Module
 *
 * Modular architecture supporting:
 * 1. Client-side DOM extraction for user-initiated browser sessions.
 * 2. Automated detection of access-restricted, CAPTCHA, or blocked pages.
 * 3. Provider abstraction for future authorized Yelp Fusion API integration.
 *
 * NOTE: Adheres strictly to ethical scraping standards. Does NOT implement
 * CAPTCHA solving, proxy rotation, fingerprint spoofing, or anti-bot bypasses.
 */

/**
 * List of known page titles and phrases displayed by Yelp or its CDN/WAF
 * when access is restricted or gated behind a verification challenge.
 */
const YELP_BLOCK_SIGNATURES = [
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
  'sorry, you are not allowed to access this page',
  'unusual traffic',
  '403 forbidden'
];

/**
 * Detects whether the current Yelp page is an access-denied, CAPTCHA, or blocked page.
 * @param {Document} doc
 * @returns {{isBlocked: boolean, reason?: string, message?: string}}
 */
function detectYelpBlock(doc = document) {
  if (!doc) return { isBlocked: false };

  // 1. Check document title
  const pageTitle = (doc.title || '').toLowerCase().trim();
  for (const sig of YELP_BLOCK_SIGNATURES) {
    if (pageTitle.includes(sig)) {
      return {
        isBlocked: true,
        reason: 'title_signature_matched',
        message: 'Yelp access restricted'
      };
    }
  }

  // 2. Check for Cloudflare / PerimeterX / reCAPTCHA challenge DOM elements
  const challengeSelectors = [
    '#challenge-running',
    '#challenge-stage',
    '#cf-wrapper',
    '.cf-browser-verification',
    '#px-captcha',
    '.g-recaptcha',
    '.h-captcha',
    'iframe[src*="recaptcha"]',
    'iframe[src*="cloudflare"]',
    'iframe[src*="hcaptcha"]',
    'iframe[src*="challenge"]',
    'div[id*="captcha"]',
    'div[class*="captcha-container"]',
    '.error-code-403'
  ];

  for (const sel of challengeSelectors) {
    try {
      const el = doc.querySelector(sel);
      if (el) {
        return {
          isBlocked: true,
          reason: 'challenge_element_detected',
          message: 'Yelp access restricted'
        };
      }
    } catch (e) {
      // Ignore selector syntax issues if any
    }
  }

  // 3. Check prominent headings (h1, h2) for explicit block announcements
  const headings = doc.querySelectorAll('h1, h2');
  for (const h of headings) {
    const text = (h.textContent || '').toLowerCase().trim();
    for (const sig of YELP_BLOCK_SIGNATURES) {
      if (text.includes(sig)) {
        return {
          isBlocked: true,
          reason: 'heading_block_message',
          message: 'Yelp access restricted'
        };
      }
    }
  }

  // 4. Check main body text for specific anti-bot challenge statements
  const bodyText = (doc.body ? (doc.body.innerText || doc.body.textContent || '') : '').toLowerCase();
  if (
    bodyText.includes('why have i been blocked') ||
    bodyText.includes('pardon our interruption') ||
    bodyText.includes('our systems have detected unusual traffic from your computer network') ||
    (bodyText.includes('verify you are human') && bodyText.includes('cloud-flare'))
  ) {
    return {
      isBlocked: true,
      reason: 'body_challenge_statement',
      message: 'Yelp access restricted'
    };
  }

  return { isBlocked: false };
}

/**
 * Validates that an extracted business name is not an error phrase.
 * @param {string} name
 * @returns {boolean}
 */
function isValidBusinessName(name) {
  if (!name || typeof name !== 'string') return false;
  const lower = name.toLowerCase().trim();
  if (lower.length < 2) return false;
  for (const sig of YELP_BLOCK_SIGNATURES) {
    if (lower.includes(sig)) return false;
  }
  return true;
}

/**
 * Extracts business records from Yelp DOM.
 * Halts immediately if access restriction or CAPTCHA is detected.
 *
 * @param {Document} doc
 * @param {Location} loc
 * @returns {Array<Object>} List of extracted raw business objects (annotated with blocked and status properties)
 */
function extractYelp(doc = document, loc = location) {
  // 1. Immediately check for access restriction / CAPTCHA gate
  const blockCheck = detectYelpBlock(doc);
  if (blockCheck.isBlocked) {
    console.warn('[LeadHero] Yelp access restriction detected. Extraction halted immediately.');
    
    // Return empty array annotated with block status
    const blockedResult = [];
    blockedResult.blocked = true;
    blockedResult.status = 'Yelp access restricted';
    blockedResult.reason = blockCheck.reason;
    blockedResult.error = 'Yelp access restricted';
    blockedResult.leads = [];
    return blockedResult;
  }

  const leads = [];
  leads.blocked = false;
  leads.status = 'Ready';

  // 2. Try single business profile page
  const profileLead = extractYelpProfile(doc, loc);
  if (profileLead && profileLead.name && isValidBusinessName(profileLead.name)) {
    leads.push(profileLead);
    leads.leads = leads;
    return leads;
  }

  // 3. Try search results page
  const searchLeads = extractYelpSearchResults(doc, loc);
  if (searchLeads.length > 0) {
    const validLeads = searchLeads.filter((lead) => lead.name && isValidBusinessName(lead.name));
    validLeads.blocked = false;
    validLeads.status = 'Ready';
    validLeads.leads = validLeads;
    return validLeads;
  }

  leads.leads = leads;
  return leads;
}

/**
 * Extracts business details from an individual Yelp business profile (/biz/).
 */
function extractYelpProfile(doc, loc) {
  // Business Name
  const nameSelectors = [
    'h1[data-testid="business-title"]',
    'h1.css-1122uk9',
    'h1.heading--h1',
    'div[data-testid="photoHeader"] h1',
    'h1'
  ];

  let name = '';
  for (const sel of nameSelectors) {
    const el = doc.querySelector(sel);
    if (el && el.textContent.trim()) {
      const text = el.textContent.trim();
      // Exclude page-level non-business titles or blocked phrases
      if (
        !text.toLowerCase().includes('yelp') &&
        !text.toLowerCase().includes('search') &&
        isValidBusinessName(text)
      ) {
        name = text;
        break;
      }
    }
  }

  if (!name && doc.title && doc.title.includes('Yelp')) {
    const cleanTitle = doc.title.replace(/\s*-\s*Yelp.*$/i, '').trim();
    if (
      cleanTitle &&
      !cleanTitle.toLowerCase().includes('the best') &&
      isValidBusinessName(cleanTitle)
    ) {
      name = cleanTitle;
    }
  }

  if (!name || !isValidBusinessName(name)) return null;

  // Category
  const categorySelectors = [
    'span[data-font-weight="semibold"] a[href*="/c/"]',
    'span[class*="css-"] a[href*="/c/"]',
    'span.category-str-list a',
    'a[href*="/search?cflt="]'
  ];
  const categories = [];
  for (const sel of categorySelectors) {
    const els = doc.querySelectorAll(sel);
    if (els.length > 0) {
      els.forEach((el) => {
        const catText = el.textContent.trim();
        if (catText && !categories.includes(catText)) categories.push(catText);
      });
      break;
    }
  }
  const category = categories.join(', ') || 'Local Business';

  // Phone
  let phone = '';
  const telLink = doc.querySelector('a[href^="tel:"]');
  if (telLink) {
    phone = telLink.getAttribute('href').replace(/^tel:/i, '').trim();
  } else {
    // Check paragraphs with phone SVG or text matching phone numbers in sidebar
    const phoneRegex = /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?[2-9]\d{2}[-.\s]?\d{4}/;
    const candidates = doc.querySelectorAll('p, span, div[class*="contact"]');
    for (const el of candidates) {
      const text = el.textContent.trim();
      if (text.length < 40 && phoneRegex.test(text)) {
        const match = text.match(phoneRegex);
        if (match) {
          phone = match[0];
          break;
        }
      }
    }
  }

  // Address
  let address = '';
  const addressEl = doc.querySelector('address, [data-testid="address"], a[href*="/map/"]');
  if (addressEl) {
    address = addressEl.innerText ? addressEl.innerText.replace(/\n+/g, ', ').trim() : addressEl.textContent.trim();
  }

  // Website (Yelp wraps external websites in /biz_redir?url=...)
  let website = '';
  const webRedirLink = doc.querySelector('a[href*="/biz_redir"]');
  if (webRedirLink) {
    const rawHref = webRedirLink.getAttribute('href');
    website = cleanYelpRedir(rawHref);
  } else {
    const nofollowLinks = doc.querySelectorAll('a[rel*="nofollow"]');
    for (const a of nofollowLinks) {
      const text = a.textContent.toLowerCase();
      if (text.includes('website') || text.includes('.com') || text.includes('http')) {
        website = a.getAttribute('href');
        break;
      }
    }
  }

  return {
    name,
    phone,
    category,
    businessLink: loc ? loc.href : '',
    address,
    website,
    source: 'yelp'
  };
}

/**
 * Extracts multiple business cards from a Yelp search result page (/search?).
 */
function extractYelpSearchResults(doc, loc) {
  const results = [];
  const cards = doc.querySelectorAll('div[data-testid="serp-ia-card"], [class*="container__09f24__"], li.border-color--default__09f24');

  cards.forEach((card) => {
    try {
      const titleLink = card.querySelector('h3 a[href*="/biz/"], a[href*="/biz/"][name], a[href^="/biz/"]');
      if (!titleLink) return;

      const name = titleLink.textContent.trim();
      if (!name || name.toLowerCase().includes('read more') || !isValidBusinessName(name)) return;

      let href = titleLink.getAttribute('href') || '';
      if (href.includes('?')) {
        href = href.split('?')[0];
      }
      const businessLink = href.startsWith('http') ? href : `https://www.yelp.com${href}`;

      const catEls = card.querySelectorAll('a[href*="/search?cflt="], a[href*="/c/"]');
      const cats = [];
      catEls.forEach((el) => {
        const text = el.textContent.trim();
        if (text && !cats.includes(text)) cats.push(text);
      });

      const phoneMatch = card.textContent.match(/(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?[2-9]\d{2}[-.\s]?\d{4}/);
      const phone = phoneMatch ? phoneMatch[0] : '';

      const neighborhoodEl = card.querySelector('[class*="raw__09f24"], p[class*="css-"]');
      let address = '';
      if (neighborhoodEl) {
        address = neighborhoodEl.textContent.trim();
      }

      results.push({
        name,
        phone,
        category: cats.join(', ') || 'Local Business',
        businessLink,
        address,
        website: '',
        source: 'yelp'
      });
    } catch (e) {
      // Skip card on error
    }
  });

  return results;
}

/**
 * Cleans Yelp's redirect URLs (/biz_redir?url=...) to reveal clean destination website.
 */
function cleanYelpRedir(raw) {
  if (!raw) return '';
  try {
    const urlObj = new URL(raw, 'https://www.yelp.com');
    const target = urlObj.searchParams.get('url');
    if (target) return decodeURIComponent(target);
  } catch (e) {
    const match = raw.match(/url=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return raw;
}

/**
 * Yelp Fusion API Adapter (Future Integration Interface)
 * Demonstrates clean modular separation for authorized API access.
 */
const YelpApiProvider = {
  ENDPOINT: 'https://api.yelp.com/v3/businesses/search',

  /**
   * Builds parameters for the official Yelp Fusion API.
   * @param {string} term - Keyword / trade (e.g., 'Plumber')
   * @param {string} location - Target market (e.g., 'Houston, TX')
   * @param {number} limit - Number of leads to request (max 50)
   * @returns {Object} Normalized API parameters
   */
  buildParams(term, location, limit = 20) {
    return {
      term: term.trim(),
      location: location.trim(),
      limit: Math.min(limit, 50),
      sort_by: 'best_match'
    };
  },

  /**
   * Maps a Yelp Fusion API business object to the standard LeadHero lead schema.
   * @param {Object} item - Yelp API item
   * @returns {Object} Normalized lead record
   */
  normalizeApiResponse(item) {
    const addressParts = (item.location && item.location.display_address) || [];
    const categories = (item.categories || []).map((c) => c.title).join(', ');

    return {
      id: `yelp_${item.id || Date.now()}`,
      name: item.name || '',
      phone: item.display_phone || item.phone || '',
      category: categories || 'Local Business',
      businessLink: item.url || '',
      address: addressParts.join(', '),
      website: '', // Requires Yelp Business Details endpoint for authorized partner tiers
      source: 'yelp',
      collectedAt: new Date().toISOString()
    };
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detectYelpBlock,
    isValidBusinessName,
    extractYelp,
    extractYelpProfile,
    extractYelpSearchResults,
    cleanYelpRedir,
    YelpApiProvider
  };
}

if (typeof window !== 'undefined') {
  const yelpApi = {
    detectYelpBlock,
    isValidBusinessName,
    extractYelp,
    extractYelpProfile,
    extractYelpSearchResults,
    cleanYelpRedir,
    YelpApiProvider
  };
  window.LeadHeroExtractYelp = yelpApi;
  window.PastryExtractYelp = yelpApi;
  window.extractYelp = extractYelp;
  window.detectYelpBlock = detectYelpBlock;
}
