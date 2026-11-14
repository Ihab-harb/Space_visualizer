---
title: Cloud sessions — how to use them in this project
date: 2026-10-16
tags: [index, process, cloud]
---

# Cloud sessions: how to use them in this project

Back to [[Home]] · [[Start here]] · Work list: [[2026-10-16-cloud-task-queue]] · One-time setup: [[2026-10-16-cloud-sessions-setup]]

**Why they exist here:** to get work out of the way while the user and a local session focus on design, visuals and performance. A cloud session takes one well-defined job from the [[2026-10-16-cloud-task-queue|cloud task queue]], does it on its own branch, and hands back a pushed branch, a PR and a short note.

**If you are a cloud session, read this note in full, then [[Start here]], then your task in the queue.** Your local memory is empty; this vault is your memory.

## 1. What a cloud session is
- Claude Code running on a fresh Linux machine (Ubuntu 24.04, 4 CPUs, 16 GB RAM, 30 GB disk). It starts from a **clone of the GitHub repo**, not the user's PC. Anything not pushed does not exist there.
- It has **no GPU**, **no `pipeline/raw/` cache** (about 4.4 GB of downloads on the user's PC) and none of the user's local Claude memory or plugins (the superpowers skills are not installed).
- It keeps running when the user's PC is off. The user can steer it from the browser or the phone.
- After a while without activity the machine is reclaimed. The conversation is kept; **uncommitted files and running commands are lost.**
- It uses the same usage limits as all other Claude use. Several at once spend them faster.

## 2. What to send to the cloud, and what not

| Good fit (send it) | Keep on the user's PC |
|---|---|
| Plan tasks with unit tests (`npm test`, `npm run typecheck`) | Texture downloads and builds (`npm run textures*`; GB-sized cache, 8 GB heap) |
| Pipeline parsers, checks and their tests | Performance tuning (`npm run perf` needs a real GPU) |
| Curation research: finding official values and their exact sentences on NASA, JPL, NSSDCA, USGS and ESA pages | Look tuning and anything judged by eye (shaders, lighting, effects) |
| Source research that prepares a design discussion | Brainstorming and spec approval (they need the user) |
| Docs and vault fixes, test gaps, small refactors | Merging PRs and the integrator pass (see §5) |
| End-to-end tests (`npx playwright test`; SwiftShader, same as locally) | Final judgement of golden screenshots |

A cloud task that reaches a "keep local" step stops there and writes it down as a **local follow-up** in its session note.

## 3. Starting work (cloud session checklist)
1. Read this note, [[Start here]] and the newest note in `Sessions/`.
2. Read your task in [[2026-10-16-cloud-task-queue]]: it names the base branch, the new branch, the scope, the files and "done when".
3. Check the machine: `node --version` must print `v24.` (the project needs Node ≥ 24; the machine's default is 22). If it does not, run `export PATH=/opt/node24/bin:$PATH`; if `/opt/node24` is missing, the environment setup has not been done: stop and say so.
4. `npm ci` if `node_modules/` is missing, then `npm run typecheck` and `npm test` to get a clean baseline (690 tests on 2026-10-16). If the baseline is not clean, stop and report it.
5. Create your branch from the base the task names. Never branch from `main` unless the task says so: until PRs #1–#5 are merged, `main` holds almost none of the app.

## 4. Rules while working
1. **One task, one branch, one PR.** Do not widen the scope. If you need a file outside the task's file list, stop and ask.
2. **Vault ownership.** Edit only (a) the plan or research note your task names and (b) your own session note, `Sessions/YYYY-MM-DD-cloud-<task-id>.md`. Do **not** edit `Home.md`, `Changelog.md`, [[Start here]], this note, the task queue or the carry-over note; parallel sessions would conflict there. The integrator pass updates them.
3. **Record rulings as you go.** Any decision you make on the user's behalf goes into your session note (and the plan's Execution record if you execute a plan) in the same commit as the change. There is no git-ignored ledger in the cloud.
4. **Commit and push after every finished step that passes its tests.** A reclaimed machine loses what is not pushed. The working agreement "commit only when asked" is lifted for cloud tasks on their own branch; it still applies to every other branch.
5. **Project rules still apply** ([[Start here]] §1 and §3): official sources only, with the exact sentence for every curated value; plain, short sentences in user-facing text; every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
6. **Never stop processes by name** (`pkill node`, `killall`). Stop only the process you started.
7. **Do not commit `retrievedAt`-only changes** after `npm run data` (`git checkout -- public/data` reverts them), unless the task is a data refresh.

## 5. Handing back
At the end of a task, the cloud session:
1. runs `npm run typecheck`, `npm test`, and the e2e specs the task names;
2. writes its session note: what was done, rulings, deferred findings, local follow-ups, test results;
3. pushes and opens a PR against the task's base branch, titled `<task-id>: <summary>`, with a short body and the PR footer.

The **integrator pass** is done locally by the user with Claude after merging: mark the task done in the queue, tick the items in [[2026-10-05-m2a1-carry-over]], add a [[Changelog]] entry, update [[Start here]] §6 and Home.

## 6. How the user starts and follows a task
- **Browser or phone:** claude.ai/code → repo `Space_visualizer`, environment `space-visualizer`, then a prompt such as:
  > Do task Q3 from Space_visualizer/Plans/2026-10-16-cloud-task-queue.md. Read Space_visualizer/Cloud sessions.md first and follow it.
- **From the PC's terminal:** push first, then `claude --cloud "Do task Q3 from …"`. Follow-up: `claude -p "<message>" --cloud <session-id>`. Pull a finished session and its branch to the PC: `claude --teleport`.
- **See the vault update in Obsidian:** `git fetch` then `git switch <branch>` on the PC (or `claude --teleport`).
- **How many at once:** start with 2. Only run tasks in parallel when the queue marks them as not sharing files.

## 7. Environment (set up once)
The environment `space-visualizer` on claude.ai holds what the repo cannot: Node 24, Chromium for Playwright, the network allowlist and longer command timeouts. The steps and the exact setup script are in [[2026-10-16-cloud-sessions-setup]] Task 1. Summary:
- **Network: Custom**, default package list included, plus `*.nasa.gov`, `*.usgs.gov`, `asc-planetarynames-data.s3.us-west-2.amazonaws.com`, `archive.stsci.edu`, `hpiers.obspm.fr`, `doi.org` and Playwright's hosts `cdn.playwright.dev`, `playwright.download.prss.microsoft.com`, `playwright.azureedge.net`.
- **Variables:** `BASH_DEFAULT_TIMEOUT_MS=600000`, `BASH_MAX_TIMEOUT_MS=1200000`, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`.
- **Setup script:** installs Node 24 into `/opt/node24` and Chromium for `@playwright/test` 1.63.0. It is cached for about 7 days.

## 8. Troubleshooting
| Symptom | Meaning and fix |
|---|---|
| `403` or `host_not_allowed` from `npm run data` or a fetch | The host is not on the environment's allowlist. It is not a NASA outage. Report the host; the user adds it in the environment settings. |
| `EBADENGINE`, or jsdom tests failing oddly | Node 22 is in use. `export PATH=/opt/node24/bin:$PATH`. |
| `npx playwright test` says the browser is missing | `PLAYWRIGHT_BROWSERS_PATH` is not set or the setup script failed. Run `npx playwright install --with-deps chromium`. |
| A command stops after 2 minutes | It moved to the background. Wait for it; the environment variables raise the limit to 10 minutes. |
| The Playwright runner prints its summary but does not exit | A known quirk ([[Start here]] §5). Stop that one process. |
| The session was "reclaimed" | Reopen it. Check `git status` and `git log origin/<branch>`; redo anything not pushed. |
