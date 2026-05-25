# Jana's RV Doppler Observatory

A full-stack-ready radial-velocity exoplanet observatory console for target context, live archive metadata, real RV upload analysis, period scans, Keplerian first-pass fitting, activity diagnostics, archive routing and reproducible session reports.

Live site:

```text
https://biswajit1999.github.io/Jana-s-RV-Doppler-Observatory/
```

---

## v3 upgrade

This release upgrades the project from a purely static catalogue-first prototype into a **frontend + optional Python backend** architecture.

The GitHub Pages frontend still runs fully as a static website. Target search works there from a bundled, auditable NASA TAP-derived snapshot, and the interface also has an API-base configuration field. When a FastAPI backend is running, the website can fetch live target metadata from a server-side archive proxy instead of calling astronomy services directly from the browser.

This avoids browser CORS failures while keeping the web interface fast and deployable.

---

## Main features

- Jaw-dropping mission-control UI refresh.
- Animated canvas starfield background.
- Persistent day/night theme toggle.
- Live backend API configuration field.
- Python FastAPI archive proxy in `backend/`.
- Static 2,000-row NASA TAP-derived target snapshot for GitHub Pages.
- NASA Exoplanet Archive TAP query proxy.
- Live target fetch endpoint: `/api/target?name=...`.
- Real RV data upload only.
- CSV/TXT/DAT parser for RV time series.
- RV validation summary.
- Data preview table.
- RV time-series plotting.
- Period scan.
- Phase-folded RV plot.
- First-pass Keplerian grid fit.
- O−C residual plot.
- Sampling window-function plot.
- BIS/FWHM/S-index/H-alpha activity checks.
- Markdown report export.
- JSON session export.
- Target-aware links to NASA Archive, SIMBAD, Gaia, MAST, VizieR, DACE and Open Exoplanet Catalogue.

---

## Frontend

The frontend is static and can be hosted on GitHub Pages.

```text
index.html
styles.css
app.js
data/catalog-metadata.json
data/rv-planets.json
sample_data/rv_template.csv
```

No frontend build step is required.

The bundled target catalog in `data/rv-planets.json` was retrieved from the NASA Exoplanet Archive TAP service on 2026-05-24. It selects default planetary-system records with `rv_flag = 1`, reported periods and positive measured RV semi-amplitudes; exact query provenance is recorded in `data/catalog-metadata.json`.

---

## Backend

The backend is optional but recommended for live archive metadata.

```text
backend/main.py
backend/requirements.txt
```

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

---

## Why a backend is needed

Many astronomical services are designed for TAP clients, PyVO, astroquery, TOPCAT or server-side requests. A browser-only GitHub Pages site can be blocked by CORS or remote service policy. The bundled snapshot makes static target search reliable; the FastAPI backend provides current live archive results by making requests server-side and returning clean JSON to the frontend.

---

## Production direction

Recommended deployment path:

- GitHub Pages for the static frontend.
- Cloud Run / Render / Railway / Fly.io for the FastAPI backend.
- Optional cache/database layer for repeated archive calls.
- Future Python science endpoints for Astropy, RadVel, MCMC and Gaussian-process modelling.

---

## Author

**Biswajit Jana**  
Astrophysics · Radial Velocity · Spectrograph Instrumentation · Scientific Computing
