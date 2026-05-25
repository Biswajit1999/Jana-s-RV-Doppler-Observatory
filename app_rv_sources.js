function injectRVSourceHunter(){
  if(document.getElementById('rvSourceHunter')) return;
  const rvTab = document.getElementById('rvdata');
  if(!rvTab) return;

  const panel = document.createElement('section');
  panel.className = 'panel mt-panel rv-hunter';
  panel.id = 'rvSourceHunter';
  panel.innerHTML = `
    <div class="panel-head"><h3>RV source hunter</h3><span id="rvHunterBadge" class="warn">BACKEND REQUIRED</span></div>
    <div class="rv-hunter-body">
      <div class="rv-hunter-copy">
        <strong>Search available RV files</strong>
        <p>This asks the Python backend to scan known archive routes and NASA RADIAL bulk listings for machine-readable RV candidates. Importable rows can be converted automatically to BJD, RV, RV_ERR, INSTRUMENT and plotted in this console.</p>
      </div>
      <div class="rv-hunter-actions">
        <button id="searchRvSourcesBtn">Search available RV files</button>
        <button id="openRvResourcesBtn">Open NASA RV resources</button>
      </div>
      <div class="progress-track rv-progress"><b id="rvHunterBar" style="width:0%"></b></div>
      <p id="rvHunterMessage" class="rv-hunter-message">Fetch a target first, then search for real RV sources.</p>
      <div class="table-wrap"><table id="rvSourcesTable"><tr><td>No source search run yet.</td></tr></table></div>
      <div class="manual-import">
        <label>Import machine-readable RV URL <input id="manualRvUrl" placeholder="https://...csv / .txt / .dat"></label>
        <button id="importManualRvBtn">Import URL</button>
      </div>
    </div>`;

  const preview = rvTab.querySelector('.panel.mt-panel');
  if(preview) rvTab.insertBefore(panel, preview); else rvTab.appendChild(panel);

  const style = document.createElement('style');
  style.textContent = `.rv-hunter-body{padding:16px}.rv-hunter-copy strong{display:block;color:var(--cyan);font-size:1rem}.rv-hunter-copy p,.rv-hunter-message{color:var(--muted);line-height:1.6}.rv-hunter-actions{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.rv-progress{margin:10px 0 14px}.manual-import{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.manual-import label{flex:1;min-width:260px;color:var(--dim);font-family:'JetBrains Mono',monospace;font-size:.62rem;text-transform:uppercase}.manual-import input{display:block;margin-top:6px;width:100%;background:color-mix(in srgb,var(--bg) 92%,white 8%);border:1px solid var(--line);border-radius:12px;color:var(--text);padding:11px 12px}.source-status-ok{color:var(--green)}.source-status-warn{color:var(--amber)}.source-status-bad{color:var(--red)}`;
  document.head.appendChild(style);

  document.getElementById('searchRvSourcesBtn').addEventListener('click', searchRVSources);
  document.getElementById('openRvResourcesBtn').addEventListener('click', () => window.open('https://exoplanetarchive.ipac.caltech.edu/docs/rv.html','_blank'));
  document.getElementById('importManualRvBtn').addEventListener('click', () => importRvUrl(document.getElementById('manualRvUrl').value));
}

function rvHunterProgress(percent, message, badge='WORKING', cls='warn'){
  const bar=document.getElementById('rvHunterBar'); if(bar) bar.style.width=`${percent}%`;
  const msg=document.getElementById('rvHunterMessage'); if(msg) msg.textContent=message;
  const b=document.getElementById('rvHunterBadge'); if(b){b.textContent=badge;b.className=cls;}
}

function currentApiBase(){
  const input=document.getElementById('apiBase');
  return ((input && input.value) || localStorage.getItem('jana_api_base') || '').replace(/\/$/,'');
}

async function searchRVSources(){
  const base=currentApiBase();
  if(!base) return alert('Set API Base URL first, for example http://127.0.0.1:8010');
  const target=(state && state.target && (state.target.planet || state.target.host)) || '51 Peg b';
  rvHunterProgress(20, `Searching archive source routes for ${target}...`, 'SEARCHING', 'warn');
  try{
    const r=await fetch(`${base}/api/rv-sources?name=${encodeURIComponent(target)}`);
    if(!r.ok) throw new Error(`Backend returned HTTP ${r.status}`);
    rvHunterProgress(65, 'Parsing source candidates...', 'PARSING', 'warn');
    const data=await r.json();
    renderRVSources(data.sources || []);
    const n=(data.sources||[]).filter(s=>s.importable).length;
    rvHunterProgress(100, n ? `${n} importable candidate(s) found. Click Import beside a source.` : 'No direct importable file found yet. Use manual archive links or paste a machine-readable URL.', n?'READY':'MANUAL', n?'ok':'warn');
  }catch(e){
    rvHunterProgress(100, e.message, 'FAILED', 'bad');
    alert(e.message);
  }
}

function renderRVSources(sources){
  const table=document.getElementById('rvSourcesTable');
  if(!sources.length){table.innerHTML='<tr><td>No source candidates found.</td></tr>';return;}
  table.innerHTML=`<thead><tr><th>Source</th><th>Kind</th><th>Title</th><th>Status</th><th>Action</th></tr></thead><tbody>${sources.map((s,i)=>{
    const statusClass=s.importable?'source-status-ok':(s.status||'').includes('could not')?'source-status-bad':'source-status-warn';
    const action=s.importable?`<button onclick="importRvUrl('${String(s.url).replace(/'/g,'%27')}')">Import</button>`:`<button onclick="window.open('${String(s.url).replace(/'/g,'%27')}','_blank')">Open</button>`;
    return `<tr><td>${esc(s.source)}</td><td>${esc(s.kind)}</td><td>${esc(s.title)}</td><td class="${statusClass}">${esc(s.status)}</td><td>${action}</td></tr>`;
  }).join('')}</tbody>`;
}

async function importRvUrl(url){
  const base=currentApiBase();
  if(!base) return alert('Set API Base URL first.');
  if(!url || !String(url).startsWith('https://')) return alert('Paste a valid https:// machine-readable RV table URL.');
  rvHunterProgress(20, 'Downloading remote RV table through Python backend...', 'IMPORTING', 'warn');
  try{
    const r=await fetch(`${base}/api/import-rv-url?url=${encodeURIComponent(url)}&instrument=REMOTE`);
    if(!r.ok){ const text=await r.text(); throw new Error(text.slice(0,300)); }
    rvHunterProgress(70, 'Normalising columns to BJD, RV, RV_ERR, INSTRUMENT...', 'NORMALISING', 'warn');
    const data=await r.json();
    const rows=parseRV(data.csv);
    setData(rows, `Remote RV import: ${url}`);
    rvHunterProgress(100, `Imported ${data.n_rows} RV rows and plotted them. Next: open Analysis and run period scan.`, 'IMPORTED', 'ok');
    switchTab('overview');
  }catch(e){
    rvHunterProgress(100, e.message, 'FAILED', 'bad');
    alert(`RV import failed: ${e.message}`);
  }
}

window.addEventListener('DOMContentLoaded', () => setTimeout(injectRVSourceHunter, 250));
