# RV first-pass analysis boundary

This observatory is for target context, data ingestion, visual exploration, and reproducible first-pass screening. It does not establish an exoplanet detection.

## Browser calculations

For an uploaded table containing time, radial velocity, uncertainty, and optional instrument or activity columns, the browser can inspect cadence, plot RV points by instrument, run a weighted period scan, display the sampling window, make a coarse single-Keplerian grid fit, inspect residuals, and show simple RV/activity Pearson correlations.

For multi-instrument uploads, the period scan subtracts each instrument's weighted mean before scanning. This reduces constant zero-point differences at first pass. It is not a simultaneous fit of offsets, jitter, trends, and orbital parameters.

## Period scan

A highest peak is a candidate period, not a detection. The 10%, 1%, and 0.1% lines are analytic screening levels only. They are not bootstrap, permutation, injection-recovery, or correlated-noise false-alarm probabilities.

Before interpreting a candidate, inspect the sampling window, aliases, per-instrument behaviour, activity indicators, and post-fit residuals. Confirm the result using a versioned uncertainty-aware workflow.

## Keplerian grid fit

The grid fit provides a plausible initial single-companion model. It does not provide posterior distributions, evidence comparison, robust intervals, correlated-noise treatment, secular trends, additional companions, or a publication-ready orbital solution.

## Activity panel

The activity panel reports a simple correlation against the first available BIS, FWHM, S-index, or H-alpha column. A correlation is not a causal attribution and does not model lags, rotation harmonics, non-linear effects, varying uncertainties, or multiple diagnostics.

## Provenance

Target context comes from a bundled NASA Exoplanet Archive TAP-derived snapshot or an optional live backend. Uploaded RV data retain the user's source, unit, time standard, calibration, and processing provenance. The console does not automatically convert time scales, check velocity reference frames, or apply barycentric corrections.
