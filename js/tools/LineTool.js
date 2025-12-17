/**
 * LineTool - Create polylines with orthogonal segments
 * Implements: TOOL-23, OBJ-30 to OBJ-3A8
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.tools = AsciiEditor.tools || {};

AsciiEditor.tools.LineTool = class LineTool extends AsciiEditor.tools.Tool {
  constructor() {
    super('line');
    this.cursor = 'crosshair';
    this.drawing = false;
    this.points = [];           // Array of {x, y} committed points
    this.currentPos = null;     // Live cursor position for preview
    this.hFirst = true;         // OBJ-3A3: Posture - true = horizontal-first, false = vertical-first
  }

  activate(context) {
    this.drawing = false;
    this.points = [];
    this.currentPos = null;
    this.hFirst = true;
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

    // Create line object with committed points
    const newLine = {
      id: AsciiEditor.core.generateId(),
      type: 'line',
      points: this.points.map(p => ({ x: p.x, y: p.y })),
      style: 'single',
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

    // Reset tool state
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

  renderOverlay(ctx, context) {
    if (this.points.length === 0 && !this.currentPos) return;

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim() || '#007acc';

    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 1;

    const offsetX = context.grid.charWidth / 2;
    const offsetY = context.grid.charHeight / 2;

    // Draw committed segments
    if (this.points.length > 1) {
      ctx.setLineDash([]);
      ctx.beginPath();

      const firstPixel = context.grid.charToPixel(this.points[0].x, this.points[0].y);
      ctx.moveTo(firstPixel.x + offsetX, firstPixel.y + offsetY);

      for (let i = 1; i < this.points.length; i++) {
        const pixel = context.grid.charToPixel(this.points[i].x, this.points[i].y);
        ctx.lineTo(pixel.x + offsetX, pixel.y + offsetY);
      }
      ctx.stroke();
    }

    // Draw preview path from last anchor to cursor (dashed)
    if (this.drawing && this.currentPos && this.points.length > 0) {
      const anchor = this.points[this.points.length - 1];
      const previewPath = this.getPreviewPath(anchor, this.currentPos);

      if (previewPath.length > 1) {
        ctx.setLineDash([5, 3]);
        ctx.beginPath();

        const startPixel = context.grid.charToPixel(previewPath[0].x, previewPath[0].y);
        ctx.moveTo(startPixel.x + offsetX, startPixel.y + offsetY);

        for (let i = 1; i < previewPath.length; i++) {
          const pixel = context.grid.charToPixel(previewPath[i].x, previewPath[i].y);
          ctx.lineTo(pixel.x + offsetX, pixel.y + offsetY);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw point markers for committed points
    for (let i = 0; i < this.points.length; i++) {
      const pixel = context.grid.charToPixel(this.points[i].x, this.points[i].y);
      ctx.beginPath();
      ctx.arc(pixel.x + offsetX, pixel.y + offsetY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Point count and posture indicator
    if (this.points.length > 0) {
      ctx.font = '11px sans-serif';
      const lastPoint = this.points[this.points.length - 1];
      const labelPixel = context.grid.charToPixel(lastPoint.x, lastPoint.y);
      const postureLabel = this.hFirst ? 'H-V' : 'V-H';
      ctx.fillText(`${this.points.length} pts (${postureLabel})`, labelPixel.x + offsetX + 8, labelPixel.y + offsetY - 8);
    }
  }
};
