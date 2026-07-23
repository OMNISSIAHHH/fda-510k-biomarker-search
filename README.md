# FDA 510(k) Biomarker Search

A single-file, no-build-step web app for looking up FDA 510(k) device clearances by biomarker. It queries the public [openFDA device 510(k) API](https://open.fda.gov/apis/device/510k/) directly from the browser, visualizes the results, and can export everything to Excel. It can also search NY State's Laboratory Developed Test (LDT) database as a second, independent search mode — see [LDT search](#ldt-search-ny-state) below.

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

## LDT search (NY State)

Switch to the **LDT (NY State)** tab (next to **FDA 510(k)**, above the biomarker box) to search NY State Wadsworth Center's CLEP "Approved Laboratory Developed Tests" database instead — useful for seeing whether a biomarker with no FDA clearance is nonetheless being offered as a lab-developed test.

This requires a one-time setup step: that site has no CORS support, so a browser can't read its results directly from this tool's JavaScript. A small proxy Worker bridges the gap — see [`worker/README.md`](worker/README.md) for the ~5-minute, no-CLI deploy steps (paste code into the Cloudflare dashboard, no local Node/wrangler needed). Once deployed, paste the Worker's URL into **Settings** (gear icon) → **LDT proxy Worker URL**.

After an **FDA 510(k)** search, if any biomarkers show 0 cleared products, a button appears offering to check all of them against the LDT database in one pass — a quick way to see whether "no FDA clearance" actually means "no test exists" or just "it's offered as an LDT instead."

LDT results show the same key fields as the NY tool itself: facility, matched analyte name, specimen type, permit category, approval status, and a link to the full record.

## Notes on the data

- **"Cleared" / "Approved"** refers to FDA's "Substantially Equivalent" 510(k) clearance decision — the standard outcome for a cleared device in this dataset.
- Results are capped at 300 submissions per biomarker to bound the number of API calls; if a biomarker has more matches, the total is still shown but only the first 300 records are listed/exported.
- This tool is for research and informational purposes only. Per openFDA's terms, do not rely on it to make decisions regarding medical care — always verify against the [FDA's own database](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPMN/pmn.cfm) for anything consequential.

## Tech

Plain HTML/CSS/JS, no build tooling. Uses [Chart.js](https://www.chartjs.org/) for the chart and [SheetJS](https://sheetjs.com/) for Excel export, both loaded from CDN.
