/**
 * HistoryManager - Manages undo/redo stacks and state
 * Implements: ARCH-12, ARCH-14, ARCH-20 to ARCH-23
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.core = AsciiEditor.core || {};

AsciiEditor.core.HistoryManager = class HistoryManager {
  constructor(initialState, maxHistory = 100) {
    this.state = initialState;
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = maxHistory;
    this.listeners = [];
  }

  getState() {
    return this.state;
  }

  execute(command) {
    // Try to merge with last command
    if (this.undoStack.length > 0) {
      const last = this.undoStack[this.undoStack.length - 1];
      if (last.canMerge && last.canMerge(command)) {
        this.undoStack[this.undoStack.length - 1] = last.merge(command);
        this.state = command.execute(this.state);
        this.redoStack = [];
        this.recomputeActivePageJunctions();
        this.notifyListeners();
        return;
      }
    }

    this.state = command.execute(this.state);
    this.undoStack.push(command);
    this.redoStack = [];

    // Limit history size (ARCH-14)
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    // OBJ-48: Recompute junctions after any operation
    this.recomputeActivePageJunctions();
    this.notifyListeners();
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    const command = this.undoStack.pop();
    this.state = command.undo(this.state);
    this.redoStack.push(command);
    this.recomputeActivePageJunctions();
    this.notifyListeners();
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    const command = this.redoStack.pop();
    this.state = command.execute(this.state);
    this.undoStack.push(command);
    this.recomputeActivePageJunctions();
    this.notifyListeners();
    return true;
  }

  /**
   * Recompute junctions for the active page
   * Called automatically after any command execution
   */
  recomputeActivePageJunctions() {
    if (!AsciiEditor.core.recomputeJunctions) {
      AsciiEditor.debug.warn('History', 'recomputeJunctions not available');
      return;
    }

    const pageIndex = this.state.project.pages.findIndex(
      p => p.id === this.state.activePageId
    );
    if (pageIndex >= 0) {
      AsciiEditor.debug.trace('History', 'Calling recomputeJunctions', { pageIndex, pageId: this.state.activePageId });
      const updatedPage = AsciiEditor.core.recomputeJunctions(
        this.state.project.pages[pageIndex]
      );
      this.state.project.pages[pageIndex] = updatedPage;
    }
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners() {
    this.listeners.forEach(l => l(this.state));
  }

  // Direct state update for non-undoable changes (ARCH-23)
  updateState(updater) {
    this.state = updater(this.state);
    this.notifyListeners();
  }
};
