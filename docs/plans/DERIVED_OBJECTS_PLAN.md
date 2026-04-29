# Derived Objects Architecture Plan

## Overview

Refactor to cleanly separate tool interactions from rendering by introducing a derived object computation layer. After any state change, derived objects (junctions, no-connects, etc.) are computed and combined with primary objects to form a render state.

## Storage Approach (Hybrid)

- **Runtime:** Derived objects are ephemeral - computed fresh after every state change
- **Save:** Include derived objects in file (marked `derived: true`) for debugging/inspection
- **Load:** Ignore saved derived objects, recompute from primary objects

This provides debugging benefits (can inspect saved files) with no runtime impact.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TOOL LAYER                              │
│  SelectTool, WireTool, SymbolTool, etc.                        │
│  - Handle user input (mouse, keyboard)                          │
│  - Modify primary objects via commands                          │
│  - NO rendering logic, NO derived object knowledge              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ executes commands
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PRIMARY STATE                              │
│  page.objects[] - User-authored objects only                    │
│  - box, symbol, line, wire, text                                │
│  - Persisted to file                                            │
│  - Managed by undo/redo                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ triggers (after every state change)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DERIVE PASS                                 │
│  DerivedStateComputer.compute(page.objects) → derivedObjects[]  │
│  Computes:                                                      │
│  - Line junctions (where lines cross/meet)                      │
│  - Wire junctions (electrical connection points)                │
│  - Wire no-connects (floating endpoints)                        │
│  - Future: net labels, bus taps, etc.                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ produces
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RENDER STATE                                │
│  {                                                              │
│    primaryObjects: [...],   // reference to page.objects        │
│    derivedObjects: [...],   // computed junctions, no-connects  │
│    renderList: [...]        // sorted, ready for rendering      │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ fed to
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RENDER LAYER                                │
│  Renderer.render(renderState)                                   │
│  - Iterates renderList in order                                 │
│  - Calls drawObject() for each - NO special cases               │
│  - Backend-agnostic (ASCII, SVG, Canvas)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Derived Object Types

### 1. Line Junction (`junction`)
- **Source:** Lines meeting/crossing at a point
- **Visual:** Style-based character (●, ■, █)
- **Data:**
```javascript
{
  type: 'junction',
  id: 'junc-xxx',
  x: number,
  y: number,
  style: 'single' | 'double' | 'thick',
  connectedLines: ['line-id-1', 'line-id-2'],
  derived: true
}
```

### 2. Wire Junction (`wire-junction`)
- **Source:** Wire endpoint OR vertex landing on another wire's segment
- **Important:** Crossing wire segments do NOT create junctions — only explicit endpoint/vertex connections
- **Visual:** Filled circle in accent color (●)
- **Data:**
```javascript
{
  type: 'wire-junction',
  id: 'wjunc-xxx',
  x: number,
  y: number,
  style: 'single',
  connectedWires: ['wire-id-1', 'wire-id-2'],
  net: 'NET_NAME',  // computed from connected wires
  derived: true
}
```

### 3. Wire No-Connect (`wire-noconnect`)
- **Source:** Wire endpoint that is:
  - Not bound to a pin (no `startBinding`/`endBinding`)
  - Not connected to another wire (endpoint/vertex not on another wire's segment)
- **Visual:** Black "X" character
- **Data:**
```javascript
{
  type: 'wire-noconnect',
  id: 'wnc-xxx',
  x: number,
  y: number,
  wireId: 'wire-id',
  endpoint: 'start' | 'end',
  derived: true
}
```

## Render Order (Z-Index)

Objects rendered in this order (lowest to highest):

| Order | Type | Description |
|-------|------|-------------|
| 10 | Grid | Background grid |
| 20 | line | Visual lines |
| 25 | junction | Line junction markers |
| 30 | wire | Electrical wires |
| 35 | wire-junction | Wire connection points |
| 36 | wire-noconnect | Floating endpoint markers |
| 40 | box | Text boxes |
| 50 | symbol | Schematic symbols (includes pins) |
| 60 | text | Standalone text, labels, designators |
| 100 | overlay | Tool previews, selection |

### Object zIndex Property

Each primary object has a `zIndex` property for ordering within the same type:

```javascript
{ type: 'wire', id: 'w1', zIndex: 0, ... }
{ type: 'wire', id: 'w2', zIndex: 1, ... }  // renders on top of w1
```

- **Creation:** Assign `zIndex = max(existing) + 1` for new objects of that type
- **Send to Back:** Set `zIndex = min(existing) - 1`
- **Bring to Front:** Set `zIndex = max(existing) + 1`
- **Sorting:** Primary sort by type order, secondary sort by `zIndex`

This enables layer management (send to back, bring to front) within object types.

## Implementation Steps

### Phase 1: Create DerivedStateComputer

**File:** `js/core/DerivedStateComputer.js`

1. Create new class `DerivedStateComputer`
2. Method: `compute(objects)` → returns `{ derivedObjects, renderList }`
3. Method: `computeLineJunctions(lines)` → junction objects
4. Method: `computeWireJunctions(wires)` → wire-junction objects
5. Method: `computeWireNoConnects(wires)` → wire-noconnect objects
6. Method: `buildRenderList(primary, derived)` → sorted by render order

### Phase 2: Integrate with State Management

**File:** `js/core/HistoryManager.js` (or wherever state changes are managed)

1. Add `onStateChange` callback hook to HistoryManager
2. Call `_afterStateChange()` after `execute()`, `undo()`, `redo()`
3. Full recompute on every state change (no debounce initially — evaluate if needed)

### Phase 3: Update Renderer

**File:** `js/rendering/Renderer.js`

1. Change `render(state, toolManager)` to accept render state
2. Remove inline derived computation (e.g., `drawWireFloatingEnds`)
3. Remove `this.junctionPoints` tracking
4. Add `drawWireNoConnect(obj)` method
5. Simplify `drawObject()` - just a type switch, no special cases
6. Remove junction computation from render pass

### Phase 4: Clean Up Tools

**Files:** `js/tools/*.js`

1. Remove any rendering logic from tools
2. Tools only modify primary objects via commands
3. WireTool: Remove inline floating end detection for rendering (keep for interaction)
4. SelectTool: Remove junction point tracking

### Phase 5: Migrate Existing Junction Logic

1. Move junction computation from Renderer to DerivedStateComputer
2. Remove `this.junctionPoints` from Renderer
3. Ensure junctions render correctly via new path

## File Changes Summary

| File | Changes |
|------|---------|
| `js/core/DerivedStateComputer.js` | **NEW** - Core derive logic |
| `js/core/HistoryManager.js` | Add derive trigger after state changes |
| `js/core/core.js` | Register DerivedStateComputer |
| `js/rendering/Renderer.js` | Simplify to pure rendering, add `drawWireNoConnect()` |
| `js/tools/WireTool.js` | Remove `drawWireFloatingEnds()` references |
| `js/tools/SelectTool.js` | Remove junction tracking |
| `js/Editor.js` | Wire up derive pass to render cycle |

## API Design

### DerivedStateComputer

```javascript
class DerivedStateComputer {
  // Main entry point - compute all derived objects
  compute(objects) {
    const lines = objects.filter(o => o.type === 'line');
    const wires = objects.filter(o => o.type === 'wire');

    // Compute wire junctions first (needed to determine no-connects)
    const wireJunctions = this.computeWireJunctions(wires);

    const derivedObjects = [
      ...this.computeLineJunctions(lines),
      ...wireJunctions,
      ...this.computeWireNoConnects(wires, wireJunctions)
    ];

    const renderList = this.buildRenderList(objects, derivedObjects);

    return { derivedObjects, renderList };
  }

  // Compute no-connects for wire endpoints that are:
  // - Not bound to a pin (no startBinding/endBinding)
  // - Not connected to another wire (not in wireJunctions)
  computeWireNoConnects(wires, wireJunctions) {
    // Implementation checks each wire endpoint against:
    // 1. wire.startBinding / wire.endBinding (pin bindings)
    // 2. wireJunctions (wire-to-wire connections)
    // Returns wire-noconnect objects for floating endpoints
  }

  // Build sorted render list
  buildRenderList(primary, derived) {
    const all = [...primary, ...derived];
    return all.sort((a, b) => {
      const orderDiff = this.getRenderOrder(a) - this.getRenderOrder(b);
      if (orderDiff !== 0) return orderDiff;
      // Secondary sort by zIndex for objects of same type
      return (a.zIndex || 0) - (b.zIndex || 0);
    });
  }

  // Get render order for object type
  getRenderOrder(obj) {
    const order = {
      'line': 20,
      'junction': 25,
      'wire': 30,
      'wire-junction': 35,
      'wire-noconnect': 36,
      'box': 40,
      'symbol': 50,
      'text': 60  // includes labels, designators
    };
    return order[obj.type] || 50;
  }
}
```

### Integration Point

**Trigger:** Full recompute after ANY `HistoryManager` state mutation:
- `execute()` — command executed
- `undo()` — state rolled back
- `redo()` — state rolled forward

This is simple and safe — no risk of stale derived state from missed dependencies.
Performance should be <1ms for typical schematic complexity.

```javascript
// In HistoryManager — single hook for all state changes
_afterStateChange() {
  if (this.onStateChange) {
    this.onStateChange();
  }
}

// In Editor — wire up the hook
this.history.onStateChange = () => {
  const state = this.history.getState();
  const page = state.project.pages.find(p => p.id === state.activePageId);

  // Compute derived state (full recompute)
  const { derivedObjects, renderList } = this.derivedComputer.compute(page.objects);

  // Store for potential future queries
  this.derivedState = { derivedObjects, renderList };

  // Render
  this.renderer.render(renderList, state, this.toolManager);
};
```

**Note:** Derived objects are NOT hit-testable. Users cannot select or interact with them directly.

## Testing Checklist

- [ ] Line junctions render at line intersections
- [ ] Wire junctions render where wire endpoint/vertex lands on another wire segment
- [ ] Wire junctions do NOT render where wires merely cross (no endpoint on segment)
- [ ] Wire no-connects render at floating endpoints (no pin binding, no wire connection)
- [ ] No-connect disappears when wire bound to pin
- [ ] No-connect disappears when wire endpoint placed on another wire
- [ ] Render order correct (symbols on top of wires)
- [ ] zIndex ordering works within same object type
- [ ] Undo/redo correctly recomputes derived objects
- [ ] Performance acceptable with many objects
- [ ] Save includes derived objects (marked `derived: true`)
- [ ] Load ignores saved derived objects, recomputes fresh

## Future Extensions

Once this architecture is in place, easy to add:

1. **Net labels** - Derived text showing net names on wires
2. **Bus taps** - Visual markers where bus splits
3. **ERC markers** - Error indicators for rule violations
4. **Cross-reference markers** - Off-page connector annotations
5. **Alternative renderers** - SVG export, print view, etc.

## Implementation Status

**Completed:**
- [x] Phase 1: Created `DerivedStateComputer` class (`js/core/DerivedStateComputer.js`)
- [x] Added to `index.html` script loading
- [x] Phase 2: Integrated with Editor (not HistoryManager directly)
  - Editor creates `derivedComputer` and `derivedState`
  - `render()` computes derived state and passes to Renderer
- [x] Phase 3: Updated Renderer
  - Added `drawWireNoConnect()` method
  - Updated `render()` to use `renderList` when `derivedState` provided
  - Removed inline `drawWireFloatingEnds()` call from `drawWire()`
- [x] Unit tests: 32 tests in `test/DerivedStateComputer.test.js`

**Note on Implementation Approach:**
The current implementation computes derived state in `Editor.render()` rather than via a HistoryManager hook. This is simpler and works because:
1. Every state change triggers `render()` via the history subscription
2. The derived computation happens at render time, ensuring it's always fresh
3. Backwards compatible - filters out existing derived objects from page.objects

## Migration Notes

- Existing junction objects in saved files should still work (they're primary, not derived)
- May want to add migration to remove any accidentally-saved derived objects
- Keep backward compatibility during transition
