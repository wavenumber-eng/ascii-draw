/**
 * Line Domain Module
 * Pure functions for line/polyline geometry and manipulation.
 * No UI, no canvas, no events - just geometry logic.
 *
 * Consolidates utilities from: lineUtils.js, SelectTool.js, DerivedStateComputer.js
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.domain = AsciiEditor.domain || {};

AsciiEditor.domain.Line = {

  // ============================================================
  // Point Utilities
  // ============================================================

  /**
   * Check if two points are equal
   */
  pointsEqual(p1, p2) {
    return p1.x === p2.x && p1.y === p2.y;
  },

  /**
   * Clone a point
   */
  clonePoint(p) {
    return { x: p.x, y: p.y };
  },

  /**
   * Get direction from one point to another
   * @returns {'right'|'left'|'down'|'up'|'none'}
   */
  getDirection(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (dx > 0) return 'right';
    if (dx < 0) return 'left';
    if (dy > 0) return 'down';
    if (dy < 0) return 'up';
    return 'none';
  },

  /**
   * Get the opposite direction
   */
  oppositeDirection(dir) {
    const opposites = { right: 'left', left: 'right', up: 'down', down: 'up', none: 'none' };
    return opposites[dir] || 'none';
  },

  // ============================================================
  // Segment Utilities
  // ============================================================

  /**
   * Get all segments from a polyline
   * @param {Object} lineObj - Line object with points array
   * @returns {Array} Array of { start, end, index }
   */
  getSegments(lineObj) {
    const segments = [];
    if (!lineObj.points || lineObj.points.length < 2) return segments;

    for (let i = 0; i < lineObj.points.length - 1; i++) {
      segments.push({
        start: lineObj.points[i],
        end: lineObj.points[i + 1],
        index: i
      });
    }
    return segments;
  },

  /**
   * Check if a segment is horizontal
   */
  isHorizontal(p1, p2) {
    return p1.y === p2.y;
  },

  /**
   * Check if a segment is vertical
   */
  isVertical(p1, p2) {
    return p1.x === p2.x;
  },

  /**
   * Get segment orientation
   * @returns {'horizontal'|'vertical'|'diagonal'}
   */
  getSegmentOrientation(p1, p2) {
    if (p1.y === p2.y) return 'horizontal';
    if (p1.x === p2.x) return 'vertical';
    return 'diagonal';
  },

  /**
   * Get segment midpoint
   */
  getSegmentMidpoint(p1, p2) {
    return {
      x: Math.round((p1.x + p2.x) / 2),
      y: Math.round((p1.y + p2.y) / 2)
    };
  },

  /**
   * Check if a point lies on a segment
   * @param {Object} point - {x, y}
   * @param {Object} p1 - Segment start {x, y}
   * @param {Object} p2 - Segment end {x, y}
   * @returns {boolean}
   */
  pointOnSegment(point, p1, p2) {
    if (p1.x === p2.x) {
      // Vertical segment
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      return point.x === p1.x && point.y >= minY && point.y <= maxY;
    } else if (p1.y === p2.y) {
      // Horizontal segment
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      return point.y === p1.y && point.x >= minX && point.x <= maxX;
    }
    return false;
  },

  /**
   * Check if point is strictly inside segment (not at endpoints)
   */
  pointInsideSegment(point, p1, p2) {
    if (this.pointsEqual(point, p1) || this.pointsEqual(point, p2)) {
      return false;
    }
    return this.pointOnSegment(point, p1, p2);
  },

  // ============================================================
  // Line Hit Testing
  // ============================================================

  /**
   * Find if a point is on any segment of a line/wire
   * @param {Object} point - {x, y}
   * @param {Object} lineObj - Line or wire object with points array
   * @returns {Object|null} { segmentIndex, isVertex, vertexIndex } or null
   */
  findPointOnLine(point, lineObj) {
    if (!lineObj.points || lineObj.points.length < 2) return null;

    // Check vertices first
    for (let i = 0; i < lineObj.points.length; i++) {
      if (lineObj.points[i].x === point.x && lineObj.points[i].y === point.y) {
        return { segmentIndex: i > 0 ? i - 1 : 0, isVertex: true, vertexIndex: i };
      }
    }

    // Check segments
    for (let i = 0; i < lineObj.points.length - 1; i++) {
      if (this.pointOnSegment(point, lineObj.points[i], lineObj.points[i + 1])) {
        return { segmentIndex: i, isVertex: false, vertexIndex: null };
      }
    }

    return null;
  },

  /**
   * Find all lines/wires at a given point
   * @param {Object} point - {x, y}
   * @param {Array} objects - Array of page objects
   * @returns {Array} Array of { object, hitInfo }
   */
  findLinesAtPoint(point, objects) {
    const results = [];
    for (const obj of objects) {
      if (obj.type === 'line' || obj.type === 'wire') {
        const hitInfo = this.findPointOnLine(point, obj);
        if (hitInfo) {
          results.push({ object: obj, hitInfo });
        }
      }
    }
    return results;
  },

  /**
   * Check if point is at an endpoint (first or last point) of a line
   */
  isEndpoint(point, lineObj) {
    if (!lineObj.points || lineObj.points.length < 2) return false;
    const first = lineObj.points[0];
    const last = lineObj.points[lineObj.points.length - 1];
    return this.pointsEqual(point, first) || this.pointsEqual(point, last);
  },

  /**
   * Get which endpoint (if any) a point matches
   * @returns {'start'|'end'|null}
   */
  getEndpointType(point, lineObj) {
    if (!lineObj.points || lineObj.points.length < 2) return null;
    if (this.pointsEqual(point, lineObj.points[0])) return 'start';
    if (this.pointsEqual(point, lineObj.points[lineObj.points.length - 1])) return 'end';
    return null;
  },

  // ============================================================
  // Segment Intersection
  // ============================================================

  /**
   * Find intersection of two orthogonal segments
   * @returns {Object|null} Intersection point {x, y} or null
   */
  segmentIntersection(a1, a2, b1, b2) {
    const aHoriz = a1.y === a2.y;
    const bHoriz = b1.y === b2.y;

    if (aHoriz === bHoriz) {
      // Parallel segments
      return null;
    }

    // One horizontal, one vertical
    const horiz = aHoriz ? { p1: a1, p2: a2 } : { p1: b1, p2: b2 };
    const vert = aHoriz ? { p1: b1, p2: b2 } : { p1: a1, p2: a2 };

    const hMinX = Math.min(horiz.p1.x, horiz.p2.x);
    const hMaxX = Math.max(horiz.p1.x, horiz.p2.x);
    const hY = horiz.p1.y;

    const vMinY = Math.min(vert.p1.y, vert.p2.y);
    const vMaxY = Math.max(vert.p1.y, vert.p2.y);
    const vX = vert.p1.x;

    if (vX >= hMinX && vX <= hMaxX && hY >= vMinY && hY <= vMaxY) {
      return { x: vX, y: hY };
    }

    return null;
  },

  /**
   * Find all intersections between lines in a collection
   * @param {Array} lines - Array of line objects
   * @returns {Array} Array of { point, lines: [line1, line2] }
   */
  findAllIntersections(lines) {
    const intersections = [];

    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const line1 = lines[i];
        const line2 = lines[j];

        const segs1 = this.getSegments(line1);
        const segs2 = this.getSegments(line2);

        for (const seg1 of segs1) {
          for (const seg2 of segs2) {
            const intersection = this.segmentIntersection(
              seg1.start, seg1.end,
              seg2.start, seg2.end
            );
            if (intersection) {
              intersections.push({
                point: intersection,
                lines: [line1, line2]
              });
            }
          }
        }
      }
    }

    return intersections;
  },

  // ============================================================
  // Point Simplification
  // ============================================================

  /**
   * Remove redundant collinear points from a polyline
   * @param {Array} points - Array of {x, y} points
   * @returns {Array} Simplified array (corners only)
   */
  simplifyPoints(points) {
    if (points.length < 3) return points.map(p => ({ x: p.x, y: p.y }));

    const result = [{ x: points[0].x, y: points[0].y }];

    for (let i = 1; i < points.length - 1; i++) {
      const prev = result[result.length - 1];
      const curr = points[i];
      const next = points[i + 1];

      // Check if curr is collinear between prev and next
      const sameX = (prev.x === curr.x && curr.x === next.x);
      const sameY = (prev.y === curr.y && curr.y === next.y);

      // Keep the point only if it's NOT collinear (it's a real corner)
      if (!sameX && !sameY) {
        result.push({ x: curr.x, y: curr.y });
      }
    }

    // Always add the last point
    const last = points[points.length - 1];
    result.push({ x: last.x, y: last.y });

    return result;
  },

  // ============================================================
  // Orthogonal Path Generation
  // ============================================================

  /**
   * Generate orthogonal preview path from anchor to cursor
   * @param {Object} anchor - Start point {x, y}
   * @param {Object} cursor - End point {x, y}
   * @param {boolean} hFirst - true = horizontal-first, false = vertical-first
   * @returns {Array} Array of points
   */
  getPreviewPath(anchor, cursor, hFirst = true) {
    if (!anchor || !cursor) return [];

    const dx = cursor.x - anchor.x;
    const dy = cursor.y - anchor.y;

    // Axis-aligned case - straight line
    if (dx === 0 || dy === 0) {
      return [anchor, cursor];
    }

    // Diagonal case - need intermediate point
    if (hFirst) {
      const intermediate = { x: cursor.x, y: anchor.y };
      return [anchor, intermediate, cursor];
    } else {
      const intermediate = { x: anchor.x, y: cursor.y };
      return [anchor, intermediate, cursor];
    }
  },

  // ============================================================
  // Corner Characters (for rendering)
  // ============================================================

  /**
   * Get corner character based on incoming and outgoing directions
   * @param {Object} prev - Previous point
   * @param {Object} curr - Current point (corner)
   * @param {Object} next - Next point
   * @param {Object} chars - Character set {tl, tr, bl, br}
   * @returns {string|null} Corner character or null
   */
  getCornerChar(prev, curr, next, chars) {
    const inDir = this.getDirection(prev, curr);
    const outDir = this.getDirection(curr, next);

    const cornerMap = {
      'right-down': chars.tr,
      'right-up': chars.br,
      'left-down': chars.tl,
      'left-up': chars.bl,
      'down-right': chars.bl,
      'down-left': chars.br,
      'up-right': chars.tl,
      'up-left': chars.tr
    };

    return cornerMap[`${inDir}-${outDir}`] || null;
  },

  // ============================================================
  // Line Merging
  // ============================================================

  /**
   * Merge two lines at a common endpoint
   * @param {Object} line1 - First line object
   * @param {Object} line2 - Second line object
   * @returns {Object|null} Merged line or null if no common endpoint
   */
  mergeLines(line1, line2) {
    const p1Start = line1.points[0];
    const p1End = line1.points[line1.points.length - 1];
    const p2Start = line2.points[0];
    const p2End = line2.points[line2.points.length - 1];

    let mergedPoints = null;

    if (this.pointsEqual(p1End, p2Start)) {
      // line1 end connects to line2 start
      mergedPoints = [...line1.points, ...line2.points.slice(1)];
    } else if (this.pointsEqual(p1End, p2End)) {
      // line1 end connects to line2 end (reverse line2)
      mergedPoints = [...line1.points, ...line2.points.slice(0, -1).reverse()];
    } else if (this.pointsEqual(p1Start, p2End)) {
      // line2 end connects to line1 start
      mergedPoints = [...line2.points, ...line1.points.slice(1)];
    } else if (this.pointsEqual(p1Start, p2Start)) {
      // Both start at same point (reverse line1)
      mergedPoints = [...line1.points.reverse(), ...line2.points.slice(1)];
    } else {
      return null; // No common endpoint
    }

    return {
      ...line1,
      points: this.simplifyPoints(mergedPoints)
    };
  }

};
