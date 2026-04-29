# Vision & Overview

## Core concept: cell-based diagram engine

This is fundamentally a **cell-based (grid-based) diagram editor** — conceptually similar to tile-based engines from 8-bit and 16-bit games. Each cell in the grid contains a single graphical element.

The **current primary output** is ASCII art using Berkeley Mono font styling with UTF box-drawing characters. However, the architecture supports **multiple rendering backends** (ASCII, SVG, 3D) and **multiple viewports** (2D canvas, Three.js 3D).

See [ADR 0001: Cell-Based Diagram Engine](../adrs/0001-cell-based-engine.md) for the architectural rationale.

## Key principles

- **Cell coordinates are universal**: All objects are positioned in cell coordinates (col, row).
- **Rendering is pluggable**: ASCII characters, SVG elements, or 3D meshes can fill cells.
- **Viewport is abstract**: 2D canvas or 3D workspace with the same tools.
- **Cell dimensions are configurable**: Different fonts have different aspect ratios.

## Use cases

1. **ASCII Diagrams** — Block diagrams, flowcharts, architecture docs for README/comments.
2. **Schematic Capture** — Lightweight EDA with symbols, pins, wires, netlists.
3. **3D Visualization** — Isometric/tilted view for presentations (future).

**Inspiration:** `../research/berkley_mono_reference.png` — clean boxes, arrows, shadow effects using extended ASCII/UTF characters.

**Data Model:** A connectivity graph with cell-based rendering. The JSON data model captures both structure (connections) and presentation (layout), enabling netlist generation, BOM export, and design rule checks while maintaining a lightweight, visual-first approach.
