const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
const library = fs.readFileSync(path.join(root, 'app_local_rv_library.js'), 'utf8')

test('analysis surface exposes an accessible persistent inference gate', () => {
  assert.match(html, /id="inferenceGatePanel"[^>]+role="status"[^>]+aria-live="polite"/)
  assert.match(html, /id="inferenceGateFlag"/)
  assert.match(html, /id="inferenceGateMessage"/)
})

test('non-ready bundle records disable both automated analysis controls', () => {
  assert.match(app, /blocked=Boolean\(audit&&!audit\.inference_ready\)/)
  assert.match(app, /\['runPeriodogramBtn','fitBtn'\]/)
  assert.match(app, /button\.disabled=blocked/)
  assert.match(library, /updateInferenceControls\(\)/)
})
