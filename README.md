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
- **Node editing** — actual path vertices are shown and can be dragged (not just a bbox)
- **Eraser** and **bucket Fill** tools, **Zoom** tool, click-to-apply clone / warp / effect tools
- **Real fills** — solid, linear gradients (multi-stop + angle), hatched textures, spot colours,
  plus CSS/SVG rendering for both DOM and SVG shapes
- **Live effects** — 3D / Logo-3D extrusion, Block / Drop / Soft shadow, Glow, Outline,
  Inner Outline, Multi-Outline, Multi-Inline, Tint Map, Fire, Reflect.
  Effects are stored on the object, layered around it at render time, and survive save/load.
- **Warps** — Circle, Coons, Flag, Perspective, Skirt, Trapezoid, Wave, rendered for real
  by slicing the object into displaced/scaled strips
- **Import** — raster (PNG/JPEG/GIF/BMP/WebP), SVG (incl. `<g transform>`), DXF R12
  (`LWPOLYLINE`/`POLYLINE`/`CIRCLE`/`ARC`/`LINE`), HPGL/PLT, and `.vcs` documents
- **Export** — SVG, PDF 1.4, EPS, AI (PostScript), DXF R12, HPGL/PLT, plus rasterised
  PNG / JPEG / BMP at a chosen DPI; crop and registration marks included
- **Cutter output** — real HPGL generated from the page or selection; streamed to a cutter over
  **WebSerial** when the browser supports it, otherwise saved as a `.plt` file
- **Contour Cut Wizard** — produces genuine offset cut lines (with cut order and
  skip-inner-cuts handling) and optional crop rectangles, not just a UI
- **Vinyl Spooler** — real jobs built from the current document, real HPGL on *Start Cut*
- **Save / Open** documents as `.vcs.json` (full round-trip, including effects)
- Undo/redo, align, z-order, group, duplicate, copy/paste
- Toast notifications for import/export/cutter results

**Approximated** (documented, deliberate):

- Warps are discrete strip transforms (24 vertical strips), not a continuous mesh warp
- Vector export writes text as its bounding box and drops raster images from vector output;
  use the PNG/JPEG/BMP paths for image-bearing artwork
- Curves are flattened when converted to polygons for cutting and boolean ops

**Not possible in a browser app:**

- A bundled cutter **driver**. There is no native USB/parallel driver here — output is
  standard HPGL over WebSerial (Chrome/Edge, user-granted port) or as a `.plt` file
- Importing PDF / AI / EPS — no PostScript interpreter is shipped; the importer says so
  rather than silently failing

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

### Cutting & Output
- **Vinyl Spooler** - real jobs built from the current document, HPGL on *Start Cut*
- **Contour Cut Wizard** - generates genuine offset cut lines, cut order and crop rectangles
- **HPGL / PLT** output for Summa, Graphtec, Roland, Mimaki cutters
- **WebSerial** "send to cutter" with a `.plt` file fallback
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
- Import: PNG, JPG, GIF, BMP, WebP, SVG, DXF, PLT, HPGL, `.vcs`
- Export: SVG, PDF, EPS, AI, DXF, PLT/HPGL, PNG, JPG, BMP
- Save/Load project files (`.vcs.json`)
- Vectorize (trace bitmap) to real vector paths

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

## Project Structure
```
vinylcut-studio/
├── src/
│   ├── components/
│   │   ├── MenuBar.jsx
│   │   ├── Toolbar.jsx
│   │   ├── Canvas.jsx
│   │   ├── PropertyPanel.jsx
│   │   ├── StatusBar.jsx
│   │   ├── TabBar.jsx
│   │   ├── Dialog.jsx
│   │   ├── ExportDialog.jsx
│   │   ├── VectorizeDialog.jsx
│   │   ├── VinylSpooler.jsx
│   │   ├── ContourCutWizard.jsx
│   │   ├── AlignmentDialog.jsx
│   │   ├── GradientEditor.jsx
│   │   ├── TextureLibrary.jsx
│   │   └── StepRepeatDialog.jsx
│   ├── context/
│   │   └── AppContext.jsx
│   ├── lib/
│   │   ├── geometry.js    # shape <-> polygon, boolean ops, offset, knife, HPGL
│   │   ├── tracer.js      # raster -> vector tracing
│   │   ├── importers.js   # raster / SVG / DXF / PLT / document import
│   │   └── exporters.js   # SVG / PDF / EPS / AI / DXF / HPGL + raster export
│   ├── App.jsx
│   ├── App.css
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
└── README.md
```
