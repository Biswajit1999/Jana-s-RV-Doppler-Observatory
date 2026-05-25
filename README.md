# Jana's RV Doppler Observatory

A browser-based radial-velocity exoplanet console built around target context, Doppler time-series analysis, archive navigation, activity checks and session-level reporting.

The project is designed as a compact research interface for exploring the workflow behind radial-velocity exoplanet science: target identification, RV data upload, period search, first-pass Keplerian fitting, residual inspection and activity-aware interpretation.

---

## Why this name?

**Jana Doppler Observatory** uses the author's surname and the physical principle behind the radial-velocity method. It avoids institutional or community-wide naming such as EPRV while keeping the scientific purpose clear.

---

## Current Interface

The application is organised as a mission-control style dashboard with seven modules:

- Dashboard
- Target Console
- RV Laboratory
- Activity
- Archive Hub
- Jitter Lab
- Report

The aim is to reduce the need to jump across many unrelated pages during early-stage RV exploration. Metadata, RV diagnostics and archive routing sit together in one target-centred workspace.

---

## Main Capabilities

### Target Console

The target console provides a compact identity block for demonstration systems, including:

- target and host name,
- RA and Dec,
- spectral type,
- visual magnitude,
- parallax,
- distance,
- planet period,
- RV semi-amplitude,
- minimum mass context.

Current demonstration targets include:

- 51 Pegasi b,
- HD 189733 b,
- Proxima Centauri b,
- Barnard's Star RV candidate context.

### Sky Crosshair View

The dashboard includes a canvas-based target view inspired by observatory acquisition displays. It is a visual target locator and not a replacement for a calibrated sky survey image.

### RV Laboratory

The RV laboratory accepts local CSV, TXT or DAT files.

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

Optional columns:

```text
BIS
FWHM
```

Example format:

```text
BJD,RV,RV_ERR,INSTRUMENT,BIS,FWHM
2451500.123,55.9,1.2,HARPS,-32.4,7210.5
2451504.234,-52.1,1.1,HARPS,28.7,7208.3
```

### Period Search

The dashboard includes a browser-side Lomb-Scargle-style period scan for irregular RV time series. It displays the strongest candidate period and updates the phase-folded view.

### Keplerian First-Pass Fit

The fit tool performs a simple grid search around:

- orbital period,
- semi-amplitude,
- eccentricity,
- argument of periastron,
- phase reference,
- instrument offsets.

The output is intended for quick exploration, not publication-level orbital inference.

### Residuals

The dashboard plots observed-minus-computed residuals after fitting so that the user can inspect whether additional structure remains in the data.

### Activity Diagnostics

If BIS or FWHM columns are provided, the dashboard compares RV values against those line-shape indicators and reports a simple activity-risk flag.

### Archive Hub

The archive panel provides target-aware routing to major astronomical services, including:

- NASA Exoplanet Archive,
- DACE,
- SIMBAD,
- MAST,
- ESA Gaia Archive,
- VizieR.

The current version uses direct archive links. Future versions can add API/TAP queries.

### Jitter Lab

The Jitter Lab is a prototype interface for future stellar-activity modelling concepts:

- time-domain fusion,
- line-response mapping,
- activity-sensitive channel separation,
- clean residual estimation.

### Report Module

The report panel generates a compact text summary of:

- target identity,
- planet context,
- current dataset,
- fitted period,
- residual RMS,
- recommended next analysis steps.

---

## Core Equations

### Doppler Shift

```text
Δλ / λ = v_r / c
```

### Radial Velocity Semi-Amplitude

```text
K = (2πG/P)^(1/3) · (m_p sin i)/(m_s + m_p)^(2/3) · 1/sqrt(1 - e²)
```

### Mass Function

```text
f(m) = (m_p sin i)^3/(m_s + m_p)^2
     = P K^3(1 - e²)^(3/2)/(2πG)
```

### Keplerian Radial Velocity Model

```text
RV(t) = K[cos(ω + ν(t)) + e cosω] + γ_inst
```

---

## Repository Structure

```text
jana-doppler-observatory/
├── index.html
├── styles.css
├── app.js
└── README.md
```

No build step is required. The project runs as a static HTML, CSS and JavaScript application.

---

## Running Locally

Clone the repository:

```bash
git clone https://github.com/Biswajit1999/jana-doppler-observatory.git
cd jana-doppler-observatory
```

Open:

```text
index.html
```

or run:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

---

## GitHub Pages Deployment

Use:

```text
Settings → Pages → Deploy from branch → main → /root
```

---

## Technical Stack

- HTML5
- CSS3
- JavaScript
- Plotly.js
- Canvas API
- GitHub Pages

---

## Author

**Biswajit Jana**  
Astrophysics · Radial Velocity · Spectrograph Instrumentation · Scientific Computing

---

## Project Status

Active interface prototype. Current focus: target-centred GUI design, browser-based RV workflow, archive routing and activity-diagnostic visualisation.
