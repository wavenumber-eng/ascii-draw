# Requirements

This directory contains functional requirements for the project — *what the product does*. Architectural decisions (*how it's built*) are in `../adrs/`.

**Legend:** `[x]` implemented · `[ ]` not implemented · `[~]` partial

## Index

| # | File | Section | Prefix |
|---|---|---|---|
| 01 | [Vision & overview](01-vision.md) | Project goals, use cases | — |
| 02 | [Design philosophy](02-philosophy.md) | Napkin to netlist, no library editor | `PHIL-*` |
| 03 | [Deployment](03-deployment.md) | Standalone HTML, no server | `DEP-*` |
| 04 | [Viewport](04-viewport.md) | 2D / 3D workspace, abstraction | `VIEW-*` |
| 05 | [Render backends](05-render-backends.md) | ASCII / SVG / 3D backends | `BACK-*` |
| 06 | [Overlays](06-overlays.md) | Selection, marquee, hints | `OVER-*` |
| 07 | [Cell configuration](07-cell-config.md) | Font, cell dimensions | `CELL-*` |
| 08 | [Tools](08-tools.md) | Select / Box / Line / Wire / etc. | `TOOL-*` |
| 09 | [Object model](09-object-model.md) | Boxes, lines, symbols, pins, wires, junctions | `OBJ-*`, `SYM-*` |
| 10 | [Selection & editing](10-selection-editing.md) | Marquee, multi-select, clipboard, inline edit | `SEL-*`, `MSE-*` |
| 11 | [User interface](11-user-interface.md) | Toolbar, panels, status bar, debug | `UI-*`, `DBG-*` |
| 12 | [Data model](12-data-model.md) | Project, pages, save/load, auto-save | `DATA-*` |
| 13 | [Export](13-export.md) | ASCII / ANSI / HTML / SVG / netlist | `EXP-*` |
| 14 | [Visual style](14-visual-style.md) | Typography, characters, render layers | `VIS-*` |
| 15 | [Keyboard shortcuts](15-keyboard-shortcuts.md) | Master shortcut table | — |
| 16 | [Testing](16-testing.md) | Test framework, coverage rules | `TEST-*` |
| 17 | [Domain logic](17-domain-logic.md) | Wire/Symbol/Line modules, derive pass | `DOM-*`, `ARCH-*` |

## Status snapshot

The historical "Implementation Progress" summary lived in this document. The authoritative current status is now in [`../plans/00-status-audit.md`](../plans/00-status-audit.md), which is reconciled against actual code rather than against checklists.
