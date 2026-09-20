const test = require('node:test')
const assert = require('node:assert/strict')
const science = require('../rv_science.js')

function syntheticRows({ period = 10, amplitude = 5, count = 80 } = {}) {
  return Array.from({ length: count }, (_, index) => {
    const inst = index % 2 ? 'B' : 'A'
    const offset = inst === 'A' ? 120 : -55
    const time = index * 0.73 + (index % 5) * 0.07
    return { t: time, rv: offset + amplitude * Math.cos(2 * Math.PI * time / period), err: 0.5, inst }
  })
}

test('circular Keplerian reduces to a cosine', () => {
  const parameters = { P: 8, K: 3, e: 0, w: 0, T0: 2 }
  assert.ok(Math.abs(science.keplerianRV(2, parameters) - 3) < 1e-12)
  assert.ok(Math.abs(science.keplerianRV(4, parameters)) < 1e-12)
})

test('instrument offsets retain the systemic zero point for every group', () => {
  const rows = syntheticRows({ amplitude: 0 })
  const offsets = science.instrumentOffsets(rows)
  assert.ok(Math.abs(offsets.A - 120) < 1e-12)
  assert.ok(Math.abs(offsets.B + 55) < 1e-12)
})

test('group-centered GLS recovers a signal despite large instrument offsets', () => {
  const result = science.computeGLS(syntheticRows(), 2400, { minPeriod: 2, maxPeriod: 20 })
  assert.ok(Math.abs(result.bestP - 10) / 10 < 0.01, `recovered ${result.bestP}`)
  assert.equal(Object.hasOwn(result, 'fap'), false)
})

test('analytic-amplitude Kepler grid recovers K and instrument gammas', () => {
  const rows = syntheticRows()
  const fit = science.fitAtPeriod(rows, 10, { eccentricities: [0], omegaCount: 24, phaseCount: 24 })
  assert.ok(Math.abs(fit.K - 5) < 0.1, `K=${fit.K}`)
  assert.ok(Math.abs(fit.gammas.A - 120) < 0.1, `gamma A=${fit.gammas.A}`)
  assert.ok(Math.abs(fit.gammas.B + 55) < 0.1, `gamma B=${fit.gammas.B}`)
  assert.ok(fit.rms < 0.1, `rms=${fit.rms}`)
})

test('non-positive uncertainties fail closed', () => {
  const rows = syntheticRows().slice(0, 4)
  rows[2].err = 0
  assert.throws(() => science.computeGLS(rows), /positive uncertainty/)
})
