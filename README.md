# RV Exoplanet Observatory

**The most complete browser-based radial velocity exoplanet platform.**  
Live NASA archive · Keplerian simulation · Statistical atlas · Instrument comparison

🌐 **[Open Live Observatory →](https://biswajit1999.github.io/rv-exoplanet-observatory/)**

---

## What it does

| Module | Description |
|---|---|
| **Home** | Live stat counters pulled from NASA Exoplanet Archive in real time |
| **Archive** | Full searchable/sortable table of all confirmed RV planets — click any row to load its real parameters into the simulator |
| **Simulate** | WebGL2 Doppler-shifted stellar spectrum + Keplerian orbital mechanics — works with real planet data |
| **Atlas** | Mass–period diagram, discovery timeline, eccentricity distribution, K-amplitude histogram |
| **Instruments** | HARPS · HIRES · ESPRESSO · CORALIE specs, detection-limit calculator |

## Science

The radial velocity (RV) method detects exoplanets by measuring the Doppler wobble they induce in their host star. The stellar reflex velocity is:

```
V_r(t) = K [ cos(ω + ν(t)) + e cos(ω) ] + γ
```

where K is the semi-amplitude, solved from full Keplerian orbital mechanics (Newton–Raphson on Kepler's equation). The spectrum is rendered in a WebGL2 fragment shader applying the Doppler shift Δλ/λ = v_r/c to ~40 absorption lines in real time.

## Tech

- Vanilla HTML/CSS/JavaScript — no frameworks, no build step
- WebGL2 fragment shader for the Doppler-shifted spectrum
- Canvas 2D for all statistical charts
- NASA Exoplanet Archive TAP service for live data
- Runs entirely in the browser via GitHub Pages

## Data source

All planet data is fetched live from the  
[NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) TAP service.

## Author

**Biswajit Jana** — Astrophysics · Instrumentation  
[biswajit1999.github.io](https://biswajit1999.github.io/Biswajit_Jana.github.io/)
