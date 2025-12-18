/**
 * Debug System
 * Provides centralized debug logging with UI integration
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.debug = AsciiEditor.debug || {};

// Debug state
AsciiEditor.debug.enabled = false;
AsciiEditor.debug.log = [];
AsciiEditor.debug.maxLogSize = 500;
AsciiEditor.debug.listeners = [];

/**
 * Enable or disable debug mode
 * @param {boolean} enabled - Whether debug mode should be enabled
 */
AsciiEditor.debug.setEnabled = function(enabled) {
  AsciiEditor.debug.enabled = enabled;
  AsciiEditor.debug.notifyListeners();

  if (enabled) {
    AsciiEditor.debug.info('Debug mode enabled');
  }
};

/**
 * Toggle debug mode
 * @returns {boolean} New debug mode state
 */
AsciiEditor.debug.toggle = function() {
  AsciiEditor.debug.setEnabled(!AsciiEditor.debug.enabled);
  return AsciiEditor.debug.enabled;
};

/**
 * Check if debug mode is enabled
 * @returns {boolean}
 */
AsciiEditor.debug.isEnabled = function() {
  return AsciiEditor.debug.enabled;
};

/**
 * Add a debug message
 * @param {string} level - 'info', 'warn', 'error', 'trace'
 * @param {string} category - Category/module name
 * @param {string} message - Debug message
 * @param {Object} data - Optional data object
 */
AsciiEditor.debug.addMessage = function(level, category, message, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    time: new Date().toLocaleTimeString(),
    level: level,
    category: category,
    message: message,
    data: data || null
  };

  // Always add to log buffer
  AsciiEditor.debug.log.push(entry);

  // Trim log if too large
  if (AsciiEditor.debug.log.length > AsciiEditor.debug.maxLogSize) {
    AsciiEditor.debug.log.shift();
  }

  // Console output when debug enabled
  if (AsciiEditor.debug.enabled) {
    const prefix = `[${entry.time}] [${level.toUpperCase()}] [${category}]`;
    if (data) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }

  // Notify listeners
  AsciiEditor.debug.notifyListeners();
};

/**
 * Log info message
 */
AsciiEditor.debug.info = function(category, message, data) {
  if (arguments.length === 1) {
    // Single arg = message only
    AsciiEditor.debug.addMessage('info', 'General', category, null);
  } else if (arguments.length === 2) {
    // Two args = category + message
    AsciiEditor.debug.addMessage('info', category, message, null);
  } else {
    AsciiEditor.debug.addMessage('info', category, message, data);
  }
};

/**
 * Log warning message
 */
AsciiEditor.debug.warn = function(category, message, data) {
  if (arguments.length === 1) {
    AsciiEditor.debug.addMessage('warn', 'General', category, null);
  } else if (arguments.length === 2) {
    AsciiEditor.debug.addMessage('warn', category, message, null);
  } else {
    AsciiEditor.debug.addMessage('warn', category, message, data);
  }
};

/**
 * Log error message
 */
AsciiEditor.debug.error = function(category, message, data) {
  if (arguments.length === 1) {
    AsciiEditor.debug.addMessage('error', 'General', category, null);
  } else if (arguments.length === 2) {
    AsciiEditor.debug.addMessage('error', category, message, null);
  } else {
    AsciiEditor.debug.addMessage('error', category, message, data);
  }
};

/**
 * Log trace message (detailed debugging)
 */
AsciiEditor.debug.trace = function(category, message, data) {
  if (arguments.length === 1) {
    AsciiEditor.debug.addMessage('trace', 'General', category, null);
  } else if (arguments.length === 2) {
    AsciiEditor.debug.addMessage('trace', category, message, null);
  } else {
    AsciiEditor.debug.addMessage('trace', category, message, data);
  }
};

/**
 * Clear the debug log
 */
AsciiEditor.debug.clear = function() {
  AsciiEditor.debug.log = [];
  AsciiEditor.debug.notifyListeners();
};

/**
 * Get the debug log
 * @returns {Array} Array of log entries
 */
AsciiEditor.debug.getLog = function() {
  return AsciiEditor.debug.log;
};

/**
 * Get formatted log as string
 * @returns {string} Formatted log text
 */
AsciiEditor.debug.getLogText = function() {
  return AsciiEditor.debug.log.map(entry => {
    let line = `[${entry.time}] [${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}`;
    if (entry.data) {
      line += '\n  ' + JSON.stringify(entry.data, null, 2).split('\n').join('\n  ');
    }
    return line;
  }).join('\n');
};

/**
 * Subscribe to debug state changes
 * @param {Function} listener - Callback function
 * @returns {Function} Unsubscribe function
 */
AsciiEditor.debug.subscribe = function(listener) {
  AsciiEditor.debug.listeners.push(listener);
  return function() {
    AsciiEditor.debug.listeners = AsciiEditor.debug.listeners.filter(l => l !== listener);
  };
};

/**
 * Notify all listeners of state change
 */
AsciiEditor.debug.notifyListeners = function() {
  AsciiEditor.debug.listeners.forEach(l => l());
};
