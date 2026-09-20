# Claim ledger

| Claim | Status | Evidence | Boundary |
|---|---|---|---|
| Every committed row parses to finite BJD, RV, and positive uncertainty | supported | full 154,150-row deterministic audit | committed v4.0.0 bundle only |
| 39 of 250 files pass all six inference-readiness gates | supported | generated JSON/CSV and regression tests | gate thresholds are declared triage choices |
| 34,153 rows occur in conflicting repeated-epoch groups | supported | exact floating-point BJD grouping | does not decide which observations are independent |
| 181 files confound multiple references behind one instrument label | supported | per-file reference/instrument cardinalities | does not prove a physical zero-point difference for every reference |
| The browser scan identifies a statistically significant planet | rejected | no validated maximum-peak null distribution is computed | peak is a descriptive candidate only |
| The first-pass grid is a publication-grade Keplerian orbit | rejected | finite fixed-period grid without posterior/noise model | diagnostic initialization only |
| A failed file contains invalid source observations | not claimed | audit evaluates merge readiness | source publications and archive records require separate review |
| Repository maturity increased from 32 to 93 | rubric result | `docs/BASELINE_AUDIT.md` | not peer review, citation impact, or scientific truth |

