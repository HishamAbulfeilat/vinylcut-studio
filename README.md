# VinylCut Studio

An original, open-source sign-making and vinyl cutting web app built with React and Vite.

> **Not affiliated with, endorsed by, or derived from any commercial sign software.**
> This is an independent reimplementation of common vector/sign-making concepts.

## Status

**Working end-to-end** (verified in a browser):

- 42 drawing tools (shapes, curve/pen, text incl. arc/path/vertical/paragraph)
- Selection: click, shift-click multi-select, marquee (rubber-band), drag to move
- Real boolean geometry — **Weld, Punch Out, Trim, Cookie Cut** (via `polygon-clipping`)
- **Knife** — drag a cut line and the object is genuinely split into separate paths
- **Contour / Offset** — drag outward or inward from an object to inset/outset real geometry
- **Vectorize (trace bitmap)** — threshold or k-means colour tracing of imported rasters into
  real paths, with hole detection, Douglas–Peucker smoothing, noise filtering and a live
  parameter dialog
- **Centerline trace** — a genuine Zhang–Suen skeletonisation, skeleton-graph walk into open
  polylines, spur and junction handling, Douglas–Peucker smoothing and a stroke width measured
  from ink area per unit of skeleton length (outline tracing remains the other mode)
- **Node editing** — actual path vertices are shown and can be dragged (not just a bbox)
- **Eraser** and **bucket Fill** tools, **Zoom** tool, click-to-apply clone / warp / effect tools
- **Real fills** — solid, linear gradients (multi-stop + angle), hatched textures, spot colours,
  plus CSS/SVG rendering for both DOM and SVG shapes
- **Live effects** — 3D / Logo-3D extrusion, Block / Drop / Soft shadow, Glow, Outline,
  Inner Outline, Multi-Outline, Multi-Inline, Tint Map, Fire, Reflect.
  Effects are stored on the object, layered around it at render time, and survive save/load.
- **Warps** — Circle, Coons, Flag, Perspective, Skirt, Trapezoid, Wave, Arch, Bulge, Twist,
  Squeeze, Fisheye, Ripple. These are **continuous analytic maps**, not strip lists: vector art
  is pushed through the warp as real densified geometry (curves stay smooth, straight edges
  bend), and text/bitmaps are resampled per output pixel through the inverse map
- **Import** — raster (PNG/JPEG/GIF/BMP/WebP), SVG (incl. `<g transform>`), DXF R12
  (`TEXT`/`MTEXT`, `LWPOLYLINE`/`POLYLINE`, `LINE`, `CIRCLE`/`ARC`, `SOLID`/`TRACE`/`3DFACE`),
  HPGL/PLT (incl. `LB` labels), **PDF / EPS / AI** (a real object parser plus a content-stream
  interpreter, `FlateDecode` included), and `.vcs` documents
- **Export** — SVG, PDF 1.4, EPS, AI (PostScript), DXF R12, HPGL/PLT, plus rasterised
  PNG / JPEG / BMP at a chosen DPI; crop and registration marks included
  - text is written as **real text** (SVG `<text>`, PDF `BT/Tf/Tm/Tj`, EPS `show`, DXF `TEXT`,
    HPGL `LB`) sized with base-14 font metrics — not as a bounding box
  - rasters are embedded as **real images** (`<image>`, PDF `/DCTDecode` XObject, EPS
    `colorimage`); DXF and HPGL have no raster concept, so bitmaps are auto-traced to paths
  - **curves stay curves** — true cubics are emitted (PDF `c`, EPS `curveto`, SVG `C`)
- **Cutter output** — real HPGL with **per-vendor dialects** (HP-GL/1, HP-GL/2, Graphtec GP-GL,
  Summa, Roland DMPL) including each vendor's init / park / status sequences and USB vendor-ID
  filters; streamed over **WebSerial** when the user grants a port, otherwise saved as a `.plt`
- **Contour Cut Wizard** — produces genuine offset cut lines (with cut order and
  skip-inner-cuts handling) and optional crop rectangles, not just a UI
- **Vinyl Spooler** — real jobs built from the current document, real HPGL on *Start Cut*
- **Save / Open** documents as `.vcs.json` (full round-trip, including effects)
- Undo/redo, align, z-order, group, duplicate, copy/paste
- Toast notifications for import/export/cutter results

**Deliberately not done:** nothing on the list above is faked. The earlier warp/export/curve
approximations and the missing PDF/EPS import have all been replaced with real implementations.

**What a browser still cannot do:**

- Ship an OS-level cutter **driver**. WebSerial covers USB/COM cutters on Chromium with a
  user-granted port; there is no kernel/parallel-port driver, and that is a platform limit
  rather than a missing feature.
- Reproduce an embedded-font PDF/AI exactly. Text is mapped to the nearest base-14 / system
  font when the source did not store glyph outlines as paths.

## Features

### Drawing Tools
- **Select Tool** - Select and manipulate objects
- **Shape Tools** - Rectangle, Ellipse, Polygon, Star, Spiral, Arrow
- **Curve Tools** - Line, Curve, Freehand, Pen
- **Text Tools** - Artistic Text, Text on Arc, Text on Path, Vertical Text, Text Box
- **Image Tools** - Import images, Vectorize/Trace
- **Clone Tools** - Clone Object, Matrix Array, Circle Array
- **Dimension Tool** - Dynamic measurements
- **Knife Tool** - Cut and slice objects

### Object Manipulation
- Move, Scale, Rotate, Mirror
- Align (Left, Right, Top, Bottom, Center H/V)
- Distribute horizontally/vertically
- Group/Ungroup
- Z-order (Bring to Front, Send to Back, etc.)
- Step and Repeat (Grid, Horizontal, Vertical, Radial)

### Fill & Effects
- Solid Color fill
- Gradient fill (Linear, Radial)
- Texture fill (12 built-in textures)
- Opacity control
- Stroke color and width
- Effects: 3D, Block Shadow, Drop Shadow, Soft Shadow, Glow, Outline, Multi-Outline, Multi-Inline
- Warps (13 continuous maps): Circle, Coons, Flag, Perspective, Skirt, Trapezoid, Wave, Arch,
  Bulge, Twist, Squeeze, Fisheye, Ripple

### Cutting & Output
- **Vinyl Spooler** - real jobs built from the current document, HPGL on *Start Cut*
- **Contour Cut Wizard** - generates genuine offset cut lines, cut order and crop rectangles
- **Cutter profiles** - HP-GL/1, HP-GL/2, Graphtec GP-GL, Summa, Roland DMPL, each with its own
  init/park/status commands and USB vendor-ID filter
- **WebSerial** "send to cutter" with a real `.plt` file fallback
- Speed, Force, Offset, Overcut settings
- Bidirectional cutting

### View & Navigation
- Zoom (In, Out, To All, To Page, To Page Width/Height) plus a click Zoom tool
- Pan
- Grid overlay
- Guides
- Rulers
- Snap to Grid/Guides/Objects

### Document Management
- Multi-page documents
- Page setup (size, orientation)
- Import: PNG, JPG, GIF, BMP, WebP, SVG, DXF, PLT, HPGL, PDF, EPS, AI, `.vcs`
- Export: SVG, PDF, EPS, AI, DXF, PLT/HPGL, PNG, JPG, BMP
- Save/Load project files (`.vcs.json`)
- Vectorize (trace bitmap) to real vector paths — outline or centerline

### Keyboard Shortcuts
- Ctrl+N: New Document
- Ctrl+O: Open
- Ctrl+S: Save
- Ctrl+Z: Undo
- Ctrl+Y: Redo
- Ctrl+C: Copy
- Ctrl+V: Paste
- Ctrl+X: Cut
- Ctrl+A: Select All
- Delete: Delete Selected
- F3: Zoom In
- F4: Zoom Out
- F5: Zoom to All
- F6: Zoom to Page

## Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Preview
```bash
npm run preview
```

## Technology Stack
- React 18
- Vite 5
- CSS3 (Custom properties, Flexbox, Grid)
- DOM + SVG rendering surface with an HTML5 Canvas grid/backing layer
- `polygon-clipping` for real boolean geometry and offsetting
- WebSerial for cutter output (Chromium), with a `.plt` fallback

## Project Structure
```
vinylcut-studio/
├── src/
│   ├── components/
│   │   ├── MenuBar.jsx
│   │   ├── Toolbar.jsx
│   │   ├── Canvas.jsx          # DOM/SVG surface + continuous warp rendering
│   │   ├── RasterWarp.jsx      # per-pixel warp surface for text and bitmaps
│   │   ├── PropertyPanel.jsx
│   │   ├── StatusBar.jsx
│   │   ├── TabBar.jsx
│   │   ├── Dialog.jsx
│   │   ├── ExportDialog.jsx
│   │   ├── VectorizeDialog.jsx # outline / centerline tracing
│   │   ├── VinylSpooler.jsx
│   │   ├── ContourCutWizard.jsx
│   │   ├── AlignmentDialog.jsx
│   │   ├── GradientEditor.jsx
│   │   ├── TextureLibrary.jsx
│   │   └── StepRepeatDialog.jsx
│   ├── context/
│   │   └── AppContext.jsx      # reducer, provider actions, import/export/cutter wiring
│   ├── lib/
│   │   ├── geometry.js    # shape <-> polygon, boolean ops, offset, knife, HPGL
│   │   ├── warp.js        # continuous warp maps + raster resampling
│   │   ├── tracer.js      # raster -> vector (outline and centerline/skeleton)
│   │   ├── rasterprep.js  # bitmaps -> bytes for PDF/EPS + auto-trace for DXF/HPGL
│   │   ├── pdf.js         # PDF parser + content-stream interpreter
│   │   ├── postscript.js  # PostScript / EPS / AI interpreter
│   │   ├── importers.js   # raster / SVG / DXF / PLT / PDF / EPS / document import
│   │   ├── exporters.js   # SVG / PDF / EPS / AI / DXF / HPGL + raster export
│   │   └── cutter.js      # cutter profiles, HPGL dialects, WebSerial driver
│   ├── App.jsx
│   ├── App.css
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
└── README.md
```
