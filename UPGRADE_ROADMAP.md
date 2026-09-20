# Upgrade roadmap

## Implemented in v4.0.0

- full 250-file inference-readiness audit with per-file and bundle hashes;
- fail-closed gates for bundled targets requiring curation;
- tested weighted, instrument-centered candidate-period scan;
- analytic amplitude and instrument-offset solution inside the bounded Kepler grid;
- removal of unsupported FAP claims;
- deterministic JSON/CSV/SVG evidence and freshness checks;
- Python and JavaScript regression tests plus immutable CI;
- redirect-aware remote allowlist, streamed response limit, upload cap, and SELECT-only TAP proxy;
- result-first live evidence panel, methods, claims, limitations, citation, and release metadata.

## Next data-curation work

1. Recover source instrument and reduction-pipeline identifiers per row.
2. Reconcile RV and uncertainty units against each source publication.
3. Declare time scale and frame (for example BJD_TDB) per source.
4. Identify non-independent re-publications and choose one canonical representation.
5. Preserve source row identifiers and raw-file hashes in the normalized table.
6. Publish a curated subset as a separate evidence release rather than silently replacing v4.0.0.

## Next science validation

1. Cross-check the browser scan against Astropy LombScargle at fixed benchmark grids.
2. Add cadence-preserving bootstrap or Baluev FAP behind an explicit null model.
3. Fit instrument jitter and long-term trends.
4. Add posterior sampling and model comparison in the Python backend.
5. Add multi-signal and correlated stellar-activity models.
6. Validate selected curated targets against published orbital solutions.

## Next operations work

1. Require authentication for mutation/cache-building endpoints.
2. Add rate limits, structured logging, monitoring, and infrastructure egress controls.
3. Pin a deployment image and publish an SBOM.
4. Add integration tests with mocked redirects and oversized streams/uploads.
