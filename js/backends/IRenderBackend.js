/**
 * IRenderBackend - Content rendering interface
 *
 * Implements: BACK-1, BACK-2, BACK-3, BACK-4
 *
 * The render backend is responsible for rendering DOCUMENT CONTENT only.
 * This includes cells, objects (boxes, lines, symbols), and the grid.
 * Content rendered by this interface CAN be exported.
 *
 * UI overlays (selection, handles, tool previews) are handled separately
 * by IOverlayRenderer and are NEVER exported.
 *
 * Implementations:
 * - CanvasASCIIBackend: ASCII characters on 2D canvas
 * - ThreeJSASCIIBackend: ASCII characters as 3D text meshes
 * - ThreeJSSVGBackend: SVG elements in 3D space
 */
var AsciiEditor = AsciiEditor || {};
AsciiEditor.backends = AsciiEditor.backends || {};

AsciiEditor.backends.IRenderBackend = class IRenderBackend {

  // ============================================================
  // Lifecycle
  // ============================================================

  /**
   * Initialize the backend with a viewport
   *
   * @param {IViewport} viewport - The viewport this backend renders to
   */
  initialize(viewport) {
    throw new Error('IRenderBackend.initialize() not implemented');
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
   * Begin a new frame
   * Called before any drawing operations
   */
  beginFrame() {
    // Override if needed (e.g., for batching)
  }

  /**
   * End the current frame
   * Called after all drawing operations
   */
  endFrame() {
    // Override if needed (e.g., for flushing batches)
  }

  /**
   * Clear the rendering surface
   */
  clear() {
    throw new Error('IRenderBackend.clear() not implemented');
  }

  // ============================================================
  // Cell-Level Drawing
  // ============================================================

  /**
   * Draw a single character in a cell
   *
   * @param {number} col - Cell column
   * @param {number} row - Cell row
   * @param {string} char - Character to draw
   * @param {Object} [style] - Style options
   * @param {string} [style.foreground] - Text color
   * @param {string} [style.background] - Background color
   * @param {number} [style.opacity] - Opacity (0-1)
   * @param {number} [style.zIndex] - Z-index for 3D backends
   */
  drawCell(col, row, char, style = {}) {
    throw new Error('IRenderBackend.drawCell() not implemented');
  }

  /**
   * Draw text starting at a cell position
   *
   * @param {number} col - Starting cell column
   * @param {number} row - Starting cell row
   * @param {string} text - Text to draw
   * @param {Object} [style] - Style options (same as drawCell)
   */
  drawText(col, row, text, style = {}) {
    throw new Error('IRenderBackend.drawText() not implemented');
  }

  // ============================================================
  // Object-Level Drawing
  // ============================================================

  /**
   * Draw a box object
   *
   * @param {Object} obj - Box object data
   * @param {number} obj.x - Cell X position
   * @param {number} obj.y - Cell Y position
   * @param {number} obj.width - Width in cells
   * @param {number} obj.height - Height in cells
   * @param {string} [obj.style] - Border style ('single', 'double', 'thick', 'none')
   * @param {boolean} [obj.shadow] - Whether to draw shadow
   * @param {string} [obj.fill] - Fill pattern ('none', 'light', 'medium', 'dark', 'solid', 'dots')
   * @param {string} [obj.text] - Text content
   * @param {string} [obj.textJustify] - Text justification ('top-left', 'center-center', etc.)
   * @param {Object} [options] - Drawing options
   * @param {boolean} [options.selected] - Whether object is selected
   */
  drawBox(obj, options = {}) {
    throw new Error('IRenderBackend.drawBox() not implemented');
  }

  /**
   * Draw a line/polyline object
   *
   * @param {Object} obj - Line object data
   * @param {Array<{x: number, y: number}>} obj.points - Array of points
   * @param {string} [obj.style] - Line style ('single', 'double', 'thick')
   * @param {string} [obj.startCap] - Start cap style
   * @param {string} [obj.endCap] - End cap style
   * @param {Object} [options] - Drawing options
   */
  drawLine(obj, options = {}) {
    throw new Error('IRenderBackend.drawLine() not implemented');
  }

  /**
   * Draw a wire object (line with electrical semantics)
   *
   * @param {Object} obj - Wire object data (same as line plus net info)
   * @param {string} [obj.net] - Net name
   * @param {Object} [options] - Drawing options
   */
  drawWire(obj, options = {}) {
    // Default: draw as line (override for different wire styling)
    this.drawLine(obj, options);
  }

  /**
   * Draw a symbol object
   *
   * @param {Object} obj - Symbol object data
   * @param {number} obj.x - Cell X position
   * @param {number} obj.y - Cell Y position
   * @param {number} obj.width - Width in cells
   * @param {number} obj.height - Height in cells
   * @param {Object} [obj.designator] - Designator info
   * @param {Array} [obj.pins] - Pin array
   * @param {Array} [obj.parameters] - Parameter array
   * @param {Object} [options] - Drawing options
   */
  drawSymbol(obj, options = {}) {
    throw new Error('IRenderBackend.drawSymbol() not implemented');
  }

  /**
   * Draw a junction object (derived, where lines meet)
   *
   * @param {Object} obj - Junction object data
   * @param {number} obj.x - Cell X position
   * @param {number} obj.y - Cell Y position
   * @param {string} [obj.style] - Junction style based on connected lines
   * @param {Object} [options] - Drawing options
   */
  drawJunction(obj, options = {}) {
    throw new Error('IRenderBackend.drawJunction() not implemented');
  }

  /**
   * Draw a wire junction object (electrical connection point)
   *
   * @param {Object} obj - Wire junction object data
   * @param {Object} [options] - Drawing options
   */
  drawWireJunction(obj, options = {}) {
    // Default: same as junction (override for different styling)
    this.drawJunction(obj, options);
  }

  /**
   * Draw a wire no-connect marker (floating endpoint)
   *
   * @param {Object} obj - No-connect object data
   * @param {number} obj.x - Cell X position
   * @param {number} obj.y - Cell Y position
   * @param {Object} [options] - Drawing options
   */
  drawWireNoConnect(obj, options = {}) {
    throw new Error('IRenderBackend.drawWireNoConnect() not implemented');
  }

  /**
   * Draw a text object (standalone text, not in a box)
   *
   * @param {Object} obj - Text object data
   * @param {number} obj.x - Cell X position
   * @param {number} obj.y - Cell Y position
   * @param {string} obj.text - Text content
   * @param {Object} [options] - Drawing options
   */
  drawTextObject(obj, options = {}) {
    this.drawText(obj.x, obj.y, obj.text, options);
  }

  // ============================================================
  // Grid
  // ============================================================

  /**
   * Draw the background grid
   * Grid is considered content (may be included in export)
   *
   * @param {number} cols - Number of columns
   * @param {number} rows - Number of rows
   * @param {boolean} visible - Whether grid should be visible
   */
  drawGrid(cols, rows, visible) {
    throw new Error('IRenderBackend.drawGrid() not implemented');
  }

  // ============================================================
  // Style Support
  // ============================================================

  /**
   * Get the character set used by this backend
   *
   * @returns {Object} Character mappings for box drawing, etc.
   */
  getCharacterSet() {
    throw new Error('IRenderBackend.getCharacterSet() not implemented');
  }

  /**
   * Get the list of supported border styles
   *
   * @returns {Array<string>} e.g., ['single', 'double', 'thick', 'none']
   */
  getSupportedBorderStyles() {
    return ['single', 'double', 'thick', 'none'];
  }

  /**
   * Get the list of supported fill patterns
   *
   * @returns {Array<string>} e.g., ['none', 'light', 'medium', 'dark', 'solid', 'dots']
   */
  getSupportedFillPatterns() {
    return ['none', 'light', 'medium', 'dark', 'solid', 'dots'];
  }

  // ============================================================
  // Capabilities
  // ============================================================

  /**
   * Check if this backend supports 3D features (extrusion, etc.)
   *
   * @returns {boolean}
   */
  supports3D() {
    return false;
  }

  /**
   * Get backend type identifier
   *
   * @returns {string} e.g., 'canvas-ascii', 'threejs-ascii', 'threejs-svg'
   */
  getType() {
    throw new Error('IRenderBackend.getType() not implemented');
  }
};
