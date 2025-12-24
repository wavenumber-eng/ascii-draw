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

    // OBJ-6H: Extending from floating end - stores wire being extended
    this.extendingWire = null;      // { wireId, isStart } - which wire and which end
    this.extendingWireOriginal = null; // Original wire state for undo

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
    this.resetToolState();
    context.canvas.style.cursor = this.cursor;
  }

  deactivate() {
    this.resetToolState();
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
      // First point - check various starting scenarios
      const state = context.history.getState();
      const page = state.project.pages.find(p => p.id === state.activePageId);

      if (page) {
        // OBJ-6H: Check if starting from a floating wire end
        const floatingEnd = this.findFloatingWireEnd(clickPos, page.objects);
        if (floatingEnd) {
          // Start extending this wire - inherit its style and net
          this.extendingWire = { wireId: floatingEnd.wire.id, isStart: floatingEnd.isStart };
          this.extendingWireOriginal = JSON.parse(JSON.stringify(floatingEnd.wire));

          // Inherit style and net from existing wire
          this.style = floatingEnd.wire.style || 'single';
          this.netName = floatingEnd.wire.net || '';

          // Set posture based on wire direction at the floating end
          const wirePoints = floatingEnd.wire.points;
          if (floatingEnd.isStart && wirePoints.length >= 2) {
            // Extending from start - look at direction to second point
            const p0 = wirePoints[0];
            const p1 = wirePoints[1];
            this.hFirst = (p0.y === p1.y); // horizontal if first segment is horizontal
          } else if (!floatingEnd.isStart && wirePoints.length >= 2) {
            // Extending from end - look at direction from second-to-last
            const pLast = wirePoints[wirePoints.length - 1];
            const pPrev = wirePoints[wirePoints.length - 2];
            this.hFirst = (pLast.y === pPrev.y);
          }

          this.points.push(clickPos);
          this.drawing = true;
          this.currentPos = clickPos;
          return true;
        }

        // Check if starting on a symbol edge and set posture for clean exit
        const edgeInfo = this.findSymbolEdge(clickPos, page.objects);
        if (edgeInfo) {
          // Set posture based on pin edge for clean exit
          // Right/Left pins → horizontal first, Top/Bottom pins → vertical first
          this.hFirst = (edgeInfo.edge === 'right' || edgeInfo.edge === 'left');
        }
      }

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

      // Check if clicked point hits an existing wire or pin - auto-finish for connection
      const state = context.history.getState();
      const page = state.project.pages.find(p => p.id === state.activePageId);
      if (page) {
        // OBJ-6I: Check if ending on a floating wire end (join wires)
        const floatingEnd = this.findFloatingWireEnd(clickPos, page.objects);
        if (floatingEnd) {
          // Don't join to the same wire we're extending from
          if (!this.extendingWire || this.extendingWire.wireId !== floatingEnd.wire.id) {
            this.finishWireWithJoin(context, floatingEnd);
            return true;
          }
        }

        // Auto-finish on wire hit (creates junction)
        const wireHits = this.findWiresAtPoint(clickPos, page.objects);
        if (wireHits.length > 0) {
          this.finishWire(context);
          return true;
        }

        // Auto-finish on symbol edge (CREATE PIN or BIND PIN)
        const edgeInfo = this.findSymbolEdge(clickPos, page.objects);
        if (edgeInfo) {
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
      event.preventDefault();  // Prevent browser scroll
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
   * OBJ-6G: Find floating (unbound) wire endpoints at a given point
   * Returns { wire, isStart, point } or null
   */
  findFloatingWireEnd(point, objects) {
    for (const obj of objects) {
      if (obj.type !== 'wire' || !obj.points || obj.points.length < 2) continue;

      const start = obj.points[0];
      const end = obj.points[obj.points.length - 1];

      // Check start endpoint (floating if no startBinding)
      if (!obj.startBinding && start.x === point.x && start.y === point.y) {
        return { wire: obj, isStart: true, point: start };
      }

      // Check end endpoint (floating if no endBinding)
      if (!obj.endBinding && end.x === point.x && end.y === point.y) {
        return { wire: obj, isStart: false, point: end };
      }
    }
    return null;
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

    // OBJ-6H: Handle extending an existing wire
    if (this.extendingWire) {
      this.finishWireExtend(context, simplifiedPoints);
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
    this.resetToolState();

    // Switch to select tool
    if (context.setTool) {
      context.setTool('select');
    }
  }

  /**
   * OBJ-6H: Finish extending an existing wire from its floating end
   * The new segment inherits style/net from the existing wire
   */
  finishWireExtend(context, newPoints) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const existingWire = page.objects.find(o => o.id === this.extendingWire.wireId);
    if (!existingWire) {
      this.cancelWire();
      return;
    }

    // Build merged points
    let mergedPoints;
    if (this.extendingWire.isStart) {
      // Extending from start - new points go at the beginning, reversed
      // newPoints[0] is the floating end, newPoints[last] is where we extended to
      const reversed = newPoints.slice().reverse();
      // Skip the first point of existing (it's the same as last of reversed)
      mergedPoints = [...reversed.slice(0, -1), ...existingWire.points];
    } else {
      // Extending from end - new points go at the end
      // newPoints[0] is the floating end, newPoints[last] is where we extended to
      // Skip the first point of newPoints (it's the same as last of existing)
      mergedPoints = [...existingWire.points, ...newPoints.slice(1)];
    }

    // OBJ-6J: Simplify to remove collinear points including old floating endpoint
    mergedPoints = this.lineUtils.simplifyPoints(mergedPoints);

    // Check for binding at the new endpoint
    const newEndpoint = this.extendingWire.isStart ? mergedPoints[0] : mergedPoints[mergedPoints.length - 1];
    const newBinding = this.bindEndpointToPin(newEndpoint, context);

    // Build old and new props for the modify command
    const oldProps = {
      points: existingWire.points.map(p => ({ ...p })),
      startBinding: existingWire.startBinding,
      endBinding: existingWire.endBinding
    };

    const newProps = {
      points: mergedPoints.map(p => ({ x: p.x, y: p.y }))
    };

    // Update the appropriate binding
    if (this.extendingWire.isStart) {
      newProps.startBinding = newBinding;
      newProps.endBinding = existingWire.endBinding;
    } else {
      newProps.startBinding = existingWire.startBinding;
      newProps.endBinding = newBinding;
    }

    context.history.execute(new AsciiEditor.core.ModifyObjectCommand(
      state.activePageId,
      existingWire.id,
      oldProps,
      newProps
    ));

    // Select the extended wire
    context.history.updateState(s => ({
      ...s,
      selection: { ids: [existingWire.id], handles: null }
    }));

    this.resetToolState();

    if (context.setTool) {
      context.setTool('select');
    }
  }

  /**
   * OBJ-6I, OBJ-6K: Join wires when ending on a floating endpoint
   * The target wire gets merged into the new wire (new wire's style/net wins)
   */
  finishWireWithJoin(context, floatingEnd) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const targetWire = floatingEnd.wire;
    const simplifiedNewPoints = this.lineUtils.simplifyPoints(this.points);

    if (simplifiedNewPoints.length < 2) {
      this.cancelWire();
      return;
    }

    // Build merged points array
    let mergedPoints;
    let mergedStartBinding;
    let mergedEndBinding;

    if (this.extendingWire) {
      // We're extending one wire and joining to another - merge all three
      const sourceWire = page.objects.find(o => o.id === this.extendingWire.wireId);
      if (!sourceWire) {
        this.cancelWire();
        return;
      }

      // Complex merge: sourceWire + newPoints + targetWire
      if (this.extendingWire.isStart) {
        // Source wire's floating start → newPoints → target wire's floating end
        const reversedNew = simplifiedNewPoints.slice().reverse();
        if (floatingEnd.isStart) {
          // target start → ... → source end
          mergedPoints = [...targetWire.points.slice().reverse(), ...reversedNew.slice(1, -1), ...sourceWire.points];
          mergedStartBinding = targetWire.endBinding;
          mergedEndBinding = sourceWire.endBinding;
        } else {
          // source start ← ... ← target end
          mergedPoints = [...reversedNew.slice(0, -1), ...sourceWire.points.slice(1), ...targetWire.points.slice(1)];
          mergedStartBinding = sourceWire.startBinding;
          mergedEndBinding = targetWire.endBinding;
        }
      } else {
        // Source wire's floating end → newPoints → target wire
        if (floatingEnd.isStart) {
          // source → newPoints → target (reversed)
          mergedPoints = [...sourceWire.points, ...simplifiedNewPoints.slice(1, -1), ...targetWire.points];
          mergedStartBinding = sourceWire.startBinding;
          mergedEndBinding = targetWire.endBinding;
        } else {
          // source → newPoints → target end (target reversed)
          mergedPoints = [...sourceWire.points, ...simplifiedNewPoints.slice(1, -1), ...targetWire.points.slice().reverse()];
          mergedStartBinding = sourceWire.startBinding;
          mergedEndBinding = targetWire.startBinding;
        }
      }

      // Delete both old wires
      context.history.execute(new AsciiEditor.core.DeleteObjectCommand(state.activePageId, sourceWire));
      context.history.execute(new AsciiEditor.core.DeleteObjectCommand(state.activePageId, targetWire));

    } else {
      // Simple case: new wire joins to floating end of target
      if (floatingEnd.isStart) {
        // New wire ends at target's start - prepend new wire
        mergedPoints = [...simplifiedNewPoints.slice(0, -1), ...targetWire.points];
        // Check binding at new wire's start
        mergedStartBinding = this.bindEndpointToPin(simplifiedNewPoints[0], context);
        mergedEndBinding = targetWire.endBinding;
      } else {
        // New wire ends at target's end - append target wire reversed
        mergedPoints = [...simplifiedNewPoints.slice(0, -1), ...targetWire.points.slice().reverse()];
        mergedStartBinding = this.bindEndpointToPin(simplifiedNewPoints[0], context);
        mergedEndBinding = targetWire.startBinding;
      }

      // Delete the target wire
      context.history.execute(new AsciiEditor.core.DeleteObjectCommand(state.activePageId, targetWire));
    }

    // OBJ-6J: Simplify merged points to remove collinear vertices
    mergedPoints = this.lineUtils.simplifyPoints(mergedPoints);

    // Create the merged wire with new wire's style/net (OBJ-6I)
    const mergedWire = {
      id: AsciiEditor.core.generateId(),
      type: 'wire',
      points: mergedPoints.map(p => ({ x: p.x, y: p.y })),
      style: this.style,  // New wire's style wins
      net: this.netName,  // New wire's net wins
      startBinding: mergedStartBinding,
      endBinding: mergedEndBinding
    };

    context.history.execute(new AsciiEditor.core.CreateObjectCommand(state.activePageId, mergedWire));

    // Select the merged wire
    context.history.updateState(s => ({
      ...s,
      selection: { ids: [mergedWire.id], handles: null }
    }));

    this.resetToolState();

    if (context.setTool) {
      context.setTool('select');
    }
  }

  /**
   * Reset tool state to initial
   */
  resetToolState() {
    this.drawing = false;
    this.points = [];
    this.currentPos = null;
    this.hFirst = true;
    this.extendingWire = null;
    this.extendingWireOriginal = null;
    // Don't reset netName - keep it for subsequent wires
  }

  cancelWire() {
    this.resetToolState();
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

    // Detect hover targets - wire connections, floating ends, and symbol edges
    let wireHoverTarget = null;
    let pinHoverTarget = null;
    let floatingEndTarget = null;

    if (this.currentPos) {
      // OBJ-6G: Check for floating wire end first (highest priority)
      const floatingEnd = this.findFloatingWireEnd(this.currentPos, objects);
      if (floatingEnd) {
        // Don't show connect for the wire we're currently extending from
        if (!this.extendingWire || this.extendingWire.wireId !== floatingEnd.wire.id) {
          floatingEndTarget = { point: this.currentPos, wire: floatingEnd.wire };
        }
      }

      // Check for wire connection (mid-wire, creates junction)
      if (!floatingEndTarget) {
        const wireHits = this.findWiresAtPoint(this.currentPos, objects);
        if (wireHits.length > 0) {
          wireHoverTarget = { point: this.currentPos };
        }
      }

      // Check for symbol edge (pin creation)
      if (!floatingEndTarget && !wireHoverTarget) {
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
    }

    // OBJ-6G: Draw floating wire end indicator (CONNECT - joins wires)
    if (floatingEndTarget) {
      const pixel = grid.charToPixel(floatingEndTarget.point.x, floatingEndTarget.point.y);
      const cx = pixel.x + offsetX;
      const cy = pixel.y + offsetY;

      // Green connect indicator
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
      const label = this.drawing ? 'JOIN WIRE' : 'EXTEND WIRE';
      ctx.fillText(label, cx + 12, cy - 8);
    }

    // Draw wire connection indicator (mid-wire, creates junction)
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

    // Draw crosshair cursor when not drawing (skip if hovering over pin, wire, or floating end)
    if (!this.drawing && this.currentPos && !pinHoverTarget && !wireHoverTarget && !floatingEndTarget) {
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

    // Draw pin indicator on top of everything (so it's visible over wire path)
    if (pinHoverTarget) {
      const pixel = grid.charToPixel(pinHoverTarget.point.x, pinHoverTarget.point.y);
      const cx = pixel.x + offsetX;
      const cy = pixel.y + offsetY;

      const pinColor = pinHoverTarget.hasExistingPin ? accent : accentSecondary;

      // Filled circle background for visibility
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();

      // Pin circle
      ctx.strokeStyle = pinColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
};
