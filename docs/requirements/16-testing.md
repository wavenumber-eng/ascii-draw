# Testing (`TEST-*`)

See [ADR 0012: Testing strategy](../adrs/0012-testing-strategy.md) for the rationale and setup.

## Unit testing framework

- [x] **TEST-1**: Jest with jsdom for unit testing
- [x] **TEST-2**: Tests located in `test/` directory with `.test.js` suffix
- [x] **TEST-3**: Run tests with `npm test`

## Test coverage requirements

- [x] **TEST-10**: All utility functions must have unit tests
- [x] **TEST-11**: All Command classes must have execute/undo tests
- [x] **TEST-12**: Export rendering functions must have output verification tests
- [ ] **TEST-13**: New logic functions require corresponding unit tests before merge

## Test categories

| Status | ID | Category | Description |
|--------|-----|----------|-------------|
| [x] | **TEST-20** | `utils.test.js` | Core utilities: generateId, clamp, deepClone |
| [x] | **TEST-21** | `commands.test.js` | Command pattern: Create, Delete, Move, Modify |
| [x] | **TEST-22** | `export.test.js` | ASCII export: box rendering, borders, text, fill |
| [ ] | **TEST-23** | `state.test.js` | State management and history |
| [ ] | **TEST-24** | `tools.test.js` | Tool behavior (may need mocking) |

## Test commands

```bash
npm test               # Run all tests
npm test -- --watch    # Watch mode (re-run on changes)
npm test -- --coverage # Generate coverage report
npm test -- export     # Run only export tests
```

## Browser-based testing

- [x] **TEST-30**: `test/test-export.html` for interactive browser testing
- [x] **TEST-31**: Visual diff comparison for export output
- [x] **TEST-32**: Character-by-character analysis for debugging
