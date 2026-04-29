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
    context.setCursor(this.cursor);
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

    // Use col/row from event (viewport handles coordinate conversion)
    const col = event.col;
    const row = event.row;
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
    // Use col/row from event (viewport handles coordinate conversion)
    this.currentPos = { x: event.col, y: event.row };
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
      event.preventDefault();  // Prevent browser scroll
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


  renderOverlay(overlay, context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    const objects = page ? page.objects : [];

    // Hover-on-existing-line connection hint
    let hover = null;
    if (this.currentPos) {
      const lineHits = AsciiEditor.core.findLinesAtPoint(this.currentPos, objects);
      if (lineHits.length > 0) hover = this.currentPos;
    }
    if (hover) {
      overlay.drawConnectionRing(hover.x, hover.y, { label: 'CONNECT' });
    }

    if (!this.drawing && this.currentPos) {
      overlay.drawCrosshair(this.currentPos.x, this.currentPos.y);
    }

    if (this.points.length === 0 && !this.currentPos) return;

    // Build full preview path
    const allPoints = [...this.points];
    if (this.drawing && this.currentPos && this.points.length > 0) {
      const anchor = this.points[this.points.length - 1];
      const previewPath = this.getPreviewPath(anchor, this.currentPos);
      for (let i = 1; i < previewPath.length; i++) allPoints.push(previewPath[i]);
    }

    if (allPoints.length >= 2) {
      overlay.drawAsciiPath(allPoints, this.currentStyle.chars);
    }

    // Committed point markers
    for (const p of this.points) overlay.drawDot(p.x, p.y);

    // Status indicator
    if (this.points.length > 0) {
      const last = this.points[this.points.length - 1];
      const posture = this.hFirst ? 'H-V' : 'V-H';
      const styleInfo = `${this.currentStyle.hotkey}:${this.currentStyle.label}`;
      overlay.drawStatusLabel(last.x, last.y,
        `${this.points.length}pts ${posture} [${styleInfo}]`);
    }
  }
};
