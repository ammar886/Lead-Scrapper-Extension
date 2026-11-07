/**
 * Pastry Lead Scraper - Data Export Utilities
 * Supports CSV (native RFC 4180), XLSX (via bundled SheetJS), and Clipboard TSV.
 */

const EXPORT_COLUMNS = [
  { key: 'name', label: 'Business Name' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'category', label: 'Business Category/Service' },
  { key: 'businessLink', label: 'Business Link' },
  { key: 'address', label: 'Address/Area' },
  { key: 'website', label: 'Website' },
  { key: 'source', label: 'Source' },
  { key: 'collectedAt', label: 'Date Collected' },
  { key: 'id', label: 'Lead ID' }
];

/**
 * Escapes a cell value for CSV (RFC 4180 compliant).
 * @param {*} value
 * @returns {string}
 */
function escapeCSVCell(value) {
  if (value === null || value === undefined) return '';
  const stringVal = String(value);
  // If contains commas, double quotes, or newlines, quote the entire string and double the quotes
  if (/[",\r\n]/.test(stringVal)) {
    return `"${stringVal.replace(/"/g, '""')}"`;
  }
  return stringVal;
}

/**
 * Generates CSV string from an array of business records.
 * @param {Array<Object>} records
 * @returns {string} CSV text
 */
function generateCSV(records = []) {
  const headerRow = EXPORT_COLUMNS.map((col) => escapeCSVCell(col.label)).join(',');
  const rows = records.map((record) => {
    return EXPORT_COLUMNS.map((col) => {
      let val = record[col.key] || '';
      if (col.key === 'collectedAt' && val) {
        try {
          val = new Date(val).toLocaleString();
        } catch (e) {}
      }
      return escapeCSVCell(val);
    }).join(',');
  });

  return [headerRow, ...rows].join('\r\n');
}

/**
 * Triggers a file download in the browser using Blob and ObjectURL.
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 500);
}

/**
 * Exports business leads as a CSV file.
 * @param {Array<Object>} records
 * @param {string} filename
 * @returns {boolean}
 */
function exportToCSV(records = [], filename = 'pastry-business-leads.csv') {
  if (!records || records.length === 0) {
    throw new Error('No records available to export.');
  }

  const csvContent = generateCSV(records);
  // Add UTF-8 BOM so Excel opens accented characters cleanly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
  return true;
}

/**
 * Exports business leads as an XLSX spreadsheet using SheetJS.
 * @param {Array<Object>} records
 * @param {string} filename
 * @returns {boolean}
 */
function exportToXLSX(records = [], filename = 'pastry-business-leads.xlsx') {
  if (!records || records.length === 0) {
    throw new Error('No records available to export.');
  }

  // Check SheetJS availability (global window.XLSX)
  const xlsxLib = typeof XLSX !== 'undefined' ? XLSX : (typeof window !== 'undefined' ? window.XLSX : null);
  if (!xlsxLib) {
    throw new Error('SheetJS library (xlsx.full.min.js) is not loaded.');
  }

  // Format rows with friendly header names
  const worksheetData = records.map((record) => {
    const row = {};
    EXPORT_COLUMNS.forEach((col) => {
      let val = record[col.key] || '';
      if (col.key === 'collectedAt' && val) {
        try {
          val = new Date(val).toLocaleString();
        } catch (e) {}
      }
      row[col.label] = val;
    });
    return row;
  });

  const worksheet = xlsxLib.utils.json_to_sheet(worksheetData);

  // Set nice column widths
  const colWidths = [
    { wch: 28 }, // Business Name
    { wch: 18 }, // Phone Number
    { wch: 22 }, // Category
    { wch: 32 }, // Business Link
    { wch: 32 }, // Address
    { wch: 28 }, // Website
    { wch: 14 }, // Source
    { wch: 22 }, // Date Collected
    { wch: 24 }  // Lead ID
  ];
  worksheet['!cols'] = colWidths;

  const workbook = xlsxLib.utils.book_new();
  xlsxLib.utils.book_append_sheet(workbook, worksheet, 'Business Leads');

  xlsxLib.writeFile(workbook, filename);
  return true;
}

/**
 * Formats records as Tab-Separated Values (TSV) for direct paste into Excel or Google Sheets.
 * @param {Array<Object>} records
 * @returns {string} TSV text
 */
function formatAsTSV(records = []) {
  const headerRow = EXPORT_COLUMNS.map((col) => col.label).join('\t');
  const rows = records.map((record) => {
    return EXPORT_COLUMNS.map((col) => {
      let val = record[col.key] || '';
      if (col.key === 'collectedAt' && val) {
        try {
          val = new Date(val).toLocaleString();
        } catch (e) {}
      }
      // Replace tabs or newlines inside cells to keep table format intact
      return String(val).replace(/[\t\r\n]/g, ' ');
    }).join('\t');
  });

  return [headerRow, ...rows].join('\r\n');
}

/**
 * Copies records to the system clipboard in TSV format.
 * @param {Array<Object>} records
 * @returns {Promise<{success: boolean, count: number, message: string}>}
 */
async function copyToClipboard(records = []) {
  if (!records || records.length === 0) {
    throw new Error('No records selected or available to copy.');
  }

  const tsvText = formatAsTSV(records);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(tsvText);
      return {
        success: true,
        count: records.length,
        message: `Successfully copied ${records.length} record${records.length === 1 ? '' : 's'} to clipboard!`
      };
    } catch (err) {
      console.warn('Clipboard API write failed, attempting textarea fallback:', err);
    }
  }

  // Fallback using temporary textarea
  const textarea = document.createElement('textarea');
  textarea.value = tsvText;
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!successful) throw new Error('execCommand returned false');
    return {
      success: true,
      count: records.length,
      message: `Copied ${records.length} record${records.length === 1 ? '' : 's'} to clipboard!`
    };
  } catch (e) {
    document.body.removeChild(textarea);
    throw new Error('Failed to copy to clipboard. Please grant clipboard permissions.');
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EXPORT_COLUMNS,
    escapeCSVCell,
    generateCSV,
    exportToCSV,
    exportToXLSX,
    formatAsTSV,
    copyToClipboard
  };
}

if (typeof window !== 'undefined') {
  window.PastryExport = {
    EXPORT_COLUMNS,
    escapeCSVCell,
    generateCSV,
    exportToCSV,
    exportToXLSX,
    formatAsTSV,
    copyToClipboard
  };
}

