/**
 * Editor - Main application orchestrator
 * Implements: UI-*, DATA-40 to DATA-42, EXP-1 to EXP-3
 */

var AsciiEditor = AsciiEditor || {};

AsciiEditor.Editor = class Editor {
  constructor() {
    this.canvas = document.getElementById('editor-canvas');
    this.history = new AsciiEditor.core.HistoryManager(AsciiEditor.core.createInitialState());
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

    this.init();
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

    // Set context
    this.toolManager.setContext({
      canvas: this.canvas,
      grid: this.grid,
      history: this.history,
      startInlineEdit: (obj, initialChar) => this.startInlineEdit(obj, initialChar)
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
      } else {
        content.innerHTML = `<div class="property-empty">Unknown object type</div>`;
      }
    } else {
      this.renderMultiSelectProperties(selectedObjects);
    }
  }

  getCommonPropertyValue(objects, prop) {
    if (objects.length === 0) return { value: null, mixed: false };

    const firstValue = objects[0][prop];
    const allSame = objects.every(obj => {
      const val = obj[prop];
      if (val === firstValue) return true;
      if (val === undefined && firstValue === undefined) return true;
      if (val === '' && firstValue === '') return true;
      return false;
    });

    return {
      value: allSame ? firstValue : null,
      mixed: !allSame
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
      title: this.getCommonPropertyValue(objects, 'title'),
      titlePosition: this.getCommonPropertyValue(objects, 'titlePosition'),
      titleMode: this.getCommonPropertyValue(objects, 'titleMode'),
      textJustify: this.getCommonPropertyValue(objects, 'textJustify'),
      text: this.getCommonPropertyValue(objects, 'text')
    };

    const inputValue = (prop) => prop.mixed ? '' : (prop.value ?? '');
    const inputPlaceholder = (prop, defaultPlaceholder = '') => prop.mixed ? '...' : defaultPlaceholder;
    const selectValue = (prop, defaultVal) => prop.mixed ? '' : (prop.value ?? defaultVal);
    const checkboxState = (prop) => {
      if (prop.mixed) return { checked: false, indeterminate: true };
      return { checked: !!prop.value, indeterminate: false };
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
            value="${inputValue(props.x)}" placeholder="${inputPlaceholder(props.x)}">
        </div>
        <div class="property-row">
          <span class="property-label">Y</span>
          <input type="number" class="property-input ${props.y.mixed ? 'mixed' : ''}" id="prop-y"
            value="${inputValue(props.y)}" placeholder="${inputPlaceholder(props.y)}">
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Size</div>
        <div class="property-row">
          <span class="property-label">Width</span>
          <input type="number" class="property-input ${props.width.mixed ? 'mixed' : ''}" id="prop-width"
            value="${inputValue(props.width)}" placeholder="${inputPlaceholder(props.width)}" min="3">
        </div>
        <div class="property-row">
          <span class="property-label">Height</span>
          <input type="number" class="property-input ${props.height.mixed ? 'mixed' : ''}" id="prop-height"
            value="${inputValue(props.height)}" placeholder="${inputPlaceholder(props.height)}" min="3">
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Style</div>
        <div class="property-row">
          <span class="property-label">Border</span>
          <select class="property-select ${props.style.mixed ? 'mixed' : ''}" id="prop-style">
            ${props.style.mixed ? '<option value="" selected>...</option>' : ''}
            <option value="single" ${selectValue(props.style, 'single') === 'single' ? 'selected' : ''}>Single</option>
            <option value="double" ${selectValue(props.style, '') === 'double' ? 'selected' : ''}>Double</option>
            <option value="rounded" ${selectValue(props.style, '') === 'rounded' ? 'selected' : ''}>Rounded</option>
          </select>
        </div>
        <div class="property-row">
          <label class="property-checkbox">
            <input type="checkbox" id="prop-shadow" ${shadowState.checked ? 'checked' : ''}>
            <span>Drop Shadow ${props.shadow.mixed ? '(mixed)' : ''}</span>
          </label>
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Title</div>
        <div class="property-row">
          <input type="text" class="property-input ${props.title.mixed ? 'mixed' : ''}" id="prop-title"
            value="${inputValue(props.title)}" placeholder="${inputPlaceholder(props.title, 'Box title')}">
        </div>
        <div class="property-row">
          <span class="property-label">Position</span>
          <select class="property-select ${props.titlePosition.mixed ? 'mixed' : ''}" id="prop-titlePosition">
            ${props.titlePosition.mixed ? '<option value="" selected>...</option>' : ''}
            <option value="top-left" ${selectValue(props.titlePosition, 'top-left') === 'top-left' ? 'selected' : ''}>Top Left</option>
            <option value="top-center" ${selectValue(props.titlePosition, '') === 'top-center' ? 'selected' : ''}>Top Center</option>
            <option value="top-right" ${selectValue(props.titlePosition, '') === 'top-right' ? 'selected' : ''}>Top Right</option>
            <option value="bottom-left" ${selectValue(props.titlePosition, '') === 'bottom-left' ? 'selected' : ''}>Bottom Left</option>
            <option value="bottom-center" ${selectValue(props.titlePosition, '') === 'bottom-center' ? 'selected' : ''}>Bottom Center</option>
            <option value="bottom-right" ${selectValue(props.titlePosition, '') === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
          </select>
        </div>
        <div class="property-row">
          <span class="property-label">Mode</span>
          <select class="property-select ${props.titleMode.mixed ? 'mixed' : ''}" id="prop-titleMode">
            ${props.titleMode.mixed ? '<option value="" selected>...</option>' : ''}
            <option value="border" ${selectValue(props.titleMode, 'border') === 'border' ? 'selected' : ''}>On Border</option>
            <option value="inside" ${selectValue(props.titleMode, '') === 'inside' ? 'selected' : ''}>Inside</option>
            <option value="outside" ${selectValue(props.titleMode, '') === 'outside' ? 'selected' : ''}>Outside</option>
          </select>
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Text Content</div>
        <div class="property-row">
          <span class="property-label">Justify</span>
        </div>
        <div class="justify-grid" id="justify-grid">
          <button class="justify-btn ${!props.textJustify.mixed && props.textJustify.value === 'top-left' ? 'active' : ''}" data-justify="top-left" title="Top Left">&#x2196;</button>
          <button class="justify-btn ${!props.textJustify.mixed && props.textJustify.value === 'top-center' ? 'active' : ''}" data-justify="top-center" title="Top Center">&#x2191;</button>
          <button class="justify-btn ${!props.textJustify.mixed && props.textJustify.value === 'top-right' ? 'active' : ''}" data-justify="top-right" title="Top Right">&#x2197;</button>
          <button class="justify-btn ${!props.textJustify.mixed && props.textJustify.value === 'center-left' ? 'active' : ''}" data-justify="center-left" title="Center Left">&#x2190;</button>
          <button class="justify-btn ${!props.textJustify.mixed && props.textJustify.value === 'center-center' ? 'active' : ''}" data-justify="center-center" title="Center">&#x25CF;</button>
          <button class="justify-btn ${!props.textJustify.mixed && props.textJustify.value === 'center-right' ? 'active' : ''}" data-justify="center-right" title="Center Right">&#x2192;</button>
          <button class="justify-btn ${!props.textJustify.mixed && props.textJustify.value === 'bottom-left' ? 'active' : ''}" data-justify="bottom-left" title="Bottom Left">&#x2199;</button>
          <button class="justify-btn ${!props.textJustify.mixed && props.textJustify.value === 'bottom-center' ? 'active' : ''}" data-justify="bottom-center" title="Bottom Center">&#x2193;</button>
          <button class="justify-btn ${!props.textJustify.mixed && props.textJustify.value === 'bottom-right' ? 'active' : ''}" data-justify="bottom-right" title="Bottom Right">&#x2198;</button>
        </div>
        <textarea class="property-textarea ${props.text.mixed ? 'mixed' : ''}" id="prop-text"
          placeholder="${inputPlaceholder(props.text, 'Text content')}">${inputValue(props.text)}</textarea>
      </div>
    `;

    const shadowCheck = document.getElementById('prop-shadow');
    if (shadowCheck && props.shadow.mixed) {
      shadowCheck.indeterminate = true;
    }

    this.wireMultiSelectListeners(objectIds);
  }

  wireMultiSelectListeners(objectIds) {
    ['x', 'y', 'width', 'height'].forEach(prop => {
      const input = document.getElementById(`prop-${prop}`);
      if (input) {
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

    const titleInput = document.getElementById('prop-title');
    if (titleInput) {
      titleInput.addEventListener('change', () => {
        this.updateMultipleObjectsProperty(objectIds, 'title', titleInput.value);
      });
    }

    const titlePosSelect = document.getElementById('prop-titlePosition');
    if (titlePosSelect) {
      titlePosSelect.addEventListener('change', () => {
        if (titlePosSelect.value === '') return;
        this.updateMultipleObjectsProperty(objectIds, 'titlePosition', titlePosSelect.value);
      });
    }

    const titleModeSelect = document.getElementById('prop-titleMode');
    if (titleModeSelect) {
      titleModeSelect.addEventListener('change', () => {
        if (titleModeSelect.value === '') return;
        this.updateMultipleObjectsProperty(objectIds, 'titleMode', titleModeSelect.value);
      });
    }

    document.querySelectorAll('[data-justify]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.updateMultipleObjectsProperty(objectIds, 'textJustify', btn.dataset.justify);
      });
    });

    const textArea = document.getElementById('prop-text');
    if (textArea) {
      textArea.addEventListener('change', () => {
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

  renderBoxProperties(obj) {
    const content = document.getElementById('properties-content');
    const justify = obj.textJustify || 'center-center';
    const titlePos = obj.titlePosition || 'top-left';
    const titleMode = obj.titleMode || 'border';

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
            <option value="rounded" ${obj.style === 'rounded' ? 'selected' : ''}>Rounded</option>
          </select>
        </div>
        <div class="property-row">
          <label class="property-checkbox">
            <input type="checkbox" id="prop-shadow" ${obj.shadow ? 'checked' : ''}>
            <span>Drop Shadow</span>
          </label>
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Title</div>
        <div class="property-row">
          <input type="text" class="property-input" id="prop-title" value="${obj.title || ''}" placeholder="Box title">
        </div>
        <div class="property-row">
          <span class="property-label">Position</span>
          <select class="property-select" id="prop-titlePosition">
            <option value="top-left" ${titlePos === 'top-left' ? 'selected' : ''}>Top Left</option>
            <option value="top-center" ${titlePos === 'top-center' ? 'selected' : ''}>Top Center</option>
            <option value="top-right" ${titlePos === 'top-right' ? 'selected' : ''}>Top Right</option>
            <option value="bottom-left" ${titlePos === 'bottom-left' ? 'selected' : ''}>Bottom Left</option>
            <option value="bottom-center" ${titlePos === 'bottom-center' ? 'selected' : ''}>Bottom Center</option>
            <option value="bottom-right" ${titlePos === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
          </select>
        </div>
        <div class="property-row">
          <span class="property-label">Mode</span>
          <select class="property-select" id="prop-titleMode">
            <option value="border" ${titleMode === 'border' ? 'selected' : ''}>On Border</option>
            <option value="inside" ${titleMode === 'inside' ? 'selected' : ''}>Inside</option>
            <option value="outside" ${titleMode === 'outside' ? 'selected' : ''}>Outside</option>
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

    const titleInput = document.getElementById('prop-title');
    if (titleInput) {
      titleInput.addEventListener('change', () => {
        this.updateObjectProperty(obj.id, 'title', titleInput.value);
      });
    }

    const titlePosSelect = document.getElementById('prop-titlePosition');
    if (titlePosSelect) {
      titlePosSelect.addEventListener('change', () => {
        this.updateObjectProperty(obj.id, 'titlePosition', titlePosSelect.value);
      });
    }

    const titleModeSelect = document.getElementById('prop-titleMode');
    if (titleModeSelect) {
      titleModeSelect.addEventListener('change', () => {
        this.updateObjectProperty(obj.id, 'titleMode', titleModeSelect.value);
      });
    }

    document.querySelectorAll('[data-justify]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.updateObjectProperty(obj.id, 'textJustify', btn.dataset.justify);
      });
    });

    const textArea = document.getElementById('prop-text');
    if (textArea) {
      textArea.addEventListener('change', () => {
        this.updateObjectProperty(obj.id, 'text', textArea.value);
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
    }
  }

  renderBoxToBuffer(buffer, obj) {
    const { x, y, width, height, style, text, shadow } = obj;

    const chars = {
      single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
      double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
      rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' }
    };

    const c = chars[style] || chars.single;

    const setChar = (col, row, char) => {
      if (row >= 0 && row < buffer.length && col >= 0 && col < buffer[0].length) {
        buffer[row][col] = char;
      }
    };

    if (shadow) {
      for (let row = 1; row <= height; row++) {
        setChar(x + width, y + row, '░');
      }
      for (let col = 1; col < width; col++) {
        setChar(x + col, y + height, '░');
      }
      setChar(x + width, y + height, '░');
    }

    setChar(x, y, c.tl);
    for (let col = 1; col < width - 1; col++) {
      setChar(x + col, y, c.h);
    }
    setChar(x + width - 1, y, c.tr);

    for (let row = 1; row < height - 1; row++) {
      setChar(x, y + row, c.v);
      setChar(x + width - 1, y + row, c.v);
    }

    setChar(x, y + height - 1, c.bl);
    for (let col = 1; col < width - 1; col++) {
      setChar(x + col, y + height - 1, c.h);
    }
    setChar(x + width - 1, y + height - 1, c.br);

    if (obj.title) {
      const titlePos = obj.titlePosition || 'top-left';
      const titleMode = obj.titleMode || 'border';
      const [titleV, titleH] = titlePos.split('-');
      const maxTitleLen = width - 4;
      const displayTitle = obj.title.length > maxTitleLen ? obj.title.substring(0, maxTitleLen) : obj.title;

      let titleX, titleY;

      if (titleV === 'top') {
        if (titleMode === 'outside') titleY = y - 1;
        else if (titleMode === 'inside') titleY = y + 1;
        else titleY = y;
      } else if (titleV === 'bottom') {
        if (titleMode === 'outside') titleY = y + height;
        else if (titleMode === 'inside') titleY = y + height - 2;
        else titleY = y + height - 1;
      }

      if (titleH === 'left') {
        titleX = titleMode === 'inside' ? x + 1 : x + 2;
      } else if (titleH === 'center') {
        titleX = x + Math.floor((width - displayTitle.length) / 2);
      } else if (titleH === 'right') {
        titleX = titleMode === 'inside' ? x + width - displayTitle.length - 1 : x + width - displayTitle.length - 2;
      }

      for (let i = 0; i < displayTitle.length; i++) {
        setChar(titleX + i, titleY, displayTitle[i]);
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
};
