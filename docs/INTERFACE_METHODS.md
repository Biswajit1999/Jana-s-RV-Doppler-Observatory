# Interface redesign methods

## Purpose

Version 4.1 replaces the earlier neon mission-control skin with a restrained precision-instrument interface. The redesign changes presentation and interaction quality; it does not alter the radial-velocity methods, bundle audit, inference gates, or scientific claims in version 4.0.

## Design principles

- **Evidence before action.** The workflow presents target provenance, table quality and the inference gate before period scanning or fitting.
- **Quiet hierarchy.** Near-neutral surfaces, one cool data accent, and semantic success/warning/error colors replace animated star fields, broad glows and decorative gradients.
- **Readable density.** Inter is used for interface copy and JetBrains Mono only for compact measurements, labels and identifiers.
- **Motion as feedback.** View entry and state changes use short opacity/transform transitions. Motion is omitted when `prefers-reduced-motion: reduce` is active.
- **Semantic controls.** Primary navigation uses consistently drawn inline SVG icons, visible focus, current-page state, named icon controls and a keyboard-operable mobile menu.
- **Responsive continuity.** The same content and controls reflow from a sidebar to a compact navigation header; scientific tables retain a bounded horizontal scroll region instead of widening the page.

## Contrast method

The deterministic interface audit computes WCAG relative luminance and contrast ratios for foreground, muted text and accent text against the primary background in both themes. Every audited pair must meet 4.5:1. This is a token-level gate; individual chart traces also retain labels and line-style context rather than relying on hue alone.

## Before/after rubric

The comparison graph scores eight declared implementation categories on a 0–100 expert heuristic rubric: information hierarchy, color restraint, text contrast, navigation consistency, motion accessibility, keyboard focus, responsive structure and scientific state clarity. “Before” records the v4.0 implementation; “after” records v4.1. This rubric documents engineering/design conformance and is **not** a participant study, usability experiment, or measure of scientific validity.

## Reproduce

```bash
node scripts/audit_interface.mjs
node scripts/audit_interface.mjs --check
```

Generated evidence:

- `research/interface-quality-audit.json`
- `research/interface-quality-audit.csv`
- `assets/interface-quality-before-after.svg`

The repository-wide `npm run check` command runs the evidence freshness gate alongside the numerical and observational checks.
