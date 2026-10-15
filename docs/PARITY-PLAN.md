# VinylCut Studio — Parity Plan

This document is the working plan for reaching a complete, layout-exact reimplementation of the
reference application, running as **both a web app and a desktop app**, with all five editions
present in a single build behind a launch-time edition chooser.

Decisions already made:

| Decision | Choice |
|---|---|
| Desktop runtime | **Electron** (Chromium, so the existing WebSerial cutter path keeps working; Node for native device access) |
| Visual parity target | **Layout-exact, own brand** — identical geometry, spacing, sizing, colour, panel order, toolbars, dialogs and shortcuts as measured from the reference; product name, logo and icons remain VinylCut Studio's own |
| Editions | **One app**, edition chosen at launch, each edition driving its own capability surface |

> Layout parity is measured from the reference application's own declarative UI data
> (panel/dialog definitions, per-edition skin metrics and shortcut tables). Original artwork,
> icons and code are **not** copied; where the reference has an icon, ours is drawn to match its
> role and footprint.

---

## 1. Ground truth (reverse-engineered)

Reference installation layout:

```
BinExe/            main executable + cutters/spooler/plugins/font tools
System/GuiData/    per-edition UI definitions  <-- the parity source of truth
System/Data/       cutter dialects, EPS/SVG/DXF/HPGL templates, CMYK profiles, ARMS calibration
Resources/System/  page sizes, gradients, textures, shapes, colour library, end caps
Help/Html/Manual/  the user manual (315 pages)
Help/System/       manual tree, help links
```

### 1.1 Editions (capability ladder, highest first)

| Edition | Product identity | Code | Tool-layout files |
|---|---|---|---|
| ART | SignMaster ART 5.0 | VMX | 46 |
| XPT | SignMaster XPT 5.0 | SMX | 39 |
| PRO | SignMaster PRO 5.0 | SMP | 27 |
| CUT + ARMS | SignMaster CUT+ARMS 5.0 | SMC | 20 |
| CUT | SignMaster CUT 5.0 | SMC | 20 |

Each edition ships its **own** UI definitions (`Demo_GuiVMB/VMC/VML/VMP/VMS`): property/panel
layouts, settings dialogs, action table, context menus, shortcut table, skin metrics and one
layout file per tool. This is what makes layout-exact parity tractable.

### 1.2 Command surface

The reference shortcut table declares **138 commands** (IDs such as `TID_NewDocument`,
`TID_ShapingDialog`, `TID_LES_Slicer_1`) with their default bindings — that table is our
authoritative command list and is what our shortcut/command registry must match.

### 1.3 Documented feature surface

**315 help pages across 25 sections**: workspace & documents, import/export, shapes,
objects & layout, colour & fills, shaping & welding, distortions, vector effects, text, fonts,
curves, pen styles, bitmaps, vectorizing, contour cutting, print, cut, plugins, reference.

---

## 2. Target architecture

One codebase, two hosts, a shared engine.

```
vinylcut-studio/
├─ src/                      # the React app — runs unchanged on web and desktop
│  ├─ lib/                   # engine: geometry, warps, tracing, import/export, cutter, raster
│  ├─ platform/              # capability abstraction (see below)
│  ├─ components/            # UI surface
│  └─ editions/              # per-edition capability + layout tables
├─ electron/
│  ├─ main.cjs               # window, app lifecycle, IPC router
│  ├─ preload.cjs            # contextBridge -> window.vcsDesktop
│  └─ native/                # device + OS integrations (ports, print, scan, fonts)
├─ docs/
└─ package.json
```

### 2.1 Platform abstraction

Everything host-specific goes through one interface, with a web backend and a desktop backend:

| Capability | Web backend | Desktop backend |
|---|---|---|
| Open/Save dialogs | `<input type=file>` / download | native OS dialogs |
| Cutter output | WebSerial (Chromium, user-granted port) | native serial **+ parallel port** |
| Print | `window.print()` | **OS print driver** pipeline |
| Scanner/camera | file import only | **TWAIN/WIA acquisition** |
| Font enumeration | Local Font Access API (Chromium) | installed-font enumeration |
| Filesystem | none | real paths, recent files, autosave/autobackup |

No capability is faked: a host that cannot provide one reports it as unavailable rather than
silently returning empty results.

### 2.2 Edition gating

Each edition has a capability table derived from its own UI definitions (which panels, tools,
dialogs, menu entries and commands it exposes). The edition chooser sets this table; the app then
renders only what that edition has, so the CUT edition genuinely differs from ART.

---

## 3. Phases

Work is delivered in phases; each phase ends with a build that runs and a push.

### Phase 0 — Specification extraction ✅ *(complete)*
- Edition ladder and per-edition UI/layout identities
- 138-command inventory
- 315-page documented feature surface
- Verification that the reference runs and can be captured for layout measurement

### Phase 1 — Foundation *(this phase)*
- Electron host: window, lifecycle, IPC router, preload bridge
- Platform abstraction with web + desktop backends
- Native integrations that need no extra native module: OS open/save dialogs, OS print pipeline
- Desktop build/packaging pipeline
- **Exit criteria:** the same app runs as a web app and as a desktop app, both passing the smoke sweep

### Phase 2 — Layout parity and the edition chooser
- Rebuild the application shell to the reference's metrics: window chrome, DesignCenter, toolbar
  strips, Object Manager, Property Inspector, status bar, rulers
- Rebuild each panel and dialog group to the reference's geometry, ordering and labelling
- Launch-time edition chooser driving the capability table
- **Exit criteria:** side-by-side screenshot comparison against captured reference screens at the
  same window size; structural diff within tolerance for each of the five editions

### Phase 3 — Feature parity, gap by gap
Driven by the 315-page manual. Known gaps to close (non-exhaustive):
- Power Shapes suite (Power Rect/Circle/Star/Polygon editors), Chaos Star, logarithmic/Archimedean spirals, triangle
- Elastic Mode (rubber mode), Space Apart, full Distribute
- Spot Colour Mixer, named/vinyl colour libraries, system (device) colours
- Bitmap fills, Reverse/Wireframe fill modes, fill-mode switching
- Shaping: Punch Out, Stamp, Common, Trim as a single Shaping dialog; Welding incl. layers
- Distortion editor (separate from warps); Stripes; Outline Editor; Multi-Outline/Multi-Inline
- Text: bullet points, indents, columns, tabs, sub/superscript, change case, kerning/tracking
  tables, text wrapping, break-by-char/word/line/paragraph
- Curves: polycurve, polyline, smooth-line, vector brush, connector tools, replace section, reduce nodes
- Bitmaps: adjustments, colour correction/reduction, gaussian blur, filters, node editing images, resample, flatten
- Vectorizer parity: pretrace, trace options, automatic image correction
- Cut: Autocut, Cutfile documents, Cutfile Editor (weed boxes, chop guide, lift marks, alignment/hanging marks, nesting, merge tiles), Vinyl Spooler (sorting/filtering, auto-fit queue, nesting)
- Contrast cut: ARMS workflow, laser-pointer workflow, template cutting
- Plugins: Image Cut, Engraver
- Master Pages, Worksheets, Project Information, Object Selector

### Phase 4 — Desktop-only capabilities
- TWAIN/WIA scanner acquisition (Insert → Acquire)
- OS print-driver pipeline with the Print Window (copies/range/options/size/layout/position)
- Native USB **and parallel** cutter output; port enumeration and diagnostics
- Installed-font enumeration + the Font Manager integration
- Recent files, autosave and auto-backup to the real filesystem

### Phase 5 — Verification
- Automated smoke sweep: every tool, panel, dialog and command, asserting zero runtime errors
- Command-table conformance: all 138 reference commands present with matching default bindings
- Per-edition capability assertions
- Layout regression: screenshot comparison harness against captured reference screens

---

## 4. Honest constraints

- **Web** inherits browser limits: no OS print driver, no scanner acquisition, no parallel port.
  Those live in the desktop build, which is exactly why the app ships as both.
- **Fonts** inside imported PDF/AI are mapped to the nearest installed face when the source does
  not embed outlines.
- Parity is to the **reference this installation represents** (5.0-era, five editions). Where an
  edition's own files do not define a behaviour, it is not invented.
