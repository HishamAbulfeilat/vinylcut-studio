# GAPS — unimplemented features promised by PARITY-PLAN / SHELL-SPEC

Checklist of features the parity plan or shell spec promise that are **not yet implemented**
(verified against `src/`, `electron/`). Docs only — no code changes.

## Phase 1 — Foundation
- [ ] Desktop build/packaging pipeline (no `electron-builder`/packaging scripts) — files: `package.json`, `electron/` — size: M
- [ ] Automated smoke sweep (every tool/panel/dialog/command, zero runtime errors) — files: `src/`, `electron/main.cjs` — size: M

## Phase 2 — Layout parity & edition chooser
- [ ] DesignCenter component/panel — files: `src/components/`, `src/App.jsx` — size: M
- [ ] Object Manager panel — files: `src/components/`, `src/App.jsx` — size: M
- [ ] Launch-time edition chooser writing a capability table (5 editions) — files: `src/editions/` (missing), `src/App.jsx`, `src/context/AppContext.jsx` — size: L
- [ ] Per-edition rendering / capability gating — files: `src/context/AppContext.jsx`, `src/components/Toolbar.jsx`, `src/components/MenuBar.jsx` — size: L
- [ ] 21-group property inspector driven by one attribute-filtered registry (640 items) — files: `src/components/PropertyPanel.jsx`, `src/lib/` (new registry) — size: L
- [ ] `gpaAdvanced`/`gpaHidden`/`gpaMaster` visibility filtering (advanced mode) — files: `src/components/PropertyPanel.jsx` — size: M
- [ ] Layout-regression comparison harness (capture + diff vs reference screens) — files: `electron/main.cjs`, `docs/` — size: M

## Phase 3 — Feature parity
- [ ] Triangle shape — files: `src/lib/powershapes.js`, `src/components/Canvas.jsx`, `src/App.jsx` — size: S
- [ ] Logarithmic spiral — files: `src/lib/powershapes.js`, `src/components/Canvas.jsx` — size: S
- [ ] Elastic Mode (rubber mode) — files: `src/context/AppContext.jsx`, `src/components/Canvas.jsx` — size: M
- [ ] Space Apart — files: `src/context/AppContext.jsx`, `src/components/AlignmentDialog.jsx` — size: S
- [ ] Full Distribute (beyond current basic) — files: `src/context/AppContext.jsx`, `src/components/AlignmentDialog.jsx` — size: M
- [ ] Spot Colour Mixer — files: `src/components/` (new), `src/context/AppContext.jsx` — size: M
- [ ] Named/vinyl colour libraries — files: `src/components/ColorLibrary.jsx` — size: M
- [ ] System (device) colours — files: `src/components/ColorLibrary.jsx`, `src/platform/` — size: M
- [ ] Bitmap fills — files: `src/context/AppContext.jsx`, `src/components/Canvas.jsx`, `src/components/PropertyPanel.jsx` — size: M
- [ ] Reverse / Wireframe fill modes — files: `src/context/AppContext.jsx`, `src/components/Canvas.jsx` — size: M
- [ ] Fill-mode switching — files: `src/components/PropertyPanel.jsx` — size: S
- [ ] Shaping: Stamp — files: `src/components/ShapeOperations.jsx`, `src/lib/shapeops.js` — size: S
- [ ] Shaping: Common — files: `src/components/ShapeOperations.jsx`, `src/lib/shapeops.js` — size: S
- [ ] Welding including layers — files: `src/lib/shapeops.js`, `src/context/AppContext.jsx` — size: M
- [ ] Distortion editor (separate from warps) — files: `src/components/` (new), `src/lib/warp.js` — size: L
- [ ] Outline Editor — files: `src/components/` (new), `src/lib/geometry.js` — size: M
- [ ] Text: bullet points — files: `src/context/AppContext.jsx`, `src/components/PropertyPanel.jsx`, `src/components/Canvas.jsx` — size: M
- [ ] Text: tabs — files: `src/context/AppContext.jsx`, `src/components/PropertyPanel.jsx` — size: M
- [ ] Text: sub/superscript — files: `src/context/AppContext.jsx`, `src/components/Canvas.jsx` — size: S
- [ ] Text: change case — files: `src/components/MenuBar.jsx`, `src/context/AppContext.jsx` — size: S
- [ ] Text: kerning/tracking tables — files: `src/components/PropertyPanel.jsx`, `src/context/AppContext.jsx` — size: M
- [ ] Text: text wrapping — files: `src/components/Canvas.jsx`, `src/context/AppContext.jsx` — size: M
- [ ] Text: break by char/word/line/paragraph — files: `src/context/AppContext.jsx`, `src/components/Canvas.jsx` — size: M
- [ ] Curves: polycurve, polyline, smooth-line, vector brush, connector tools, replace section, reduce nodes — files: `src/components/Canvas.jsx`, `src/lib/geometry.js`, `src/App.jsx` — size: L
- [ ] Bitmaps: adjustments, colour correction/reduction, gaussian blur, filters, node editing images, resample, flatten — files: `src/components/` (new), `src/lib/rasterprep.js` — size: L
- [ ] Vectorizer: pretrace — files: `src/components/VectorizeDialog.jsx`, `src/lib/tracer.js` — size: M
- [ ] Vectorizer: automatic image correction — files: `src/components/VectorizeDialog.jsx`, `src/lib/tracer.js` — size: M
- [ ] Cut: Autocut — files: `src/context/AppContext.jsx`, `src/lib/cutter.js` — size: M
- [ ] Cut: Cutfile documents — files: `src/context/AppContext.jsx`, `src/lib/importers.js`, `src/lib/exporters.js` — size: M
- [ ] Cut: Cutfile Editor (weed boxes, chop guide, lift marks, alignment/hanging marks, nesting, merge tiles) — files: `src/components/` (new) — size: L
- [ ] Vinyl Spooler: sorting/filtering — files: `src/components/VinylSpooler.jsx` — size: S
- [ ] Vinyl Spooler: auto-fit queue — files: `src/components/VinylSpooler.jsx` — size: M
- [ ] Contrast cut: ARMS workflow — files: `src/components/` (new), `src/platform/` — size: L
- [ ] Contrast cut: laser-pointer workflow — files: `src/components/` (new) — size: M
- [ ] Contrast cut: template cutting — files: `src/components/` (new), `src/lib/cutter.js` — size: M
- [ ] Plugin: Image Cut — files: `src/components/` (new), `src/context/AppContext.jsx` — size: M
- [ ] Plugin: Engraver — files: `src/components/` (new), `src/context/AppContext.jsx` — size: M
- [ ] Worksheets — files: `src/components/` (new), `src/context/AppContext.jsx` — size: M
- [ ] Project Information — files: `src/components/` (new) — size: S
- [ ] Object Selector — files: `src/components/` (new), `src/context/AppContext.jsx` — size: M
- [ ] Fit Text To — files: `src/context/AppContext.jsx`, `src/components/Canvas.jsx` — size: M

## Phase 4 — Desktop-only capabilities
- [ ] TWAIN/WIA scanner acquisition (`scan:list`/`scan:acquire` pending) — files: `electron/main.cjs`, `src/platform/desktop.js` — size: L
- [ ] OS print pipeline Print Window (copies/range/options/size/layout/position) — files: `electron/main.cjs`, `src/platform/`, `src/components/` (new dialog) — size: M
- [ ] Native USB + parallel cutter output and port diagnostics (`port:*` pending) — files: `electron/main.cjs`, `src/platform/desktop.js`, `src/lib/cutter.js` — size: L
- [ ] Installed-font enumeration + Font Manager integration (`fonts:list` pending) — files: `electron/main.cjs`, `src/components/FontManager.jsx`, `src/platform/` — size: M
- [ ] Recent files, autosave, auto-backup to real filesystem — files: `electron/main.cjs`, `src/context/AppContext.jsx` — size: M

## Phase 5 — Verification
- [ ] Command registry: all 138 reference commands with default bindings — files: `src/lib/` (new), `src/components/KeyboardShortcuts.jsx` — size: L
- [ ] Per-edition capability assertions — files: `src/` tests, `src/editions/` — size: M
- [ ] Command-table conformance checks — files: `src/lib/__tests__/` — size: M
- [ ] Smoke sweep coverage (tools/panels/dialogs/commands) — files: `src/lib/__tests__/` — size: M

## Shell spec
- [ ] Edition capability matrix (command counts per edition: 139/120/102/81/81) — files: `src/editions/`, `src/context/AppContext.jsx` — size: M
- [ ] 58 ART-only commands gating (text/fonts/curves/bitmaps/effects/colour/layout/output) — files: `src/editions/`, `src/components/MenuBar.jsx` — size: M
- [ ] CUT vs CUT+ARMS modelled as hardware (ARMS mark-sensor) capability — files: `src/platform/`, `src/editions/` — size: S
