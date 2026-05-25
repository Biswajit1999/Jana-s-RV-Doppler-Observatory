# Jana's RV Doppler Observatory

A real-data-first radial-velocity exoplanet console for target context, archive queries, RV upload analysis, activity diagnostics and reproducible session reports.

Live site:

```text
https://biswajit1999.github.io/Jana-s-RV-Doppler-Observatory/
```

## Version 2.1 update

This build fixes the static-site API issue visible on GitHub Pages. Direct browser requests to archive services can fail because of CORS or network policy. The console now handles that cleanly: no blocking popup, no broken blank state, and a target context fallback is shown while preserving the live TAP URL for verification.

The workflow remains real-data-first: RV plots and fits appear only after an uploaded RV file is loaded.

## Main modules

- **Overview** — target context, sky crosshair, RV panels and data-readiness status.
- **Target/API** — NASA Exoplanet Archive TAP query builder, ADQL editor, TAP URL generation and result table.
- **RV Data** — local CSV/TXT/DAT ingestion with validation and preview.
- **Analysis** — period scan, phase fold, Keplerian first-pass fit, residuals and window function.
- **Activity** — RV correlation against BIS, FWHM, S-index or H-alpha if provided.
- **Archive Hub** — target-aware links to NASA Exoplanet Archive, TAP, SIMBAD, MAST, Gaia and VizieR.
- **Report** — exportable Markdown-style session report.
- **Build Plan** — 80 staged upgrades toward a production research platform.

## CSV format

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

## Production backend path

GitHub Pages is static, so direct browser API calls may not always be reliable. The next robust version should use a small backend proxy for archive services and a Python science backend for validated analysis. This package includes backend starter files under `backend/`.

Recommended stack:

- static frontend on GitHub Pages / Cloudflare Pages / Netlify,
- serverless or FastAPI proxy for NASA/SIMBAD/MAST/Gaia calls,
- Python science backend for Astropy/RadVel/MCMC tools,
- cache layer for repeated target metadata,
- CI tests for parser, ADQL builder and plotting workflows.

## Author

**Biswajit Jana**  
Astrophysics · Radial Velocity · Spectrograph Instrumentation · Scientific Computing
