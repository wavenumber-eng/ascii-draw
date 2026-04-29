# Wire Implementation Plan

## Overview

Wires are lines with electrical connectivity semantics. They share core rendering and manipulation code with lines but add net labels, pin bindings, and participate in netlist generation.

---

## Analysis: Line vs Wire

### Shared Code (reuse from LineTool/Renderer)

| Feature | LineTool | Renderer | Notes |
|---------|----------|----------|-------|
| Point array management | `points[]`, `simplifyPoints()` | `drawLine()` | Identical data structure |
| Orthogonal routing | `getPreviewPath()`, `hFirst` posture | - | Same H-V / V-H logic |
| Segment rendering | `drawLineSegments()` | `drawLineSegments()` | Same ASCII characters |
| Corner characters | `getCornerChar()` | `getCornerChar()` | Same corner logic |
| Hit testing | - | `hitTestLine()` | Same segment math |
| Style system | `LineStyles[]`, `styleIndex` | Style lookup | Same styles (single/double/thick) |
| Handle manipulation | - | SelectTool vertex/segment drag | Same point manipulation |

### Wire-Specific Features

| Feature | Requirement | Description |
|---------|-------------|-------------|
| Net property | OBJ-61 | `net: 'SDA'` - net name string |
| Net label display | OBJ-62 | Render net name near wire |
| Pin binding | OBJ-65-69 | Wire endpoints bind to pins, rubberband on move |
| Auto-create pins | TOOL-28F | Wire start/end on symbol edge creates pin |
| Wire junctions | OBJ-6A-6D | Electrical nodes where wires connect |

---

## Architecture: Code Sharing Strategy

### Option A: Shared Utility Module (Recommended)

Create `js/core/lineUtils.js` with shared functions:

```javascript
AsciiEditor.core.lineUtils = {
  // Point management
  simplifyPoints(points) { ... },
  getPreviewPath(anchor, cursor, hFirst) { ... },

  // Direction and corners
  getDirection(from, to) { ... },
  getCornerChar(prev, curr, next, chars) { ... },

  // Rendering
  drawLineSegments(ctx, points, chars, grid, color) { ... },

  // Hit testing
  hitTestSegment(point, p1, p2) { ... },
  findPointOnLine(point, lineObj) { ... }
};
```

**Benefits:**
- LineTool and WireTool both use same utilities
- Renderer uses same utilities
- Single source of truth for line math
- Easy to maintain and test

### Option B: WireTool Extends LineTool

```javascript
class WireTool extends LineTool {
  constructor() {
    super();
    this.name = 'wire';
    this.netName = '';
  }

  finishLine(context) {
    // Create wire instead of line
    const newWire = {
      type: 'wire',
      points: this.simplifyPoints(this.points),
      style: this.style,
      net: this.netName,
      startBinding: null,
      endBinding: null
    };
    // ... rest
  }
}
```

**Benefits:**
- Maximum code reuse
- Inherits all line behavior automatically

**Drawbacks:**
- Tight coupling
- May need to override many methods

### Recommendation: Hybrid Approach

1. Extract shared utilities to `lineUtils.js`
2. LineTool uses utilities
3. WireTool uses same utilities + adds wire-specific logic
4. Renderer handles both `type: 'line'` and `type: 'wire'` with shared drawing code

---

## Implementation Phases

### Phase 1: Extract Shared Utilities

**Files to create/modify:**
- Create `js/core/lineUtils.js`
- Refactor `js/tools/LineTool.js` to use utilities
- Refactor `js/rendering/Renderer.js` to use utilities

**Shared utilities to extract:**

```javascript
// js/core/lineUtils.js
AsciiEditor.core.lineUtils = {

  // Style definitions (move from LineTool)
  styles: [
    { key: 'single', chars: { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘' } },
    { key: 'double', chars: { h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝' } },
    { key: 'thick',  chars: { h: '█', v: '█', tl: '█', tr: '█', bl: '█', br: '█' } }
  ],

  // Simplify collinear points
  simplifyPoints(points) { ... },

  // Orthogonal routing preview
  getPreviewPath(anchor, cursor, hFirst) { ... },

  // Direction from point to point
  getDirection(from, to) { ... },

  // Corner character for direction change
  getCornerChar(prev, curr, next, chars) { ... },

  // Draw segments with ASCII characters
  drawSegments(ctx, points, chars, grid, color) { ... },

  // Hit test: is point on segment?
  pointOnSegment(point, p1, p2) { ... },

  // Find all segments at a point
  findSegmentsAtPoint(point, objects) { ... }
};
```

### Phase 2: Create WireTool

**Files to create/modify:**
- Create `js/tools/WireTool.js`
- Add to `index.html`
- Register in `Editor.js`

**WireTool structure:**

```javascript
// js/tools/WireTool.js
AsciiEditor.tools.WireTool = class WireTool extends AsciiEditor.tools.Tool {
  constructor() {
    super('wire');
    this.drawing = false;
    this.points = [];
    this.currentPos = null;
    this.hFirst = true;
    this.styleIndex = 0;
    this.netName = '';  // Wire-specific: net label
  }

  // Reuse line utilities for point management
  getPreviewPath(anchor, cursor) {
    return AsciiEditor.core.lineUtils.getPreviewPath(anchor, cursor, this.hFirst);
  }

  // Wire-specific: detect pin hover
  detectPinHover(pos, context) {
    // Check if pos is on a symbol edge (potential pin location)
    // Return { symbolId, edge, offset } or null
  }

  // Wire-specific: create/bind to pin
  bindToPin(endpoint, context) {
    // If endpoint on symbol edge:
    //   - Auto-create pin if none exists (TOOL-28F)
    //   - Return binding { symbolId, pinId }
    // Else return null
  }

  finishWire(context) {
    const wire = {
      id: generateId(),
      type: 'wire',
      points: lineUtils.simplifyPoints(this.points),
      style: this.style,
      net: this.netName,
      startBinding: this.bindToPin(this.points[0], context),
      endBinding: this.bindToPin(this.points[this.points.length - 1], context)
    };
    // Execute create command
  }

  renderOverlay(ctx, context) {
    // Reuse line drawing utilities
    // Add wire-specific: net label preview, pin hover indicators
  }
};
```

### Phase 3: Wire Rendering

**Modify Renderer.js:**

```javascript
drawObject(obj) {
  switch (obj.type) {
    case 'line':
    case 'wire':  // Same rendering, wire just has extra properties
      this.drawLine(obj);
      if (obj.type === 'wire' && obj.net) {
        this.drawNetLabel(obj);
      }
      break;
    // ...
  }
}

drawNetLabel(wire) {
  // Draw net name near middle of wire
  // Style: small text, accent color
}
```

### Phase 4: Wire-Pin Binding

**Implement rubberbanding:**

When symbol moves, bound wire endpoints follow:

```javascript
// In move command or state update
if (symbol.type === 'symbol') {
  const boundWires = findWiresBoundToSymbol(symbol.id, page.objects);
  boundWires.forEach(wire => {
    if (wire.startBinding?.symbolId === symbol.id) {
      // Update wire start point to new pin position
    }
    if (wire.endBinding?.symbolId === symbol.id) {
      // Update wire end point to new pin position
    }
  });
}
```

### Phase 5: Wire Junctions

**Auto-create electrical junctions:**

```javascript
// When wire endpoint lands on another wire
function createWireJunction(wire1, wire2, point) {
  return {
    id: generateId(),
    type: 'wire-junction',
    x: point.x,
    y: point.y,
    connectedWires: [wire1.id, wire2.id],
    net: wire1.net || wire2.net  // Propagate net name
  };
}
```

### Phase 6: SelectTool Wire Support

**Add wire manipulation to SelectTool:**

- Vertex dragging (same as line)
- Segment dragging (same as line)
- Net label editing (new)
- Binding indicator display (new)

### Phase 7: Properties Panel

**Wire properties panel:**

```html
<div class="property-group">
  <div class="property-group-title">Wire Properties</div>
  <div class="property-row">
    <span class="property-label">Net</span>
    <input type="text" id="prop-wire-net" value="SDA">
  </div>
  <div class="property-row">
    <span class="property-label">Style</span>
    <select id="prop-wire-style">...</select>
  </div>
</div>

<div class="property-group">
  <div class="property-group-title">Bindings</div>
  <div class="property-row">
    <span class="property-label">Start</span>
    <span class="property-value">U1.SDA (pin 3)</span>
  </div>
  <div class="property-row">
    <span class="property-label">End</span>
    <span class="property-value">U2.SDA (pin 5)</span>
  </div>
</div>
```

---

## Data Structures

### Wire Object

```javascript
{
  id: 'wire-abc123',
  type: 'wire',
  points: [{ x: 10, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 10 }],
  style: 'single',
  net: 'SDA',
  startBinding: { symbolId: 'sym-1', pinId: 'pin-1' },
  endBinding: { symbolId: 'sym-2', pinId: 'pin-2' }
}
```

### Wire Junction Object

```javascript
{
  id: 'wjunc-xyz789',
  type: 'wire-junction',
  x: 15,
  y: 5,
  connectedWires: ['wire-abc123', 'wire-def456'],
  net: 'SDA'
}
```

---

## Render Layer Integration

Per VIS-40 to VIS-4E:

| Layer | Z-Order | Objects |
|-------|---------|---------|
| Grid | 0 | Background grid |
| Lines | 10 | Visual lines (type: 'line') |
| Wires | 15 | Electrical wires (type: 'wire') |
| Line Junctions | 20 | Visual junction markers |
| Wire Junctions | 25 | Electrical junction markers |
| Boxes/Text | 30 | Text boxes |
| Symbols | 50 | Schematic symbols with pins |

---

## File Changes Summary

| File | Changes |
|------|---------|
| `js/core/lineUtils.js` | **NEW** - Shared line/wire utilities |
| `js/tools/LineTool.js` | Refactor to use lineUtils |
| `js/tools/WireTool.js` | **NEW** - Wire creation tool |
| `js/tools/SelectTool.js` | Add wire-specific selection handling |
| `js/rendering/Renderer.js` | Add wire rendering, net labels |
| `js/Editor.js` | Register WireTool, add wire properties |
| `index.html` | Add wire tool button, include new files |

---

## Testing Checklist

- [x] Create wire with W key
- [ ] Wire saves net name
- [ ] Net label displays on canvas
- [x] Wire endpoint on symbol edge auto-creates pin
- [x] Wire binds to existing pin
- [x] Move symbol → bound wire endpoints follow
- [x] Alt key during symbol drag breaks wire binding
- [x] Drag wire endpoint away from pin breaks binding
- [x] Drag wire endpoint to pin/symbol edge rebinds (auto-creates pin if needed)
- [ ] Delete pin → wire binding cleared
- [ ] Wire-to-wire junction created at intersection
- [ ] Junction propagates net name
- [ ] Properties panel shows wire properties
- [ ] Multi-select wires → edit common net name
- [x] Undo/redo works for all wire operations

---

## Implementation Order

1. **Phase 1**: Extract lineUtils (low risk, enables sharing)
2. **Phase 2**: Create basic WireTool (copy LineTool, change type)
3. **Phase 3**: Add net label rendering
4. **Phase 4**: Add wire-pin binding (auto-create pins)
5. **Phase 5**: Add rubberbanding (symbol move updates wires)
6. **Phase 6**: Add wire junctions
7. **Phase 7**: Properties panel and multi-select
