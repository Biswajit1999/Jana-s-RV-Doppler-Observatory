# Jana's RV Doppler Observatory

A real-data-first radial-velocity exoplanet console for target context, archive queries, RV upload analysis, activity diagnostics and reproducible session reports.

Live site after GitHub Pages deployment:

```text
https://biswajit1999.github.io/Jana-s-RV-Doppler-Observatory/
```

## What changed in v2

This version removes generated/synthetic RV curves from the workflow. The platform now starts in real-data mode:

- target metadata is fetched from NASA Exoplanet Archive TAP where browser access is available,
- RV curves appear only after the user uploads an RV file,
- the archive hub generates target-aware links,
- reports record the target, data source, period scan and fit summary,
- the build plan tab shows the route from static site to production backend.

## Current capabilities

### NASA Exoplanet Archive TAP query

The Target/API tab builds and runs ADQL queries against the NASA Exoplanet Archive TAP service. It retrieves target/system fields such as planet name, host name, discovery method, RA/Dec, distance, spectral type, V magnitude, orbital period, RV semi-amplitude, eccentricity, mass and semi-major axis where available.

### Advanced ADQL console

The user can edit and run a custom ADQL query directly inside the page. Results appear in a table and can be downloaded as CSV.

### Real RV upload

The RV Data tab accepts CSV/TXT/DAT files.

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

### Dataset validation

The app validates the uploaded file and reports row count, time baseline, instruments, uncertainty availability and activity-column availability.

### RV analysis

The Analysis tab includes RV time-series plotting, instrument-coloured traces, uncertainty bars, period scan, phase fold, first-pass Keplerian grid fit, residual plot and sampling window function.

### Activity diagnostics

The Activity tab checks RV correlation with available activity indicators: BIS, FWHM, S-index and H-alpha.

### Archive hub

The Archive Hub creates target-aware links for NASA Exoplanet Archive, NASA TAP query, SIMBAD, MAST, Gaia Archive and VizieR.

### Report export

The Report tab generates a Markdown-style session report and allows copying or downloading.

## Repository structure

```text
Jana-s-RV-Doppler-Observatory/
├── index.html
├── styles.css
├── app.js
├── README.md
└── UPGRADE_ROADMAP.md
```

No build step is required for the current static version.

## Running locally

```bash
git clone https://github.com/Biswajit1999/Jana-s-RV-Doppler-Observatory.git
cd Jana-s-RV-Doppler-Observatory
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Important production note

Some public archive endpoints may block direct browser requests through CORS or may need controlled access to avoid rate-limit issues. The current site is designed to work as a static front end, but the production version should add a small backend proxy layer for stable API calls, caching and long-running analysis.

Recommended production stack:

- static frontend on GitHub Pages / Netlify / Cloudflare Pages,
- serverless API proxy for NASA/SIMBAD/MAST/Gaia requests,
- Python science backend for Astropy/RadVel/MCMC/GP tools,
- PostgreSQL or object storage for cached metadata and uploaded datasets,
- GitHub Actions for CI/CD.

## Author

**Biswajit Jana**  
Astrophysics · Radial Velocity · Spectrograph Instrumentation · Scientific Computing
