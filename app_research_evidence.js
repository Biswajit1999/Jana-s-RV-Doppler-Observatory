(function attachResearchEvidence() {
  const style = document.createElement('style')
  style.textContent = `.research-evidence{margin-top:16px;border-color:color-mix(in srgb,var(--cyan) 50%,var(--line));overflow:hidden}.research-evidence .evidence-head{display:flex;justify-content:space-between;gap:24px;padding:24px;background:linear-gradient(120deg,rgba(38,240,255,.1),rgba(181,156,255,.08))}.research-evidence h3{margin:5px 0 8px;font-size:clamp(1.4rem,3vw,2.2rem)}.research-evidence .evidence-kicker{font-family:'JetBrains Mono',monospace;color:var(--cyan);font-size:.65rem;letter-spacing:.1em;text-transform:uppercase}.research-evidence .evidence-boundary{max-width:520px;color:var(--muted);line-height:1.6}.evidence-metrics{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line)}.evidence-metrics div{padding:18px;border-right:1px solid var(--line)}.evidence-metrics div:last-child{border-right:0}.evidence-metrics strong{display:block;color:var(--cyan);font-size:1.75rem}.evidence-metrics span{color:var(--muted);font-size:.73rem}.evidence-links{display:flex;gap:16px;flex-wrap:wrap;padding:15px 24px;border-top:1px solid var(--line);font-family:'JetBrains Mono',monospace;font-size:.7rem}.evidence-links a{color:var(--cyan)}@media(max-width:800px){.research-evidence .evidence-head{display:block}.evidence-metrics{grid-template-columns:1fr 1fr}.evidence-metrics div:nth-child(2){border-right:0}}`
  document.head.appendChild(style)

  function number(value) { return Number(value || 0).toLocaleString() }

  async function renderEvidence() {
    const hero = document.querySelector('#dashboard .hero-panel')
    if (!hero || document.getElementById('researchEvidence')) return
    const panel = document.createElement('section')
    panel.className = 'panel research-evidence'
    panel.id = 'researchEvidence'
    panel.innerHTML = '<div class="evidence-head"><div><span class="evidence-kicker">Reviewed evidence · v4.0.0</span><h3>Auditing the archive before fitting the orbit.</h3></div><p class="evidence-boundary">Loading the committed 250-file quality audit…</p></div>'
    hero.after(panel)
    try {
      const response = await fetch('research/rv-library-quality-audit.json?v=400', { cache: 'no-cache' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const audit = await response.json()
      window.JanaRVAuditByFile = new Map(audit.records.map((record) => [record.target_file, record]))
      const summary = audit.summary
      panel.innerHTML = `<div class="evidence-head"><div><span class="evidence-kicker">Reviewed evidence · ${audit.release}</span><h3>${number(summary.inference_ready_files)} of ${number(audit.audited_files)} files pass every gate.</h3></div><p class="evidence-boundary">${audit.boundary}</p></div><div class="evidence-metrics"><div><strong>${number(summary.repeated_epoch_rows)}</strong><span>rows in repeated-epoch groups</span></div><div><strong>${number(summary.files_with_confounded_reference_offsets)}</strong><span>files with reference/offset confounding</span></div><div><strong>${number(summary.files_with_extreme_range_ratio)}</strong><span>files with extreme range ratios</span></div><div><strong>${number(audit.total_rows)}</strong><span>committed rows audited</span></div></div><div class="evidence-links"><a href="research/rv-library-quality-audit.json">Machine-readable audit</a><a href="research/rv-library-quality-audit.csv">Per-target table</a><a href="docs/METHODS.md">Methods + gates</a><span>Bundle SHA-256 ${audit.bundle_sha256.slice(0, 16)}…</span></div>`
    } catch (error) {
      panel.querySelector('.evidence-boundary').textContent = `Evidence product unavailable: ${error.message}`
    }
  }

  window.addEventListener('DOMContentLoaded', renderEvidence)
})()
