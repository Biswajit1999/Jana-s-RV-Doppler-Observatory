const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
const library = fs.readFileSync(path.join(root, 'app_local_rv_library.js'), 'utf8')
const worker = fs.readFileSync(path.join(root, 'rvWorker.js'), 'utf8')
const interfaceCss = fs.readFileSync(path.join(root, 'observatory.css'), 'utf8')
const interfaceMotion = fs.readFileSync(path.join(root, 'app_motion.js'), 'utf8')

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

test('background analysis reuses the tested numerical core', () => {
  assert.match(worker, /importScripts\('rv_science\.js\?v=400'\)/)
  assert.match(worker, /RVScience\.computeGLS/)
  assert.match(worker, /RVScience\.fitAtPeriod/)
  assert.match(app, /if\(!requireInferenceReady\(\)\)return/)
  assert.match(app, /runRVWorker\('gls'/)
  assert.match(app, /runRVWorker\('fit'/)
})

test('precision interface retains accessible navigation and theme controls', () => {
  assert.match(html, /class="skip-link"/)
  assert.match(html, /id="navToggle"[^>]+aria-expanded="false"/)
  assert.match(html, /id="themeToggle"[^>]+aria-label="Toggle color theme"/)
  assert.doesNotMatch(html, /<span>[▦◎⇪∿☍⌁▣✦]<\/span>/)
  assert.ok((html.match(/<svg viewBox=/g) || []).length >= 10)
  assert.match(app, /b\.setAttribute\('aria-current','page'\)/)
  assert.match(app, /b\.removeAttribute\('aria-current'\)/)
})

test('interface motion is bounded and respects user preference', () => {
  assert.match(interfaceCss, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(interfaceCss, /:focus-visible/)
  assert.match(interfaceCss, /min-height: 44px/)
  assert.match(interfaceMotion, /prefers-reduced-motion: reduce/)
  assert.match(interfaceMotion, /opacity: \.45, transform: 'translateY\(8px\)'/)
})

test('legacy decorative background animation is disabled', () => {
  assert.match(interfaceCss, /#starfield,[\s\S]*\.aurora,[\s\S]*display: none !important/)
  assert.match(app, /function initStarfield\(\)\{const c=document\.getElementById\('starfield'\);if\(c\)\{c\.width=1;c\.height=1\}\}/)
})
