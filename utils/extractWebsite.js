/**
 * Pastry Lead Scraper - Website Extraction Module
 * Extracts business metadata from individual business websites.
 * Inspects JSON-LD Schema.org structured data, Open Graph tags, meta tags, and DOM elements.
 */

/**
 * Extracts business information from the currently loaded webpage document.
 * @param {Document} doc - HTML Document object (defaults to window.document)
 * @param {Location} loc - Location object (defaults to window.location)
 * @returns {Object} Raw extracted business data
 */
function extractWebsite(doc = document, loc = location) {
  const result = {
    name: '',
    phone: '',
    category: '',
    businessLink: loc ? loc.href : '',
    address: '',
    website: loc ? loc.origin : '',
    source: 'website'
  };

  // 1. Inspect Schema.org JSON-LD structured data (highest fidelity)
  const jsonLdData = extractJsonLd(doc);
  if (jsonLdData) {
    if (jsonLdData.name) result.name = jsonLdData.name;
    if (jsonLdData.phone || jsonLdData.telephone) result.phone = jsonLdData.phone || jsonLdData.telephone;
    if (jsonLdData.category) result.category = jsonLdData.category;
    if (jsonLdData.address) result.address = jsonLdData.address;
    if (jsonLdData.website || jsonLdData.url) result.website = jsonLdData.website || jsonLdData.url;
  }

  // 2. Fallbacks: Open Graph & Meta tags
  if (!result.name) {
    const ogSiteName = getMetaContent(doc, 'property', 'og:site_name');
    const ogTitle = getMetaContent(doc, 'property', 'og:title');
    if (ogSiteName) {
      result.name = ogSiteName;
    } else if (ogTitle) {
      result.name = cleanPageTitle(ogTitle);
    } else if (doc.title) {
      result.name = cleanPageTitle(doc.title);
    }
  }

  // 3. Fallback: Phone number via tel: link or text pattern
  if (!result.phone) {
    const telLink = doc.querySelector('a[href^="tel:"]');
    if (telLink) {
      result.phone = telLink.getAttribute('href').replace(/^tel:/i, '').trim();
    } else {
      // Search header/footer/contact text for phone regex
      result.phone = findPhoneInDOM(doc);
    }
  }

  // 4. Fallback: Address from <address> or microdata
  if (!result.address) {
    const addressEl = doc.querySelector('address, [itemprop="address"]');
    if (addressEl) {
      result.address = cleanWhitespace(addressEl.innerText || addressEl.textContent);
    }
  }

  // 5. Fallback: Category from meta description or keywords
  if (!result.category) {
    const metaDesc = getMetaContent(doc, 'name', 'description') || getMetaContent(doc, 'property', 'og:description');
    if (metaDesc) {
      result.category = inferCategoryFromText(metaDesc);
    }
  }

  // 6. Ensure website origin is clean
  if (!result.website && loc) {
    result.website = loc.origin;
  }

  return result;
}

/**
 * Searches and parses JSON-LD scripts for LocalBusiness or Organization types.
 * @param {Document} doc
 * @returns {Object|null}
 */
function extractJsonLd(doc) {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  if (!scripts || scripts.length === 0) return null;

  for (const script of scripts) {
    try {
      const content = script.textContent ? script.textContent.trim() : '';
      if (!content) continue;
      const parsed = JSON.parse(content);
      const businessNode = findBusinessNode(parsed);
      if (businessNode) {
        return parseBusinessNode(businessNode);
      }
    } catch (e) {
      // Invalid JSON-LD block; skip to next
    }
  }
  return null;
}

/**
 * Recursively locates a LocalBusiness, Organization, or relevant subtype node in JSON-LD.
 * @param {Object|Array} data
 * @returns {Object|null}
 */
function findBusinessNode(data) {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findBusinessNode(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof data === 'object') {
    // If has @graph, search within it
    if (Array.isArray(data['@graph'])) {
      const found = findBusinessNode(data['@graph']);
      if (found) return found;
    }

    const type = data['@type'];
    if (type) {
      const types = Array.isArray(type) ? type : [type];
      const isBusiness = types.some((t) => {
        if (typeof t !== 'string') return false;
        const lower = t.toLowerCase();
        return (
          lower.includes('business') ||
          lower.includes('organization') ||
          lower.includes('plumber') ||
          lower.includes('electrician') ||
          lower.includes('contractor') ||
          lower.includes('hvac') ||
          lower.includes('store') ||
          lower.includes('service') ||
          lower.includes('roof') ||
          lower.includes('clean')
        );
      });

      if (isBusiness) return data;
    }
  }

  return null;
}

/**
 * Parses relevant fields from a Schema.org LocalBusiness node.
 * @param {Object} node
 * @returns {Object}
 */
function parseBusinessNode(node) {
  const res = {};
  if (node.name && typeof node.name === 'string') {
    res.name = node.name.trim();
  }
  const rawPhone = node.telephone || node.phone;
  if (rawPhone && typeof rawPhone === 'string') {
    res.phone = rawPhone.trim();
    res.telephone = rawPhone.trim();
  }
  if (node.url && typeof node.url === 'string') {
    res.website = node.url.trim();
    res.url = node.url.trim();
  }

  // Parse category from @type or description
  if (node['@type']) {
    const rawType = Array.isArray(node['@type']) ? node['@type'][0] : node['@type'];
    if (typeof rawType === 'string') {
      // Split PascalCase into words (e.g. "PlumbingService" -> "Plumbing Service")
      res.category = rawType.replace(/([a-z])([A-Z])/g, '$1 $2');
    }
  }

  // Parse address (can be string or PostalAddress object)
  if (node.address) {
    if (typeof node.address === 'string') {
      res.address = node.address.trim();
    } else if (typeof node.address === 'object') {
      const parts = [
        node.address.streetAddress,
        node.address.addressLocality,
        node.address.addressRegion,
        node.address.postalCode
      ].filter(Boolean);
      res.address = parts.join(', ').trim();
    }
  }

  return res;
}

/**
 * Helper to get content from <meta> tags.
 */
function getMetaContent(doc, attrName, attrValue) {
  const el = doc.querySelector(`meta[${attrName}="${attrValue}"]`);
  return el ? (el.getAttribute('content') || '').trim() : '';
}

/**
 * Cleans web page titles by removing common branding separators.
 */
function cleanPageTitle(title) {
  if (!title) return '';
  // Split on common delimiters: " | ", " - ", " — ", " : "
  const parts = title.split(/\s+[|\-—:•]\s+/);
  return parts[0].trim();
}

/**
 * Collapses whitespace.
 */
function cleanWhitespace(str) {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Heuristic phone extractor from DOM text.
 */
function findPhoneInDOM(doc) {
  const phoneRegex = /(?:\+?1[-.\s]?)?\(?([2-9]\d{2})\)?[-.\s]?([2-9]\d{2})[-.\s]?(\d{4})/;
  // Check header, footer, contact sections
  const targets = doc.querySelectorAll('header, footer, nav, [class*="contact"], [id*="contact"], [class*="phone"]');
  for (const el of targets) {
    const text = el.innerText || el.textContent || '';
    const match = text.match(phoneRegex);
    if (match) return match[0].trim();
  }
  return '';
}

/**
 * Infers business category from text.
 */
function inferCategoryFromText(text) {
  if (!text) return 'Home Services';
  const lower = text.toLowerCase();
  const categories = [
    'Plumber', 'Plumbing', 'HVAC', 'Air Conditioning', 'Heating',
    'Electrician', 'Electrical', 'Roofer', 'Roofing', 'Landscaping',
    'General Contractor', 'Pest Control', 'Painter', 'Painting',
    'Cleaning', 'Locksmith', 'Appliance Repair', 'Carpentry'
  ];
  for (const cat of categories) {
    if (lower.includes(cat.toLowerCase())) {
      return cat;
    }
  }
  return 'Home Services';
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractWebsite,
    extractJsonLd,
    findBusinessNode,
    parseBusinessNode,
    cleanPageTitle,
    inferCategoryFromText
  };
}

if (typeof window !== 'undefined') {
  window.PastryExtractWebsite = {
    extractWebsite
  };
  window.extractWebsite = extractWebsite;
}
