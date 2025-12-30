/**
 * SelectTool - Selection, movement, resize of objects
 * Implements: TOOL-20, SEL-1 to SEL-23
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.tools = AsciiEditor.tools || {};

// Interaction modes for SelectTool
const SelectMode = {
  NONE: 'none',
  DRAGGING: 'dragging',           // Moving selected object(s)
  MARQUEE: 'marquee',             // Drawing selection rectangle
  RESIZING: 'resizing',           // Resizing single object (boxes)
  LINE_POINT: 'line_point',       // Dragging a line vertex
  LINE_SEGMENT: 'line_segment',   // Dragging a line segment midpoint
  PIN_DRAG: 'pin_drag',           // Dragging a pin along symbol edge
  LABEL_DRAG: 'label_drag'        // Dragging a designator or parameter label
};

// Resize handle positions
const HandlePosition = {
  TOP_LEFT: 'tl',
  TOP_RIGHT: 'tr',
  BOTTOM_LEFT: 'bl',
  BOTTOM_RIGHT: 'br'
};

// Make these available globally for other modules
AsciiEditor.tools.SelectMode = SelectMode;
AsciiEditor.tools.HandlePosition = HandlePosition;

AsciiEditor.tools.SelectTool = class SelectTool extends AsciiEditor.tools.Tool {
  constructor() {
    super('select');
    this.cursor = 'default';
    this.mode = SelectMode.NONE;
    this.dragStart = null;
    this.dragCurrent = null;

    // Domain modules for clean separation
    this.LineDomain = AsciiEditor.domain.Line;
    this.SymbolDomain = AsciiEditor.domain.Symbol;
    this.WireDomain = AsciiEditor.domain.Wire;
    // Line point dragging state
    this.linePointIndex = null;       // Index of point being dragged
    this.lineOriginalPoints = null;   // Original points array for undo
    this.lineOriginalBinding = null;  // OBJ-69: Original binding for endpoint drag
    // Pin dragging state
    this.pinDragSymbolId = null;      // Symbol containing the pin
    this.pinDragPinId = null;         // Pin being dragged
    this.pinOriginal = null;          // Original pin data for undo
    // Label dragging state (designator/parameters)
    this.labelDragSymbolId = null;    // Parent symbol ID
    this.labelDragType = null;        // 'designator' or 'parameter'
    this.labelDragParamIndex = null;  // For parameters, which index
    this.labelOriginalOffset = null;  // Original offset for undo
    // Line segment dragging state
    this.lineSegmentIndex = null;     // Index of segment being dragged (segment between points i and i+1)
    this.lineSegmentIsHorizontal = null; // True if segment is horizontal
    // Vertex drag indicator state (for visual feedback)
    this.vertexDragIndicator = null;  // { type: 'bind'|'create', pos: {x,y}, pinId?, symbolId? }
    // Segment drag pin movement state
    this.segmentDragPinInfo = null;   // { symbolId, pinId, newEdge, newOffset, newPos }
    this.segmentDragPinCollision = false; // True if moved pin would collide with another
    this.draggedIds = [];
    this.originalPositions = {};
    this.activeHandle = null;
    this.resizeOriginal = null;
    this.addToSelection = false;  // Ctrl key held
    this.altKeyHeld = false;       // OBJ-68: Alt key breaks wire bindings during drag
  }

  activate(context) {
    this.resetState();
    context.canvas.style.cursor = this.cursor;
  }

  deactivate() {
    this.resetState();
  }

  resetState() {
    this.mode = SelectMode.NONE;
    this.dragStart = null;
    this.dragCurrent = null;
    this.draggedIds = [];
    this.originalPositions = {};
    this.activeHandle = null;
    this.resizeOriginal = null;
    this.addToSelection = false;
    this.linePointIndex = null;
    this.lineOriginalPoints = null;
    this.lineOriginalBinding = null;
    this.lineSegmentIndex = null;
    this.lineSegmentIsHorizontal = null;
    this.pinDragSymbolId = null;
    this.pinDragPinId = null;
    this.pinOriginal = null;
    this.labelDragSymbolId = null;
    this.labelDragType = null;
    this.labelDragParamIndex = null;
    this.labelOriginalOffset = null;
    this.altKeyHeld = false;
    // Clear drag indicators
    this.vertexDragIndicator = null;
    this.segmentDragPinInfo = null;
    this.segmentDragPinCollision = false;
    this.segmentDragOriginalPin = null;
  }

  onMouseDown(event, context) {
    // Ignore right-click - let Editor handle it for panning
    if (event.button === 2) return false;

    // Use col/row from event (viewport handles coordinate conversion)
    const col = event.col;
    const row = event.row;
    // Use content-space pixels for sub-cell precision
    const pixelX = event.pixelX;
    const pixelY = event.pixelY;
    const state = context.history.getState();
    this.addToSelection = event.ctrlKey;
    this.dragStart = { col, row, pixelX, pixelY };
    this.dragCurrent = { col, row, pixelX, pixelY };

    // Check for resize handle hit (single selection only) - SEL-22
    if (state.selection.ids.length === 1) {
      const handle = this.hitTestHandle(pixelX, pixelY, context);
      if (handle) {
        if (handle.type === 'line_point') {
          // Start dragging a line vertex
          this.mode = SelectMode.LINE_POINT;
          this.linePointIndex = handle.pointIndex;
          this.lineOriginalPoints = handle.obj.points.map(p => ({ ...p }));
          // OBJ-69: Store original binding if dragging a wire endpoint
          if (handle.obj.type === 'wire') {
            const isStart = handle.pointIndex === 0;
            const isEnd = handle.pointIndex === handle.obj.points.length - 1;
            if (isStart && handle.obj.startBinding) {
              this.lineOriginalBinding = { type: 'start', binding: { ...handle.obj.startBinding } };
            } else if (isEnd && handle.obj.endBinding) {
              this.lineOriginalBinding = { type: 'end', binding: { ...handle.obj.endBinding } };
            } else {
              this.lineOriginalBinding = null;
            }
          } else {
            this.lineOriginalBinding = null;
          }
          return true;
        } else if (handle.type === 'line_segment') {
          // Start dragging a line segment
          this.mode = SelectMode.LINE_SEGMENT;
          this.lineSegmentIndex = handle.segmentIndex;
          this.lineSegmentIsHorizontal = handle.isHorizontal;
          this.lineOriginalPoints = handle.obj.points.map(p => ({ ...p }));

          // Store original pin state if this is a wire with bound endpoint on this segment
          this.segmentDragOriginalPin = null;
          if (handle.obj.type === 'wire') {
            const lastSegmentIndex = handle.obj.points.length - 2;
            let binding = null;

            if (handle.segmentIndex === 0 && handle.obj.startBinding) {
              binding = handle.obj.startBinding;
            } else if (handle.segmentIndex === lastSegmentIndex && handle.obj.endBinding) {
              binding = handle.obj.endBinding;
            }

            if (binding) {
              const pg = state.project.pages.find(p => p.id === state.activePageId);
              if (pg) {
                const symbol = pg.objects.find(o => o.id === binding.symbolId);
                if (symbol && symbol.pins) {
                  const pin = symbol.pins.find(p => p.id === binding.pinId);
                  if (pin) {
                    this.segmentDragOriginalPin = {
                      symbolId: symbol.id,
                      pinId: pin.id,
                      edge: pin.edge,
                      offset: pin.offset
                    };
                  }
                }
              }
            }
          }
          return true;
        } else if (handle.type === 'box_corner') {
          // Start resizing a box
          this.mode = SelectMode.RESIZING;
          this.activeHandle = handle.position;
          this.resizeOriginal = { ...handle.obj };
          return true;
        }
      }
    }

    // Check for label hit (designator/parameter - before pins and objects)
    const labelHit = this.hitTestLabel(col, row, context);
    if (labelHit) {
      this.mode = SelectMode.LABEL_DRAG;
      this.labelDragSymbolId = labelHit.symbolId;
      this.labelDragType = labelHit.type;
      this.labelDragParamIndex = labelHit.paramIndex;
      this.labelOriginalOffset = { ...labelHit.offset };
      this.dragStart = { col, row };

      // Select the parent symbol AND track the selected label
      context.history.updateState(s => ({
        ...s,
        selection: {
          ids: [labelHit.symbolId],
          handles: null,
          pinIds: [],
          labelType: labelHit.type,
          labelParamIndex: labelHit.paramIndex
        }
      }));
      return true;
    }

    // Check for pin hit (before object hit so pins take priority)
    const pinHit = this.hitTestPin(col, row, context);
    if (pinHit) {
      this.mode = SelectMode.PIN_DRAG;
      this.pinDragSymbolId = pinHit.symbolId;
      this.pinDragPinId = pinHit.pinId;
      this.pinOriginal = { ...pinHit.pin };
      this.dragStart = { col, row };

      // Multi-select pins with Ctrl+click
      if (event.ctrlKey) {
        const currentPinIds = state.selection.pinIds || [];
        const isAlreadySelected = currentPinIds.includes(pinHit.pinId);

        if (isAlreadySelected) {
          // Remove from selection
          context.history.updateState(s => ({
            ...s,
            selection: {
              ...s.selection,
              pinIds: currentPinIds.filter(id => id !== pinHit.pinId),
              labelType: null,
              labelParamIndex: null
            }
          }));
        } else {
          // Add to selection (must be same parent symbol for now)
          const newPinIds = state.selection.ids.includes(pinHit.symbolId)
            ? [...currentPinIds, pinHit.pinId]
            : [pinHit.pinId];
          const newSymbolIds = state.selection.ids.includes(pinHit.symbolId)
            ? state.selection.ids
            : [pinHit.symbolId];

          context.history.updateState(s => ({
            ...s,
            selection: {
              ids: newSymbolIds,
              handles: null,
              pinIds: newPinIds,
              labelType: null,
              labelParamIndex: null
            }
          }));
        }
      } else {
        // Single pin selection
        context.history.updateState(s => ({
          ...s,
          selection: { ids: [pinHit.symbolId], handles: null, pinIds: [pinHit.pinId], labelType: null, labelParamIndex: null }
        }));
      }
      return true;
    }

    // Check for object hit
    const hit = this.hitTestObject(col, row, context);

    if (hit) {
      const isAlreadySelected = state.selection.ids.includes(hit.id);

      if (event.ctrlKey) {
        // SEL-11: Ctrl+click to toggle selection
        if (isAlreadySelected) {
          context.history.updateState(s => ({
            ...s,
            selection: {
              ids: s.selection.ids.filter(id => id !== hit.id),
              handles: null,
              pinIds: [],
              labelType: null,
              labelParamIndex: null
            }
          }));
        } else {
          context.history.updateState(s => ({
            ...s,
            selection: {
              ids: [...s.selection.ids, hit.id],
              handles: null,
              pinIds: [],
              labelType: null,
              labelParamIndex: null
            }
          }));
        }
      } else {
        // SEL-10: Regular click - select this object (clear pin/label selection)
        if (!isAlreadySelected) {
          context.history.updateState(s => ({
            ...s,
            selection: { ids: [hit.id], handles: null, pinIds: [], labelType: null, labelParamIndex: null }
          }));
        } else {
          // Clear pin/label selection when clicking on already-selected object
          context.history.updateState(s => ({
            ...s,
            selection: { ...s.selection, pinIds: [], labelType: null, labelParamIndex: null }
          }));
        }
      }

      // Prepare for dragging
      this.mode = SelectMode.DRAGGING;
      this.altKeyHeld = event.altKey;  // OBJ-68: Track alt key for breaking wire bindings
      const currentState = context.history.getState();
      this.draggedIds = [...currentState.selection.ids];

      // Store original positions of all selected objects
      const page = currentState.project.pages.find(p => p.id === currentState.activePageId);
      if (page) {
        this.originalPositions = {};
        this.originalWireEndpoints = {}; // OBJ-69: Store original wire endpoints for rubberbanding

        this.draggedIds.forEach(id => {
          const obj = page.objects.find(o => o.id === id);
          if (obj) {
            this.originalPositions[id] = { x: obj.x, y: obj.y };

            // OBJ-67: Store original wire state for rubberbanding (full points for proper restore)
            if (obj.type === 'symbol') {
              const boundWires = this.findWiresBoundToSymbol(id, page.objects);
              boundWires.forEach(wire => {
                if (!this.originalWireEndpoints[wire.id]) {
                  this.originalWireEndpoints[wire.id] = {
                    start: wire.points[0] ? { x: wire.points[0].x, y: wire.points[0].y } : null,
                    end: wire.points[wire.points.length - 1] ? { x: wire.points[wire.points.length - 1].x, y: wire.points[wire.points.length - 1].y } : null,
                    allPoints: wire.points.map(p => ({ x: p.x, y: p.y }))
                  };
                }
              });
            }
          }
        });
      }
    } else {
      // SEL-12: Click on empty space - deselect or start marquee
      if (!event.ctrlKey) {
        context.history.updateState(s => ({
          ...s,
          selection: { ids: [], handles: null, pinIds: [], labelType: null, labelParamIndex: null }
        }));
      }
      this.mode = SelectMode.MARQUEE;
    }

    return true;
  }

  onMouseMove(event, context) {
    // Use col/row from event (viewport handles coordinate conversion)
    const col = event.col;
    const row = event.row;
    // Use content-space pixels for sub-cell precision
    const pixelX = event.pixelX;
    const pixelY = event.pixelY;
    this.dragCurrent = { col, row, pixelX, pixelY };

    if (this.mode === SelectMode.DRAGGING && this.draggedIds.length > 0) {
      // Move all selected objects
      const dx = col - this.dragStart.col;
      const dy = row - this.dragStart.row;

      context.history.updateState(state => {
        const newState = AsciiEditor.core.deepClone(state);
        const page = newState.project.pages.find(p => p.id === state.activePageId);
        if (page) {
          this.draggedIds.forEach(id => {
            const obj = page.objects.find(o => o.id === id);
            const orig = this.originalPositions[id];
            if (obj && orig) {
              obj.x = orig.x + dx;
              obj.y = orig.y + dy;

              // OBJ-67: Update bound wire endpoints when symbol moves
              // OBJ-68: Skip if Alt key held (breaks binding)
              if (obj.type === 'symbol' && !this.altKeyHeld) {
                this.updateBoundWireEndpoints(page, id, dx, dy);
              }
            }
          });
        }
        return newState;
      });
      return true;
    }

    if (this.mode === SelectMode.RESIZING && this.resizeOriginal) {
      this.performResize(col, row, context);
      return true;
    }

    if (this.mode === SelectMode.LINE_POINT && this.linePointIndex !== null) {
      this.performLinePointDrag(col, row, context);
      return true;
    }

    if (this.mode === SelectMode.LINE_SEGMENT && this.lineSegmentIndex !== null) {
      this.performLineSegmentDrag(col, row, context);
      return true;
    }

    if (this.mode === SelectMode.PIN_DRAG && this.pinDragSymbolId) {
      this.performPinDrag(col, row, context);
      return true;
    }

    if (this.mode === SelectMode.LABEL_DRAG && this.labelDragSymbolId) {
      this.performLabelDrag(col, row, context);
      return true;
    }

    if (this.mode === SelectMode.MARQUEE) {
      return true;  // Just redraw to show marquee
    }

    // Update cursor based on what's under mouse
    const state = context.history.getState();
    if (state.selection.ids.length === 1) {
      const handle = this.hitTestHandle(pixelX, pixelY, context);
      if (handle) {
        if (handle.type === 'line_point') {
          context.canvas.style.cursor = 'move';
        } else if (handle.type === 'line_segment') {
          // Show appropriate cursor based on segment direction
          context.canvas.style.cursor = handle.isHorizontal ? 'ns-resize' : 'ew-resize';
        } else {
          context.canvas.style.cursor = this.getHandleCursor(handle.position);
        }
        return false;
      }
    }

    const hit = this.hitTestObject(col, row, context);
    context.canvas.style.cursor = hit ? 'move' : 'default';

    return false;
  }

  onMouseUp(event, context) {
    // Use col/row from event (viewport handles coordinate conversion)
    const col = event.col;
    const row = event.row;

    if (this.mode === SelectMode.DRAGGING && this.draggedIds.length > 0) {
      const dx = col - this.dragStart.col;
      const dy = row - this.dragStart.row;

      if (dx !== 0 || dy !== 0) {
        // Restore original positions first (including wire endpoints)
        context.history.updateState(state => {
          const newState = AsciiEditor.core.deepClone(state);
          const page = newState.project.pages.find(p => p.id === state.activePageId);
          if (page) {
            // Restore object positions
            this.draggedIds.forEach(id => {
              const obj = page.objects.find(o => o.id === id);
              const orig = this.originalPositions[id];
              if (obj && orig) {
                obj.x = orig.x;
                obj.y = orig.y;
              }
            });

            // OBJ-67: Restore full wire points array
            if (this.originalWireEndpoints) {
              for (const wireId in this.originalWireEndpoints) {
                const wire = page.objects.find(o => o.id === wireId);
                const orig = this.originalWireEndpoints[wireId];
                if (wire && orig && orig.allPoints) {
                  // Restore full points array
                  wire.points = orig.allPoints.map(p => ({ x: p.x, y: p.y }));
                }
              }
            }
          }
          return newState;
        });

        // Execute move commands for undo/redo
        let state = context.history.getState();
        let page = state.project.pages.find(p => p.id === state.activePageId);

        this.draggedIds.forEach(id => {
          const orig = this.originalPositions[id];
          if (orig) {
            context.history.execute(new AsciiEditor.core.MoveObjectCommand(
              state.activePageId,
              id,
              orig,
              { x: orig.x + dx, y: orig.y + dy }
            ));
          }
        });

        // OBJ-67/68: Handle wire endpoint updates for symbols
        // Re-get state after move commands to see updated symbol positions
        state = context.history.getState();
        page = state.project.pages.find(p => p.id === state.activePageId);

        if (this.originalWireEndpoints && page) {
          for (const wireId in this.originalWireEndpoints) {
            const wire = page.objects.find(o => o.id === wireId);
            const orig = this.originalWireEndpoints[wireId];
            if (!wire || !wire.points || !orig) continue;

            // OBJ-68: If Alt key was held, break bindings instead of rubberbanding
            if (this.altKeyHeld) {
              const oldProps = {};
              const newProps = {};
              let needsUpdate = false;

              // Check which bindings are to moved symbols and break them
              for (const draggedId of this.draggedIds) {
                if (wire.startBinding?.symbolId === draggedId) {
                  oldProps.startBinding = wire.startBinding;
                  newProps.startBinding = null;
                  needsUpdate = true;
                }
                if (wire.endBinding?.symbolId === draggedId) {
                  oldProps.endBinding = wire.endBinding;
                  newProps.endBinding = null;
                  needsUpdate = true;
                }
              }

              if (needsUpdate) {
                context.history.execute(new AsciiEditor.core.ModifyObjectCommand(
                  state.activePageId,
                  wireId,
                  oldProps,
                  newProps
                ));
              }
            } else {
              // OBJ-67: Normal rubberbanding - update wire endpoints to follow pins
              // Start with original points and build new path with proper orthogonality
              const origPoints = orig.allPoints.map(p => ({ x: p.x, y: p.y }));
              let newPoints = orig.allPoints.map(p => ({ x: p.x, y: p.y }));
              let needsUpdate = false;

              // Check start binding - process first to maintain correct indices
              if (wire.startBinding && orig.start) {
                const symbol = page.objects.find(o => o.id === wire.startBinding.symbolId);
                if (symbol && symbol.pins) {
                  const pin = symbol.pins.find(p => p.id === wire.startBinding.pinId);
                  if (pin) {
                    const newPos = this.getPinPosition(symbol, pin);
                    const pinEdge = pin.edge;
                    const exitHorizontal = (pinEdge === 'left' || pinEdge === 'right');

                    if (newPoints.length >= 3) {
                      // Wire has intermediate points - adjust adjacent point
                      if (exitHorizontal) {
                        newPoints[1].y = newPos.y;
                      } else {
                        newPoints[1].x = newPos.x;
                      }
                    } else if (newPoints.length === 2) {
                      const nextPoint = newPoints[1];
                      const needsVertices = (newPos.x !== nextPoint.x && newPos.y !== nextPoint.y);

                      if (needsVertices) {
                        const midX = Math.round((newPos.x + nextPoint.x) / 2);
                        newPoints.splice(1, 0,
                          { x: midX, y: newPos.y },
                          { x: midX, y: nextPoint.y }
                        );
                      }
                    }

                    newPoints[0] = { x: newPos.x, y: newPos.y };
                    needsUpdate = true;
                  }
                }
              }

              // Check end binding
              if (wire.endBinding && orig.end) {
                const symbol = page.objects.find(o => o.id === wire.endBinding.symbolId);
                if (symbol && symbol.pins) {
                  const pin = symbol.pins.find(p => p.id === wire.endBinding.pinId);
                  if (pin) {
                    const newPos = this.getPinPosition(symbol, pin);
                    const pinEdge = pin.edge;
                    const entryHorizontal = (pinEdge === 'left' || pinEdge === 'right');
                    const lastIdx = newPoints.length - 1;

                    if (newPoints.length >= 3) {
                      // Wire has intermediate points - adjust adjacent point
                      if (entryHorizontal) {
                        newPoints[lastIdx - 1].y = newPos.y;
                      } else {
                        newPoints[lastIdx - 1].x = newPos.x;
                      }
                    } else if (newPoints.length === 2) {
                      const prevPoint = newPoints[lastIdx - 1];
                      const needsVertices = (newPos.x !== prevPoint.x && newPos.y !== prevPoint.y);

                      if (needsVertices) {
                        const midX = Math.round((prevPoint.x + newPos.x) / 2);
                        newPoints.splice(lastIdx, 0,
                          { x: midX, y: prevPoint.y },
                          { x: midX, y: newPos.y }
                        );
                      }
                    }

                    // Update endpoint (index may have changed)
                    const newLastIdx = newPoints.length - 1;
                    newPoints[newLastIdx] = { x: newPos.x, y: newPos.y };
                    needsUpdate = true;
                  }
                }
              }

              if (needsUpdate) {
                // Simplify points to remove collinear points after adjustments
                const simplifiedPoints = this.simplifyLinePoints(newPoints);
                context.history.execute(new AsciiEditor.core.ModifyObjectCommand(
                  state.activePageId,
                  wireId,
                  { points: origPoints },
                  { points: simplifiedPoints }
                ));
              }
            }
          }
        }
      }
    }

    if (this.mode === SelectMode.RESIZING && this.resizeOriginal) {
      this.finalizeResize(context);
    }

    if (this.mode === SelectMode.LINE_POINT && this.lineOriginalPoints) {
      this.finalizeLinePointDrag(context);
    }

    if (this.mode === SelectMode.LINE_SEGMENT && this.lineOriginalPoints) {
      this.finalizeLineSegmentDrag(context);
    }

    if (this.mode === SelectMode.PIN_DRAG && this.pinOriginal) {
      this.finalizePinDrag(context);
    }

    if (this.mode === SelectMode.LABEL_DRAG && this.labelOriginalOffset) {
      this.finalizeLabelDrag(context);
    }

    if (this.mode === SelectMode.MARQUEE) {
      this.performMarqueeSelect(context);
    }

    this.resetState();
    return true;
  }

  onKeyDown(event, context) {
    const state = context.history.getState();

    // SEL-23: Delete selected objects
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (state.selection.ids.length > 0) {
        const page = state.project.pages.find(p => p.id === state.activePageId);
        if (page) {
          state.selection.ids.forEach(id => {
            const obj = page.objects.find(o => o.id === id);
            if (obj) {
              context.history.execute(new AsciiEditor.core.DeleteObjectCommand(state.activePageId, AsciiEditor.core.deepClone(obj)));
            }
          });
          context.history.updateState(s => ({
            ...s,
            selection: { ids: [], handles: null, pinIds: [], labelType: null, labelParamIndex: null }
          }));
        }
        return true;
      }
    }

    // OBJ-5A: Type to edit label - if label is selected and printable key pressed, start editing
    if (state.selection.ids.length === 1 && state.selection.labelType && event.key.length === 1 && !event.ctrlKey && !event.altKey) {
      const page = state.project.pages.find(p => p.id === state.activePageId);
      if (page) {
        const obj = page.objects.find(o => o.id === state.selection.ids[0]);
        if (obj && obj.type === 'symbol' && context.startLabelEdit) {
          context.startLabelEdit(obj, state.selection.labelType, state.selection.labelParamIndex, event.key);
          return true;
        }
      }
    }

    // OBJ-5N: Type to edit pin - if pin(s) selected and printable key pressed, start editing pin name
    const selectedPinIds = state.selection.pinIds || [];
    if (selectedPinIds.length > 0 && event.key.length === 1 && !event.ctrlKey && !event.altKey) {
      const page = state.project.pages.find(p => p.id === state.activePageId);
      if (page && state.selection.ids.length === 1) {
        const symbol = page.objects.find(o => o.id === state.selection.ids[0]);
        if (symbol && symbol.type === 'symbol' && context.startPinEdit) {
          context.startPinEdit(symbol, selectedPinIds, event.key);
          return true;
        }
      }
    }

    // SEL-31: Type to edit - if single box/symbol selected and printable key pressed, start editing
    if (state.selection.ids.length === 1 && event.key.length === 1 && !event.ctrlKey && !event.altKey) {
      const page = state.project.pages.find(p => p.id === state.activePageId);
      if (page) {
        const obj = page.objects.find(o => o.id === state.selection.ids[0]);
        if (obj && (obj.type === 'box' || obj.type === 'symbol') && context.startInlineEdit) {
          context.startInlineEdit(obj, event.key);  // Pass initial character
          return true;
        }
      }
    }

    return false;
  }

  // SEL-30: Double-click to edit
  onDoubleClick(event, context) {
    // Use col/row from event (viewport handles coordinate conversion)
    const col = event.col;
    const row = event.row;

    // OBJ-5A: Check for label double-click first
    const labelHit = this.hitTestLabel(col, row, context);
    if (labelHit && context.startLabelEdit) {
      const state = context.history.getState();
      const page = state.project.pages.find(p => p.id === state.activePageId);
      if (page) {
        const symbol = page.objects.find(o => o.id === labelHit.symbolId);
        if (symbol) {
          context.startLabelEdit(symbol, labelHit.type, labelHit.paramIndex, null);
          return true;
        }
      }
    }

    const hit = this.hitTestObject(col, row, context);

    if (hit && (hit.type === 'box' || hit.type === 'symbol')) {
      if (context.startInlineEdit) {
        context.startInlineEdit(hit);
      }
      return true;
    }
    return false;
  }

  performResize(col, row, context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const obj = page.objects.find(o => o.id === state.selection.ids[0]);
    if (!obj) return;

    const orig = this.resizeOriginal;
    let newX = orig.x;
    let newY = orig.y;
    let newW = orig.width;
    let newH = orig.height;

    const minSize = 3;

    switch (this.activeHandle) {
      case HandlePosition.TOP_LEFT:
        newX = Math.min(col, orig.x + orig.width - minSize);
        newY = Math.min(row, orig.y + orig.height - minSize);
        newW = orig.x + orig.width - newX;
        newH = orig.y + orig.height - newY;
        break;
      case HandlePosition.TOP_RIGHT:
        newY = Math.min(row, orig.y + orig.height - minSize);
        newW = Math.max(minSize, col - orig.x + 1);
        newH = orig.y + orig.height - newY;
        break;
      case HandlePosition.BOTTOM_LEFT:
        newX = Math.min(col, orig.x + orig.width - minSize);
        newW = orig.x + orig.width - newX;
        newH = Math.max(minSize, row - orig.y + 1);
        break;
      case HandlePosition.BOTTOM_RIGHT:
        newW = Math.max(minSize, col - orig.x + 1);
        newH = Math.max(minSize, row - orig.y + 1);
        break;
    }

    context.history.updateState(s => {
      const newState = AsciiEditor.core.deepClone(s);
      const pg = newState.project.pages.find(p => p.id === s.activePageId);
      if (pg) {
        const o = pg.objects.find(ob => ob.id === s.selection.ids[0]);
        if (o) {
          o.x = newX;
          o.y = newY;
          o.width = newW;
          o.height = newH;
        }
      }
      return newState;
    });
  }

  finalizeResize(context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const obj = page.objects.find(o => o.id === state.selection.ids[0]);
    if (!obj) return;

    const orig = this.resizeOriginal;
    const hasChanged = obj.x !== orig.x || obj.y !== orig.y ||
                      obj.width !== orig.width || obj.height !== orig.height;

    if (hasChanged) {
      const newProps = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };

      // Restore original
      context.history.updateState(s => {
        const newState = AsciiEditor.core.deepClone(s);
        const pg = newState.project.pages.find(p => p.id === s.activePageId);
        if (pg) {
          const o = pg.objects.find(ob => ob.id === s.selection.ids[0]);
          if (o) {
            o.x = orig.x;
            o.y = orig.y;
            o.width = orig.width;
            o.height = orig.height;
          }
        }
        return newState;
      });

      // Execute command for undo/redo
      context.history.execute(new AsciiEditor.core.ModifyObjectCommand(
        state.activePageId,
        obj.id,
        { x: orig.x, y: orig.y, width: orig.width, height: orig.height },
        newProps
      ));
    }
  }

  // OBJ-3C: Drag line point to move vertex
  // When dragging a vertex, also adjust adjacent points to maintain orthogonality
  performLinePointDrag(col, row, context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const obj = page.objects.find(o => o.id === state.selection.ids[0]);
    if (!obj || (obj.type !== 'line' && obj.type !== 'wire') || !obj.points) return;

    const idx = this.linePointIndex;
    const origPoints = this.lineOriginalPoints;
    const numPoints = origPoints.length;

    // Check for visual indicators on wire endpoints
    this.vertexDragIndicator = null;
    if (obj.type === 'wire') {
      const isStartEndpoint = idx === 0;
      const isEndEndpoint = idx === numPoints - 1;

      if (isStartEndpoint || isEndEndpoint) {
        const endpointPos = { x: col, y: row };

        // Check if over existing pin
        const pinAtPos = this.findPinAtPosition(endpointPos, page.objects);
        if (pinAtPos) {
          this.vertexDragIndicator = {
            type: 'bind',
            pos: endpointPos,
            symbolId: pinAtPos.symbolId,
            pinId: pinAtPos.pinId
          };
        } else {
          // Check if over symbol edge (would create pin)
          const edgeInfo = this.findSymbolEdge(endpointPos, page.objects);
          if (edgeInfo) {
            this.vertexDragIndicator = {
              type: 'create',
              pos: endpointPos,
              symbolId: edgeInfo.symbol.id,
              edge: edgeInfo.edge,
              offset: edgeInfo.offset
            };
          }
        }
      }
    }

    context.history.updateState(s => {
      const newState = AsciiEditor.core.deepClone(s);
      const pg = newState.project.pages.find(p => p.id === s.activePageId);
      if (pg) {
        const lineObj = pg.objects.find(o => o.id === s.selection.ids[0]);
        if (lineObj && lineObj.points && lineObj.points[idx]) {
          // Move the dragged vertex
          lineObj.points[idx].x = col;
          lineObj.points[idx].y = row;

          // Adjust previous point to maintain orthogonality
          if (idx > 0) {
            const prevOrig = origPoints[idx - 1];
            const currOrig = origPoints[idx];
            // Was the segment horizontal or vertical?
            if (prevOrig.y === currOrig.y) {
              // Was horizontal - keep it horizontal by matching Y
              lineObj.points[idx - 1].y = row;
            } else if (prevOrig.x === currOrig.x) {
              // Was vertical - keep it vertical by matching X
              lineObj.points[idx - 1].x = col;
            }
          }

          // Adjust next point to maintain orthogonality
          if (idx < numPoints - 1) {
            const currOrig = origPoints[idx];
            const nextOrig = origPoints[idx + 1];
            // Was the segment horizontal or vertical?
            if (currOrig.y === nextOrig.y) {
              // Was horizontal - keep it horizontal by matching Y
              lineObj.points[idx + 1].y = row;
            } else if (currOrig.x === nextOrig.x) {
              // Was vertical - keep it vertical by matching X
              lineObj.points[idx + 1].x = col;
            }
          }
        }
      }
      return newState;
    });
  }

  finalizeLinePointDrag(context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const obj = page.objects.find(o => o.id === state.selection.ids[0]);
    if (!obj || (obj.type !== 'line' && obj.type !== 'wire') || !obj.points) return;

    const origPoints = this.lineOriginalPoints;
    // Simplify points to remove duplicates and collinear points
    const newPoints = this.simplifyLinePoints(obj.points.map(p => ({ ...p })));

    // Check if points changed
    const hasChanged = origPoints.length !== newPoints.length ||
      origPoints.some((orig, i) => {
        const curr = newPoints[i];
        return !curr || orig.x !== curr.x || orig.y !== curr.y;
      });

    // OBJ-6L: Check if wire endpoint was dragged to another wire's floating endpoint (merge wires)
    if (obj.type === 'wire' && hasChanged) {
      const isStartEndpoint = this.linePointIndex === 0;
      const isEndEndpoint = this.linePointIndex === this.lineOriginalPoints.length - 1;

      if (isStartEndpoint || isEndEndpoint) {
        const endpointPos = isStartEndpoint ? newPoints[0] : newPoints[newPoints.length - 1];

        // Check if dropped on another wire's floating endpoint
        const floatingEnd = this.findFloatingWireEnd(endpointPos, page.objects, obj.id);
        if (floatingEnd) {
          // Merge wires and return early
          this.mergeWiresOnDrop(context, obj, isStartEndpoint, floatingEnd, origPoints);
          return;
        }
      }
    }

    // OBJ-69: Check if wire endpoint binding changed (broken or created)
    let bindingChanged = false;
    let bindingOldProps = {};
    let bindingNewProps = {};

    if (obj.type === 'wire' && hasChanged) {
      const isStartEndpoint = this.linePointIndex === 0;
      const isEndEndpoint = this.linePointIndex === this.lineOriginalPoints.length - 1;

      if (isStartEndpoint || isEndEndpoint) {
        const endpointPos = isStartEndpoint ? newPoints[0] : newPoints[newPoints.length - 1];
        const currentBinding = isStartEndpoint ? obj.startBinding : obj.endBinding;
        const bindingKey = isStartEndpoint ? 'startBinding' : 'endBinding';

        // Check if endpoint was dragged TO a pin or symbol edge (create/rebind)
        // Always check this to handle both new bindings and rebindings (pin A to pin B)
        const bindResult = this.bindEndpointToPin(endpointPos, page, context);

        if (bindResult) {
          const newBinding = bindResult.binding;
          // Check if this is a different binding than before
          const sameBinding = currentBinding &&
            currentBinding.symbolId === newBinding.symbolId &&
            currentBinding.pinId === newBinding.pinId;

          if (!sameBinding) {
            bindingChanged = true;
            bindingOldProps[bindingKey] = currentBinding;
            bindingNewProps[bindingKey] = newBinding;
            // Store pin creation command for later execution
            if (bindResult.createPinCommand) {
              this._pendingPinCreation = bindResult.createPinCommand;
            }
          }
        } else if (currentBinding) {
          // No pin at new location but we had a binding - break it
          bindingChanged = true;
          bindingOldProps[bindingKey] = currentBinding;
          bindingNewProps[bindingKey] = null;
        }
      }
    }

    if (hasChanged || bindingChanged) {
      // Restore original state
      context.history.updateState(s => {
        const newState = AsciiEditor.core.deepClone(s);
        const pg = newState.project.pages.find(p => p.id === s.activePageId);
        if (pg) {
          const lineObj = pg.objects.find(o => o.id === s.selection.ids[0]);
          if (lineObj) {
            lineObj.points = origPoints.map(p => ({ ...p }));
            // Restore original binding state
            if (bindingChanged && this.lineOriginalBinding) {
              if (this.lineOriginalBinding.type === 'start') {
                lineObj.startBinding = this.lineOriginalBinding.binding;
              } else {
                lineObj.endBinding = this.lineOriginalBinding.binding;
              }
            }
          }
        }
        return newState;
      });

      // Execute pending pin creation command first (if any)
      // This happens when wire endpoint is dragged to a symbol edge with no existing pin
      if (this._pendingPinCreation) {
        context.history.execute(this._pendingPinCreation);
        this._pendingPinCreation = null;
      }

      // Execute command for undo/redo
      const oldProps = { points: origPoints, ...bindingOldProps };
      const newProps = { points: newPoints, ...bindingNewProps };

      context.history.execute(new AsciiEditor.core.ModifyObjectCommand(
        state.activePageId,
        obj.id,
        oldProps,
        newProps
      ));
    }

    // Clear any pending pin creation if we didn't use it
    this._pendingPinCreation = null;
  }

  /**
   * Simplify line points by removing:
   * 1. Duplicate consecutive points (same x,y)
   * 2. Collinear points (redundant middle points on same axis)
   */
  simplifyLinePoints(points) {
    if (points.length < 2) return points;

    // First pass: remove duplicate consecutive points
    let filtered = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const prev = filtered[filtered.length - 1];
      const curr = points[i];
      if (prev.x !== curr.x || prev.y !== curr.y) {
        filtered.push(curr);
      }
    }

    if (filtered.length < 3) return filtered;

    // Second pass: remove collinear points
    const result = [filtered[0]];
    for (let i = 1; i < filtered.length - 1; i++) {
      const prev = result[result.length - 1];
      const curr = filtered[i];
      const next = filtered[i + 1];

      const sameX = (prev.x === curr.x && curr.x === next.x);
      const sameY = (prev.y === curr.y && curr.y === next.y);

      if (!sameX && !sameY) {
        result.push(curr);
      }
    }
    result.push(filtered[filtered.length - 1]);

    return result;
  }

  /**
   * OBJ-6L: Find if a point is at another wire's floating endpoint
   * @param {Object} point - {x, y} position to check
   * @param {Array} objects - page objects
   * @param {string} excludeWireId - ID of wire to exclude (the one being dragged)
   * @returns {Object|null} { wire, isStart, point } or null
   */
  findFloatingWireEnd(point, objects, excludeWireId) {
    for (const obj of objects) {
      if (obj.type !== 'wire' || !obj.points || obj.points.length < 2) continue;
      if (obj.id === excludeWireId) continue;  // Don't match self

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
   * OBJ-6L: Merge two wires when endpoint is dragged to another wire's floating endpoint
   * @param {Object} context - tool context
   * @param {Object} draggedWire - wire being dragged
   * @param {boolean} draggedIsStart - whether we're dragging the start endpoint
   * @param {Object} targetEnd - { wire, isStart } of the target wire's floating end
   * @param {Array} origPoints - original points of dragged wire before drag
   */
  mergeWiresOnDrop(context, draggedWire, draggedIsStart, targetEnd, origPoints) {
    const state = context.history.getState();
    const targetWire = targetEnd.wire;

    // First restore dragged wire to original state
    context.history.updateState(s => {
      const newState = AsciiEditor.core.deepClone(s);
      const pg = newState.project.pages.find(p => p.id === s.activePageId);
      if (pg) {
        const wire = pg.objects.find(o => o.id === draggedWire.id);
        if (wire) {
          wire.points = origPoints.map(p => ({ x: p.x, y: p.y }));
        }
      }
      return newState;
    });

    // Build merged points array
    // Logic: connect dragged wire's endpoint to target wire's endpoint
    let mergedPoints;
    let mergedStartBinding;
    let mergedEndBinding;

    const draggedPoints = origPoints.map(p => ({ x: p.x, y: p.y }));
    const targetPoints = targetWire.points.map(p => ({ x: p.x, y: p.y }));

    if (draggedIsStart && targetEnd.isStart) {
      // Dragged start → target start: reverse dragged, prepend to target
      mergedPoints = [...draggedPoints.slice().reverse().slice(0, -1), ...targetPoints];
      mergedStartBinding = draggedWire.endBinding;
      mergedEndBinding = targetWire.endBinding;
    } else if (draggedIsStart && !targetEnd.isStart) {
      // Dragged start → target end: append dragged reversed to target
      mergedPoints = [...targetPoints.slice(0, -1), ...draggedPoints.slice().reverse()];
      mergedStartBinding = targetWire.startBinding;
      mergedEndBinding = draggedWire.endBinding;
    } else if (!draggedIsStart && targetEnd.isStart) {
      // Dragged end → target start: append target to dragged
      mergedPoints = [...draggedPoints.slice(0, -1), ...targetPoints];
      mergedStartBinding = draggedWire.startBinding;
      mergedEndBinding = targetWire.endBinding;
    } else {
      // Dragged end → target end: append target reversed to dragged
      mergedPoints = [...draggedPoints.slice(0, -1), ...targetPoints.slice().reverse()];
      mergedStartBinding = draggedWire.startBinding;
      mergedEndBinding = targetWire.startBinding;
    }

    // Simplify merged points
    mergedPoints = this.simplifyLinePoints(mergedPoints);

    // Delete both original wires
    context.history.execute(new AsciiEditor.core.DeleteObjectCommand(
      state.activePageId, AsciiEditor.core.deepClone(draggedWire)
    ));
    context.history.execute(new AsciiEditor.core.DeleteObjectCommand(
      state.activePageId, AsciiEditor.core.deepClone(targetWire)
    ));

    // Create merged wire (inherit style/net from dragged wire)
    const mergedWire = {
      id: AsciiEditor.core.generateId(),
      type: 'wire',
      points: mergedPoints,
      style: draggedWire.style || 'single',
      net: draggedWire.net || targetWire.net || '',
      startBinding: mergedStartBinding,
      endBinding: mergedEndBinding
    };

    context.history.execute(new AsciiEditor.core.CreateObjectCommand(
      state.activePageId, mergedWire
    ));

    // Select the new merged wire
    context.history.updateState(s => ({
      ...s,
      selection: { ids: [mergedWire.id], handles: null, pinIds: [], labelType: null, labelParamIndex: null }
    }));

    AsciiEditor.debug.info('SelectTool', 'Merged wires on drag', {
      draggedId: draggedWire.id,
      targetId: targetWire.id,
      newId: mergedWire.id,
      points: mergedPoints.length
    });
  }

  // OBJ-3D to OBJ-3G: Drag line segment (move both endpoints perpendicular to segment)
  // For wires with bound endpoints: move the attached pin along the symbol edge
  performLineSegmentDrag(col, row, context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const obj = page.objects.find(o => o.id === state.selection.ids[0]);
    if (!obj || (obj.type !== 'line' && obj.type !== 'wire') || !obj.points) return;

    const segIdx = this.lineSegmentIndex;
    const origPoints = this.lineOriginalPoints;
    const lastSegmentIndex = origPoints.length - 2;

    // Reset segment drag pin state
    this.segmentDragPinInfo = null;
    this.segmentDragPinCollision = false;

    // Calculate delta from original segment position
    let deltaX = 0, deltaY = 0;
    if (this.lineSegmentIsHorizontal) {
      deltaY = row - origPoints[segIdx].y;
    } else {
      deltaX = col - origPoints[segIdx].x;
    }

    // For wires, check if this segment affects a bound endpoint and move the pin
    if (obj.type === 'wire') {
      let bindingToCheck = null;
      let isStartEndpoint = false;

      if (segIdx === 0 && obj.startBinding) {
        bindingToCheck = obj.startBinding;
        isStartEndpoint = true;
      } else if (segIdx === lastSegmentIndex && obj.endBinding) {
        bindingToCheck = obj.endBinding;
        isStartEndpoint = false;
      }

      if (bindingToCheck) {
        const symbol = page.objects.find(o => o.id === bindingToCheck.symbolId);
        if (symbol && symbol.pins) {
          const pin = symbol.pins.find(p => p.id === bindingToCheck.pinId);
          if (pin) {
            // Calculate new wire endpoint position
            const endpointIdx = isStartEndpoint ? 0 : origPoints.length - 1;
            const newEndpointX = origPoints[endpointIdx].x + deltaX;
            const newEndpointY = origPoints[endpointIdx].y + deltaY;

            // Calculate new pin position along the edge
            const newEdgeInfo = this.calculatePinPositionOnEdge(symbol, pin.edge, newEndpointX, newEndpointY);

            if (newEdgeInfo) {
              // Check for collision with other pins on this symbol
              const collision = this.checkPinCollision(symbol, pin.id, newEdgeInfo.edge, newEdgeInfo.offset);

              // Use the original pin state stored when drag started
              const origPin = this.segmentDragOriginalPin;
              this.segmentDragPinInfo = {
                symbolId: symbol.id,
                pinId: pin.id,
                originalEdge: origPin ? origPin.edge : pin.edge,
                originalOffset: origPin ? origPin.offset : pin.offset,
                newEdge: newEdgeInfo.edge,
                newOffset: newEdgeInfo.offset,
                newPos: { x: newEndpointX, y: newEndpointY }
              };
              this.segmentDragPinCollision = collision;
            }
          }
        }
      }
    }

    context.history.updateState(s => {
      const newState = AsciiEditor.core.deepClone(s);
      const pg = newState.project.pages.find(p => p.id === s.activePageId);
      if (pg) {
        const lineObj = pg.objects.find(o => o.id === s.selection.ids[0]);
        if (lineObj && lineObj.points) {
          if (this.lineSegmentIsHorizontal) {
            // Move both endpoints of this segment by deltaY
            lineObj.points[segIdx].y = origPoints[segIdx].y + deltaY;
            lineObj.points[segIdx + 1].y = origPoints[segIdx + 1].y + deltaY;
          } else {
            // Move both endpoints of this segment by deltaX
            lineObj.points[segIdx].x = origPoints[segIdx].x + deltaX;
            lineObj.points[segIdx + 1].x = origPoints[segIdx + 1].x + deltaX;
          }
        }

        // Move the pin in real-time if we have pin movement info
        if (this.segmentDragPinInfo && !this.segmentDragPinCollision) {
          const sym = pg.objects.find(o => o.id === this.segmentDragPinInfo.symbolId);
          if (sym && sym.pins) {
            const pinIdx = sym.pins.findIndex(p => p.id === this.segmentDragPinInfo.pinId);
            if (pinIdx >= 0) {
              sym.pins[pinIdx].edge = this.segmentDragPinInfo.newEdge;
              sym.pins[pinIdx].offset = this.segmentDragPinInfo.newOffset;
            }
          }
        }
      }
      return newState;
    });
  }

  // Calculate where a pin should be on an edge given a target position
  calculatePinPositionOnEdge(symbol, currentEdge, targetX, targetY) {
    const { x, y, width, height } = symbol;

    // For left/right edges, the Y position determines offset
    // For top/bottom edges, the X position determines offset
    if (currentEdge === 'left' || currentEdge === 'right') {
      // Pin stays on same edge, Y determines offset
      const clampedY = Math.max(y + 1, Math.min(y + height - 2, targetY));
      const offset = height > 2 ? (clampedY - y) / (height - 1) : 0.5;
      return { edge: currentEdge, offset };
    } else if (currentEdge === 'top' || currentEdge === 'bottom') {
      // Pin stays on same edge, X determines offset
      const clampedX = Math.max(x + 1, Math.min(x + width - 2, targetX));
      const offset = width > 2 ? (clampedX - x) / (width - 1) : 0.5;
      return { edge: currentEdge, offset };
    }

    return null;
  }

  // Check if a pin at the given edge/offset would collide with another pin
  checkPinCollision(symbol, excludePinId, edge, offset) {
    if (!symbol.pins) return false;

    const { width, height } = symbol;
    const edgeLength = (edge === 'left' || edge === 'right') ? height : width;

    // Calculate the cell position of the new offset
    const newCell = Math.round(offset * (edgeLength - 1));

    for (const otherPin of symbol.pins) {
      if (otherPin.id === excludePinId) continue;
      if (otherPin.edge !== edge) continue;

      const otherCell = Math.round(otherPin.offset * (edgeLength - 1));
      if (newCell === otherCell) {
        return true; // Collision!
      }
    }

    return false;
  }

  finalizeLineSegmentDrag(context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const obj = page.objects.find(o => o.id === state.selection.ids[0]);
    if (!obj || (obj.type !== 'line' && obj.type !== 'wire') || !obj.points) return;

    const origPoints = this.lineOriginalPoints;

    // If there's a pin collision, reject the drag entirely
    if (this.segmentDragPinCollision) {
      // Revert to original state
      context.history.updateState(s => {
        const newState = AsciiEditor.core.deepClone(s);
        const pg = newState.project.pages.find(p => p.id === s.activePageId);
        if (pg) {
          const lineObj = pg.objects.find(o => o.id === s.selection.ids[0]);
          if (lineObj) {
            lineObj.points = origPoints.map(p => ({ ...p }));
          }
          // Restore pin to original position using the stored original from drag start
          if (this.segmentDragOriginalPin) {
            const sym = pg.objects.find(o => o.id === this.segmentDragOriginalPin.symbolId);
            if (sym && sym.pins) {
              const pinIdx = sym.pins.findIndex(p => p.id === this.segmentDragOriginalPin.pinId);
              if (pinIdx >= 0) {
                sym.pins[pinIdx].edge = this.segmentDragOriginalPin.edge;
                sym.pins[pinIdx].offset = this.segmentDragOriginalPin.offset;
              }
            }
          }
        }
        return newState;
      });
      // Clear state and return without committing
      this.segmentDragPinInfo = null;
      this.segmentDragPinCollision = false;
      this.segmentDragOriginalPin = null;
      return;
    }

    // Simplify points to remove duplicates and collinear points
    const newPoints = this.simplifyLinePoints(obj.points.map(p => ({ ...p })));

    // Check if points changed
    const hasChanged = origPoints.length !== newPoints.length ||
      origPoints.some((orig, i) => {
        const curr = newPoints[i];
        return !curr || orig.x !== curr.x || orig.y !== curr.y;
      });

    // Check if we moved a pin
    const pinMoved = this.segmentDragPinInfo && !this.segmentDragPinCollision;

    if (hasChanged || pinMoved) {
      // Restore original state before executing commands
      context.history.updateState(s => {
        const newState = AsciiEditor.core.deepClone(s);
        const pg = newState.project.pages.find(p => p.id === s.activePageId);
        if (pg) {
          const lineObj = pg.objects.find(o => o.id === s.selection.ids[0]);
          if (lineObj) {
            lineObj.points = origPoints.map(p => ({ ...p }));
          }
          // Restore pin to original position using stored original from drag start
          if (this.segmentDragOriginalPin) {
            const sym = pg.objects.find(o => o.id === this.segmentDragOriginalPin.symbolId);
            if (sym && sym.pins) {
              const pinIdx = sym.pins.findIndex(p => p.id === this.segmentDragOriginalPin.pinId);
              if (pinIdx >= 0) {
                sym.pins[pinIdx].edge = this.segmentDragOriginalPin.edge;
                sym.pins[pinIdx].offset = this.segmentDragOriginalPin.offset;
              }
            }
          }
        }
        return newState;
      });

      // Execute wire points change
      if (hasChanged) {
        context.history.execute(new AsciiEditor.core.ModifyObjectCommand(
          state.activePageId,
          obj.id,
          { points: origPoints },
          { points: newPoints }
        ));
      }

      // Execute pin position change
      if (pinMoved) {
        const symbol = page.objects.find(o => o.id === this.segmentDragPinInfo.symbolId);
        if (symbol && symbol.pins) {
          const oldPins = symbol.pins.map(p => ({ ...p }));
          const newPins = symbol.pins.map(p => {
            if (p.id === this.segmentDragPinInfo.pinId) {
              return {
                ...p,
                edge: this.segmentDragPinInfo.newEdge,
                offset: this.segmentDragPinInfo.newOffset
              };
            }
            return { ...p };
          });

          context.history.execute(new AsciiEditor.core.ModifyObjectCommand(
            state.activePageId,
            symbol.id,
            { pins: oldPins },
            { pins: newPins }
          ));
        }
      }
    }

    // Clear segment drag pin state
    this.segmentDragPinInfo = null;
    this.segmentDragPinCollision = false;
    this.segmentDragOriginalPin = null;
  }

  // SEL-1 to SEL-4: Marquee selection
  performMarqueeSelect(context) {
    if (!this.dragStart || !this.dragCurrent) return;

    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const x1 = Math.min(this.dragStart.col, this.dragCurrent.col);
    const y1 = Math.min(this.dragStart.row, this.dragCurrent.row);
    const x2 = Math.max(this.dragStart.col, this.dragCurrent.col);
    const y2 = Math.max(this.dragStart.row, this.dragCurrent.row);

    // SEL-1, SEL-2: Selection mode based on drag direction
    const leftToRight = this.dragCurrent.col >= this.dragStart.col;

    const selectedIds = [];
    page.objects.forEach(obj => {
      // OBJ-9: Skip objects marked as not selectable
      if (obj.selectable === false) return;

      // Use getObjectBounds for proper handling of lines/wires (points array) vs boxes (x,y,width,height)
      const bounds = this.getObjectBounds(obj);
      const objX1 = bounds.x;
      const objY1 = bounds.y;
      const objX2 = bounds.x + bounds.width - 1;
      const objY2 = bounds.y + bounds.height - 1;

      let selected = false;

      if (leftToRight) {
        // SEL-1: Enclosed mode - object must be fully inside marquee
        selected = objX1 >= x1 && objX2 <= x2 && objY1 >= y1 && objY2 <= y2;
      } else {
        // SEL-2: Intersect mode - object just needs to touch marquee
        selected = !(objX2 < x1 || objX1 > x2 || objY2 < y1 || objY1 > y2);
      }

      if (selected) {
        selectedIds.push(obj.id);
      }
    });

    // SEL-4: If Ctrl held, add to existing selection
    if (this.addToSelection) {
      const existingIds = state.selection.ids;
      const newIds = [...new Set([...existingIds, ...selectedIds])];
      context.history.updateState(s => ({
        ...s,
        selection: { ids: newIds, handles: null, pinIds: [], labelType: null, labelParamIndex: null }
      }));
    } else {
      context.history.updateState(s => ({
        ...s,
        selection: { ids: selectedIds, handles: null, pinIds: [], labelType: null, labelParamIndex: null }
      }));
    }
  }

  hitTestObject(col, row, context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return null;

    // Check objects in reverse order (top-most first)
    for (let i = page.objects.length - 1; i >= 0; i--) {
      const obj = page.objects[i];
      // OBJ-9: Skip objects marked as not selectable
      if (obj.selectable === false) continue;
      if (this.objectContainsPoint(obj, col, row)) {
        return obj;
      }
    }
    return null;
  }

  hitTestHandle(pixelX, pixelY, context) {
    const state = context.history.getState();
    if (state.selection.ids.length !== 1) return null;

    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return null;

    const obj = page.objects.find(o => o.id === state.selection.ids[0]);
    if (!obj) return null;

    const handleSize = 8;

    // Line/Wire handles (vertex and segment)
    if ((obj.type === 'line' || obj.type === 'wire') && obj.points) {
      // First check vertex handles (higher priority)
      for (let i = 0; i < obj.points.length; i++) {
        const point = obj.points[i];
        const pixel = context.grid.charToPixel(point.x, point.y);
        const centerX = pixel.x + context.grid.charWidth / 2;
        const centerY = pixel.y + context.grid.charHeight / 2;

        if (Math.abs(pixelX - centerX) <= handleSize && Math.abs(pixelY - centerY) <= handleSize) {
          return { type: 'line_point', pointIndex: i, obj };
        }
      }

      // Then check segment handles (midpoints)
      for (let i = 0; i < obj.points.length - 1; i++) {
        const p1 = obj.points[i];
        const p2 = obj.points[i + 1];

        // Calculate midpoint in character coordinates
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        // Convert to pixel coordinates
        const midPixelX = midX * context.grid.charWidth + context.grid.charWidth / 2;
        const midPixelY = midY * context.grid.charHeight + context.grid.charHeight / 2;

        // Determine if segment is horizontal or vertical
        const isHorizontal = (p1.y === p2.y);

        if (Math.abs(pixelX - midPixelX) <= handleSize && Math.abs(pixelY - midPixelY) <= handleSize) {
          return { type: 'line_segment', segmentIndex: i, isHorizontal, obj };
        }
      }

      return null;
    }

    // Box corner handles
    const { x, y } = context.grid.charToPixel(obj.x, obj.y);
    const width = (obj.width || 10) * context.grid.charWidth;
    const height = (obj.height || 3) * context.grid.charHeight;

    const handles = [
      { position: HandlePosition.TOP_LEFT, hx: x, hy: y },
      { position: HandlePosition.TOP_RIGHT, hx: x + width, hy: y },
      { position: HandlePosition.BOTTOM_LEFT, hx: x, hy: y + height },
      { position: HandlePosition.BOTTOM_RIGHT, hx: x + width, hy: y + height }
    ];

    for (const h of handles) {
      if (Math.abs(pixelX - h.hx) <= handleSize && Math.abs(pixelY - h.hy) <= handleSize) {
        return { type: 'box_corner', position: h.position, obj };
      }
    }

    return null;
  }

  getHandleCursor(position) {
    switch (position) {
      case HandlePosition.TOP_LEFT:
      case HandlePosition.BOTTOM_RIGHT:
        return 'nwse-resize';
      case HandlePosition.TOP_RIGHT:
      case HandlePosition.BOTTOM_LEFT:
        return 'nesw-resize';
      default:
        return 'default';
    }
  }

  objectContainsPoint(obj, col, row) {
    if (obj.type === 'line' || obj.type === 'wire') {
      return this.lineContainsPoint(obj, col, row);
    }
    // Default: rectangular bounds (boxes, etc.)
    const width = obj.width || 10;
    const height = obj.height || 3;
    return col >= obj.x && col < obj.x + width &&
           row >= obj.y && row < obj.y + height;
  }

  // Hit testing for line objects
  lineContainsPoint(obj, col, row) {
    if (!obj.points || obj.points.length < 2) return false;

    // Check each segment
    for (let i = 0; i < obj.points.length - 1; i++) {
      const p1 = obj.points[i];
      const p2 = obj.points[i + 1];

      if (this.pointOnSegment(col, row, p1, p2)) {
        return true;
      }
    }
    return false;
  }

  // Check if a point is on a horizontal or vertical segment
  pointOnSegment(col, row, p1, p2) {
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    // Horizontal segment
    if (p1.y === p2.y && row === p1.y && col >= minX && col <= maxX) {
      return true;
    }
    // Vertical segment
    if (p1.x === p2.x && col === p1.x && row >= minY && row <= maxY) {
      return true;
    }
    return false;
  }

  // Get bounding box for any object (used for marquee selection)
  getObjectBounds(obj) {
    if (obj.type === 'line' || obj.type === 'wire') {
      return this.getLineBounds(obj);
    }
    // Default: box-like objects
    return {
      x: obj.x,
      y: obj.y,
      width: obj.width || 10,
      height: obj.height || 3
    };
  }

  // Get bounding box for line objects
  getLineBounds(obj) {
    if (!obj.points || obj.points.length === 0) {
      return { x: 0, y: 0, width: 1, height: 1 };
    }
    const xs = obj.points.map(p => p.x);
    const ys = obj.points.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  // OBJ-5L: Hit test for pins on symbols
  hitTestPin(col, row, context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return null;

    const symbols = page.objects.filter(o => o.type === 'symbol');

    for (const symbol of symbols) {
      if (!symbol.pins || symbol.pins.length === 0) continue;

      for (const pin of symbol.pins) {
        const pos = this.getPinPosition(symbol, pin);
        if (pos.x === col && pos.y === row) {
          return { symbolId: symbol.id, pinId: pin.id, pin, symbol };
        }
      }
    }
    return null;
  }

  // Find pin at a given position (for wire rebinding)
  findPinAtPosition(point, objects) {
    const symbols = objects.filter(o => o.type === 'symbol');

    for (const symbol of symbols) {
      if (!symbol.pins || symbol.pins.length === 0) continue;

      for (const pin of symbol.pins) {
        const pos = this.getPinPosition(symbol, pin);
        if (pos.x === point.x && pos.y === point.y) {
          return { symbolId: symbol.id, pinId: pin.id };
        }
      }
    }
    return null;
  }

  // Find if a point is on a symbol edge (excluding corners)
  // Delegates to domain.Symbol.findSymbolEdgeAtPoint
  // Returns { symbol, edge, offset } or null
  findSymbolEdge(point, objects) {
    return this.SymbolDomain.findSymbolEdgeAtPoint(point.x, point.y, objects);
  }

  // Find existing pin at symbol edge position
  // Delegates to domain.Symbol.findPinAtEdge
  findPinAtEdge(symbol, edge, offset) {
    return this.SymbolDomain.findPinAtEdge(symbol, edge, offset);
  }

  // Bind wire endpoint to pin, auto-creating pin if needed
  // Returns { symbolId, pinId } binding or null, plus any command to execute
  bindEndpointToPin(point, page, context) {
    // First check if there's an existing pin at this exact position
    const existingBinding = this.findPinAtPosition(point, page.objects);
    if (existingBinding) {
      return { binding: existingBinding, createPinCommand: null };
    }

    // Check if point is on a symbol edge
    const edgeInfo = this.findSymbolEdge(point, page.objects);
    if (!edgeInfo) {
      return null;
    }

    const { symbol, edge, offset } = edgeInfo;

    // Check for existing pin at this edge position
    let pin = this.findPinAtEdge(symbol, edge, offset);

    if (pin) {
      return { binding: { symbolId: symbol.id, pinId: pin.id }, createPinCommand: null };
    }

    // Need to create a new pin
    const newPin = {
      id: AsciiEditor.core.generateId(),
      name: '',
      edge: edge,
      offset: offset,
      shape: 'circle-outline',
      direction: 'bidirectional'
    };

    const updatedPins = [...(symbol.pins || []), newPin];
    const createPinCommand = new AsciiEditor.core.ModifyObjectCommand(
      context.history.getState().activePageId,
      symbol.id,
      { pins: symbol.pins || [] },
      { pins: updatedPins }
    );

    return {
      binding: { symbolId: symbol.id, pinId: newPin.id },
      createPinCommand: createPinCommand
    };
  }

  // Calculate pin world position
  // Delegates to domain.Symbol.getPinPosition
  getPinPosition(symbol, pin) {
    const pos = this.SymbolDomain.getPinPosition(symbol, pin);
    // Convert {col, row} to {x, y} for compatibility
    return { x: pos.col, y: pos.row };
  }

  // OBJ-69: Find all wires bound to a symbol
  // Delegates to domain.Wire.findWiresBoundToSymbol
  findWiresBoundToSymbol(symbolId, objects) {
    return this.WireDomain.findWiresBoundToSymbol(symbolId, objects)
      .map(entry => entry.wire);
  }

  // OBJ-67: Update wire endpoints based on pin positions after symbol move
  // Maintains orthogonality and clean wire exit from pins
  updateBoundWireEndpoints(page, symbolId, dx, dy) {
    const symbol = page.objects.find(o => o.id === symbolId);
    if (!symbol || !symbol.pins) return;

    const wires = this.findWiresBoundToSymbol(symbolId, page.objects);

    for (const wire of wires) {
      if (!wire.points || wire.points.length < 2) continue;

      // Get original point count to detect if we've already inserted vertices
      const orig = this.originalWireEndpoints?.[wire.id];
      const originalPointCount = orig?.allPoints?.length || wire.points.length;

      // Update start endpoint if bound to this symbol
      if (wire.startBinding?.symbolId === symbolId) {
        const pin = symbol.pins.find(p => p.id === wire.startBinding.pinId);
        if (pin) {
          const newPos = this.getPinPosition(symbol, pin);
          const pinEdge = pin.edge; // 'left', 'right', 'top', 'bottom'

          // Determine if wire exit should be horizontal or vertical based on pin edge
          const exitHorizontal = (pinEdge === 'left' || pinEdge === 'right');

          if (wire.points.length >= 3 || wire.points.length > originalPointCount) {
            // Wire has intermediate points - adjust adjacent point to maintain clean exit
            if (exitHorizontal) {
              // For left/right pins: keep first segment horizontal by matching Y
              wire.points[1].y = newPos.y;
            } else {
              // For top/bottom pins: keep first segment vertical by matching X
              wire.points[1].x = newPos.x;
            }
          } else if (wire.points.length === 2) {
            // Only 2 points - check if we need to insert vertices
            const nextPoint = wire.points[1];
            const needsVertices = (newPos.x !== nextPoint.x && newPos.y !== nextPoint.y);

            if (needsVertices) {
              // Insert 2 vertices to create orthogonal staircase pattern
              const midX = Math.round((newPos.x + nextPoint.x) / 2);
              wire.points.splice(1, 0,
                { x: midX, y: newPos.y },
                { x: midX, y: nextPoint.y }
              );
            }
          }

          // Update the endpoint to new pin position
          wire.points[0].x = newPos.x;
          wire.points[0].y = newPos.y;
        }
      }

      // Update end endpoint if bound to this symbol
      if (wire.endBinding?.symbolId === symbolId) {
        const pin = symbol.pins.find(p => p.id === wire.endBinding.pinId);
        if (pin) {
          const newPos = this.getPinPosition(symbol, pin);
          const pinEdge = pin.edge;
          const lastIdx = wire.points.length - 1;

          // Determine if wire entry should be horizontal or vertical based on pin edge
          const entryHorizontal = (pinEdge === 'left' || pinEdge === 'right');

          if (wire.points.length >= 3 || wire.points.length > originalPointCount) {
            // Wire has intermediate points - adjust adjacent point to maintain clean entry
            if (entryHorizontal) {
              // For left/right pins: keep last segment horizontal by matching Y
              wire.points[lastIdx - 1].y = newPos.y;
            } else {
              // For top/bottom pins: keep last segment vertical by matching X
              wire.points[lastIdx - 1].x = newPos.x;
            }
          } else if (wire.points.length === 2) {
            // Only 2 points - check if we need to insert vertices
            const prevPoint = wire.points[lastIdx - 1];
            const needsVertices = (newPos.x !== prevPoint.x && newPos.y !== prevPoint.y);

            if (needsVertices) {
              // Insert 2 vertices to create orthogonal staircase pattern
              const midX = Math.round((prevPoint.x + newPos.x) / 2);
              wire.points.splice(lastIdx, 0,
                { x: midX, y: prevPoint.y },
                { x: midX, y: newPos.y }
              );
            }
          }

          // Update the endpoint to new pin position (index may have changed due to splice)
          const newLastIdx = wire.points.length - 1;
          wire.points[newLastIdx].x = newPos.x;
          wire.points[newLastIdx].y = newPos.y;
        }
      }
    }
  }

  // OBJ-5M: Drag pin along symbol edges
  performPinDrag(col, row, context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const symbol = page.objects.find(o => o.id === this.pinDragSymbolId);
    if (!symbol || !symbol.pins) return;

    // Find which edge the cursor is on
    const edgeInfo = this.findClosestEdge(symbol, col, row);
    if (!edgeInfo) return;

    // Update the pin's position and any bound wire endpoints
    context.history.updateState(s => {
      const newState = AsciiEditor.core.deepClone(s);
      const pg = newState.project.pages.find(p => p.id === s.activePageId);
      if (pg) {
        const sym = pg.objects.find(o => o.id === this.pinDragSymbolId);
        if (sym && sym.pins) {
          const pinIdx = sym.pins.findIndex(p => p.id === this.pinDragPinId);
          if (pinIdx >= 0) {
            sym.pins[pinIdx].edge = edgeInfo.edge;
            sym.pins[pinIdx].offset = edgeInfo.offset;

            // Calculate new pin position for wire updates
            const updatedPin = sym.pins[pinIdx];
            const newPinPos = this.getPinPosition(sym, updatedPin);

            // Update any wires bound to this pin
            pg.objects.forEach(obj => {
              if (obj.type !== 'wire' || !obj.points || obj.points.length < 2) return;

              // Check start binding
              if (obj.startBinding?.symbolId === this.pinDragSymbolId &&
                  obj.startBinding?.pinId === this.pinDragPinId) {
                obj.points[0].x = newPinPos.x;
                obj.points[0].y = newPinPos.y;
                // Adjust adjacent point for orthogonality if wire has intermediate points
                if (obj.points.length >= 3) {
                  const exitHorizontal = (updatedPin.edge === 'left' || updatedPin.edge === 'right');
                  if (exitHorizontal) {
                    obj.points[1].y = newPinPos.y;
                  } else {
                    obj.points[1].x = newPinPos.x;
                  }
                }
              }

              // Check end binding
              if (obj.endBinding?.symbolId === this.pinDragSymbolId &&
                  obj.endBinding?.pinId === this.pinDragPinId) {
                const lastIdx = obj.points.length - 1;
                obj.points[lastIdx].x = newPinPos.x;
                obj.points[lastIdx].y = newPinPos.y;
                // Adjust adjacent point for orthogonality if wire has intermediate points
                if (obj.points.length >= 3) {
                  const entryHorizontal = (updatedPin.edge === 'left' || updatedPin.edge === 'right');
                  if (entryHorizontal) {
                    obj.points[lastIdx - 1].y = newPinPos.y;
                  } else {
                    obj.points[lastIdx - 1].x = newPinPos.x;
                  }
                }
              }
            });
          }
        }
      }
      return newState;
    });
  }

  // Find which edge of a symbol is closest to a point
  // OBJ-5J2: Pins CANNOT be placed on corner cells
  findClosestEdge(symbol, col, row) {
    const { x, y, width, height } = symbol;

    // Check if on left edge (excluding corners)
    if (col === x && row > y && row < y + height - 1) {
      const offset = height > 2 ? (row - y) / (height - 1) : 0.5;
      return { edge: 'left', offset };
    }
    // Check if on right edge (excluding corners)
    if (col === x + width - 1 && row > y && row < y + height - 1) {
      const offset = height > 2 ? (row - y) / (height - 1) : 0.5;
      return { edge: 'right', offset };
    }
    // Check if on top edge (excluding corners)
    if (row === y && col > x && col < x + width - 1) {
      const offset = width > 2 ? (col - x) / (width - 1) : 0.5;
      return { edge: 'top', offset };
    }
    // Check if on bottom edge (excluding corners)
    if (row === y + height - 1 && col > x && col < x + width - 1) {
      const offset = width > 2 ? (col - x) / (width - 1) : 0.5;
      return { edge: 'bottom', offset };
    }

    // Not on any edge - find closest edge and clamp to exclude corners
    const distLeft = Math.abs(col - x);
    const distRight = Math.abs(col - (x + width - 1));
    const distTop = Math.abs(row - y);
    const distBottom = Math.abs(row - (y + height - 1));

    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

    if (minDist === distLeft) {
      // Clamp row to exclude corners (y+1 to y+height-2)
      const clampedRow = Math.max(y + 1, Math.min(y + height - 2, row));
      const offset = height > 2 ? (clampedRow - y) / (height - 1) : 0.5;
      return { edge: 'left', offset };
    }
    if (minDist === distRight) {
      // Clamp row to exclude corners
      const clampedRow = Math.max(y + 1, Math.min(y + height - 2, row));
      const offset = height > 2 ? (clampedRow - y) / (height - 1) : 0.5;
      return { edge: 'right', offset };
    }
    if (minDist === distTop) {
      // Clamp col to exclude corners (x+1 to x+width-2)
      const clampedCol = Math.max(x + 1, Math.min(x + width - 2, col));
      const offset = width > 2 ? (clampedCol - x) / (width - 1) : 0.5;
      return { edge: 'top', offset };
    }
    // distBottom
    const clampedCol = Math.max(x + 1, Math.min(x + width - 2, col));
    const offset = width > 2 ? (clampedCol - x) / (width - 1) : 0.5;
    return { edge: 'bottom', offset };
  }

  // Finalize pin drag with undo support
  finalizePinDrag(context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const symbol = page.objects.find(o => o.id === this.pinDragSymbolId);
    if (!symbol || !symbol.pins) return;

    const currentPin = symbol.pins.find(p => p.id === this.pinDragPinId);
    if (!currentPin) return;

    // Check if pin actually moved
    const hasChanged = currentPin.edge !== this.pinOriginal.edge ||
                       currentPin.offset !== this.pinOriginal.offset;

    if (hasChanged) {
      // Restore original
      context.history.updateState(s => {
        const newState = AsciiEditor.core.deepClone(s);
        const pg = newState.project.pages.find(p => p.id === s.activePageId);
        if (pg) {
          const sym = pg.objects.find(o => o.id === this.pinDragSymbolId);
          if (sym && sym.pins) {
            const pinIdx = sym.pins.findIndex(p => p.id === this.pinDragPinId);
            if (pinIdx >= 0) {
              sym.pins[pinIdx].edge = this.pinOriginal.edge;
              sym.pins[pinIdx].offset = this.pinOriginal.offset;
            }
          }
        }
        return newState;
      });

      // Execute command for undo/redo
      const newPins = symbol.pins.map(p => {
        if (p.id === this.pinDragPinId) {
          return { ...p, edge: currentPin.edge, offset: currentPin.offset };
        }
        return { ...p };
      });

      context.history.execute(new AsciiEditor.core.ModifyObjectCommand(
        state.activePageId,
        symbol.id,
        { pins: symbol.pins.map(p => ({ ...p })) },
        { pins: newPins }
      ));
    }
  }

  // OBJ-5A1 to OBJ-5A8: Hit test for designator and parameter labels
  hitTestLabel(col, row, context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return null;

    const symbols = page.objects.filter(o => o.type === 'symbol');

    for (const symbol of symbols) {
      // Check designator
      if (symbol.designator && symbol.designator.visible) {
        const desig = symbol.designator;
        const designatorText = `${desig.prefix}${desig.number}`;
        const desigX = symbol.x + (desig.offset?.x || 0);
        const desigY = symbol.y + (desig.offset?.y || -1);

        // Check if click is within the designator text bounds
        if (row === desigY && col >= desigX && col < desigX + designatorText.length) {
          return {
            symbolId: symbol.id,
            type: 'designator',
            paramIndex: null,
            offset: desig.offset || { x: 0, y: -1 },
            text: designatorText
          };
        }
      }

      // Check parameters
      if (symbol.parameters && symbol.parameters.length > 0) {
        for (let i = 0; i < symbol.parameters.length; i++) {
          const param = symbol.parameters[i];
          if (param.visible && param.value) {
            const paramX = symbol.x + (param.offset?.x || 0);
            const paramY = symbol.y + (param.offset?.y || symbol.height);

            // Check if click is within the parameter text bounds
            if (row === paramY && col >= paramX && col < paramX + param.value.length) {
              return {
                symbolId: symbol.id,
                type: 'parameter',
                paramIndex: i,
                offset: param.offset || { x: 0, y: symbol.height },
                text: param.value
              };
            }
          }
        }
      }
    }
    return null;
  }

  // OBJ-5A3 to OBJ-5A5: Drag label to new position (offset relative to symbol)
  performLabelDrag(col, row, context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const symbol = page.objects.find(o => o.id === this.labelDragSymbolId);
    if (!symbol) return;

    // Calculate new offset relative to symbol position
    const newOffset = {
      x: col - symbol.x,
      y: row - symbol.y
    };

    // Update the label's position in state
    context.history.updateState(s => {
      const newState = AsciiEditor.core.deepClone(s);
      const pg = newState.project.pages.find(p => p.id === s.activePageId);
      if (pg) {
        const sym = pg.objects.find(o => o.id === this.labelDragSymbolId);
        if (sym) {
          if (this.labelDragType === 'designator' && sym.designator) {
            sym.designator.offset = newOffset;
          } else if (this.labelDragType === 'parameter' && sym.parameters && this.labelDragParamIndex !== null) {
            if (sym.parameters[this.labelDragParamIndex]) {
              sym.parameters[this.labelDragParamIndex].offset = newOffset;
            }
          }
        }
      }
      return newState;
    });
  }

  // OBJ-5A6: Finalize label drag with undo support
  finalizeLabelDrag(context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const symbol = page.objects.find(o => o.id === this.labelDragSymbolId);
    if (!symbol) return;

    let currentOffset = null;
    let propPath = null;

    if (this.labelDragType === 'designator' && symbol.designator) {
      currentOffset = symbol.designator.offset;
      propPath = 'designator';
    } else if (this.labelDragType === 'parameter' && symbol.parameters && this.labelDragParamIndex !== null) {
      const param = symbol.parameters[this.labelDragParamIndex];
      if (param) {
        currentOffset = param.offset;
        propPath = 'parameters';
      }
    }

    if (!currentOffset) return;

    // Check if offset actually changed
    const hasChanged = currentOffset.x !== this.labelOriginalOffset.x ||
                       currentOffset.y !== this.labelOriginalOffset.y;

    if (hasChanged) {
      // Restore original
      context.history.updateState(s => {
        const newState = AsciiEditor.core.deepClone(s);
        const pg = newState.project.pages.find(p => p.id === s.activePageId);
        if (pg) {
          const sym = pg.objects.find(o => o.id === this.labelDragSymbolId);
          if (sym) {
            if (this.labelDragType === 'designator' && sym.designator) {
              sym.designator.offset = { ...this.labelOriginalOffset };
            } else if (this.labelDragType === 'parameter' && sym.parameters && this.labelDragParamIndex !== null) {
              if (sym.parameters[this.labelDragParamIndex]) {
                sym.parameters[this.labelDragParamIndex].offset = { ...this.labelOriginalOffset };
              }
            }
          }
        }
        return newState;
      });

      // Execute command for undo/redo
      if (this.labelDragType === 'designator') {
        const newDesig = { ...symbol.designator, offset: { ...currentOffset } };
        const oldDesig = { ...symbol.designator, offset: { ...this.labelOriginalOffset } };
        context.history.execute(new AsciiEditor.core.ModifyObjectCommand(
          state.activePageId,
          symbol.id,
          { designator: oldDesig },
          { designator: newDesig }
        ));
      } else if (this.labelDragType === 'parameter') {
        const newParams = symbol.parameters.map((p, i) => {
          if (i === this.labelDragParamIndex) {
            return { ...p, offset: { ...currentOffset } };
          }
          return { ...p };
        });
        const oldParams = symbol.parameters.map((p, i) => {
          if (i === this.labelDragParamIndex) {
            return { ...p, offset: { ...this.labelOriginalOffset } };
          }
          return { ...p };
        });
        context.history.execute(new AsciiEditor.core.ModifyObjectCommand(
          state.activePageId,
          symbol.id,
          { parameters: oldParams },
          { parameters: newParams }
        ));
      }
    }
  }

  // SEL-3: Visual distinction for marquee modes
  renderOverlay(ctx, context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    // Get CSS variables for colors
    const styles = getComputedStyle(document.documentElement);
    const selectionStroke = styles.getPropertyValue('--selection-stroke').trim() || '#007acc';
    const marqueeEnclosedStroke = styles.getPropertyValue('--marquee-enclosed-stroke').trim() || '#007acc';
    const marqueeEnclosedFill = styles.getPropertyValue('--marquee-enclosed-fill').trim() || 'rgba(0, 122, 204, 0.1)';
    const marqueeIntersectStroke = styles.getPropertyValue('--marquee-intersect-stroke').trim() || '#00cc7a';
    const marqueeIntersectFill = styles.getPropertyValue('--marquee-intersect-fill').trim() || 'rgba(0, 204, 122, 0.1)';
    const pinSelectionColor = styles.getPropertyValue('--accent-secondary').trim() || '#00aa66';

    // Draw marquee selection rectangle
    if (this.mode === SelectMode.MARQUEE && this.dragStart && this.dragCurrent) {
      const x1 = Math.min(this.dragStart.pixelX, this.dragCurrent.pixelX);
      const y1 = Math.min(this.dragStart.pixelY, this.dragCurrent.pixelY);
      const w = Math.abs(this.dragCurrent.pixelX - this.dragStart.pixelX);
      const h = Math.abs(this.dragCurrent.pixelY - this.dragStart.pixelY);

      const leftToRight = this.dragCurrent.col >= this.dragStart.col;

      ctx.lineWidth = 1;

      if (leftToRight) {
        // Enclosed mode: solid line
        ctx.setLineDash([]);
        ctx.strokeStyle = marqueeEnclosedStroke;
        ctx.fillStyle = marqueeEnclosedFill;
      } else {
        // Intersect mode: dashed line
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = marqueeIntersectStroke;
        ctx.fillStyle = marqueeIntersectFill;
      }

      ctx.fillRect(x1, y1, w, h);
      ctx.strokeRect(x1, y1, w, h);
      ctx.setLineDash([]);
    }

    // Draw vertex drag indicator (bind pin / create pin)
    if (this.mode === SelectMode.LINE_POINT && this.vertexDragIndicator) {
      const indicator = this.vertexDragIndicator;
      const pixel = context.grid.charToPixel(indicator.pos.x, indicator.pos.y);
      const centerX = pixel.x + context.grid.charWidth / 2;
      const centerY = pixel.y + context.grid.charHeight / 2;

      // Draw indicator circle/box
      ctx.lineWidth = 2;
      if (indicator.type === 'bind') {
        // Bind to existing pin - green indicator
        ctx.strokeStyle = '#00cc66';
        ctx.fillStyle = 'rgba(0, 204, 102, 0.3)';
      } else {
        // Create new pin - blue indicator
        ctx.strokeStyle = '#007acc';
        ctx.fillStyle = 'rgba(0, 122, 204, 0.3)';
      }

      // Draw highlight around the cell
      ctx.fillRect(pixel.x - 2, pixel.y - 2, context.grid.charWidth + 4, context.grid.charHeight + 4);
      ctx.strokeRect(pixel.x - 2, pixel.y - 2, context.grid.charWidth + 4, context.grid.charHeight + 4);

      // Draw label
      ctx.font = '10px sans-serif';
      ctx.fillStyle = indicator.type === 'bind' ? '#00cc66' : '#007acc';
      const label = indicator.type === 'bind' ? 'BIND PIN' : 'CREATE PIN';
      const labelWidth = ctx.measureText(label).width;
      ctx.fillText(label, centerX - labelWidth / 2, pixel.y - 6);
    }

    // Draw segment drag collision error indicator
    if (this.mode === SelectMode.LINE_SEGMENT && this.segmentDragPinCollision && this.segmentDragPinInfo) {
      const pinInfo = this.segmentDragPinInfo;
      const pixel = context.grid.charToPixel(pinInfo.newPos.x, pinInfo.newPos.y);

      // Red error indicator
      ctx.strokeStyle = '#ff4444';
      ctx.fillStyle = 'rgba(255, 68, 68, 0.3)';
      ctx.lineWidth = 2;

      // Draw X mark
      const size = Math.min(context.grid.charWidth, context.grid.charHeight) * 0.6;
      const centerX = pixel.x + context.grid.charWidth / 2;
      const centerY = pixel.y + context.grid.charHeight / 2;

      ctx.fillRect(pixel.x - 2, pixel.y - 2, context.grid.charWidth + 4, context.grid.charHeight + 4);
      ctx.strokeRect(pixel.x - 2, pixel.y - 2, context.grid.charWidth + 4, context.grid.charHeight + 4);

      // Draw X
      ctx.beginPath();
      ctx.moveTo(centerX - size / 2, centerY - size / 2);
      ctx.lineTo(centerX + size / 2, centerY + size / 2);
      ctx.moveTo(centerX + size / 2, centerY - size / 2);
      ctx.lineTo(centerX - size / 2, centerY + size / 2);
      ctx.stroke();

      // Draw error label
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#ff4444';
      const label = 'PIN COLLISION';
      const labelWidth = ctx.measureText(label).width;
      ctx.fillText(label, centerX - labelWidth / 2, pixel.y - 6);
    }

    // Get selection styling from CSS variables
    const selectionPadding = parseInt(styles.getPropertyValue('--selection-padding').trim()) || 4;
    const selectionDashStr = styles.getPropertyValue('--selection-dash').trim() || '4, 3';
    const selectionDash = selectionDashStr.split(',').map(s => parseInt(s.trim()));
    const selectionLineWidth = parseFloat(styles.getPropertyValue('--selection-line-width').trim()) || 1;

    // Per-object-type stroke colors
    const selectionStrokes = {
      box: styles.getPropertyValue('--selection-box-stroke').trim() || 'rgba(0, 122, 204, 0.5)',
      symbol: styles.getPropertyValue('--selection-symbol-stroke').trim() || 'rgba(204, 122, 0, 0.5)',
      line: styles.getPropertyValue('--selection-line-stroke').trim() || 'rgba(0, 122, 204, 0.5)',
      text: styles.getPropertyValue('--selection-text-stroke').trim() || 'rgba(0, 122, 204, 0.5)',
      default: styles.getPropertyValue('--selection-default-stroke').trim() || 'rgba(0, 122, 204, 0.5)'
    };

    // Draw selection rectangles for each selected object
    const isSingleSelection = state.selection.ids.length === 1;

    state.selection.ids.forEach(id => {
      const obj = page.objects.find(o => o.id === id);
      if (obj) {
        // Use getObjectBounds to handle both boxes and lines
        const bounds = this.getObjectBounds(obj);
        const { x, y } = context.grid.charToPixel(bounds.x, bounds.y);
        const width = bounds.width * context.grid.charWidth;
        const height = bounds.height * context.grid.charHeight;

        // Get stroke color for this object type
        const strokeColor = selectionStrokes[obj.type] || selectionStrokes.default;

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = selectionLineWidth;
        ctx.setLineDash(selectionDash);
        ctx.strokeRect(
          x - selectionPadding,
          y - selectionPadding,
          width + selectionPadding * 2,
          height + selectionPadding * 2
        );
        ctx.setLineDash([]);

        // SEL-22: Draw resize handles only for single selection
        if (isSingleSelection) {
          const handleSize = 6;
          ctx.fillStyle = selectionStroke;

          if (obj.type === 'line' || obj.type === 'wire') {
            // For lines/wires, draw handles at each point
            this.drawLineHandles(ctx, obj, context);
          } else {
            // Corner handles for boxes
            ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
            ctx.fillRect(x + width - handleSize/2, y - handleSize/2, handleSize, handleSize);
            ctx.fillRect(x - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
            ctx.fillRect(x + width - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
          }
        }
      }
    });

    // Draw selected pin highlight(s)
    const selectedPinIds = state.selection.pinIds || [];
    if (selectedPinIds.length > 0) {
      // Get all symbols that might contain selected pins
      state.selection.ids.forEach(symbolId => {
        const symbol = page.objects.find(o => o.id === symbolId);
        if (symbol && symbol.type === 'symbol' && symbol.pins) {
          symbol.pins.forEach(pin => {
            if (selectedPinIds.includes(pin.id)) {
              const pos = this.getPinPosition(symbol, pin);
              const pixel = context.grid.charToPixel(pos.x, pos.y);

              // Draw highlight box around the selected pin
              ctx.strokeStyle = pinSelectionColor;
              ctx.lineWidth = 2;
              ctx.setLineDash([]);
              ctx.strokeRect(
                pixel.x - 2,
                pixel.y - 2,
                context.grid.charWidth + 4,
                context.grid.charHeight + 4
              );

              // Draw corner markers
              const markerSize = 4;
              ctx.fillStyle = pinSelectionColor;
              ctx.fillRect(pixel.x - 2, pixel.y - 2, markerSize, markerSize);
              ctx.fillRect(pixel.x + context.grid.charWidth + 2 - markerSize, pixel.y - 2, markerSize, markerSize);
              ctx.fillRect(pixel.x - 2, pixel.y + context.grid.charHeight + 2 - markerSize, markerSize, markerSize);
              ctx.fillRect(pixel.x + context.grid.charWidth + 2 - markerSize, pixel.y + context.grid.charHeight + 2 - markerSize, markerSize, markerSize);
            }
          });
        }
      });
    }

    // OBJ-5A7, OBJ-5A8: Draw selected label highlight and leader line
    if (state.selection.labelType && state.selection.ids.length === 1) {
      const symbol = page.objects.find(o => o.id === state.selection.ids[0]);
      if (symbol && symbol.type === 'symbol') {
        let labelOffset = null;
        let labelText = '';

        if (state.selection.labelType === 'designator' && symbol.designator && symbol.designator.visible) {
          const desig = symbol.designator;
          labelOffset = desig.offset || { x: 0, y: -1 };
          labelText = `${desig.prefix}${desig.number}`;
        } else if (state.selection.labelType === 'parameter' && symbol.parameters && state.selection.labelParamIndex !== null) {
          const param = symbol.parameters[state.selection.labelParamIndex];
          if (param && param.visible) {
            labelOffset = param.offset || { x: 0, y: symbol.height };
            labelText = param.value || '';
          }
        }

        if (labelOffset && labelText.length > 0) {
          const labelX = symbol.x + labelOffset.x;
          const labelY = symbol.y + labelOffset.y;
          const labelPixel = context.grid.charToPixel(labelX, labelY);
          const labelWidth = labelText.length * context.grid.charWidth;

          // Draw highlight box around the selected label
          const labelSelectionColor = styles.getPropertyValue('--accent').trim() || '#007acc';
          ctx.strokeStyle = labelSelectionColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.strokeRect(
            labelPixel.x - 2,
            labelPixel.y - 2,
            labelWidth + 4,
            context.grid.charHeight + 4
          );

          // Draw corner markers
          const markerSize = 4;
          ctx.fillStyle = labelSelectionColor;
          ctx.fillRect(labelPixel.x - 2, labelPixel.y - 2, markerSize, markerSize);
          ctx.fillRect(labelPixel.x + labelWidth + 2 - markerSize, labelPixel.y - 2, markerSize, markerSize);
          ctx.fillRect(labelPixel.x - 2, labelPixel.y + context.grid.charHeight + 2 - markerSize, markerSize, markerSize);
          ctx.fillRect(labelPixel.x + labelWidth + 2 - markerSize, labelPixel.y + context.grid.charHeight + 2 - markerSize, markerSize, markerSize);

          // OBJ-5A8: Draw dashed leader line from symbol center to label
          const symbolCenterPixel = context.grid.charToPixel(
            symbol.x + Math.floor(symbol.width / 2),
            symbol.y + Math.floor(symbol.height / 2)
          );
          const symbolCX = symbolCenterPixel.x + context.grid.charWidth / 2;
          const symbolCY = symbolCenterPixel.y + context.grid.charHeight / 2;

          // Label anchor point (center of label)
          const labelCX = labelPixel.x + labelWidth / 2;
          const labelCY = labelPixel.y + context.grid.charHeight / 2;

          // Draw dashed line
          ctx.strokeStyle = labelSelectionColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(symbolCX, symbolCY);
          ctx.lineTo(labelCX, labelCY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw small circle at symbol center
          ctx.fillStyle = labelSelectionColor;
          ctx.beginPath();
          ctx.arc(symbolCX, symbolCY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Draw handles at each point of a line
  drawLineHandles(ctx, obj, context) {
    if (!obj.points) return;

    const handleSize = 6;
    const segmentHandleSize = 4;
    const arrowSize = 3;
    const arrowOffset = 8;

    // Get handle colors from CSS variables
    const styles = getComputedStyle(document.documentElement);
    const vertexColor = styles.getPropertyValue('--vertex-handle').trim() || '#007acc';
    const segmentColor = styles.getPropertyValue('--segment-handle').trim() || '#00aa66';

    // Draw segment handles (midpoints) first, so vertex handles appear on top
    for (let i = 0; i < obj.points.length - 1; i++) {
      const p1 = obj.points[i];
      const p2 = obj.points[i + 1];

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      const midPixelX = midX * context.grid.charWidth + context.grid.charWidth / 2;
      const midPixelY = midY * context.grid.charHeight + context.grid.charHeight / 2;

      const isHorizontal = (p1.y === p2.y);

      // Draw square handle (thinner for segments)
      ctx.fillStyle = segmentColor;
      ctx.fillRect(midPixelX - segmentHandleSize/2, midPixelY - segmentHandleSize/2, segmentHandleSize, segmentHandleSize);

      // Draw directional arrows
      ctx.strokeStyle = segmentColor;
      ctx.lineWidth = 1;

      if (isHorizontal) {
        // Up/down arrows for horizontal segments
        // Up arrow
        ctx.beginPath();
        ctx.moveTo(midPixelX, midPixelY - arrowOffset);
        ctx.lineTo(midPixelX - arrowSize, midPixelY - arrowOffset + arrowSize);
        ctx.moveTo(midPixelX, midPixelY - arrowOffset);
        ctx.lineTo(midPixelX + arrowSize, midPixelY - arrowOffset + arrowSize);
        ctx.stroke();
        // Down arrow
        ctx.beginPath();
        ctx.moveTo(midPixelX, midPixelY + arrowOffset);
        ctx.lineTo(midPixelX - arrowSize, midPixelY + arrowOffset - arrowSize);
        ctx.moveTo(midPixelX, midPixelY + arrowOffset);
        ctx.lineTo(midPixelX + arrowSize, midPixelY + arrowOffset - arrowSize);
        ctx.stroke();
      } else {
        // Left/right arrows for vertical segments
        // Left arrow
        ctx.beginPath();
        ctx.moveTo(midPixelX - arrowOffset, midPixelY);
        ctx.lineTo(midPixelX - arrowOffset + arrowSize, midPixelY - arrowSize);
        ctx.moveTo(midPixelX - arrowOffset, midPixelY);
        ctx.lineTo(midPixelX - arrowOffset + arrowSize, midPixelY + arrowSize);
        ctx.stroke();
        // Right arrow
        ctx.beginPath();
        ctx.moveTo(midPixelX + arrowOffset, midPixelY);
        ctx.lineTo(midPixelX + arrowOffset - arrowSize, midPixelY - arrowSize);
        ctx.moveTo(midPixelX + arrowOffset, midPixelY);
        ctx.lineTo(midPixelX + arrowOffset - arrowSize, midPixelY + arrowSize);
        ctx.stroke();
      }
    }

    // Draw vertex handles (squares with 45-degree arrows)
    ctx.fillStyle = vertexColor;
    ctx.strokeStyle = vertexColor;
    ctx.lineWidth = 1.5;

    obj.points.forEach(point => {
      const pixel = context.grid.charToPixel(point.x, point.y);
      const cx = pixel.x + context.grid.charWidth / 2;
      const cy = pixel.y + context.grid.charHeight / 2;

      // Draw square handle
      ctx.fillRect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize);

      // Draw 45-degree arrows (NE, SE, SW, NW)
      const diagOffset = 7;
      const diagArrow = 3;

      // NE arrow
      ctx.beginPath();
      ctx.moveTo(cx + diagOffset, cy - diagOffset);
      ctx.lineTo(cx + diagOffset - diagArrow, cy - diagOffset);
      ctx.moveTo(cx + diagOffset, cy - diagOffset);
      ctx.lineTo(cx + diagOffset, cy - diagOffset + diagArrow);
      ctx.stroke();

      // SE arrow
      ctx.beginPath();
      ctx.moveTo(cx + diagOffset, cy + diagOffset);
      ctx.lineTo(cx + diagOffset - diagArrow, cy + diagOffset);
      ctx.moveTo(cx + diagOffset, cy + diagOffset);
      ctx.lineTo(cx + diagOffset, cy + diagOffset - diagArrow);
      ctx.stroke();

      // SW arrow
      ctx.beginPath();
      ctx.moveTo(cx - diagOffset, cy + diagOffset);
      ctx.lineTo(cx - diagOffset + diagArrow, cy + diagOffset);
      ctx.moveTo(cx - diagOffset, cy + diagOffset);
      ctx.lineTo(cx - diagOffset, cy + diagOffset - diagArrow);
      ctx.stroke();

      // NW arrow
      ctx.beginPath();
      ctx.moveTo(cx - diagOffset, cy - diagOffset);
      ctx.lineTo(cx - diagOffset + diagArrow, cy - diagOffset);
      ctx.moveTo(cx - diagOffset, cy - diagOffset);
      ctx.lineTo(cx - diagOffset, cy - diagOffset + diagArrow);
      ctx.stroke();
    });
  }
};
