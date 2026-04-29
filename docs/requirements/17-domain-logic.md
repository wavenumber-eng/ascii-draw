# Domain Logic (`DOM-*`, `ARCH-*`)

Domain modules contain business logic that is independent of UI/tool interaction. This enables unit testing and code reuse across tools.

See [ADR 0011: Domain modules](../adrs/0011-domain-modules.md) and [ADR 0010: Derived state](../adrs/0010-derived-state.md).

## Wire domain module

| Status | ID | Requirement | Description |
|--------|-----|-------------|-------------|
| [x] | **DOM-10** | `Wire.isFloatingEndpoint()` | Detect if wire endpoint is unbound |
| [x] | **DOM-11** | `Wire.findPinAtPoint()` | Find symbol pin at cell position |
| [x] | **DOM-12** | `Wire.canBindToPin()` | Validate wire-to-pin binding |
| [x] | **DOM-13** | `Wire.getConnectedWires()` | Find wires connected via junctions |
| [x] | **DOM-14** | `Wire.moveEndpointWithSymbol()` | Calculate endpoint position after symbol move |
| [x] | **DOM-15** | `Wire.findFloatingEnds()` | Find all unbound endpoints in document |

## Symbol domain module

| Status | ID | Requirement | Description |
|--------|-----|-------------|-------------|
| [x] | **DOM-20** | `Symbol.getPinWorldPosition()` | Calculate pin position from symbol + edge + offset |
| [x] | **DOM-21** | `Symbol.findSymbolEdge()` | Determine which edge a point is on |
| [x] | **DOM-22** | `Symbol.getNextDesignatorNumber()` | Get next available number for prefix |
| [x] | **DOM-23** | `Symbol.isPinOnEdge()` | Validate pin placement on symbol edge |
| [x] | **DOM-24** | `Symbol.getAllPinPositions()` | Get world positions for all pins on symbol |

## Line domain module

| Status | ID | Requirement | Description |
|--------|-----|-------------|-------------|
| [x] | **DOM-30** | `Line.getSegments()` | Extract segments from polyline |
| [x] | **DOM-31** | `Line.pointOnSegment()` | Test if point lies on segment |
| [x] | **DOM-32** | `Line.findIntersections()` | Find all line crossing points |
| [x] | **DOM-33** | `Line.mergeLines()` | Combine two lines at common endpoint |

## Domain architecture requirements

| Status | ID | Requirement | Description |
|--------|-----|-------------|-------------|
| [x] | **DOM-1** | Domain modules are pure functions | No UI, no canvas, no events |
| [x] | **DOM-2** | Domain modules are unit testable | Full test coverage for logic |
| [x] | **DOM-3** | Tools delegate to domain modules | No duplicate business logic |
| [x] | **DOM-4** | Domain modules in `js/domain/` directory | Clean separation |

## Tools → State → Derive → Render architecture

The architecture cleanly separates tool interactions from rendering by introducing a derived object computation layer. After any state change, derived objects (junctions, no-connects, etc.) are computed and combined with primary objects to form a render state.

```
TOOL LAYER  (modifies primary objects via commands)
     │
     ▼
PRIMARY STATE  (page.objects[] - user-authored only)
     │
     ▼
DERIVE PASS  (DerivedStateComputer.compute)
     │
     ▼
RENDER STATE  ({ derivedObjects, renderList })
     │
     ▼
RENDER LAYER  (uniform iteration, no special cases)
```

### Architecture requirements

- [ ] **ARCH-20**: Tool layer handles user input only, no rendering logic
- [ ] **ARCH-21**: Tools modify primary objects via commands (undo/redo compatible)
- [ ] **ARCH-22**: Primary state contains only user-authored objects
- [ ] **ARCH-23**: Derive pass triggered after every state change
- [ ] **ARCH-24**: Derived objects computed fresh each time (not persisted in memory)
- [ ] **ARCH-25**: Render layer iterates render list without special-case logic
- [ ] **ARCH-26**: All object types (primary and derived) rendered through single code path

### Derived objects storage (hybrid approach)

- [ ] **ARCH-30**: Runtime: derived objects are ephemeral, computed fresh after every state change
- [ ] **ARCH-31**: Save: include derived objects in file (marked `derived: true`) for debugging/inspection
- [ ] **ARCH-32**: Load: ignore saved derived objects, recompute from primary objects
- [ ] **ARCH-33**: This provides debugging benefits with no runtime impact

## Derived object types

| Type | Source | Visual | Description |
|------|--------|--------|-------------|
| `junction` | Lines meeting/crossing | `●`, `■`, `█` | Visual line intersection marker |
| `wire-junction` | Wire endpoint on wire segment | `●` (accent) | Electrical connection point |
| `wire-noconnect` | Unbound wire endpoint | `X` (black) | Floating endpoint / ERC indicator |

### Floating wire ends (no-connect / ERC)

These also appear in [09-object-model.md](09-object-model.md) under Wire requirements; cross-referenced here for the derive pass.

- [ ] **OBJ-6F**: Floating wire end renders as "X" to indicate no-connect/ERC error
- [ ] **OBJ-6G**: Hover over floating end with WireTool → shows "connect" overlay
- [ ] **OBJ-6H**: Start wire FROM floating end → extends existing wire, inherits style/netname
- [ ] **OBJ-6I**: End wire ON floating end → joins wires into one, new wire's style/netname wins
- [ ] **OBJ-6J**: When wires joined, old endpoint optimized out if collinear
- [ ] **OBJ-6K**: Joining wires does NOT create junction (direct merge)

## Render order (z-index)

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
| 60 | text | Standalone text |
| 70 | labels | Designators, parameters, net labels |
| 100 | overlay | Tool previews, selection |

## DerivedStateComputer interface

- [ ] **ARCH-40**: `DerivedStateComputer` class in `js/core/DerivedStateComputer.js`
- [ ] **ARCH-41**: Method: `compute(objects)` returns `{ derivedObjects, renderList }`
- [ ] **ARCH-42**: Method: `computeLineJunctions(lines)` → junction objects
- [ ] **ARCH-43**: Method: `computeWireJunctions(wires)` → wire-junction objects
- [ ] **ARCH-44**: Method: `computeWireNoConnects(wires)` → wire-noconnect objects
- [ ] **ARCH-45**: Method: `buildRenderList(primary, derived)` → sorted by render order
- [ ] **ARCH-46**: Integration: derive pass triggered after `execute()`, `undo()`, `redo()`
