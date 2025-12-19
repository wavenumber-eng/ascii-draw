/**
 * WireTool - Create wires with electrical connectivity semantics
 * Implements: TOOL-28 series
 * Shares core utilities with LineTool via AsciiEditor.core.lineUtils
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.tools = AsciiEditor.tools || {};

AsciiEditor.tools.WireTool = class WireTool extends AsciiEditor.tools.Tool {
  constructor() {
    super('wire');
    this.cursor = 'none';
    this.drawing = false;
    this.points = [];
    this.currentPos = null;
    this.hFirst = true;
    this.styleIndex = 0;
    this.netName = '';  // Wire-specific: net label

    // Reference shared utilities
    this.lineUtils = AsciiEditor.core.lineUtils;
    this.styles = this.lineUtils.styles;
  }

  // Get current style object
  get currentStyle() {
    return this.styles[this.styleIndex];
  }

  // Get current style key
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
    context.canvas.style.cursor = this.cursor;
  }

  deactivate() {
    this.drawing = false;
    this.points = [];
    this.currentPos = null;
  }

  /**
   * Calculate preview points from anchor to cursor
   */
  getPreviewPath(anchor, cursor) {
    return this.lineUtils.getPreviewPath(anchor, cursor, this.hFirst);
  }

  onMouseDown(event, context) {
    // Right-click finishes the wire
    if (event.button === 2) {
      if (this.drawing && this.points.length >= 2) {
        this.finishWire(context);
      }
      return true;
    }

    if (event.button !== 0) return false;

    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
    const clickPos = { x: col, y: row };

    if (!this.drawing) {
      // First point
      this.points.push(clickPos);
      this.drawing = true;
      this.currentPos = clickPos;
    } else {
      // Subsequent points
      const anchor = this.points[this.points.length - 1];
      const previewPath = this.getPreviewPath(anchor, clickPos);

      for (let i = 1; i < previewPath.length; i++) {
        this.points.push(previewPath[i]);
      }

      // Check if clicked point hits an existing wire - auto-finish for connection
      const state = context.history.getState();
      const page = state.project.pages.find(p => p.id === state.activePageId);
      if (page) {
        const hits = this.findWiresAtPoint(clickPos, page.objects);
        if (hits.length > 0) {
          this.finishWire(context);
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
    return true;
  }

  onMouseUp(event, context) {
    return false;
  }

  onDoubleClick(event, context) {
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

    // Space key toggles posture
    if (event.key === ' ' || event.code === 'Space') {
      if (this.drawing) {
        this.hFirst = !this.hFirst;
        return true;
      }
    }

    if (this.drawing) {
      // Enter finishes the wire
      if (event.key === 'Enter') {
        if (this.points.length >= 2) {
          this.finishWire(context);
        }
        return true;
      }

      // Escape cancels
      if (event.key === 'Escape') {
        this.cancelWire();
        return true;
      }

      // Backspace removes last point
      if (event.key === 'Backspace') {
        if (this.points.length > 1) {
          this.points.pop();
        } else if (this.points.length === 1) {
          this.cancelWire();
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Find wires at a given point (for connection detection)
   */
  findWiresAtPoint(point, objects) {
    const results = [];
    for (const obj of objects) {
      if (obj.type === 'wire') {
        const hitInfo = this.lineUtils.findPointOnLine(point, obj);
        if (hitInfo) {
          results.push({ object: obj, hitInfo });
        }
      }
    }
    return results;
  }

  /**
   * OBJ-65: Find if a point is on a symbol edge
   * Returns { symbol, edge, offset, position } or null
   */
  findSymbolEdge(point, objects) {
    const symbols = objects.filter(o => o.type === 'symbol');

    for (const symbol of symbols) {
      const { x, y, width, height } = symbol;

      // Check left edge (excluding corners)
      if (point.x === x && point.y > y && point.y < y + height - 1) {
        const offset = height > 2 ? (point.y - y) / (height - 1) : 0.5;
        return { symbol, edge: 'left', offset, position: point };
      }

      // Check right edge (excluding corners)
      if (point.x === x + width - 1 && point.y > y && point.y < y + height - 1) {
        const offset = height > 2 ? (point.y - y) / (height - 1) : 0.5;
        return { symbol, edge: 'right', offset, position: point };
      }

      // Check top edge (excluding corners)
      if (point.y === y && point.x > x && point.x < x + width - 1) {
        const offset = width > 2 ? (point.x - x) / (width - 1) : 0.5;
        return { symbol, edge: 'top', offset, position: point };
      }

      // Check bottom edge (excluding corners)
      if (point.y === y + height - 1 && point.x > x && point.x < x + width - 1) {
        const offset = width > 2 ? (point.x - x) / (width - 1) : 0.5;
        return { symbol, edge: 'bottom', offset, position: point };
      }
    }

    return null;
  }

  /**
   * OBJ-66: Find existing pin at a symbol edge position
   */
  findPinAtEdge(symbol, edge, offset) {
    if (!symbol.pins) return null;

    const tolerance = 0.05; // Allow small offset tolerance
    return symbol.pins.find(pin =>
      pin.edge === edge && Math.abs(pin.offset - offset) < tolerance
    );
  }

  /**
   * OBJ-67: Get pin position from edge and offset
   */
  getPinPosition(symbol, pin) {
    const { x, y, width, height } = symbol;
    const offset = pin.offset || 0.5;

    switch (pin.edge) {
      case 'left':
        return { x: x, y: Math.floor(y + offset * (height - 1)) };
      case 'right':
        return { x: x + width - 1, y: Math.floor(y + offset * (height - 1)) };
      case 'top':
        return { x: Math.floor(x + offset * (width - 1)), y: y };
      case 'bottom':
        return { x: Math.floor(x + offset * (width - 1)), y: y + height - 1 };
      default:
        return { x: x, y: y };
    }
  }

  /**
   * OBJ-68: Bind wire endpoint to pin, auto-creating pin if needed
   * Returns { symbolId, pinId } or null
   */
  bindEndpointToPin(point, context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return null;

    const edgeInfo = this.findSymbolEdge(point, page.objects);
    if (!edgeInfo) return null;

    const { symbol, edge, offset } = edgeInfo;

    // Check for existing pin
    let pin = this.findPinAtEdge(symbol, edge, offset);

    if (!pin) {
      // TOOL-28F: Auto-create pin at wire endpoint
      pin = {
        id: AsciiEditor.core.generateId(),
        name: '',
        edge: edge,
        offset: offset,
        shape: 'circle-outline',
        direction: 'bidirectional'
      };

      // Add pin to symbol
      const updatedPins = [...(symbol.pins || []), pin];
      context.history.execute(new AsciiEditor.core.ModifyObjectCommand(
        state.activePageId,
        symbol.id,
        { pins: symbol.pins || [] },
        { pins: updatedPins }
      ));
    }

    return { symbolId: symbol.id, pinId: pin.id };
  }

  finishWire(context) {
    if (this.points.length < 2) {
      this.cancelWire();
      return;
    }

    const state = context.history.getState();
    const simplifiedPoints = this.lineUtils.simplifyPoints(this.points);

    if (simplifiedPoints.length < 2) {
      this.cancelWire();
      return;
    }

    // OBJ-65 to OBJ-69: Check for pin bindings at endpoints
    const startPoint = simplifiedPoints[0];
    const endPoint = simplifiedPoints[simplifiedPoints.length - 1];

    const startBinding = this.bindEndpointToPin(startPoint, context);
    const endBinding = this.bindEndpointToPin(endPoint, context);

    // Create wire object with bindings
    const newWire = {
      id: AsciiEditor.core.generateId(),
      type: 'wire',
      points: simplifiedPoints.map(p => ({ x: p.x, y: p.y })),
      style: this.style,
      net: this.netName,
      startBinding: startBinding,
      endBinding: endBinding
    };

    context.history.execute(
      new AsciiEditor.core.CreateObjectCommand(state.activePageId, newWire)
    );

    // Select the new wire
    context.history.updateState(s => ({
      ...s,
      selection: { ids: [newWire.id], handles: null }
    }));

    // Reset tool state
    this.drawing = false;
    this.points = [];
    this.currentPos = null;
    this.hFirst = true;
    // Don't reset netName - keep it for subsequent wires

    // Switch to select tool
    if (context.setTool) {
      context.setTool('select');
    }
  }

  cancelWire() {
    this.drawing = false;
    this.points = [];
    this.currentPos = null;
    this.hFirst = true;
  }

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

    // Detect hover targets - wire connections and symbol edges
    let wireHoverTarget = null;
    let pinHoverTarget = null;

    if (this.currentPos) {
      // Check for wire connection
      const wireHits = this.findWiresAtPoint(this.currentPos, objects);
      if (wireHits.length > 0) {
        wireHoverTarget = { point: this.currentPos };
      }

      // Check for symbol edge (pin creation)
      const edgeInfo = this.findSymbolEdge(this.currentPos, objects);
      if (edgeInfo) {
        // Check if pin already exists at this location
        const existingPin = this.findPinAtEdge(edgeInfo.symbol, edgeInfo.edge, edgeInfo.offset);
        pinHoverTarget = {
          point: this.currentPos,
          hasExistingPin: !!existingPin,
          symbol: edgeInfo.symbol
        };
      }
    }

    // Draw wire connection indicator
    if (wireHoverTarget) {
      const pixel = grid.charToPixel(wireHoverTarget.point.x, wireHoverTarget.point.y);
      const cx = pixel.x + offsetX;
      const cy = pixel.y + offsetY;

      ctx.strokeStyle = accentSecondary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 170, 102, 0.4)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '10px sans-serif';
      ctx.fillStyle = accentSecondary;
      ctx.fillText('CONNECT', cx + 12, cy - 8);
    }

    // Draw pin creation/connection indicator on symbol edge
    if (pinHoverTarget && !wireHoverTarget) {
      const pixel = grid.charToPixel(pinHoverTarget.point.x, pinHoverTarget.point.y);
      const cx = pixel.x + offsetX;
      const cy = pixel.y + offsetY;

      // Use different style for existing pin vs new pin
      const pinColor = pinHoverTarget.hasExistingPin ? accent : accentSecondary;
      const label = pinHoverTarget.hasExistingPin ? 'BIND PIN' : 'CREATE PIN';

      // Glowing ring
      ctx.strokeStyle = pinColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.stroke();

      // Outer glow
      ctx.strokeStyle = pinHoverTarget.hasExistingPin ? 'rgba(0, 122, 204, 0.4)' : 'rgba(0, 170, 102, 0.4)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.stroke();

      // Label
      ctx.font = '10px sans-serif';
      ctx.fillStyle = pinColor;
      ctx.fillText(label, cx + 12, cy - 8);
    }

    // Draw crosshair cursor when not drawing
    if (!this.drawing && this.currentPos) {
      const pixel = grid.charToPixel(this.currentPos.x, this.currentPos.y);
      const cx = pixel.x + offsetX;
      const cy = pixel.y + offsetY;

      ctx.strokeStyle = accentSecondary;  // Green for wires
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx, cy + 8);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - 8, cy);
      ctx.lineTo(cx + 8, cy);
      ctx.stroke();
    }

    if (this.points.length === 0 && !this.currentPos) return;

    ctx.font = '16px BerkeleyMono, monospace';
    ctx.textBaseline = 'top';

    const chars = this.currentStyle.chars;

    // Build complete preview path
    let allPoints = [...this.points];
    if (this.drawing && this.currentPos && this.points.length > 0) {
      const anchor = this.points[this.points.length - 1];
      const previewPath = this.getPreviewPath(anchor, this.currentPos);
      for (let i = 1; i < previewPath.length; i++) {
        allPoints.push(previewPath[i]);
      }
    }

    // Draw ASCII characters for the path
    if (allPoints.length >= 2) {
      this.drawLineSegments(ctx, allPoints, chars, grid, textColor);
    }

    // Draw point markers
    ctx.fillStyle = accentSecondary;
    for (let i = 0; i < this.points.length; i++) {
      const pixel = grid.charToPixel(this.points[i].x, this.points[i].y);
      ctx.beginPath();
      ctx.arc(pixel.x + offsetX, pixel.y + offsetY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Status indicator
    if (this.points.length > 0) {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = accentSecondary;
      const lastPoint = this.points[this.points.length - 1];
      const labelPixel = grid.charToPixel(lastPoint.x, lastPoint.y);
      const postureLabel = this.hFirst ? 'H-V' : 'V-H';
      const styleInfo = `${this.currentStyle.hotkey}:${this.currentStyle.label}`;
      const netInfo = this.netName ? ` net:${this.netName}` : '';
      ctx.fillText(`${this.points.length}pts ${postureLabel} [${styleInfo}]${netInfo}`, labelPixel.x + offsetX + 8, labelPixel.y + offsetY - 8);
    }
  }
};
