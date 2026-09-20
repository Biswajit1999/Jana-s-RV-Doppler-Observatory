# Changelog

## [4.1.0] - 2026-09-20

### Added

- a precision-instrument design system with dark and light semantic tokens;
- semantic SVG navigation, visible keyboard focus, a skip link, and an accessible mobile menu;
- reduced-motion-aware view transitions and a deterministic interface contract audit;
- machine-readable interface audit CSV/JSON, reproducibility notes, and a before/after graph.

### Changed

- replaced the animated neon mission-control skin with a restrained, high-contrast scientific workspace;
- clarified the dashboard sequence as context → evidence → inference → diagnostics;
- restyled Plotly traces, grids, controls, status badges, evidence cards, and responsive layouts;
- removed the continuously animated starfield runtime while preserving the target coordinate field.

### Scientific boundary

- this release changes presentation and interaction only; the v4.0 numerical methods, observational audit, inference gates, and scientific claims are unchanged.

## [4.0.0] - 2026-09-20

### Added

- deterministic 250-file, 154,150-row RV library quality audit;
- per-file and bundle SHA-256 evidence, JSON/CSV products, and comparison graph;
- fail-closed library analysis gates and reviewer-facing live evidence panel;
- tested multi-instrument numerical core and analytic amplitude/offset Kepler grid;
- science, evidence, backend, and generated-product tests;
- methods, claims, maturity audit, citation, and code license.

### Changed

- instrument zero points are retained and removed per group before period scanning;
- periodogram output is explicitly descriptive and no longer displays unsupported FAP thresholds;
- uncertainty parsing rejects invalid/non-positive declared values;
- backend remote fetching revalidates redirects and enforces streamed/upload byte caps;
- public TAP proxy accepts a single SELECT query only.

### Removed

- forced-zero reference-instrument offset;
- five-point semi-amplitude multiplier search;
- naive independent-frequency FAP display.
