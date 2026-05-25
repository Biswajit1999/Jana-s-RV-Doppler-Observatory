# Upgrade Roadmap — Jana's RV Doppler Observatory

## Implemented in v3

1. Full-stack-ready architecture.
2. Python FastAPI backend proxy in `backend/`.
3. `/api/health` endpoint.
4. `/api/target?name=...` endpoint.
5. `/api/nasa-tap?query=...` endpoint.
6. NASA Exoplanet Archive TAP proxy route.
7. Frontend API Base URL configuration.
8. Backend status checker.
9. Live target fetch button.
10. Fallback local target cache.
11. Day/night theme toggle.
12. Persistent theme preference through localStorage.
13. Animated canvas starfield background.
14. Mission-control style hero console.
15. Real RV upload workflow retained.
16. Period scan retained.
17. Phase fold retained.
18. First-pass Keplerian fit retained.
19. O−C residuals retained.
20. Window function retained.
21. Activity diagnostics retained.
22. Markdown report export retained.
23. JSON session export retained.
24. Target-aware archive links retained.

## Next backend upgrades

1. Add SIMBAD/Sesame resolver endpoint.
2. Add Gaia TAP cone-search endpoint.
3. Add MAST target search endpoint.
4. Add VizieR cone-search endpoint.
5. Add DACE-compatible routing adapter where stable endpoints exist.
6. Add cache headers and in-memory caching.
7. Add SQLite/PostgreSQL metadata cache.
8. Add request logging and structured error JSON.
9. Add rate limiting.
10. Add OpenAPI examples for each endpoint.

## Next science upgrades

1. Replace browser GLS with Astropy-validated backend GLS.
2. Add bootstrap false-alarm probabilities.
3. Add non-linear least-squares Keplerian fitting.
4. Add per-instrument jitter terms.
5. Add multi-planet model support.
6. Add MCMC posterior sampling with emcee/RadVel-style workflows.
7. Add activity-aware Gaussian-process modelling.
8. Add RV-photometry period comparison.
9. Add Gaia astrometry context panel.
10. Add line-by-line RV diagnostic roadmap.

## Next UI upgrades

1. Add plot export buttons for every chart.
2. Add query history panel.
3. Add multi-target workspaces.
4. Add session timeline.
5. Add target comparison mode.
6. Add ADQL advanced editor.
7. Add loading skeletons and toast notifications.
8. Add keyboard shortcuts.
9. Add mobile-optimised compact mode.
10. Add PDF report export.
