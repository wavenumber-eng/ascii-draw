/**
 * Editor - Main application orchestrator
 * Implements: UI-*, DATA-40 to DATA-42, DATA-50 to DATA-52, EXP-1 to EXP-3
 */

var AsciiEditor = AsciiEditor || {};

// DATA-50: localStorage key for auto-save
AsciiEditor.STORAGE_KEY = 'ascii_editor_autosave';

AsciiEditor.Editor = class Editor {
  constructor() {
    this.canvas = document.getElementById('editor-canvas');

    // DATA-51: Try to restore from localStorage, otherwise create fresh state
    const savedState = this.loadFromStorage();
    const initialState = savedState || AsciiEditor.core.createInitialState();
    this.history = new AsciiEditor.core.HistoryManager(initialState);

    this.grid = null;
    this.renderer = null;
    this.toolManager = new AsciiEditor.tools.ToolManager();
    this.hotkeyManager = new AsciiEditor.core.HotkeyManager();

    // Inline editing state
    this.editingObjectId = null;
    this.editPreviewText = null;
    this.cursorVisible = true;
    this.cursorPosition = { line: 0, col: 0 };
    this.inlineEditor = null;
    this.cursorBlinkInterval = null;

    // SEL-46: Clipboard persists across page switches
    this.clipboard = [];

    // DATA-50: Auto-save debounce timer
    this.autoSaveTimer = null;
    this.autoSaveDelay = 2000; // 2 seconds

    this.init();

    if (savedState) {
      console.log('Restored project from auto-save');
    }
  }

  async init() {
    // Measure font and set up grid
    await this.setupFont();

    // Set up renderer
    this.renderer = new AsciiEditor.rendering.Renderer(this.canvas, this.grid);
    await this.renderer.loadFont();

    // Set up canvas size
    const state = this.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    this.updateCanvasSize(page);

    // Set up tools
    this.setupTools();

    // Set up hotkeys
    this.setupHotkeys();

    // Set up event listeners
    this.setupEventListeners();

    // Subscribe to state changes
    this.history.subscribe(() => {
      this.render();
      this.updateUI();
      this.scheduleAutoSave(); // DATA-50: Auto-save on changes
    });

    // Initial render
    this.render();
    this.updateUI();
    this.renderPageTabs();

    console.log('ASCII Diagram Editor initialized');
  }

  async setupFont() {
    try {
      await document.fonts.load('16px BerkeleyMono');
    } catch (e) {
      console.warn('BerkeleyMono not loaded, using fallback measurements');
    }

    // Measure character dimensions
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    measureCtx.font = '16px BerkeleyMono, monospace';

    const metrics = measureCtx.measureText('M');
    const charWidth = Math.ceil(metrics.width);
    const charHeight = 20;

    this.grid = new AsciiEditor.core.CharacterGrid(charWidth, charHeight);

    console.log(`Character dimensions: ${charWidth}x${charHeight}`);
  }

  updateCanvasSize(page) {
    if (!page || !this.grid) return;
    const width = page.width * this.grid.charWidth;
    const height = page.height * this.grid.charHeight;
    this.renderer.setCanvasSize(width, height);
  }

  setupTools() {
    // Register tools
    this.toolManager.register(new AsciiEditor.tools.SelectTool());
    this.toolManager.register(new AsciiEditor.tools.BoxTool());
    this.toolManager.register(new AsciiEditor.tools.LineTool());

    // Set context
    this.toolManager.setContext({
      canvas: this.canvas,
      grid: this.grid,
      history: this.history,
      startInlineEdit: (obj, initialChar) => this.startInlineEdit(obj, initialChar),
      setTool: (toolName) => this.setTool(toolName)
    });

    // Activate default tool
    this.toolManager.activate('select');
  }

  setupHotkeys() {
    const hk = this.hotkeyManager;

    // Undo/Redo
    hk.register('ctrl+z', () => this.history.undo());
    hk.register('ctrl+y', () => this.history.redo());
    hk.register('ctrl+shift+z', () => this.history.redo());

    // Tools
    hk.register('v', () => this.setTool('select'));
    hk.register('b', () => this.setTool('box'));
    hk.register('t', () => this.setTool('text'));
    hk.register('l', () => this.setTool('line'));
    hk.register('s', () => this.setTool('symbol'));
    hk.register('w', () => this.setTool('wire'));
    hk.register('p', () => this.setTool('port'));
    hk.register('o', () => this.setTool('power'));

    // View
    hk.register('g', () => this.toggleGrid());

    // File operations
    hk.register('ctrl+s', () => this.saveProject());
    hk.register('ctrl+e', () => this.exportASCII());

    // SEL-40 to SEL-42: Clipboard operations
    hk.register('ctrl+c', () => this.copySelection());
    hk.register('ctrl+v', () => this.pasteClipboard());
    hk.register('ctrl+x', () => this.cutSelection());

    // Escape
    hk.register('escape', () => {
      if (this.editingObjectId) {
        this.cancelInlineEdit();
        return;
      }
      this.history.updateState(s => ({
        ...s,
        selection: { ids: [], handles: null }
      }));
      this.setTool('select');
    });
  }

  setupEventListeners() {
    // Canvas mouse events
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

    // Prevent context menu on canvas (right-click used for tool actions)
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard events
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));

    // Toolbar buttons
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setTool(btn.dataset.tool);
      });
    });

    document.getElementById('btn-undo').addEventListener('click', () => this.history.undo());
    document.getElementById('btn-redo').addEventListener('click', () => this.history.redo());
    document.getElementById('btn-grid').addEventListener('click', () => this.toggleGrid());
    document.getElementById('btn-save').addEventListener('click', () => this.saveProject());
    document.getElementById('btn-load').addEventListener('click', () => this.loadProject());
    document.getElementById('btn-export').addEventListener('click', () => this.exportASCII());

    // Window resize
    window.addEventListener('resize', () => this.render());

    // Inline editor events
    this.inlineEditor = document.getElementById('inline-editor');

    this.inlineEditor.addEventListener('blur', () => this.finishInlineEdit());
    this.inlineEditor.addEventListener('keydown', (e) => {
      e.stopPropagation();

      if (e.key === 'Escape') {
        this.cancelInlineEdit();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.finishInlineEdit();
      }
    });

    // Real-time preview while typing
    this.inlineEditor.addEventListener('input', () => {
      this.editPreviewText = this.inlineEditor.value;
      this.updateCursorPosition();
      this.render();

      // Sync with properties panel textarea in real-time
      const propText = document.getElementById('prop-text');
      if (propText && propText !== document.activeElement) {
        propText.value = this.inlineEditor.value;
      }
    });

    // Track cursor position
    this.inlineEditor.addEventListener('selectionchange', () => this.updateCursorPosition());
    this.inlineEditor.addEventListener('click', () => this.updateCursorPosition());
    this.inlineEditor.addEventListener('keyup', () => this.updateCursorPosition());

    // Cursor blink interval
    this.cursorBlinkInterval = setInterval(() => {
      if (this.editingObjectId) {
        this.cursorVisible = !this.cursorVisible;
        this.render();
      }
    }, 530);
  }

  updateCursorPosition() {
    if (!this.editingObjectId) return;

    const editor = this.inlineEditor;
    const text = editor.value;
    const selStart = editor.selectionStart;

    const textBefore = text.substring(0, selStart);
    const lines = textBefore.split('\n');
    this.cursorPosition = {
      line: lines.length - 1,
      col: lines[lines.length - 1].length
    };
  }

  // ============================================================
  // INLINE TEXT EDITING (SEL-30 to SEL-36)
  // ============================================================

  startInlineEdit(obj, initialChar = null) {
    if (!obj || obj.type !== 'box') return;

    const state = this.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const freshObj = page.objects.find(o => o.id === obj.id);
    if (!freshObj) return;

    this.editingObjectId = freshObj.id;
    this.cursorVisible = true;

    const editor = this.inlineEditor;

    // Hide editor visually but keep functional
    editor.style.left = '-9999px';
    editor.style.top = '-9999px';
    editor.style.width = '200px';
    editor.style.height = '100px';
    editor.style.display = 'block';
    editor.style.opacity = '0';

    if (initialChar !== null) {
      editor.value = initialChar;
      this.editPreviewText = initialChar;
      editor.focus();
      editor.setSelectionRange(editor.value.length, editor.value.length);
    } else {
      editor.value = freshObj.text || '';
      this.editPreviewText = freshObj.text || '';
      editor.focus();
      editor.select();
    }

    this.updateCursorPosition();
    this.render();
  }

  finishInlineEdit() {
    if (!this.editingObjectId) return;

    const state = this.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const obj = page.objects.find(o => o.id === this.editingObjectId);
    if (!obj) return;

    const editor = this.inlineEditor;
    const newText = editor.value;

    // SEL-36: Only commit if text changed
    if (newText !== (obj.text || '')) {
      this.history.execute(new AsciiEditor.core.ModifyObjectCommand(
        state.activePageId,
        obj.id,
        { text: obj.text || '' },
        { text: newText }
      ));
    }

    editor.style.display = 'none';
    editor.style.opacity = '1';
    this.editingObjectId = null;
    this.editPreviewText = null;
    this.render();
    this.updatePropertiesPanel();
  }

  cancelInlineEdit() {
    this.inlineEditor.style.display = 'none';
    this.inlineEditor.style.opacity = '1';
    this.editingObjectId = null;
    this.editPreviewText = null;
    this.render();
  }

  // ============================================================
  // PROPERTIES PANEL (UI-10 to UI-14, MSE-*)
  // ============================================================

  updatePropertiesPanel() {
    const state = this.history.getState();
    const content = document.getElementById('properties-content');

    if (state.selection.ids.length === 0) {
      content.innerHTML = '<div class="property-empty">No selection</div>';
      return;
    }

    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const selectedObjects = state.selection.ids
      .map(id => page.objects.find(o => o.id === id))
      .filter(obj => obj != null);

    if (selectedObjects.length === 0) {
      content.innerHTML = '<div class="property-empty">No selection</div>';
      return;
    }

    if (selectedObjects.length === 1) {
      const obj = selectedObjects[0];
      if (obj.type === 'box') {
        this.renderBoxProperties(obj);
      } else if (obj.type === 'line') {
        this.renderLineProperties(obj);
      } else {
        content.innerHTML = `<div class="property-empty">Unknown object type</div>`;
      }
    } else {
      this.renderMultiSelectProperties(selectedObjects);
    }
  }

  // MSE-1, MSE-2, MSE-40, MSE-41, MSE-42: Enhanced property value detection
  getCommonPropertyValue(objects, prop) {
    if (objects.length === 0) return { value: null, mixed: false };

    const values = objects.map(obj => obj[prop]);
    const firstValue = values[0];
    const allSame = values.every(val => {
      if (val === firstValue) return true;
      if (val === undefined && firstValue === undefined) return true;
      if (val === '' && firstValue === '') return true;
      return false;
    });

    if (allSame) {
      return { value: firstValue, mixed: false };
    }

    // MSE-42: Compute min/max for numeric values
    const numericValues = values.filter(v => typeof v === 'number');
    const minValue = numericValues.length > 0 ? Math.min(...numericValues) : null;
    const maxValue = numericValues.length > 0 ? Math.max(...numericValues) : null;

    // MSE-40, MSE-41: Return first value and range for mixed state
    return {
      value: null,
      mixed: true,
      firstValue: firstValue,
      minValue: minValue,
      maxValue: maxValue
    };
  }

  renderMultiSelectProperties(objects) {
    const content = document.getElementById('properties-content');
    const objectIds = objects.map(o => o.id);

    const props = {
      x: this.getCommonPropertyValue(objects, 'x'),
      y: this.getCommonPropertyValue(objects, 'y'),
      width: this.getCommonPropertyValue(objects, 'width'),
      height: this.getCommonPropertyValue(objects, 'height'),
      style: this.getCommonPropertyValue(objects, 'style'),
      shadow: this.getCommonPropertyValue(objects, 'shadow'),
      fill: this.getCommonPropertyValue(objects, 'fill'),
      textJustify: this.getCommonPropertyValue(objects, 'textJustify'),
      text: this.getCommonPropertyValue(objects, 'text')
    };

    // Helper functions for rendering
    const inputValue = (prop) => prop.mixed ? '' : (prop.value ?? '');

    // MSE-10: Number placeholder shows range format min...max
    const numberPlaceholder = (prop) => {
      if (!prop.mixed) return '';
      if (prop.minValue !== null && prop.maxValue !== null) {
        if (prop.minValue === prop.maxValue) return `${prop.minValue}`;
        return `${prop.minValue}...${prop.maxValue}`;
      }
      return '...';
    };

    // MSE-11: Text placeholder stays as ...
    const textPlaceholder = (prop, defaultPlaceholder = '') => prop.mixed ? '...' : defaultPlaceholder;

    // MSE-13: Enum placeholder shows first value + asterisk
    const enumPlaceholder = (prop) => {
      if (!prop.mixed) return '';
      return `${prop.firstValue}*`;
    };

    const selectValue = (prop, defaultVal) => prop.mixed ? '' : (prop.value ?? defaultVal);

    // MSE-12: Checkbox indeterminate state
    const checkboxState = (prop) => {
      if (prop.mixed) return { checked: false, indeterminate: true };
      return { checked: !!prop.value, indeterminate: false };
    };

    // MSE-14: Justify button class - active, mixed-first, or empty
    const justifyBtnClass = (justify, prop) => {
      if (!prop.mixed && prop.value === justify) return 'active';
      if (prop.mixed && prop.firstValue === justify) return 'mixed-first';
      return '';
    };

    // MSE-25, MSE-26: Data attributes for first/min values
    const numberDataAttrs = (prop) => {
      if (!prop.mixed) return '';
      return `data-min-value="${prop.minValue ?? ''}" data-first-value="${prop.firstValue ?? ''}"`;
    };

    const textDataAttrs = (prop) => {
      if (!prop.mixed) return '';
      return `data-first-value="${(prop.firstValue || '').replace(/"/g, '&quot;')}"`;
    };

    const shadowState = checkboxState(props.shadow);

    content.innerHTML = `
      <div class="property-group">
        <div class="property-group-title">${objects.length} Objects Selected</div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Position</div>
        <div class="property-row">
          <span class="property-label">X</span>
          <input type="number" class="property-input ${props.x.mixed ? 'mixed' : ''}" id="prop-x"
            value="${inputValue(props.x)}" placeholder="${numberPlaceholder(props.x)}" ${numberDataAttrs(props.x)}>
        </div>
        <div class="property-row">
          <span class="property-label">Y</span>
          <input type="number" class="property-input ${props.y.mixed ? 'mixed' : ''}" id="prop-y"
            value="${inputValue(props.y)}" placeholder="${numberPlaceholder(props.y)}" ${numberDataAttrs(props.y)}>
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Size</div>
        <div class="property-row">
          <span class="property-label">Width</span>
          <input type="number" class="property-input ${props.width.mixed ? 'mixed' : ''}" id="prop-width"
            value="${inputValue(props.width)}" placeholder="${numberPlaceholder(props.width)}" min="3" ${numberDataAttrs(props.width)}>
        </div>
        <div class="property-row">
          <span class="property-label">Height</span>
          <input type="number" class="property-input ${props.height.mixed ? 'mixed' : ''}" id="prop-height"
            value="${inputValue(props.height)}" placeholder="${numberPlaceholder(props.height)}" min="3" ${numberDataAttrs(props.height)}>
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Style</div>
        <div class="property-row">
          <span class="property-label">Border</span>
          <select class="property-select ${props.style.mixed ? 'mixed' : ''}" id="prop-style">
            ${props.style.mixed ? `<option value="" selected>${enumPlaceholder(props.style)}</option>` : ''}
            <option value="single" ${selectValue(props.style, 'single') === 'single' ? 'selected' : ''}>Single</option>
            <option value="double" ${selectValue(props.style, '') === 'double' ? 'selected' : ''}>Double</option>
            <option value="thick" ${selectValue(props.style, '') === 'thick' ? 'selected' : ''}>Thick</option>
          </select>
        </div>
        <div class="property-row">
          <label class="property-checkbox">
            <input type="checkbox" id="prop-shadow" ${shadowState.checked ? 'checked' : ''}>
            <span>Drop Shadow ${props.shadow.mixed ? '(mixed)' : ''}</span>
          </label>
        </div>
        <div class="property-row">
          <span class="property-label">Fill</span>
          <select class="property-select ${props.fill.mixed ? 'mixed' : ''}" id="prop-fill">
            ${props.fill.mixed ? `<option value="" selected>${enumPlaceholder(props.fill)}</option>` : ''}
            <option value="none" ${selectValue(props.fill, 'none') === 'none' ? 'selected' : ''}>None</option>
            <option value="light" ${selectValue(props.fill, '') === 'light' ? 'selected' : ''}>░ Light</option>
            <option value="medium" ${selectValue(props.fill, '') === 'medium' ? 'selected' : ''}>▒ Medium</option>
            <option value="dark" ${selectValue(props.fill, '') === 'dark' ? 'selected' : ''}>▓ Dark</option>
            <option value="solid" ${selectValue(props.fill, '') === 'solid' ? 'selected' : ''}>█ Solid</option>
            <option value="dots" ${selectValue(props.fill, '') === 'dots' ? 'selected' : ''}>· Dots</option>
          </select>
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Text Content</div>
        <div class="property-row">
          <span class="property-label">Justify</span>
        </div>
        <div class="justify-grid" id="justify-grid">
          <button class="justify-btn ${justifyBtnClass('top-left', props.textJustify)}" data-justify="top-left" title="Top Left">&#x2196;</button>
          <button class="justify-btn ${justifyBtnClass('top-center', props.textJustify)}" data-justify="top-center" title="Top Center">&#x2191;</button>
          <button class="justify-btn ${justifyBtnClass('top-right', props.textJustify)}" data-justify="top-right" title="Top Right">&#x2197;</button>
          <button class="justify-btn ${justifyBtnClass('center-left', props.textJustify)}" data-justify="center-left" title="Center Left">&#x2190;</button>
          <button class="justify-btn ${justifyBtnClass('center-center', props.textJustify)}" data-justify="center-center" title="Center">&#x25CF;</button>
          <button class="justify-btn ${justifyBtnClass('center-right', props.textJustify)}" data-justify="center-right" title="Center Right">&#x2192;</button>
          <button class="justify-btn ${justifyBtnClass('bottom-left', props.textJustify)}" data-justify="bottom-left" title="Bottom Left">&#x2199;</button>
          <button class="justify-btn ${justifyBtnClass('bottom-center', props.textJustify)}" data-justify="bottom-center" title="Bottom Center">&#x2193;</button>
          <button class="justify-btn ${justifyBtnClass('bottom-right', props.textJustify)}" data-justify="bottom-right" title="Bottom Right">&#x2198;</button>
        </div>
        <textarea class="property-textarea ${props.text.mixed ? 'mixed' : ''}" id="prop-text"
          placeholder="${textPlaceholder(props.text, 'Text content')}" ${textDataAttrs(props.text)}>${inputValue(props.text)}</textarea>
      </div>
    `;

    const shadowCheck = document.getElementById('prop-shadow');
    if (shadowCheck && props.shadow.mixed) {
      shadowCheck.indeterminate = true;
    }

    this.wireMultiSelectListeners(objectIds, props);
  }

  wireMultiSelectListeners(objectIds, props) {
    // MSE-20: Number inputs - focus handler to populate with min value
    ['x', 'y', 'width', 'height'].forEach(prop => {
      const input = document.getElementById(`prop-${prop}`);
      if (input) {
        // Focus handler for mixed fields
        if (input.classList.contains('mixed')) {
          input.addEventListener('focus', () => {
            if (input.value === '') {
              const minValue = input.dataset.minValue;
              if (minValue !== undefined && minValue !== '') {
                input.value = minValue;
                input.select();
              }
            }
          });
        }

        // Change handler
        input.addEventListener('change', () => {
          const value = input.value;
          if (value === '') return;
          let numValue = parseInt(value, 10);
          if (prop === 'width' || prop === 'height') {
            numValue = Math.max(3, numValue);
          }
          this.updateMultipleObjectsProperty(objectIds, prop, numValue);
        });
      }
    });

    const styleSelect = document.getElementById('prop-style');
    if (styleSelect) {
      styleSelect.addEventListener('change', () => {
        if (styleSelect.value === '') return;
        this.updateMultipleObjectsProperty(objectIds, 'style', styleSelect.value);
      });
    }

    const shadowCheck = document.getElementById('prop-shadow');
    if (shadowCheck) {
      shadowCheck.addEventListener('change', () => {
        this.updateMultipleObjectsProperty(objectIds, 'shadow', shadowCheck.checked);
      });
    }

    const fillSelect = document.getElementById('prop-fill');
    if (fillSelect) {
      fillSelect.addEventListener('change', () => {
        if (fillSelect.value === '') return;
        this.updateMultipleObjectsProperty(objectIds, 'fill', fillSelect.value);
      });
    }

    document.querySelectorAll('[data-justify]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.updateMultipleObjectsProperty(objectIds, 'textJustify', btn.dataset.justify);
      });
    });

    // MSE-21: Textarea - focus handler to populate with first value
    const textArea = document.getElementById('prop-text');
    if (textArea) {
      if (textArea.classList.contains('mixed')) {
        textArea.addEventListener('focus', () => {
          if (textArea.value === '') {
            const firstValue = textArea.dataset.firstValue;
            if (firstValue !== undefined) {
              textArea.value = firstValue;
              textArea.select();
            }
          }
        });
      }

      // UI-14: Real-time updates as user types
      textArea.addEventListener('input', () => {
        this.updateMultipleObjectsProperty(objectIds, 'text', textArea.value);
      });
    }
  }

  updateMultipleObjectsProperty(objectIds, property, value) {
    const state = this.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    objectIds.forEach(objectId => {
      const obj = page.objects.find(o => o.id === objectId);
      if (!obj) return;

      const oldValue = obj[property];
      if (oldValue === value) return;

      this.history.execute(new AsciiEditor.core.ModifyObjectCommand(
        state.activePageId,
        objectId,
        { [property]: oldValue },
        { [property]: value }
      ));
    });

    this.updatePropertiesPanel();
  }

  // UI-12: Single selection property editor for text box
  renderBoxProperties(obj) {
    const content = document.getElementById('properties-content');
    const justify = obj.textJustify || 'center-center';

    content.innerHTML = `
      <div class="property-group">
        <div class="property-group-title">Position</div>
        <div class="property-row">
          <span class="property-label">X</span>
          <input type="number" class="property-input" id="prop-x" value="${obj.x}">
        </div>
        <div class="property-row">
          <span class="property-label">Y</span>
          <input type="number" class="property-input" id="prop-y" value="${obj.y}">
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Size</div>
        <div class="property-row">
          <span class="property-label">Width</span>
          <input type="number" class="property-input" id="prop-width" value="${obj.width}" min="3">
        </div>
        <div class="property-row">
          <span class="property-label">Height</span>
          <input type="number" class="property-input" id="prop-height" value="${obj.height}" min="3">
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Style</div>
        <div class="property-row">
          <span class="property-label">Border</span>
          <select class="property-select" id="prop-style">
            <option value="single" ${obj.style === 'single' ? 'selected' : ''}>Single</option>
            <option value="double" ${obj.style === 'double' ? 'selected' : ''}>Double</option>
            <option value="thick" ${obj.style === 'thick' ? 'selected' : ''}>Thick</option>
          </select>
        </div>
        <div class="property-row">
          <label class="property-checkbox">
            <input type="checkbox" id="prop-shadow" ${obj.shadow ? 'checked' : ''}>
            <span>Drop Shadow</span>
          </label>
        </div>
        <div class="property-row">
          <span class="property-label">Fill</span>
          <select class="property-select" id="prop-fill">
            <option value="none" ${(obj.fill || 'none') === 'none' ? 'selected' : ''}>None</option>
            <option value="light" ${obj.fill === 'light' ? 'selected' : ''}>░ Light</option>
            <option value="medium" ${obj.fill === 'medium' ? 'selected' : ''}>▒ Medium</option>
            <option value="dark" ${obj.fill === 'dark' ? 'selected' : ''}>▓ Dark</option>
            <option value="solid" ${obj.fill === 'solid' ? 'selected' : ''}>█ Solid</option>
            <option value="dots" ${obj.fill === 'dots' ? 'selected' : ''}>· Dots</option>
          </select>
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Text Content</div>
        <div class="property-row">
          <span class="property-label">Justify</span>
        </div>
        <div class="justify-grid" id="justify-grid">
          <button class="justify-btn ${justify === 'top-left' ? 'active' : ''}" data-justify="top-left" title="Top Left">&#x2196;</button>
          <button class="justify-btn ${justify === 'top-center' ? 'active' : ''}" data-justify="top-center" title="Top Center">&#x2191;</button>
          <button class="justify-btn ${justify === 'top-right' ? 'active' : ''}" data-justify="top-right" title="Top Right">&#x2197;</button>
          <button class="justify-btn ${justify === 'center-left' ? 'active' : ''}" data-justify="center-left" title="Center Left">&#x2190;</button>
          <button class="justify-btn ${justify === 'center-center' ? 'active' : ''}" data-justify="center-center" title="Center">&#x25CF;</button>
          <button class="justify-btn ${justify === 'center-right' ? 'active' : ''}" data-justify="center-right" title="Center Right">&#x2192;</button>
          <button class="justify-btn ${justify === 'bottom-left' ? 'active' : ''}" data-justify="bottom-left" title="Bottom Left">&#x2199;</button>
          <button class="justify-btn ${justify === 'bottom-center' ? 'active' : ''}" data-justify="bottom-center" title="Bottom Center">&#x2193;</button>
          <button class="justify-btn ${justify === 'bottom-right' ? 'active' : ''}" data-justify="bottom-right" title="Bottom Right">&#x2198;</button>
        </div>
        <textarea class="property-textarea" id="prop-text" placeholder="Type when selected or double-click to edit">${obj.text || ''}</textarea>
      </div>
    `;

    this.wirePropertyListeners(obj);
  }

  wirePropertyListeners(obj) {
    ['x', 'y', 'width', 'height'].forEach(prop => {
      const input = document.getElementById(`prop-${prop}`);
      if (input) {
        input.addEventListener('change', () => {
          let value = parseInt(input.value, 10);
          if (prop === 'width' || prop === 'height') {
            value = Math.max(3, value);
          }
          this.updateObjectProperty(obj.id, prop, value);
        });
      }
    });

    const styleSelect = document.getElementById('prop-style');
    if (styleSelect) {
      styleSelect.addEventListener('change', () => {
        this.updateObjectProperty(obj.id, 'style', styleSelect.value);
      });
    }

    const shadowCheck = document.getElementById('prop-shadow');
    if (shadowCheck) {
      shadowCheck.addEventListener('change', () => {
        this.updateObjectProperty(obj.id, 'shadow', shadowCheck.checked);
      });
    }

    const fillSelect = document.getElementById('prop-fill');
    if (fillSelect) {
      fillSelect.addEventListener('change', () => {
        this.updateObjectProperty(obj.id, 'fill', fillSelect.value);
      });
    }

    document.querySelectorAll('[data-justify]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.updateObjectProperty(obj.id, 'textJustify', btn.dataset.justify);
      });
    });

    const textArea = document.getElementById('prop-text');
    if (textArea) {
      // UI-14: Real-time updates as user types
      textArea.addEventListener('input', () => {
        this.updateObjectProperty(obj.id, 'text', textArea.value);
      });
    }
  }

  // Line properties panel
  renderLineProperties(obj) {
    const content = document.getElementById('properties-content');
    const style = obj.style || 'single';
    const startCap = obj.startCap || 'none';
    const endCap = obj.endCap || 'none';
    const pointCount = obj.points ? obj.points.length : 0;

    // Build style options from LineStyles definition
    const lineStyles = AsciiEditor.tools.LineStyles || [];
    const styleOptions = lineStyles.map(s =>
      `<option value="${s.key}" ${style === s.key ? 'selected' : ''}>${s.chars.h} ${s.label} (${s.hotkey})</option>`
    ).join('');

    content.innerHTML = `
      <div class="property-group">
        <div class="property-group-title">Line Info</div>
        <div class="property-row">
          <span class="property-label">Points</span>
          <span class="property-value">${pointCount}</span>
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Style</div>
        <div class="property-row">
          <span class="property-label">Line Style</span>
          <select class="property-select" id="prop-style">
            ${styleOptions}
          </select>
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Endpoints</div>
        <div class="property-row">
          <span class="property-label">Start</span>
          <select class="property-select" id="prop-startCap">
            <option value="none" ${startCap === 'none' ? 'selected' : ''}>None</option>
            <option value="arrow" ${startCap === 'arrow' ? 'selected' : ''}>&lt; Arrow</option>
            <option value="triangle" ${startCap === 'triangle' ? 'selected' : ''}>◀ Triangle</option>
            <option value="triangle-outline" ${startCap === 'triangle-outline' ? 'selected' : ''}>◁ Triangle Outline</option>
            <option value="diamond" ${startCap === 'diamond' ? 'selected' : ''}>◆ Diamond</option>
            <option value="diamond-outline" ${startCap === 'diamond-outline' ? 'selected' : ''}>◇ Diamond Outline</option>
            <option value="circle" ${startCap === 'circle' ? 'selected' : ''}>● Circle</option>
            <option value="circle-outline" ${startCap === 'circle-outline' ? 'selected' : ''}>○ Circle Outline</option>
            <option value="square" ${startCap === 'square' ? 'selected' : ''}>■ Square</option>
            <option value="square-outline" ${startCap === 'square-outline' ? 'selected' : ''}>□ Square Outline</option>
          </select>
        </div>
        <div class="property-row">
          <span class="property-label">End</span>
          <select class="property-select" id="prop-endCap">
            <option value="none" ${endCap === 'none' ? 'selected' : ''}>None</option>
            <option value="arrow" ${endCap === 'arrow' ? 'selected' : ''}>&gt; Arrow</option>
            <option value="triangle" ${endCap === 'triangle' ? 'selected' : ''}>▶ Triangle</option>
            <option value="triangle-outline" ${endCap === 'triangle-outline' ? 'selected' : ''}>▷ Triangle Outline</option>
            <option value="diamond" ${endCap === 'diamond' ? 'selected' : ''}>◆ Diamond</option>
            <option value="diamond-outline" ${endCap === 'diamond-outline' ? 'selected' : ''}>◇ Diamond Outline</option>
            <option value="circle" ${endCap === 'circle' ? 'selected' : ''}>● Circle</option>
            <option value="circle-outline" ${endCap === 'circle-outline' ? 'selected' : ''}>○ Circle Outline</option>
            <option value="square" ${endCap === 'square' ? 'selected' : ''}>■ Square</option>
            <option value="square-outline" ${endCap === 'square-outline' ? 'selected' : ''}>□ Square Outline</option>
          </select>
        </div>
      </div>
    `;

    this.wireLinePropertyListeners(obj);
  }

  wireLinePropertyListeners(obj) {
    const styleSelect = document.getElementById('prop-style');
    if (styleSelect) {
      styleSelect.addEventListener('change', () => {
        this.updateObjectProperty(obj.id, 'style', styleSelect.value);
      });
    }

    const startCapSelect = document.getElementById('prop-startCap');
    if (startCapSelect) {
      startCapSelect.addEventListener('change', () => {
        this.updateObjectProperty(obj.id, 'startCap', startCapSelect.value);
      });
    }

    const endCapSelect = document.getElementById('prop-endCap');
    if (endCapSelect) {
      endCapSelect.addEventListener('change', () => {
        this.updateObjectProperty(obj.id, 'endCap', endCapSelect.value);
      });
    }
  }

  updateObjectProperty(objectId, property, value) {
    const state = this.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const obj = page.objects.find(o => o.id === objectId);
    if (!obj) return;

    const oldValue = obj[property];
    if (oldValue === value) return;

    this.history.execute(new AsciiEditor.core.ModifyObjectCommand(
      state.activePageId,
      objectId,
      { [property]: oldValue },
      { [property]: value }
    ));

    this.updatePropertiesPanel();
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  handleMouseDown(e) {
    if (this.editingObjectId) {
      this.finishInlineEdit();
    }

    const rect = this.canvas.getBoundingClientRect();
    const event = {
      canvasX: e.clientX - rect.left,
      canvasY: e.clientY - rect.top,
      button: e.button,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey
    };

    if (this.toolManager.onMouseDown(event)) {
      this.render();
    }
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const event = {
      canvasX: e.clientX - rect.left,
      canvasY: e.clientY - rect.top,
      button: e.button,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey
    };

    const { col, row } = this.grid.pixelToChar(event.canvasX, event.canvasY);
    document.getElementById('status-position').textContent = `Col: ${col}, Row: ${row}`;

    if (this.toolManager.onMouseMove(event)) {
      this.render();
    }
  }

  handleMouseUp(e) {
    const rect = this.canvas.getBoundingClientRect();
    const event = {
      canvasX: e.clientX - rect.left,
      canvasY: e.clientY - rect.top,
      button: e.button,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey
    };

    if (this.toolManager.onMouseUp(event)) {
      this.render();
    }
  }

  handleDoubleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const event = {
      canvasX: e.clientX - rect.left,
      canvasY: e.clientY - rect.top
    };

    if (this.toolManager.onDoubleClick(event)) {
      this.render();
    }
  }

  handleKeyDown(e) {
    if (this.editingObjectId && document.activeElement === this.inlineEditor) {
      return;
    }

    if (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA') {
      return;
    }

    if (this.hotkeyManager.handleKeyDown(e)) {
      this.render();
      this.updateUI();
      return;
    }

    if (this.toolManager.onKeyDown(e)) {
      this.render();
    }
  }

  handleKeyUp(e) {
    if (this.toolManager.onKeyUp(e)) {
      this.render();
    }
  }

  // ============================================================
  // UI UPDATES
  // ============================================================

  setTool(toolName) {
    if (this.toolManager.activate(toolName)) {
      this.history.updateState(s => ({ ...s, activeTool: toolName }));
      this.updateUI();
    }
  }

  toggleGrid() {
    this.history.updateState(s => ({
      ...s,
      ui: { ...s.ui, gridVisible: !s.ui.gridVisible }
    }));
  }

  render() {
    const state = this.history.getState();

    let editContext = null;
    if (this.editingObjectId) {
      editContext = {
        objectId: this.editingObjectId,
        previewText: this.editPreviewText,
        cursorVisible: this.cursorVisible,
        cursorPosition: this.cursorPosition
      };
    }

    this.renderer.render(state, this.toolManager, editContext);
  }

  updateUI() {
    const state = this.history.getState();

    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === state.activeTool);
    });

    document.getElementById('status-tool').textContent = `Tool: ${state.activeTool}`;
    document.getElementById('status-selection').textContent = `Selected: ${state.selection.ids.length}`;
    document.getElementById('status-history').textContent =
      `History: ${this.history.undoStack.length}/${this.history.undoStack.length + this.history.redoStack.length}`;

    const pageIndex = state.project.pages.findIndex(p => p.id === state.activePageId);
    document.getElementById('status-page').textContent =
      `Page: ${pageIndex + 1}/${state.project.pages.length}`;

    this.updatePropertiesPanel();
  }

  renderPageTabs() {
    const state = this.history.getState();
    const container = document.getElementById('page-tabs');
    container.innerHTML = '';

    state.project.pages.forEach((page, index) => {
      const tab = document.createElement('button');
      tab.className = 'page-tab' + (page.id === state.activePageId ? ' active' : '');
      tab.textContent = page.name;
      tab.addEventListener('click', () => this.switchPage(page.id));
      container.appendChild(tab);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'page-tab-add';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => this.addPage());
    container.appendChild(addBtn);
  }

  switchPage(pageId) {
    this.history.updateState(s => ({
      ...s,
      activePageId: pageId,
      selection: { ids: [], handles: null }
    }));

    const state = this.history.getState();
    const page = state.project.pages.find(p => p.id === pageId);
    this.updateCanvasSize(page);
    this.renderPageTabs();
    this.updateUI();
  }

  addPage() {
    const state = this.history.getState();
    const newPage = {
      id: AsciiEditor.core.generateId(),
      name: `Page ${state.project.pages.length + 1}`,
      width: state.project.settings.defaultPageWidth,
      height: state.project.settings.defaultPageHeight,
      parameters: {},
      objects: []
    };

    this.history.updateState(s => ({
      ...s,
      project: {
        ...s.project,
        pages: [...s.project.pages, newPage]
      },
      activePageId: newPage.id,
      viewState: {
        ...s.viewState,
        [newPage.id]: { zoom: 1.0, panX: 0, panY: 0 }
      }
    }));

    this.updateCanvasSize(newPage);
    this.renderPageTabs();
    this.updateUI();
  }

  // ============================================================
  // FILE OPERATIONS (DATA-40 to DATA-42)
  // ============================================================

  saveProject() {
    const state = this.history.getState();
    const json = JSON.stringify(state.project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = (state.project.meta.name || 'diagram') + '.json';
    a.click();

    URL.revokeObjectURL(url);

    // DATA-52: Clear auto-save after successful manual save
    this.clearStorage();
    console.log('Project saved');
  }

  loadProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const project = JSON.parse(e.target.result);
          this.history.updateState(s => ({
            ...s,
            project,
            activePageId: project.pages[0]?.id || 'page-1',
            selection: { ids: [], handles: null }
          }));

          const state = this.history.getState();
          const page = state.project.pages.find(p => p.id === state.activePageId);
          this.updateCanvasSize(page);
          this.renderPageTabs();
          this.updateUI();
          console.log('Project loaded');
        } catch (err) {
          console.error('Failed to load project:', err);
          alert('Failed to load project file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // ============================================================
  // AUTO-SAVE (DATA-50 to DATA-52)
  // ============================================================

  // DATA-50: Schedule auto-save with debounce
  scheduleAutoSave() {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = setTimeout(() => {
      this.saveToStorage();
    }, this.autoSaveDelay);
  }

  // DATA-50: Save current state to localStorage
  saveToStorage() {
    try {
      const state = this.history.getState();
      const data = {
        project: state.project,
        activePageId: state.activePageId,
        timestamp: Date.now()
      };
      localStorage.setItem(AsciiEditor.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Auto-save failed:', e);
    }
  }

  // DATA-51: Load state from localStorage
  loadFromStorage() {
    try {
      const saved = localStorage.getItem(AsciiEditor.STORAGE_KEY);
      if (!saved) return null;

      const data = JSON.parse(saved);
      if (!data.project) return null;

      // Reconstruct state with saved project
      const state = AsciiEditor.core.createInitialState();
      state.project = data.project;
      state.activePageId = data.activePageId || data.project.pages[0]?.id;

      return state;
    } catch (e) {
      console.warn('Failed to load auto-save:', e);
      return null;
    }
  }

  // DATA-52: Clear localStorage
  clearStorage() {
    try {
      localStorage.removeItem(AsciiEditor.STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear auto-save:', e);
    }
  }

  // ============================================================
  // CLIPBOARD OPERATIONS (SEL-40 to SEL-46)
  // ============================================================

  // SEL-40: Copy selected objects to clipboard
  copySelection() {
    const state = this.history.getState();
    if (state.selection.ids.length === 0) return;

    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    // Deep copy selected objects
    const selectedObjects = state.selection.ids
      .map(id => page.objects.find(o => o.id === id))
      .filter(obj => obj != null)
      .map(obj => JSON.parse(JSON.stringify(obj)));

    this.clipboard = selectedObjects;
    console.log(`Copied ${this.clipboard.length} object(s) to clipboard`);
  }

  // SEL-41, SEL-43, SEL-44, SEL-45: Paste clipboard contents
  pasteClipboard() {
    if (this.clipboard.length === 0) return;

    const state = this.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const newIds = [];

    this.clipboard.forEach(obj => {
      // SEL-43: Create new object with new ID
      const newObj = JSON.parse(JSON.stringify(obj));
      newObj.id = AsciiEditor.core.generateId();

      // SEL-44: Offset +2 chars right and down
      newObj.x += 2;
      newObj.y += 2;

      this.history.execute(new AsciiEditor.core.CreateObjectCommand(state.activePageId, newObj));
      newIds.push(newObj.id);
    });

    // SEL-45: Pasted objects become the new selection
    this.history.updateState(s => ({
      ...s,
      selection: { ids: newIds, handles: null }
    }));

    console.log(`Pasted ${newIds.length} object(s)`);
  }

  // SEL-42: Cut = copy + delete
  cutSelection() {
    const state = this.history.getState();
    if (state.selection.ids.length === 0) return;

    // First copy
    this.copySelection();

    // Then delete
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    state.selection.ids.forEach(id => {
      const obj = page.objects.find(o => o.id === id);
      if (obj) {
        this.history.execute(new AsciiEditor.core.DeleteObjectCommand(state.activePageId, obj));
      }
    });

    // Clear selection
    this.history.updateState(s => ({
      ...s,
      selection: { ids: [], handles: null }
    }));

    console.log(`Cut ${this.clipboard.length} object(s)`);
  }

  // ============================================================
  // EXPORT (EXP-1 to EXP-3)
  // ============================================================

  exportASCII() {
    const state = this.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    const buffer = [];
    for (let r = 0; r < page.height; r++) {
      buffer.push(new Array(page.width).fill(' '));
    }

    page.objects.forEach(obj => {
      this.renderObjectToBuffer(buffer, obj);
    });

    const ascii = buffer.map(row => row.join('')).join('\n');

    const blob = new Blob([ascii], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = (page.name || 'diagram') + '.txt';
    a.click();

    URL.revokeObjectURL(url);
    console.log('ASCII exported');
  }

  renderObjectToBuffer(buffer, obj) {
    if (obj.type === 'box') {
      this.renderBoxToBuffer(buffer, obj);
    } else if (obj.type === 'line') {
      this.renderLineToBuffer(buffer, obj);
    }
  }

  renderBoxToBuffer(buffer, obj) {
    const { x, y, width, height, style, text, shadow } = obj;

    const chars = {
      single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
      double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
      thick: { tl: '█', tr: '█', bl: '█', br: '█', h: '█', v: '█' }
    };

    const c = chars[style] || chars.single;
    const hasBorder = style && style !== 'none';

    const setChar = (col, row, char) => {
      if (row >= 0 && row < buffer.length && col >= 0 && col < buffer[0].length) {
        buffer[row][col] = char;
      }
    };

    // Draw shadow first (if enabled and has border)
    if (shadow && hasBorder) {
      for (let row = 1; row <= height; row++) {
        setChar(x + width, y + row, '░');
      }
      for (let col = 1; col < width; col++) {
        setChar(x + col, y + height, '░');
      }
      setChar(x + width, y + height, '░');
    }

    // Draw border (if not style: none)
    if (hasBorder) {
      // Top border
      setChar(x, y, c.tl);
      for (let col = 1; col < width - 1; col++) {
        setChar(x + col, y, c.h);
      }
      setChar(x + width - 1, y, c.tr);

      // Sides
      for (let row = 1; row < height - 1; row++) {
        setChar(x, y + row, c.v);
        setChar(x + width - 1, y + row, c.v);
      }

      // Bottom border
      setChar(x, y + height - 1, c.bl);
      for (let col = 1; col < width - 1; col++) {
        setChar(x + col, y + height - 1, c.h);
      }
      setChar(x + width - 1, y + height - 1, c.br);
    }

    // OBJ-16, OBJ-17: Fill interior
    const fillChars = {
      'none': null,
      'light': '░',
      'medium': '▒',
      'dark': '▓',
      'solid': '█',
      'dots': '·'
    };
    const fillChar = fillChars[obj.fill];
    if (fillChar) {
      for (let row = 1; row < height - 1; row++) {
        for (let col = 1; col < width - 1; col++) {
          setChar(x + col, y + row, fillChar);
        }
      }
    }

    if (text) {
      const innerWidth = width - 2;
      const innerHeight = height - 2;
      const lines = text.split('\n');
      const maxLines = innerHeight;
      const displayLines = lines.slice(0, maxLines);

      const justify = obj.textJustify || 'center-center';
      const [vAlign, hAlign] = justify.split('-');

      let startY;
      if (vAlign === 'top') {
        startY = y + 1;
      } else if (vAlign === 'bottom') {
        startY = y + height - 1 - displayLines.length;
      } else {
        startY = y + 1 + Math.floor((innerHeight - displayLines.length) / 2);
      }

      displayLines.forEach((line, i) => {
        const displayLine = line.length > innerWidth ? line.substring(0, innerWidth) : line;
        let textX;

        if (hAlign === 'left') {
          textX = x + 1;
        } else if (hAlign === 'right') {
          textX = x + width - 1 - displayLine.length;
        } else {
          textX = x + 1 + Math.floor((innerWidth - displayLine.length) / 2);
        }

        for (let j = 0; j < displayLine.length; j++) {
          setChar(textX + j, startY + i, displayLine[j]);
        }
      });
    }
  }

  renderLineToBuffer(buffer, obj) {
    const { points, style, startCap, endCap } = obj;
    if (!points || points.length < 2) return;

    // Use shared LineStyles definition
    let chars = { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘' };
    if (AsciiEditor.tools && AsciiEditor.tools.LineStyles) {
      const styleDef = AsciiEditor.tools.LineStyles.find(s => s.key === style);
      if (styleDef) {
        chars = styleDef.chars;
      }
    }

    const setChar = (col, row, char) => {
      if (row >= 0 && row < buffer.length && col >= 0 && col < buffer[0].length) {
        buffer[row][col] = char;
      }
    };

    const getDirection = (from, to) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      if (dx > 0) return 'right';
      if (dx < 0) return 'left';
      if (dy > 0) return 'down';
      if (dy < 0) return 'up';
      return 'none';
    };

    // Draw each segment
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = Math.sign(p2.x - p1.x);
      const dy = Math.sign(p2.y - p1.y);

      if (dx !== 0 && dy === 0) {
        // Horizontal segment
        const startX = Math.min(p1.x, p2.x);
        const endX = Math.max(p1.x, p2.x);
        for (let x = startX; x <= endX; x++) {
          setChar(x, p1.y, chars.h);
        }
      } else if (dy !== 0 && dx === 0) {
        // Vertical segment
        const startY = Math.min(p1.y, p2.y);
        const endY = Math.max(p1.y, p2.y);
        for (let y = startY; y <= endY; y++) {
          setChar(p1.x, y, chars.v);
        }
      }
    }

    // Draw corners at intermediate points
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const inDir = getDirection(prev, curr);
      const outDir = getDirection(curr, next);

      const cornerMap = {
        'right-down': chars.tr,
        'right-up': chars.br,
        'left-down': chars.tl,
        'left-up': chars.bl,
        'down-right': chars.bl,
        'down-left': chars.br,
        'up-right': chars.tl,
        'up-left': chars.tr
      };

      const cornerChar = cornerMap[`${inDir}-${outDir}`];
      if (cornerChar) {
        setChar(curr.x, curr.y, cornerChar);
      }
    }

    // Draw endpoint caps
    const caps = {
      arrow: { right: '>', left: '<', down: 'v', up: '^' },
      triangle: { right: '▶', left: '◀', down: '▼', up: '▲' },
      'triangle-outline': { right: '▷', left: '◁', down: '▽', up: '△' },
      diamond: { right: '◆', left: '◆', down: '◆', up: '◆' },
      'diamond-outline': { right: '◇', left: '◇', down: '◇', up: '◇' },
      circle: { right: '●', left: '●', down: '●', up: '●' },
      'circle-outline': { right: '○', left: '○', down: '○', up: '○' },
      square: { right: '■', left: '■', down: '■', up: '■' },
      'square-outline': { right: '□', left: '□', down: '□', up: '□' }
    };

    if (startCap && startCap !== 'none' && caps[startCap]) {
      const dir = getDirection(points[0], points[1]);
      const capChar = caps[startCap][dir];
      if (capChar) setChar(points[0].x, points[0].y, capChar);
    }

    if (endCap && endCap !== 'none' && caps[endCap]) {
      const dir = getDirection(points[points.length - 2], points[points.length - 1]);
      const capChar = caps[endCap][dir];
      if (capChar) setChar(points[points.length - 1].x, points[points.length - 1].y, capChar);
    }
  }
};
