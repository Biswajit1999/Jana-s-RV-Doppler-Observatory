function injectBackendConsole(){
  if(document.getElementById('backendConsolePanel')) return;
  const targetTab=document.getElementById('target');
  const rvTab=document.getElementById('rvdata');
  if(!targetTab || !rvTab) return;

  // Remove the old client-only uploader from the visible workflow. It was useful for strict CSVs,
  // but it causes the confusing "Missing BJD/time or RV column" alert for archive tables.
  const legacyUploadGrid = rvTab.querySelector('#fileInput')?.closest('.two-column-grid');
  if(legacyUploadGrid){
    legacyUploadGrid.classList.add('legacy-upload-hidden');
    legacyUploadGrid.setAttribute('aria-hidden','true');
  }

  const cachePanel=document.createElement('section');
  cachePanel.className='panel mt-panel backend-console';
  cachePanel.id='backendConsolePanel';
  cachePanel.innerHTML=`
    <div class="panel-head"><h3>Backend cache console</h3><span id="cacheBadge" class="warn">NOT CHECKED</span></div>
    <div class="backend-console-body">
      <div class="backend-copy"><strong>Build a local archive snapshot for faster/offline searches.</strong><p>The backend can cache NASA target metadata and the RV source index locally inside backend/cache. Once built, offline mode can use cached rows without contacting the archive every time.</p></div>
      <div class="backend-actions"><button id="cacheStatusBtn">Check cache</button><button id="buildTargetCacheBtn">Build target cache</button><button id="buildRvIndexBtn">Build RV source index</button><button id="toggleOfflineBtn">Offline mode: off</button></div>
      <div class="progress-track cache-progress"><b id="cacheBar" style="width:0%"></b></div>
      <pre id="cacheStatusBox" class="backend-status-box">Cache status not checked.</pre>
    </div>`;
  const refTable=targetTab.querySelector('.panel.mt-panel');
  if(refTable) targetTab.insertBefore(cachePanel, refTable); else targetTab.appendChild(cachePanel);

  const uploadPanel=document.createElement('section');
  uploadPanel.className='panel mt-panel backend-upload-console primary-rv-upload';
  uploadPanel.id='backendUploadPanel';
  uploadPanel.innerHTML=`
    <div class="panel-head"><h3>Single RV data ingestion</h3><span id="uploadParserBadge" class="warn">BACKEND PARSER</span></div>
    <div class="backend-console-body">
      <div class="backend-copy"><strong>Use this as the only upload box.</strong><p>The old browser-only CSV uploader is now hidden. This backend parser accepts CSV, TSV, TXT, DAT, XML and VOTable-style files, previews the columns first, then lets you map Time, RV, RV error and Instrument before plotting.</p></div>
      <label class="backend-drop-zone"><input id="backendFileInput" type="file" accept=".csv,.tsv,.txt,.dat,.vot,.xml,.votable" /><span>Choose RV table / VOTable file</span><small>Preview first → choose columns → import mapped table</small></label>
      <div class="backend-actions"><button id="previewBackendFileBtn">1. Preview file columns</button><button id="importBackendFileBtn">2. Import mapped file + plot</button></div>
      <div class="mapper-grid backend-map-grid">
        <label>Time column<select id="uploadMapTime"></select></label>
        <label>RV column<select id="uploadMapRv"></select></label>
        <label>RV error column<select id="uploadMapErr"></select></label>
        <label>Instrument column<select id="uploadMapInst"></select></label>
      </div>
      <p id="backendUploadStatus" class="backend-upload-status">Choose a file, then preview it through the backend. If your file is not an RV table, preview may work but import will ask for a proper time and RV column.</p>
      <div class="table-wrap"><table id="backendUploadPreview"><tr><td>No backend upload preview loaded.</td></tr></table></div>
    </div>`;

  // Put the single backend uploader at the top of the RV Data tab.
  const firstVisible = [...rvTab.children].find(el => !el.classList?.contains('legacy-upload-hidden'));
  if(firstVisible) rvTab.insertBefore(uploadPanel, firstVisible); else rvTab.prepend(uploadPanel);

  const style=document.createElement('style');
  style.textContent=`.legacy-upload-hidden{display:none!important}.backend-console-body{padding:16px}.backend-copy strong{display:block;color:var(--cyan);font-size:1.08rem}.backend-copy p,.backend-upload-status{color:var(--muted);line-height:1.6}.backend-actions{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.backend-status-box{border:1px solid var(--line);background:color-mix(in srgb,var(--bg) 88%,transparent);border-radius:14px;color:var(--text);padding:14px;min-height:135px;white-space:pre-wrap;font-family:'JetBrains Mono',monospace;font-size:.75rem;line-height:1.55}.cache-progress{margin:10px 0 14px}.backend-drop-zone{display:grid;place-items:center;text-align:center;width:100%;border:1px dashed var(--line2);background:linear-gradient(135deg,var(--glass),color-mix(in srgb,var(--panel) 85%,transparent));color:var(--text);border-radius:18px;padding:24px;margin:14px 0;cursor:pointer;transition:.18s ease}.backend-drop-zone:hover{border-color:var(--cyan);box-shadow:var(--glow);transform:translateY(-1px)}.backend-drop-zone input{display:none}.backend-drop-zone span{font-weight:900;color:var(--cyan);font-size:1rem}.backend-drop-zone small{display:block;color:var(--muted);margin-top:6px}.backend-map-grid{margin-top:10px}.primary-rv-upload{border-color:color-mix(in srgb,var(--cyan) 40%,var(--line))}`;
  document.head.appendChild(style);

  document.getElementById('cacheStatusBtn').addEventListener('click',checkCacheStatus);
  document.getElementById('buildTargetCacheBtn').addEventListener('click',buildTargetCache);
  document.getElementById('buildRvIndexBtn').addEventListener('click',buildRvIndexCache);
  document.getElementById('toggleOfflineBtn').addEventListener('click',toggleOfflineMode);
  document.getElementById('previewBackendFileBtn').addEventListener('click',previewBackendFile);
  document.getElementById('importBackendFileBtn').addEventListener('click',importBackendFile);
  document.getElementById('backendFileInput').addEventListener('change',()=>{
    const file=document.getElementById('backendFileInput').files[0];
    if(file){document.getElementById('backendUploadStatus').textContent=`Selected ${file.name}. Click “Preview file columns” before importing.`;}
  });
  refreshOfflineButton();
}

function cacheProgress(percent,message,badge='WORKING',cls='warn'){
  const bar=document.getElementById('cacheBar'); if(bar) bar.style.width=`${percent}%`;
  const box=document.getElementById('cacheStatusBox'); if(box) box.textContent=message;
  const b=document.getElementById('cacheBadge'); if(b){b.textContent=badge;b.className=cls;}
}

async function checkCacheStatus(){
  const base=currentApiBase(); if(!base) return alert('Set API Base URL first.');
  cacheProgress(20,'Checking backend cache status...','CHECKING','warn');
  try{
    const r=await fetch(`${base}/api/cache/status`);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const j=await r.json();
    cacheProgress(100,JSON.stringify(j,null,2),'READY','ok');
  }catch(e){cacheProgress(100,e.message,'FAILED','bad');}
}

async function buildTargetCache(){
  const base=currentApiBase(); if(!base) return alert('Set API Base URL first.');
  cacheProgress(15,'Building target cache from NASA TAP. This can take a little while...','BUILDING','warn');
  try{
    const r=await fetch(`${base}/api/cache/build?limit=5000`,{method:'POST'});
    if(!r.ok) throw new Error(await r.text());
    const j=await r.json();
    cacheProgress(100,JSON.stringify(j,null,2),'TARGET CACHE','ok');
  }catch(e){cacheProgress(100,String(e).slice(0,600),'FAILED','bad');}
}

async function buildRvIndexCache(){
  const base=currentApiBase(); if(!base) return alert('Set API Base URL first.');
  cacheProgress(15,'Building RV source index cache from NASA RADIAL listing...','BUILDING','warn');
  try{
    const r=await fetch(`${base}/api/cache/build-rv-index`,{method:'POST'});
    if(!r.ok) throw new Error(await r.text());
    const j=await r.json();
    cacheProgress(100,JSON.stringify(j,null,2),'RV INDEX','ok');
  }catch(e){cacheProgress(100,String(e).slice(0,600),'FAILED','bad');}
}

function refreshOfflineButton(){
  const btn=document.getElementById('toggleOfflineBtn'); if(!btn) return;
  const on=localStorage.getItem('jana_offline_mode')==='1';
  btn.textContent=`Offline mode: ${on?'on':'off'}`;
}
function toggleOfflineMode(){
  const on=localStorage.getItem('jana_offline_mode')==='1';
  localStorage.setItem('jana_offline_mode',on?'0':'1');
  refreshOfflineButton();
  cacheProgress(100,`Offline mode is now ${on?'off':'on'}. Source searches will ${on?'use live archive calls':'prefer cached indexes where supported'}.`,on?'ONLINE':'OFFLINE',on?'ok':'warn');
}

function fillUploadColumnSelects(columns,mapping={}){
  [['uploadMapTime',mapping.time_col],['uploadMapRv',mapping.rv_col],['uploadMapErr',mapping.err_col],['uploadMapInst',mapping.inst_col]].forEach(([id,selected])=>{
    const sel=document.getElementById(id); if(!sel) return;
    sel.innerHTML='<option value="">None / default</option>'+columns.map(c=>`<option value="${String(c).replace(/"/g,'&quot;')}">${c}</option>`).join('');
    if(selected) sel.value=selected;
  });
}
function renderBackendUploadPreview(columns,rows){
  const table=document.getElementById('backendUploadPreview'); if(!table) return;
  table.innerHTML=`<thead><tr>${columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map((_,i)=>`<td>${esc(r[i]??'')}</td>`).join('')}</tr>`).join('')}</tbody>`;
}

async function previewBackendFile(){
  const base=currentApiBase(); if(!base) return alert('Set API Base URL first.');
  const file=document.getElementById('backendFileInput').files[0]; if(!file) return alert('Choose a file first.');
  document.getElementById('backendUploadStatus').textContent='Uploading to backend for preview...';
  const fd=new FormData(); fd.append('file',file);
  try{
    const r=await fetch(`${base}/api/preview-rv-upload`,{method:'POST',body:fd});
    if(!r.ok) throw new Error(await r.text());
    const j=await r.json();
    fillUploadColumnSelects(j.raw_columns||[],j.suggested_mapping||{});
    renderBackendUploadPreview(j.raw_columns||[],j.sample_rows||[]);
    document.getElementById('backendUploadStatus').textContent=`Preview loaded: ${j.n_columns} columns, ${j.n_preview_rows} sample rows. Check mapping, then import.`;
    const b=document.getElementById('uploadParserBadge'); if(b){b.textContent='PREVIEW READY';b.className='ok';}
  }catch(e){document.getElementById('backendUploadStatus').textContent=String(e).slice(0,600);const b=document.getElementById('uploadParserBadge'); if(b){b.textContent='FAILED';b.className='bad';}}
}

async function importBackendFile(){
  const base=currentApiBase(); if(!base) return alert('Set API Base URL first.');
  const file=document.getElementById('backendFileInput').files[0]; if(!file) return alert('Choose a file first.');
  const fd=new FormData(); fd.append('file',file); fd.append('instrument','UPLOAD');
  const m=[['time_col','uploadMapTime'],['rv_col','uploadMapRv'],['err_col','uploadMapErr'],['inst_col','uploadMapInst']];
  m.forEach(([key,id])=>{const v=document.getElementById(id).value;if(v)fd.append(key,v);});
  document.getElementById('backendUploadStatus').textContent='Importing mapped file through backend...';
  try{
    const r=await fetch(`${base}/api/import-rv-upload`,{method:'POST',body:fd});
    if(!r.ok) throw new Error(await r.text());
    const j=await r.json();
    setData(parseRV(j.csv),`Backend upload import: ${file.name}`);
    document.getElementById('backendUploadStatus').textContent=`Imported ${j.n_rows} rows. Rejected ${j.rejected_rows||0}. Plots are live.`;
    const b=document.getElementById('uploadParserBadge'); if(b){b.textContent='IMPORTED';b.className='ok';}
    switchTab('dashboard');
  }catch(e){document.getElementById('backendUploadStatus').textContent=String(e).slice(0,700);const b=document.getElementById('uploadParserBadge'); if(b){b.textContent='FAILED';b.className='bad';}}
}

window.addEventListener('DOMContentLoaded',()=>setTimeout(injectBackendConsole,850));