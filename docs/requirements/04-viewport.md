# Viewport Requirements (`VIEW-*`)

The viewport is the workspace where users interact with the diagram. Multiple viewport implementations are supported.

See [ADR 0008: Pluggable rendering](../adrs/0008-pluggable-rendering.md).

## Viewport abstraction

- [ ] **VIEW-1**: IViewport interface abstracts viewport implementation
- [ ] **VIEW-2**: Tools receive viewport via context, never access canvas directly
- [ ] **VIEW-3**: All coordinate transforms via `viewport.screenToCell()`
- [ ] **VIEW-4**: Viewport provides event target for mouse/keyboard events

## Canvas2D viewport (current)

- [~] **VIEW-10**: 2D canvas rendering (current implementation)
- [~] **VIEW-11**: Pan via mouse drag or keyboard
- [~] **VIEW-12**: Zoom via scroll wheel or +/- keys
- [x] **VIEW-13**: Grid overlay (toggleable)

## Three.js viewport (experimental)

- [ ] **VIEW-20**: Three.js 3D workspace as alternative viewport
- [ ] **VIEW-21**: OrthographicCamera for consistent cell sizing
- [ ] **VIEW-22**: Camera starts at 90° (top-down) matching 2D experience
- [ ] **VIEW-23**: Pan/zoom via MapControls
- [ ] **VIEW-24**: Tilt support for drafting-table angle
- [ ] **VIEW-25**: Isometric view preset (45° rotation)
- [ ] **VIEW-26**: Hotkey to toggle between top-down and isometric
- [ ] **VIEW-27**: Raycasting for `screenToCell()` coordinate transform
- [ ] **VIEW-28**: Same tools work in 3D as in 2D (via cell coordinates)

## Viewport switching

- [ ] **VIEW-30**: UI control to switch between Canvas2D and Three.js viewports
- [ ] **VIEW-31**: Viewport preference saved in project settings
- [ ] **VIEW-32**: Fallback to Canvas2D if Three.js unavailable
