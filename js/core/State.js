/**
 * Initial State Factory
 * Implements: ARCH-20 (state structure), DATA-1 to DATA-4
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.core = AsciiEditor.core || {};

AsciiEditor.core.createInitialState = function() {
  return {
    project: {
      meta: {
        name: 'Untitled',
        version: '1.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString()
      },
      settings: {
        charWidth: 10,
        charHeight: 20,
        defaultPageWidth: 120,
        defaultPageHeight: 60,
        font: 'BerkeleyMono',
        fontSize: 16
      },
      parameters: {
        PROJECT_NAME: 'Untitled Project',
        AUTHOR: '',
        COMPANY: '',
        REVISION: '1.0',
        DATE: new Date().toISOString().split('T')[0]
      },
      pages: [
        {
          id: 'page-1',
          name: 'Main',
          width: 120,
          height: 60,
          parameters: {},
          objects: []
        }
      ],
      interfaces: [],
      nets: []
    },
    activePageId: 'page-1',
    viewState: {
      'page-1': { zoom: 1.0, panX: 0, panY: 0 }
    },
    selection: {
      ids: [],
      handles: null
    },
    activeTool: 'select',
    toolState: {},
    clipboard: {
      sourcePageId: null,
      objects: []
    },
    ui: {
      sidebarVisible: true,
      propertiesPanelVisible: true,
      pageListVisible: true,
      gridVisible: true,
      viewMode: 'single'
    },
    gridLayout: {
      columns: 3,
      pageSpacing: 20,
      zoom: 0.3,
      panX: 0,
      panY: 0
    },
    navigationStack: []
  };
};
