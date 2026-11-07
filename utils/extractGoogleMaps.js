/**
 * Pastry Lead Scraper - Google Maps Extraction Module
 * Extracts business information from Google Maps place profiles and search result feeds.
 * Resilient to dynamic class changes by using multiple selector strategies, ARIA attributes, and data-item-id tags.
 */

/**
 * Extracts business records from Google Maps DOM.
 * @param {Document} doc
 * @param {Location} loc
 * @returns {Array<Object>} List of extracted raw business objects
 */
function extractGoogleMaps(doc = document, loc = location) {
  const leads = [];

  // 1. Check if we are viewing a single place profile
  const profileLead = extractSingleProfile(doc, loc);
  if (profileLead && profileLead.name) {
    leads.push(profileLead);
    return leads;
  }

  // 2. Check if we are viewing a search results feed
  const feedLeads = extractSearchResultsFeed(doc, loc);
  if (feedLeads.length > 0) {
    return feedLeads;
  }

  // 3. Fallback: try checking active dialog or main pane
  const fallbackLead = extractFallbackMainPane(doc, loc);
  if (fallbackLead && fallbackLead.name) {
    leads.push(fallbackLead);
  }

  return leads;
}

/**
 * Extracts business data from a Google Maps single place details pane.
 */
function extractSingleProfile(doc, loc) {
  // Title / Business Name selectors
  const nameSelectors = [
    'h1.DUwDvf',
    'h1.fontHeadlineLarge',
    'div.lMbq3e h1',
    'div[role="main"] h1',
    'h1'
  ];

  let name = '';
  for (const sel of nameSelectors) {
    const el = doc.querySelector(sel);
    if (el && el.textContent.trim() && !el.textContent.includes('Google Maps')) {
      name = el.textContent.trim();
      break;
    }
  }

  if (!name && doc.title && doc.title.includes('Google Maps')) {
    const cleanTitle = doc.title.replace(/\s*-\s*Google Maps.*$/i, '').trim();
    if (cleanTitle && !cleanTitle.toLowerCase().includes('search')) {
      name = cleanTitle;
    }
  }

  if (!name) return null;

  // Category
  const categorySelectors = [
    'button[jsaction*="pane.rating.category"]',
    'span.DkEaL',
    'button.DkEaL',
    'div.fontBodyMedium button[jsaction*="category"]',
    'button[jsaction*="category"]'
  ];
  let category = '';
  for (const sel of categorySelectors) {
    const el = doc.querySelector(sel);
    if (el && el.textContent.trim()) {
      category = el.textContent.trim();
      break;
    }
  }

  // Address
  const addressSelectors = [
    'button[data-item-id*="address"]',
    'button[data-tooltip*="address" i]',
    '[aria-label^="Address:"]',
    '[aria-label*="Address"]',
    'button[data-item-id="address"] .Io6YTe'
  ];
  let address = '';
  for (const sel of addressSelectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const text = el.getAttribute('aria-label') || el.innerText || el.textContent;
      address = cleanAriaPrefix(text, 'Address:');
      if (address) break;
    }
  }

  // Phone
  const phoneSelectors = [
    'button[data-item-id^="phone:"]',
    'button[data-tooltip*="phone" i]',
    '[aria-label^="Phone:"]',
    '[aria-label*="Phone number:"]',
    '[aria-label*="Phone"]',
    'button[data-item-id^="phone"] .Io6YTe'
  ];
  let phone = '';
  for (const sel of phoneSelectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const text = el.getAttribute('aria-label') || el.innerText || el.textContent;
      phone = cleanAriaPrefix(text, 'Phone:');
      phone = cleanAriaPrefix(phone, 'Phone number:');
      if (phone) break;
    }
  }

  // Website
  const websiteSelectors = [
    'a[data-item-id="authority"]',
    'a[data-tooltip*="website" i]',
    'a[aria-label^="Website:"]',
    'a[aria-label*="Open website"]',
    'a[data-item-id="authority"] .Io6YTe'
  ];
  let website = '';
  for (const sel of websiteSelectors) {
    const el = doc.querySelector(sel);
    if (el) {
      website = el.getAttribute('href') || (el.innerText || el.textContent).trim();
      if (website) break;
    }
  }

  // Clean Google redirect on website
  if (website && website.includes('google.com/url?')) {
    try {
      const parsed = new URL(website);
      website = parsed.searchParams.get('q') || parsed.searchParams.get('url') || website;
    } catch (e) {}
  }

  return {
    name,
    phone,
    category: category || 'Local Business',
    businessLink: loc ? loc.href : '',
    address,
    website,
    source: 'google_maps'
  };
}

/**
 * Extracts multiple visible leads from a Google Maps search feed.
 */
function extractSearchResultsFeed(doc, loc) {
  const results = [];
  const feed = doc.querySelector('div[role="feed"]');
  if (!feed) return results;

  // Search card elements
  const cards = feed.querySelectorAll('div[role="article"], div.Nv2PK');
  if (!cards || cards.length === 0) {
    // Try link-based search
    const links = feed.querySelectorAll('a.hfpxzc[aria-label]');
    links.forEach((a) => {
      const name = a.getAttribute('aria-label') || '';
      const href = a.getAttribute('href') || '';
      if (name) {
        results.push({
          name: name.trim(),
          phone: '',
          category: 'Local Business',
          businessLink: href ? (href.startsWith('http') ? href : `https://www.google.com${href}`) : '',
          address: '',
          website: '',
          source: 'google_maps'
        });
      }
    });
    return results;
  }

  cards.forEach((card) => {
    try {
      // Name
      const nameEl = card.querySelector('div.fontHeadlineSmall, .qBF1Pd, h3');
      const linkEl = card.querySelector('a.hfpxzc, a[href*="/maps/place/"]');
      const name = nameEl ? nameEl.textContent.trim() : (linkEl ? linkEl.getAttribute('aria-label') : '');
      if (!name) return;

      const href = linkEl ? linkEl.getAttribute('href') : '';
      const businessLink = href ? (href.startsWith('http') ? href : `https://www.google.com${href}`) : '';

      // Secondary text lines (category, rating, phone, address snippet)
      const textLines = card.querySelectorAll('div.W4Efsd');
      let category = '';
      let phone = '';
      let address = '';

      textLines.forEach((line) => {
        const text = line.textContent.trim();
        const phoneMatch = text.match(/(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?[2-9]\d{2}[-.\s]?\d{4}/);
        if (phoneMatch && !phone) {
          phone = phoneMatch[0];
        }

        // Check for category or address clues
        if (!category && text.includes('·')) {
          const parts = text.split('·').map((p) => p.trim());
          if (parts.length > 0 && isNaN(Number(parts[0]))) {
            category = parts[0];
          }
        }
      });

      results.push({
        name,
        phone,
        category: category || 'Local Business',
        businessLink: businessLink || (loc ? loc.href : ''),
        address,
        website: '',
        source: 'google_maps'
      });
    } catch (e) {
      // Continue to next card
    }
  });

  return results;
}

/**
 * Fallback main pane extractor.
 */
function extractFallbackMainPane(doc, loc) {
  const main = doc.querySelector('div[role="main"]');
  if (!main) return null;

  const h1 = main.querySelector('h1');
  if (!h1 || !h1.textContent.trim()) return null;

  const name = h1.textContent.trim();
  const phoneEl = main.querySelector('button[aria-label*="Phone"], button[data-item-id^="phone"]');
  const addressEl = main.querySelector('button[aria-label*="Address"], button[data-item-id*="address"]');
  const webEl = main.querySelector('a[aria-label*="website" i], a[data-item-id="authority"]');

  return {
    name,
    phone: phoneEl ? cleanAriaPrefix(phoneEl.getAttribute('aria-label') || phoneEl.textContent, 'Phone:') : '',
    category: 'Local Business',
    businessLink: loc ? loc.href : '',
    address: addressEl ? cleanAriaPrefix(addressEl.getAttribute('aria-label') || addressEl.textContent, 'Address:') : '',
    website: webEl ? webEl.getAttribute('href') : '',
    source: 'google_maps'
  };
}

function cleanAriaPrefix(text, prefix) {
  if (!text) return '';
  let str = text.trim();
  if (str.toLowerCase().startsWith(prefix.toLowerCase())) {
    str = str.substring(prefix.length).trim();
  }
  return str.replace(/\s+/g, ' ');
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractGoogleMaps,
    extractSingleProfile,
    extractSearchResultsFeed
  };
}

if (typeof window !== 'undefined') {
  window.PastryExtractGoogleMaps = {
    extractGoogleMaps
  };
  window.extractGoogleMaps = extractGoogleMaps;
}
