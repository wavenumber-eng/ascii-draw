# Selection & Editing (`SEL-*`, `MSE-*`)

## Marquee selection

- [x] **SEL-1**: Left-to-right drag selects objects **fully enclosed**
- [x] **SEL-2**: Right-to-left drag selects objects **intersecting** marquee
- [x] **SEL-3**: Visual distinction: solid rectangle (enclosed), dashed rectangle (intersecting)
- [x] **SEL-4**: Ctrl+drag marquee adds to existing selection

## Single vs multi-select

- [x] **SEL-10**: Click object to select (deselects others)
- [x] **SEL-11**: Ctrl+click to add/remove from selection
- [x] **SEL-12**: Click empty space to deselect all
- [x] **SEL-13**: Escape key deselects all and returns to Select tool

## Selection operations

- [x] **SEL-20**: Single select: move, resize (handles), edit properties, delete
- [x] **SEL-21**: Multi-select: move together, delete, edit common properties
- [x] **SEL-22**: Resize handles shown only for single selection
- [x] **SEL-23**: Delete/Backspace removes selected objects

## Clipboard operations

- [x] **SEL-40**: Ctrl+C copies selected objects to internal clipboard
- [x] **SEL-41**: Ctrl+V pastes objects from clipboard at offset position
- [x] **SEL-42**: Ctrl+X cuts selected objects (copy + delete)
- [x] **SEL-43**: Paste creates new objects with new IDs
- [x] **SEL-44**: Paste offset: +2 chars right and down from original position
- [x] **SEL-45**: Pasted objects become the new selection
- [x] **SEL-46**: Clipboard persists across page switches within project

## Inline text editing

- [x] **SEL-30**: Double-click box opens inline editor for text content
- [x] **SEL-31**: Type-to-edit: with single box selected, typing starts editing with that character
- [x] **SEL-32**: Text rendered on canvas during editing (hidden textarea captures input)
- [x] **SEL-33**: Blinking cursor shown at insertion point
- [x] **SEL-34**: Escape cancels editing, discards changes
- [x] **SEL-35**: Click elsewhere or Tab commits changes
- [x] **SEL-36**: Text changes are undoable

## Multi-select property editing (`MSE-*`)

The Properties Panel supports editing common properties across multiple selected objects. When values differ, visual indicators show the mixed state and provide initialization from the first selected object.

### Property value states

- [x] **MSE-1**: Same value across selection: display normally (no indicator)
- [x] **MSE-2**: Different values (mixed): display mixed indicator by type
- [x] **MSE-3**: Mixed fields have `.mixed` CSS class for visual distinction (colored border, italic text)

### Mixed state indicators by type

| Status | ID | Type | Display Format | Example |
|--------|-----|------|----------------|---------|
| [x] | **MSE-10** | Number | Range: `min...max` | `10...25` |
| [x] | **MSE-11** | Text | Placeholder: `...` | `...` |
| [x] | **MSE-12** | Boolean | Indeterminate checkbox | `[■]` |
| [x] | **MSE-13** | Enum (select) | First value + asterisk | `single*` |
| [x] | **MSE-14** | Enum (buttons) | Dashed border on first value's button | — |

### Initialize from first object on focus

When user focuses a mixed field, auto-populate to enable quick editing:

- [x] **MSE-20**: Focus mixed **number** input → populate with **min value**, select all text
- [x] **MSE-21**: Focus mixed **text** input → populate with **first object's value**, select all text
- [x] **MSE-22**: Click mixed **checkbox** → apply clicked state to all objects
- [x] **MSE-23**: Select from mixed **dropdown** → apply selected value to all objects
- [x] **MSE-24**: Click mixed **button grid** → apply clicked value to all objects

### Data attributes for mixed fields

- [x] **MSE-25**: Number inputs store `data-min-value` and `data-first-value` attributes
- [x] **MSE-26**: Text inputs store `data-first-value` attribute
- [x] **MSE-27**: These attributes enable focus handlers to populate fields

### Batch updates

- [x] **MSE-30**: Property change applies to **all selected objects**
- [x] **MSE-31**: Each object creates **separate undo command** (granular undo)
- [x] **MSE-32**: Panel refreshes after batch update to reflect new state

### Selection order & value computation

- [x] **MSE-40**: First selected = first in selection ID array (order preserved)
- [x] **MSE-41**: `getCommonPropertyValue()` returns `firstValue` from first object
- [x] **MSE-42**: `getCommonPropertyValue()` computes `minValue`/`maxValue` for numbers

### CSS classes

- [x] **MSE-45**: `.mixed` class on inputs: colored border, italic placeholder
- [x] **MSE-46**: `.mixed-first` class on justify buttons: dashed border, accent color

### Supported properties

- [x] **MSE-50**: Multi-select editable properties:
  - Position: X, Y (numbers) — range indicator, min-value focus
  - Size: Width, Height (numbers) — range indicator, min-value focus
  - Style: Border style (enum/select), Shadow (boolean/checkbox)
  - Content: Justify (enum/buttons), Text (textarea)

### Architectural requirements

- [x] **MSE-60**: All object types MUST use `getCommonPropertyValue()` for property detection
- [x] **MSE-61**: All property panels MUST support multi-select editing (arrays of objects)
- [x] **MSE-62**: All property panels MUST use standard helper functions: `inputValue()`, `inputPlaceholder()`, `selectValue()`, `enumPlaceholder()`
- [x] **MSE-63**: All property panels MUST apply `.mixed` CSS class for visual distinction
- [x] **MSE-64**: Object-specific panels (pins, labels, etc.) MUST follow same patterns as core multi-select
