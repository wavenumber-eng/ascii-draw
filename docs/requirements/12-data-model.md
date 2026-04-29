# Data Model (`DATA-*`)

See [ADR 0005: Immutable state](../adrs/0005-immutable-state.md) for the in-memory state shape.

## Project structure

- [x] **DATA-1**: Project contains multiple pages
- [x] **DATA-2**: Each page has: id, name, dimensions, objects array
- [~] **DATA-3**: Project has global parameters (key-value)
- [ ] **DATA-4**: Pages can override project parameters

## Object serialization

- [x] **DATA-10**: All objects serialize to plain JSON
- [x] **DATA-11**: Full metadata: position, size, text, style, connections, pins
- [ ] **DATA-12**: Object parameters (arbitrary key-value) stored with object

## Project parameters

- [ ] **DATA-20**: Title block fields: name, author, date, revision, company
- [ ] **DATA-21**: Text substitution: `${PARAM_NAME}` in text objects
- [ ] **DATA-22**: Custom metadata: part numbers, URLs, notes

## Multi-page support

- [x] **DATA-30**: Navigate between pages via tabs
- [ ] **DATA-31**: Ports/nets link across pages (global net names)
- [ ] **DATA-32**: Grid view mode: see multiple pages side-by-side (future)

## File operations

- [x] **DATA-40**: Save project as JSON file (Ctrl+S)
- [x] **DATA-41**: Load project from JSON file
- [x] **DATA-42**: Project file stores complete state for editing

## Auto-save (recovery)

- [x] **DATA-50**: Auto-save to localStorage on edits (debounced, 2 second delay)
- [x] **DATA-51**: Restore from localStorage on startup if data exists
- [x] **DATA-52**: Clear localStorage after successful manual save
