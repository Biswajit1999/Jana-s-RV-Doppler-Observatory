import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const css = fs.readFileSync(path.join(root, 'observatory.css'), 'utf8')
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
const motion = fs.readFileSync(path.join(root, 'app_motion.js'), 'utf8')
const checkOnly = process.argv.includes('--check')

function rgb(hex) {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255)
}

function luminance(hex) {
  return rgb(hex)
    .map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0)
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return Number(((light + .05) / (dark + .05)).toFixed(2))
}

const palettes = {
  night: { background: '#0b0d10', foreground: '#f4f3ef', muted: '#b0b5bc', accent: '#a8c3f0' },
  day: { background: '#f1efe9', foreground: '#17191c', muted: '#555c65', accent: '#315f95' }
}

const contrastTests = Object.entries(palettes).flatMap(([theme, colors]) => [
  { theme, pair: 'foreground/background', ratio: contrast(colors.foreground, colors.background), threshold: 4.5 },
  { theme, pair: 'muted/background', ratio: contrast(colors.muted, colors.background), threshold: 4.5 },
  { theme, pair: 'accent/background', ratio: contrast(colors.accent, colors.background), threshold: 4.5 }
]).map((test) => ({ ...test, pass: test.ratio >= test.threshold }))

const checks = [
  ['scientific gate IDs retained', /id="inferenceGatePanel"/.test(html) && /id="runPeriodogramBtn"/.test(html)],
  ['semantic SVG navigation', (html.match(/class="nav-item/g) || []).length >= 8 && (html.match(/<svg viewBox=/g) || []).length >= 10],
  ['no glyph-only primary navigation', !/<span>[▦◎⇪∿☍⌁▣✦]<\/span>/.test(html)],
  ['theme control has an accessible name', /id="themeToggle"[^>]+aria-label=/.test(html)],
  ['keyboard focus is visible', /:focus-visible/.test(css)],
  ['reduced motion is respected', /prefers-reduced-motion:\s*reduce/.test(css) && /reduceMotion/.test(motion)],
  ['background animation removed', /#starfield,[\s\S]*\.aurora,[\s\S]*display:\s*none\s*!important/.test(css)],
  ['touch controls meet 44 px target', /min-height:\s*44px/.test(css)],
  ['mobile navigation has a bounded layout', /max-width:\s*700px/.test(css) && /grid-template-columns:\s*repeat\(2/.test(css)],
  ['motion uses compositor-friendly properties', /opacity/.test(motion) && /translateY/.test(motion)],
  ['all audited color pairs pass WCAG AA', contrastTests.every((test) => test.pass)]
].map(([name, pass]) => ({ name, pass }))

const audit = {
  schema_version: '1.0.0',
  release: 'v4.1.0',
  generated_at: '2026-09-20T00:00:00Z',
  methodology: 'Static interface contract audit and token-level WCAG contrast checks.',
  palette_contrast: contrastTests,
  checks,
  summary: {
    checks_passed: checks.filter((item) => item.pass).length,
    checks_total: checks.length,
    pass: checks.every((item) => item.pass)
  }
}

const outputs = new Map([
  ['research/interface-quality-audit.json', JSON.stringify(audit, null, 2) + '\n']
])

let stale = false
for (const [relative, content] of outputs) {
  const target = path.join(root, relative)
  if (checkOnly) {
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').replaceAll('\r\n', '\n') : ''
    if (current !== content) {
      console.error(`stale interface evidence: ${relative}`)
      stale = true
    }
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content, 'utf8')
    console.log(`wrote ${relative}`)
  }
}

if (!audit.summary.pass) {
  console.error('interface audit failed')
  process.exitCode = 1
} else if (stale) {
  process.exitCode = 1
} else {
  console.log(`interface audit: ${audit.summary.checks_passed}/${audit.summary.checks_total} checks pass`)
}
