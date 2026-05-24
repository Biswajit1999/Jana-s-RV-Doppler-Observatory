const state = {
  rows: [],
  gls: null,
  fit: null,
  mode: "empty",
  source: "none"
};

const COLORS = ["#78f2d2", "#85dfff", "#ffc06f", "#bea7ff", "#ff8095", "#96ffbf"];

const plotBase = {
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  font: {
    family: "Inter, system-ui, sans-serif",
    color: "#a0b3d1",
    size: 11
  },
  margin: { l: 62, r: 20, t: 42, b: 54 },
  xaxis: {
    gridcolor: "rgba(255,255,255,0.055)",
    linecolor: "rgba(255,255,255,0.16)",
    tickcolor: "rgba(255,255,255,0.25)",
    ticks: "inside",
    showline: true,
    zerolinecolor: "rgba(255,255,255,0.12)"
  },
  yaxis: {
    gridcolor: "rgba(255,255,255,0.055)",
    linecolor: "rgba(255,255,255,0.16)",
    tickcolor: "rgba(255,255,255,0.25)",
    ticks: "inside",
    showline: true,
    zerolinecolor: "rgba(255,255,255,0.12)"
  }
};

function layout(extra = {}) {
  const out = { ...plotBase, ...extra };
  if (extra.xaxis) out.xaxis = { ...plotBase.xaxis, ...extra.xaxis };
  if (extra.yaxis) out.yaxis = { ...plotBase.yaxis, ...extra.yaxis };
  return out;
}

function fmt(value, digits = 3) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr) {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map(x => (x - m) ** 2)));
}

function rms(arr) {
  return Math.sqrt(mean(arr.map(x => x * x)));
}

function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let quote = false;

  for (const ch of line) {
    if (ch === '"') {
      quote = !quote;
    } else if ((ch === "," || ch === "\t" || ch === ";") && !quote) {
      out.push(cur.trim().replace(/^"|"$/g, ""));
      cur = "";
    } else {
      cur += ch;
    }
  }

  out.push(cur.trim().replace(/^"|"$/g, ""));
  return out;
}

function parseRV(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter(line => line.trim() && !line.trim().startsWith("#"));

  if (lines.length < 3) {
    throw new Error("Need a header and at least two data rows.");
  }

  const header = splitCSVLine(lines[0]).map(h =>
    h.toLowerCase().replace(/["']/g, "").trim()
  );

  const findColumn = aliases => {
    for (const alias of aliases) {
      const i = header.indexOf(alias);
      if (i >= 0) return i;
    }
    return -1;
  };

  const iTime = findColumn(["bjd", "time", "jd", "hjd", "bjd_tdb", "mjd"]);
  const iRV = findColumn(["rv", "vrad", "radvel", "velocity", "mnvel"]);
  const iErr = findColumn(["rv_err", "rverr", "err", "error", "e_rv", "e_vrad", "sigma"]);
  const iInst = findColumn(["instrument", "inst", "telescope", "facility"]);
  const iBIS = findColumn(["bis", "bis_span", "bisspan"]);
  const iFWHM = findColumn(["fwhm", "fwhm_ccf"]);

  if (iTime < 0 || iRV < 0) {
    throw new Error("Missing required BJD/Time or RV column.");
  }

  const rows = [];

  for (let n = 1; n < lines.length; n++) {
    const c = splitCSVLine(lines[n]);
    const t = parseFloat(c[iTime]);
    const rv = parseFloat(c[iRV]);

    if (!Number.isFinite(t) || !Number.isFinite(rv)) continue;

    rows.push({
      t,
      rv,
      err: iErr >= 0 ? Math.max(parseFloat(c[iErr]) || 1, 0.001) : 1,
      inst: iInst >= 0 ? (c[iInst] || "UNKNOWN").trim() : "UNKNOWN",
      bis: iBIS >= 0 ? parseFloat(c[iBIS]) : NaN,
      fwhm: iFWHM >= 0 ? parseFloat(c[iFWHM]) : NaN
    });
  }

  rows.sort((a, b) => a.t - b.t);

  if (rows.length < 3) {
    throw new Error("Fewer than 3 valid RV rows after parsing.");
  }

  return rows;
}

function solveKepler(M, e) {
  let E = e < 0.8 ? M : Math.PI;

  for (let i = 0; i < 30; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }

  return E;
}

function trueAnomaly(E, e) {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );
}

function keplerianRV(t, p) {
  const M = ((2 * Math.PI / p.P) * (((t - p.T0) % p.P) + p.P)) % (2 * Math.PI);
  const E = solveKepler(M, p.e);
  const nu = trueAnomaly(E, p.e);

  return p.K * (Math.cos(p.w + nu) + p.e * Math.cos(p.w));
}

function instrumentOffsets(rows, params) {
  const instruments = [...new Set(rows.map(r => r.inst))];
  const gammas = {};

  for (const inst of instruments) {
    let sw = 0;
    let sv = 0;

    for (const r of rows.filter(x => x.inst === inst)) {
      const w = 1 / (r.err * r.err);
      const model = params ? keplerianRV(r.t, params) : 0;
      sw += w;
      sv += w * (r.rv - model);
    }

    gammas[inst] = sw > 0 ? sv / sw : 0;
  }

  const ref = gammas[instruments[0]] || 0;

  for (const inst of instruments) {
    gammas[inst] -= ref;
  }

  return gammas;
}

function residuals(rows, params) {
  const gammas = params.gammas || instrumentOffsets(rows, params);

  return rows.map(r =>
    r.rv - (gammas[r.inst] || 0) - keplerianRV(r.t, params)
  );
}

function computeGLS(rows, nfreq = 1200) {
  const t = rows.map(r => r.t);
  const y = rows.map(r => r.rv);
  const e = rows.map(r => r.err);

  const N = t.length;
  const span = t[N - 1] - t[0];

  const fmin = 2 / span;
  const fmax = Math.min(2, (N / (2 * span)) * 10);

  const w = e.map(x => 1 / (x * x));
  const W = w.reduce((a, b) => a + b, 0);

  let ybar = 0;
  for (let i = 0; i < N; i++) ybar += w[i] * y[i];
  ybar /= W;

  let YY = 0;
  for (let i = 0; i < N; i++) YY += w[i] * (y[i] - ybar) ** 2;
  YY /= W || 1;

  const periods = [];
  const powers = [];

  let bestZ = -1;
  let bestP = null;

  for (let k = 0; k < nfreq; k++) {
    const f = fmin * Math.pow(fmax / fmin, k / (nfreq - 1));
    const omega = 2 * Math.PI * f;

    let C = 0;
    let S = 0;
    let YC = 0;
    let YS = 0;
    let CC = 0;
    let SS = 0;
    let CS = 0;

    for (let i = 0; i < N; i++) {
      const wi = w[i] / W;
      const dy = y[i] - ybar;
      const co = Math.cos(omega * t[i]);
      const si = Math.sin(omega * t[i]);

      C += wi * co;
      S += wi * si;
      YC += wi * dy * co;
      YS += wi * dy * si;
      CC += wi * co * co;
      SS += wi * si * si;
      CS += wi * co * si;
    }

    CC -= C * C;
    SS -= S * S;
    CS -= C * S;

    const D = CC * SS - CS * CS;
    let power = 0;

    if (Math.abs(D) > 1e-24) {
      power = Math.max(
        0,
        Math.min(
          1,
          (SS * YC * YC + CC * YS * YS - 2 * CS * YC * YS) / (YY * D)
        )
      );
    }

    const P = 1 / f;
    periods.push(P);
    powers.push(power);

    if (power > bestZ) {
      bestZ = power;
      bestP = P;
    }
  }

  return {
    periods,
    powers,
    bestP,
    bestZ,
    N,
    M: nfreq
  };
}

function fapLevel(fap, N, M) {
  return Math.max(0, Math.min(0.999, 1 - Math.pow(fap / M, 2 / (N - 3))));
}

function fitAtPeriod(rows, P) {
  const rvs = rows.map(r => r.rv);
  const K0 = (Math.max(...rvs) - Math.min(...rvs)) / 2;

  const eGrid = [0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.7];
  const wGrid = Array.from({ length: 18 }, (_, i) => i * 20 * Math.PI / 180);
  const kGrid = [0.55, 0.75, 1, 1.25, 1.55].map(x => x * K0);
  const t0Grid = Array.from({ length: 30 }, (_, i) => rows[0].t + i * P / 30);

  let best = {
    chi2: Infinity,
    P,
    K: K0,
    e: 0,
    w: 0,
    T0: rows[0].t,
    gammas: {}
  };

  for (const e of eGrid) {
    for (const w of wGrid) {
      for (const K of kGrid) {
        for (const T0 of t0Grid) {
          const params = { P, K, e, w, T0 };
          const gammas = instrumentOffsets(rows, params);

          let chi2 = 0;

          for (const r of rows) {
            const q = r.rv - (gammas[r.inst] || 0) - keplerianRV(r.t, params);
            chi2 += q * q / (r.err * r.err);
          }

          if (chi2 < best.chi2) {
            best = { P, K, e, w, T0, chi2, gammas };
          }
        }
      }
    }
  }

  best.residuals = residuals(rows, best);
  best.rms = rms(best.residuals);

  return best;
}

function byInstrumentTrace(rows, yFn, xFn) {
  const instruments = [...new Set(rows.map(r => r.inst))];

  return instruments.map((inst, i) => {
    const subset = rows.filter(r => r.inst === inst);

    return {
      x: subset.map(xFn),
      y: subset.map(yFn),
      mode: "markers",
      name: inst,
      marker: {
        color: COLORS[i % COLORS.length],
        size: 6,
        line: {
          color: "#06101e",
          width: 1
        }
      },
      error_y: {
        type: "data",
        array: subset.map(r => r.err),
        visible: true,
        color: COLORS[i % COLORS.length] + "80",
        thickness: 1,
        width: 3
      }
    };
  });
}

function setData(rows, source, mode) {
  state.rows = rows;
  state.source = source;
  state.mode = mode;
  state.gls = null;
  state.fit = null;

  document.getElementById("startPanel").classList.add("hidden");
  document.getElementById("dashboard").classList.add("active");

  document.getElementById("sourceText").textContent = "Source: " + source;
  document.getElementById("metaText").textContent =
    `${mode === "synthetic" ? "Synthetic demo dataset" : "User-loaded RV table"} · ` +
    `${rows.length} points · ${new Set(rows.map(r => r.inst)).size} instrument(s)`;

  updateKPIs();
  renderAllPlots();
  updateSummary();
  setStatus(`Loaded ${rows.length} rows. Run GLS or fit a known period.`);
}

function updateKPIs() {
  const rows = state.rows;
  const rv = rows.map(r => r.rv);
  const inst = new Set(rows.map(r => r.inst));

  const baseline = (rows.at(-1).t - rows[0].t) / 365.25;
  const span = Math.max(...rv) - Math.min(...rv);

  const data = [
    ["Rows", rows.length],
    ["Baseline", fmt(baseline, 2) + " yr"],
    ["RV span", fmt(span, 1) + " m/s"],
    ["σ RV", fmt(std(rv), 1) + " m/s"],
    ["Instruments", inst.size]
  ];

  document.getElementById("kpiGrid").innerHTML = data.map(
    item => `
      <div class="kpi-card">
        <span>${item[0]}</span>
        <strong>${item[1]}</strong>
      </div>
    `
  ).join("");
}

function renderAllPlots() {
  renderRVPlot();
  renderPhasePlot();
  renderResidualPlot();
  renderActivityPlot();

  if (state.gls) {
    renderPeriodogram();
  }
}

function renderRVPlot() {
  const rows = state.rows;

  const traces = byInstrumentTrace(
    rows,
    r => state.fit ? r.rv - (state.fit.gammas[r.inst] || 0) : r.rv,
    r => r.t
  );

  if (state.fit) {
    const t0 = rows[0].t;
    const t1 = rows.at(-1).t;
    const tt = Array.from({ length: 700 }, (_, i) => t0 + i * (t1 - t0) / 699);

    traces.push({
      x: tt,
      y: tt.map(t => keplerianRV(t, state.fit)),
      mode: "lines",
      name: "Keplerian fit",
      line: { color: "#ffffff", width: 2 }
    });
  }

  Plotly.react(
    "rvPlot",
    traces,
    layout({
      title: "RV time series",
      xaxis: { title: "BJD" },
      yaxis: { title: state.fit ? "RV − γ (m/s)" : "RV (m/s)" },
      showlegend: true
    }),
    { responsive: true, displayModeBar: false }
  );
}

function renderPeriodogram() {
  const g = state.gls;
  const ymax = Math.max(...g.powers, fapLevel(0.001, g.N, g.M) * 1.08);

  const traces = [
    {
      x: g.periods,
      y: g.powers,
      mode: "lines",
      name: "GLS power",
      line: { color: "#78f2d2", width: 2 }
    }
  ];

  [
    [0.1, "FAP 10%", "#91a6c7"],
    [0.01, "FAP 1%", "#ffc06f"],
    [0.001, "FAP 0.1%", "#ff8095"]
  ].forEach(row => {
    traces.push({
      x: [g.periods[0], g.periods.at(-1)],
      y: [fapLevel(row[0], g.N, g.M), fapLevel(row[0], g.N, g.M)],
      mode: "lines",
      name: row[1],
      line: { color: row[2], dash: "dash", width: 1 }
    });
  });

  traces.push({
    x: [g.bestP, g.bestP],
    y: [0, ymax],
    mode: "lines",
    name: "Best P = " + fmt(g.bestP, 5) + " d",
    line: { color: "#bea7ff", dash: "dot", width: 1.5 }
  });

  Plotly.react(
    "periodogramPlot",
    traces,
    layout({
      title: "Generalized Lomb–Scargle periodogram",
      xaxis: { title: "Period (days)", type: "log" },
      yaxis: { title: "Power", range: [0, ymax * 1.06] },
      showlegend: true
    }),
    { responsive: true, displayModeBar: false }
  );
}

function renderPhasePlot() {
  const rows = state.rows;
  const P = state.fit
    ? state.fit.P
    : state.gls
      ? state.gls.bestP
      : parseFloat(document.getElementById("periodInput").value);

  const T0 = state.fit ? state.fit.T0 : rows[0].t;

  const traces = byInstrumentTrace(
    rows,
    r => state.fit ? r.rv - (state.fit.gammas[r.inst] || 0) : r.rv,
    r => (((r.t - T0) % P) + P) % P / P
  );

  if (state.fit) {
    const ph = Array.from({ length: 400 }, (_, i) => i / 399);

    traces.push({
      x: ph,
      y: ph.map(p => keplerianRV(T0 + p * P, state.fit)),
      mode: "lines",
      name: "Fit",
      line: { color: "#ffffff", width: 2 }
    });
  }

  Plotly.react(
    "phasePlot",
    traces,
    layout({
      title: "Phase-folded RV curve",
      xaxis: { title: "Orbital phase" },
      yaxis: { title: state.fit ? "RV − γ (m/s)" : "RV (m/s)" },
      showlegend: true
    }),
    { responsive: true, displayModeBar: false }
  );
}

function renderResidualPlot() {
  if (!state.fit) {
    Plotly.react(
      "residualPlot",
      [],
      layout({
        title: "Residuals appear after Keplerian fit",
        xaxis: { title: "BJD" },
        yaxis: { title: "O − C (m/s)" }
      }),
      { responsive: true, displayModeBar: false }
    );
    return;
  }

  const rows = state.rows;
  const residualValues = state.fit.residuals;
  const instruments = [...new Set(rows.map(r => r.inst))];

  const traces = [
    {
      x: [rows[0].t, rows.at(-1).t],
      y: [0, 0],
      mode: "lines",
      name: "zero",
      line: { color: "rgba(255,255,255,0.28)", dash: "dot" }
    }
  ];

  instruments.forEach((inst, i) => {
    const pairs = rows
      .map((r, j) => [r, residualValues[j]])
      .filter(p => p[0].inst === inst);

    traces.push({
      x: pairs.map(p => p[0].t),
      y: pairs.map(p => p[1]),
      mode: "markers",
      name: inst,
      marker: { color: COLORS[i % COLORS.length], size: 6 }
    });
  });

  Plotly.react(
    "residualPlot",
    traces,
    layout({
      title: "Observed − computed residuals",
      xaxis: { title: "BJD" },
      yaxis: { title: "O − C (m/s)" },
      showlegend: true
    }),
    { responsive: true, displayModeBar: false }
  );
}

function pearson(xs, ys) {
  const valid = [];

  for (let i = 0; i < xs.length; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) {
      valid.push([xs[i], ys[i]]);
    }
  }

  if (valid.length < 3) return NaN;

  const x = valid.map(v => v[0]);
  const y = valid.map(v => v[1]);

  const mx = mean(x);
  const my = mean(y);

  let cov = 0;
  let sx = 0;
  let sy = 0;

  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;

    cov += dx * dy;
    sx += dx * dx;
    sy += dy * dy;
  }

  return cov / Math.sqrt(sx * sy);
}

function renderActivityPlot() {
  const rows = state.rows;

  const key = rows.some(r => Number.isFinite(r.bis))
    ? "bis"
    : rows.some(r => Number.isFinite(r.fwhm))
      ? "fwhm"
      : null;

  if (!key) {
    Plotly.react(
      "activityPlot",
      [],
      layout({
        title: "Activity diagnostics unavailable: upload BIS or FWHM",
        xaxis: { title: "Activity indicator" },
        yaxis: { title: "RV (m/s)" }
      }),
      { responsive: true, displayModeBar: false }
    );
    return;
  }

  const traces = byInstrumentTrace(rows, r => r.rv, r => r[key]);

  const rValue = pearson(
    rows.map(r => r[key]),
    rows.map(r => r.rv)
  );

  if (Number.isFinite(rValue)) {
    traces.push({
      x: [NaN],
      y: [NaN],
      mode: "markers",
      name: "Pearson r = " + fmt(rValue, 3),
      marker: { color: "#ffc06f" }
    });
  }

  Plotly.react(
    "activityPlot",
    traces,
    layout({
      title: "Activity diagnostic: RV vs " + key.toUpperCase(),
      xaxis: { title: key.toUpperCase() },
      yaxis: { title: "RV (m/s)" },
      showlegend: true
    }),
    { responsive: true, displayModeBar: false }
  );
}

function updateSummary() {
  const rows = [
    ["Data mode", state.mode === "synthetic" ? "Synthetic demo" : "User-uploaded / loaded file"],
    ["Rows", state.rows.length],
    ["Best GLS P", state.gls ? fmt(state.gls.bestP, 6) + " d" : "—"]
  ];

  if (state.fit) {
    rows.push(
      ["Fit P", fmt(state.fit.P, 6) + " d"],
      ["K", fmt(state.fit.K, 2) + " m/s"],
      ["e", fmt(state.fit.e, 3)],
      ["ω", fmt(state.fit.w * 180 / Math.PI, 1) + "°"],
      ["RMS residual", fmt(state.fit.rms, 2) + " m/s"]
    );
  }

  document.getElementById("summaryTable").innerHTML = rows.map(
    r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`
  ).join("");
}

function setStatus(message, isError = false) {
  const el = document.getElementById("statusText");
  el.innerHTML = isError ? `<span class="err">${message}</span>` : message;
}

function loadSyntheticDemo() {
  let seed = 42;

  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const gauss = () =>
    Math.sqrt(-2 * Math.log(rand() + 1e-10)) * Math.cos(2 * Math.PI * rand());

  const P = 4.2308;
  const params = {
    P,
    K: 55.9,
    e: 0.013,
    w: 78 * Math.PI / 180,
    T0: 2451500
  };

  const rows = [];

  const blocks = [
    { t: 2451500, n: 38, inst: "HARPS", gamma: 0 },
    { t: 2451880, n: 24, inst: "HIRES", gamma: 12.4 },
    { t: 2452520, n: 28, inst: "HARPS", gamma: 0 }
  ];

  for (const block of blocks) {
    for (let i = 0; i < block.n; i++) {
      const t = block.t + rand() * 170;

      rows.push({
        t,
        rv: keplerianRV(t, params) + block.gamma + gauss() * 1.8,
        err: 0.8 + rand() * 1.1,
        inst: block.inst,
        bis: gauss() * 28,
        fwhm: 7200 + gauss() * 65
      });
    }
  }

  rows.sort((a, b) => a.t - b.t);

  document.getElementById("periodInput").value = P;

  setData(rows, "Synthetic 51 Peg-like demo — not telescope measurements", "synthetic");

  state.gls = computeGLS(rows);
  document.getElementById("periodInput").value = state.gls.bestP.toFixed(6);

  state.fit = fitAtPeriod(rows, P);

  renderAllPlots();
  updateSummary();
  setStatus("Demo loaded and analysed. It is synthetic, not real telescope data.");
}

function loadFile(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const rows = parseRV(reader.result);
      setData(rows, "User-uploaded RV data: " + file.name, "upload");
    } catch (err) {
      setStatus("Parse error: " + err.message, true);
      alert("Parse error: " + err.message);
    }
  };

  reader.readAsText(file);
}

document.getElementById("fileInput").addEventListener("change", event => {
  loadFile(event.target.files[0]);
});

document.getElementById("heroUploadBtn").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

document.getElementById("heroDemoBtn").addEventListener("click", loadSyntheticDemo);

const dropZone = document.getElementById("dropZone");

dropZone.addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

dropZone.addEventListener("dragover", event => {
  event.preventDefault();
  dropZone.classList.add("drag");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag");
});

dropZone.addEventListener("drop", event => {
  event.preventDefault();
  dropZone.classList.remove("drag");
  loadFile(event.dataTransfer.files[0]);
});

document.getElementById("runPeriodogramBtn").addEventListener("click", () => {
  if (!state.rows.length) return;

  setStatus("Running GLS period search…");

  setTimeout(() => {
    state.gls = computeGLS(state.rows);
    document.getElementById("periodInput").value = state.gls.bestP.toFixed(6);

    renderPeriodogram();
    renderPhasePlot();
    updateSummary();

    setStatus(
      "GLS complete. Best period = " +
      fmt(state.gls.bestP, 6) +
      " d, power = " +
      fmt(state.gls.bestZ, 3) +
      "."
    );
  }, 20);
});

document.getElementById("fitBtn").addEventListener("click", () => {
  if (!state.rows.length) return;

  const P = parseFloat(document.getElementById("periodInput").value);

  if (!P || P <= 0) {
    setStatus("Enter a valid period before fitting.", true);
    return;
  }

  setStatus("Grid fitting at P = " + fmt(P, 6) + " d…");

  setTimeout(() => {
    state.fit = fitAtPeriod(state.rows, P);

    renderAllPlots();
    updateSummary();

    setStatus("Fit complete. RMS residual = " + fmt(state.fit.rms, 2) + " m/s.");
  }, 20);
});

document.getElementById("resetBtn").addEventListener("click", () => {
  state.rows = [];
  state.gls = null;
  state.fit = null;

  document.getElementById("dashboard").classList.remove("active");
  document.getElementById("startPanel").classList.remove("hidden");

  window.scrollTo({ top: document.getElementById("workspace").offsetTop - 20, behavior: "smooth" });
});
