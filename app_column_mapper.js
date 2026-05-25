function injectAdapterConsole(){
  if(document.getElementById('adapterConsolePanel')) return;
  const rvTab=document.getElementById('rvdata');
  if(!rvTab) return;

  const panel=document.createElement('section');
  panel.className='panel mt-panel adapter-console';
  panel.id='adapterConsolePanel';
  panel.innerHTML=`
    <div class="panel-head"><h3>Universal RV table adapter</h3><span id="adapterBadge" class="warn">PREVIEW MODE</span></div>
    <div class="adapter-layout">
      <div class="adapter-copy">
        <strong>Paste any machine-readable RV table URL, preview columns, map them, then plot directly.</strong>
        <p>This is the bridge between NASA, VizieR, DACE exports, GitHub raw CSV files and literature tables. The Python backend downloads the table; this console lets you select the time, RV, uncertainty and instrument columns before importing.</p>
      </div>
      <div class="adapter-url-row">
        <input id="adapterUrl" placeholder="https://... machine-readable CSV/TXT/DAT/VizieR table export">
        <button id="previewAdapterUrl">Preview columns</button>
      </div>
      <div class="adapter-status" id="adapterStatus">Waiting for a machine-readable table URL.</div>
      <div class="mapper-grid">
        <label>Time column<select id="mapTime"></select></label>
        <label>RV column<select id="mapRv"></select></label>
        <label>RV error column<select id="mapErr"></select></label>
        <label>Instrument column<select id="mapInst"></select></label>
      </div>
      <div class="button-row flush"><button id="importMappedTable">Import mapped table</button><button id="copyAdapterCurl">Copy backend URL</button></div>
      <div class="table-wrap"><table id="adapterPreviewTable"><tr><td>No preview loaded.</td></tr></table></div>
    </div>`;

  const sourceHunter=document.getElementById('rvSourceHunter');
  if(sourceHunter) sourceHunter.after(panel); else rvTab.appendChild(panel);

  const style=document.createElement('style');
  style.textContent=`.adapter-layout{padding:16px}.adapter-copy strong{display:block;color:var(--cyan);font-size:1.15rem}.adapter-copy p,.adapter-status{color:var(--muted);line-height:1.6}.adapter-url-row{display:flex;gap:8px;margin:14px 0;flex-wrap:wrap}.adapter-url-row input{flex:1;min-width:320px;background:color-mix(in srgb,var(--bg) 92%,white 8%);border:1px solid var(--line);border-radius:12px;color:var(--text);padding:11px 12px}.mapper-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.mapper-grid label{font-family:'JetBrains Mono',monospace;color:var(--dim);font-size:.62rem;text-transform:uppercase;font-weight:900;letter-spacing:.08em}.mapper-grid select{display:block;width:100%;margin-top:6px;background:color-mix(in srgb,var(--bg) 92%,white 8%);border:1px solid var(--line);border-radius:12px;color:var(--text);padding:10px}@media(max-width:980px){.mapper-grid{grid-template-columns:1fr 1fr}}@media(max-width:640px){.mapper-grid{grid-template-columns:1fr}.adapter-url-row input{min-width:100%}}`;
  document.head.appendChild(style);

  document.getElementById('previewAdapterUrl').addEventListener('click',previewAdapterUrl);
  document.getElementById('importMappedTable').addEventListener('click',importMappedAdapterTable);
  document.getElementById('copyAdapterCurl').addEventListener('click',copyAdapterEndpoint);
}

function adapterBase(){
  if(typeof currentApiBase === 'function') return currentApiBase();
  return ((document.getElementById('apiBase')?.value||localStorage.getItem('jana_api_base')||'').replace(/\/$/,''));
}

function setAdapterStatus(message,badge='PREVIEW',cls='warn'){
  const st=document.getElementById('adapterStatus'); if(st) st.textContent=message;
  const b=document.getElementById('adapterBadge'); if(b){b.textContent=badge;b.className=cls;}
}

function fillColumnSelects(columns,mapping={}){
  const ids=[['mapTime',mapping.time_col],['mapRv',mapping.rv_col],['mapErr',mapping.err_col],['mapInst',mapping.inst_col]];
  ids.forEach(([id,selected])=>{
    const sel=document.getElementById(id); if(!sel) return;
    sel.innerHTML='<option value="">None / default</option>'+columns.map(c=>`<option value="${String(c).replace(/"/g,'&quot;')}">${c}</option>`).join('');
    if(selected) sel.value=selected;
  });
}

function renderAdapterPreview(columns,rows){
  const table=document.getElementById('adapterPreviewTable'); if(!table) return;
  table.innerHTML=`<thead><tr>${columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map((_,i)=>`<td>${esc(r[i]??'')}</td>`).join('')}</tr>`).join('')}</tbody>`;
}

async function previewAdapterUrl(urlOverride){
  const base=adapterBase();
  if(!base) return alert('Set API Base URL first.');
  const url=urlOverride || document.getElementById('adapterUrl').value.trim();
  if(!url || !/^https?:\/\//.test(url)) return alert('Paste a valid machine-readable table URL.');
  setAdapterStatus('Downloading preview through Python backend...','PREVIEWING','warn');
  try{
    const r=await fetch(`${base}/api/preview-rv-url?url=${encodeURIComponent(url)}`);
    if(!r.ok){const tx=await r.text();throw new Error(tx.slice(0,300));}
    const data=await r.json();
    document.getElementById('adapterUrl').value=url;
    fillColumnSelects(data.raw_columns||[],data.suggested_mapping||{});
    renderAdapterPreview(data.raw_columns||[],data.sample_rows||[]);
    setAdapterStatus(`Preview loaded: ${data.n_columns} columns, ${data.n_preview_rows} sample rows. Check column mapping, then import.`, 'READY', 'ok');
  }catch(e){setAdapterStatus(e.message,'FAILED','bad');alert(`Preview failed: ${e.message}`)}
}

async function importMappedAdapterTable(){
  const base=adapterBase();
  if(!base) return alert('Set API Base URL first.');
  const url=document.getElementById('adapterUrl').value.trim();
  if(!url) return alert('Paste/preview a URL first.');
  const params=new URLSearchParams({url, instrument:'REMOTE'});
  const time=document.getElementById('mapTime').value;
  const rv=document.getElementById('mapRv').value;
  const err=document.getElementById('mapErr').value;
  const inst=document.getElementById('mapInst').value;
  if(time) params.set('time_col',time);
  if(rv) params.set('rv_col',rv);
  if(err) params.set('err_col',err);
  if(inst) params.set('inst_col',inst);
  setAdapterStatus('Importing mapped table and normalising RV columns...','IMPORTING','warn');
  try{
    const r=await fetch(`${base}/api/import-rv-url?${params.toString()}`);
    if(!r.ok){const tx=await r.text();throw new Error(tx.slice(0,300));}
    const data=await r.json();
    const rows=parseRV(data.csv);
    setData(rows,`Mapped RV import: ${url}`);
    setAdapterStatus(`Imported ${data.n_rows} rows. Rejected ${data.rejected_rows||0}. Plots are live.`, 'IMPORTED', 'ok');
    switchTab('dashboard');
  }catch(e){setAdapterStatus(e.message,'FAILED','bad');alert(`Import failed: ${e.message}`)}
}

async function copyAdapterEndpoint(){
  const base=adapterBase() || 'http://127.0.0.1:8010';
  const url=document.getElementById('adapterUrl').value.trim() || 'https://example.com/table.csv';
  const endpoint=`${base}/api/preview-rv-url?url=${encodeURIComponent(url)}`;
  await navigator.clipboard.writeText(endpoint);
  setAdapterStatus('Backend preview endpoint copied to clipboard.','COPIED','ok');
}

window.addEventListener('DOMContentLoaded',()=>setTimeout(injectAdapterConsole,650));
