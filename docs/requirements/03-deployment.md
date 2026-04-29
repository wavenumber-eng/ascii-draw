# Deployment Requirements (`DEP-*`)

- [x] **DEP-1**: Single standalone HTML file that runs locally (primary goal)
- [x] **DEP-2**: No server required - works with `file://` protocol
- [~] **DEP-3**: No external dependencies at runtime (fonts embedded or bundled)
- [x] **DEP-4**: Development may use build tools, but output is single portable file
- [ ] **DEP-5**: Alternative deployment as Python script acceptable
- [ ] **DEP-6**: Three.js viewport optional (loaded only when enabled)

See [ADR 0002: Vanilla JS, no build step](../adrs/0002-vanilla-js-no-build.md) for rationale.
