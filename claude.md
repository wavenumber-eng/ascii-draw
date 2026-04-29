# Claude Code Guidelines

## Project documentation

The root is kept clean of doc files. Everything lives under `docs/`:

- **`docs/adrs/`** — Architecture decisions. Start with [`00-overview.md`](docs/adrs/00-overview.md), then numbered ADRs.
- **`docs/requirements/`** — Functional requirements split by section. Index at [`00-index.md`](docs/requirements/00-index.md).
- **`docs/plans/`** — Active implementation plans + status audit.
- **`docs/research/`** — Reference material (visual references, design notes).

When the user asks about *how* something is built, look in `docs/adrs/`. When they ask *what* the product does or whether a feature is required, look in `docs/requirements/`. When they ask *what's left to do*, look in `docs/plans/00-status-audit.md`.

## Commit messages

- Keep commit messages simple and to the point
- No emojis
- No Claude/AI attribution or branding
- Describe what changed, not how it was made
- Use imperative mood (e.g., "Add resize functionality" not "Added resize functionality")

Example good commits:
- "Add resize handles to select tool"
- "Fix box rendering at canvas edge"
- "Implement wire tool with net labels"

Example bad commits:
- "🎉 Add awesome new feature!"
- "Generated with Claude Code"
- "AI-assisted implementation of..."

## UI style guidelines

- **Sharp corners only** — always use `border-radius: 0`, no rounded corners anywhere
- Use Berkeley Mono font throughout the UI
- Dark theme with accent color `#007acc`
