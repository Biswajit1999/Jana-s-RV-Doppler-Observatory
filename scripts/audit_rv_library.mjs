#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const REQUIRED_RV_COLUMNS = ['BJD', 'RV', 'RV_ERR', 'INSTRUMENT', 'TARGET', 'ARCHIVE'];
const PROHIBITED_SOURCE_PATTERNS = [/synthetic/i, /\bdemo\b/i, /\bmock\b/i, /\bfake\b/i, /\[bot\]/i, /\bbot\b/i];

const checks = [];
const failures = [];
const warnings = [];

function repoPath(...parts) {
  return path.join(ROOT, ...parts);
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replaceAll(path.sep, '/');
}

function readJson(relativePath) {
  const absolute = repoPath(relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch (error) {
    failures.push(`Unable to parse ${relativePath}: ${error.message}`);
    return null;
  }
}

function addCheck(name, passed, detail) {
  checks.push({ name, passed, detail });
  if (!passed) failures.push(`${name}: ${detail}`);
}

function addWarning(detail) {
  warnings.push(detail);
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function formatInteger(value) {
  return Number(value).toLocaleString('en-US');
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'n/a';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function splitDelimited(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      cells.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += character;
    }
  }
  cells.push(current.trim().replace(/^"|"$/g, ''));
  return cells;
}

function parseCsvFile(relativePath) {
  const absolute = repoPath(relativePath);
  if (!fs.existsSync(absolute)) {
    addCheck(`RV file exists: ${relativePath}`, false, 'missing');
    return null;
  }
  const text = fs.readFileSync(absolute, 'utf8').trim();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    addCheck(`RV file has rows: ${relativePath}`, false, `${lines.length} lines`);
    return null;
  }
  const header = splitDelimited(lines[0]);
  const headerIndex = new Map(header.map((column, index) => [column.trim().toUpperCase(), index]));
  const missingColumns = REQUIRED_RV_COLUMNS.filter((column) => !headerIndex.has(column));
  if (missingColumns.length) {
    addCheck(`RV file columns: ${relativePath}`, false, `missing ${missingColumns.join(', ')}`);
    return null;
  }

  let validRows = 0;
  let invalidRows = 0;
  let minBjd = Infinity;
  let maxBjd = -Infinity;
  let minRv = Infinity;
  let maxRv = -Infinity;
  const instruments = new Set();
  const archives = new Set();
  const targets = new Set();

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const cells = splitDelimited(lines[rowIndex]);
    const bjd = Number(cells[headerIndex.get('BJD')]);
    const rv = Number(cells[headerIndex.get('RV')]);
    const rvErr = Number(cells[headerIndex.get('RV_ERR')]);
    const instrument = String(cells[headerIndex.get('INSTRUMENT')] || '').trim();
    const archive = String(cells[headerIndex.get('ARCHIVE')] || '').trim();
    const target = String(cells[headerIndex.get('TARGET')] || '').trim();
    if (!finiteNumber(bjd) || !finiteNumber(rv) || !finiteNumber(rvErr) || rvErr <= 0 || !instrument || !archive || !target) {
      invalidRows += 1;
      continue;
    }
    validRows += 1;
    minBjd = Math.min(minBjd, bjd);
    maxBjd = Math.max(maxBjd, bjd);
    minRv = Math.min(minRv, rv);
    maxRv = Math.max(maxRv, rv);
    instruments.add(instrument);
    archives.add(archive);
    targets.add(target);
  }

  const stats = fs.statSync(absolute);
  return {
    path: relativePath,
    bytes: stats.size,
    sha256: sha256File(absolute),
    row_count: validRows,
    invalid_rows: invalidRows,
    bjd_range: [minBjd, maxBjd],
    rv_range_m_s: [minRv, maxRv],
    instruments: [...instruments].sort(),
    archives: [...archives].sort(),
    targets: [...targets].sort(),
  };
}

function validateCatalogSnapshot(metadata, rows) {
  if (!metadata || !Array.isArray(rows)) return null;
  addCheck('NASA snapshot source', metadata.source === 'NASA Exoplanet Archive', metadata.source || 'missing');
  addCheck('NASA snapshot service', metadata.service === 'Table Access Protocol (TAP)', metadata.service || 'missing');
  addCheck('NASA snapshot row count', rows.length === metadata.included_rows, `${formatInteger(rows.length)} vs ${formatInteger(metadata.included_rows)}`);
  addCheck('NASA snapshot retrieval date', /^\d{4}-\d{2}-\d{2}$/.test(metadata.retrieved_utc_date || ''), metadata.retrieved_utc_date || 'missing');
  addCheck('NASA snapshot row ceiling documented', metadata.qualifying_rows_at_retrieval >= metadata.included_rows, `${metadata.qualifying_rows_at_retrieval} qualifying vs ${metadata.included_rows} included`);

  const seenPlanets = new Set();
  let badRows = 0;
  let rvTargets = 0;
  let minK = Infinity;
  let maxK = -Infinity;
  let minPeriod = Infinity;
  let maxPeriod = -Infinity;
  for (const row of rows) {
    const planet = String(row.pl_name || '').trim();
    if (!planet || seenPlanets.has(planet)) badRows += 1;
    seenPlanets.add(planet);
    if (Number(row.rv_flag) === 1) rvTargets += 1;
    const period = Number(row.pl_orbper);
    const semiAmplitude = Number(row.pl_rvamp);
    if (!finiteNumber(period) || period <= 0 || !finiteNumber(semiAmplitude) || semiAmplitude <= 0) badRows += 1;
    if (finiteNumber(period)) {
      minPeriod = Math.min(minPeriod, period);
      maxPeriod = Math.max(maxPeriod, period);
    }
    if (finiteNumber(semiAmplitude)) {
      minK = Math.min(minK, semiAmplitude);
      maxK = Math.max(maxK, semiAmplitude);
    }
  }
  addCheck('NASA snapshot RV target flag', rvTargets === rows.length, `${formatInteger(rvTargets)} of ${formatInteger(rows.length)}`);
  addCheck('NASA snapshot finite period and K', badRows === 0, `${badRows} problematic rows`);

  return {
    path: 'data/rv-planets.json',
    rows: rows.length,
    source: metadata.source,
    service: metadata.service,
    retrieved_utc_date: metadata.retrieved_utc_date,
    sha256: sha256File(repoPath('data/rv-planets.json')),
    period_days_range: [minPeriod, maxPeriod],
    semi_amplitude_m_s_range: [minK, maxK],
  };
}

function validateRvBundle(manifest, indexRows) {
  if (!manifest || !Array.isArray(indexRows)) return null;
  addCheck('RV bundle source list', Array.isArray(manifest.sources) && manifest.sources.length >= 2, JSON.stringify(manifest.sources || []));
  addCheck('RV bundle target count', indexRows.length === manifest.web_bundle_targets, `${formatInteger(indexRows.length)} vs ${formatInteger(manifest.web_bundle_targets)}`);
  addCheck('RV bundle merged target claim', manifest.total_merged_targets >= manifest.web_bundle_targets, `${formatInteger(manifest.total_merged_targets)} vs ${formatInteger(manifest.web_bundle_targets)}`);
  const indexedRows = indexRows.reduce((sum, row) => sum + Number(row.rows || 0), 0);
  addCheck('RV bundle source archive row ceiling', manifest.total_merged_rows >= indexedRows, `${formatInteger(manifest.total_merged_rows)} archive rows vs ${formatInteger(indexedRows)} indexed web rows`);

  const libraryDir = repoPath('sample_data/rv_library/data');
  const csvFiles = fs.existsSync(libraryDir)
    ? fs.readdirSync(libraryDir).filter((name) => name.toLowerCase().endsWith('.csv')).sort()
    : [];
  addCheck('RV data directory file count', csvFiles.length === indexRows.length, `${formatInteger(csvFiles.length)} vs ${formatInteger(indexRows.length)}`);

  const sourceText = `${stableJson(manifest)}\n${stableJson(indexRows)}`;
  const prohibited = PROHIBITED_SOURCE_PATTERNS.find((pattern) => pattern.test(sourceText));
  addCheck('RV bundle has no generated/demo source labels', !prohibited, prohibited ? String(prohibited) : 'clean');

  let totalRows = 0;
  let totalInvalidRows = 0;
  let minBjd = Infinity;
  let maxBjd = -Infinity;
  let minRv = Infinity;
  let maxRv = -Infinity;
  const archives = new Set();
  const instruments = new Set();
  const targetReports = [];
  const mismatches = [];
  const timeConventionFlags = [];
  const velocityScaleFlags = [];

  for (const entry of indexRows) {
    const relativeFile = `sample_data/rv_library/${entry.relative_file}`;
    const parsed = parseCsvFile(relativeFile);
    if (!parsed) continue;
    totalRows += parsed.row_count;
    totalInvalidRows += parsed.invalid_rows;
    minBjd = Math.min(minBjd, parsed.bjd_range[0]);
    maxBjd = Math.max(maxBjd, parsed.bjd_range[1]);
    minRv = Math.min(minRv, parsed.rv_range_m_s[0]);
    maxRv = Math.max(maxRv, parsed.rv_range_m_s[1]);
    for (const archive of parsed.archives) archives.add(archive);
    for (const instrument of parsed.instruments) instruments.add(instrument);
    if (parsed.row_count !== Number(entry.rows)) mismatches.push(`${entry.target}: ${parsed.row_count} vs ${entry.rows}`);
    if (Math.abs(parsed.bjd_range[0] - Number(entry.bjd_min)) > 1e-6 || Math.abs(parsed.bjd_range[1] - Number(entry.bjd_max)) > 1e-6) {
      mismatches.push(`${entry.target}: BJD range mismatch`);
    }
    if (parsed.bjd_range[0] < 2_400_000) {
      timeConventionFlags.push(`${entry.target} (${entry.file_name}) starts at ${parsed.bjd_range[0]}`);
    }
    if (Math.max(Math.abs(parsed.rv_range_m_s[0]), Math.abs(parsed.rv_range_m_s[1])) > 1_000_000) {
      velocityScaleFlags.push(`${entry.target} (${entry.file_name}) spans ${parsed.rv_range_m_s.map((value) => value.toFixed(1)).join(' to ')} m/s`);
    }
    if (targetReports.length < 12) {
      targetReports.push({
        target: entry.target,
        rows: parsed.row_count,
        bjd_range: parsed.bjd_range,
        rv_range_m_s: parsed.rv_range_m_s,
        archives: parsed.archives,
        instruments: parsed.instruments,
        file: parsed.path,
        sha256: parsed.sha256,
      });
    }
  }

  addCheck('RV bundle row conservation', totalRows === indexedRows, `${formatInteger(totalRows)} vs ${formatInteger(indexedRows)}`);
  addCheck('RV bundle CSV rows match index', mismatches.length === 0, mismatches.slice(0, 5).join('; ') || 'all matched');
  addCheck('RV bundle finite measurements', totalInvalidRows === 0, `${formatInteger(totalInvalidRows)} invalid rows`);
  for (const source of manifest.sources || []) {
    const sourcePresent = [...archives].some((archive) => archive.toUpperCase().includes(String(source).split('_')[0]));
    addCheck(`RV archive source present: ${source}`, sourcePresent, [...archives].join(', '));
  }

  if (indexRows.some((row) => !row.has_activity)) {
    addWarning('Some bundled RV targets have no activity indicators; this is expected for public archive extracts and is labelled in the UI.');
  }
  if (timeConventionFlags.length) {
    addWarning(`${timeConventionFlags.length} RV files contain archive-native time values below JD 2,400,000; inspect time columns before combining them with BJD_TDB data. Examples: ${timeConventionFlags.slice(0, 3).join('; ')}.`);
  }
  if (velocityScaleFlags.length) {
    addWarning(`${velocityScaleFlags.length} RV files contain very large archive-native velocity zero-points or scale conventions; subtract per-instrument offsets and verify units before precision interpretation. Examples: ${velocityScaleFlags.slice(0, 3).join('; ')}.`);
  }

  return {
    path: 'sample_data/rv_library',
    targets: indexRows.length,
    csv_files: csvFiles.length,
    rows: totalRows,
    source_archive_rows: manifest.total_merged_rows,
    invalid_rows: totalInvalidRows,
    bjd_range: [minBjd, maxBjd],
    rv_range_m_s: [minRv, maxRv],
    archives: [...archives].sort(),
    instruments: [...instruments].sort(),
    time_convention_flags: timeConventionFlags,
    velocity_scale_flags: velocityScaleFlags,
    sample_targets: targetReports,
  };
}

function buildMarkdown(payload) {
  const passCount = checks.filter((check) => check.passed).length;
  const lines = [];
  lines.push("# Jana's RV Observatory Data Integrity");
  lines.push('');
  lines.push('This ledger is generated by `node scripts/audit_rv_library.mjs`. It validates the static NASA Exoplanet Archive snapshot and the bundled radial-velocity time-series library used by the browser.');
  lines.push('');
  lines.push(`- Status: **${payload.status.toUpperCase()}**`);
  lines.push(`- Integrity fingerprint: \`${payload.integrity_fingerprint}\``);
  lines.push(`- Checks passed: ${passCount}/${checks.length}`);
  lines.push(`- Warnings: ${warnings.length}`);
  lines.push('');
  lines.push('## Data Products');
  lines.push('');
  lines.push('| Product | Rows / targets | Provenance | Hash |');
  lines.push('|---|---:|---|---|');
  lines.push(`| NASA target snapshot | ${formatInteger(payload.products.catalog_snapshot.rows)} rows | ${payload.products.catalog_snapshot.source} ${payload.products.catalog_snapshot.service}, retrieved ${payload.products.catalog_snapshot.retrieved_utc_date} | \`${payload.products.catalog_snapshot.sha256}\` |`);
  lines.push(`| Bundled RV library | ${formatInteger(payload.products.rv_bundle.rows)} RV rows across ${formatInteger(payload.products.rv_bundle.targets)} targets | ${payload.products.rv_bundle.archives.join(', ')} | per-file hashes in JSON ledger |`);
  lines.push('');
  lines.push('## Physical Ranges');
  lines.push('');
  lines.push(`- Snapshot orbital periods span ${payload.products.catalog_snapshot.period_days_range.map((value) => Number(value).toPrecision(6)).join(' to ')} days.`);
  lines.push(`- Snapshot RV semi-amplitudes span ${payload.products.catalog_snapshot.semi_amplitude_m_s_range.map((value) => Number(value).toPrecision(6)).join(' to ')} m/s.`);
  lines.push(`- Bundled RV observations span BJD ${payload.products.rv_bundle.bjd_range.map((value) => Number(value).toFixed(5)).join(' to ')}.`);
  lines.push(`- Bundled RV values span ${payload.products.rv_bundle.rv_range_m_s.map((value) => Number(value).toFixed(3)).join(' to ')} m/s, retaining archive systemic velocities rather than hiding them behind decorative normalisation.`);
  lines.push(`- Time-convention flags: ${payload.products.rv_bundle.time_convention_flags.length}. Velocity-scale flags: ${payload.products.rv_bundle.velocity_scale_flags.length}. These are warnings for precision analysis, not evidence that the files are synthetic.`);
  lines.push('');
  lines.push('## Sample Target Files');
  lines.push('');
  lines.push('| Target | Rows | BJD span | RV span (m/s) | Archives |');
  lines.push('|---|---:|---|---|---|');
  for (const target of payload.products.rv_bundle.sample_targets) {
    lines.push(`| ${target.target} | ${formatInteger(target.rows)} | ${target.bjd_range.map((value) => Number(value).toFixed(3)).join(' - ')} | ${target.rv_range_m_s.map((value) => Number(value).toFixed(2)).join(' - ')} | ${target.archives.join(', ')} |`);
  }
  lines.push('');
  lines.push('## Checks');
  lines.push('');
  lines.push('| Check | Result | Detail |');
  lines.push('|---|---|---|');
  for (const check of checks) {
    lines.push(`| ${check.name.replaceAll('|', '\\|')} | ${check.passed ? 'PASS' : 'FAIL'} | ${String(check.detail).replaceAll('|', '\\|')} |`);
  }
  if (warnings.length) {
    lines.push('');
    lines.push('## Warnings');
    lines.push('');
    for (const warning of warnings) lines.push(`- ${warning}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeIfChanged(relativePath, content) {
  const absolute = repoPath(relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  if (fs.existsSync(absolute) && fs.readFileSync(absolute, 'utf8') === content) return false;
  fs.writeFileSync(absolute, content, 'utf8');
  return true;
}

const metadata = readJson('data/catalog-metadata.json');
const snapshotRows = readJson('data/rv-planets.json');
const manifest = readJson('sample_data/rv_library/manifest.json');
const libraryIndex = readJson('sample_data/rv_library/jana_rv_web_target_index.json');

const products = {
  catalog_snapshot: validateCatalogSnapshot(metadata, snapshotRows),
  rv_bundle: validateRvBundle(manifest, libraryIndex),
};

if (Object.values(products).some((product) => product === null)) {
  failures.push('One or more observational products could not be validated.');
}

const fingerprint = crypto
  .createHash('sha256')
  .update(stableJson({ checks, warnings, products }))
  .digest('hex');

const payload = {
  format: 'jana-rv-observational-integrity/v1',
  status: failures.length ? 'failed' : 'passed',
  integrity_fingerprint: fingerprint,
  products,
  checks,
  warnings,
};

writeIfChanged('data/observational-integrity.json', `${JSON.stringify(payload, null, 2)}\n`);
writeIfChanged('OBSERVATIONAL_INTEGRITY.md', buildMarkdown(payload));

const passed = checks.filter((check) => check.passed).length;
console.log(`RV observational audit: ${passed}/${checks.length} checks passed, ${checks.length - passed} failed, ${warnings.length} warnings.`);
console.log(`Integrity fingerprint: ${fingerprint}`);
console.log(`Wrote ${rel(repoPath('data/observational-integrity.json'))} and ${rel(repoPath('OBSERVATIONAL_INTEGRITY.md'))}.`);

if (failures.length) {
  console.error('\nFailures:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
