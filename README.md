# LeadHero – Chrome Extension (Manifest V3)

> **Smart Business Lead Discovery & Extraction Engine**  
> Built for **Pastry Marketing** technical evaluation.

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-38BDF8.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Testing Status](https://img.shields.io/badge/Tests-All%20Passing-10B981.svg)](scripts/test_all.js)
[![Documentation](https://img.shields.io/badge/Full%20Docs-DOCUMENTATION.md-0284C7.svg)](DOCUMENTATION.md)

---

## 📖 Comprehensive Documentation Notice

> 📌 **For technical hiring managers and reviewers**:  
> A detailed, self-contained, 16-section technical evaluation document is available in:  
> 👉 [**DOCUMENTATION.md**](DOCUMENTATION.md)  
> 
> It covers exact installation instructions, demo license activation keys, theme switching, architectural diagrams, data flow, permissions justifications, known limitations, Yelp access restriction analysis, and troubleshooting FAQs.

---

## 1. Project Overview

**LeadHero** is a privacy-focused Google Chrome Extension (Manifest V3) built for **Pastry Marketing** and service businesses (plumbers, electricians, HVAC technicians, roofers, landscapers).

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

- **White, Dark & Light Blue SaaS Dashboard (`dashboard.html`)**: Crisp modern interface with **Light Mode** and **Dark Mode** switching (from both the header bar and Settings modal), responsive data table, real-time statistics cards, search launcher, and confirmation dialogs.
- **Quick Action Popup (`popup.html`)**: Active tab source inspection, Light/Dark theme toggle, 1-click quick extract button, and live lead counters.
- **In-Page Floating Action Widget**: Dark navy & light-blue floating pill (`⚡ LeadHero: Extract ...`) on target pages allowing instant 1-click capture.
- **Schema.org JSON-LD Webpage Extractor (`utils/extractWebsite.js`)**: Traverses structured data trees for `LocalBusiness`, `PostalAddress`, `telephone`, and service categories.
- **Yelp Access-Restriction & Challenge Detection (`utils/extractYelp.js`)**: Detects anti-bot/CAPTCHA challenge pages, stops extraction immediately, displays a clear dashboard warning banner (*"Yelp access restricted"*), and rejects incomplete/error records.
- **Multi-Format Exports (`utils/export.js`)**:
  - **CSV**: RFC 4180 compliant with UTF-8 BOM (`leadhero-business-leads.csv`).
  - **XLSX**: Fully formatted spreadsheet using bundled SheetJS (`leadhero-business-leads.xlsx`).
  - **Clipboard (TSV)**: Tab-separated values with headers for instant copy-paste into Excel or Google Sheets.
- **Evaluation License Gate (`utils/license.js`)**: Prototype client-side activation modal using evaluation keys (`LEADHERO-DEMO-2026`, `LEADHERO-TEST-001`, `LEADHERO-TEST-002`).

---

## 3. Quick Start & Installation

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle **Developer mode** (top-right corner) to **ON**.
3. Click **Load unpacked** (top-left) and select this project folder (`c:\dev\trial_task`).
4. Pin **LeadHero** to your Chrome toolbar.
5. Open the Dashboard tab (`dashboard.html`) and activate using demo key:
   ```text
   LEADHERO-DEMO-2026
   ```

---

## 4. Automated Verification Tests

To run the automated test suite verifying manifest validity, theme persistence, phone normalization, deduplication, storage CRUD, CSV/XLSX exports, and DOM extractors:

```powershell
npm test
```

---

## 5. Documentation Navigation

- 📄 [**DOCUMENTATION.md**](DOCUMENTATION.md) – Comprehensive 16-section technical reference for the hiring manager.
- 📋 [**FEATURE_STATUS.md**](FEATURE_STATUS.md) – Verification report specifically detailing Yelp access restriction handling.
- 🎙️ [**INTERVIEW_PREP.md**](INTERVIEW_PREP.md) – Code tour walkthrough, architectural trade-offs, and interview speaking points.
