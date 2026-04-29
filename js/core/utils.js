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
