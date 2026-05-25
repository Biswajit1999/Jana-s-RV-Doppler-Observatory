const LOCAL_RV_LIBRARY_INDEX = 'sample_data/rv_library/jana_rv_web_target_index.json?v=20260525-nasa-dace';
const LOCAL_RV_LIBRARY_BASE = 'sample_data/rv_library/';

const localRVLibraryState = {
  index: [],
  filtered: [],
  loaded: false,
  lastQuery: ''
};

function injectLocalRVLibrary(){
  if(document.getElementById('localrv')) return;

  const nav = document.querySelector('.side-nav');
  const main = document.querySelector('.main-console');
  if(!nav || !main) return;

  const localButton = document.createElement('button');
  localButton.className = 'nav-item';
  localButton.dataset.tab = 'localrv';
  localButton.innerHTML = '<span>✶</span> Local RV Library';

  const rvButton = nav.querySelector('[data-tab="rvdata"]');
  if(rvButton) rvButton.after(localButton); else nav.appendChild(localButton);

  localButton.addEventListener('click', () => {
    if(typeof switchTab === 'function') switchTab('localrv');
    else document.getElementById('localrv')?.scrollIntoView({behavior:'smooth'});
    loadLocalRVLibrary();
  });

  const panel = document.createElement('section');
  panel.className = 'tab-panel';
  panel.id = 'localrv';
  panel.innerHTML = `
    <div class="section-intro local-rv-intro">
      <div>
        <p class="eyebrow">NASA + DACE real-data bundle</p>
        <h3>Local RV Library</h3>
        <p>This module reads the real RV bundle committed to GitHub Pages. It does not need the Python backend for the top bundled targets: search, load, plot, period-scan and fit directly from static CSV files.</p>
      </div>
      <div class="local-rv-actions"><button id="loadLocalRVIndexBtn">Load library index</button><button id="openRVDataTabBtn">Open upload tools</button></div>
    </div>

    <div class="dashboard-grid local-rv-metrics">
      <section class="panel"><div class="panel-head"><h3>Library targets</h3><span id="localRVIndexFlag" class="warn">NOT LOADED</span></div><div class="metric-big"><strong id="localRVTargetCount">—</strong><span>bundled targets</span></div></section>
      <section class="panel"><div class="panel-head"><h3>Total RV rows</h3><span class="ok">REAL DATA</span></div><div class="metric-big"><strong id="localRVRowCount">—</strong><span>measurements indexed</span></div></section>
      <section class="panel"><div class="panel-head"><h3>Source mix</h3><span class="ok">NASA + DACE</span></div><div id="localRVSourceMix" class="mini-source-mix">Load the index to summarise archives.</div></section>
    </div>

    <section class="panel mt-panel local-rv-search-panel">
      <div class="panel-head"><h3>Search real RV targets</h3><span id="localRVSearchFlag" class="warn">WAITING</span></div>
      <div class="local-rv-search-row"><input id="localRVSearch" placeholder="Search target, instrument, archive… e.g. HD 20794, 51 Peg, HARPS, DACE"><button id="localRVSearchBtn">Search</button><button id="localRVShowTopBtn">Show top targets</button></div>
      <p id="localRVMessage" class="panel-note">Load the index first. Then click Load beside a target to plot real RV observations immediately.</p>
      <div class="table-wrap local-rv-table-wrap"><table id="localRVTable"><tr><td>Local RV library not loaded yet.</td></tr></table></div>
    </section>
  `;

  const analysis = document.getElementById('analysis');
  if(analysis) main.insertBefore(panel, analysis); else main.appendChild(panel);

  const style = document.createElement('style');
  style.textContent = `.local-rv-intro{display:flex;justify-content:space-between;gap:18px;align-items:flex-end}.local-rv-actions{display:flex;gap:8px;flex-wrap:wrap}.metric-big{padding:20px}.metric-big strong{display:block;font-size:2rem;color:var(--cyan);line-height:1}.metric-big span{color:var(--muted);font-family:'JetBrains Mono',monospace;text-transform:uppercase;font-size:.66rem;letter-spacing:.08em}.mini-source-mix{padding:20px;color:var(--muted);line-height:1.7}.local-rv-search-row{display:flex;gap:8px;flex-wrap:wrap;padding:16px 16px 6px}.local-rv-search-row input{flex:1;min-width:260px;background:color-mix(in srgb,var(--bg) 92%,white 8%);border:1px solid var(--line);border-radius:12px;color:var(--text);padding:11px 12px}.local-rv-table-wrap{max-height:560px;overflow:auto}.local-rv-table-wrap table button{white-space:nowrap}.local-rv-badge{display:inline-flex;gap:5px;align-items:center;border:1px solid var(--line);padding:4px 7px;border-radius:999px;color:var(--cyan);font-size:.7rem}.local-rv-loaded-flash{animation:localFlash 1.2s ease}@keyframes localFlash{0%{box-shadow:0 0 0 rgba(38,240,255,0)}40%{box-shadow:0 0 35px rgba(38,240,255,.35)}100%{box-shadow:0 0 0 rgba(38,240,255,0)}}@media(max-width:760px){.local-rv-intro{display:block}.local-rv-actions{margin-top:14px}.local-rv-metrics{grid-template-columns:1fr}}`;
  document.head.appendChild(style);

  document.getElementById('loadLocalRVIndexBtn').addEventListener('click', loadLocalRVLibrary);
  document.getElementById('localRVSearchBtn').addEventListener('click', () => filterLocalRVLibrary(document.getElementById('localRVSearch').value));
  document.getElementById('localRVSearch').addEventListener('input', e => filterLocalRVLibrary(e.target.value));
  document.getElementById('localRVShowTopBtn').addEventListener('click', () => { document.getElementById('localRVSearch').value=''; filterLocalRVLibrary(''); });
  document.getElementById('openRVDataTabBtn').addEventListener('click', () => typeof switchTab === 'function' ? switchTab('rvdata') : null);

  const heroActions = document.querySelector('.hero-panel .button-row');
  if(heroActions && !document.getElementById('jumpLocalLibraryBtn')){
    const btn = document.createElement('button');
    btn.id = 'jumpLocalLibraryBtn';
    btn.textContent = 'Open local RV library';
    btn.addEventListener('click', () => { if(typeof switchTab === 'function') switchTab('localrv'); loadLocalRVLibrary(); });
    heroActions.appendChild(btn);
  }
}

async function loadLocalRVLibrary(){
  const table = document.getElementById('localRVTable');
  if(table) table.innerHTML = '<tr><td>Loading local RV library index…</td></tr>';
  setFlagSafe('localRVIndexFlag','LOADING','warn');
  try{
    const response = await fetch(LOCAL_RV_LIBRARY_INDEX, {cache:'no-cache'});
    if(!response.ok) throw new Error(`Library index HTTP ${response.status}`);
    const index = await response.json();
    if(!Array.isArray(index) || !index.length) throw new Error('Library index is empty');
    localRVLibraryState.index = index;
    localRVLibraryState.loaded = true;
    setFlagSafe('localRVIndexFlag','READY','ok');
    updateLocalRVStats(index);
    filterLocalRVLibrary(document.getElementById('localRVSearch')?.value || '');
  }catch(err){
    setFlagSafe('localRVIndexFlag','FAILED','bad');
    safeSetLocal('localRVMessage', `Could not load local RV library: ${err.message}`);
    if(table) table.innerHTML = `<tr><td>Failed to load local RV library: ${escLocal(err.message)}</td></tr>`;
  }
}

function updateLocalRVStats(index){
  safeSetLocal('localRVTargetCount', index.length.toLocaleString());
  const rows = index.reduce((a,r)=>a+(Number(r.rows)||0),0);
  safeSetLocal('localRVRowCount', rows.toLocaleString());
  const mix = {};
  index.forEach(r => String(r.archives||'UNKNOWN').split(';').forEach(a => { if(a) mix[a]=(mix[a]||0)+1; }));
  const mixText = Object.entries(mix).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="local-rv-badge">${escLocal(k)}: ${v}</span>`).join(' ');
  const el = document.getElementById('localRVSourceMix');
  if(el) el.innerHTML = mixText || 'No archive labels found.';
  safeSetLocal('localRVMessage', `Loaded ${index.length.toLocaleString()} bundled targets with ${rows.toLocaleString()} RV measurements. Search or load a target.`);
}

function filterLocalRVLibrary(query=''){
  if(!localRVLibraryState.loaded){ loadLocalRVLibrary(); return; }
  const q = String(query||'').trim().toLowerCase();
  localRVLibraryState.lastQuery = q;
  const rows = localRVLibraryState.index.filter(r => {
    if(!q) return true;
    const hay = `${r.target||''} ${r.archives||''} ${r.instruments||''} ${r.file_name||''}`.toLowerCase();
    return hay.includes(q);
  }).slice(0, 80);
  localRVLibraryState.filtered = rows;
  setFlagSafe('localRVSearchFlag', q ? `${rows.length} MATCHES` : 'TOP TARGETS', rows.length ? 'ok' : 'warn');
  renderLocalRVTable(rows);
}

function renderLocalRVTable(rows){
  const table = document.getElementById('localRVTable');
  if(!table) return;
  if(!rows.length){ table.innerHTML='<tr><td>No matching RV target found in the bundled local library.</td></tr>'; return; }
  table.innerHTML = `<thead><tr><th>Target</th><th>Rows</th><th>Archives</th><th>Instruments</th><th>BJD span</th><th>Action</th></tr></thead><tbody>${rows.map((r,i)=>{
    const span = `${fmtLocal(r.bjd_min,1)}–${fmtLocal(r.bjd_max,1)}`;
    const instruments = String(r.instruments||'').split(';').slice(0,6).join(', ');
    const globalIndex = localRVLibraryState.index.indexOf(r);
    return `<tr><td><strong>${escLocal(r.target)}</strong></td><td>${Number(r.rows||0).toLocaleString()}</td><td>${escLocal(r.archives||'—')}</td><td>${escLocal(instruments||'—')}</td><td>${escLocal(span)}</td><td><button onclick="loadLocalRVTarget(${globalIndex})">Load + plot</button></td></tr>`;
  }).join('')}</tbody>`;
}

async function loadLocalRVTarget(index){
  const row = localRVLibraryState.index[index];
  if(!row) return alert('Target row not found in local library index.');
  const file = row.relative_file || `data/${row.file_name}`;
  const url = LOCAL_RV_LIBRARY_BASE + file.replace(/^\/+/, '');
  safeSetLocal('localRVMessage', `Loading ${row.target} from ${url}…`);
  try{
    const response = await fetch(url, {cache:'no-cache'});
    if(!response.ok) throw new Error(`Target CSV HTTP ${response.status}`);
    const csv = await response.text();
    const rows = parseRV(csv);
    setData(rows, `Local NASA+DACE RV library: ${row.target}`);
    setTargetFromLibraryRow(row, rows);
    safeSetLocal('localRVMessage', `Loaded ${rows.length.toLocaleString()} RV rows for ${row.target}. Dashboard plots are live; run the period scan next.`);
    document.getElementById('localrv')?.classList.add('local-rv-loaded-flash');
    setTimeout(()=>document.getElementById('localrv')?.classList.remove('local-rv-loaded-flash'),1300);
    if(typeof switchTab === 'function') switchTab('dashboard');
  }catch(err){
    safeSetLocal('localRVMessage', `Could not load target CSV: ${err.message}`);
    alert(`Local RV target load failed: ${err.message}`);
  }
}

function setTargetFromLibraryRow(row, rows){
  const rv = rows.map(r=>r.rv).filter(Number.isFinite);
  const kGuess = rv.length ? (Math.max(...rv)-Math.min(...rv))/2 : NaN;
  const t = {
    planet: row.target || 'Local RV target',
    host: row.target || 'Local RV target',
    aliases: [String(row.target||'').toLowerCase()],
    method: String(row.archives||'NASA/DACE RV'),
    year: '—',
    ra: '—',
    dec: '—',
    raDeg: NaN,
    decDeg: NaN,
    spt: '—',
    vmag: '—',
    distance: '—',
    parallax: '—',
    period: NaN,
    k: Number.isFinite(kGuess) ? kGuess : '—',
    ecc: 0,
    mass: '—',
    semiMajor: '—'
  };
  if(typeof setTarget === 'function') setTarget(t, 'Local NASA+DACE RV library');
  const periodInput = document.getElementById('periodInput');
  if(periodInput) periodInput.value = '';
  const kInput = document.getElementById('kInput');
  if(kInput && Number.isFinite(kGuess)) kInput.value = kGuess.toFixed(3);
}

function setFlagSafe(id,text,cls){
  const e=document.getElementById(id); if(!e) return;
  e.textContent=text; e.className=cls;
}
function safeSetLocal(id,text){ const e=document.getElementById(id); if(e) e.textContent=text; }
function escLocal(s){ return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function fmtLocal(v,d=2){ return Number.isFinite(Number(v)) ? Number(v).toFixed(d) : '—'; }

window.loadLocalRVTarget = loadLocalRVTarget;
window.loadLocalRVLibrary = loadLocalRVLibrary;

window.addEventListener('DOMContentLoaded', () => setTimeout(injectLocalRVLibrary, 1050));
