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

    // Domain modules for clean separation
    this.LineDomain = AsciiEditor.domain.Line;
    this.SymbolDomain = AsciiEditor.domain.Symbol;
    this.WireDomain = AsciiEditor.domain.Wire;
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
    context.setCursor(this.cursor);
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

    // Use col/row from event (viewport handles coordinate conversion)
    const col = event.col;
    const row = event.row;
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
    // Use col/row from event (viewport handles coordinate conversion)
    this.currentPos = { x: event.col, y: event.row };
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
   * Delegates to domain.Line.findLinesAtPoint with wire type filter
   */
  findWiresAtPoint(point, objects) {
    return this.LineDomain.findLinesAtPoint(point, objects)
      .filter(hit => hit.object.type === 'wire');
  }

  /**
   * OBJ-6G: Find floating (unbound) wire endpoints at a given point
   * Delegates to domain.Wire.findFloatingEndpointAtPoint
   * @returns { wire, isStart, point } or null
   */
  findFloatingWireEnd(point, objects) {
    return this.WireDomain.findFloatingEndpointAtPoint(point.x, point.y, objects);
  }

  /**
   * OBJ-65: Find if a point is on a symbol edge
   * Delegates to domain.Symbol.findSymbolEdgeAtPoint
   * @returns { symbol, edge, offset, position } or null
   */
  findSymbolEdge(point, objects) {
    return this.SymbolDomain.findSymbolEdgeAtPoint(point.x, point.y, objects);
  }

  /**
   * OBJ-66: Find existing pin at a symbol edge position
   * Delegates to domain.Symbol.findPinAtEdge
   */
  findPinAtEdge(symbol, edge, offset) {
    return this.SymbolDomain.findPinAtEdge(symbol, edge, offset);
  }

  /**
   * OBJ-67: Get pin position from edge and offset
   * Delegates to domain.Symbol.getPinPosition
   */
  getPinPosition(symbol, pin) {
    const pos = this.SymbolDomain.getPinPosition(symbol, pin);
    // Convert {col, row} to {x, y} for compatibility
    return { x: pos.col, y: pos.row };
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


  renderOverlay(overlay, context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    const objects = page ? page.objects : [];

    const cssStyles = getComputedStyle(document.documentElement);
    const accent = cssStyles.getPropertyValue('--accent').trim() || '#007acc';
    const accentSecondary = cssStyles.getPropertyValue('--accent-secondary').trim() || '#00aa66';

    // Detect hover targets — floating end > wire > symbol edge
    let floatingEnd = null;
    let wireHover = null;
    let pinHover = null;
    if (this.currentPos) {
      const fe = this.findFloatingWireEnd(this.currentPos, objects);
      if (fe && (!this.extendingWire || this.extendingWire.wireId !== fe.wire.id)) {
        floatingEnd = { point: this.currentPos, wire: fe.wire };
      }
      if (!floatingEnd && this.findWiresAtPoint(this.currentPos, objects).length > 0) {
        wireHover = { point: this.currentPos };
      }
      if (!floatingEnd && !wireHover) {
        const edgeInfo = this.findSymbolEdge(this.currentPos, objects);
        if (edgeInfo) {
          const existingPin = this.findPinAtEdge(edgeInfo.symbol, edgeInfo.edge, edgeInfo.offset);
          pinHover = { point: this.currentPos, hasExistingPin: !!existingPin };
        }
      }
    }

    if (floatingEnd) {
      overlay.drawConnectionRing(floatingEnd.point.x, floatingEnd.point.y, {
        color: accentSecondary,
        label: this.drawing ? 'JOIN WIRE' : 'EXTEND WIRE'
      });
    }
    if (wireHover) {
      overlay.drawConnectionRing(wireHover.point.x, wireHover.point.y, {
        color: accentSecondary,
        label: 'CONNECT'
      });
    }
    if (pinHover && !wireHover) {
      const color = pinHover.hasExistingPin ? accent : accentSecondary;
      overlay.drawConnectionRing(pinHover.point.x, pinHover.point.y, {
        color,
        label: pinHover.hasExistingPin ? 'BIND PIN' : 'CREATE PIN'
      });
    }

    if (!this.drawing && this.currentPos && !pinHover && !wireHover && !floatingEnd) {
      overlay.drawCrosshair(this.currentPos.x, this.currentPos.y, { color: accentSecondary });
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

    for (const p of this.points) overlay.drawDot(p.x, p.y, { color: accentSecondary });

    if (this.points.length > 0) {
      const last = this.points[this.points.length - 1];
      const posture = this.hFirst ? 'H-V' : 'V-H';
      const styleInfo = `${this.currentStyle.hotkey}:${this.currentStyle.label}`;
      const netInfo = this.netName ? ` net:${this.netName}` : '';
      overlay.drawStatusLabel(last.x, last.y,
        `${this.points.length}pts ${posture} [${styleInfo}]${netInfo}`,
        { color: accentSecondary });
    }

    // Pin indicator on top with center dot for visibility over wire path
    if (pinHover) {
      const color = pinHover.hasExistingPin ? accent : accentSecondary;
      overlay.drawConnectionRing(pinHover.point.x, pinHover.point.y, {
        color, withCenterDot: true
      });
    }
  }
};
