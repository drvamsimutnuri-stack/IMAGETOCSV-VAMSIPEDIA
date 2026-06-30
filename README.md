# PFT Report Extractor

Static web app to extract **Body Plethysmography** table data from pulmonary function test (PFT) reports (PDF, PNG, JPG) and export to CSV or XLSX.

Runs entirely in your browser — no backend, no Google AI Studio hosting. Deploy to **GitHub Pages** for a public URL.

This project is **not** part of LUNG GYM.

## Features

- Drag-and-drop multi-file upload (PDF, PNG, JPG)
- AI-powered table extraction via Google Gemini Vision API (called directly from your browser)
- Per-file extraction status and editable preview tables
- Combined wide-format export: one row per report, columns like `TGV_pred`, `TGV_pre`, `TGV_pct_pred`, etc.
- Metadata columns: `filename`, `test_type`, `extraction_date`
- API key stored locally in your browser only (`localStorage`)

## Get a Gemini API Key

1. Open [Google AI Studio — API keys](https://aistudio.google.com/apikey).
2. Sign in with your Google account.
3. Click **Create API key** and copy the key.
4. Paste it into the app’s **Settings** panel. It is saved only in your browser and sent only to Google’s Gemini API when you click **Process**.

Do **not** use Google AI Studio’s “Share app” / hosted app feature — this project is a standalone static site you host yourself (e.g. on GitHub Pages).

## Deploy to GitHub Pages

### 1. Create a GitHub repository

1. Go to [github.com/new](https://github.com/new).
2. Name the repo (e.g. `pft-report-extractor`).
3. Leave it **Public** (required for free GitHub Pages on personal accounts).
4. Do **not** add a README, `.gitignore`, or license (this repo already has them).
5. Click **Create repository**.

### 2. Push this project

From your machine, in this folder:

```bash
cd /path/to/pft-report-extractor

git add .
git commit -m "Initial static PFT Report Extractor for GitHub Pages"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pft-report-extractor.git
git push -u origin main
```

Replace `YOUR_USERNAME` and the repo name with yours.

### 3. Enable GitHub Pages

1. On GitHub, open your repo → **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, choose **GitHub Actions** (not “Deploy from a branch”).
3. After the first push to `main`, the **Deploy to GitHub Pages** workflow runs automatically.
4. When it finishes (Actions tab → green checkmark), your site is live at:

   **`https://YOUR_USERNAME.github.io/pft-report-extractor/`**

   (Use your exact repo name in the URL path.)

### 4. Use the app

1. Open your GitHub Pages URL.
2. Paste your Gemini API key from [AI Studio](https://aistudio.google.com/apikey).
3. Upload PFT reports, click **Process All**, review/edit tables, then **Export CSV** or **Export XLSX**.

## Local development

### Option A — GitHub Pages URL (simplest)

After deploying, use your live URL. No local server needed.

### Option B — Local static server

ES modules and PDF.js require **http://**, not **file://**. Opening `index.html` directly from the filesystem will fail with module/CORS errors.

```bash
# Python 3 (built in on macOS/Linux)
python3 -m http.server 8080

# Or Node (one-off, no install into project)
npx --yes serve -p 8080
```

Then open **http://localhost:8080**.

## Project structure

```
pft-report-extractor/
├── index.html              # Main UI
├── css/styles.css          # Styles
├── js/
│   ├── app.js              # App logic & UI
│   ├── schema.js           # Body Plethysmography schema
│   ├── gemini.js           # Gemini Vision API (browser → Google)
│   ├── pdf.js              # PDF → image (pdf.js CDN)
│   └── export.js           # CSV & XLSX export
├── .github/workflows/
│   └── pages.yml           # GitHub Pages deploy
├── .nojekyll               # Skip Jekyll on GitHub Pages
└── README.md
```

All asset paths are **relative** (`css/…`, `js/…`, `./module.js`), so the app works at `https://user.github.io/repo-name/` without a build step.

## Usage notes

### Supported test type (Phase 1)

Only **Body Plethysmography** tables are extracted. Reports with multiple test sections are supported — the AI is instructed to find the Body Plethysmography section only.

### Extracted parameters (13 rows)

| Parameter | Unit |
|-----------|------|
| Raw tot | kPa*s/L |
| sRaw tot | kPa*s |
| Gaw tot | L/s/kPa |
| TGV | L |
| ERV | L |
| RV | L |
| TLC | L |
| RV%TLC | % |
| TGV%TLC | % |
| FEV 1 | L |
| VC MAX | L |
| VT | L |
| FRC | L |

### Export format (wide)

Each processed report becomes one row:

```
filename, test_type, extraction_date,
Raw_tot_pred, Raw_tot_pre, Raw_tot_pct_pred, Raw_tot_lln, Raw_tot_zscore,
sRaw_tot_pred, ...
```

### PDF handling

PDFs are converted to images in the browser using [pdf.js](https://mozilla.github.io/pdf.js/) (loaded from CDN). Each page is sent to Gemini; the first page containing a Body Plethysmography table is used.

## Privacy

- Your API key is stored in **browser localStorage** only — never on any server.
- Report files are processed **entirely in your browser**.
- Images are sent directly to **Google’s Gemini API** when you click Process.
- No backend, no analytics, no data collection by this app.

## Limitations (Phase 1)

- Body Plethysmography only — other PFT test types are not extracted.
- Extraction quality depends on report layout and scan quality; always review before export.
- Multi-page PDFs: each page is tried until a table is found.
- Requires internet for Gemini API and CDN libraries (pdf.js, SheetJS).
- Not validated for clinical use — for research/data entry assistance only.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Blank page / module errors | Do not use `file://`; use GitHub Pages URL or a local http server |
| 404 on GitHub Pages | Confirm Pages source is **GitHub Actions** and workflow succeeded |
| API key error | Verify key at [AI Studio](https://aistudio.google.com/apikey) |
| Table not found | Try a clearer scan; edit the empty template manually |
| CORS / network error | Check firewall; Gemini API must be reachable from your browser |

## License

MIT
