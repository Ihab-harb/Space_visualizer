---
title: Start here — how to continue this project
date: 2026-10-10
tags: [index, process]
---

# Start here: how to continue this project

Back to [[Home]]

This note gives a new chat, or a new person, what it needs to carry on: the goals, the working agreements, the process and the environment quirks. Read it first, then the latest note in `Sessions/`, then the plan named there.

## 1. What the project is
- **What:** a 3D, time-accurate solar system in the browser. **Accuracy, information and visuals carry equal weight.** See [[2026-10-04-solar-system-visualizer-design]].
- **Sources:** every value comes from an official source and is cited in the app (NASA, JPL, NSSDCA, USGS, ESA, NAIF, IERS, STScI). Illustrative visuals are allowed and labelled as such. No data is ever derived from a visual. Rules: M2 spec §2, [[2026-10-04-m2-cinematic-and-rich-bodies-design]].
- **Visual bar:** cinematic, at the level of [sael.net](https://sael.net/). That means studio lighting, bloom, depth of field, an editorial interface and self-playing chapters, with two styles, **Realistic** (official maps) and **Exhibit** (stylized, from M2c), and adaptive quality. Graphics are a first-class deliverable. On every visual task, run the screenshot-and-refine loop: render, look at the image, fix, repeat. Never ship placeholder visuals without saying so.
- **Roadmap:** it grows to stars and galaxies later, runs locally now and gets deployed in M7. The milestone table is in M2 spec §3.

## 2. Where things are
- **This vault** is the project documentation. Keep it current in the same piece of work as the code.
  - Index: [[Home]].
  - Specs and plans: `Specs/`, `Plans/`.
  - Decisions: `Decisions/`, ADR style.
  - Architecture: one note per module.
  - Data Sources: one note per source family.
  - History: [[Changelog]], and `Sessions/` for chat history.
- **Open items:** [[2026-10-05-m2a1-carry-over]] lists every deferred item, grouped by the section it came from.
- **Repo docs:** `README.md` (overview, controls, URL parameters) and `docs/SETUP.md` (requirements, running, testing, the data pipeline, troubleshooting).
- **Code map:**
  - `src/core` (pure maths, catalogue, ephemeris, time, details schema);
  - `src/state` (Zustand stores);
  - `src/scene`, `src/render` (three.js / R3F, effects, quality);
  - `src/camera`;
  - `src/ui`;
  - `pipeline/` (offline data and texture builds; `pipeline/raw/` is a git-ignored cache);
  - `public/data`, `public/textures` (committed outputs).

  See [[Overview]].

## 3. Working agreements (decided by the user)
- **Sections and pull requests:** work proceeds in sections (M2a.1, M2a.2, M2a.3, M2b.1 and so on), each on its own branch with **its own PR**. If the previous section's PR is unmerged, branch from that section's branch and target the PR at it, so it is stacked. Branches are created **in place**, not in a git worktree, so the Obsidian vault shows changes live.
- **Commits and pushes:** only when asked, or as the agreed end-of-section step. Every commit message ends with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  PR descriptions end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Pushing:** SSH has no key configured, so push over HTTPS through the GitHub CLI login, without changing the global git config:
  `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push`
  The repo is https://github.com/Ihab-harb/Space_visualizer (public).
- **Welcome.md:** do not delete it without the user's consent.
- **Chat history:** the vault holds the chat history. Each session adds to or updates a note in `Sessions/`, recording requests, decisions, requests that produced no code, the state at the end and the open questions. It is updated at milestones and before stopping.
- **Rulings:** decisions made on the user's behalf while building (rulings) are always written into the plan note's "Execution record" before any scratch files are deleted.
- **Writing:** plain, short sentences in user-facing text.

## 4. How a section is built
1. **Brainstorm** the design with the user, one question at a time, then write a **spec** in `Specs/`. The user approves it.
2. **Write the plan** in `Plans/`. It has:
   - a header (goal, architecture, global constraints, Review Focus);
   - tasks with exact files, interfaces, tests that fail first, commands with their expected output, and commit steps.
3. **Execute it subagent-driven** (the user's standing choice):
   - a fresh implementer per task, then a fresh reviewer per task (spec compliance and code quality);
   - fix rounds until the review is clean, with at most 5 rounds;
   - a review of the whole branch on the most capable model, then one fix wave and one scoped re-review.
   - Progress lives in a git-ignored ledger, `.superpowers/sdd/<plan-name>/progress.md`. Every ruling and deferred minor finding is copied into the vault before that directory is deleted.
4. **Finish:** update the docs and the vault, push the branch, and open the stacked PR when the user asks.

Per-task reviews run on Sonnet and the final whole-branch reviews on Opus, because the user once declined an Opus per-task reviewer.

## 5. Environment and quirks (Windows dev machine)
- **Shell:** Windows 11, PowerShell, with Git Bash also available. Node, with `npm test` (Vitest, globals off), `npm run typecheck`, `npx playwright test` and `npm run perf`. The scripts are listed in `docs/SETUP.md`.
- **End-to-end runs:** a full Playwright run takes **about 8–10 minutes** under SwiftShader. **Never run two Playwright runs at once,** because they share `test-results/`. The runner **sometimes doesn't exit** after printing its summary; kill it.
- **GPU:** the dev machine has an **integrated Intel UHD** GPU. High and Medium run at about 100 ms per frame, and Auto settles at Low. No discrete GPU has been measured. Numbers are in [[render]].
- **Data and textures:**
  - **Data pipeline:** `npm run data` (online) and `npm run data:offline` (rebuilds from the `pipeline/raw/` cache with no network).
  - **Texture pipeline:** `npm run textures`. The first download is a cache of about 5 GB, and the Venus mosaic alone is about 170 MB.
  - `npm run textures:hd` builds 4k and 8k tiers locally; they are git-ignored.
- **Golden screenshots:** generated by `e2e/golden.spec.ts` into `test-results/golden/`; reviewed copies are kept in `Assets/`.

## 5b. Cloud sessions (Claude Code on the web)
A cloud session clones the repo from GitHub onto a fresh Linux machine. It has no GPU and none of the local caches, and it can't see Claude's local memory files, which is why this note exists.

**Setup:** run `npm ci`. Run `npx playwright install --with-deps chromium` only if end-to-end tests are needed. Run `npm run data` to rebuild data, because the `pipeline/raw/` cache is not in the repo.

**Branch:** start from the current section branch. It is named in "Current state" below.

**Suited:**
- unit-tested code and pipeline parsers;
- curation research with quote checks (it needs network access to NASA pages);
- docs, vault notes and PRs.

**Slow:** full Playwright runs, which take 8–10 minutes or more after installing the browser.

**Keep on the user's PC:**
- anything that downloads imagery (texture caches are several GB);
- performance tuning (there is no GPU);
- visual polish judged by eye.

**Cost:** subagent-driven execution starts many fresh agents. Inline execution with one final review is cheaper in the cloud.

**Afterwards:** push the branch so the user can pull it locally and see the vault update in Obsidian.

## 6. Current state
- **Latest:** see the most recent note in `Sessions/` (currently [[2026-10-04-session-m1-to-m2a3]], which also records M2b.1).
- **As of 2026-10-16:**
  - PRs #1–#5 are open and stacked (M1 → M2a.1 → M2a.2 → M2a.3 → M2b.1), none merged.
  - **M2b.1** ([[2026-10-10-m2b1-body-details]]) is complete, on branch `m2b1-details`, and open as PR #5 (base `m2a3-interface`). All ten tasks are done and the whole-branch review fix wave is applied (as of 2026-10-16: 690 unit tests, typecheck clean, 76 end-to-end tests; the data has 43 mission entries covering 39 distinct missions). **Next:** M2b.2, the Moon. It starts with a design discussion and a spec. A new section branch stacks on `m2b1-details`.
- **Known gap:** the per-task rulings of M2a.1 and M2a.2 were not preserved, because those ledgers were deleted before rulings were copied into the vault. Their outcomes are in [[Changelog]], [[2026-10-05-m2a1-carry-over]], [[0007-tone-mapping-and-exposure]] and [[render]].
