# Solar System Visualizer

A 3D, time-accurate solar system in the browser. Every value shown is cited to an official source (NASA, JPL, NSSDCA, USGS, ESA, NAIF, IERS, STScI).

## Read first
- **Cloud session** (`CLAUDE_CODE_REMOTE=true`): `Space_visualizer/Cloud sessions.md`, then your task in `Space_visualizer/Plans/2026-10-16-cloud-task-queue.md`.
- **Every session:** `Space_visualizer/Start here.md` (goals, working agreements, process, environment), then the newest note in `Space_visualizer/Sessions/`, then the plan the task names.

The Obsidian vault in `Space_visualizer/` is the project documentation and the record of past chats. Keep it current in the same piece of work as the code.

## Hard rules
- Official sources only, each value cited; curated values keep the exact sentence they came from. No Wikipedia or aggregators.
- Commit and push only when asked, or as the agreed end-of-section step (cloud tasks: see `Cloud sessions.md` §4).
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- One branch and one PR per section or task.
- Never stop processes by name (`taskkill /IM node.exe`, `pkill node`). Stop only the process you started.
- Never run two Playwright runs at once on one machine (they share `test-results/`).
- Plain, short sentences in user-facing text.

## Commands
- `npm test` (Vitest), `npm run typecheck`
- `npx playwright test [file]` (end-to-end, SwiftShader; full run about 8–10 min)
- `npm run data` (rebuild data from official sources; needs network) · `npm run data:offline` (from the `pipeline/raw/` cache)
- `npm run textures*` and `npm run perf`: local machine only (GB-sized downloads; real GPU)

Setup, scripts and troubleshooting: `docs/SETUP.md`.
