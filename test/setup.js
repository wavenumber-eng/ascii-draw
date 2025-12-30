/**
 * Jest setup file - loads all modules into the AsciiEditor namespace
 * Uses eval to execute scripts in the current scope so they can access globals.
 */

const fs = require('fs');
const path = require('path');

// Only initialize once (Jest may run setup multiple times)
if (!global.AsciiEditor || !global.AsciiEditor._initialized) {
  // Initialize namespace - define it globally for tests to access
  global.AsciiEditor = {
    _initialized: true,
    core: {},
    domain: {},
    tools: {},
    rendering: {},
    viewport: {},
    backends: {},
    overlays: {},
    export: {}
  };

  // Helper to load script - strips namespace init and evals in current scope
  function loadScript(relativePath) {
    const filePath = path.join(__dirname, relativePath);
    let code = fs.readFileSync(filePath, 'utf8');
    // Remove namespace init lines - we handle it in setup.js
    const lines = code.split('\n').filter(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('var AsciiEditor = AsciiEditor')) return false;
      if (trimmed.match(/^AsciiEditor\.(core|domain|tools|rendering|viewport|backends|overlays|export)\s*=\s*AsciiEditor\.\1/)) return false;
      return true;
    });
    code = lines.join('\n');
    // Create a function that takes AsciiEditor as parameter and executes the code
    const fn = new Function('AsciiEditor', code);
    fn(global.AsciiEditor);
  }

  // Load core modules in order
  loadScript('../js/core/utils.js');
  loadScript('../js/core/CharacterGrid.js');
  loadScript('../js/core/Command.js');
  loadScript('../js/core/HistoryManager.js');
  loadScript('../js/core/State.js');

  // Load domain modules (pure business logic, no UI)
  loadScript('../js/domain/Line.js');
  loadScript('../js/domain/Symbol.js');
  loadScript('../js/domain/Wire.js');

  // Load interface definitions
  loadScript('../js/viewport/IViewport.js');
  loadScript('../js/backends/IRenderBackend.js');
  loadScript('../js/overlays/IOverlayRenderer.js');
  loadScript('../js/export/IExporter.js');

  // Load implementations
  loadScript('../js/viewport/Canvas2DViewport.js');
  loadScript('../js/backends/CanvasASCIIBackend.js');
  loadScript('../js/overlays/Canvas2DOverlay.js');
}

// Note: Tools and Renderer need DOM/Canvas, load them in specific tests if needed
