/**
 * IExporter Interface Contract Tests
 *
 * These tests document the IExporter interface contract and verify that
 * the base class correctly throws "not implemented" errors.
 *
 * Exporters convert the document to various output formats for saving to files.
 * Unlike render backends (which handle real-time on-screen display), exporters
 * produce static output suitable for file storage or embedding.
 */

describe('IExporter Interface', () => {
  let exporter;

  beforeEach(() => {
    exporter = new AsciiEditor.export.IExporter();
  });

  describe('Export', () => {
    test('export() throws not implemented', () => {
      const state = {
        project: { pages: [] },
        activePageId: null
      };
      expect(() => exporter.export(state))
        .toThrow('IExporter.export() not implemented');
    });

    test('exportPage() throws not implemented', () => {
      const page = { width: 80, height: 40, objects: [] };
      expect(() => exporter.exportPage(page))
        .toThrow('IExporter.exportPage() not implemented');
    });
  });

  describe('Metadata', () => {
    test('getName() throws not implemented', () => {
      expect(() => exporter.getName())
        .toThrow('IExporter.getName() not implemented');
    });

    test('getFileExtension() throws not implemented', () => {
      expect(() => exporter.getFileExtension())
        .toThrow('IExporter.getFileExtension() not implemented');
    });

    test('getMimeType() throws not implemented', () => {
      expect(() => exporter.getMimeType())
        .toThrow('IExporter.getMimeType() not implemented');
    });

    test('getDescription() returns empty string by default', () => {
      expect(exporter.getDescription()).toBe('');
    });
  });

  describe('Options', () => {
    test('getDefaultOptions() returns sensible defaults', () => {
      const options = exporter.getDefaultOptions();

      expect(options.pageId).toBeNull();
      expect(options.includeGrid).toBe(false);
      expect(options.includeShadows).toBe(true);
      expect(options.includeDerived).toBe(false);
      expect(options.embedFonts).toBe(false);
      expect(options.backgroundColor).toBeNull();
      expect(options.foregroundColor).toBeNull();
    });

    test('validateOptions() returns true by default', () => {
      expect(exporter.validateOptions({})).toBe(true);
      expect(exporter.validateOptions({ includeGrid: true })).toBe(true);
    });

    test('getSupportedOptions() returns option definitions', () => {
      const options = exporter.getSupportedOptions();

      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBeGreaterThan(0);

      // Check for includeGrid option
      const gridOption = options.find(o => o.key === 'includeGrid');
      expect(gridOption).toBeDefined();
      expect(gridOption.type).toBe('boolean');
      expect(gridOption.label).toBe('Include Grid');
      expect(gridOption.default).toBe(false);

      // Check for includeShadows option
      const shadowOption = options.find(o => o.key === 'includeShadows');
      expect(shadowOption).toBeDefined();
      expect(shadowOption.type).toBe('boolean');
      expect(shadowOption.label).toBe('Include Shadows');
      expect(shadowOption.default).toBe(true);
    });
  });

  describe('Preview', () => {
    test('preview() calls export() by default', () => {
      const state = { project: { pages: [] } };
      // Since export() throws, preview() should also throw
      expect(() => exporter.preview(state))
        .toThrow('IExporter.export() not implemented');
    });

    test('preview() truncates long output', () => {
      // Create a mock exporter that returns a long string
      class MockExporter extends AsciiEditor.export.IExporter {
        export() {
          return 'X'.repeat(20000);
        }
      }

      const mockExporter = new MockExporter();
      const result = mockExporter.preview({});

      expect(result.length).toBeLessThan(20000);
      expect(result).toContain('... (truncated)');
    });

    test('preview() returns message for binary content', () => {
      // Create a mock exporter that returns a Blob
      class BinaryExporter extends AsciiEditor.export.IExporter {
        export() {
          return { /* mock Blob-like object */ };
        }
      }

      const binaryExporter = new BinaryExporter();
      const result = binaryExporter.preview({});

      expect(result).toBe('[Binary content - no preview available]');
    });
  });

  describe('Capabilities', () => {
    test('supportsColors() returns false by default', () => {
      expect(exporter.supportsColors()).toBe(false);
    });

    test('supportsFontEmbedding() returns false by default', () => {
      expect(exporter.supportsFontEmbedding()).toBe(false);
    });

    test('isBinary() returns false by default', () => {
      expect(exporter.isBinary()).toBe(false);
    });

    test('getType() throws not implemented', () => {
      expect(() => exporter.getType())
        .toThrow('IExporter.getType() not implemented');
    });
  });
});

describe('ExportOptions typedef documentation', () => {
  test('ExportOptions has documented properties', () => {
    const exporter = new AsciiEditor.export.IExporter();
    const defaults = exporter.getDefaultOptions();

    // This test serves as documentation for the ExportOptions typedef
    const expectedKeys = [
      'pageId',           // Export specific page (null = current page)
      'includeGrid',      // Include grid in export
      'includeShadows',   // Include shadow effects
      'includeDerived',   // Include derived objects (junctions)
      'embedFonts',       // Embed font data (HTML/SVG)
      'backgroundColor',  // Background color (HTML/SVG)
      'foregroundColor'   // Default text color (HTML/SVG)
    ];

    expectedKeys.forEach(key => {
      expect(defaults).toHaveProperty(key);
    });
  });
});
