# Repository Guidelines

## Project Structure & Module Organization
- `index.html` binds the canvas, wires UI events, and loads the ES module entrypoint.
- `game.js` holds gameplay, mission tracking, and rendering logic—group related helpers near their usage.
- `styles.css` defines layout and theme tokens; keep shared values under the top-level `:root` block.
- `plan.md` captures design notes before they graduate into code; update or prune it when features ship.

## Build, Test, and Development Commands
- `python3 -m http.server 8000` — serves the project at http://localhost:8000 for quick playtesting.
- `npx http-server .` — Node-based static server alternative; use when Python is unavailable.
- Reload the browser after edits; perform a hard refresh when assets or styles change.

## Coding Style & Naming Conventions
- Use modern ES modules with `const`/`let`; favor arrow functions for callbacks and inline handlers.
- Follow two-space indentation and camelCase identifiers; reserve `SCREAMING_SNAKE_CASE` for constants.
- Keep DOM ids/classes in kebab-case to match existing selectors and CSS conventions.
- Add concise inline comments only where logic is non-obvious; keep the rest self-documenting.

## Testing Guidelines
- No automated suite yet. After changes, run a local server and verify snake movement, scoring, mission counters, power-up pickup, boss behavior, and pause/resume flows.
- Confirm `localStorage` persists the high score between sessions and that mission state resets appropriately.
- Document manual steps in PR descriptions to build institutional knowledge for future regression sweeps.

## Commit & Pull Request Guidelines
- Use Conventional Commit prefixes (e.g., `feat:`, `fix:`, `refactor:`) with imperative subjects under 72 characters.
- Squash work-in-progress commits before opening a PR.
- PRs should summarize the change, include screenshots or GIFs for UI updates, list repro steps, and note manual testing results.
- Reference related issues with `Fixes #id` when applicable and highlight any follow-up work or open questions.
