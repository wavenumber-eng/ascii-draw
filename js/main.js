/**
 * Main entry point - Bootstrap the application
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  // Create the editor instance
  const editor = new AsciiEditor.Editor();

  // Expose for debugging if needed
  window.asciiEditor = editor;
});
