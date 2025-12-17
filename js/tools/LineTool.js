/**
 * LineTool - Create polylines with orthogonal segments
 * Implements: TOOL-23, OBJ-30 to OBJ-3A8
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.tools = AsciiEditor.tools || {};

// Line style definitions - single source of truth for all style metadata
// To add a new style: add entry here with key, label, chars, and assign a hotkey
AsciiEditor.tools.LineStyles = [
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
  },
  {
    key: 'dashed',
    label: 'Dashed',
    hotkey: '4',
    chars: { h: '┄', v: '┆', tl: '┌', tr: '┐', bl: '└', br: '┘' }
  }
];

AsciiEditor.tools.LineTool = class LineTool extends AsciiEditor.tools.Tool {
  constructor() {
    super('line');
    this.cursor = 'crosshair';
    this.drawing = false;
    this.points = [];           // Array of {x, y} committed points
    this.currentPos = null;     // Live cursor position for preview
    this.hFirst = true;         // OBJ-3A3: Posture - true = horizontal-first, false = vertical-first
    this.styleIndex = 0;        // Index into LineStyles array

    // Build lookup maps from LineStyles
    this.styles = AsciiEditor.tools.LineStyles;
    this.styleByKey = {};
    this.styleByHotkey = {};
    for (const style of this.styles) {
      this.styleByKey[style.key] = style;
      this.styleByHotkey[style.hotkey] = style;
    }
  }

  // Get current style object
  get currentStyle() {
    return this.styles[this.styleIndex];
  }

  // Get current style key (for saving to line object)
  get style() {
    return this.currentStyle.key;
  }

  // Set style by key
  set style(key) {
    const index = this.styles.findIndex(s => s.key === key);
    if (index >= 0) {
      this.styleIndex = index;
    }
  }

  activate(context) {
    this.drawing = false;
    this.points = [];
    this.currentPos = null;
    this.hFirst = true;
    // Keep style persistent across activations
    context.canvas.style.cursor = this.cursor;
  }

  deactivate() {
    this.drawing = false;
    this.points = [];
    this.currentPos = null;
  }

  /**
   * OBJ-3A1, OBJ-3A2: Calculate preview points from anchor to cursor
   * Returns array of points representing the orthogonal path
   */
  getPreviewPath(anchor, cursor) {
    if (!anchor || !cursor) return [];

    const dx = cursor.x - anchor.x;
    const dy = cursor.y - anchor.y;

    // OBJ-3A1: Axis-aligned case - straight line
    if (dx === 0 || dy === 0) {
      return [anchor, cursor];
    }

    // OBJ-3A2: Diagonal case - need intermediate point based on posture
    if (this.hFirst) {
      // OBJ-3A4: Horizontal-first: go horizontal, then vertical
      const intermediate = { x: cursor.x, y: anchor.y };
      return [anchor, intermediate, cursor];
    } else {
      // OBJ-3A5: Vertical-first: go vertical, then horizontal
      const intermediate = { x: anchor.x, y: cursor.y };
      return [anchor, intermediate, cursor];
    }
  }

  /**
   * Cycle through line styles: single -> double -> thick -> single
   */
  cycleStyle() {
    const styles = ['single', 'double', 'thick'];
    const currentIndex = styles.indexOf(this.style);
    this.style = styles[(currentIndex + 1) % styles.length];
  }

  onMouseDown(event, context) {
    // Right-click finishes the line (OBJ-38)
    if (event.button === 2) {
      if (this.drawing && this.points.length >= 2) {
        this.finishLine(context);
      }
      return true;
    }

    // Left-click adds points
    if (event.button !== 0) return false;

    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
    const clickPos = { x: col, y: row };

    if (!this.drawing) {
      // First point - just add it as anchor
      this.points.push(clickPos);
      this.drawing = true;
      this.currentPos = clickPos;
    } else {
      // Subsequent points - use posture logic
      const anchor = this.points[this.points.length - 1];
      const previewPath = this.getPreviewPath(anchor, clickPos);

      // Add all points except the first (which is already the anchor)
      // OBJ-3A8: Add intermediate point(s); last point becomes new anchor
      for (let i = 1; i < previewPath.length; i++) {
        this.points.push(previewPath[i]);
      }
    }

    this.currentPos = clickPos;
    return true;
  }

  onMouseMove(event, context) {
    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
    this.currentPos = { x: col, y: row };

    if (this.drawing) {
      return true; // OBJ-3A7: Request redraw for real-time preview
    }
    return false;
  }

  onMouseUp(event, context) {
    return false;
  }

  onDoubleClick(event, context) {
    // Disabled - using right-click instead
    return false;
  }

  onKeyDown(event, context) {
    // Tab key cycles through styles
    if (event.key === 'Tab') {
      event.preventDefault();
      this.styleIndex = (this.styleIndex + 1) % this.styles.length;
      return true;
    }

    // Number keys for direct style selection
    if (this.styleByHotkey[event.key]) {
      this.style = this.styleByHotkey[event.key].key;
      return true;
    }

    // OBJ-3A6: Space key toggles posture
    if (event.key === ' ' || event.code === 'Space') {
      if (this.drawing) {
        this.hFirst = !this.hFirst;
        return true; // Redraw with new posture
      }
    }

    if (this.drawing) {
      // OBJ-38: Enter finishes the line
      if (event.key === 'Enter') {
        if (this.points.length >= 2) {
          this.finishLine(context);
        }
        return true;
      }

      // OBJ-39: Escape cancels the line
      if (event.key === 'Escape') {
        this.cancelLine();
        return true;
      }

      // OBJ-39: Backspace removes last point
      if (event.key === 'Backspace') {
        if (this.points.length > 1) {
          this.points.pop();
        } else if (this.points.length === 1) {
          this.cancelLine();
        }
        return true;
      }
    }
    return false;
  }

  finishLine(context) {
    if (this.points.length < 2) {
      this.cancelLine();
      return;
    }

    const state = context.history.getState();

    // Simplify points by removing redundant collinear points
    const simplifiedPoints = this.simplifyPoints(this.points);

    // Need at least 2 points after simplification
    if (simplifiedPoints.length < 2) {
      this.cancelLine();
      return;
    }

    // Create line object with simplified points and current style
    const newLine = {
      id: AsciiEditor.core.generateId(),
      type: 'line',
      points: simplifiedPoints.map(p => ({ x: p.x, y: p.y })),
      style: this.style,
      startCap: 'none',
      endCap: 'none'
    };

    context.history.execute(
      new AsciiEditor.core.CreateObjectCommand(state.activePageId, newLine)
    );

    // Select the new line
    context.history.updateState(s => ({
      ...s,
      selection: { ids: [newLine.id], handles: null }
    }));

    // Reset tool state (but keep style)
    this.drawing = false;
    this.points = [];
    this.currentPos = null;
    this.hFirst = true;

    // Switch to select tool so user can adjust points immediately
    if (context.setTool) {
      context.setTool('select');
    }
  }

  cancelLine() {
    this.drawing = false;
    this.points = [];
    this.currentPos = null;
    this.hFirst = true;
  }

  /**
   * Simplify points by removing redundant collinear points.
   * Three consecutive points on the same axis (same X or same Y)
   * means the middle point is redundant and can be removed.
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
  }

  /**
   * Get direction from one point to another
   */
  getDirection(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (dx > 0) return 'right';
    if (dx < 0) return 'left';
    if (dy > 0) return 'down';
    if (dy < 0) return 'up';
    return 'none';
  }

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
  }

  /**
   * Draw a character at grid position using canvas context
   */
  drawChar(ctx, char, col, row, grid, color) {
    const x = col * grid.charWidth;
    const y = row * grid.charHeight;
    ctx.fillStyle = color;
    ctx.fillText(char, x, y + 2);
  }

  /**
   * Draw line segments using ASCII characters
   */
  drawLineSegments(ctx, points, chars, grid, color) {
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

    // Draw corners at intermediate points (clear cell first to avoid overlap)
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      const cornerChar = this.getCornerChar(prev, curr, next, chars);
      if (cornerChar) {
        // Clear the cell first
        const cx = curr.x * grid.charWidth;
        const cy = curr.y * grid.charHeight;
        const bgStyles = getComputedStyle(document.documentElement);
        const bgCanvas = bgStyles.getPropertyValue('--bg-canvas').trim() || '#1a1a1a';
        ctx.fillStyle = bgCanvas;
        ctx.fillRect(cx, cy, grid.charWidth, grid.charHeight);

        this.drawChar(ctx, cornerChar, curr.x, curr.y, grid, color);
      }
    }
  }

  renderOverlay(ctx, context) {
    if (this.points.length === 0 && !this.currentPos) return;

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim() || '#007acc';
    const textColor = styles.getPropertyValue('--text-canvas').trim() || '#cccccc';

    // Set up font for ASCII character rendering
    ctx.font = '16px BerkeleyMono, monospace';
    ctx.textBaseline = 'top';

    const chars = this.currentStyle.chars;
    const grid = context.grid;

    // Build complete preview path: committed points + preview to cursor
    let allPoints = [...this.points];
    if (this.drawing && this.currentPos && this.points.length > 0) {
      const anchor = this.points[this.points.length - 1];
      const previewPath = this.getPreviewPath(anchor, this.currentPos);
      // Add preview points (skip first since it's the anchor)
      for (let i = 1; i < previewPath.length; i++) {
        allPoints.push(previewPath[i]);
      }
    }

    // Draw ASCII characters for the entire path
    if (allPoints.length >= 2) {
      this.drawLineSegments(ctx, allPoints, chars, grid, textColor);
    }

    // Draw point markers for committed points (small circles)
    ctx.fillStyle = accent;
    const offsetX = grid.charWidth / 2;
    const offsetY = grid.charHeight / 2;

    for (let i = 0; i < this.points.length; i++) {
      const pixel = grid.charToPixel(this.points[i].x, this.points[i].y);
      ctx.beginPath();
      ctx.arc(pixel.x + offsetX, pixel.y + offsetY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Status indicator: point count, posture, and style
    if (this.points.length > 0) {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = accent;
      const lastPoint = this.points[this.points.length - 1];
      const labelPixel = grid.charToPixel(lastPoint.x, lastPoint.y);
      const postureLabel = this.hFirst ? 'H-V' : 'V-H';
      const styleInfo = `${this.currentStyle.hotkey}:${this.currentStyle.label}`;
      ctx.fillText(`${this.points.length}pts ${postureLabel} [${styleInfo}]`, labelPixel.x + offsetX + 8, labelPixel.y + offsetY - 8);
    }
  }
};
