/**
 * IExporter - File export interface
 *
 * Implements: EXP-0A, EXP-0B, EXP-0C
 *
 * Exporters convert the document to various output formats for saving to files.
 * Unlike render backends (which handle real-time on-screen display), exporters
 * produce static output suitable for file storage or embedding.
 *
 * Key differences from IRenderBackend:
 * - No interactivity or animation
 * - Output is a string or blob, not drawn to a canvas
 * - May have different styling/formatting requirements
 * - Never includes UI overlays
 *
 * Implementations:
 * - ASCIIExporter: Plain text with box-drawing characters
 * - ANSIExporter: Terminal escape codes for colors
 * - HTMLExporter: Styled HTML output
 * - SVGExporter: Vector graphics
 */
var AsciiEditor = AsciiEditor || {};
AsciiEditor.export = AsciiEditor.export || {};

/**
 * Export options common to all exporters
 * @typedef {Object} ExportOptions
 * @property {string} [pageId] - Export specific page (null = current page)
 * @property {boolean} [includeGrid=false] - Include grid in export
 * @property {boolean} [includeShadows=true] - Include shadow effects
 * @property {boolean} [includeDerived=false] - Include derived objects (junctions)
 * @property {boolean} [embedFonts=false] - Embed font data (HTML/SVG)
 * @property {string} [backgroundColor] - Background color (HTML/SVG)
 * @property {string} [foregroundColor] - Default text color (HTML/SVG)
 */

AsciiEditor.export.IExporter = class IExporter {

  // ============================================================
  // Export
  // ============================================================

  /**
   * Export the document to the target format
   *
   * @param {Object} state - The document state to export
   * @param {Object} state.project - Project data
   * @param {Array} state.project.pages - Array of pages
   * @param {string} [state.activePageId] - Currently active page
   * @param {ExportOptions} [options] - Export options
   * @returns {string|Blob} The exported content
   */
  export(state, options = {}) {
    throw new Error('IExporter.export() not implemented');
  }

  /**
   * Export a single page
   *
   * @param {Object} page - Page data to export
   * @param {number} page.width - Page width in cells
   * @param {number} page.height - Page height in cells
   * @param {Array} page.objects - Objects on the page
   * @param {ExportOptions} [options] - Export options
   * @returns {string|Blob} The exported content
   */
  exportPage(page, options = {}) {
    throw new Error('IExporter.exportPage() not implemented');
  }

  // ============================================================
  // Metadata
  // ============================================================

  /**
   * Get human-readable exporter name
   *
   * @returns {string} e.g., 'ASCII Text', 'SVG Vector', 'HTML'
   */
  getName() {
    throw new Error('IExporter.getName() not implemented');
  }

  /**
   * Get file extension for this format
   *
   * @returns {string} e.g., 'txt', 'svg', 'html'
   */
  getFileExtension() {
    throw new Error('IExporter.getFileExtension() not implemented');
  }

  /**
   * Get MIME type for this format
   *
   * @returns {string} e.g., 'text/plain', 'image/svg+xml', 'text/html'
   */
  getMimeType() {
    throw new Error('IExporter.getMimeType() not implemented');
  }

  /**
   * Get a short description of this exporter
   *
   * @returns {string} e.g., 'Plain text with box-drawing characters'
   */
  getDescription() {
    return '';
  }

  // ============================================================
  // Options
  // ============================================================

  /**
   * Get default options for this exporter
   *
   * @returns {ExportOptions}
   */
  getDefaultOptions() {
    return {
      pageId: null,
      includeGrid: false,
      includeShadows: true,
      includeDerived: false,
      embedFonts: false,
      backgroundColor: null,
      foregroundColor: null
    };
  }

  /**
   * Validate export options
   *
   * @param {ExportOptions} options - Options to validate
   * @returns {boolean} True if options are valid
   */
  validateOptions(options) {
    return true;
  }

  /**
   * Get list of options supported by this exporter
   * Used for building UI
   *
   * @returns {Array<Object>} Array of option definitions
   */
  getSupportedOptions() {
    return [
      {
        key: 'includeGrid',
        type: 'boolean',
        label: 'Include Grid',
        default: false
      },
      {
        key: 'includeShadows',
        type: 'boolean',
        label: 'Include Shadows',
        default: true
      }
    ];
  }

  // ============================================================
  // Preview
  // ============================================================

  /**
   * Generate a preview of the export
   * Useful for showing a preview before saving
   *
   * @param {Object} state - Document state
   * @param {ExportOptions} [options] - Export options
   * @returns {string} Preview content (may be truncated)
   */
  preview(state, options = {}) {
    // Default implementation: just call export
    const result = this.export(state, options);
    if (typeof result === 'string') {
      // Truncate long previews
      const maxLength = 10000;
      if (result.length > maxLength) {
        return result.substring(0, maxLength) + '\n... (truncated)';
      }
      return result;
    }
    return '[Binary content - no preview available]';
  }

  // ============================================================
  // Capabilities
  // ============================================================

  /**
   * Check if this exporter supports colors
   *
   * @returns {boolean}
   */
  supportsColors() {
    return false;
  }

  /**
   * Check if this exporter supports font embedding
   *
   * @returns {boolean}
   */
  supportsFontEmbedding() {
    return false;
  }

  /**
   * Check if this exporter produces binary output
   *
   * @returns {boolean}
   */
  isBinary() {
    return false;
  }

  /**
   * Get exporter type identifier
   *
   * @returns {string} e.g., 'ascii', 'ansi', 'html', 'svg'
   */
  getType() {
    throw new Error('IExporter.getType() not implemented');
  }
};
