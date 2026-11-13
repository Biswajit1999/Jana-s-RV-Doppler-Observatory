# RV information and sampling study (13 November 2026)

Independent Python diagnostics: (1) weighted per-instrument mean removal, (2) sine/cosine Fisher information eigenvalues after profiling independent instrument zero points, and (3) phase-bin coverage for a candidate period.

Run `python -m unittest discover -s tests -p 'test_rv_information.py'` from repository root. Tests use synthetic data. The Fisher matrix assumes fixed period, independent Gaussian errors with known positive standard deviations, and a sinusoid rather than an eccentric Keplerian orbit. Near-zero eigenvalues flag poorly constrained phase combinations, **not** evidence against a planet. Phase coverage is a sampling descriptor, **not** detection completeness or a false-alarm probability. Instrument groups must have valid independent provenance; this tool does not waive any of the existing six inference-readiness gates.

No catalogued target was fitted and no RV detections are claimed. AI-assisted implementation was used; Biswajit Jana is the requested commit author. Independent validation is required before merging.
