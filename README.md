# Pastry Lead Scraper – Chrome Extension (Manifest V3)

> **Lead Generation & Data Extraction Engine for Home Repair & Service Businesses**  
> Built for the **Pastry Marketing** technical evaluation.

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Testing Status](https://img.shields.io/badge/Tests-All%20Passing-success.svg)](scripts/test_all.js)
[![Documentation](https://img.shields.io/badge/Full%20Docs-DOCUMENTATION.md-indigo.svg)](DOCUMENTATION.md)

---

## 📖 Comprehensive Documentation Notice

> 📌 **For technical hiring managers and reviewers**:  
> A detailed, self-contained, 16-section technical evaluation document is available in:  
> 👉 [**DOCUMENTATION.md**](DOCUMENTATION.md)  
> 
> It covers exact installation instructions, demo license activation keys, architectural diagrams, data flow, permissions justifications, known limitations, Yelp access restriction analysis, and troubleshooting FAQs.

---

## 1. Project Overview

**Pastry Lead Scraper** is a high-performance, privacy-focused Google Chrome Extension (Manifest V3) designed for **Pastry Marketing** and home service agencies (plumbers, electricians, HVAC technicians, roofers, landscapers).

It collects, normalizes, deduplicates, and exports verified business leads from:
1. **Google Maps** (Place details & search listing feeds)
2. **Yelp** (Business detail profiles & local search result cards)
3. **Individual Business Websites** (Schema.org JSON-LD structured data, Open Graph tags, and contact markup)

### Key Architectural Constraints Satisfied
- **Zero Remote Dependencies / No Backend**: Operates 100% locally within the browser runtime using `chrome.storage.local`.
- **No Paid API Keys Required**: Uses client-side DOM parsing and structured metadata extraction without paid external subscriptions.
- **Offline XLSX & CSV Exports**: Bundles SheetJS (`xlsx.full.min.js`) locally to strictly comply with Chrome's Content Security Policy (zero CDN execution).
- **Smart Deduplication Engine**: Automatically standardizes phone numbers to E.164 (`+1XXXXXXXXXX`) and matches address tokens to prevent duplicate leads while preserving cross-source provenance.

---

## 2. Main Features

- **Linear / Stripe-Style SaaS Dashboard (`dashboard.html`)**: Clean light interface with responsive data table, real-time statistics cards, search parameters launcher, and deletion confirmation dialogs.
- **Quick Action Popup (`popup.html`)**: Active tab source inspection, 1-click quick extract button, and live lead counters.
- **In-Page Floating Action Widget**: Injected floating pill (`🥐 Extract Leads`) on target pages allowing instant 1-click capture.
- **Schema.org JSON-LD Webpage Extractor (`utils/extractWebsite.js`)**: Traverses structured data trees for `LocalBusiness`, `PostalAddress`, `telephone`, and service categories.
- **Yelp Access-Restriction & Challenge Detection (`utils/extractYelp.js`)**: Detects anti-bot/CAPTCHA challenge pages, stops extraction immediately, displays a clear dashboard warning banner (*"Yelp access restricted"*), and rejects incomplete/error records.
- **Multi-Format Exports (`utils/export.js`)**:
  - **CSV**: RFC 4180 compliant with UTF-8 BOM (`pastry-business-leads.csv`).
  - **XLSX**: Fully formatted spreadsheet using bundled SheetJS (`pastry-business-leads.xlsx`).
  - **Clipboard (TSV)**: Tab-separated values with headers for instant copy-paste into Excel or Google Sheets.
- **Evaluation License Gate (`utils/license.js`)**: Prototype client-side activation modal using evaluation keys (`PASTRY-DEMO-2026`, `PASTRY-TEST-001`, `PASTRY-TEST-002`).

---

## 3. Quick Start & Installation

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle **Developer mode** (top-right corner) to **ON**.
3. Click **Load unpacked** (top-left) and select this project folder (`c:\dev\trial_task`).
4. Pin **Pastry Lead Scraper** to your Chrome toolbar.
5. Open the Dashboard tab (`dashboard.html`) and activate using demo key:
   ```text
   PASTRY-DEMO-2026
   ```

---

## 4. Automated Verification Tests

To run the automated test suite verifying manifest validity, phone normalization, deduplication, storage CRUD, CSV/XLSX exports, and DOM extractors:

```powershell
npm test
```

---

## 5. Documentation Navigation

- 📄 [**DOCUMENTATION.md**](DOCUMENTATION.md) – Comprehensive 16-section technical reference for the hiring manager.
- 📋 [**FEATURE_STATUS.md**](FEATURE_STATUS.md) – Verification report specifically detailing Yelp access restriction handling.
- 🎙️ [**INTERVIEW_PREP.md**](INTERVIEW_PREP.md) – Code tour walkthrough, architectural trade-offs, and interview speaking points.
