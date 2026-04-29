# ADR 0010: Junctions and No-Connects as Derived (Ephemeral) State

**Status:** Accepted

## Context

The schematic semantics need several "marker" objects that aren't authored by the user but emerge from geometry:

- **Line junctions** where two or more lines meet/cross at a point
- **Wire junctions** where a wire endpoint or vertex lands on another wire's segment
- **Wire no-connects** ("X" markers) where a wire endpoint is unbound — not on a pin, not connected to another wire

If we *store* these in `page.objects`, every line/wire edit needs to carefully update them, and undo/redo has to roll them back. Bugs accumulate where someone forgets to recompute. We had this in the original code and it leaked.

## Decision

**Junctions and no-connects are derived state, computed from primary objects on every render. They are never stored in the primary object array.**

### Layered flow

```
TOOL LAYER
├ Modifies primary objects via commands.
└ Has NO knowledge of derived objects.
        │
        ▼
PRIMARY STATE (page.objects[])
├ Only user-authored objects: box, symbol, line, wire, text.
├ Persisted to file.
└ Managed by undo/redo.
        │
        ▼
DERIVE PASS  (DerivedStateComputer.compute(objects))
├ Computes line junctions (T-junctions, crossings).
├ Computes wire junctions (endpoint-on-segment).
└ Computes wire no-connects (floating endpoints).
        │
        ▼
RENDER STATE
├ derivedObjects[]
└ renderList[]   (sorted: line/wire/junction/box/symbol/text by render order)
        │
        ▼
RENDER LAYER  (uniform; no special cases per type)
```

### When the derive pass runs

Today: in `Editor.render()`, after every state change. The implementation note from the original plan was to hook into `HistoryManager`, but doing it at render time is simpler and equivalent because every state change triggers a render via the subscription.

Per the original design, the trigger should fire after `execute()`, `undo()`, and `redo()`. The render-time approach satisfies this implicitly.

### Render order (z-index)

| Order | Type | Notes |
|---|---|---|
| 10 | Grid | Background |
| 20 | line | Visual lines |
| 25 | junction | Line junction marker |
| 30 | wire | Electrical wires |
| 35 | wire-junction | Wire connection marker |
| 36 | wire-noconnect | Floating endpoint marker (X) |
| 40 | box | Text boxes |
| 50 | symbol | Schematic symbols (with pins) |
| 60 | text | Standalone text, labels, designators |
| 100 | overlay | Tool previews, selection (handled by `IOverlayRenderer`) |

Within a type, secondary sort is by `obj.zIndex`. Send-to-back / bring-to-front operations adjust `zIndex`.

### Derived object data structures

```javascript
// Line junction
{ type: 'junction', id: 'junc-…', x, y, style: 'single'|'double'|'thick',
  connectedLines: [...lineIds], derived: true }

// Wire junction
{ type: 'wire-junction', id: 'wjunc-…', x, y, style: 'single',
  connectedWires: [...wireIds], net: 'NET_NAME', derived: true }

// Wire no-connect
{ type: 'wire-noconnect', id: 'wnc-…', x, y,
  wireId: 'wire-…', endpoint: 'start'|'end', derived: true }
```

### Save/load (hybrid storage)

- **Runtime:** ephemeral — recomputed every render.
- **Save:** include derived objects in the file (marked `derived: true`) for inspection/debugging.
- **Load:** ignore saved derived objects; recompute fresh from primary objects.

This keeps saved files self-describing without coupling correctness to what's on disk.

### Hit-testing

**Derived objects are not hit-testable.** Users select wires/lines, not junction markers. Tools never receive `derived: true` objects from selection queries.

## Consequences

**Positive:**
- Tools can't desynchronize derived state — there is no derived state to maintain.
- Adding a new derived type (e.g., bus taps, ERC markers, net labels) is one method on `DerivedStateComputer`, no edits to commands.
- Saved files are robust to logic changes: if the junction algorithm improves, old files render correctly.
- Render layer has no special cases per object type — it just iterates `renderList`.

**Negative:**
- Recomputing on every state change is full passes, not incremental. <1ms for typical schematic complexity, but a 10000-wire pathological case would matter. We'd add memoization or dependency tracking if it became a problem.
- **Dual code paths exist today.** `HistoryManager.recomputeActivePageJunctions()` calls `AsciiEditor.core.recomputeJunctions()` (in `js/core/utils.js`) which **mutates `page.objects` to inject junction objects** — the *old* approach. Meanwhile `DerivedStateComputer` runs ephemerally in `Editor.render()`. The new path filters out `derived: true` objects to avoid duplication, but the old path is still injecting them. **This is dead/redundant code that should be removed.** See [the implementation plan audit](../plans/00-status-audit.md).
- Hit testing requires filtering out derived objects — easy to forget when adding new selection code.
