function injectOpsRibbon(){
  if(document.getElementById('opsRibbon')) return;
  const dash=document.getElementById('dashboard');
  if(!dash) return;
  const ribbon=document.createElement('section');
  ribbon.className='ops-ribbon';
  ribbon.id='opsRibbon';
  ribbon.innerHTML=`
    <div class="ops-title-card"><span>Reproducible workflow</span><strong>Evidence before orbit fitting</strong><p>Each stage exposes its source, assumptions and gate state before the next scientific action is enabled.</p></div>
    <button type="button" class="ops-step-card" data-jump="target"><span>01 · Context</span><b>API</b><strong>Resolve target</strong><p>Review identity and archive provenance from the snapshot or Python resolver.</p></button>
    <button type="button" class="ops-step-card" data-jump="rvdata"><span>02 · Evidence</span><b>RV</b><strong>Inspect measurements</strong><p>Load a bundled, remote or local table and verify its observational contract.</p></button>
    <button type="button" class="ops-step-card" data-jump="analysis"><span>03 · Inference</span><b>GLS</b><strong>Scan periods</strong><p>Proceed only after the quality gate; inspect the observing window alongside power.</p></button>
    <button type="button" class="ops-step-card" data-jump="activity"><span>04 · Diagnostics</span><b>ACT</b><strong>Test activity</strong><p>Compare RV with BIS, FWHM, S-index or Hα when those channels exist.</p></button>`;
  dash.insertBefore(ribbon,dash.firstChild);
  ribbon.querySelectorAll('[data-jump]').forEach(el=>el.addEventListener('click',()=>switchTab(el.dataset.jump)));
}

function injectDirectLoaderPanel(){
  if(document.getElementById('directLoaderPanel')) return;
  const rvTab=document.getElementById('rvdata');
  if(!rvTab) return;
  const panel=document.createElement('section');
  panel.className='panel mt-panel';
  panel.id='directLoaderPanel';
  panel.innerHTML=`
    <div class="panel-head"><h3>Direct archive-to-plot loader</h3><span id="directLoaderBadge" class="warn">READY</span></div>
    <div class="direct-loader-grid">
      <div class="direct-loader-copy"><strong>Direct import keeps source discovery and column mapping visible.</strong><p>After resolving a target, the backend searches known RV routes, imports the first compatible table, maps it into BJD, RV, RV_ERR and INSTRUMENT, and forwards it to the plotting engine. When no machine-readable route is available, use the source table and review the file manually.</p></div>
      <div class="direct-loader-actions"><button id="autoDirectLoadBtn">Search + auto-load RV</button><button id="scrollSourceHunterBtn">Open source hunter</button></div>
    </div>
    <div class="direct-loader-pipeline" id="directLoaderPipeline">
      <div><span>STEP 1</span><strong>Target</strong></div><div><span>STEP 2</span><strong>Source search</strong></div><div><span>STEP 3</span><strong>Download</strong></div><div><span>STEP 4</span><strong>Column map</strong></div><div><span>STEP 5</span><strong>Plot</strong></div>
    </div>
    <div class="direct-loader-status" id="directLoaderStatus">Waiting for target and backend.</div>`;
  const first=rvTab.querySelector('.two-column-grid');
  if(first) first.after(panel); else rvTab.prepend(panel);
  document.getElementById('autoDirectLoadBtn').addEventListener('click',autoDirectLoadRV);
  document.getElementById('scrollSourceHunterBtn').addEventListener('click',()=>document.getElementById('rvSourceHunter')?.scrollIntoView({behavior:'smooth',block:'start'}));
}

function setDirectStage(index,message,badge='WORKING',cls='warn'){
  const badgeEl=document.getElementById('directLoaderBadge'); if(badgeEl){badgeEl.textContent=badge;badgeEl.className=cls;}
  const status=document.getElementById('directLoaderStatus'); if(status) status.textContent=message;
  const steps=[...document.querySelectorAll('#directLoaderPipeline div')];
  steps.forEach((el,i)=>{el.classList.toggle('done',i<index);el.classList.toggle('active',i===index);});
}

async function autoDirectLoadRV(){
  const base=currentApiBase ? currentApiBase() : ((document.getElementById('apiBase')?.value||'').replace(/\/$/,''));
  if(!base) return alert('Set API Base URL first, for example http://127.0.0.1:8010');
  const target=(state && state.target && (state.target.planet || state.target.host)) || '51 Peg b';
  setDirectStage(0,`Target selected: ${target}`,'TARGET','warn');
  try{
    setDirectStage(1,`Searching known RV routes for ${target}...`,'SEARCH','warn');
    const r=await fetch(`${base}/api/rv-sources?name=${encodeURIComponent(target)}`);
    if(!r.ok) throw new Error(`Source search HTTP ${r.status}`);
    const data=await r.json();
    const importable=(data.sources||[]).find(s=>s.importable);
    if(!importable){
      renderRVSources && renderRVSources(data.sources||[]);
      setDirectStage(1,'No direct machine-readable RV file was found for this target. Use the source table/manual URL import below.','MANUAL','warn');
      document.getElementById('rvSourceHunter')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    setDirectStage(2,`Downloading ${importable.title}...`,'DOWNLOAD','warn');
    const im=await fetch(`${base}/api/import-rv-url?url=${encodeURIComponent(importable.url)}&instrument=${encodeURIComponent(importable.source||'REMOTE')}`);
    if(!im.ok){const tx=await im.text();throw new Error(tx.slice(0,300));}
    setDirectStage(3,'Normalising columns into BJD,RV,RV_ERR,INSTRUMENT...','MAP','warn');
    const parsed=await im.json();
    const rows=parseRV(parsed.csv);
    setData(rows,`Auto-loaded RV: ${importable.url}`);
    setDirectStage(4,`Imported ${parsed.n_rows} RV rows. Plots are live. Next: Analysis → Run period scan.`,'PLOTTED','ok');
    switchTab('dashboard');
  }catch(e){
    setDirectStage(1,e.message,'FAILED','bad');
    alert(`Auto-loader failed: ${e.message}`);
  }
}

window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{injectOpsRibbon();injectDirectLoaderPanel();},450));
