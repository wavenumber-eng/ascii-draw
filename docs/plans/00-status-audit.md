# Implementation Status Audit

**Date:** 2026-04-29
**Method:** code inspection + `npm test` (335 tests pass across 13 suites)

This document reconciles the historical implementation plan (`IMPLEMENTATION_PLAN.md`) with the actual code. Where the plan and the code disagree, the code wins. Where the code has accumulated something not in the plan, it's flagged here.

---

## Phase summary

| Phase | Plan claim | Code reality | Verdict |
|---|---|---|---|
| Phase 1: Interface Definitions | ✅ Complete | All four interface files exist (`IViewport`, `IRenderBackend`, `IOverlayRenderer`, `IExporter`) and are referenced by implementations | ✅ **Complete** |
| Phase 2: Extract Canvas2D | ✅ Complete (legacy fallbacks removed) | `Canvas2DViewport`, `CanvasASCIIBackend`, `Canvas2DOverlay` all exist. **But:** `js/rendering/Renderer.js` (958 lines) is still loaded as a fallback path; tool overlays still draw via `context.grid.charToPixel`, not through `IOverlayRenderer` | ⚠️ **Mostly complete** — see "Open items" below |
| Phase 3: Domain Logic | ✅ Complete (107 tests) | `domain/Wire.js`, `domain/Symbol.js`, `domain/Line.js` exist. Test count is now 335 across 13 suites (domain + commands + utils + lineUtils + DerivedStateComputer + interface contracts + export). Tools delegate to domain modules | ✅ **Complete** |
| Phase 4: Exporters | ✅ Complete | `ASCIIExporter` exists, satisfies `IExporter`, has tests (`export.test.js`, `export-textbox.test.js`, `IExporter.test.js`) | ✅ **Complete** |
| Phase 5: Three.js | ⚠️ Partial (60%) | `ThreeJSViewport` works (MapControls, view presets via Alt+1..5). No separate `ThreeJSASCIIBackend` — uses a texture-based approach where the 2D canvas backend renders to a texture displayed in 3D | ⚠️ **Functional, not architecturally clean** |
| Phase 6: Cell Config | ⚠️ Partial (30%) | `setCellDimensions` / `getCellDimensions` exist on `IViewport` and both implementations. Cell dims are configurable at viewport construction time. No runtime UI to change them; no font measurement utility; no font-selection setting | ⚠️ **API exists, not wired to UI** |

**Headline:** the architectural refactor is essentially done. What remains is cleanup of duplicate code paths and feature-completion work.

---

## Open items by category

### A. Dead / duplicate code (highest cleanup priority)

#### A1. Dual derived-state computation paths

**The bug:** there are two systems doing junction computation, running on every state change.

- **Old path (should be deleted):** `HistoryManager.recomputeActivePageJunctions()` calls `AsciiEditor.core.recomputeJunctions(page)` (in `js/core/utils.js`), which **mutates `page.objects` to inject `junction` and `wire-junction` objects**. This runs after every `execute()`, `undo()`, `redo()`.
- **New path (correct):** `Editor.render()` calls `DerivedStateComputer.compute(primaryObjects)`, which produces ephemeral derived objects in a `renderList`. The new path filters out `derived: true` objects from `page.objects` before computing, to avoid double-counting the leftovers from path 1.

**Why this matters:** `DERIVED_OBJECTS_PLAN.md` Phase 5 says "Migrate Existing Junction Logic — Move junction computation from Renderer to DerivedStateComputer" and that step did happen, but the **HistoryManager hook was never disconnected**. Saved files now include `derived: true` junction objects from the old path, which the new path then filters out — wasted work in both directions.

**To fix:**
1. Remove `recomputeActivePageJunctions()` and the merging call from `HistoryManager`.
2. Remove `AsciiEditor.core.recomputeJunctions` and `AsciiEditor.core.mergeConnectedLines` if no longer used elsewhere (they are also called from `LineTool.js`).
3. Audit save format — strip `derived: true` objects on save (they should never be persisted; see ADR 0010 hybrid-storage rule which says save *for debugging* but the user's intent has shifted toward "ephemeral, never saved").
4. Confirm no other callers depend on `page.objects` containing junctions — any consumer must read from `derivedState.renderList`.

#### A2. Legacy `Renderer.js` still loaded

`js/rendering/Renderer.js` (958 lines) implements the original render pipeline. `Editor.render()` has both code paths:

```javascript
if (this.viewport && this.backend) {
  this._renderWithNewArchitecture(state, page, editContext);
} else {
  // Fallback to legacy renderer
  this.renderer.render(state, this.toolManager, editContext, this.derivedState);
}
```

In practice the new architecture is always available, so the fallback never runs. The legacy renderer is dead code we keep loading. Removing it shaves ~1000 lines from the bundle and eliminates a "two ways to do anything" trap.

**To fix:** delete `js/rendering/Renderer.js`, remove its `<script>` tag from `index.html`, remove the fallback branch from `Editor.render()`, and remove the `this.renderer` field from `Editor`.

#### A3. Legacy fields in tool context

`Editor.setupTools()` puts both new and legacy resources on the tool context:

```javascript
this.toolManager.setContext({
  canvas: this.canvas,    // legacy
  grid: this.grid,        // legacy
  viewport: this.viewport, // new
  history: this.history,
  // ...
});
```

Tools mostly read `event.col` / `event.row` from the pre-computed mouse event (from `Editor._createMouseEvent`), but they still call `context.grid.charToPixel(...)` 28 times across 7 tool files when drawing overlays. That blocks A4 (overlay migration).

**To fix:** in this order: (A4) migrate tool overlays through `IOverlayRenderer`, then remove `canvas` and `grid` from the context, then evaluate whether `CharacterGrid` itself can be deleted (its `charWidth`/`charHeight` are duplicated on viewport via `getCellDimensions`).

### B. Architectural debt

#### B1. Tools draw overlays directly to `ctx` (blocks proper Three.js overlays)

ADR 0009 splits content from overlays. `Canvas2DOverlay` exists and implements `IOverlayRenderer`, but tools' `renderOverlay(ctx, context)` methods draw directly to the canvas 2D context. They never call the overlay renderer.

This is the same problem as A3 in different clothes: as long as tools draw via `context.grid.charToPixel(...)` and `ctx.fillRect/strokeRect`, the overlay abstraction is a wrapper around nothing.

**Migration path:** introduce overlay drawing methods on `IOverlayRenderer` for the patterns tools currently use (rubber-band, drag ghost, marquee, vertex/segment handles, snap indicators, "PIN" hints). Replace direct `ctx` calls in tools with calls into the overlay. Then a `ThreeJSOverlay` (2D-canvas-on-top-of-WebGL) becomes a drop-in.

#### B2. Editor.js is doing too much (3605 lines)

Editor.js currently owns: viewport setup, tool registration, hotkeys, mouse/key dispatch, **the entire properties panel (1700+ lines)**, inline editing for box text, label editing for designators/parameters, pin name editing, page tabs, save/load, auto-save, debug panel, render orchestration, copy/cut/paste, ASCII export buffer rendering.

The architecture overview promises a future `js/ui/` directory with `PropertiesPanel.js`, `Toolbar.js`, `PageTabs.js`. This hasn't happened. Splitting the properties panel out is the highest-value extraction:
- PropertiesPanel can live in `js/ui/PropertiesPanel.js` and own all `render*Properties` and `wire*PropertyListeners` methods.
- Inline-edit controllers (`InlineTextEditor`, `LabelEditor`, `PinEditor`) can each live in `js/ui/`.
- `PageTabs`, `DebugPanel`, `Toolbar` can each be small standalone modules.

After extraction, Editor.js should be ~500 lines orchestrating wiring and event flow.

#### B3. SelectTool.js is 2676 lines

The largest tool by far. It handles: hit testing, marquee selection, single/multi click, drag-to-move, resize handles, vertex/segment handles for lines and wires, label/pin sub-selection, hover hints for wire-pin binding, modifier-key behavior, drag previews. Some of this is naturally one tool's responsibility, but pieces like resize-handle math and vertex-handle math could move to a `Transformer` or `HandleManager` collaborator.

Lower priority than B2 (the properties panel split) but worth a separate plan when SelectTool needs significant feature work.

#### B4. No `js/objects/` directory

The architecture overview lists this as "future planned." Today, object types are described:
- by data shape only (no class, no `static` methods on a `Box`/`Line` constructor),
- by `case` arms in switch statements (`Editor._drawObjectWithBackend`, `CanvasASCIIBackend.drawObject`, `ASCIIExporter`).

Adding a new object type today means editing every backend, exporter, and a few editor files. A registry pattern (`AsciiEditor.objects.Registry.register('newtype', NewObject)`) would localize each type to one file. **Not blocking anything**, but lowers the activation energy for new object types like Port, Power, HierarchicalBlock.

### C. Feature gaps the plan didn't enumerate

These are visible in the requirements (`docs/requirements/`) but not the implementation plan:

- **TOOL-25 WireTool** is registered and works for *creation*, but several wire requirements are still ❌: pin auto-create on wire endpoint (TOOL-28F), wire-to-pin binding (OBJ-65–69), floating end no-connect rendering (OBJ-6F), wire merging (OBJ-6H–6K). Some logic exists in `domain/Wire.js` but isn't wired into the interactive flow.
- **TOOL-26 PortTool, TOOL-27 PowerTool, TOOL-29 DeleteTool** — not implemented.
- **OBJ-30..3G LineTool** behavior — checkboxes show "not implemented" in the requirements doc, but the tool *is* registered and works (creating lines, drawing them, posture toggle, vertex/segment handles). The status flags in the requirements doc were out of date when split. Updating them is part of this audit's recommendations.
- **OBJ-50..5D Symbol object model** — partially implemented; designators, parameters, and pins exist as data but several sub-features (OBJ-57 repositionable designator, OBJ-59 copy auto-increment, OBJ-5A1..5A8 sub-selection of designator/value) are not wired into selection or properties panel.
- **EXP-3 Knockout fallback to brackets `[U1]`** — not implemented.
- **EXP-10..43 ANSI/HTML/SVG/Netlist exporters** — not implemented (only ASCII).
- **VIS-50..63 Multi-pass rendering with explicit RenderLayer enum** — not implemented; current code uses the simpler "iterate sorted renderList" approach. Acceptable, but the requirement is more elaborate than the implementation.

### D. Test coverage gaps

- `state.test.js` (TEST-23) and `tools.test.js` (TEST-24) — listed in requirements as planned, not present. Tools are hard to test without a DOM/canvas; state.test would be straightforward and useful.
- ThreeJS viewport / overlay — no automated coverage (jsdom can't drive WebGL).
- Properties panel — no automated coverage; relies on visual verification.
- Inline edit / label edit / pin edit flows — no automated coverage.

### E. Doc-sync findings (now fixed by this reorg)

- `requirements.md` claimed several `TOOL-23 LineTool` and `OBJ-30..` items were "not implemented" while the LineTool *is* working. Status flags were stale.
- `ARCHITECTURE.md` referenced `ascii_editor.html` (legacy monolithic file) which is no longer in the tree.
- `ARCHITECTURE.md` Section 6/7 (adding tools/objects) referenced ES module syntax (`import`/`export`) that contradicts ADR 0003 (namespace pattern). The new ADR 00-overview corrects this.

---

## Recommended next steps (prioritized)

1. **A1 — Remove the dual derived-state path.** Single biggest wins: less code, no more "save file contains junctions but they're recomputed at load anyway" confusion, removes the only remaining caller of `recomputeJunctions`.
2. **A2 — Delete legacy `Renderer.js`.** -1000 lines, removes a code path that's never exercised.
3. **B1 — Migrate tool overlays through `IOverlayRenderer`.** Unblocks Three.js overlay support and finishes Phase 2 cleanly.
4. **A3 — Drop `canvas` and `grid` from tool context.** Trivial after B1 lands.
5. **B2 — Extract `PropertiesPanel` from `Editor.js` into `js/ui/`.** Biggest ergonomic win for working in `Editor.js`.
6. **C — Feature work** (wire-pin binding, no-connects, port/power/delete tools) on top of the cleaner base.

Phase 5 (Three.js architectural cleanup) and Phase 6 (runtime cell config) stay deferred — both are nice-to-have, neither blocks anything.
