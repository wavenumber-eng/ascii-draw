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
  RESIZING: 'resizing'            // Resizing single object
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
    this.draggedIds = [];
    this.originalPositions = {};
    this.activeHandle = null;
    this.resizeOriginal = null;
    this.addToSelection = false;  // Ctrl key held
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
  }

  onMouseDown(event, context) {
    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
    const state = context.history.getState();
    this.addToSelection = event.ctrlKey;
    this.dragStart = { col, row, pixelX: event.canvasX, pixelY: event.canvasY };
    this.dragCurrent = { col, row };

    // Check for resize handle hit (single selection only) - SEL-22
    if (state.selection.ids.length === 1) {
      const handle = this.hitTestHandle(event.canvasX, event.canvasY, context);
      if (handle) {
        this.mode = SelectMode.RESIZING;
        this.activeHandle = handle.position;
        this.resizeOriginal = { ...handle.obj };
        return true;
      }
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
              handles: null
            }
          }));
        } else {
          context.history.updateState(s => ({
            ...s,
            selection: {
              ids: [...s.selection.ids, hit.id],
              handles: null
            }
          }));
        }
      } else {
        // SEL-10: Regular click - select this object
        if (!isAlreadySelected) {
          context.history.updateState(s => ({
            ...s,
            selection: { ids: [hit.id], handles: null }
          }));
        }
      }

      // Prepare for dragging
      this.mode = SelectMode.DRAGGING;
      const currentState = context.history.getState();
      this.draggedIds = [...currentState.selection.ids];

      // Store original positions of all selected objects
      const page = currentState.project.pages.find(p => p.id === currentState.activePageId);
      if (page) {
        this.originalPositions = {};
        this.draggedIds.forEach(id => {
          const obj = page.objects.find(o => o.id === id);
          if (obj) {
            this.originalPositions[id] = { x: obj.x, y: obj.y };
          }
        });
      }
    } else {
      // SEL-12: Click on empty space - deselect or start marquee
      if (!event.ctrlKey) {
        context.history.updateState(s => ({
          ...s,
          selection: { ids: [], handles: null }
        }));
      }
      this.mode = SelectMode.MARQUEE;
    }

    return true;
  }

  onMouseMove(event, context) {
    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
    this.dragCurrent = { col, row, pixelX: event.canvasX, pixelY: event.canvasY };

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

    if (this.mode === SelectMode.MARQUEE) {
      return true;  // Just redraw to show marquee
    }

    // Update cursor based on what's under mouse
    const state = context.history.getState();
    if (state.selection.ids.length === 1) {
      const handle = this.hitTestHandle(event.canvasX, event.canvasY, context);
      if (handle) {
        context.canvas.style.cursor = this.getHandleCursor(handle.position);
        return false;
      }
    }

    const hit = this.hitTestObject(col, row, context);
    context.canvas.style.cursor = hit ? 'move' : 'default';

    return false;
  }

  onMouseUp(event, context) {
    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);

    if (this.mode === SelectMode.DRAGGING && this.draggedIds.length > 0) {
      const dx = col - this.dragStart.col;
      const dy = row - this.dragStart.row;

      if (dx !== 0 || dy !== 0) {
        // Restore original positions first
        context.history.updateState(state => {
          const newState = AsciiEditor.core.deepClone(state);
          const page = newState.project.pages.find(p => p.id === state.activePageId);
          if (page) {
            this.draggedIds.forEach(id => {
              const obj = page.objects.find(o => o.id === id);
              const orig = this.originalPositions[id];
              if (obj && orig) {
                obj.x = orig.x;
                obj.y = orig.y;
              }
            });
          }
          return newState;
        });

        // Execute move commands for undo/redo
        const state = context.history.getState();
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
      }
    }

    if (this.mode === SelectMode.RESIZING && this.resizeOriginal) {
      this.finalizeResize(context);
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
            selection: { ids: [], handles: null }
          }));
        }
        return true;
      }
    }

    // SEL-31: Type to edit - if single box selected and printable key pressed, start editing
    if (state.selection.ids.length === 1 && event.key.length === 1 && !event.ctrlKey && !event.altKey) {
      const page = state.project.pages.find(p => p.id === state.activePageId);
      if (page) {
        const obj = page.objects.find(o => o.id === state.selection.ids[0]);
        if (obj && obj.type === 'box' && context.startInlineEdit) {
          context.startInlineEdit(obj, event.key);  // Pass initial character
          return true;
        }
      }
    }

    return false;
  }

  // SEL-30: Double-click to edit
  onDoubleClick(event, context) {
    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
    const hit = this.hitTestObject(col, row, context);

    if (hit && hit.type === 'box') {
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
      const objX1 = obj.x;
      const objY1 = obj.y;
      const objX2 = obj.x + (obj.width || 10) - 1;
      const objY2 = obj.y + (obj.height || 3) - 1;

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
        selection: { ids: newIds, handles: null }
      }));
    } else {
      context.history.updateState(s => ({
        ...s,
        selection: { ids: selectedIds, handles: null }
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

    const { x, y } = context.grid.charToPixel(obj.x, obj.y);
    const width = (obj.width || 10) * context.grid.charWidth;
    const height = (obj.height || 3) * context.grid.charHeight;

    const handleSize = 8;
    const handles = [
      { position: HandlePosition.TOP_LEFT, hx: x, hy: y },
      { position: HandlePosition.TOP_RIGHT, hx: x + width, hy: y },
      { position: HandlePosition.BOTTOM_LEFT, hx: x, hy: y + height },
      { position: HandlePosition.BOTTOM_RIGHT, hx: x + width, hy: y + height }
    ];

    for (const h of handles) {
      if (Math.abs(pixelX - h.hx) <= handleSize && Math.abs(pixelY - h.hy) <= handleSize) {
        return { position: h.position, obj };
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
    const width = obj.width || 10;
    const height = obj.height || 3;
    return col >= obj.x && col < obj.x + width &&
           row >= obj.y && row < obj.y + height;
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

    // Draw selection rectangles for each selected object
    const isSingleSelection = state.selection.ids.length === 1;

    state.selection.ids.forEach(id => {
      const obj = page.objects.find(o => o.id === id);
      if (obj) {
        const { x, y } = context.grid.charToPixel(obj.x, obj.y);
        const width = (obj.width || 10) * context.grid.charWidth;
        const height = (obj.height || 3) * context.grid.charHeight;

        ctx.strokeStyle = selectionStroke;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(x - 1, y - 1, width + 2, height + 2);

        // SEL-22: Draw resize handles only for single selection
        if (isSingleSelection) {
          const handleSize = 6;
          ctx.fillStyle = selectionStroke;

          // Corner handles
          ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
          ctx.fillRect(x + width - handleSize/2, y - handleSize/2, handleSize, handleSize);
          ctx.fillRect(x - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
          ctx.fillRect(x + width - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
        }
      }
    });
  }
};
