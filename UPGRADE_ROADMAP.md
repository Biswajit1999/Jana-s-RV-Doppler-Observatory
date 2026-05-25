# Upgrade Roadmap — Jana's RV Doppler Observatory

This roadmap converts the static console into a production-grade, API-driven radial-velocity research platform.

## Implemented in v2

1. Real-data-first workflow.
2. Removed generated RV curves.
3. NASA Exoplanet Archive TAP query builder.
4. Advanced ADQL console.
5. TAP results table.
6. TAP result CSV export.
7. Target metadata population from archive results.
8. RV upload parser.
9. Data validation summary.
10. Data preview table.
11. RV time-series plot.
12. Period scan.
13. Phase-folded view.
14. Keplerian first-pass fit.
15. O−C residuals.
16. Window-function plot.
17. Activity indicator detection.
18. RV-activity correlation plot.
19. Activity triage text.
20. Target-aware archive links.
21. Session report export.
22. Session JSON export.
23. CSV template export.
24. Build-plan tab in the interface.

## Next production upgrades

### Data layer

1. SIMBAD/Sesame resolver.
2. NASA aliases service integration.
3. NASA pscomppars table adapter.
4. NASA stellarhosts table adapter.
5. Gaia TAP cone search adapter.
6. MAST target identifier adapter.
7. MAST TESS light-curve preview.
8. VizieR cone-search adapter.
9. DACE target routing adapter.
10. ExoFOP target routing for TIC/KIC IDs.
11. Local IndexedDB archive cache.
12. Server-side metadata cache.
13. Data provenance schema.
14. Citation metadata for every imported value.
15. Upload manifest with file hash.

### Analysis layer

16. Astropy-validated Lomb-Scargle.
17. Bootstrap false-alarm probabilities.
18. Window-function alias ranking.
19. Multi-period pre-whitening.
20. Generalised multi-instrument offsets.
21. Per-instrument jitter terms.
22. Non-linear least-squares Keplerian fit.
23. Bayesian/MCMC fitting backend.
24. Multi-planet Keplerian model.
25. BIC/AIC model comparison.
26. Gaussian-process activity model.
27. Quasi-periodic kernel support.
28. Outlier flagging and robust regression.
29. Time-bin and nightly-zero-point tools.
30. Residual autocorrelation diagnostics.
31. RV-activity matrix.
32. BIS/FWHM/S-index/H-alpha combined panel.
33. Photometry-RV period comparison.
34. Gaia astrometry context panel.
35. Chromatic RV diagnostic design.
36. Line-by-line RV prototype.

### UI layer

37. API status dashboard.
38. Query history panel.
39. Multi-target session tabs.
40. Multi-dataset comparison mode.
41. Plot export buttons.
42. Table search and filters.
43. Unit switching.
44. Better mobile navigation.
45. Keyboard-accessible controls.
46. Customisable plot theme.
47. Report PDF export.
48. Notebook export.
49. Saved session import/export.
50. Help overlay and glossary.

### Infrastructure layer

51. Serverless API proxy.
52. Python FastAPI science backend.
53. Redis/API response cache.
54. PostgreSQL project database.
55. Object storage for optional uploads.
56. OAuth login for saved projects.
57. User project workspace.
58. Rate limiting.
59. CORS/CSP configuration.
60. Input sanitisation.
61. GitHub Actions CI.
62. Unit tests for parser and math functions.
63. Browser E2E tests.
64. Lighthouse performance audit.
65. Error logging.
66. API latency monitoring.
67. Containerised backend.
68. Cloud deployment templates.
69. OpenAPI documentation.
70. Versioned releases.

### Science-growth layer

71. Real published RV examples.
72. HARPS/ESPRESSO public-spectrum route.
73. Cross-match with activity catalogues.
74. Stellar rotation-period database link.
75. Telluric diagnostic layer.
76. RV precision budget panel.
77. Instrument comparison mode.
78. Survey-mode target table.
79. Automated candidate triage score.
80. Literature-reference panel.
