# Methods and validity protocol

## 1. Fixed audit population

The study population is every `*.csv` file committed under `sample_data/rv_library/data/` at v4.0.0. The index and filesystem must both contain 250 targets. The study evaluates the committed merge as delivered; it does not fetch mutable remote data.

## 2. Primitive row contracts

Python’s standard CSV parser reads every file. A valid numerical row has finite `BJD`, `RV`, and `RV_ERR`, with `RV_ERR > 0`. Each row is considered traceable when at least one of `REFERENCE`, `SOURCE_FILE`, `SOURCE`, or `SOURCE_NAME` is non-empty. Every source file receives a SHA-256 digest after CRLF-to-LF normalisation, so the receipt identifies CSV content rather than a platform-specific checkout representation; the bundle digest hashes a case-folded filename-ordered `filename:digest` ledger.

## 3. Duplication and identity metrics

An exact duplicate repeats `(BJD, RV, RV_ERR, INSTRUMENT, REFERENCE)`. A repeated epoch is any row whose exact floating-point `BJD` occurs more than once. A conflicting epoch is a repeated-epoch group containing more than one distinct RV value.

Repeated times can be legitimate simultaneous observations. They become an inference risk here because the committed merge can contain multiple literature representations of the same epoch while collapsing the instrument field to `DACE`. The audit flags the condition; it does not delete rows or choose which publication is authoritative.

## 4. Offset separability

`reference_offsets_separable` fails when a file has more than one non-empty literature reference but no more than one non-missing instrument label. The gate asks whether the committed columns are sufficient to fit reference/instrument zero points. It does not assert that every reference has a distinct physical zero point.

## 5. Range diagnostic

For RV values `v`, the robust central span is `Q95(v) - Q05(v)`. The range diagnostic is

```text
(max(v) - min(v)) / (Q95(v) - Q05(v)).
```

Ratios above 20 are flagged for unit, offset, transcription, or extreme-outlier review. The threshold is a preregistered triage rule rather than a probability statement.

## 6. File-level decision

A file is called inference-ready only when:

- numerical/uncertainty contract passes;
- exact duplicate fraction ≤ 0.01;
- repeated-epoch row fraction ≤ 0.01;
- reference offsets are separable from committed labels;
- full/robust range ratio ≤ 20;
- all rows have source provenance.

No weighted score can compensate for a failed gate. The app blocks automatic scanning/fitting for failed bundled files while still allowing inspection and export.

## 7. Candidate-period scan

The browser computes an uncertainty-weighted floating-mean sinusoidal scan after subtracting each declared instrument’s weighted mean. At every angular frequency it solves the weighted sine/cosine least-squares system. The default grid spans 0.5 days to half the observed time baseline on a logarithmic grid.

The reported peak is descriptive. No false-alarm probability is shown because the maximum-peak distribution depends on the observing times, frequency grid, and noise null. Correlated noise and aliases can invalidate white-noise interpretations.

## 8. First-pass Keplerian grid

At a fixed period, the model is

```text
v_i = gamma_instrument(i) + K [cos(omega + nu_i) + e cos(omega)] + epsilon_i.
```

For each finite grid point in eccentricity, argument of periastron, and phase, the implementation solves `K` and the per-instrument `gamma` values analytically by weighted least squares. The grid is diagnostic: it does not optimize period jointly, calculate posterior intervals, fit jitter, or perform model selection.

## 9. Numerical validation

Synthetic tests establish:

- the circular model reduces to a cosine;
- independent instrument systemic velocities are retained;
- a 10-day signal is recovered despite 175 m/s between-instrument offset;
- the fixed-period grid recovers injected `K` and both offsets;
- non-positive uncertainties fail closed.

Python tests recompute the full 154,150-row audit, assert the headline counts, verify zero invalid/non-positive rows, and compare every generated product byte-for-byte.

## 10. Backend threat boundary

Remote tables are restricted to a named astronomy-host allowlist. Every redirect target is revalidated, redirects are capped, content-length and streamed bytes are limited to 12 MB, uploads are limited to 12 MB, and the public TAP proxy accepts one `SELECT` query only. These controls reduce SSRF and resource-exhaustion exposure; production deployment still requires authentication, rate limits, structured logging, and infrastructure-level egress controls.

## 11. Falsifiers and next validation

This release requires revision if independent CSV parsing changes the aggregate counts, a file digest differs from the release ledger, synthetic recovery fails under supported runtimes, or source-publication review demonstrates that a flagged condition is fully encoded elsewhere in the committed table.

The next scientific step is target-specific curation: recover original instrument/reduction identifiers, reconcile units and time standards, identify non-independent publication duplicates, and benchmark the curated series against Astropy or RadVel with a declared null and noise model.
