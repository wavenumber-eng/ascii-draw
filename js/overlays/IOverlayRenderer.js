/**
 * IOverlayRenderer - UI overlay rendering interface
 *
 * Implements: OVER-1, OVER-2, OVER-3, OVER-4
 *
 * The overlay renderer handles TRANSIENT UI ELEMENTS that exist only during
 * interactive editing. These include:
 * - Selection highlights and resize handles
 * - Marquee selection rectangles
 * - Tool previews (box preview, line rubber-banding)
 * - Connection hints and snap indicators
 * - Drag ghosts and feedback
 * - Inline editing cursors
 *
 * IMPORTANT: Overlays are NEVER exported. They are purely for user interaction.
 *
 * For Three.js viewports, overlays can be:
 * - Screen-aligned (2D canvas on top of WebGL) - always readable
 * - 3D billboards (rotate with scene but face camera)
 * - Hybrid (some elements screen-aligned, others in 3D)
 *
 * Implementations:
 * - Canvas2DOverlay: Draws directly to 2D canvas context
 * - ThreeJSOverlay: 2D canvas layered over WebGL, or 3D sprites
 */
var AsciiEditor = AsciiEditor || {};
AsciiEditor.overlays = AsciiEditor.overlays || {};

AsciiEditor.overlays.IOverlayRenderer = class IOverlayRenderer {

  // ============================================================
  // Lifecycle
  // ============================================================

  /**
   * Initialize the overlay renderer with a viewport
   *
   * @param {IViewport} viewport - The viewport this overlay renders on
   */
  initialize(viewport) {
    throw new Error('IOverlayRenderer.initialize() not implemented');
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Override if cleanup needed
  }

  // ============================================================
  // Frame Management
  // ============================================================

  /**
   * Begin a new overlay frame
   * Called before any overlay drawing
   */
  beginFrame() {
    // Override if needed
  }

  /**
   * End the current overlay frame
   * Called after all overlay drawing
   */
  endFrame() {
    // Override if needed
  }

  /**
   * Clear all overlays
   */
  clear() {
    throw new Error('IOverlayRenderer.clear() not implemented');
  }

  // ============================================================
  // Selection Overlays
  // ============================================================

  /**
   * Draw selection highlight around an object
   *
   * @param {Object} obj - The selected object
   * @param {Object} [style] - Style options
   * @param {string} [style.color] - Highlight color
   * @param {number} [style.lineWidth] - Highlight line width
   */
  drawSelectionHighlight(obj, style = {}) {
    throw new Error('IOverlayRenderer.drawSelectionHighlight() not implemented');
  }

  /**
   * Draw bounding box for multi-selection
   *
   * @param {Object} bounds - Bounding rectangle in cell coordinates
   * @param {number} bounds.x - Left column
   * @param {number} bounds.y - Top row
   * @param {number} bounds.width - Width in cells
   * @param {number} bounds.height - Height in cells
   */
  drawMultiSelectionBox(bounds) {
    throw new Error('IOverlayRenderer.drawMultiSelectionBox() not implemented');
  }

  /**
   * Draw resize handles for a selected object
   *
   * @param {Object} obj - The object with resize handles
   * @param {Array<Object>} handles - Array of handle definitions
   * @param {string} handles[].type - Handle type ('nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se')
   * @param {number} handles[].col - Handle column position
   * @param {number} handles[].row - Handle row position
   */
  drawResizeHandles(obj, handles) {
    throw new Error('IOverlayRenderer.drawResizeHandles() not implemented');
  }

  // ============================================================
  // Marquee Selection
  // ============================================================

  /**
   * Draw marquee selection rectangle
   *
   * @param {Object} bounds - Rectangle bounds in cell coordinates
   * @param {number} bounds.x - Left column
   * @param {number} bounds.y - Top row
   * @param {number} bounds.width - Width in cells
   * @param {number} bounds.height - Height in cells
   * @param {string} mode - Selection mode ('enclosed' | 'intersect')
   */
  drawMarquee(bounds, mode) {
    throw new Error('IOverlayRenderer.drawMarquee() not implemented');
  }

  // ============================================================
  // Tool Hints and Previews
  // ============================================================

  /**
   * Draw tool preview (box outline, line path, etc.)
   *
   * @param {Object} preview - Preview definition
   * @param {string} preview.type - Preview type ('box', 'line', 'symbol', 'wire', 'text')
   * @param {Object} [preview.bounds] - For rectangular previews
   * @param {Array} [preview.points] - For line/wire previews
   * @param {string} [preview.style] - Style hint
   */
  drawToolPreview(preview) {
    throw new Error('IOverlayRenderer.drawToolPreview() not implemented');
  }

  /**
   * Draw snap indicator at grid position
   *
   * @param {number} col - Cell column
   * @param {number} row - Cell row
   */
  drawSnapIndicator(col, row) {
    // Optional - override if supported
  }

  /**
   * Draw connection hint label
   *
   * @param {Object} pos - Position in cell coordinates
   * @param {number} pos.col - Cell column
   * @param {number} pos.row - Cell row
   * @param {string} label - Hint text ('PIN', 'CONNECT', etc.)
   */
  drawConnectionHint(pos, label) {
    // Optional - override if supported
  }

  /**
   * Draw hover highlight on object under cursor
   *
   * @param {Object} obj - The object being hovered
   */
  drawHoverHighlight(obj) {
    // Optional - override if supported
  }

  // ============================================================
  // Drag Feedback
  // ============================================================

  /**
   * Draw ghost of objects being dragged
   *
   * @param {Array<Object>} objects - Objects being dragged
   * @param {Object} offset - Drag offset in cells
   * @param {number} offset.col - Column offset
   * @param {number} offset.row - Row offset
   */
  drawDragGhost(objects, offset) {
    // Optional - override if supported
  }

  /**
   * Draw rubber-band line (for line/wire drawing)
   *
   * @param {Object} start - Start position in cells
   * @param {number} start.col - Start column
   * @param {number} start.row - Start row
   * @param {Object} end - End position in cells
   * @param {number} end.col - End column
   * @param {number} end.row - End row
   * @param {string} [style] - Line style hint
   */
  drawRubberBand(start, end, style) {
    // Optional - override if supported
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
    // Optional - override if supported
  }

  /**
   * Draw text selection highlight
   *
   * @param {Object} start - Selection start in cells
   * @param {Object} end - Selection end in cells
   */
  drawTextSelection(start, end) {
    // Optional - override if supported
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
    throw new Error('IOverlayRenderer.drawVertexHandle() not implemented');
  }

  /**
   * Draw segment handle (midpoint) for line/wire editing
   *
   * @param {number} col - Handle column
   * @param {number} row - Handle row
   * @param {string} orientation - Segment orientation ('h' for horizontal, 'v' for vertical)
   */
  drawSegmentHandle(col, row, orientation) {
    throw new Error('IOverlayRenderer.drawSegmentHandle() not implemented');
  }

  // ============================================================
  // Pin Handles (Symbols)
  // ============================================================

  /**
   * Draw pin handle for symbol editing
   *
   * @param {Object} pos - Pin position in cells
   * @param {number} pos.col - Pin column
   * @param {number} pos.row - Pin row
   * @param {boolean} selected - Whether pin is selected
   */
  drawPinHandle(pos, selected) {
    // Optional - override if supported
  }

  /**
   * Draw pin drop target indicator
   *
   * @param {Object} pos - Target position in cells
   * @param {boolean} valid - Whether this is a valid drop location
   */
  drawPinDropTarget(pos, valid) {
    // Optional - override if supported
  }

  // ============================================================
  // 3D Configuration
  // ============================================================

  /**
   * Set whether overlays should be screen-aligned
   * Only affects 3D viewports - 2D viewports are always screen-aligned
   *
   * @param {boolean} aligned - If true, overlays stay screen-aligned
   *                            If false, overlays rotate with 3D content
   */
  setScreenAligned(aligned) {
    // Override in 3D implementations
  }

  /**
   * Check if overlays are screen-aligned
   *
   * @returns {boolean} Always true for 2D implementations
   */
  isScreenAligned() {
    return true;
  }

  // ============================================================
  // Capabilities
  // ============================================================

  /**
   * Get overlay renderer type identifier
   *
   * @returns {string} e.g., 'canvas2d', 'threejs-2d', 'threejs-3d'
   */
  getType() {
    throw new Error('IOverlayRenderer.getType() not implemented');
  }
};
