/**
 * Core utility functions
 * Implements: ARCH-* (shared utilities)
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.core = AsciiEditor.core || {};

AsciiEditor.core.generateId = function() {
  return 'id-' + Math.random().toString(36).substr(2, 9);
};

AsciiEditor.core.clamp = function(value, min, max) {
  return Math.min(Math.max(value, min), max);
};

AsciiEditor.core.deepClone = function(obj) {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Junction utilities for line connectivity
 * Implements: OBJ-45 to OBJ-48
 */

/**
 * Check if a point lies on an orthogonal line segment (horizontal or vertical)
 * @param {Object} point - {x, y} point to test
 * @param {Object} p1 - {x, y} segment start
 * @param {Object} p2 - {x, y} segment end
 * @returns {boolean} true if point is on the segment
 */
AsciiEditor.core.pointOnSegment = function(point, p1, p2) {
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
};

/**
 * Find all lines that pass through a given point
 * @param {Object} point - {x, y} point to test
 * @param {Array} objects - array of objects on the page
 * @returns {Array} array of {lineId, segmentIndex, isVertex} for each hit
 */
AsciiEditor.core.findLinesAtPoint = function(point, objects) {
  const results = [];
  const lines = objects.filter(o => o.type === 'line');
  AsciiEditor.debug.trace('utils', 'findLinesAtPoint', { point, lineCount: lines.length });

  for (const obj of objects) {
    if (obj.type !== 'line' || !obj.points || obj.points.length < 2) continue;

    // Check if point is on any vertex
    for (let i = 0; i < obj.points.length; i++) {
      if (obj.points[i].x === point.x && obj.points[i].y === point.y) {
        results.push({ lineId: obj.id, segmentIndex: i, isVertex: true });
        AsciiEditor.debug.trace('utils', 'findLinesAtPoint: vertex match', { lineId: obj.id, vertexIndex: i });
        break; // Found vertex match, no need to check segments
      }
    }

    // Check if point is on any segment (but not a vertex - already checked)
    if (!results.find(r => r.lineId === obj.id)) {
      for (let i = 0; i < obj.points.length - 1; i++) {
        if (AsciiEditor.core.pointOnSegment(point, obj.points[i], obj.points[i + 1])) {
          results.push({ lineId: obj.id, segmentIndex: i, isVertex: false });
          AsciiEditor.debug.trace('utils', 'findLinesAtPoint: segment match', { lineId: obj.id, segmentIndex: i, p1: obj.points[i], p2: obj.points[i+1] });
          break;
        }
      }
    }
  }

  AsciiEditor.debug.trace('utils', 'findLinesAtPoint result', { resultCount: results.length, results });
  return results;
};

/**
 * Find if a point matches a line's start or end vertex (for line merging)
 * @param {Object} point - {x, y} point to test
 * @param {Array} objects - array of objects on the page
 * @returns {Object|null} {line, endpoint: 'start'|'end'} or null if no match
 */
AsciiEditor.core.findLineEndpointAtPoint = function(point, objects) {
  for (const obj of objects) {
    if (obj.type !== 'line' || !obj.points || obj.points.length < 2) continue;

    const startPt = obj.points[0];
    const endPt = obj.points[obj.points.length - 1];

    // Check START first
    if (startPt.x === point.x && startPt.y === point.y) {
      AsciiEditor.debug.trace('utils', 'findLineEndpointAtPoint: matched START', { point, startPt, lineId: obj.id });
      return { line: obj, endpoint: 'start' };
    }
    // Check END
    if (endPt.x === point.x && endPt.y === point.y) {
      AsciiEditor.debug.trace('utils', 'findLineEndpointAtPoint: matched END', { point, endPt, lineId: obj.id });
      return { line: obj, endpoint: 'end' };
    }
  }
  return null;
};

/**
 * Compute all junction points from line geometry
 * A junction exists where 2+ lines share a point
 * @param {Array} objects - array of objects on the page
 * @returns {Array} array of junction objects
 */
AsciiEditor.core.computeJunctions = function(objects) {
  const lines = objects.filter(o => o.type === 'line' && o.points && o.points.length >= 2);
  const pointMap = new Map(); // "x,y" -> [{lineId, style, isEndpoint}]

  AsciiEditor.debug.trace('Junction', 'Computing junctions', { lineCount: lines.length });

  // FIRST PASS: Collect all vertices from all lines, tracking if they're endpoints
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

  // SECOND PASS: Check for T-junctions (vertices landing on other lines' segments)
  // This must be separate so all vertices are in pointMap first
  for (const line of lines) {
    for (let i = 0; i < line.points.length - 1; i++) {
      const p1 = line.points[i];
      const p2 = line.points[i + 1];

      // For each other line, check if any of its vertices land on this segment
      for (const otherLine of lines) {
        if (otherLine.id === line.id) continue;

        for (const otherPt of otherLine.points) {
          // Skip if otherPt is exactly p1 or p2 (already counted as vertex)
          if ((otherPt.x === p1.x && otherPt.y === p1.y) ||
              (otherPt.x === p2.x && otherPt.y === p2.y)) {
            continue;
          }
          if (AsciiEditor.core.pointOnSegment(otherPt, p1, p2)) {
            const key = `${otherPt.x},${otherPt.y}`;
            const existing = pointMap.get(key);
            AsciiEditor.debug.trace('Junction', 'T-junction candidate found', {
              point: otherPt,
              onSegment: { p1, p2 },
              lineId: line.id,
              otherLineId: otherLine.id,
              existingCount: existing ? existing.length : 0
            });
            if (existing && !existing.find(e => e.lineId === line.id)) {
              // This is a mid-segment hit, so isEndpoint = false for this line
              existing.push({ lineId: line.id, style: line.style || 'single', isEndpoint: false });
              AsciiEditor.debug.trace('Junction', 'Added line to point (T-junction)', { key, lineId: line.id });
            }
          }
        }
      }
    }
  }

  // Create junction objects where 2+ lines meet
  // BUT only if at least one line has this as a non-endpoint (T-junction case)
  const junctions = [];
  for (const [key, lineRefs] of pointMap) {
    if (lineRefs.length >= 2) {
      const [x, y] = key.split(',').map(Number);
      const connectedLines = [...new Set(lineRefs.map(r => r.lineId))];

      // Only create junction if truly 2+ unique lines
      if (connectedLines.length >= 2) {
        // Check if at least one line has this as a non-endpoint
        // If ALL lines have this as their endpoint, it's a shared endpoint (should merge), not a junction
        const hasNonEndpoint = lineRefs.some(r => !r.isEndpoint);
        if (!hasNonEndpoint) {
          AsciiEditor.debug.trace('Junction', 'Skipping shared endpoint (not a T-junction)', { key, lineRefs });
          continue;
        }

        // Determine junction style from connected lines (prefer single > double > thick)
        const styles = lineRefs.map(r => r.style);
        let junctionStyle = 'single';
        if (styles.includes('double')) junctionStyle = 'double';
        if (styles.includes('thick')) junctionStyle = 'thick';

        const junction = {
          id: AsciiEditor.core.generateId(),
          type: 'junction',
          x: x,
          y: y,
          connectedLines: connectedLines,
          style: junctionStyle,
          derived: true,      // OBJ-8: Computed from line geometry
          selectable: false   // OBJ-9: Not user-selectable
        };
        junctions.push(junction);
        AsciiEditor.debug.info('Junction', 'Created junction', junction);
      }
    }
  }

  AsciiEditor.debug.trace('Junction', 'Junction computation complete', { junctionCount: junctions.length });
  return junctions;
};

/**
 * OBJ-6A to OBJ-6D: Compute wire junctions and propagate net names
 * A wire junction exists where 2+ wires share a point
 * @param {Array} objects - array of objects on the page
 * @returns {Array} array of wire-junction objects
 */
AsciiEditor.core.computeWireJunctions = function(objects) {
  const wires = objects.filter(o => o.type === 'wire' && o.points && o.points.length >= 2);
  const pointMap = new Map(); // "x,y" -> [{wireId, net, isEndpoint}]

  AsciiEditor.debug.trace('WireJunction', 'Computing wire junctions', { wireCount: wires.length });

  // FIRST PASS: Collect all vertices from all wires
  for (const wire of wires) {
    for (let i = 0; i < wire.points.length; i++) {
      const pt = wire.points[i];
      const key = `${pt.x},${pt.y}`;
      const isEndpoint = (i === 0 || i === wire.points.length - 1);
      if (!pointMap.has(key)) {
        pointMap.set(key, []);
      }
      pointMap.get(key).push({ wireId: wire.id, net: wire.net || '', style: wire.style || 'single', isEndpoint });
    }
  }

  // SECOND PASS: Check for T-junctions (vertices landing on other wires' segments)
  for (const wire of wires) {
    for (let i = 0; i < wire.points.length - 1; i++) {
      const p1 = wire.points[i];
      const p2 = wire.points[i + 1];

      for (const otherWire of wires) {
        if (otherWire.id === wire.id) continue;

        for (const otherPt of otherWire.points) {
          if ((otherPt.x === p1.x && otherPt.y === p1.y) ||
              (otherPt.x === p2.x && otherPt.y === p2.y)) {
            continue;
          }
          if (AsciiEditor.core.pointOnSegment(otherPt, p1, p2)) {
            const key = `${otherPt.x},${otherPt.y}`;
            const existing = pointMap.get(key);
            if (existing && !existing.find(e => e.wireId === wire.id)) {
              existing.push({ wireId: wire.id, net: wire.net || '', style: wire.style || 'single', isEndpoint: false });
            }
          }
        }
      }
    }
  }

  // Create wire junction objects where 2+ wires meet
  const junctions = [];
  for (const [key, wireRefs] of pointMap) {
    if (wireRefs.length >= 2) {
      const [x, y] = key.split(',').map(Number);
      const connectedWires = [...new Set(wireRefs.map(r => r.wireId))];

      if (connectedWires.length >= 2) {
        // Wire junctions are created at ALL multi-wire connection points
        // (unlike line junctions which skip shared endpoints)

        // OBJ-6C: Propagate net name - use first non-empty net found
        const netNames = wireRefs.map(r => r.net).filter(n => n && n.length > 0);
        const net = netNames.length > 0 ? netNames[0] : '';

        // Determine junction style
        const styles = wireRefs.map(r => r.style);
        let junctionStyle = 'single';
        if (styles.includes('double')) junctionStyle = 'double';
        if (styles.includes('thick')) junctionStyle = 'thick';

        const junction = {
          id: AsciiEditor.core.generateId(),
          type: 'wire-junction',
          x: x,
          y: y,
          connectedWires: connectedWires,
          net: net,
          style: junctionStyle,
          derived: true,
          selectable: false
        };
        junctions.push(junction);
        AsciiEditor.debug.trace('WireJunction', 'Created wire junction', junction);
      }
    }
  }

  AsciiEditor.debug.trace('WireJunction', 'Wire junction computation complete', { junctionCount: junctions.length });
  return junctions;
};

/**
 * Merge lines that share endpoints into single lines
 * @param {Array} objects - array of objects on the page
 * @returns {Array} array with merged lines (non-line objects unchanged)
 */
AsciiEditor.core.mergeConnectedLines = function(objects) {
  const nonLines = objects.filter(o => o.type !== 'line');
  let lines = objects.filter(o => o.type === 'line' && o.points && o.points.length >= 2);

  AsciiEditor.debug.trace('Merge', 'mergeConnectedLines called', { lineCount: lines.length });

  let merged = true;
  while (merged) {
    merged = false;

    // Build endpoint map: "x,y" -> [{line, which: 'start'|'end'}]
    const endpointMap = new Map();
    for (const line of lines) {
      const startKey = `${line.points[0].x},${line.points[0].y}`;
      const endKey = `${line.points[line.points.length - 1].x},${line.points[line.points.length - 1].y}`;

      if (!endpointMap.has(startKey)) endpointMap.set(startKey, []);
      if (!endpointMap.has(endKey)) endpointMap.set(endKey, []);

      endpointMap.get(startKey).push({ line, which: 'start' });
      endpointMap.get(endKey).push({ line, which: 'end' });
    }

    // Find first pair of lines sharing an endpoint
    for (const [key, entries] of endpointMap) {
      if (entries.length !== 2) continue;

      const [e1, e2] = entries;
      if (e1.line.id === e2.line.id) continue; // Same line (loop)

      // Merge these two lines
      const line1 = e1.line;
      const line2 = e2.line;
      let mergedPoints;

      if (e1.which === 'end' && e2.which === 'start') {
        // line1.end == line2.start: append line2 to line1
        mergedPoints = [...line1.points, ...line2.points.slice(1)];
      } else if (e1.which === 'end' && e2.which === 'end') {
        // line1.end == line2.end: append reversed line2 to line1
        mergedPoints = [...line1.points, ...[...line2.points].reverse().slice(1)];
      } else if (e1.which === 'start' && e2.which === 'start') {
        // line1.start == line2.start: prepend reversed line2 to line1
        mergedPoints = [...[...line2.points].reverse().slice(0, -1), ...line1.points];
      } else if (e1.which === 'start' && e2.which === 'end') {
        // line1.start == line2.end: prepend line2 to line1
        mergedPoints = [...line2.points.slice(0, -1), ...line1.points];
      }

      if (mergedPoints) {
        AsciiEditor.debug.info('Merge', 'Merging lines', {
          line1Id: line1.id,
          line2Id: line2.id,
          connection: `${e1.which}-${e2.which}`,
          resultPoints: mergedPoints.length
        });

        // Create merged line (keep line1's properties)
        const mergedLine = {
          ...line1,
          points: mergedPoints
        };

        // Remove both original lines, add merged line
        lines = lines.filter(l => l.id !== line1.id && l.id !== line2.id);
        lines.push(mergedLine);
        merged = true;
        break; // Restart the loop
      }
    }
  }

  AsciiEditor.debug.trace('Merge', 'mergeConnectedLines complete', { resultLineCount: lines.length });
  return [...nonLines, ...lines];
};

/**
 * Recompute line connections for a page - merges connected lines and computes junctions
 * @param {Object} page - page object with objects array
 * @returns {Object} updated page with merged lines and junctions
 */
AsciiEditor.core.recomputeJunctions = function(page) {
  AsciiEditor.debug.trace('Junction', 'recomputeJunctions called', { pageId: page.id, objectCount: page.objects.length });

  // Remove existing junctions (both line and wire junctions)
  const nonJunctionObjects = page.objects.filter(o => o.type !== 'junction' && o.type !== 'wire-junction');

  // First, merge lines that share endpoints
  const mergedObjects = AsciiEditor.core.mergeConnectedLines(nonJunctionObjects);

  // Compute line junctions
  const newLineJunctions = AsciiEditor.core.computeJunctions(mergedObjects);

  // OBJ-6A to OBJ-6D: Compute wire junctions
  const newWireJunctions = AsciiEditor.core.computeWireJunctions(mergedObjects);

  AsciiEditor.debug.trace('Junction', 'recomputeJunctions complete', {
    originalObjects: page.objects.length,
    afterMerge: mergedObjects.length,
    lineJunctions: newLineJunctions.length,
    wireJunctions: newWireJunctions.length
  });

  // Return updated page with all junctions
  return {
    ...page,
    objects: [...mergedObjects, ...newLineJunctions, ...newWireJunctions]
  };
};
