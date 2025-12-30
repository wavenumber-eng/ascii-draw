/**
 * Wire Domain Module
 * Pure functions for wire connectivity, binding, and endpoint management.
 * No UI, no canvas, no events - just wire logic.
 *
 * Consolidates utilities from: WireTool.js, SelectTool.js, DerivedStateComputer.js
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.domain = AsciiEditor.domain || {};

AsciiEditor.domain.Wire = {

  // ============================================================
  // Wire Search
  // ============================================================

  /**
   * Find all wires in objects array
   */
  findAllWires(objects) {
    return objects.filter(o => o.type === 'wire');
  },

  /**
   * Find a wire by ID
   */
  findWireById(wireId, objects) {
    return objects.find(o => o.type === 'wire' && o.id === wireId) || null;
  },

  // ============================================================
  // Endpoint Utilities
  // ============================================================

  /**
   * Get the start point of a wire
   */
  getStartPoint(wire) {
    return wire.points && wire.points.length > 0 ? wire.points[0] : null;
  },

  /**
   * Get the end point of a wire
   */
  getEndPoint(wire) {
    return wire.points && wire.points.length > 0
      ? wire.points[wire.points.length - 1]
      : null;
  },

  /**
   * Get an endpoint by index (0 = start, points.length-1 = end)
   */
  getEndpointByIndex(wire, index) {
    if (!wire.points || wire.points.length === 0) return null;
    if (index === 0) return { point: wire.points[0], isStart: true };
    if (index === wire.points.length - 1) {
      return { point: wire.points[wire.points.length - 1], isStart: false };
    }
    return null;
  },

  /**
   * Check if a point is an endpoint of a wire
   */
  isEndpoint(point, wire) {
    const Line = AsciiEditor.domain.Line;
    const start = this.getStartPoint(wire);
    const end = this.getEndPoint(wire);
    return (start && Line.pointsEqual(point, start)) ||
           (end && Line.pointsEqual(point, end));
  },

  // ============================================================
  // Binding Utilities
  // ============================================================

  /**
   * Get the binding for an endpoint
   * @param {Object} wire - Wire object
   * @param {boolean} isStart - True for start endpoint, false for end
   * @returns {Object|null} Binding object { symbolId, pinId } or null
   */
  getEndpointBinding(wire, isStart) {
    return isStart ? wire.startBinding : wire.endBinding;
  },

  /**
   * Check if an endpoint is bound to a pin
   */
  isEndpointBound(wire, isStart) {
    const binding = this.getEndpointBinding(wire, isStart);
    return binding !== null && binding !== undefined;
  },

  /**
   * Check if a wire has any bindings
   */
  hasAnyBinding(wire) {
    return this.isEndpointBound(wire, true) || this.isEndpointBound(wire, false);
  },

  /**
   * Find all wires bound to a specific symbol
   * @returns {Array} Array of { wire, isStart, binding }
   */
  findWiresBoundToSymbol(symbolId, objects) {
    const wires = this.findAllWires(objects);
    const results = [];

    for (const wire of wires) {
      if (wire.startBinding && wire.startBinding.symbolId === symbolId) {
        results.push({ wire, isStart: true, binding: wire.startBinding });
      }
      if (wire.endBinding && wire.endBinding.symbolId === symbolId) {
        results.push({ wire, isStart: false, binding: wire.endBinding });
      }
    }

    return results;
  },

  /**
   * Find all wires bound to a specific pin
   * @returns {Array} Array of { wire, isStart }
   */
  findWiresBoundToPin(symbolId, pinId, objects) {
    const wires = this.findAllWires(objects);
    const results = [];

    for (const wire of wires) {
      if (wire.startBinding &&
          wire.startBinding.symbolId === symbolId &&
          wire.startBinding.pinId === pinId) {
        results.push({ wire, isStart: true });
      }
      if (wire.endBinding &&
          wire.endBinding.symbolId === symbolId &&
          wire.endBinding.pinId === pinId) {
        results.push({ wire, isStart: false });
      }
    }

    return results;
  },

  // ============================================================
  // Floating Endpoint Detection
  // ============================================================

  /**
   * Check if an endpoint is floating (unbound and not at junction)
   * @param {Object} wire - Wire object
   * @param {boolean} isStart - True for start endpoint
   * @param {Array} objects - All objects (to check for junctions)
   * @returns {boolean}
   */
  isFloatingEndpoint(wire, isStart, objects) {
    // If bound to a pin, not floating
    if (this.isEndpointBound(wire, isStart)) {
      return false;
    }

    const point = isStart ? this.getStartPoint(wire) : this.getEndPoint(wire);
    if (!point) return false;

    // Check if this endpoint touches another wire (junction)
    const wires = this.findAllWires(objects);
    for (const otherWire of wires) {
      if (otherWire.id === wire.id) continue;

      // Check if point is on the other wire
      const Line = AsciiEditor.domain.Line;
      const hitInfo = Line.findPointOnLine(point, otherWire);
      if (hitInfo) {
        return false; // Connected to another wire
      }
    }

    // Check if at a pin position
    const Symbol = AsciiEditor.domain.Symbol;
    const pinResult = Symbol.findPinAtPoint(point.x, point.y, objects);
    if (pinResult) {
      return false; // At a pin (should be bound)
    }

    return true; // Truly floating
  },

  /**
   * Find all floating endpoints in the document
   * @returns {Array} Array of { wire, isStart, point }
   */
  findAllFloatingEndpoints(objects) {
    const wires = this.findAllWires(objects);
    const results = [];

    for (const wire of wires) {
      if (this.isFloatingEndpoint(wire, true, objects)) {
        results.push({
          wire,
          isStart: true,
          point: this.getStartPoint(wire)
        });
      }
      if (this.isFloatingEndpoint(wire, false, objects)) {
        results.push({
          wire,
          isStart: false,
          point: this.getEndPoint(wire)
        });
      }
    }

    return results;
  },

  /**
   * Find a floating wire endpoint at a specific position
   * @returns {Object|null} { wire, isStart, point } or null
   */
  findFloatingEndpointAtPoint(col, row, objects) {
    const wires = this.findAllWires(objects);
    const Line = AsciiEditor.domain.Line;
    const point = { x: col, y: row };

    for (const wire of wires) {
      const start = this.getStartPoint(wire);
      const end = this.getEndPoint(wire);

      if (start && Line.pointsEqual(point, start)) {
        if (!this.isEndpointBound(wire, true)) {
          return { wire, isStart: true, point: start };
        }
      }

      if (end && Line.pointsEqual(point, end)) {
        if (!this.isEndpointBound(wire, false)) {
          return { wire, isStart: false, point: end };
        }
      }
    }

    return null;
  },

  // ============================================================
  // Wire-to-Wire Connections
  // ============================================================

  /**
   * Check if a point is on any wire segment (for junction detection)
   */
  isPointOnAnyWire(col, row, objects, excludeWireId = null) {
    const wires = this.findAllWires(objects);
    const Line = AsciiEditor.domain.Line;
    const point = { x: col, y: row };

    for (const wire of wires) {
      if (wire.id === excludeWireId) continue;
      if (Line.findPointOnLine(point, wire)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Find wires that share an endpoint with a given wire
   * @returns {Array} Array of { wire, sharedPoint, thisIsStart, otherIsStart }
   */
  findConnectedWires(wire, objects) {
    const wires = this.findAllWires(objects);
    const Line = AsciiEditor.domain.Line;
    const results = [];

    const thisStart = this.getStartPoint(wire);
    const thisEnd = this.getEndPoint(wire);

    for (const otherWire of wires) {
      if (otherWire.id === wire.id) continue;

      const otherStart = this.getStartPoint(otherWire);
      const otherEnd = this.getEndPoint(otherWire);

      if (thisStart && otherStart && Line.pointsEqual(thisStart, otherStart)) {
        results.push({ wire: otherWire, sharedPoint: thisStart, thisIsStart: true, otherIsStart: true });
      }
      if (thisStart && otherEnd && Line.pointsEqual(thisStart, otherEnd)) {
        results.push({ wire: otherWire, sharedPoint: thisStart, thisIsStart: true, otherIsStart: false });
      }
      if (thisEnd && otherStart && Line.pointsEqual(thisEnd, otherStart)) {
        results.push({ wire: otherWire, sharedPoint: thisEnd, thisIsStart: false, otherIsStart: true });
      }
      if (thisEnd && otherEnd && Line.pointsEqual(thisEnd, otherEnd)) {
        results.push({ wire: otherWire, sharedPoint: thisEnd, thisIsStart: false, otherIsStart: false });
      }
    }

    return results;
  },

  // ============================================================
  // Wire Merging
  // ============================================================

  /**
   * Merge two wires at a shared endpoint
   * The merged wire inherits the net name from the primary wire
   *
   * @param {Object} wire1 - Primary wire (keeps net name)
   * @param {boolean} wire1IsStart - Which end of wire1 to merge
   * @param {Object} wire2 - Secondary wire
   * @param {boolean} wire2IsStart - Which end of wire2 to merge
   * @returns {Object} Merged wire object
   */
  mergeWires(wire1, wire1IsStart, wire2, wire2IsStart) {
    const Line = AsciiEditor.domain.Line;
    let mergedPoints;

    // Get points in the right order
    let points1 = [...wire1.points];
    let points2 = [...wire2.points];

    // If merging at wire1 start, reverse wire1
    if (wire1IsStart) {
      points1 = points1.reverse();
    }

    // If merging at wire2 end, reverse wire2
    if (!wire2IsStart) {
      points2 = points2.reverse();
    }

    // Merge: wire1's endpoint connects to wire2's startpoint
    // Remove the duplicate point at the junction
    mergedPoints = [...points1, ...points2.slice(1)];

    // Determine bindings for merged wire
    // Start binding comes from the non-merged end of wire1
    // End binding comes from the non-merged end of wire2
    const startBinding = wire1IsStart ? wire1.endBinding : wire1.startBinding;
    const endBinding = wire2IsStart ? wire2.endBinding : wire2.startBinding;

    return {
      type: 'wire',
      id: wire1.id, // Keep wire1's ID
      points: Line.simplifyPoints(mergedPoints),
      style: wire1.style || 'single',
      net: wire1.net || wire2.net || '',
      startBinding: startBinding || null,
      endBinding: endBinding || null
    };
  },

  /**
   * Extend a wire from one of its endpoints
   * @param {Object} wire - Existing wire
   * @param {boolean} extendFromStart - True to extend from start, false from end
   * @param {Array} newPoints - New points to add
   * @param {Object} newEndBinding - Binding for the new endpoint (or null)
   * @returns {Object} Extended wire object
   */
  extendWire(wire, extendFromStart, newPoints, newEndBinding = null) {
    const Line = AsciiEditor.domain.Line;
    let mergedPoints;

    if (extendFromStart) {
      // Extending from start: reverse new points and prepend
      const reversed = [...newPoints].reverse();
      mergedPoints = [...reversed.slice(0, -1), ...wire.points];
    } else {
      // Extending from end: append new points
      mergedPoints = [...wire.points, ...newPoints.slice(1)];
    }

    // Determine new bindings
    let startBinding, endBinding;
    if (extendFromStart) {
      startBinding = newEndBinding;
      endBinding = wire.endBinding;
    } else {
      startBinding = wire.startBinding;
      endBinding = newEndBinding;
    }

    return {
      ...wire,
      points: Line.simplifyPoints(mergedPoints),
      startBinding: startBinding || null,
      endBinding: endBinding || null
    };
  },

  // ============================================================
  // Wire Rubberbanding (endpoint follows pin)
  // ============================================================

  /**
   * Calculate new endpoint position after symbol moves
   * Maintains orthogonal path by adjusting adjacent vertices
   *
   * @param {Object} wire - Wire object
   * @param {boolean} isStart - Which endpoint is bound
   * @param {Object} newPinPosition - New position { x, y } of the pin
   * @returns {Array} Updated points array
   */
  updateEndpointPosition(wire, isStart, newPinPosition) {
    const Line = AsciiEditor.domain.Line;
    let points = wire.points.map(p => ({ x: p.x, y: p.y }));

    if (points.length < 2) return points;

    const endIndex = isStart ? 0 : points.length - 1;
    const adjacentIndex = isStart ? 1 : points.length - 2;

    const oldEndpoint = points[endIndex];
    const adjacent = points[adjacentIndex];

    // Update the endpoint to new position
    points[endIndex] = { x: newPinPosition.x, y: newPinPosition.y };

    // If we have 3+ points, we can adjust the adjacent vertex
    if (points.length >= 3) {
      // Determine if the connection to adjacent is horizontal or vertical
      if (oldEndpoint.x === adjacent.x) {
        // Was vertical connection - keep adjacent's Y, update X to maintain orthogonality
        // Actually, we need to adjust adjacent's coordinate that's shared
        points[adjacentIndex] = { x: newPinPosition.x, y: adjacent.y };
      } else if (oldEndpoint.y === adjacent.y) {
        // Was horizontal connection
        points[adjacentIndex] = { x: adjacent.x, y: newPinPosition.y };
      }
    } else if (points.length === 2) {
      // Only 2 points - may need to insert intermediate point for orthogonality
      const dx = newPinPosition.x - adjacent.x;
      const dy = newPinPosition.y - adjacent.y;

      if (dx !== 0 && dy !== 0) {
        // Diagonal - insert intermediate point
        // Choose routing based on pin edge (prefer exiting perpendicular to edge)
        // For now, default to horizontal-first from pin
        const intermediate = { x: newPinPosition.x, y: adjacent.y };
        if (isStart) {
          points = [points[0], intermediate, points[1]];
        } else {
          points = [points[0], intermediate, points[1]];
        }
      }
    }

    return Line.simplifyPoints(points);
  },

  /**
   * Get the exit direction for an endpoint (direction of first/last segment)
   */
  getEndpointExitDirection(wire, isStart) {
    const Line = AsciiEditor.domain.Line;
    if (!wire.points || wire.points.length < 2) return 'none';

    if (isStart) {
      return Line.getDirection(wire.points[0], wire.points[1]);
    } else {
      const len = wire.points.length;
      return Line.getDirection(wire.points[len - 1], wire.points[len - 2]);
    }
  }

};
