/*
 * Scientific interpretation guard for the browser-native RV workflow.
 *
 * This file deliberately leaves the quick-look analysis interactive while
 * preventing it from being presented as a detection pipeline. It adds a
 * first-pass multi-instrument centring step to the period scan, clarifies the
 * status of the analytic alert lines, and carries those caveats into reports.
 */
(function () {
  const ANALYSIS_BOUNDARY = [
    'This browser workflow is a first-pass screening tool, not a planet detection or posterior inference pipeline.',
    'The period scan is weighted and, for multiple instruments, each instrument is centred by its weighted mean before scanning. This reduces constant zero-point offsets but is not a simultaneous multi-instrument Keplerian fit.',
    'The plotted 10%, 1% and 0.1% lines are analytic screening levels. They are not bootstrap, permutation, injection-recovery or correlated-noise false-alarm probabilities.',
    'A candidate requires independent checks: sampling-window aliases, residual structure, activity indicators, additional signals, instrument systematics and a reproducible fit with uncertainties.',
  ];

  function weightedInstrumentCentres(rows) {
    const sums = new Map();
    for (const row of rows) {
      const key = row.inst || 'UNKNOWN';
      const variance = Math.max(Number(row.err) ** 2, 1e-12);
      const weight = 1 / variance;
      const previous = sums.get(key) || { weight: 0, weightedRv: 0 };
      previous.weight += weight;
      previous.weightedRv += weight * Number(row.rv);
      sums.set(key, previous);
    }
    const centres = new Map();
    sums.forEach((summary, key) => centres.set(key, summary.weightedRv / summary.weight));
    return {
      rows: rows.map((row) => ({ ...row, rv: Number(row.rv) - (centres.get(row.inst || 'UNKNOWN') || 0) })),
      nInstruments: centres.size,
    };
  }

  function scanPreprocessingLabel(nInstruments) {
    return nInstruments > 1
      ? `weighted scan; ${nInstruments} instrument means centred before period search`
      : 'weighted floating-mean scan; one instrument';
  }

  function setEvidenceStatus() {
    const badge = document.getElementById('evidenceGuardBadge');
    const detail = document.getElementById('evidenceGuardDetail');
    if (!badge || !detail) return;
    if (!state.rows.length) {
      badge.textContent = 'NO RV DATA';
      badge.className = 'warn';
      detail.textContent = 'Upload a measured BJD/RV table. A target-card value is context, not a fitted signal.';
      return;
    }
    if (!state.gls) {
      badge.textContent = 'SCREENING READY';
      badge.className = 'warn';
      detail.textContent = 'Data loaded. Run the weighted period scan, then inspect the sampling window before fitting.';
      return;
    }
    if (!state.fit) {
      badge.textContent = 'CANDIDATE PERIOD';
      badge.className = 'warn';
      detail.textContent = 'A peak is a candidate period. The alert lines are heuristic, and no false-alarm probability or detection claim is reported.';
      return;
    }
    badge.textContent = 'FIRST-PASS FIT';
    badge.className = 'warn';
    detail.textContent = 'The Keplerian grid fit is descriptive. It is not an uncertainty-calibrated orbital solution.';
  }

  function injectEvidenceGuard() {
    if (document.getElementById('evidenceGuardPanel')) return;
    const analysisTab = document.getElementById('analysis');
    const controls = analysisTab?.querySelector('.two-column-grid');
    if (!analysisTab || !controls) return;
    const panel = document.createElement('section');
    panel.className = 'panel mt-panel';
    panel.id = 'evidenceGuardPanel';
    panel.innerHTML = `
      <div class="panel-head"><h3>Evidence status and analysis boundary</h3><span id="evidenceGuardBadge" class="warn">NO RV DATA</span></div>
      <p id="evidenceGuardDetail" class="panel-note">Upload a measured BJD/RV table. A target-card value is context, not a fitted signal.</p>
      <div class="rv-boundary-grid">
        <article><strong>Period scan</strong><span>Weighted first-pass search. Multi-instrument uploads are centred by weighted instrument means before scanning.</span></article>
        <article><strong>Alert lines</strong><span>Analytic screening levels only. They are not bootstrap or correlated-noise false-alarm probabilities.</span></article>
        <article><strong>Keplerian grid</strong><span>Useful initial condition generator, not a posterior, model comparison or detection statistic.</span></article>
        <article><strong>Next evidence</strong><span>Inspect aliases, activity channels and residuals; then validate with a reproducible uncertainty-aware model.</span></article>
      </div>`;
    controls.after(panel);
    const style = document.createElement('style');
    style.textContent = `.rv-boundary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:0 16px 16px}.rv-boundary-grid article{border:1px solid var(--line);background:var(--glass);border-radius:12px;padding:12px}.rv-boundary-grid strong{display:block;color:var(--cyan);font-size:.78rem;letter-spacing:.04em;text-transform:uppercase}.rv-boundary-grid span{display:block;margin-top:7px;color:var(--muted);font-size:.8rem;line-height:1.5}@media(max-width:980px){.rv-boundary-grid{grid-template-columns:1fr 1fr}}@media(max-width:640px){.rv-boundary-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
    setEvidenceStatus();
  }

  function patchAnalysisFunctions() {
    const baseCompute = computeGLS;
    computeGLS = function guardedComputeGLS(rows, nf = 1200) {
      const prepared = weightedInstrumentCentres(rows);
      const result = baseCompute(prepared.rows, nf);
      result.preprocessing = scanPreprocessingLabel(prepared.nInstruments);
      result.alertLines = 'heuristic analytic screening levels; no bootstrap or correlated-noise FAP';
      return result;
    };

    const basePeriodogram = renderPeriodogram;
    renderPeriodogram = function guardedRenderPeriodogram(id) {
      basePeriodogram(id);
      if (state.gls && window.Plotly) {
        Plotly.relayout(id, { title: 'Weighted period scan · heuristic alert lines' });
      }
      setEvidenceStatus();
    };

    const baseReport = renderReport;
    renderReport = function guardedRenderReport() {
      baseReport();
      const report = document.getElementById('reportText');
      if (!report || report.textContent.includes('ANALYSIS BOUNDARY')) return;
      const preprocessing = state.gls?.preprocessing || 'not computed';
      report.textContent += `\n\nANALYSIS BOUNDARY\n--------------------------------\nPeriod scan: ${preprocessing}\nAlert lines: analytic screening only; not bootstrap/permutation/correlated-noise FAP.\nFit: first-pass Keplerian grid; no posterior, uncertainty interval or detection claim.\nRequired follow-up: inspect aliases, activity indicators, residuals and independent data.\n`;
    };
  }

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      patchAnalysisFunctions();
      injectEvidenceGuard();
      document.getElementById('runPeriodogramBtn')?.addEventListener('click', () => setTimeout(setEvidenceStatus, 0));
      document.getElementById('fitBtn')?.addEventListener('click', () => setTimeout(setEvidenceStatus, 0));
      document.getElementById('fileInput')?.addEventListener('change', () => setTimeout(setEvidenceStatus, 0));
      document.getElementById('clearData')?.addEventListener('click', () => setTimeout(setEvidenceStatus, 0));
    }, 500);
  });
})();
