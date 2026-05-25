const state = {
  activeTarget: null,
  rows: [],
  gls: null,
  fit: null,
  mode: "Synthetic Demo",
  source: "Synthetic demonstration dataset"
};

const COLORS = ["#26f0ff", "#39ff7f", "#ffd15c", "#b59cff", "#ff667c", "#80ffd0"];

const TARGETS = [
  {
    key: "51 peg",
    planet: "51 Pegasi b",
    host: "51 Peg",
    aliases: ["51 peg", "51 pegasi", "51 pegasi b", "hd 217014"],
    type: "Star + hot Jupiter",
    ra: "22:57:27.98",
    dec: "+20:46:07.8",
    spt: "G2IV",
    vmag: "5.49",
    distance: "15.6 pc",
    parallax: "64.1 mas",
    period: 4.2308,
    k: 55.9,
    ecc: 0.013,
    mass: "0.46 MJ",
    semiMajor: "0.052 AU",
    omega: 78,
    note: "Canonical RV hot-Jupiter system used here as a demonstration target."
  },
  {
    key: "hd 189733",
    planet: "HD 189733 b",
    host: "HD 189733",
    aliases: ["hd 189733", "hd189733", "hd 189733 b"],
    type: "Star + transiting hot Jupiter",
    ra: "20:00:43.71",
    dec: "+22:42:39.1",
    spt: "K1V",
    vmag: "7.67",
    distance: "19.8 pc",
    parallax: "50.6 mas",
    period: 2.2186,
    k: 205.0,
    ecc: 0.004,
    mass: "1.13 MJ",
    semiMajor: "0.031 AU",
    omega: 90,
    note: "Bright transiting hot-Jupiter system useful for RV plus photometry workflows."
  },
  {
    key: "proxima cen",
    planet: "Proxima Centauri b",
    host: "Proxima Cen",
    aliases: ["proxima", "proxima cen", "proxima centauri", "proxima b", "proxima centauri b"],
    type: "M dwarf + terrestrial candidate",
    ra: "14:29:42.95",
    dec: "-62:40:46.1",
    spt: "M5.5V",
    vmag: "11.13",
    distance: "1.30 pc",
    parallax: "768.5 mas",
    period: 11.186,
    k: 1.4,
    ecc: 0.08,
    mass: "≥1.1 M⊕",
    semiMajor: "0.049 AU",
    omega: 110,
    note: "Low-amplitude nearby M-dwarf RV system; useful for demonstrating activity caution."
  }
];

const plotBase = {
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  font: {
    family: "Inter, system-ui, sans-serif",
    color: "#7f9aa7",
    size: 10
  },
  margin: { l: 55, r: 18, t: 26, b: 44 },
  xaxis: {
    gridcolor: "rgba(117,238,255,0.055)",
    linecolor: "rgba(117,238,255,0.18)",
    tickcolor: "rgba(117,238,255,0.22)",
    zerolinecolor: "rgba(117,238,255,0.12)",
    ticks: "inside",
    showline: true
  },
  yaxis: {
    gridcolor: "rgba(117,238,255,0.055)",
    linecolor: "rgba(117,238,255,0.18)",
    tickcolor: "rgba(117,238,255,0.22)",
    zerolinecolor: "rgba(117,238,255,0.12)",
    ticks: "inside",
    showline: true
  }
};

function layout(extra = {}) {
  const output = { ...plotBase, ...extra };
  if (extra.xaxis) output.xaxis = { ...plotBase.xaxis, ...extra.xaxis };
  if (extra.yaxis) output.yaxis = { ...plotBase.yaxis, ...extra.yaxis };
  return output;
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

function safeSet(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setUTCClock() {
  const now = new Date();
  safeSet("utcClock", now.toISOString().slice(11, 19));
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
  return rows.map(r => r.rv - (gammas[r.inst] || 0) - keplerianRV(r.t, params));
}

function computeGLS(rows, nfreq = 1200) {
  const t = rows.map(r => r.t);
  const y = rows.map(r => r.rv);
  const e = rows.map(r => r.err);

  const N = t.length;
  const span = t[N - 1] - t[0];

  const fmin = Math.max(1e-6, 2 / span);
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

  return { periods, powers, bestP, bestZ, N, M: nfreq };
}

function fapLevel(fap, N, M) {
  return Math.max(0, Math.min(0.999, 1 - Math.pow(fap / M, 2 / (N - 3))));
}

function fitAtPeriod(rows, P) {
  const rvs = rows.map(r => r.rv);
  const K0 = (Math.max(...rvs) - Math.min(...rvs)) / 2;

  const eInput = parseFloat(document.getElementById("eccInput").value);
  const omegaInput = parseFloat(document.getElementById("omegaInput").value);

  const eGrid = [...new Set([0, 0.02, 0.05, 0.1, 0.2, 0.35, 0.5, Number.isFinite(eInput) ? eInput : 0])]
    .filter(e => e >= 0 && e < 0.9);

  const wGrid = Array.from({ length: 18 }, (_, i) => i * 20 * Math.PI / 180);
  if (Number.isFinite(omegaInput)) wGrid.push(omegaInput * Math.PI / 180);

  const kGrid = [0.55, 0.75, 1, 1.25, 1.55].map(x => x * K0);
  const t0Grid = Array.from({ length: 32 }, (_, i) => rows[0].t + i * P / 32);

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
          color: "#02070d",
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

function findTarget(query) {
  const q = query.toLowerCase().trim();
  return TARGETS.find(t => t.aliases.some(alias => alias.includes(q) || q.includes(alias))) || TARGETS[0];
}

function setTarget(target) {
  state.activeTarget = target;

  safeSet("targetName", target.planet);
  safeSet("hostName", target.host);
  safeSet("targetRA", target.ra);
  safeSet("targetDec", target.dec);
  safeSet("targetSpT", target.spt);
  safeSet("targetDist", target.distance);
  safeSet("targetK", `${target.k} m/s`);

  safeSet("dashPlanet", target.planet);
  safeSet("dashPeriod", `${target.period} d`);
  safeSet("dashMass", target.mass);
  safeSet("dashEcc", String(target.ecc));

  safeSet("idMain", target.host);
  safeSet("idType", target.type);
  safeSet("idRA", target.ra);
  safeSet("idDec", target.dec);
  safeSet("idVmag", target.vmag);
  safeSet("idDistance", target.distance);
  safeSet("idParallax", target.parallax);
  safeSet("idSpT", target.spt);

  document.getElementById("periodInput").value = target.period;
  document.getElementById("kInput").value = target.k;
  document.getElementById("eccInput").value = target.ecc;
  document.getElementById("omegaInput").value = target.omega;

  renderPlanetTable(target);
  drawSkyCanvas(target);
  loadSyntheticDemo(target, false);
  renderReport();
}

function renderTargetList() {
  const container = document.getElementById("targetList");

  container.innerHTML = TARGETS.map(t => `
    <button data-target="${t.key}">
      <strong>${t.planet}</strong>
      <small>${t.host} · ${t.spt} · ${t.distance}</small>
    </button>
  `).join("");

  container.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      const target = TARGETS.find(t => t.key === button.dataset.target);
      setTarget(target);
    });
  });
}

function renderPlanetTable(target) {
  const rows = [
    ["Planet", target.planet],
    ["Host", target.host],
    ["Period", `${target.period} d`],
    ["K semi-amplitude", `${target.k} m/s`],
    ["Eccentricity", target.ecc],
    ["m sin i", target.mass],
    ["Semi-major axis", target.semiMajor],
    ["Note", target.note]
  ];

  document.getElementById("planetTable").innerHTML = rows.map(row => `
    <div><span>${row[0]}</span><strong>${row[1]}</strong></div>
  `).join("");
}

function drawSkyCanvas(target) {
  const canvas = document.getElementById("skyCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#02070d";
  ctx.fillRect(0, 0, w, h);

  const seedText = target.host + target.ra + target.dec;
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) seed += seedText.charCodeAt(i) * (i + 1);

  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 140; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.5 + rand() * 1.7;
    const alpha = 0.3 + rand() * 0.7;

    ctx.beginPath();
    ctx.fillStyle = `rgba(210,245,255,${alpha})`;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const cx = w * 0.52;
  const cy = h * 0.48;

  ctx.strokeStyle = "rgba(38,240,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, h);
  ctx.moveTo(0, cy);
  ctx.lineTo(w, cy);
  ctx.stroke();

  ctx.strokeStyle = "rgba(38,240,255,0.8)";
  ctx.lineWidth = 1.4;

  for (const radius of [22, 45, 70]) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#26f0ff";
  ctx.shadowBlur = 18;
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#26f0ff";
  ctx.font = "12px JetBrains Mono";
  ctx.fillText(target.host, 16, 24);
  ctx.fillStyle = "#7f9aa7";
  ctx.fillText(`RA ${target.ra}`, 16, h - 34);
  ctx.fillText(`DEC ${target.dec}`, 16, h - 16);
}

function generateSyntheticRows(target) {
  let seed = 42;

  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const gauss = () =>
    Math.sqrt(-2 * Math.log(rand() + 1e-10)) * Math.cos(2 * Math.PI * rand());

  const params = {
    P: target.period,
    K: target.k,
    e: target.ecc,
    w: target.omega * Math.PI / 180,
    T0: 2451500
  };

  const rows = [];

  const blocks = [
    { t: 2451500, n: 38, inst: "HARPS", gamma: 0 },
    { t: 2451880, n: 24, inst: "HIRES", gamma: target.k * 0.08 },
    { t: 2452520, n: 28, inst: "ESPRESSO", gamma: -target.k * 0.04 }
  ];

  const noiseScale = Math.max(0.75, Math.min(3.2, target.k * 0.035));

  for (const block of blocks) {
    for (let i = 0; i < block.n; i++) {
      const t = block.t + rand() * 170;

      rows.push({
        t,
        rv: keplerianRV(t, params) + block.gamma + gauss() * noiseScale,
        err: 0.6 + rand() * 1.2,
        inst: block.inst,
        bis: gauss() * (target.k * 0.18),
        fwhm: 7200 + gauss() * 65
      });
    }
  }

  rows.sort((a, b) => a.t - b.t);
  return rows;
}

function setData(rows, source, mode) {
  state.rows = rows;
  state.source = source;
  state.mode = mode;
  state.gls = null;
  state.fit = null;

  safeSet("systemMode", mode);
  safeSet("rvSourceLabel", mode === "Uploaded RV Data" ? "uploaded file" : "synthetic demo");

  updateFitSummary();
  renderAllPlots();
  renderActivitySummary();
  renderReport();
}

function loadSyntheticDemo(target = state.activeTarget || TARGETS[0], updateMode = true) {
  const rows = generateSyntheticRows(target);

  if (updateMode) state.mode = "Synthetic Demo";

  setData(
    rows,
    `Synthetic ${target.planet} demonstration — not telescope measurements`,
    "Synthetic Demo"
  );

  state.gls = computeGLS(rows);
  state.fit = fitAtPeriod(rows, target.period);

  renderAllPlots();
  updateFitSummary();
  renderActivitySummary();
  renderReport();
}

function updateFitSummary() {
  const rows = state.rows || [];
  const bestP = state.gls ? `${fmt(state.gls.bestP, 6)} d` : "—";
  const residual = state.fit ? `${fmt(state.fit.rms, 2)} m/s` : "—";

  document.getElementById("fitSummary").innerHTML = `
    <div><span>Rows</span><strong>${rows.length || "—"}</strong></div>
    <div><span>Best period</span><strong>${bestP}</strong></div>
    <div><span>RMS residual</span><strong>${residual}</strong></div>
  `;
}

function renderAllPlots() {
  renderRVPlot("rvPlot");
  renderRVPlot("labRVPlot");

  renderPhasePlot("phasePlot");
  renderPhasePlot("labPhasePlot");

  renderResidualPlot("residualPlot");
  renderResidualPlot("labResidualPlot");

  renderActivityPlot("activityPlot");

  if (state.gls) {
    renderPeriodogram("periodogramPlot");
    renderPeriodogram("labGLSPlot");
  } else {
    renderEmptyPeriodogram("periodogramPlot");
    renderEmptyPeriodogram("labGLSPlot");
  }
}

function renderRVPlot(divId) {
  const rows = state.rows;
  if (!rows.length) return;

  const traces = byInstrumentTrace(
    rows,
    r => state.fit ? r.rv - (state.fit.gammas[r.inst] || 0) : r.rv,
    r => r.t
  );

  if (state.fit) {
    const t0 = rows[0].t;
    const t1 = rows.at(-1).t;
    const tt = Array.from({ length: 800 }, (_, i) => t0 + i * (t1 - t0) / 799);

    traces.push({
      x: tt,
      y: tt.map(t => keplerianRV(t, state.fit)),
      mode: "lines",
      name: "Keplerian fit",
      line: { color: "#ffffff", width: 2 }
    });
  }

  Plotly.react(
    divId,
    traces,
    layout({
      title: "Radial velocity time series",
      xaxis: { title: "BJD" },
      yaxis: { title: state.fit ? "RV − γ (m/s)" : "RV (m/s)" },
      showlegend: true,
      legend: { orientation: "h", x: 0, y: 1.15 }
    }),
    { responsive: true, displayModeBar: false }
  );
}

function renderEmptyPeriodogram(divId) {
  Plotly.react(
    divId,
    [],
    layout({
      title: "Run GLS to generate periodogram",
      xaxis: { title: "Period (days)" },
      yaxis: { title: "Power" }
    }),
    { responsive: true, displayModeBar: false }
  );
}

function renderPeriodogram(divId) {
  const g = state.gls;
  if (!g) return renderEmptyPeriodogram(divId);

  const ymax = Math.max(...g.powers, fapLevel(0.001, g.N, g.M) * 1.08);

  const traces = [
    {
      x: g.periods,
      y: g.powers,
      mode: "lines",
      name: "GLS power",
      line: { color: "#26f0ff", width: 2 }
    }
  ];

  [
    [0.1, "FAP 10%", "#7f9aa7"],
    [0.01, "FAP 1%", "#ffd15c"],
    [0.001, "FAP 0.1%", "#ff667c"]
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
    name: `Best P = ${fmt(g.bestP, 5)} d`,
    line: { color: "#b59cff", dash: "dot", width: 1.5 }
  });

  Plotly.react(
    divId,
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

function renderPhasePlot(divId) {
  const rows = state.rows;
  if (!rows.length) return;

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
    const ph = Array.from({ length: 500 }, (_, i) => i / 499);

    traces.push({
      x: ph,
      y: ph.map(p => keplerianRV(T0 + p * P, state.fit)),
      mode: "lines",
      name: "Fit",
      line: { color: "#ffffff", width: 2 }
    });
  }

  Plotly.react(
    divId,
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

function renderResidualPlot(divId) {
  if (!state.fit) {
    Plotly.react(
      divId,
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
    divId,
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

function renderActivityPlot(divId) {
  const rows = state.rows;

  const key = rows.some(r => Number.isFinite(r.bis))
    ? "bis"
    : rows.some(r => Number.isFinite(r.fwhm))
      ? "fwhm"
      : null;

  if (!key) {
    Plotly.react(
      divId,
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
      name: `Pearson r = ${fmt(rValue, 3)}`,
      marker: { color: "#ffd15c" }
    });
  }

  Plotly.react(
    divId,
    traces,
    layout({
      title: `RV versus ${key.toUpperCase()}`,
      xaxis: { title: key.toUpperCase() },
      yaxis: { title: "RV (m/s)" },
      showlegend: true
    }),
    { responsive: true, displayModeBar: false }
  );
}

function renderActivitySummary() {
  const rows = state.rows;

  const key = rows.some(r => Number.isFinite(r.bis))
    ? "bis"
    : rows.some(r => Number.isFinite(r.fwhm))
      ? "fwhm"
      : null;

  if (!key) {
    safeSet("jitterScore", "UNKNOWN");
    safeSet("jitterText", "Upload BIS or FWHM columns to estimate activity correlation.");
    return;
  }

  const rValue = Math.abs(pearson(rows.map(r => r[key]), rows.map(r => r.rv)));

  if (!Number.isFinite(rValue)) {
    safeSet("jitterScore", "UNKNOWN");
    safeSet("jitterText", "Not enough valid activity points.");
    return;
  }

  if (rValue < 0.25) {
    safeSet("jitterScore", "LOW");
    safeSet("jitterText", `Weak RV–${key.toUpperCase()} correlation in the current dataset.`);
  } else if (rValue < 0.55) {
    safeSet("jitterScore", "MEDIUM");
    safeSet("jitterText", `Moderate RV–${key.toUpperCase()} correlation. Interpret the periodogram with caution.`);
  } else {
    safeSet("jitterScore", "HIGH");
    safeSet("jitterText", `Strong RV–${key.toUpperCase()} correlation. Signal may be activity-contaminated.`);
  }
}

function renderSJDEMatrix() {
  const matrix = document.getElementById("sjdeMatrix");
  if (!matrix) return;

  let html = "";
  for (let i = 0; i < 240; i++) {
    const hot = i % 17 === 0 || i % 29 === 0;
    const cold = i % 11 === 0 || i % 7 === 0;
    html += `<span class="matrix-cell ${hot ? "hot" : cold ? "cold" : ""}"></span>`;
  }

  matrix.innerHTML = html;
}

function renderReport() {
  const target = state.activeTarget || TARGETS[0];
  const rows = state.rows || [];

  const lines = [];
  lines.push("ODYSSEY EPRV OBSERVATORY — TARGET REPORT");
  lines.push("==================================================");
  lines.push("");
  lines.push(`Target planet:      ${target.planet}`);
  lines.push(`Host star:          ${target.host}`);
  lines.push(`Object type:        ${target.type}`);
  lines.push(`Coordinates:        RA ${target.ra}, Dec ${target.dec}`);
  lines.push(`Spectral type:      ${target.spt}`);
  lines.push(`Distance:           ${target.distance}`);
  lines.push(`Parallax:           ${target.parallax}`);
  lines.push("");
  lines.push("CATALOGUE-STYLE PLANET PARAMETERS");
  lines.push("--------------------------------------------------");
  lines.push(`Period:             ${target.period} d`);
  lines.push(`RV semi-amplitude:  ${target.k} m/s`);
  lines.push(`Eccentricity:       ${target.ecc}`);
  lines.push(`m sin i:            ${target.mass}`);
  lines.push(`Semi-major axis:    ${target.semiMajor}`);
  lines.push("");
  lines.push("CURRENT DATASET");
  lines.push("--------------------------------------------------");
  lines.push(`Mode:               ${state.mode}`);
  lines.push(`Source:             ${state.source}`);
  lines.push(`Rows:               ${rows.length}`);
  lines.push(`Instruments:        ${rows.length ? [...new Set(rows.map(r => r.inst))].join(", ") : "—"}`);
  lines.push(`Best GLS period:    ${state.gls ? fmt(state.gls.bestP, 6) + " d" : "not computed"}`);
  lines.push(`Fit RMS residual:   ${state.fit ? fmt(state.fit.rms, 3) + " m/s" : "not fitted"}`);
  lines.push("");
  lines.push("SCIENTIFIC HONESTY NOTE");
  lines.push("--------------------------------------------------");
  lines.push("Catalogue values and archive links provide context.");
  lines.push("Synthetic demo curves are not telescope measurements.");
  lines.push("Uploaded RV files are treated as user-provided data.");
  lines.push("");
  lines.push("ROADMAP");
  lines.push("--------------------------------------------------");
  lines.push("Future versions can add SIMBAD/Sesame resolution, NASA TAP");
  lines.push("queries, DACE-style time-series links, MAST photometry, Gaia");
  lines.push("astrometry, and line-by-line stellar-jitter modelling.");

  const box = document.getElementById("reportText");
  if (box) box.textContent = lines.join("\n");
}

function loadFile(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const rows = parseRV(reader.result);
      setData(rows, `User-uploaded RV data: ${file.name}`, "Uploaded RV Data");

      state.gls = computeGLS(rows);
      document.getElementById("periodInput").value = state.gls.bestP.toFixed(6);

      renderAllPlots();
      updateFitSummary();
      renderReport();
    } catch (err) {
      alert("Parse error: " + err.message);
    }
  };

  reader.readAsText(file);
}

function switchTab(tabId) {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === tabId);
  });

  setTimeout(() => {
    renderAllPlots();
    drawSkyCanvas(state.activeTarget || TARGETS[0]);
  }, 80);
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.getElementById("targetSearchBtn").addEventListener("click", () => {
    const target = findTarget(document.getElementById("targetSearch").value);
    setTarget(target);
  });

  document.getElementById("targetSearch").addEventListener("keydown", event => {
    if (event.key === "Enter") {
      const target = findTarget(event.target.value);
      setTarget(target);
    }
  });

  document.getElementById("fileInput").addEventListener("change", event => {
    loadFile(event.target.files[0]);
  });

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

  document.getElementById("demoBtn").addEventListener("click", () => {
    loadSyntheticDemo(state.activeTarget || TARGETS[0]);
  });

  document.getElementById("runPeriodogramBtn").addEventListener("click", () => {
    if (!state.rows.length) return;

    state.gls = computeGLS(state.rows);
    document.getElementById("periodInput").value = state.gls.bestP.toFixed(6);

    renderAllPlots();
    updateFitSummary();
    renderReport();
  });

  document.getElementById("fitBtn").addEventListener("click", () => {
    if (!state.rows.length) return;

    const P = parseFloat(document.getElementById("periodInput").value);

    if (!Number.isFinite(P) || P <= 0) {
      alert("Enter a valid period before fitting.");
      return;
    }

    state.fit = fitAtPeriod(state.rows, P);

    renderAllPlots();
    updateFitSummary();
    renderActivitySummary();
    renderReport();
  });

  document.getElementById("refreshReportBtn").addEventListener("click", renderReport);

  document.getElementById("copyReportBtn").addEventListener("click", async () => {
    const text = document.getElementById("reportText").textContent;
    await navigator.clipboard.writeText(text);
    alert("Report copied to clipboard.");
  });
}

function init() {
  setUTCClock();
  setInterval(setUTCClock, 1000);

  renderTargetList();
  renderSJDEMatrix();
  bindEvents();
  setTarget(TARGETS[0]);
  switchTab("dashboard");
}

init();
