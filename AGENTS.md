# Repository Guidelines

## Project Structure & Module Organization
This arcade snake project is lean: `index.html` anchors the canvas, wires UI controls, and loads the ES module entrypoint. Core gameplay, mission tracking, and rendering stay together in `game.js`; keep helper functions near their call sites so movement, collision, and boss logic remain readable. Shared layout tokens and colors live in `styles.css` under the top-level `:root` block. Use `plan.md` for design notes and TODOs—update it when a feature ships so it reflects the current roadmap.

## Build, Test, and Development Commands
Spin up a local server with `python3 -m http.server 8000` and browse to `http://localhost:8000` for quick playtesting. If Python is unavailable, `npx http-server .` offers the same static hosting. After asset or CSS tweaks, force a hard refresh to pick up cache-busted changes.

## Coding Style & Naming Conventions
Write modern ES modules with `const`/`let`, and prefer arrow functions for callbacks bound to game events. Use two-space indentation throughout. Stick to camelCase for variables and functions, reserve `SCREAMING_SNAKE_CASE` for constants like `TICK_RATE`, and keep DOM ids/classes in kebab-case to match existing selectors. Add brief comments only when logic is non-obvious—self-documenting code is the default.

## Testing Guidelines
There is no automated suite yet, so rely on manual sweeps. After each change, run a local server, then verify snake movement, scoring updates, mission counters, power-up behavior, boss phases, and pause/resume controls. Refresh the page to confirm `localStorage` persists the high score while mission state resets. Capture the exact manual test actions in your PR notes for future regression coverage.

## Commit & Pull Request Guidelines
Use Conventional Commit prefixes (e.g., `feat: add sprint power-up`, `fix: reset mission timer`) with subjects under 72 characters. Squash WIP commits before pushing. PRs should summarize the change, include screenshots or GIFs for visual updates, list reproduction steps, and document manual testing results. Reference related issues with `Fixes #id` and call out follow-up work or open questions. Link updates to `plan.md` when relevant.
