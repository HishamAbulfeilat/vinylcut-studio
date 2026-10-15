# Shell Specification (Phase 2 target)

Everything here is extracted from the reference application's own declarative UI data, not
invented. It is the target the application shell must reproduce, and the source for the per-edition
capability tables.

---

## 1. Window shell

Captured from the reference at 1500×950 and verified against our desktop host:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ title bar                                                                │
├──────────────────────────────────────────────────────────────────────────┤
│ menu bar: File Edit View Object Arrange Effects Tools Page Utilities Help│
├──────────────────────────────────────────────────────────────────────────┤
│ tab strip: Design │ Cut │ Print │ Layout │ Effects                       │
├──────────────────────────────────────────────────────────────────────────┤
│ tool strip (icon + label buttons, one row, stage-dependent)              │
├────┬─────────────────────────────────────────────────────┬───────────────┤
│    │                                                     │               │
│ r  │                  page / canvas                      │  Properties   │
│ u  │                  (white page, rulers on            │  inspector    │
│ l  │                   top and left)                     │  (tabbed)     │
│ e  │                                                     │               │
│ r  │                                                     │               │
│ s  │                                                     │               │
├────┴─────────────────────────────────────────────────────┴───────────────┤
│ status bar: Tool · Objects · Selected · Page 1 of 1 · X/Y · Zoom         │
└──────────────────────────────────────────────────────────────────────────┘
```

## 2. Property inspector — authoritative structure

Extracted from the reference property definition: **640 property items across 21 root groups**.
All five editions ship an identical property tree (640 items, 21 roots, 221 advanced-flagged), so
the inspector's shape is fixed and the editions differ only in the command/tool surface (§3).

| # | Root group | Children | Visibility attributes |
|---|---|---|---|
| 1 | `PID_ApplicationState` | 13 | master |
| 2 | `PID_DocProps` | 4 | master |
| 3 | `PID_PageProps` | 6 | master |
| 4 | `PID_SizeProps` | 6 | master |
| 5 | `PID_ObjGeneric` | 5 | master |
| 6 | `PID_ShapeProps` | 23 | master |
| 7 | `PID_ImageProps` | 3 | master |
| 8 | `PID_TextProps` | 11 | master |
| 9 | `PID_FontProps` | 13 | master |
| 10 | `PID_CurveProps` | 4 | master |
| 11 | `PID_CloneProps` | 9 | master |
| 12 | `PID_GuideDimProps` | 13 | master |
| 13 | `PID_EffectProps` | 23 | master |
| 14 | `PID_3DEffectProps` | 17 | master |
| 15 | `PID_WarpProps` | 12 | master |
| 16 | `PID_FillProps` | 9 | master |
| 17 | `PID_PenProps` | 1 | master |
| 18 | `PID_ViewProps` | 14 | master |
| 19 | `PID_SysProps` | 31 | advanced, master, hidden |
| 20 | `PID_DiagnosticProps` | 11 | advanced, master |
| 21 | `PID_UnusedProps` | 18 | advanced, master |

### 2.1 Visibility mechanism

Each property carries attribute flags, and the reference uses them to decide what a given user sees:

- `gpaMaster` — part of the standard surface
- `gpaAdvanced` — only shown when advanced/expert mode is on
- `gpaHidden` — present but not shown

This is the reference's own mechanism for level differences, and it is what our inspector must
implement: one property registry, filtered by attributes, rather than a separate inspector per
configuration. 221 of the 640 properties are `advanced`-flagged.

## 3. Edition capability matrix

Command counts come from each edition's own shortcut table; tool layouts from its own tool files.

| Edition | Commands | Tool layouts | Notes |
|---|---|---|---|
| ART | **139** | 46 | full surface |
| XPT | 120 | 39 | −19 commands vs ART |
| PRO | 102 | 27 | −37 vs ART |
| CUT + ARMS | 81 | 20 | ARMS hardware support; same command set as CUT |
| CUT | 81 | 20 | entry |

CUT and CUT+ARMS expose an identical command set — they differ by **ARMS automated mark-sensor
support**, not by commands. That must be modelled as a hardware capability, not a command gate.

### 3.1 Commands ART has that CUT does not (58)

```
Text        Break by Char / Word / Line / Paragraph, FindText, ReplaceText,
            Text to Artistic / Paragraph / Vertical / Arc, Fit Text To
Fonts       Font Manager, Font Detective
Curves      Slicer, Replace, Append, Join Spiral, Join Tangent, Join Line,
            Join Delete, Join Reduce
Bitmaps     Adjust, Crop, Convert to Bitmap, Edit Mask, Mask Editor,
            OLE Bitmap, View Mask, Vectorize, Vectorizer
Effects     Effects Dialog, Select Preset FX, Show Effects, Engrave Fill,
            Engrave Module
Colour      Colour Libraries, Set Fill (Spot), Colour List, Object List
Layout      Centre to Page (H/V/both), Move to Page, New Page, Page is Master Page,
            Show Master Page, Show Step & Repeat dialog
Output      Cut Selected, RIP to Spooler, RIP Manager, RIP Spooler
Other       Full Screen Preview, Security, Setup Wizard, Show LM Settings
```

### 3.2 Capability ladder shape

The ladder is not linear in one axis: ART→XPT→PRO→CUT sheds **text** capability, then **node
editing**, then **bitmap/mask/vectorize**, then **effects/engraving**. The capability table must
therefore be a set of feature flags per edition, not a single "level" number.

## 4. What Phase 2 must deliver

1. Shell chrome at the reference's metrics: menu bar, stage tab strip, tool strip, rulers,
   canvas, inspector pane, status bar.
2. The 21-group property inspector, driven by one attribute-filtered registry (so `gpaAdvanced`
   handling is real, not cosmetic).
3. A launch-time edition chooser writing a capability table (§3), with the app rendering only what
   the selected edition actually has.
4. A layout-regression harness: `electron . --capture=<png>` per screen, compared against captured
   reference screens at the same window size.
