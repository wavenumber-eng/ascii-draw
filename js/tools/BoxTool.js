/**
 * BoxTool - Create rectangular boxes
 * Implements: TOOL-21, OBJ-10 to OBJ-17
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.tools = AsciiEditor.tools || {};

AsciiEditor.tools.BoxTool = class BoxTool extends AsciiEditor.tools.Tool {
  constructor() {
    super('box');
    this.cursor = 'none'; // Hide browser cursor, we draw our own
    this.drawing = false;
    this.startPos = null;
    this.currentPos = null;
  }

  activate(context) {
    this.drawing = false;
    this.currentPos = null;
    context.setCursor(this.cursor);
  }

  deactivate() {
    this.drawing = false;
    this.startPos = null;
    this.currentPos = null;
  }

  onMouseDown(event, context) {
    // Use col/row from event (viewport handles coordinate conversion)
    const col = event.col;
    const row = event.row;

    // TOOL-21A/B: Two-click interaction
    if (!this.drawing) {
      // First click: set corner 1
      this.drawing = true;
      this.startPos = { col, row };
      this.currentPos = { col, row };
      return true;
    } else {
      // Second click: create the box
      this.currentPos = { col, row };

      // Calculate box bounds
      const x = Math.min(this.startPos.col, this.currentPos.col);
      const y = Math.min(this.startPos.row, this.currentPos.row);
      const width = Math.abs(this.currentPos.col - this.startPos.col) + 1;
      const height = Math.abs(this.currentPos.row - this.startPos.row) + 1;

      // OBJ-11: Minimum size 3x3 (also handles TOOL-21D: same location = degenerate)
      if (width >= 3 && height >= 3) {
        const state = context.history.getState();
        // TOOL-21: Create text box object
        const newBox = {
          id: AsciiEditor.core.generateId(),
          type: 'box',
          x, y, width, height,
          text: '',
          style: 'single',  // OBJ-12: single, double, thick, none
          shadow: false,    // OBJ-14: Optional drop shadow
          fill: 'none',     // OBJ-16, OBJ-17: Interior fill character
          textJustify: 'center-center'  // OBJ-15: 9-position justification
        };

        context.history.execute(new AsciiEditor.core.CreateObjectCommand(state.activePageId, newBox));

        // Select the new box
        context.history.updateState(s => ({
          ...s,
          selection: { ids: [newBox.id], handles: null }
        }));
      }

      this.drawing = false;
      this.startPos = null;
      this.currentPos = null;
      return true;
    }
  }

  onMouseMove(event, context) {
    // Use col/row from event (viewport handles coordinate conversion)
    this.currentPos = { col: event.col, row: event.row };
    return true; // Always redraw for crosshair
  }

  onMouseUp(event, context) {
    // TOOL-21F: Mouse can move freely between clicks (no drag required)
    return false;
  }

  // Allow typing when a box is selected while in box tool mode
  onKeyDown(event, context) {
    // TOOL-21C: Escape before second click cancels creation
    if (event.key === 'Escape' && this.drawing) {
      this.drawing = false;
      this.startPos = null;
      this.currentPos = null;
      return true;
    }

    const state = context.history.getState();

    // If single box selected and printable key, start inline edit
    if (state.selection.ids.length === 1 && event.key.length === 1 && !event.ctrlKey && !event.altKey) {
      const page = state.project.pages.find(p => p.id === state.activePageId);
      if (page) {
        const obj = page.objects.find(o => o.id === state.selection.ids[0]);
        if (obj && obj.type === 'box' && context.startInlineEdit) {
          context.startInlineEdit(obj, event.key);
          return true;
        }
      }
    }
    return false;
  }

  renderOverlay(overlay, context) {
    if (!this.drawing && this.currentPos) {
      overlay.drawCrosshair(this.currentPos.col, this.currentPos.row);
    }

    if (this.drawing && this.startPos && this.currentPos) {
      const x = Math.min(this.startPos.col, this.currentPos.col);
      const y = Math.min(this.startPos.row, this.currentPos.row);
      const w = Math.abs(this.currentPos.col - this.startPos.col) + 1;
      const h = Math.abs(this.currentPos.row - this.startPos.row) + 1;
      overlay.drawCellRect(x, y, w, h, {
        dash: [5, 3],
        sizeLabel: `${w}x${h}`
      });
    }
  }
};
