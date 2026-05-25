# Jana's RV Doppler Observatory

A catalogue-first, real-data radial-velocity exoplanet console for target context, RV upload analysis, period scans, Keplerian first-pass fitting, activity diagnostics, archive routing and reproducible session reports.

Live site:

```text
https://biswajit1999.github.io/Jana-s-RV-Doppler-Observatory/
```

---

## v2.2 direction

This version is designed specifically for stable GitHub Pages deployment.

The previous direct browser call to NASA TAP was removed as the primary workflow because static browser deployments can be blocked by CORS or network policy. This build uses a stable bundled reference catalogue for target context and opens public archives through target-aware links.

RV plots and fitting still require real uploaded RV data.

---

## Key features

- Stable catalogue-first target resolver.
- No browser fetch error popups.
- Target-aware links to NASA Exoplanet Archive, SIMBAD, MAST, Gaia, VizieR, DACE and Open Exoplanet Catalogue.
- Real RV data upload only.
- CSV/TXT/DAT parser.
- RV validation summary.
- Data preview table.
- RV time-series plot.
- Period scan.
- Phase-folded RV plot.
- First-pass Keplerian grid fit.
- O−C residual plot.
- Sampling window-function plot.
- BIS/FWHM/S-index/H-alpha activity checks.
- Markdown report export.
- JSON session export.
- Roadmap cards for backend and production science upgrades.

---

## RV file format

Required columns:

```text
BJD or Time
RV
```

Recommended:

```text
RV_ERR
INSTRUMENT
```

Optional:

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

## Repository structure

```text
Jana-s-RV-Doppler-Observatory/
├── index.html
├── styles.css
├── app.js
├── README.md
├── UPGRADE_ROADMAP.md
└── sample_data/
    └── rv_template.csv
```

---

## Deployment

Use GitHub Pages:

```text
Settings → Pages → Deploy from branch → main → /root
```

---

## Production roadmap

The next major step is a backend proxy and science service:

- serverless archive proxy for NASA/SIMBAD/Gaia/MAST,
- Python FastAPI backend,
- PyVO / Astroquery integration,
- Astropy-validated Lomb-Scargle,
- RadVel or equivalent fitting,
- optional MCMC/GP modelling,
- database/cache for metadata and sessions.

---

## Author

**Biswajit Jana**  
Astrophysics · Radial Velocity · Spectrograph Instrumentation · Scientific Computing
