# Baseline audit: v3 to v4.0.0

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
