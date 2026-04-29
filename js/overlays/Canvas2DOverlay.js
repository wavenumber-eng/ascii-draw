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

  // ============================================================
  // Cell-coordinate primitives (new tool-overlay API)
  // Tools should call these instead of touching ctx directly.
  // ============================================================

  _accent() {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#007acc';
  }
  _accentSecondary() {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent-secondary').trim() || '#00aa66';
  }
  _bgCanvas() {
    return getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim() || '#1a1a1a';
  }
  _textCanvas() {
    return getComputedStyle(document.documentElement).getPropertyValue('--text-canvas').trim() || '#cccccc';
  }
  _cellCenter(col, row) {
    const d = this.viewport.getCellDimensions();
    return { x: col * d.width + d.width / 2, y: row * d.height + d.height / 2 };
  }
  _cellOrigin(col, row) {
    const d = this.viewport.getCellDimensions();
    return { x: col * d.width, y: row * d.height };
  }

  /** Crosshair at cell center. opts: { color, size }. */
  drawCrosshair(col, row, opts = {}) {
    if (!this.ctx) return;
    const { x, y } = this._cellCenter(col, row);
    const size = opts.size || 8;
    this.ctx.strokeStyle = opts.color || this._accent();
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([]);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - size); this.ctx.lineTo(x, y + size);
    this.ctx.moveTo(x - size, y); this.ctx.lineTo(x + size, y);
    this.ctx.stroke();
  }

  /** ASCII glyph at one cell. opts: { color, font, bgColor }. */
  drawCellGlyph(col, row, char, opts = {}) {
    if (!this.ctx) return;
    const d = this.viewport.getCellDimensions();
    const { x: ox, y: oy } = this._cellOrigin(col, row);
    if (opts.bgColor) {
      this.ctx.fillStyle = opts.bgColor;
      this.ctx.fillRect(ox, oy, d.width, d.height);
    }
    this.ctx.fillStyle = opts.color || this._textCanvas();
    this.ctx.font = opts.font || '16px BerkeleyMono, monospace';
    this.ctx.textBaseline = 'middle';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(char, ox + d.width / 2, oy + d.height / 2);
  }

  /** Rect spanning a cell range (col,row,w,h in cells).
   *  opts: { strokeColor, fillColor, dash, lineWidth, sizeLabel } */
  drawCellRect(col, row, w, h, opts = {}) {
    if (!this.ctx) return;
    const d = this.viewport.getCellDimensions();
    const x = col * d.width;
    const y = row * d.height;
    const px = w * d.width;
    const py = h * d.height;
    if (opts.fillColor) {
      this.ctx.fillStyle = opts.fillColor;
      this.ctx.fillRect(x, y, px, py);
    }
    this.ctx.strokeStyle = opts.strokeColor || this._accent();
    this.ctx.lineWidth = opts.lineWidth || 1;
    this.ctx.setLineDash(opts.dash || []);
    this.ctx.strokeRect(x, y, px, py);
    this.ctx.setLineDash([]);
    if (opts.sizeLabel) {
      this.ctx.font = '11px sans-serif';
      this.ctx.fillStyle = opts.strokeColor || this._accent();
      this.ctx.textBaseline = 'alphabetic';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(opts.sizeLabel, x + 4, y - 4);
    }
  }

  /** Highlight a single cell with optional corner markers + label.
   *  opts: { strokeColor, fillColor, label, labelColor, cornerMarkers, padding, lineWidth } */
  drawCellHighlight(col, row, opts = {}) {
    if (!this.ctx) return;
    const d = this.viewport.getCellDimensions();
    const { x, y } = this._cellOrigin(col, row);
    const pad = opts.padding ?? 2;
    const w = d.width + pad * 2;
    const h = d.height + pad * 2;
    if (opts.fillColor) {
      this.ctx.fillStyle = opts.fillColor;
      this.ctx.fillRect(x - pad, y - pad, w, h);
    }
    this.ctx.strokeStyle = opts.strokeColor || this._accent();
    this.ctx.lineWidth = opts.lineWidth || 2;
    this.ctx.setLineDash([]);
    this.ctx.strokeRect(x - pad, y - pad, w, h);
    if (opts.cornerMarkers) {
      const m = 4;
      this.ctx.fillStyle = opts.strokeColor || this._accent();
      this.ctx.fillRect(x - pad,         y - pad,         m, m);
      this.ctx.fillRect(x + w - pad - m, y - pad,         m, m);
      this.ctx.fillRect(x - pad,         y + h - pad - m, m, m);
      this.ctx.fillRect(x + w - pad - m, y + h - pad - m, m, m);
    }
    if (opts.label) {
      this.ctx.font = '10px sans-serif';
      this.ctx.fillStyle = opts.labelColor || opts.strokeColor || this._accent();
      this.ctx.textBaseline = 'alphabetic';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(opts.label, x + d.width / 2, y - pad - 4);
    }
  }

  /** Small filled circle at a cell center. opts: { color, radius }. */
  drawDot(col, row, opts = {}) {
    if (!this.ctx) return;
    const { x, y } = this._cellCenter(col, row);
    this.ctx.fillStyle = opts.color || this._accent();
    this.ctx.beginPath();
    this.ctx.arc(x, y, opts.radius || 3, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /** Glowing connection ring (CONNECT/JOIN/EXTEND/BIND/CREATE PIN style).
   *  opts: { color, glowColor, label, radius, withCenterDot } */
  drawConnectionRing(col, row, opts = {}) {
    if (!this.ctx) return;
    const { x, y } = this._cellCenter(col, row);
    const r = opts.radius || 8;
    const color = opts.color || this._accentSecondary();
    this.ctx.setLineDash([]);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.strokeStyle = opts.glowColor || (color + '66'); // semi-transparent glow
    this.ctx.lineWidth = 5;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    this.ctx.stroke();
    if (opts.label) {
      this.ctx.font = '10px sans-serif';
      this.ctx.fillStyle = color;
      this.ctx.textBaseline = 'alphabetic';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(opts.label, x + r + 4, y - r);
    }
    if (opts.withCenterDot) {
      this.ctx.fillStyle = this._bgCanvas();
      this.ctx.beginPath();
      this.ctx.arc(x, y, 6, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 5, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  /** Status label near a cell. opts: { color, font, dx, dy }. dx/dy in pixels. */
  drawStatusLabel(col, row, text, opts = {}) {
    if (!this.ctx) return;
    const { x, y } = this._cellCenter(col, row);
    this.ctx.font = opts.font || '11px sans-serif';
    this.ctx.fillStyle = opts.color || this._accent();
    this.ctx.textBaseline = 'alphabetic';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(text, x + (opts.dx ?? 8), y + (opts.dy ?? -8));
  }

  /** Red error X mark in a cell. opts: { color, label }. */
  drawErrorMark(col, row, label, opts = {}) {
    if (!this.ctx) return;
    const d = this.viewport.getCellDimensions();
    const { x: ox, y: oy } = this._cellOrigin(col, row);
    const cx = ox + d.width / 2;
    const cy = oy + d.height / 2;
    const size = Math.min(d.width, d.height) * 0.6;
    const color = opts.color || '#ff4444';
    const fill = color + '4d';
    this.ctx.fillStyle = fill;
    this.ctx.fillRect(ox - 2, oy - 2, d.width + 4, d.height + 4);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([]);
    this.ctx.strokeRect(ox - 2, oy - 2, d.width + 4, d.height + 4);
    this.ctx.beginPath();
    this.ctx.moveTo(cx - size / 2, cy - size / 2);
    this.ctx.lineTo(cx + size / 2, cy + size / 2);
    this.ctx.moveTo(cx + size / 2, cy - size / 2);
    this.ctx.lineTo(cx - size / 2, cy + size / 2);
    this.ctx.stroke();
    if (label) {
      this.ctx.font = '10px sans-serif';
      this.ctx.fillStyle = color;
      this.ctx.textBaseline = 'alphabetic';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(label, cx, oy - 6);
    }
  }

  /** Dashed leader line between two cells with optional dot at start.
   *  opts: { color, dash, withStartDot } */
  drawLeaderLine(col1, row1, col2, row2, opts = {}) {
    if (!this.ctx) return;
    const a = this._cellCenter(col1, row1);
    const b = this._cellCenter(col2, row2);
    const color = opts.color || this._accent();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash(opts.dash || [4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    if (opts.withStartDot) {
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(a.x, a.y, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  /** Selection rectangle around an arbitrary cell-bounds rect.
   *  bounds: { x, y, width, height } in cells. opts: { color, dash, padding, lineWidth }. */
  drawSelectionRect(bounds, opts = {}) {
    if (!this.ctx) return;
    const d = this.viewport.getCellDimensions();
    const px = bounds.x * d.width;
    const py = bounds.y * d.height;
    const w = bounds.width * d.width;
    const h = bounds.height * d.height;
    const pad = opts.padding ?? 4;
    this.ctx.strokeStyle = opts.color || this._accent();
    this.ctx.lineWidth = opts.lineWidth || 1;
    this.ctx.setLineDash(opts.dash || [4, 3]);
    this.ctx.strokeRect(px - pad, py - pad, w + pad * 2, h + pad * 2);
    this.ctx.setLineDash([]);
  }

  /** Resize handles at the four corners of a cell-bounds rect. */
  drawCornerHandles(bounds, opts = {}) {
    if (!this.ctx) return;
    const d = this.viewport.getCellDimensions();
    const px = bounds.x * d.width;
    const py = bounds.y * d.height;
    const w = bounds.width * d.width;
    const h = bounds.height * d.height;
    const sz = opts.size || 6;
    this.ctx.fillStyle = opts.color || this._accent();
    this.ctx.setLineDash([]);
    this.ctx.fillRect(px - sz / 2,         py - sz / 2,         sz, sz);
    this.ctx.fillRect(px + w - sz / 2,     py - sz / 2,         sz, sz);
    this.ctx.fillRect(px - sz / 2,         py + h - sz / 2,     sz, sz);
    this.ctx.fillRect(px + w - sz / 2,     py + h - sz / 2,     sz, sz);
  }

  /** Vertex handle (square + 4 diagonal arrows). col,row may be fractional. */
  drawVertexHandleDecorated(col, row, opts = {}) {
    if (!this.ctx) return;
    const d = this.viewport.getCellDimensions();
    const cx = col * d.width + d.width / 2;
    const cy = row * d.height + d.height / 2;
    const handleSize = opts.size || 6;
    const color = opts.color || this._accent();
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([]);
    this.ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
    const o = 7, a = 3;
    const dirs = [[+1, -1], [+1, +1], [-1, +1], [-1, -1]];
    dirs.forEach(([dx, dy]) => {
      this.ctx.beginPath();
      this.ctx.moveTo(cx + dx * o, cy + dy * o);
      this.ctx.lineTo(cx + dx * o - dx * a, cy + dy * o);
      this.ctx.moveTo(cx + dx * o, cy + dy * o);
      this.ctx.lineTo(cx + dx * o, cy + dy * o - dy * a);
      this.ctx.stroke();
    });
  }

  /** Segment handle (square + 2 axis arrows). orientation: 'h' or 'v'. col,row may be fractional. */
  drawSegmentHandleDecorated(col, row, orientation, opts = {}) {
    if (!this.ctx) return;
    const d = this.viewport.getCellDimensions();
    const cx = col * d.width + d.width / 2;
    const cy = row * d.height + d.height / 2;
    const sz = opts.size || 4;
    const color = opts.color || this._accentSecondary();
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([]);
    this.ctx.fillRect(cx - sz / 2, cy - sz / 2, sz, sz);
    const o = 8, a = 3;
    if (orientation === 'h') {
      [-1, +1].forEach(dy => {
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy + dy * o);
        this.ctx.lineTo(cx - a, cy + dy * o - dy * a);
        this.ctx.moveTo(cx, cy + dy * o);
        this.ctx.lineTo(cx + a, cy + dy * o - dy * a);
        this.ctx.stroke();
      });
    } else {
      [-1, +1].forEach(dx => {
        this.ctx.beginPath();
        this.ctx.moveTo(cx + dx * o, cy);
        this.ctx.lineTo(cx + dx * o - dx * a, cy - a);
        this.ctx.moveTo(cx + dx * o, cy);
        this.ctx.lineTo(cx + dx * o - dx * a, cy + a);
        this.ctx.stroke();
      });
    }
  }

  /** Render an ASCII path through `points` using a chars set { h, v, tl, tr, bl, br }.
   *  Handles corner inference. opts: { color, font }. */
  drawAsciiPath(points, chars, opts = {}) {
    if (!this.ctx || !points || points.length < 2) return;
    const d = this.viewport.getCellDimensions();
    this.ctx.font = opts.font || '16px BerkeleyMono, monospace';
    this.ctx.fillStyle = opts.color || this._textCanvas();
    this.ctx.textBaseline = 'middle';
    this.ctx.textAlign = 'center';
    const cellChar = (col, row, ch) => {
      this.ctx.fillText(ch, col * d.width + d.width / 2, row * d.height + d.height / 2);
    };
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (a.x === b.x) {
        const lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
        for (let y = lo; y <= hi; y++) cellChar(a.x, y, chars.v);
      } else if (a.y === b.y) {
        const lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x);
        for (let x = lo; x <= hi; x++) cellChar(x, a.y, chars.h);
      }
    }
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1], curr = points[i], next = points[i + 1];
      const fromH = (prev.y === curr.y);
      const toH = (curr.y === next.y);
      if (fromH === toH) continue;
      const goingRight = fromH ? (curr.x > prev.x) : (next.x > curr.x);
      const goingDown = fromH ? (next.y > curr.y) : (curr.y > prev.y);
      let ch;
      if (fromH) {
        ch = goingRight ? (goingDown ? chars.tr : chars.br) : (goingDown ? chars.tl : chars.bl);
      } else {
        ch = goingDown ? (goingRight ? chars.tl : chars.tr) : (goingRight ? chars.bl : chars.br);
      }
      cellChar(curr.x, curr.y, ch);
    }
  }
};
