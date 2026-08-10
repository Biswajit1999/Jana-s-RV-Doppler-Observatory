const TWO_PI = 2 * Math.PI;

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rms(values) {
  return Math.sqrt(mean(values.map((value) => value * value)));
}

function sanitiseRows(rows) {
  return (rows || [])
    .map((row) => ({
      t: Number(row.t),
      rv: Number(row.rv),
      err: Math.max(Number(row.err) || 1, 0.001),
      inst: String(row.inst || 'UNKNOWN'),
    }))
    .filter((row) => finiteNumber(row.t) && finiteNumber(row.rv) && finiteNumber(row.err))
    .sort((a, b) => a.t - b.t);
}

function solveKepler(meanAnomaly, eccentricity) {
  let eccentricAnomaly = eccentricity < 0.8 ? meanAnomaly : Math.PI;
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const denominator = 1 - eccentricity * Math.cos(eccentricAnomaly);
    const delta = (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly) / denominator;
    eccentricAnomaly -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return eccentricAnomaly;
}

function trueAnomaly(eccentricAnomaly, eccentricity) {
  return 2 * Math.atan2(
    Math.sqrt(1 + eccentricity) * Math.sin(eccentricAnomaly / 2),
    Math.sqrt(1 - eccentricity) * Math.cos(eccentricAnomaly / 2),
  );
}

function keplerianRV(time, parameters) {
  const phaseTime = (((time - parameters.T0) % parameters.P) + parameters.P) % parameters.P;
  const meanAnomaly = (TWO_PI * phaseTime / parameters.P) % TWO_PI;
  const eccentricAnomaly = solveKepler(meanAnomaly, parameters.e);
  const anomaly = trueAnomaly(eccentricAnomaly, parameters.e);
  return parameters.K * (Math.cos(parameters.w + anomaly) + parameters.e * Math.cos(parameters.w));
}

function instrumentOffsets(rows, parameters) {
  const instruments = [...new Set(rows.map((row) => row.inst))];
  const offsets = {};
  for (const instrument of instruments) {
    let sumWeight = 0;
    let sumValue = 0;
    for (const row of rows) {
      if (row.inst !== instrument) continue;
      const weight = 1 / (row.err * row.err);
      const model = parameters ? keplerianRV(row.t, parameters) : 0;
      sumWeight += weight;
      sumValue += weight * (row.rv - model);
    }
    offsets[instrument] = sumWeight ? sumValue / sumWeight : 0;
  }
  const reference = offsets[instruments[0]] || 0;
  for (const instrument of instruments) offsets[instrument] -= reference;
  return offsets;
}

function residuals(rows, parameters) {
  const offsets = parameters.gammas || instrumentOffsets(rows, parameters);
  return rows.map((row) => row.rv - (offsets[row.inst] || 0) - keplerianRV(row.t, parameters));
}

function computeGLS(inputRows, requestedFrequencyCount = 1800) {
  const rows = sanitiseRows(inputRows);
  if (rows.length < 3) throw new Error('At least three finite RV rows are required for a period scan.');

  const time = rows.map((row) => row.t);
  const velocity = rows.map((row) => row.rv);
  const uncertainty = rows.map((row) => row.err);
  const count = time.length;
  const span = time[count - 1] - time[0];
  if (!finiteNumber(span) || span <= 0) throw new Error('RV timestamps must span a positive baseline.');

  const frequencyCount = Math.max(400, Math.min(5000, Number(requestedFrequencyCount) || 1800));
  const minFrequency = Math.max(1e-6, 2 / span);
  const maxFrequency = Math.min(2, (count / (2 * span)) * 10);
  if (!finiteNumber(maxFrequency) || maxFrequency <= minFrequency) {
    throw new Error('The RV sampling baseline is too short for the requested period search.');
  }

  const weights = uncertainty.map((sigma) => 1 / (sigma * sigma));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let weightedMean = 0;
  for (let index = 0; index < count; index += 1) weightedMean += weights[index] * velocity[index];
  weightedMean /= totalWeight;

  let weightedVariance = 0;
  for (let index = 0; index < count; index += 1) {
    weightedVariance += weights[index] * (velocity[index] - weightedMean) ** 2;
  }
  weightedVariance /= totalWeight || 1;
  if (weightedVariance <= 0) throw new Error('The RV series has zero weighted variance.');

  const periods = [];
  const powers = [];
  let bestPower = -Infinity;
  let bestPeriod = null;
  for (let frequencyIndex = 0; frequencyIndex < frequencyCount; frequencyIndex += 1) {
    const frequency = minFrequency * Math.pow(maxFrequency / minFrequency, frequencyIndex / (frequencyCount - 1));
    const omega = TWO_PI * frequency;
    let cosineMean = 0;
    let sineMean = 0;
    let velocityCosine = 0;
    let velocitySine = 0;
    let cosineCosine = 0;
    let sineSine = 0;
    let cosineSine = 0;

    for (let index = 0; index < count; index += 1) {
      const normalisedWeight = weights[index] / totalWeight;
      const centeredVelocity = velocity[index] - weightedMean;
      const cosine = Math.cos(omega * time[index]);
      const sine = Math.sin(omega * time[index]);
      cosineMean += normalisedWeight * cosine;
      sineMean += normalisedWeight * sine;
      velocityCosine += normalisedWeight * centeredVelocity * cosine;
      velocitySine += normalisedWeight * centeredVelocity * sine;
      cosineCosine += normalisedWeight * cosine * cosine;
      sineSine += normalisedWeight * sine * sine;
      cosineSine += normalisedWeight * cosine * sine;
    }

    cosineCosine -= cosineMean * cosineMean;
    sineSine -= sineMean * sineMean;
    cosineSine -= cosineMean * sineMean;
    const determinant = cosineCosine * sineSine - cosineSine * cosineSine;
    let power = 0;
    if (Math.abs(determinant) > 1e-24) {
      power = Math.max(
        0,
        Math.min(
          1,
          (sineSine * velocityCosine * velocityCosine
            + cosineCosine * velocitySine * velocitySine
            - 2 * cosineSine * velocityCosine * velocitySine)
            / (weightedVariance * determinant),
        ),
      );
    }
    const period = 1 / frequency;
    periods.push(period);
    powers.push(power);
    if (power > bestPower) {
      bestPower = power;
      bestPeriod = period;
    }
  }

  return {
    periods,
    powers,
    bestP: bestPeriod,
    bestZ: bestPower,
    N: count,
    M: frequencyCount,
    engine: 'web-worker-weighted-gls',
    baselineDays: span,
  };
}

function fitAtPeriod(inputRows, period, controls = {}) {
  const rows = sanitiseRows(inputRows);
  if (rows.length < 3) throw new Error('At least three finite RV rows are required for a Keplerian fit.');
  const P = Number(period);
  if (!finiteNumber(P) || P <= 0) throw new Error('Fit period must be a positive finite number.');

  const velocities = rows.map((row) => row.rv);
  const amplitudeFromData = (Math.max(...velocities) - Math.min(...velocities)) / 2;
  const K0 = finiteNumber(Number(controls.kGuess)) && Number(controls.kGuess) > 0
    ? Number(controls.kGuess)
    : Math.max(amplitudeFromData, 0.1);
  const e0 = finiteNumber(Number(controls.eccentricity)) ? Number(controls.eccentricity) : 0;
  const omega0 = finiteNumber(Number(controls.omegaDeg)) ? Number(controls.omegaDeg) * Math.PI / 180 : 0;
  const eccentricities = [...new Set([0, 0.01, 0.02, 0.05, 0.1, 0.2, 0.35, 0.5, e0])]
    .filter((eccentricity) => eccentricity >= 0 && eccentricity < 0.9);
  const omegaGrid = [omega0, ...Array.from({ length: 24 }, (_, index) => index * 15 * Math.PI / 180)];
  const amplitudeGrid = [0.45, 0.6, 0.8, 1.0, 1.2, 1.5, 1.9].map((scale) => scale * K0);
  const epochGrid = Array.from({ length: 48 }, (_, index) => rows[0].t + index * P / 48);

  let best = {
    chi2: Infinity,
    P,
    K: K0,
    e: 0,
    w: 0,
    T0: rows[0].t,
    gammas: {},
  };

  for (const eccentricity of eccentricities) {
    for (const omega of omegaGrid) {
      for (const amplitude of amplitudeGrid) {
        for (const epoch of epochGrid) {
          const parameters = { P, K: amplitude, e: eccentricity, w: omega, T0: epoch };
          const offsets = instrumentOffsets(rows, parameters);
          let chi2 = 0;
          for (const row of rows) {
            const delta = row.rv - (offsets[row.inst] || 0) - keplerianRV(row.t, parameters);
            chi2 += delta * delta / (row.err * row.err);
          }
          if (chi2 < best.chi2) {
            best = { P, K: amplitude, e: eccentricity, w: omega, T0: epoch, chi2, gammas: offsets };
          }
        }
      }
    }
  }

  best.residuals = residuals(rows, best);
  best.rms = rms(best.residuals);
  const instrumentCount = new Set(rows.map((row) => row.inst)).size;
  const parameterCount = 5 + Math.max(0, instrumentCount - 1);
  const degreesOfFreedom = Math.max(1, rows.length - parameterCount);
  best.dof = degreesOfFreedom;
  best.reducedChi2 = best.chi2 / degreesOfFreedom;
  best.aic = best.chi2 + 2 * parameterCount;
  best.bic = best.chi2 + parameterCount * Math.log(rows.length);
  best.engine = 'web-worker-kepler-grid';
  return best;
}

self.onmessage = (event) => {
  const message = event.data || {};
  try {
    if (message.kind === 'gls') {
      self.postMessage({
        id: message.id,
        result: computeGLS(message.payload?.rows || [], message.payload?.nf),
      });
      return;
    }
    if (message.kind === 'fit') {
      self.postMessage({
        id: message.id,
        result: fitAtPeriod(message.payload?.rows || [], message.payload?.period, message.payload?.controls || {}),
      });
      return;
    }
    throw new Error(`Unknown worker task: ${message.kind}`);
  } catch (error) {
    self.postMessage({
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
