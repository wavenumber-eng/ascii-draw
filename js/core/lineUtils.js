/**
 * Shared utilities for line and wire rendering/manipulation
 * Used by: LineTool, WireTool, Renderer, SelectTool
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.core = AsciiEditor.core || {};

AsciiEditor.core.lineUtils = {

  // Line style definitions - single source of truth
  styles: [
    {
      key: 'single',
      label: 'Single',
      hotkey: '1',
      chars: { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘' }
    },
    {
      key: 'double',
      label: 'Double',
      hotkey: '2',
      chars: { h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝' }
    },
    {
      key: 'thick',
      label: 'Thick',
      hotkey: '3',
      chars: { h: '█', v: '█', tl: '█', tr: '█', bl: '█', br: '█' }
    }
  ],

  /**
   * Get style object by key
   */
  getStyleByKey(key) {
    return this.styles.find(s => s.key === key) || this.styles[0];
  },

  /**
   * Get style object by hotkey
   */
  getStyleByHotkey(hotkey) {
    return this.styles.find(s => s.hotkey === hotkey);
  },

  /**
   * Calculate preview path from anchor to cursor with orthogonal routing
   * @param {Object} anchor - Start point {x, y}
   * @param {Object} cursor - End point {x, y}
   * @param {boolean} hFirst - true = horizontal-first, false = vertical-first
   * @returns {Array} Array of points representing the path
   */
  getPreviewPath(anchor, cursor, hFirst = true) {
    if (!anchor || !cursor) return [];

    const dx = cursor.x - anchor.x;
    const dy = cursor.y - anchor.y;

    // Axis-aligned case - straight line
    if (dx === 0 || dy === 0) {
      return [anchor, cursor];
    }

    // Diagonal case - need intermediate point based on posture
    if (hFirst) {
      // Horizontal-first: go horizontal, then vertical
      const intermediate = { x: cursor.x, y: anchor.y };
      return [anchor, intermediate, cursor];
    } else {
      // Vertical-first: go vertical, then horizontal
      const intermediate = { x: anchor.x, y: cursor.y };
      return [anchor, intermediate, cursor];
    }
  },

  /**
   * Simplify points by removing redundant collinear points
   * @param {Array} points - Array of {x, y} points
   * @returns {Array} Simplified array of points
   */
  simplifyPoints(points) {
    if (points.length < 3) return points;

    const result = [points[0]];

    for (let i = 1; i < points.length - 1; i++) {
      const prev = result[result.length - 1];
      const curr = points[i];
      const next = points[i + 1];

      // Check if curr is collinear between prev and next
      const sameX = (prev.x === curr.x && curr.x === next.x);
      const sameY = (prev.y === curr.y && curr.y === next.y);

      // Keep the point only if it's NOT collinear (i.e., it's a real corner)
      if (!sameX && !sameY) {
        result.push(curr);
      }
    }

    // Always add the last point
    result.push(points[points.length - 1]);

    return result;
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
   * Get corner character based on incoming and outgoing directions
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

  /**
   * Draw a single character at grid position
   */
  drawChar(ctx, char, col, row, grid, color) {
    const x = col * grid.charWidth;
    const y = row * grid.charHeight;
    ctx.fillStyle = color;
    ctx.fillText(char, x, y + 2);
  },

  /**
   * Draw line segments using ASCII characters
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array} points - Array of {x, y} points
   * @param {Object} chars - Character set {h, v, tl, tr, bl, br}
   * @param {Object} grid - Grid with charWidth, charHeight
   * @param {string} color - Fill color
   * @param {string} bgColor - Background color for clearing corners
   */
  drawSegments(ctx, points, chars, grid, color, bgColor = null) {
    if (points.length < 2) return;

    // Draw each segment
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = Math.sign(p2.x - p1.x);
      const dy = Math.sign(p2.y - p1.y);

      if (dx !== 0 && dy === 0) {
        // Horizontal segment
        const startX = Math.min(p1.x, p2.x);
        const endX = Math.max(p1.x, p2.x);
        for (let x = startX; x <= endX; x++) {
          this.drawChar(ctx, chars.h, x, p1.y, grid, color);
        }
      } else if (dy !== 0 && dx === 0) {
        // Vertical segment
        const startY = Math.min(p1.y, p2.y);
        const endY = Math.max(p1.y, p2.y);
        for (let y = startY; y <= endY; y++) {
          this.drawChar(ctx, chars.v, p1.x, y, grid, color);
        }
      }
    }

    // Draw corners at intermediate points
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      const cornerChar = this.getCornerChar(prev, curr, next, chars);
      if (cornerChar) {
        // Clear the cell first if bgColor provided
        if (bgColor) {
          const cx = curr.x * grid.charWidth;
          const cy = curr.y * grid.charHeight;
          ctx.fillStyle = bgColor;
          ctx.fillRect(cx, cy, grid.charWidth, grid.charHeight);
        }
        this.drawChar(ctx, cornerChar, curr.x, curr.y, grid, color);
      }
    }
  },

  /**
   * Check if a point lies on a line segment (with tolerance)
   * @param {Object} point - {x, y}
   * @param {Object} p1 - Segment start {x, y}
   * @param {Object} p2 - Segment end {x, y}
   * @returns {boolean}
   */
  pointOnSegment(point, p1, p2) {
    // For orthogonal segments only
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
   * @returns {Array} Array of { object, hitInfo } for lines/wires at point
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
   * Get the midpoint of a segment
   */
  getSegmentMidpoint(p1, p2) {
    return {
      x: Math.round((p1.x + p2.x) / 2),
      y: Math.round((p1.y + p2.y) / 2)
    };
  },

  /**
   * Check if two segments intersect (for junction detection)
   * @returns {Object|null} Intersection point or null
   */
  segmentIntersection(a1, a2, b1, b2) {
    // For orthogonal segments only
    const aHoriz = a1.y === a2.y;
    const bHoriz = b1.y === b2.y;

    if (aHoriz === bHoriz) {
      // Parallel segments - check for overlap
      return null; // For now, ignore parallel overlaps
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
  }
};

// Also expose findLinesAtPoint at top level for backward compatibility
AsciiEditor.core.findLinesAtPoint = function(point, objects) {
  return AsciiEditor.core.lineUtils.findLinesAtPoint(point, objects).map(r => r.object);
};
