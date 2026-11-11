/**
 * LeadHero - Extractor Verification Test
 * Tests Google Maps and Yelp DOM extraction logic against real-world HTML structures.
 */

const gmapsExt = require('../utils/extractGoogleMaps.js');
const yelpExt = require('../utils/extractYelp.js');

console.log('--- Testing Google Maps Profile Extraction ---');
const fakeGmapsDoc = {
  querySelector: (sel) => {
    if (sel.includes('h1.DUwDvf') || sel.includes('h1')) {
      return { textContent: 'Apex Plumbing & Drain Solutions' };
    }
    if (sel.includes('category')) {
      return { textContent: 'Plumber' };
    }
    if (sel.includes('data-item-id*="address"') || sel.includes('Address:')) {
      return {
        getAttribute: (attr) => attr === 'aria-label' ? 'Address: 2400 Post Oak Blvd, Houston, TX 77056' : null,
        textContent: '2400 Post Oak Blvd, Houston, TX 77056'
      };
    }
    if (sel.includes('data-item-id^="phone:"') || sel.includes('Phone:')) {
      return {
        getAttribute: (attr) => attr === 'aria-label' ? 'Phone: (713) 555-4321' : null,
        textContent: '(713) 555-4321'
      };
    }
    if (sel.includes('data-item-id="authority"') || sel.includes('Website:')) {
      return {
        getAttribute: (attr) => attr === 'href' ? 'https://www.google.com/url?q=https://apexplumbinghouston.com&source=maps' : null,
        textContent: 'apexplumbinghouston.com'
      };
    }
    return null;
  },
  querySelectorAll: () => [],
  title: 'Apex Plumbing & Drain Solutions - Google Maps'
};

const gmapsLeads = gmapsExt.extractGoogleMaps(fakeGmapsDoc, { href: 'https://www.google.com/maps/place/Apex+Plumbing' });
console.assert(gmapsLeads.length === 1, 'Extracted 1 profile lead');
console.assert(gmapsLeads[0].name === 'Apex Plumbing & Drain Solutions', `Name: ${gmapsLeads[0].name}`);
console.assert(gmapsLeads[0].category === 'Plumber', `Category: ${gmapsLeads[0].category}`);
console.assert(gmapsLeads[0].address.includes('2400 Post Oak Blvd'), `Address: ${gmapsLeads[0].address}`);
console.assert(gmapsLeads[0].phone === '(713) 555-4321', `Phone: ${gmapsLeads[0].phone}`);
console.assert(gmapsLeads[0].website === 'https://apexplumbinghouston.com', `Cleaned Website: ${gmapsLeads[0].website}`);
console.assert(gmapsLeads[0].source === 'google_maps', `Source: ${gmapsLeads[0].source}`);
console.log('✓ Google Maps single profile extraction verified');

console.log('\n--- Testing Yelp Profile Extraction ---');
const fakeYelpDoc = {
  querySelector: (sel) => {
    if (sel.includes('business-title') || sel.includes('h1')) {
      return { textContent: 'Vanguard Heating & Air Conditioning' };
    }
    if (sel.includes('tel:')) {
      return { getAttribute: (attr) => attr === 'href' ? 'tel:+18325557788' : null };
    }
    if (sel.includes('address')) {
      return { innerText: '1500 Texas Ave\nHouston, TX 77002', textContent: '1500 Texas Ave, Houston, TX 77002' };
    }
    if (sel.includes('biz_redir')) {
      return { getAttribute: (attr) => attr === 'href' ? '/biz_redir?url=https%3A%2F%2Fvanguardhvac.com' : null };
    }
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel.includes('/c/')) {
      return [
        { textContent: 'Heating & Air Conditioning/HVAC' },
        { textContent: 'Air Duct Cleaning' }
      ];
    }
    return [];
  },
  title: 'Vanguard Heating & Air Conditioning - Yelp'
};

const yelpLeads = yelpExt.extractYelp(fakeYelpDoc, { href: 'https://www.yelp.com/biz/vanguard-hvac' });
console.assert(yelpLeads.length === 1, 'Extracted 1 Yelp lead');
console.assert(yelpLeads[0].name === 'Vanguard Heating & Air Conditioning', `Name: ${yelpLeads[0].name}`);
console.assert(yelpLeads[0].category.includes('HVAC'), `Category: ${yelpLeads[0].category}`);
console.assert(yelpLeads[0].phone === '+18325557788', `Phone: ${yelpLeads[0].phone}`);
console.assert(yelpLeads[0].address.includes('1500 Texas Ave'), `Address: ${yelpLeads[0].address}`);
console.assert(yelpLeads[0].website === 'https://vanguardhvac.com', `Cleaned Website: ${yelpLeads[0].website}`);
console.assert(yelpLeads[0].source === 'yelp', `Source: ${yelpLeads[0].source}`);
console.log('✓ Yelp profile extraction verified');

console.log('\n--- Testing Yelp Block & Access-Restricted Detection ---');

// Test Case 1: Yelp Access Denied Title
const fakeBlockedDoc1 = {
  querySelector: () => null,
  querySelectorAll: () => [],
  title: 'Access to this page has been denied'
};
const check1 = yelpExt.detectYelpBlock(fakeBlockedDoc1);
console.assert(check1.isBlocked === true, 'Detected block via title signature');
console.assert(check1.message === 'Yelp access restricted', 'Message is "Yelp access restricted"');
const resBlocked1 = yelpExt.extractYelp(fakeBlockedDoc1, { href: 'https://www.yelp.com/search' });
console.assert(resBlocked1.length === 0, 'Zero records extracted on blocked page');
console.assert(resBlocked1.blocked === true, 'Result flagged as blocked === true');
console.assert(resBlocked1.status === 'Yelp access restricted', 'Status is "Yelp access restricted"');
console.log('✓ Title signature block detection & immediate extraction halt verified');

// Test Case 2: Cloudflare Challenge DOM Element
const fakeBlockedDoc2 = {
  querySelector: (sel) => {
    if (sel === '#challenge-stage' || sel === '#cf-wrapper') {
      return { id: 'challenge-stage' };
    }
    return null;
  },
  querySelectorAll: () => [],
  title: 'Just a moment...'
};
const check2 = yelpExt.detectYelpBlock(fakeBlockedDoc2);
console.assert(check2.isBlocked === true, 'Detected block via challenge selector');
const resBlocked2 = yelpExt.extractYelp(fakeBlockedDoc2, { href: 'https://www.yelp.com/biz/some-biz' });
console.assert(resBlocked2.length === 0, 'Zero records extracted on challenge page');
console.assert(resBlocked2.blocked === true, 'Extraction flagged as blocked');
console.log('✓ Cloudflare challenge element detection verified');

// Test Case 3: PerimeterX / CAPTCHA element with heading
const fakeBlockedDoc3 = {
  querySelector: (sel) => {
    if (sel.includes('px-captcha') || sel.includes('captcha')) {
      return { id: 'px-captcha' };
    }
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel.includes('h1')) {
      return [{ textContent: 'Please verify you are a human' }];
    }
    return [];
  },
  title: 'Security Check | Yelp'
};
const check3 = yelpExt.detectYelpBlock(fakeBlockedDoc3);
console.assert(check3.isBlocked === true, 'Detected block via CAPTCHA element & heading');
const resBlocked3 = yelpExt.extractYelp(fakeBlockedDoc3, { href: 'https://www.yelp.com/biz/test' });
console.assert(resBlocked3.length === 0, 'No leads saved on CAPTCHA page');
console.assert(resBlocked3.status === 'Yelp access restricted', 'Status is "Yelp access restricted"');
console.log('✓ CAPTCHA challenge detection verified');

console.log('\n--- Testing Modular Yelp Fusion API Adapter ---');
console.assert(typeof yelpExt.YelpApiProvider === 'object', 'YelpApiProvider is defined');
const apiParams = yelpExt.YelpApiProvider.buildParams('Plumber', 'Houston, TX', 25);
console.assert(apiParams.term === 'Plumber' && apiParams.location === 'Houston, TX', 'API params formatted');
const mockYelpApiResponse = {
  id: 'abc-123-plumbing-houston',
  name: 'ABC Plumbing Pro',
  display_phone: '(713) 555-7799',
  url: 'https://www.yelp.com/biz/abc-plumbing-pro',
  location: {
    display_address: ['1000 Louisiana St', 'Houston, TX 77002']
  },
  categories: [{ title: 'Plumbing' }, { title: 'Water Heater Installation' }]
};
const normalizedApiLead = yelpExt.YelpApiProvider.normalizeApiResponse(mockYelpApiResponse);
console.assert(normalizedApiLead.name === 'ABC Plumbing Pro', 'API lead name normalized');
console.assert(normalizedApiLead.phone === '(713) 555-7799', 'API lead phone normalized');
console.assert(normalizedApiLead.category.includes('Plumbing'), 'API lead category normalized');
console.assert(normalizedApiLead.address.includes('Houston, TX'), 'API lead address normalized');
console.log('✓ Modular Yelp Fusion API adapter verified for future integration');

console.log('\n--- All DOM Extractor Tests Passed ---');

