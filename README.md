# VinylCut Studio

An original, open-source sign-making and vinyl cutting web app built with React and Vite.

> **Not affiliated with, endorsed by, or derived from any commercial sign software.**
> This is an independent reimplementation of common vector/sign-making concepts.

## Status

**Working end-to-end** (verified in a browser):
- 40+ drawing tools (shapes, curve/pen, text incl. arc/path/vertical/paragraph)
- Selection: click, shift-click multi-select, marquee (rubber-band), drag to move
- Real boolean geometry — **Weld, Punch Out, Trim, Cookie Cut** (via `polygon-clipping`)
- **Save / Open** documents as `.vcs.json` (full round-trip)
- Undo/redo, align, z-order, group, duplicate, copy/paste
- Export dialog, Cut spooler and contour-cut wizard UI, colour/font libraries

**Cosmetic only** (renders nothing or a placeholder):
- Warp (7 types) and 3D / Logo-3D tag an object but are not rendered
- Vectorize returns a placeholder rectangle — there is no image tracing
- Knife does not actually split paths

**Not possible in a browser app:**
- Driving real cutters — there is no USB/serial or HPGL device output

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
- **Vinyl Spooler** - Job queue management with cutter settings
- **Contour Cut Wizard** - Step-by-step contour cutting setup
- Support for Summa, Graphtec, Roland, Mimaki cutters
- Speed, Force, Offset, Overcut settings
- Bidirectional cutting

### View & Navigation
- Zoom (In, Out, To All, To Page, To Page Width/Height)
- Pan
- Grid overlay
- Guides
- Rulers
- Snap to Grid/Guides/Objects

### Document Management
- Multi-page documents
- Page setup (size, orientation)
- Import/Export (SVG, PNG, JPG, BMP, PDF, AI, EPS, DXF, PLT, HPGL)
- Save/Load project files

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
- HTML5 Canvas

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
│   │   ├── VinylSpooler.jsx
│   │   ├── ContourCutWizard.jsx
│   │   ├── AlignmentDialog.jsx
│   │   ├── GradientEditor.jsx
│   │   ├── TextureLibrary.jsx
│   │   └── StepRepeatDialog.jsx
│   ├── context/
│   │   └── AppContext.jsx
│   ├── App.jsx
│   ├── App.css
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
└── README.md
```
