# Wire Routing Constraint Solver Plan

## Problem Statement

Wires connected to symbol pins must maintain "clean exits" - the wire must exit in the direction the pin faces. When users drag symbols, pins, or wire segments, the system must automatically re-route to maintain these constraints.

## Core Rules

1. **Clean Exit**: Wire must exit in direction matching pin edge
   - Right pin → wire goes right (+X)
   - Left pin → wire goes left (-X)
   - Top pin → wire goes up (-Y)
   - Bottom pin → wire goes down (+Y)

2. **No Body Crossing**: Wire can't route through symbol body

3. **No Pin Collision**: Wire can't cross other pins on the symbol

4. **No Wire Overlap**: Vertices can't land on unrelated wires (push instead)

## Violation Scenarios

| Action | Potential Violation |
|--------|---------------------|
| Drag wire segment | Breaks clean exit |
| Move pin around edge | Wire needs re-route |
| Drag symbol far enough | Wire would backtrack through body |
| Move pin to occupied spot | Pin collision |

## Algorithm

### Phase 1: Violation Detection
```
detectViolation(wire, endpoint):
  pin = getPin(wire, endpoint)
  requiredDir = edgeToDirection(pin.edge)  // right→+X, left→-X, etc.
  actualDir = getFirstSegmentDirection(wire, endpoint)
  return actualDir !== requiredDir
```

### Phase 2: Best Edge Calculator
```
findBestEdge(symbol, targetPoint):
  // Where should pin be to face the target?
  dx = targetPoint.x - symbol.centerX
  dy = targetPoint.y - symbol.centerY

  if |dx| > |dy|:
    return dx > 0 ? 'right' : 'left'
  else:
    return dy > 0 ? 'bottom' : 'top'
```

### Phase 3: Wire Re-router
```
rerouteForCleanExit(wire, endpoint, pin):
  requiredDir = edgeToDirection(pin.edge)

  // Ensure first segment goes in required direction
  // Insert/adjust vertices to achieve this
  // Use midpoint insertion like we already have
```

### Phase 4: Pin Rotation with Push
```
rotatePin(symbol, pin, newEdge):
  newOffset = calculateOffsetOnEdge(pin.position, newEdge)

  // Check for collision with existing pins
  collision = findPinAtEdge(symbol, newEdge, newOffset)
  if collision:
    pushPin(collision, direction)  // or grow symbol

  pin.edge = newEdge
  pin.offset = newOffset
```

### Phase 5: Iterative Solver
```
solveConstraints(page, maxIterations=10):
  for i in range(maxIterations):
    violations = detectAllViolations(page)
    if violations.empty: break

    for v in violations:
      if canRerouteWire(v):
        rerouteWire(v)
      else:
        rotatePin(v)
        rerouteWire(v)
```

## Implementation Phases

| Phase | Description | Complexity | Status |
|-------|-------------|------------|--------|
| **1** | Violation detection + visual indicator | Low | Pending |
| **2** | Wire re-route on pin drag (edge transition) | Medium | Pending |
| **3** | Auto-rotate pin when symbol drag causes backtrack | Medium | Pending |
| **4** | Pin collision → push other pins | Medium | Pending |
| **5** | Wire collision → push other wires | High | Pending |
| **6** | Symbol auto-resize if edges full | Medium | Pending |
| **7** | T-junction handling | High | Pending |

## Current Implementation (Completed)

- OBJ-67: Wire rubberbanding when symbol moves
- OBJ-68: Alt key breaks wire binding during drag
- OBJ-69: Dragging wire endpoint away from pin breaks binding
- OBJ-6A: Dragging wire endpoint to pin/symbol edge rebinds (auto-creates pin if needed)
- 2-vertex insertion for diagonal moves
- Pin edge-aware routing (horizontal exit for left/right pins, vertical for top/bottom)
- No staircase accumulation during drag
- Auto-finish wire on pin click (CREATE PIN or BIND PIN)
- Auto-posture based on pin edge for clean wire exit
