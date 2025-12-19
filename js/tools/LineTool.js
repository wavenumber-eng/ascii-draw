/**
 * LineTool - Create polylines with orthogonal segments
 * Implements: TOOL-23, OBJ-30 to OBJ-3A8
 * Uses shared utilities from AsciiEditor.core.lineUtils
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.tools = AsciiEditor.tools || {};

// Expose LineStyles from shared lineUtils for backward compatibility
AsciiEditor.tools.LineStyles = AsciiEditor.core.lineUtils.styles;

AsciiEditor.tools.LineTool = class LineTool extends AsciiEditor.tools.Tool {
  constructor() {
    super('line');
    this.cursor = 'none'; // Hide browser cursor, we draw our own
    this.drawing = false;
    this.points = [];           // Array of {x, y} committed points
    this.currentPos = null;     // Live cursor position for preview
    this.hFirst = true;         // OBJ-3A3: Posture - true = horizontal-first, false = vertical-first
    this.styleIndex = 0;        // Index into styles array

    // Reference shared utilities
    this.lineUtils = AsciiEditor.core.lineUtils;
    this.styles = this.lineUtils.styles;
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

  // Build hotkey lookup from styles
  get styleByHotkey() {
    const lookup = {};
    this.styles.forEach(s => {
      lookup[s.hotkey] = s;
    });
    return lookup;
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
   * Delegates to shared lineUtils
   */
  getPreviewPath(anchor, cursor) {
    return this.lineUtils.getPreviewPath(anchor, cursor, this.hFirst);
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

      // Check if clicked point hits an existing line - auto-finish for connection
      // (Merging is handled as post-process in recomputeJunctions)
      const state = context.history.getState();
      const page = state.project.pages.find(p => p.id === state.activePageId);
      if (page) {
        const hits = AsciiEditor.core.findLinesAtPoint(clickPos, page.objects);
        if (hits.length > 0) {
          // Found intersection with existing line - finish here
          this.finishLine(context);
          return true;
        }
      }
    }

    this.currentPos = clickPos;
    return true;
  }

  onMouseMove(event, context) {
    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
    this.currentPos = { x: col, y: row };
    return true; // Always redraw for crosshair and connection indicators
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
   * Delegates to shared lineUtils
   */
  simplifyPoints(points) {
    return this.lineUtils.simplifyPoints(points);
  }

  /**
   * Draw line segments using ASCII characters
   * Delegates to shared lineUtils
   */
  drawLineSegments(ctx, points, chars, grid, color) {
    const bgStyles = getComputedStyle(document.documentElement);
    const bgCanvas = bgStyles.getPropertyValue('--bg-canvas').trim() || '#1a1a1a';
    this.lineUtils.drawSegments(ctx, points, chars, grid, color, bgCanvas);
  }

  renderOverlay(ctx, context) {
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim() || '#007acc';
    const accentSecondary = styles.getPropertyValue('--accent-secondary').trim() || '#00aa66';
    const textColor = styles.getPropertyValue('--text-canvas').trim() || '#cccccc';

    const grid = context.grid;
    const offsetX = grid.charWidth / 2;
    const offsetY = grid.charHeight / 2;

    // Get page objects for hover detection
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    const objects = page ? page.objects : [];

    // Detect hover targets - show connection indicator (even before drawing)
    let hoverTarget = null;
    if (this.currentPos) {
      const lineHits = AsciiEditor.core.findLinesAtPoint(this.currentPos, objects);
      if (lineHits.length > 0) {
        hoverTarget = { point: this.currentPos };
      }
    }

    // Draw connection indicator
    if (hoverTarget) {
      const pixel = grid.charToPixel(hoverTarget.point.x, hoverTarget.point.y);
      const cx = pixel.x + offsetX;
      const cy = pixel.y + offsetY;

      // Connection indicator: glowing ring
      ctx.strokeStyle = accentSecondary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.stroke();

      // Inner glow
      ctx.strokeStyle = 'rgba(0, 170, 102, 0.4)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.stroke();

      // Label
      ctx.font = '10px sans-serif';
      ctx.fillStyle = accentSecondary;
      ctx.fillText('CONNECT', cx + 12, cy - 8);
    }

    // Draw crosshair cursor when hovering (before starting to draw)
    if (!this.drawing && this.currentPos) {
      const pixel = grid.charToPixel(this.currentPos.x, this.currentPos.y);
      const cx = pixel.x + offsetX;
      const cy = pixel.y + offsetY;

      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx, cy + 8);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy);
      ctx.lineTo(cx + 8, cy);
      ctx.stroke();
    }

    if (this.points.length === 0 && !this.currentPos) return;

    // Set up font for ASCII character rendering
    ctx.font = '16px BerkeleyMono, monospace';
    ctx.textBaseline = 'top';

    const chars = this.currentStyle.chars;

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
