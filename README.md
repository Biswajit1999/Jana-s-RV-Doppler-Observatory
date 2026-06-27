# Jana's RV Doppler Observatory

A full-stack-ready radial-velocity exoplanet observatory console for target context, live archive metadata, real RV upload analysis, weighted period scans, Keplerian first-pass fitting, activity diagnostics, archive routing, and reproducible session reports.

Live site:

```text
https://biswajit1999.github.io/Jana-s-RV-Doppler-Observatory/
```

---

## v3.1 scientific guard

The observatory remains an interactive research-visualisation and first-pass screening tool. It now makes the analysis boundary explicit in the interface, reports, documentation, and CI:

- multiple-instrument period scans centre each instrument by its weighted mean before the scan;
- the periodogram alert lines are labelled as analytic screening levels, not calibrated false-alarm probabilities;
- coarse Keplerian grid results are labelled as initial models, not posterior orbital solutions;
- RV/activity correlation is marked as heuristic rather than causal attribution;
- upload, parser, VOTable, source-host, and browser-script checks are covered in GitHub Actions.

Read [`docs/analysis-boundaries.md`](docs/analysis-boundaries.md) before treating a candidate period as astrophysical evidence.

---

## v3 upgrade

This release upgrades the project from a purely static catalogue-first prototype into a **frontend + optional Python backend** architecture.

The GitHub Pages frontend still runs fully as a static website. Target search works there from a bundled, auditable NASA TAP-derived snapshot, and the interface also has an API-base configuration field. When a FastAPI backend is running, the website can fetch live target metadata from a server-side archive proxy instead of calling astronomy services directly from the browser.

This avoids browser CORS failures while keeping the web interface fast and deployable.

---

## Main features

- Mission-control UI with day/night theme and restrained animated canvas context.
- Live backend API configuration field.
- Python FastAPI archive proxy in `backend/`.
- Static 2,000-row NASA TAP-derived target snapshot for GitHub Pages.
- NASA Exoplanet Archive TAP query proxy.
- Live target fetch endpoint: `/api/target?name=...`.
- Real RV data ingestion through uploads, backend imports, and the bundled local library.
- CSV/TXT/DAT/VOTable-style normalization through the backend.
- RV validation summary and data preview table.
- Instrument-separated RV time series and sampling window plot.
- Weighted first-pass period scan with transparent alert-line caveats.
- Phase-folded RV plot and coarse Keplerian initial fit.
- O−C residual plot.
- BIS/FWHM/S-index/H-alpha activity triage.
- Markdown report and JSON session export.
- Target-aware links to NASA Archive, SIMBAD, Gaia, MAST, VizieR, DACE, and Open Exoplanet Catalogue.

---

## Frontend

The frontend is static and can be hosted on GitHub Pages.

```text
index.html
styles.css
app.js
app_science_guard.js
app_local_rv_library.js
data/catalog-metadata.json
data/rv-planets.json
sample_data/rv_template.csv
sample_data/rv_library/manifest.json
sample_data/rv_library/jana_rv_web_target_index.json
sample_data/rv_library/data/*.csv
```

No frontend build step is required.

The bundled target catalog in `data/rv-planets.json` was retrieved from the NASA Exoplanet Archive TAP service on 2026-05-24. It selects default planetary-system records with `rv_flag = 1`, reported periods and positive measured RV semi-amplitudes; exact query provenance is recorded in `data/catalog-metadata.json`.

The Local RV Library tab serves a website-ready bundle of 250 targets from NASA_RADIAL and DACE_PUBLIC sources. Its source and bundle metadata are recorded in `sample_data/rv_library/manifest.json`.

---

## Backend

The backend is optional but recommended for live archive metadata and machine-readable RV imports.

```text
backend/main.py
backend/requirements.txt
backend/tests/test_rv_pipeline.py
```

`python-multipart` is declared because the FastAPI upload routes require multipart form support.

Run locally:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Then set the API Base URL in the website:

```text
http://127.0.0.1:8000
```

Health check:

```text
http://127.0.0.1:8000/api/health
```

Target fetch example:

```text
http://127.0.0.1:8000/api/target?name=51%20Pegasi%20b
```

Run the repository checks from the project root:

```bash
for file in app.js app_*.js; do node --check "$file"; done
PYTHONPATH=. python -m pytest -q backend/tests
```

---

## RV file format

Required columns:

```text
BJD or Time
RV
```

Recommended columns:

```text
RV_ERR
INSTRUMENT
```

Optional activity columns:

```text
BIS
FWHM
SINDEX
HALPHA
```

Example:

```text
BJD,RV,RV_ERR,INSTRUMENT,BIS,FWHM,SINDEX,HALPHA
2450000.123,0.0,1.0,HARPS,,,,
```

The console does not convert time scales, verify velocity reference frames, apply barycentric corrections, or infer calibration provenance. Record those details with each uploaded data set.

---

## Why a backend is needed

Many astronomical services are designed for TAP clients, PyVO, astroquery, TOPCAT or server-side requests. A browser-only GitHub Pages site can be blocked by CORS or remote service policy. The bundled snapshot makes static target search reliable; the FastAPI backend provides current live archive results by making requests server-side and returning clean JSON to the frontend.

---

## Production direction

Recommended deployment path:

- GitHub Pages for the static frontend.
- Cloud Run / Render / Railway / Fly.io for the FastAPI backend.
- Optional cache/database layer for repeated archive calls.
- A versioned Python science workflow for full likelihood-based fitting, offsets/jitter, false-alarm methodology, posterior sampling, and correlated-noise models.

---

## Author

**Biswajit Jana**  
Astrophysics · Radial Velocity · Spectrograph Instrumentation · Scientific Computing
