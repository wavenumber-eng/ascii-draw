/**
 * Canvas2DOverlay - 2D canvas overlay rendering
 *
 * Implements: OVER-1 to OVER-63
 *
 * This renderer handles TRANSIENT UI ELEMENTS that are NEVER exported:
 * - Selection highlights and resize handles
 * - Marquee selection rectangles
 * - Tool previews (box preview, line rubber-banding)
 * - Connection hints and snap indicators
 * - Drag ghosts and feedback
 * - Inline editing cursors
 *
 * Refactored from: Renderer.js overlay methods + tool renderOverlay()
 */
var AsciiEditor = AsciiEditor || {};
AsciiEditor.overlays = AsciiEditor.overlays || {};

AsciiEditor.overlays.Canvas2DOverlay = class Canvas2DOverlay extends AsciiEditor.overlays.IOverlayRenderer {

  constructor() {
    super();
    this.viewport = null;
    this.ctx = null;
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  /**
   * Initialize the overlay renderer with a viewport
   *
   * @param {IViewport} viewport - The viewport this overlay renders on
   */
  initialize(viewport) {
    this.viewport = viewport;
    this.ctx = viewport.getContext();
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.viewport = null;
    this.ctx = null;
  }

  // ============================================================
  // Frame Management
  // ============================================================

  beginFrame() {
    // Nothing to prepare
  }

  endFrame() {
    // Nothing to flush
  }

  /**
   * Clear all overlays
   */
  clear() {
    // Overlays are drawn on top of content, clearing is handled by viewport
    // This method exists for compatibility with other overlay implementations
  }

  // ============================================================
  // Selection Overlays
  // ============================================================

  /**
   * Draw selection highlight around an object
   *
   * @param {Object} obj - The selected object
   * @param {Object} [style] - Style options
   */
  drawSelectionHighlight(obj, style = {}) {
    if (!this.ctx || !this.viewport) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const selectionColor = style.color || cssStyles.getPropertyValue('--accent').trim() || '#007acc';

    // Calculate bounds in pixels
    const x = obj.x * dims.width;
    const y = obj.y * dims.height;
    const width = obj.width * dims.width;
    const height = obj.height * dims.height;

    // Draw selection rectangle
    this.ctx.strokeStyle = selectionColor;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
    this.ctx.setLineDash([]);
  }

  /**
   * Draw bounding box for multi-selection
   *
   * @param {Object} bounds - Bounding rectangle in cell coordinates
   */
  drawMultiSelectionBox(bounds) {
    if (!this.ctx || !this.viewport) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const selectionColor = cssStyles.getPropertyValue('--accent').trim() || '#007acc';

    const x = bounds.x * dims.width;
    const y = bounds.y * dims.height;
    const width = bounds.width * dims.width;
    const height = bounds.height * dims.height;

    this.ctx.strokeStyle = selectionColor;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 3]);
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.setLineDash([]);
  }

  /**
   * Draw resize handles for a selected object
   *
   * @param {Object} obj - The object with resize handles
   * @param {Array<Object>} handles - Array of handle definitions
   */
  drawResizeHandles(obj, handles) {
    if (!this.ctx || !this.viewport || !handles) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const handleColor = cssStyles.getPropertyValue('--accent').trim() || '#007acc';
    const handleBg = cssStyles.getPropertyValue('--bg-canvas').trim() || '#1a1a1a';

    const handleSize = 8;

    handles.forEach(handle => {
      const x = handle.col * dims.width + dims.width / 2;
      const y = handle.row * dims.height + dims.height / 2;

      // Draw handle background
      this.ctx.fillStyle = handleBg;
      this.ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);

      // Draw handle border
      this.ctx.strokeStyle = handleColor;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
    });
  }

  // ============================================================
  // Marquee Selection
  // ============================================================

  /**
   * Draw marquee selection rectangle
   *
   * @param {Object} bounds - Rectangle bounds in cell coordinates
   * @param {string} mode - Selection mode ('enclosed' | 'intersect')
   */
  drawMarquee(bounds, mode) {
    if (!this.ctx || !this.viewport) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const accent = cssStyles.getPropertyValue('--accent').trim() || '#007acc';

    const x = bounds.x * dims.width;
    const y = bounds.y * dims.height;
    const width = bounds.width * dims.width;
    const height = bounds.height * dims.height;

    // Different styles for different modes
    if (mode === 'enclosed') {
      // Solid line for enclosed mode
      this.ctx.strokeStyle = accent;
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([]);
    } else {
      // Dashed line for intersect mode
      this.ctx.strokeStyle = accent;
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([4, 4]);
    }

    this.ctx.strokeRect(x, y, width, height);

    // Fill with semi-transparent color
    this.ctx.fillStyle = accent + '20'; // 20 = 12.5% opacity
    this.ctx.fillRect(x, y, width, height);

    this.ctx.setLineDash([]);
  }

  // ============================================================
  // Tool Hints and Previews
  // ============================================================

  /**
   * Draw tool preview (box outline, line path, etc.)
   *
   * @param {Object} preview - Preview definition
   */
  drawToolPreview(preview) {
    if (!this.ctx || !this.viewport) return;

    switch (preview.type) {
      case 'box':
        this._drawBoxPreview(preview);
        break;
      case 'line':
        this._drawLinePreview(preview);
        break;
      case 'wire':
        this._drawWirePreview(preview);
        break;
      case 'symbol':
        this._drawSymbolPreview(preview);
        break;
      case 'text':
        this._drawTextPreview(preview);
        break;
    }
  }

  /**
   * Draw snap indicator at grid position
   *
   * @param {number} col - Cell column
   * @param {number} row - Cell row
   */
  drawSnapIndicator(col, row) {
    if (!this.ctx || !this.viewport) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const accent = cssStyles.getPropertyValue('--accent').trim() || '#007acc';

    const x = col * dims.width + dims.width / 2;
    const y = row * dims.height + dims.height / 2;

    // Draw crosshair
    this.ctx.strokeStyle = accent;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x - 5, y);
    this.ctx.lineTo(x + 5, y);
    this.ctx.moveTo(x, y - 5);
    this.ctx.lineTo(x, y + 5);
    this.ctx.stroke();
  }

  /**
   * Draw connection hint label
   *
   * @param {Object} pos - Position in cell coordinates
   * @param {string} label - Hint text ('PIN', 'CONNECT', etc.)
   */
  drawConnectionHint(pos, label) {
    if (!this.ctx || !this.viewport) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const accent = cssStyles.getPropertyValue('--accent-secondary').trim() || '#00aa66';
    const bgCanvas = cssStyles.getPropertyValue('--bg-canvas').trim() || '#1a1a1a';

    const x = pos.col * dims.width;
    const y = pos.row * dims.height - 14;

    // Draw background
    this.ctx.font = '10px monospace';
    const textWidth = this.ctx.measureText(label).width;
    this.ctx.fillStyle = bgCanvas;
    this.ctx.fillRect(x - 2, y - 10, textWidth + 4, 12);

    // Draw text
    this.ctx.fillStyle = accent;
    this.ctx.fillText(label, x, y);
  }

  /**
   * Draw hover highlight on object under cursor
   *
   * @param {Object} obj - The object being hovered
   */
  drawHoverHighlight(obj) {
    if (!this.ctx || !this.viewport) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const hoverColor = cssStyles.getPropertyValue('--accent').trim() || '#007acc';

    const x = obj.x * dims.width;
    const y = obj.y * dims.height;
    const width = obj.width * dims.width;
    const height = obj.height * dims.height;

    this.ctx.strokeStyle = hoverColor + '60'; // 60 = 37.5% opacity
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x - 1, y - 1, width + 2, height + 2);
  }

  // ============================================================
  // Drag Feedback
  // ============================================================

  /**
   * Draw ghost of objects being dragged
   *
   * @param {Array<Object>} objects - Objects being dragged
   * @param {Object} offset - Drag offset in cells
   */
  drawDragGhost(objects, offset) {
    if (!this.ctx || !this.viewport) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const ghostColor = cssStyles.getPropertyValue('--accent').trim() || '#007acc';

    this.ctx.globalAlpha = 0.5;

    objects.forEach(obj => {
      const x = (obj.x + offset.col) * dims.width;
      const y = (obj.y + offset.row) * dims.height;
      const width = (obj.width || 1) * dims.width;
      const height = (obj.height || 1) * dims.height;

      this.ctx.strokeStyle = ghostColor;
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([2, 2]);
      this.ctx.strokeRect(x, y, width, height);
      this.ctx.setLineDash([]);
    });

    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Draw rubber-band line (for line/wire drawing)
   *
   * @param {Object} start - Start position in cells
   * @param {Object} end - End position in cells
   * @param {string} [style] - Line style hint
   */
  drawRubberBand(start, end, style) {
    if (!this.ctx || !this.viewport) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const lineColor = cssStyles.getPropertyValue('--accent').trim() || '#007acc';

    const x1 = start.col * dims.width + dims.width / 2;
    const y1 = start.row * dims.height + dims.height / 2;
    const x2 = end.col * dims.width + dims.width / 2;
    const y2 = end.row * dims.height + dims.height / 2;

    this.ctx.strokeStyle = lineColor;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  // ============================================================
  // Inline Editing
  // ============================================================

  /**
   * Draw text cursor for inline editing
   *
   * @param {number} col - Cursor column
   * @param {number} row - Cursor row
   * @param {boolean} visible - Whether cursor is visible (for blinking)
   */
  drawTextCursor(col, row, visible) {
    if (!this.ctx || !this.viewport || !visible) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const cursorColor = cssStyles.getPropertyValue('--accent').trim() || '#007acc';

    const x = col * dims.width;
    const y = row * dims.height;

    this.ctx.fillStyle = cursorColor;
    this.ctx.fillRect(x, y + 2, 2, dims.height - 4);
  }

  /**
   * Draw text selection highlight
   *
   * @param {Object} start - Selection start in cells
   * @param {Object} end - Selection end in cells
   */
  drawTextSelection(start, end) {
    if (!this.ctx || !this.viewport) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const selectionColor = cssStyles.getPropertyValue('--accent').trim() || '#007acc';

    const x1 = Math.min(start.col, end.col) * dims.width;
    const y1 = Math.min(start.row, end.row) * dims.height;
    const x2 = Math.max(start.col, end.col) * dims.width + dims.width;
    const y2 = Math.max(start.row, end.row) * dims.height + dims.height;

    this.ctx.fillStyle = selectionColor + '40'; // 40 = 25% opacity
    this.ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  }

  // ============================================================
  // Vertex/Segment Handles (Lines/Wires)
  // ============================================================

  /**
   * Draw vertex handle for line/wire editing
   *
   * @param {number} col - Handle column
   * @param {number} row - Handle row
   * @param {string} type - Handle type ('endpoint', 'intermediate', 'selected')
   */
  drawVertexHandle(col, row, type) {
    if (!this.ctx || !this.viewport) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const accent = cssStyles.getPropertyValue('--accent').trim() || '#007acc';
    const bgCanvas = cssStyles.getPropertyValue('--bg-canvas').trim() || '#1a1a1a';

    const x = col * dims.width + dims.width / 2;
    const y = row * dims.height + dims.height / 2;
    const size = type === 'endpoint' ? 8 : 6;

    // Draw filled circle
    this.ctx.beginPath();
    this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    this.ctx.fillStyle = type === 'selected' ? accent : bgCanvas;
    this.ctx.fill();
    this.ctx.strokeStyle = accent;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  /**
   * Draw segment handle (midpoint) for line/wire editing
   *
   * @param {number} col - Handle column
   * @param {number} row - Handle row
   * @param {string} orientation - Segment orientation ('h' for horizontal, 'v' for vertical)
   */
  drawSegmentHandle(col, row, orientation) {
    if (!this.ctx || !this.viewport) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const accent = cssStyles.getPropertyValue('--accent').trim() || '#007acc';
    const bgCanvas = cssStyles.getPropertyValue('--bg-canvas').trim() || '#1a1a1a';

    const x = col * dims.width + dims.width / 2;
    const y = row * dims.height + dims.height / 2;
    const width = orientation === 'h' ? 10 : 6;
    const height = orientation === 'h' ? 6 : 10;

    // Draw rectangle
    this.ctx.fillStyle = bgCanvas;
    this.ctx.fillRect(x - width/2, y - height/2, width, height);
    this.ctx.strokeStyle = accent;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - width/2, y - height/2, width, height);
  }

  // ============================================================
  // Pin Handles (Symbols)
  // ============================================================

  /**
   * Draw pin handle for symbol editing
   *
   * @param {Object} pos - Pin position in cells
   * @param {boolean} selected - Whether pin is selected
   */
  drawPinHandle(pos, selected) {
    if (!this.ctx || !this.viewport) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const accent = cssStyles.getPropertyValue('--accent').trim() || '#007acc';

    const x = pos.col * dims.width + dims.width / 2;
    const y = pos.row * dims.height + dims.height / 2;

    this.ctx.beginPath();
    this.ctx.arc(x, y, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = selected ? accent : 'transparent';
    this.ctx.fill();
    this.ctx.strokeStyle = accent;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  /**
   * Draw pin drop target indicator
   *
   * @param {Object} pos - Target position in cells
   * @param {boolean} valid - Whether this is a valid drop location
   */
  drawPinDropTarget(pos, valid) {
    if (!this.ctx || !this.viewport) return;

    const dims = this.viewport.getCellDimensions();
    const color = valid ? '#00aa66' : '#aa0000';

    const x = pos.col * dims.width;
    const y = pos.row * dims.height;

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([2, 2]);
    this.ctx.strokeRect(x, y, dims.width, dims.height);
    this.ctx.setLineDash([]);
  }

  // ============================================================
  // Capabilities
  // ============================================================

  /**
   * Get overlay renderer type identifier
   *
   * @returns {string} 'canvas2d'
   */
  getType() {
    return 'canvas2d';
  }

  // ============================================================
  // Private Methods - Tool Previews
  // ============================================================

  _drawBoxPreview(preview) {
    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const accent = cssStyles.getPropertyValue('--accent').trim() || '#007acc';

    const bounds = preview.bounds;
    const x = bounds.x * dims.width;
    const y = bounds.y * dims.height;
    const width = bounds.width * dims.width;
    const height = bounds.height * dims.height;

    this.ctx.strokeStyle = accent;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.setLineDash([]);
  }

  _drawLinePreview(preview) {
    if (!preview.points || preview.points.length < 2) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const accent = cssStyles.getPropertyValue('--accent').trim() || '#007acc';

    this.ctx.strokeStyle = accent;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();

    const first = preview.points[0];
    this.ctx.moveTo(first.x * dims.width + dims.width / 2, first.y * dims.height + dims.height / 2);

    for (let i = 1; i < preview.points.length; i++) {
      const p = preview.points[i];
      this.ctx.lineTo(p.x * dims.width + dims.width / 2, p.y * dims.height + dims.height / 2);
    }

    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  _drawWirePreview(preview) {
    // Wire preview is same as line preview with different color
    if (!preview.points || preview.points.length < 2) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const accentSecondary = cssStyles.getPropertyValue('--accent-secondary').trim() || '#00aa66';

    this.ctx.strokeStyle = accentSecondary;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();

    const first = preview.points[0];
    this.ctx.moveTo(first.x * dims.width + dims.width / 2, first.y * dims.height + dims.height / 2);

    for (let i = 1; i < preview.points.length; i++) {
      const p = preview.points[i];
      this.ctx.lineTo(p.x * dims.width + dims.width / 2, p.y * dims.height + dims.height / 2);
    }

    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  _drawSymbolPreview(preview) {
    const bounds = preview.bounds;
    this._drawBoxPreview({ bounds });
  }

  _drawTextPreview(preview) {
    if (!preview.position) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const accent = cssStyles.getPropertyValue('--accent').trim() || '#007acc';

    const x = preview.position.col * dims.width;
    const y = preview.position.row * dims.height;

    // Draw cursor indicator
    this.ctx.strokeStyle = accent;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x, y + dims.height);
    this.ctx.stroke();
  }
};
