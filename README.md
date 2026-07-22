# FDA 510(k) Biomarker Search

A single-file, no-build-step web app for looking up FDA 510(k) device clearances by biomarker. It queries the public [openFDA device 510(k) API](https://open.fda.gov/apis/device/510k/) directly from the browser, visualizes the results, and can export everything to Excel.

## Usage

1. Download or clone this repo.
2. Open [`FDA510kBiomarkerSearch.html`](FDA510kBiomarkerSearch.html) directly in a browser (double-click the file — no server or install required).
3. In the **Biomarkers** box, enter one biomarker per line or comma-separated, e.g.:
   ```
   HbA1c
   Troponin
   PSA
   BNP
   ```
4. Click **Search**. Each biomarker is matched against FDA device name and 510(k) summary text (openFDA has no dedicated "biomarker" field, so this text match is the practical approach).
5. Review the results:
   - The **chart** shows cleared vs. not-cleared submission counts per biomarker.
   - The **results table** lists, per biomarker: total submissions, cleared (approved) count, and not-cleared count.
   - Click a row to expand it and see each individual product: device name, submitted by (applicant), decision, approve date, and a link to the official FDA detail page.
6. Click **Export to Excel** to download an `.xlsx` workbook with two sheets:
   - **Summary** — one row per biomarker with totals.
   - **Details** — one row per matched product across all biomarkers.

### Optional: API key

By default, requests are unauthenticated and limited to 1,000 requests/day (shared across your network). Click the gear icon in the header to add a free [openFDA API key](https://open.fda.gov/apis/authentication/), which raises the limit to 120,000 requests/day. The key is stored only in your browser's local storage.

## Notes on the data

- **"Cleared" / "Approved"** refers to FDA's "Substantially Equivalent" 510(k) clearance decision — the standard outcome for a cleared device in this dataset.
- Results are capped at 300 submissions per biomarker to bound the number of API calls; if a biomarker has more matches, the total is still shown but only the first 300 records are listed/exported.
- This tool is for research and informational purposes only. Per openFDA's terms, do not rely on it to make decisions regarding medical care — always verify against the [FDA's own database](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPMN/pmn.cfm) for anything consequential.

## Tech

Plain HTML/CSS/JS, no build tooling. Uses [Chart.js](https://www.chartjs.org/) for the chart and [SheetJS](https://sheetjs.com/) for Excel export, both loaded from CDN.
