(function attachRVScience(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  root.RVScience = api
})(typeof globalThis !== 'undefined' ? globalThis : window, function buildRVScience() {
  const TWO_PI = 2 * Math.PI

  function validateRows(rows) {
    if (!Array.isArray(rows) || rows.length < 3) throw new Error('At least three RV rows are required')
    rows.forEach((row, index) => {
      if (![row.t, row.rv, row.err].every(Number.isFinite) || row.err <= 0) {
        throw new Error(`Row ${index + 1} needs finite time/RV and positive uncertainty`)
      }
    })
    const ordered = rows.map((row) => row.t).sort((a, b) => a - b)
    if (ordered.at(-1) <= ordered[0] || new Set(ordered).size < 3) throw new Error('At least three distinct epochs are required')
  }

  function solveKepler(meanAnomaly, eccentricity) {
    if (!Number.isFinite(meanAnomaly) || !Number.isFinite(eccentricity) || eccentricity < 0 || eccentricity >= 0.9) {
      throw new Error('Kepler solver requires finite M and 0 <= e < 0.9')
    }
    let eccentricAnomaly = eccentricity < 0.8 ? meanAnomaly : Math.PI
    for (let iteration = 0; iteration < 50; iteration += 1) {
      const step = (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly)
        / (1 - eccentricity * Math.cos(eccentricAnomaly))
      eccentricAnomaly -= step
      if (Math.abs(step) < 1e-13) return eccentricAnomaly
    }
    throw new Error('Kepler solver did not converge')
  }

  function trueAnomaly(eccentricAnomaly, eccentricity) {
    return 2 * Math.atan2(
      Math.sqrt(1 + eccentricity) * Math.sin(eccentricAnomaly / 2),
      Math.sqrt(1 - eccentricity) * Math.cos(eccentricAnomaly / 2),
    )
  }

  function unitKeplerian(time, parameters) {
    const meanAnomaly = (TWO_PI / parameters.P) * ((((time - parameters.T0) % parameters.P) + parameters.P) % parameters.P)
    const anomaly = trueAnomaly(solveKepler(meanAnomaly, parameters.e), parameters.e)
    return Math.cos(parameters.w + anomaly) + parameters.e * Math.cos(parameters.w)
  }

  function keplerianRV(time, parameters) {
    return parameters.K * unitKeplerian(time, parameters)
  }

  function groupMeans(rows, values) {
    const sums = new Map()
    rows.forEach((row, index) => {
      const key = row.inst || 'UNKNOWN'
      const weight = 1 / row.err ** 2
      const current = sums.get(key) || { weight: 0, value: 0 }
      current.weight += weight
      current.value += weight * values[index]
      sums.set(key, current)
    })
    return Object.fromEntries([...sums].map(([key, sum]) => [key, sum.value / sum.weight]))
  }

  function instrumentOffsets(rows, parameters) {
    validateRows(rows)
    const model = rows.map((row) => parameters ? keplerianRV(row.t, parameters) : 0)
    return groupMeans(rows, rows.map((row, index) => row.rv - model[index]))
  }

  function residuals(rows, parameters) {
    const offsets = parameters.gammas || instrumentOffsets(rows, parameters)
    return rows.map((row) => row.rv - offsets[row.inst || 'UNKNOWN'] - keplerianRV(row.t, parameters))
  }

  function computeGLS(rows, frequencyCount = 1200, options = {}) {
    validateRows(rows)
    const ordered = [...rows].sort((a, b) => a.t - b.t)
    const span = ordered.at(-1).t - ordered[0].t
    const minPeriod = options.minPeriod || 0.5
    const maxPeriod = options.maxPeriod || span / 2
    if (!(maxPeriod > minPeriod)) throw new Error('Time baseline is too short for the requested period range')
    const offsets = instrumentOffsets(ordered)
    const time = ordered.map((row) => row.t - ordered[0].t)
    const velocity = ordered.map((row) => row.rv - offsets[row.inst || 'UNKNOWN'])
    const weights = ordered.map((row) => 1 / row.err ** 2)
    const totalWeight = weights.reduce((sum, value) => sum + value, 0)
    const weightedMean = velocity.reduce((sum, value, index) => sum + weights[index] * value, 0) / totalWeight
    const variance = velocity.reduce((sum, value, index) => sum + weights[index] * (value - weightedMean) ** 2, 0) / totalWeight
    if (!(variance > 0)) throw new Error('RV variance must be positive after instrument centering')

    const periods = []
    const powers = []
    let bestPower = -1
    let bestPeriod = null
    const minFrequency = 1 / maxPeriod
    const maxFrequency = 1 / minPeriod
    for (let step = 0; step < frequencyCount; step += 1) {
      const frequency = minFrequency * (maxFrequency / minFrequency) ** (step / (frequencyCount - 1))
      const omega = TWO_PI * frequency
      let C = 0; let S = 0; let YC = 0; let YS = 0; let CC = 0; let SS = 0; let CS = 0
      for (let index = 0; index < ordered.length; index += 1) {
        const weight = weights[index] / totalWeight
        const centered = velocity[index] - weightedMean
        const cosine = Math.cos(omega * time[index])
        const sine = Math.sin(omega * time[index])
        C += weight * cosine; S += weight * sine; YC += weight * centered * cosine; YS += weight * centered * sine
        CC += weight * cosine ** 2; SS += weight * sine ** 2; CS += weight * cosine * sine
      }
      CC -= C ** 2; SS -= S ** 2; CS -= C * S
      const determinant = CC * SS - CS ** 2
      const power = Math.abs(determinant) > 1e-24
        ? Math.max(0, Math.min(1, (SS * YC ** 2 + CC * YS ** 2 - 2 * CS * YC * YS) / (variance * determinant)))
        : 0
      const period = 1 / frequency
      periods.push(period); powers.push(power)
      if (power > bestPower) { bestPower = power; bestPeriod = period }
    }
    return { periods, powers, bestP: bestPeriod, bestZ: bestPower, N: ordered.length, M: frequencyCount, minPeriod, maxPeriod, offsets }
  }

  function fitAtPeriod(rows, period, options = {}) {
    validateRows(rows)
    if (!Number.isFinite(period) || period <= 0) throw new Error('Period must be finite and positive')
    const eccentricities = options.eccentricities || [0, 0.05, 0.1, 0.2, 0.35, 0.5]
    const omegaCount = options.omegaCount || 12
    const phaseCount = options.phaseCount || 24
    const instruments = [...new Set(rows.map((row) => row.inst || 'UNKNOWN'))]
    let best = null

    for (const eccentricity of eccentricities) {
      if (eccentricity < 0 || eccentricity >= 0.9) continue
      for (let omegaIndex = 0; omegaIndex < omegaCount; omegaIndex += 1) {
        const omega = TWO_PI * omegaIndex / omegaCount
        for (let phaseIndex = 0; phaseIndex < phaseCount; phaseIndex += 1) {
          const epoch = rows[0].t + period * phaseIndex / phaseCount
          const unit = rows.map((row) => unitKeplerian(row.t, { P: period, e: eccentricity, w: omega, T0: epoch }))
          const yMeans = groupMeans(rows, rows.map((row) => row.rv))
          const qMeans = groupMeans(rows, unit)
          let numerator = 0
          let denominator = 0
          rows.forEach((row, index) => {
            const key = row.inst || 'UNKNOWN'
            const weight = 1 / row.err ** 2
            const centeredQ = unit[index] - qMeans[key]
            numerator += weight * centeredQ * (row.rv - yMeans[key])
            denominator += weight * centeredQ ** 2
          })
          if (!(denominator > 0)) continue
          let amplitude = numerator / denominator
          let fittedOmega = omega
          if (amplitude < 0) { amplitude = -amplitude; fittedOmega = (omega + Math.PI) % TWO_PI }
          const parameters = { P: period, K: amplitude, e: eccentricity, w: fittedOmega, T0: epoch }
          const gammas = Object.fromEntries(instruments.map((instrument) => {
            const selected = rows.map((row, index) => ({ row, q: unit[index] })).filter((item) => (item.row.inst || 'UNKNOWN') === instrument)
            const sumWeight = selected.reduce((sum, item) => sum + 1 / item.row.err ** 2, 0)
            const gamma = selected.reduce((sum, item) => sum + (item.row.rv - (fittedOmega === omega ? amplitude : -amplitude) * item.q) / item.row.err ** 2, 0) / sumWeight
            return [instrument, gamma]
          }))
          parameters.gammas = gammas
          const modelResiduals = residuals(rows, parameters)
          const chi2 = modelResiduals.reduce((sum, value, index) => sum + (value / rows[index].err) ** 2, 0)
          if (!best || chi2 < best.chi2) best = { ...parameters, chi2, residuals: modelResiduals }
        }
      }
    }
    if (!best) throw new Error('No valid Keplerian grid point')
    best.rms = Math.sqrt(best.residuals.reduce((sum, value) => sum + value ** 2, 0) / best.residuals.length)
    best.reducedChi2 = best.chi2 / Math.max(1, rows.length - instruments.length - 4)
    best.grid = { eccentricities: eccentricities.length, omegaCount, phaseCount }
    return best
  }

  return { validateRows, solveKepler, trueAnomaly, keplerianRV, instrumentOffsets, residuals, computeGLS, fitAtPeriod }
})

