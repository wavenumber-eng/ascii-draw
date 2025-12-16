/**
 * Core utility functions
 * Implements: ARCH-* (shared utilities)
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.core = AsciiEditor.core || {};

AsciiEditor.core.generateId = function() {
  return 'id-' + Math.random().toString(36).substr(2, 9);
};

AsciiEditor.core.clamp = function(value, min, max) {
  return Math.min(Math.max(value, min), max);
};

AsciiEditor.core.deepClone = function(obj) {
  return JSON.parse(JSON.stringify(obj));
};
