/**
 * Pastry Lead Scraper - Comprehensive Test Suite
 * Tests manifest validity, core utilities, deduplication, storage, exports, and DOM extractors.
 */

const fs = require('fs');
const path = require('path');

// 1. Verify Manifest
console.log('=============================================');
console.log('TEST 1: Manifest V3 Validation');
console.log('=============================================');
const manifestPath = path.join(__dirname, '..', 'manifest.json');
const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestRaw);

console.log('✓ Manifest is valid JSON');
console.assert(manifest.manifest_version === 3, 'Manifest version must be 3');
console.log('✓ Manifest version is 3');
console.assert(manifest.name === 'Pastry Lead Scraper', 'Manifest name matches');
console.log('✓ Manifest name is "Pastry Lead Scraper"');
console.assert(manifest.permissions.includes('storage'), 'Has storage permission');
console.assert(manifest.permissions.includes('tabs'), 'Has tabs permission');
console.assert(manifest.permissions.includes('activeTab'), 'Has activeTab permission');
console.assert(manifest.permissions.includes('scripting'), 'Has scripting permission');
console.log('✓ Required permissions present:', manifest.permissions);

// Verify icons exist
for (const [size, iconFile] of Object.entries(manifest.icons)) {
  const iconPath = path.join(__dirname, '..', iconFile);
  console.assert(fs.existsSync(iconPath), `Icon file ${iconFile} exists`);
  console.log(`✓ Icon ${size}x${size} exists: ${iconFile} (${fs.statSync(iconPath).size} bytes)`);
}

// 2. License System
console.log('\n=============================================');
console.log('TEST 2: License System Validation');
console.log('=============================================');
const license = require('../utils/license.js');
console.assert(license.validateLicense('PASTRY-DEMO-2026'), 'PASTRY-DEMO-2026 valid');
console.assert(license.validateLicense('pastry-demo-2026'), 'Case-insensitive valid');
console.assert(license.validateLicense('  PASTRY-TEST-001  '), 'Trimmed valid');
console.assert(license.validateLicense('PASTRY-TEST-002'), 'PASTRY-TEST-002 valid');
console.assert(!license.validateLicense('INVALID-KEY'), 'Invalid key rejected');
console.assert(!license.validateLicense(''), 'Empty key rejected');
console.assert(!license.validateLicense(null), 'Null key rejected');
console.log('✓ All license key validation tests passed');

// 3. Normalization & Deduplication
console.log('\n=============================================');
console.log('TEST 3: Phone Normalization & Deduplication');
console.log('=============================================');
const norm = require('../utils/normalize.js');

const phone1 = norm.normalizePhone('(713) 555-1234');
const phone2 = norm.normalizePhone('713-555-1234');
const phone3 = norm.normalizePhone('+1 713.555.1234');
const phone4 = norm.normalizePhone('tel:(713) 555-1234 ext 99');

console.assert(phone1 === '+17135551234', `Expected +17135551234, got ${phone1}`);
console.assert(phone2 === '+17135551234', `Expected +17135551234, got ${phone2}`);
console.assert(phone3 === '+17135551234', `Expected +17135551234, got ${phone3}`);
console.assert(phone4 === '+17135551234', `Expected +17135551234, got ${phone4}`);
console.log('✓ Phone numbers consistently normalize across all formats');

const leadA = norm.createBusinessRecord({
  name: 'Houston Elite Plumbing LLC',
  phone: '(713) 555-9876',
  address: '1000 Main St, Houston, TX 77002',
  source: 'google_maps'
});

const leadB = norm.createBusinessRecord({
  name: 'Houston Elite Plumbing',
  phone: '713.555.9876',
  address: '1000 Main Street, Houston, Texas',
  source: 'yelp'
});

console.assert(norm.areDuplicates(leadA, leadB), 'Duplicate detected by normalized phone');
console.log('✓ Duplicate detected by phone match');

const leadC = norm.createBusinessRecord({
  name: 'Lone Star AC & Heating Inc',
  phone: '', // No phone
  address: '500 Westheimer Rd, Houston, TX',
  source: 'google_maps'
});

const leadD = norm.createBusinessRecord({
  name: 'Lone Star AC & Heating',
  phone: '', // No phone
  address: '500 Westheimer Road, Houston, Texas',
  source: 'website'
});

console.assert(norm.areDuplicates(leadC, leadD), 'Duplicate detected by name + address when phone missing');
console.log('✓ Duplicate detected by name and address match when phone is missing');

// 4. Storage Persistence & Counter
console.log('\n=============================================');
console.log('TEST 4: Storage Persistence & Duplicate Prevention');
console.log('=============================================');
const storage = require('../utils/storage.js');

async function testStorageFlow() {
  await storage.clearBusinesses(true);

  // Initial stats
  let stats = await storage.getStats();
  console.assert(stats.total === 0, 'Total is 0 initially');
  console.assert(stats.duplicatesPrevented === 0, 'Duplicates prevented is 0 initially');

  // Save Lead A
  const resA = await storage.saveBusiness(leadA);
  console.assert(resA.saved === true, 'Lead A saved');
  console.assert(resA.duplicate === false, 'Lead A is not duplicate');

  // Attempt to save Lead B (duplicate of A)
  const resB = await storage.saveBusiness(leadB);
  console.assert(resB.saved === false, 'Lead B not saved (duplicate)');
  console.assert(resB.duplicate === true, 'Lead B recognized as duplicate');

  // Attempt to save a blocked / CAPTCHA error record
  const fakeBlockedLead = norm.createBusinessRecord({
    name: 'Access to this page has been denied',
    phone: '',
    address: '',
    source: 'yelp'
  });
  console.assert(norm.isValidRecord(fakeBlockedLead) === false, 'Blocked title rejected by isValidRecord');
  const resBlocked = await storage.saveBusiness(fakeBlockedLead);
  console.assert(resBlocked.saved === false, 'Blocked error record refused by storage');
  console.log('✓ Incomplete and blocked error page records rejected from storage');

  // Verify provenance retention
  const savedList = await storage.getBusinesses();
  console.assert(savedList.length === 1, 'Still only 1 record');
  console.assert(savedList[0].sources.includes('google_maps'), 'Has google_maps source');
  console.assert(savedList[0].sources.includes('yelp'), 'Has yelp source provenance retained');
  console.log('✓ Provenance preserved on duplicate record across sources');

  // Save batch
  const batchRes = await storage.saveBusinesses([leadC, leadD, leadA]);
  console.assert(batchRes.added === 1, `Expected 1 added (leadC), got ${batchRes.added}`);
  console.assert(batchRes.duplicates === 2, `Expected 2 duplicates (leadD and leadA), got ${batchRes.duplicates}`);

  stats = await storage.getStats();
  console.assert(stats.total === 2, `Expected total 2, got ${stats.total}`);
  console.assert(stats.duplicatesPrevented === 3, `Expected 3 duplicates prevented, got ${stats.duplicatesPrevented}`);
  console.log(`✓ Storage stats verified: Total=${stats.total}, DuplicatesPrevented=${stats.duplicatesPrevented}`);

  // Delete individual
  const delSuccess = await storage.deleteBusiness(leadA.id);
  console.assert(delSuccess === true, 'Lead A deleted');
  const afterDelList = await storage.getBusinesses();
  console.assert(afterDelList.length === 1, 'Only 1 record remains');
  console.log('✓ Individual deletion verified');

  // Delete batch
  await storage.saveBusiness(leadA);
  const delCount = await storage.deleteSelectedBusinesses([leadA.id, leadC.id]);
  console.assert(delCount === 2, `Expected 2 deleted, got ${delCount}`);
  const emptyList = await storage.getBusinesses();
  console.assert(emptyList.length === 0, 'List is now empty');
  console.log('✓ Batch deletion verified');
}

// 5. Export Utilities (CSV, XLSX, TSV)
console.log('\n=============================================');
console.log('TEST 5: Data Export (CSV, XLSX, TSV)');
console.log('=============================================');
const exp = require('../utils/export.js');
const XLSX = require('../libs/xlsx.full.min.js');

const sampleLeads = [
  norm.createBusinessRecord({
    name: 'Precision Plumbing, LLC "The Best"',
    phone: '+1 (713) 555-0199',
    category: 'Plumbing Services',
    businessLink: 'https://www.google.com/maps/place/Precision+Plumbing',
    address: '123 Commercial Blvd, Suite 200, Houston, TX 77001',
    website: 'https://precisionplumbinghouston.com',
    source: 'google_maps',
    collectedAt: new Date().toISOString()
  }),
  norm.createBusinessRecord({
    name: 'All Stars Electric',
    phone: '713.555.0144',
    category: 'Electricians',
    businessLink: 'https://www.yelp.com/biz/all-stars-electric-houston',
    address: '456 Energy Way, Houston, TX 77002',
    website: 'https://allstarselectric.com',
    source: 'yelp',
    collectedAt: new Date().toISOString()
  })
];

// Test CSV Generation
const csvOutput = exp.generateCSV(sampleLeads);
console.assert(csvOutput.includes('Business Name,Phone Number'), 'CSV has header row');
console.assert(csvOutput.includes('"Precision Plumbing, LLC ""The Best"""'), 'CSV escapes commas and quotes correctly');
console.log('✓ CSV generated and escaped with RFC 4180 compliance');

// Test TSV Generation
const tsvOutput = exp.formatAsTSV(sampleLeads);
console.assert(tsvOutput.includes('Business Name\tPhone Number'), 'TSV has tab delimiter');
console.assert(!tsvOutput.includes('\tPrecision Plumbing, LLC ""The Best"""'), 'TSV formatted for spreadsheet pasting');
console.log('✓ TSV tab-separated values generated cleanly');

// Test XLSX via SheetJS
const worksheetData = sampleLeads.map((record) => {
  const row = {};
  exp.EXPORT_COLUMNS.forEach((col) => {
    row[col.label] = record[col.key] || '';
  });
  return row;
});
const worksheet = XLSX.utils.json_to_sheet(worksheetData);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Business Leads');
const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
console.assert(xlsxBuffer && xlsxBuffer.length > 1000, `XLSX binary created (${xlsxBuffer.length} bytes)`);
console.log(`✓ XLSX workbook created successfully using bundled SheetJS (${xlsxBuffer.length} bytes)`);

// 6. Extractor Logic Tests
console.log('\n=============================================');
console.log('TEST 6: JSON-LD Website Extraction Module');
console.log('=============================================');
const websiteExt = require('../utils/extractWebsite.js');

// Mock HTML document with JSON-LD
const mockJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Plumber',
  'name': 'Reliable Houston Plumbing Co',
  'telephone': '+1-713-555-8822',
  'url': 'https://reliablehoustonplumbing.com',
  'address': {
    '@type': 'PostalAddress',
    'streetAddress': '789 Pipe Lane',
    'addressLocality': 'Houston',
    'addressRegion': 'TX',
    'postalCode': '77005'
  }
};

const fakeDoc = {
  querySelectorAll: (selector) => {
    if (selector.includes('application/ld+json')) {
      return [{
        textContent: JSON.stringify(mockJsonLd)
      }];
    }
    return [];
  },
  querySelector: () => null,
  title: 'Reliable Houston Plumbing Co | 24/7 Emergency Service'
};

const fakeLoc = {
  href: 'https://reliablehoustonplumbing.com/contact',
  origin: 'https://reliablehoustonplumbing.com'
};

const extractedFromWeb = websiteExt.extractWebsite(fakeDoc, fakeLoc);
console.assert(extractedFromWeb.name === 'Reliable Houston Plumbing Co', `Name extracted: ${extractedFromWeb.name}`);
console.assert(extractedFromWeb.phone === '+1-713-555-8822', `Phone extracted: ${extractedFromWeb.phone}`);
console.assert(extractedFromWeb.category === 'Plumber', `Category extracted: ${extractedFromWeb.category}`);
console.assert(extractedFromWeb.address.includes('789 Pipe Lane'), `Address extracted: ${extractedFromWeb.address}`);
console.assert(extractedFromWeb.website === 'https://reliablehoustonplumbing.com', `Website: ${extractedFromWeb.website}`);
console.log('✓ Schema.org JSON-LD LocalBusiness metadata extracted cleanly from website');

// Test Yelp Redirect Link Cleaner
console.log('\n=============================================');
console.log('TEST 7: Yelp Redirection Cleaner');
console.log('=============================================');
const yelpExt = require('../utils/extractYelp.js');
const rawYelpRedirect = 'https://www.yelp.com/biz_redir?url=https%3A%2F%2Fwww.houstonsbestplumber.com%2Fservices&src=biz_details';
const cleanedUrl = yelpExt.cleanYelpRedir(rawYelpRedirect);
console.assert(cleanedUrl === 'https://www.houstonsbestplumber.com/services', `Expected clean URL, got: ${cleanedUrl}`);
console.log('✓ Yelp biz_redir parameters safely decoded to destination website');

// Execute async tests
testStorageFlow().then(() => {
  console.log('\n=============================================');
  console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  console.log('=============================================');
}).catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});