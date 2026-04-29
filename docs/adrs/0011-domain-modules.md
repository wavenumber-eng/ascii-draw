# ADR 0011: Pure-Function Domain Layer (Wire / Symbol / Line)

**Status:** Accepted

## Context

Tools accumulated business logic over time. `SelectTool` had wire-binding rules, pin position calculations, and floating-end detection inlined into `onMouseMove` handlers. `WireTool` had pin auto-creation logic next to its mouse-down handler. The same calculations appeared in two or three tools with subtle drift.

This is hard to test (mouse handlers need DOM mocks), hard to reason about (mixed UI and business logic), and a bug magnet (when one tool's copy is fixed but the others aren't).

## Decision

Extract reusable, **purely functional** business logic into a `js/domain/` layer. Domain modules:

- Take plain data (objects, page state) and return plain data.
- Never touch the canvas, DOM, or events.
- Are unit-testable in isolation.
- Are imported (via the `AsciiEditor.domain.*` namespace) by tools, the renderer, and `DerivedStateComputer`.

### Domain modules

```
js/domain/
├── Wire.js     // Pin binding, floating endpoints, wire merging, rubberbanding
├── Symbol.js   // Pin positions, edge detection, designators (single source of truth)
└── Line.js     // Segments, point-on-segment tests, intersections, merging
```

### Wire (`AsciiEditor.domain.Wire`)

```javascript
isFloatingEndpoint(wire, endIndex, objects)
findPinAtPoint(col, row, objects)               // Returns { symbol, pin } or null
canBindToPin(wireEndpoint, pin)
getConnectedWires(wire, objects)
moveEndpointWithSymbol(wire, symbol, delta)     // Rubberbanding
findFloatingEnds(objects)
```

### Symbol (`AsciiEditor.domain.Symbol`)

This is the **single source of truth for pin positions.** Anywhere code needs the world position of a pin (renderer, hit-test, wire binding, properties panel), it goes through `Symbol.getPinWorldPosition()`. Duplicating this calculation was a previous source of bugs.

```javascript
getPinWorldPosition(symbol, pin)
findSymbolEdge(col, row, symbol)        // Returns 'left'|'right'|'top'|'bottom'|null
getNextDesignatorNumber(prefix, objects)
isPinOnEdge(symbol, pin)
getAllPinPositions(symbol)
```

### Line (`AsciiEditor.domain.Line`)

```javascript
getSegments(line)                       // Returns [{start, end, index}, ...]
pointOnSegment(col, row, segment)
findIntersections(lines)
mergeLines(line1, line2)
```

### Rules

- **Pure functions.** No closures over state. No `this`. (The modules are objects with method properties, not classes.)
- **Tools delegate, never duplicate.** If a tool needs to calculate something the domain layer can do, it must call the domain layer.
- **Tested in `test/domain/`.** Each module has its own test file with full coverage of edge cases.

### Test coverage

107 unit tests across `test/domain/Wire.test.js`, `test/domain/Symbol.test.js`, `test/domain/Line.test.js`. These tests run in pure Node (no DOM, no canvas) — fast and reliable.

## Consequences

**Positive:**
- Behavior is testable without DOM/canvas mocking.
- Adding a new tool that needs wire-binding logic is a one-liner — `Wire.findPinAtPoint(col, row, objects)`.
- Bug fixes propagate to all callers automatically.
- The pin-position bug class (where renderer and hit-test disagree on pin location) is structurally prevented.
- Tools shrank significantly during the extraction.

**Negative:**
- The domain modules can drift from object-model assumptions if not maintained alongside object-model changes. (E.g., adding a new pin shape that needs a different position calculation requires updating `Symbol.getPinWorldPosition`.)
- Tools still own *interaction* logic — drag thresholds, modifier keys, double-click detection — which is hard to extract because it depends on event sequences. The domain layer covers state-shaped business rules, not interaction patterns.
- The `AsciiEditor.domain.*` namespace adds one more layer to learn for new contributors.
