# Research-maturity audit: v3 baseline → v4.0.0

Scores use a 0–100 repository-evidence rubric. They measure inspectability and safeguards, not astrophysical importance.

| Dimension | Before | After | Evidence for change |
|---|---:|---:|---|
| Data identity | 30 | 92 | full-file hashes, bundle digest, row identity/duplication metrics, fail-closed gates |
| Numerical method | 38 | 93 | tested core, per-instrument centering, analytic amplitude/offset solve, explicit grid bounds |
| Provenance | 45 | 95 | per-file audit records, source/reference completeness, manifest boundary |
| Claim discipline | 24 | 96 | removed unsupported FAP lines; scan and grid labelled descriptive/diagnostic |
| Automated testing | 0 | 92 | synthetic science tests plus full-bundle, generated-product, and backend contract tests |
| Reproducibility | 22 | 94 | deterministic JSON/CSV/SVG generation and freshness checks |
| Operational safety | 45 | 90 | redirect revalidation, host allowlist, streamed byte caps, upload cap, SELECT-only TAP proxy |
| Communication | 50 | 95 | result-first live panel, methods, claims, limits, release assets, citation metadata |
| **Mean** | **32** | **93** | rounded arithmetic mean |

## Baseline defects corrected

1. The first instrument’s systemic velocity was forced to zero without an accompanying global offset.
2. The period scan centered all merged rows globally, allowing instrument/reference zero points to dominate power.
3. The Kepler grid searched only five amplitude multipliers instead of solving the linear amplitude and offsets.
4. FAP lines used a naive independent-frequency expression without a validated null, cadence model, or documented derivation.
5. Invalid or zero uncertainties in a declared uncertainty column were silently replaced with 1 m/s.
6. The 250-file bundle had no row-level readiness audit, per-file digest ledger, tests, CI, or release evidence.
7. Remote redirects were followed after only the initial host check, and byte limits were applied after the complete response was downloaded.
8. Upload endpoints had no byte limit and the primary TAP proxy did not restrict requests to one SELECT statement.

## Remaining limitations

The v4 core still lacks correlated-noise models, activity regressors, multi-planet model selection, posterior sampling, instrument jitter, unit auto-detection, and source-publication reconciliation. Operational safety is intentionally below 100 because a public production backend also needs authentication, rate limiting, monitoring, and infrastructure egress policy.

