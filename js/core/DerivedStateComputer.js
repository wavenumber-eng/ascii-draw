/**
 * DerivedStateComputer - Computes derived objects (junctions, no-connects) from primary state
 * Implements: Derived Objects Architecture Plan
 *
 * Derived objects are ephemeral - computed fresh after every state change.
 * They are NOT stored in page.objects (primary state).
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.core = AsciiEditor.core || {};

AsciiEditor.core.DerivedStateComputer = class DerivedStateComputer {
  constructor() {
    // Render order for object types (lower = rendered first/behind)
    this.renderOrder = {
      'line': 20,
      'junction': 25,
      'wire': 30,
      'wire-junction': 35,
      'wire-noconnect': 36,
      'box': 40,
      'symbol': 50,
      'text': 60
    };
  }

  /**
   * Main entry point - compute all derived objects from primary objects
   * @param {Array} objects - primary objects (lines, wires, boxes, symbols, text)
   * @returns {Object} { derivedObjects, renderList }
   */
  compute(objects) {
    const lines = objects.filter(o => o.type === 'line' && o.points && o.points.length >= 2);
    const wires = objects.filter(o => o.type === 'wire' && o.points && o.points.length >= 2);

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

  /**
   * Compute line junctions where 2+ lines share a point
   * Junction requires at least one line to have the point as a non-endpoint (T-junction)
   * @param {Array} lines - line objects
   * @returns {Array} junction objects
   */
  computeLineJunctions(lines) {
    const pointMap = new Map(); // "x,y" -> [{lineId, style, isEndpoint}]

    // PASS 1: Collect all vertices from all lines
    for (const line of lines) {
      for (let i = 0; i < line.points.length; i++) {
        const pt = line.points[i];
        const key = `${pt.x},${pt.y}`;
        const isEndpoint = (i === 0 || i === line.points.length - 1);
        if (!pointMap.has(key)) {
          pointMap.set(key, []);
        }
        pointMap.get(key).push({ lineId: line.id, style: line.style || 'single', isEndpoint });
      }
    }

    // PASS 2: Check for T-junctions (vertices landing on other lines' segments)
    for (const line of lines) {
      for (let i = 0; i < line.points.length - 1; i++) {
        const p1 = line.points[i];
        const p2 = line.points[i + 1];

        for (const otherLine of lines) {
          if (otherLine.id === line.id) continue;

          for (const otherPt of otherLine.points) {
            // Skip if otherPt is exactly p1 or p2 (already counted)
            if ((otherPt.x === p1.x && otherPt.y === p1.y) ||
                (otherPt.x === p2.x && otherPt.y === p2.y)) {
              continue;
            }
            if (this._pointOnSegment(otherPt, p1, p2)) {
              const key = `${otherPt.x},${otherPt.y}`;
              const existing = pointMap.get(key);
              if (existing && !existing.find(e => e.lineId === line.id)) {
                existing.push({ lineId: line.id, style: line.style || 'single', isEndpoint: false });
              }
            }
          }
        }
      }
    }

    // Create junction objects
    const junctions = [];
    for (const [key, lineRefs] of pointMap) {
      if (lineRefs.length < 2) continue;

      const [x, y] = key.split(',').map(Number);
      const connectedLines = [...new Set(lineRefs.map(r => r.lineId))];

      if (connectedLines.length < 2) continue;

      // Only create junction if at least one line has this as a non-endpoint
      const hasNonEndpoint = lineRefs.some(r => !r.isEndpoint);
      if (!hasNonEndpoint) continue;

      // Determine junction style
      const styles = lineRefs.map(r => r.style);
      let junctionStyle = 'single';
      if (styles.includes('double')) junctionStyle = 'double';
      if (styles.includes('thick')) junctionStyle = 'thick';

      junctions.push({
        id: `junc-${x}-${y}`,
        type: 'junction',
        x,
        y,
        connectedLines,
        style: junctionStyle,
        derived: true,
        selectable: false
      });
    }

    return junctions;
  }

  /**
   * Compute wire junctions where wire endpoint/vertex lands on another wire's segment
   * Important: Crossing wire segments do NOT create junctions
   * @param {Array} wires - wire objects
   * @returns {Array} wire-junction objects
   */
  computeWireJunctions(wires) {
    const pointMap = new Map(); // "x,y" -> [{wireId, net, style, isEndpoint}]

    // PASS 1: Collect all vertices from all wires
    for (const wire of wires) {
      for (let i = 0; i < wire.points.length; i++) {
        const pt = wire.points[i];
        const key = `${pt.x},${pt.y}`;
        const isEndpoint = (i === 0 || i === wire.points.length - 1);
        if (!pointMap.has(key)) {
          pointMap.set(key, []);
        }
        pointMap.get(key).push({
          wireId: wire.id,
          net: wire.net || '',
          style: wire.style || 'single',
          isEndpoint
        });
      }
    }

    // PASS 2: Check for T-junctions (vertices landing on other wires' segments)
    for (const wire of wires) {
      for (let i = 0; i < wire.points.length - 1; i++) {
        const p1 = wire.points[i];
        const p2 = wire.points[i + 1];

        for (const otherWire of wires) {
          if (otherWire.id === wire.id) continue;

          for (const otherPt of otherWire.points) {
            // Skip if otherPt is exactly p1 or p2
            if ((otherPt.x === p1.x && otherPt.y === p1.y) ||
                (otherPt.x === p2.x && otherPt.y === p2.y)) {
              continue;
            }
            if (this._pointOnSegment(otherPt, p1, p2)) {
              const key = `${otherPt.x},${otherPt.y}`;
              const existing = pointMap.get(key);
              if (existing && !existing.find(e => e.wireId === wire.id)) {
                existing.push({
                  wireId: wire.id,
                  net: wire.net || '',
                  style: wire.style || 'single',
                  isEndpoint: false
                });
              }
            }
          }
        }
      }
    }

    // Create wire junction objects where 2+ wires meet
    // Only create junction if at least one wire has this as a non-endpoint (T-junction)
    // If ALL wires have this as their endpoint, it's a merge candidate, not a junction
    const junctions = [];
    for (const [key, wireRefs] of pointMap) {
      if (wireRefs.length < 2) continue;

      const [x, y] = key.split(',').map(Number);
      const connectedWires = [...new Set(wireRefs.map(r => r.wireId))];

      if (connectedWires.length < 2) continue;

      // Skip if ALL wires have this as an endpoint (should merge, not junction)
      const hasNonEndpoint = wireRefs.some(r => !r.isEndpoint);
      if (!hasNonEndpoint) continue;

      // Propagate net name - use first non-empty net found
      const netNames = wireRefs.map(r => r.net).filter(n => n && n.length > 0);
      const net = netNames.length > 0 ? netNames[0] : '';

      // Determine junction style
      const styles = wireRefs.map(r => r.style);
      let junctionStyle = 'single';
      if (styles.includes('double')) junctionStyle = 'double';
      if (styles.includes('thick')) junctionStyle = 'thick';

      junctions.push({
        id: `wjunc-${x}-${y}`,
        type: 'wire-junction',
        x,
        y,
        connectedWires,
        net,
        style: junctionStyle,
        derived: true,
        selectable: false
      });
    }

    return junctions;
  }

  /**
   * Compute wire no-connects for floating endpoints
   * A no-connect is created when a wire endpoint:
   * - Has no pin binding (startBinding/endBinding)
   * - Is not connected to another wire (not at a wire junction or shared endpoint)
   * @param {Array} wires - wire objects
   * @param {Array} wireJunctions - computed wire junctions
   * @returns {Array} wire-noconnect objects
   */
  computeWireNoConnects(wires, wireJunctions) {
    // Build set of junction positions for quick lookup
    const junctionPositions = new Set(
      wireJunctions.map(j => `${j.x},${j.y}`)
    );

    // Build map of endpoint positions to count how many wires meet there
    // (for detecting shared endpoints that aren't junctions)
    const endpointCounts = new Map();
    for (const wire of wires) {
      if (!wire.points || wire.points.length < 2) continue;
      const startKey = `${wire.points[0].x},${wire.points[0].y}`;
      const endKey = `${wire.points[wire.points.length - 1].x},${wire.points[wire.points.length - 1].y}`;
      endpointCounts.set(startKey, (endpointCounts.get(startKey) || 0) + 1);
      endpointCounts.set(endKey, (endpointCounts.get(endKey) || 0) + 1);
    }

    const noConnects = [];

    for (const wire of wires) {
      if (!wire.points || wire.points.length < 2) continue;

      // Check start endpoint
      if (!wire.startBinding) {
        const start = wire.points[0];
        const startKey = `${start.x},${start.y}`;
        // Only create no-connect if not at junction AND not shared with another wire endpoint
        if (!junctionPositions.has(startKey) && endpointCounts.get(startKey) === 1) {
          noConnects.push({
            id: `wnc-${wire.id}-start`,
            type: 'wire-noconnect',
            x: start.x,
            y: start.y,
            wireId: wire.id,
            endpoint: 'start',
            derived: true,
            selectable: false
          });
        }
      }

      // Check end endpoint
      if (!wire.endBinding) {
        const end = wire.points[wire.points.length - 1];
        const endKey = `${end.x},${end.y}`;
        // Only create no-connect if not at junction AND not shared with another wire endpoint
        if (!junctionPositions.has(endKey) && endpointCounts.get(endKey) === 1) {
          noConnects.push({
            id: `wnc-${wire.id}-end`,
            type: 'wire-noconnect',
            x: end.x,
            y: end.y,
            wireId: wire.id,
            endpoint: 'end',
            derived: true,
            selectable: false
          });
        }
      }
    }

    return noConnects;
  }

  /**
   * Build sorted render list combining primary and derived objects
   * Sort order: 1) type render order, 2) zIndex within same type
   * @param {Array} primary - primary objects
   * @param {Array} derived - derived objects
   * @returns {Array} sorted render list
   */
  buildRenderList(primary, derived) {
    const all = [...primary, ...derived];
    return all.sort((a, b) => {
      const orderDiff = this._getRenderOrder(a) - this._getRenderOrder(b);
      if (orderDiff !== 0) return orderDiff;
      // Secondary sort by zIndex for objects of same type
      return (a.zIndex || 0) - (b.zIndex || 0);
    });
  }

  /**
   * Get render order for an object type
   * @param {Object} obj - object to get render order for
   * @returns {number} render order value
   */
  _getRenderOrder(obj) {
    return this.renderOrder[obj.type] || 50;
  }

  /**
   * Check if a point lies on an orthogonal segment (horizontal or vertical)
   * @param {Object} point - {x, y}
   * @param {Object} p1 - segment start {x, y}
   * @param {Object} p2 - segment end {x, y}
   * @returns {boolean}
   */
  _pointOnSegment(point, p1, p2) {
    // Horizontal segment
    if (p1.y === p2.y && point.y === p1.y) {
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      return point.x >= minX && point.x <= maxX;
    }
    // Vertical segment
    if (p1.x === p2.x && point.x === p1.x) {
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      return point.y >= minY && point.y <= maxY;
    }
    return false;
  }
};
