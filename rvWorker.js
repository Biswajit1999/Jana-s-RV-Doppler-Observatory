importScripts('rv_science.js?v=400')

self.onmessage = (event) => {
  const message = event.data || {}
  const payload = message.payload || {}
  try {
    let result
    if (message.kind === 'gls') {
      result = RVScience.computeGLS(payload.rows || [], payload.nf || 1200, payload.options || {})
      result.engine = 'worker · tested group-centered scan'
    } else if (message.kind === 'fit') {
      result = RVScience.fitAtPeriod(payload.rows || [], payload.period, payload.options || {})
      result.engine = 'worker · tested bounded grid'
    } else {
      throw new Error(`Unknown worker task: ${message.kind}`)
    }
    self.postMessage({ id: message.id, result })
  } catch (error) {
    self.postMessage({
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
