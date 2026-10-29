---
title: Cloud sessions setup and parallel work — Plan
date: 2026-10-16
status: awaiting review
milestone: process
tags: [plan, process, cloud]
---

# Cloud sessions setup and parallel work — Plan

Back to [[Home]] · [[Start here]] (§5b Cloud sessions) · Session: [[2026-10-16-session-cloud-plan]] · Backlog: [[2026-10-05-m2a1-carry-over]]

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended here) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 1 and 7 are done by the user in a browser; Claude walks them through it.

**Goal:** Make Claude Code cloud sessions a working second lane for this project, so several well-defined tasks run in parallel in the cloud while the user and a local session handle design, visuals and performance.

**Architecture:**
- **One cloud environment** (`space-visualizer`) on claude.ai: Custom network access (the default list plus the official science hosts and Playwright's download hosts), and a setup script that installs Node 24 and Chromium. The setup is cached for about 7 days.
- **Repo-committed context:** a root `CLAUDE.md` that points every session (local and cloud) to [[Start here]], and a `SessionStart` hook that, in the cloud only, puts Node 24 on the PATH and runs `npm ci` when the lockfile changed.
- **A safety net:** a GitHub Actions workflow runs typecheck and unit tests on every push and PR, so parallel cloud branches are checked without anyone watching.
- **The vault as the cloud's memory:** [[Cloud sessions]] tells a cloud session how to work here; [[2026-10-16-cloud-task-queue]] lists the jobs to give it.

**Tech Stack:** Claude Code cloud sessions (claude.ai/code, `claude --cloud`, `claude --teleport`), cloud environments, `SessionStart` hooks, GitHub Actions, the Claude GitHub App. Optional: Projects (beta) and routines.

**Spec:** none. This is a process plan. Its sources are [[Start here]] §3–§5b, the session log [[2026-10-04-session-m1-to-m2a3]] and the Claude Code docs read on 2026-10-16: `code.claude.com/docs/en/claude-code-on-the-web`, `/cloud-environments`, `/claude-projects` and `/routines`.

## Facts this plan is built on (checked 2026-10-16)

| Fact | Consequence for this project |
|---|---|
| Cloud VMs run Ubuntu 24.04, x86_64, 4 vCPU, 16 GB RAM, 30 GB disk, as root. | Texture builds (5 GB cache, 8 GB heap) stay local. Everything else fits. |
| Node **20, 21 and 22** are pre-installed (`/opt/node22` on PATH). | `package.json` needs Node ≥ 24 (jsdom asks for ≥ 24.15). The setup script must install Node 24. |
| Default network level **Trusted** allows npm, GitHub, `nodejs.org`, `*.ubuntu.com`, but no NASA, USGS, STScI or Playwright hosts. | `npm run data` and `npx playwright install` fail with `403 host_not_allowed` until the environment uses **Custom** with our list. |
| The setup script is cached only if it finishes in about **5 minutes**. Cache expires after about 7 days or when the script or hosts change. | Keep the script to Node 24 + Chromium. `npm ci` goes in the hook (it depends on the cloned lockfile). |
| The repo's `CLAUDE.md`, `.claude/settings.json` hooks and `.claude/skills/` load in the cloud. User-level files (`~/.claude/…`, local memory, user plugins) do **not**. Repo-declared plugins are **not** installed. | Claude's local memory and the superpowers plugin are absent in the cloud. `CLAUDE.md` + the vault carry the context; the process in [[Start here]] §4 carries the method. |
| The VM is reclaimed after inactivity. Conversation history is restored; background work and uncommitted files are not. | The git-ignored SDD ledger (`.superpowers/sdd/`) would be lost. In the cloud, rulings go straight into the plan note's Execution record and are committed after every task. |
| Cloud sessions share the plan's usage limits with all other Claude use. There is no separate VM charge. | Parallel threads spend the limit faster. Start with 2–3 at a time. |
| Projects (beta, Pro/Max) and Auto-fix need the **Claude GitHub App** on the repo. From native Windows, `claude --cloud` without the App uploads a bundle **including uncommitted changes**. | Install the App (Task 1). Always push before starting a cloud task. |
| Commands time out at 2 min by default (10 min max), then move to the background for up to 30 min. | A full Playwright run (8–10 min locally) fits, but set `BASH_DEFAULT_TIMEOUT_MS=600000` on the environment. |

## Global Constraints

- **All working agreements in [[Start here]] §3 still hold:** one branch and one PR per section; commit and push only when asked or as the agreed end-of-section step; every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`; plain, short sentences in user-facing text; do not delete `Welcome.md`.
- **Accuracy rules are unchanged:** every value cited to an official source; no Wikipedia or aggregators.
- **No secrets** in `CLAUDE.md`, hooks, the environment's variables or the setup script. None are needed.
- **The hook must be a no-op locally.** It exits at once unless `CLAUDE_CODE_REMOTE` is `true`. Local sessions on Windows must start without hook errors.
- **Never stop processes by name** (`taskkill /IM node.exe`, `pkill node`). Stop only the process you started. (A fixer did this during M2b.1.)
- **No new runtime dependencies.** The CI workflow and hook add none.

## Review Focus

1. **A cloud session silently runs on Node 22.** `npm ci` prints `EBADENGINE`, and jsdom tests may fail in confusing ways. Pinned by Task 3 Step 4 and Task 7 Step 3: `node --version` must print `v24.`, and the hook prints a loud warning otherwise.
2. **A blocked host looks like a source outage.** `npm run data` failing with `403` / `host_not_allowed` must be read as a missing allowlist entry, not as NASA being down. Pinned by Task 7 Step 5, which runs `npm run data` in the first cloud session and records any blocked host.
3. **Parallel threads collide in the vault.** Several threads editing `Changelog.md`, `Home.md`, [[Start here]] or the carry-over note produce merge conflicts on every PR. Pinned by the vault ownership rule in [[Cloud sessions]] §4: cloud threads touch only their own plan or research note and their own session note.
4. **Rulings lost when a VM is reclaimed.** Pinned by the same rules: in the cloud, the Execution record is updated and committed after each task, never only in a git-ignored file.
5. **A cloud branch starts from the wrong base.** With five stacked, unmerged PRs, a thread that branches from `main` gets M0 code. Pinned by Decision D1 and by the "Current base branch" line in [[2026-10-16-cloud-task-queue]], which every task branches from.

## Decisions for the user (before Task 1)

- **D1 — Merge PRs #1–#5 first (recommended).** All five are open and stacked. Parallel cloud branches on top of an unmerged stack multiply rebases, and routines and Projects start from the default branch (`main`). Merging in order (#1, then #2 …) makes `main` the base for all new work. If you prefer to wait, every cloud task must branch from `m2b1-details` (or the current section branch) and say so.
- **D2 — How many threads at once.** Pro: 1–2 parallel threads. Max: 3–5. Raise it once a few threads come back clean.
- **D3 — Execution method in the cloud.** Recommended: **inline execution with one whole-branch review on Opus** (cheaper; [[Start here]] §5b already says so). Subagent-driven stays the default for big local sections. Optional: copy the superpowers skills you rely on (MIT licence) into `.claude/skills/` so cloud sessions have them; not needed for this plan.
- **D4 — Projects.** If **Projects** shows in the claude.ai/code sidebar, use one project, "Space visualizer", for the [[2026-10-16-cloud-task-queue|task queue]]. If not, use plain cloud sessions; everything else in this plan is the same.

---

## Task 1: Connect GitHub and create the cloud environment (user, in the browser)

**Files:** none (claude.ai and GitHub settings).

- [ ] **Step 1: Install the Claude GitHub App** on `Ihab-harb/Space_visualizer` from https://github.com/apps/claude (only this repository is enough).
  Check: https://github.com/settings/installations lists Claude with `Space_visualizer` under Repository access.
- [ ] **Step 2: Create the environment.** At https://claude.ai/code open the environment selector → add environment. Name: `space-visualizer`.
- [ ] **Step 3: Network access → Custom.** Tick **Also include default list of common package managers**. Allowed domains, one per line:

```text
*.nasa.gov
*.usgs.gov
asc-planetarynames-data.s3.us-west-2.amazonaws.com
archive.stsci.edu
hpiers.obspm.fr
doi.org
cdn.playwright.dev
playwright.download.prss.microsoft.com
playwright.azureedge.net
```

  These are every host found in `pipeline/` and `src/` on 2026-10-16 (science.nasa.gov, nssdc.gsfc.nasa.gov, ssd.jpl.nasa.gov, naif.jpl.nasa.gov, planetarymaps.usgs.gov, planetarynames.wr.usgs.gov, svs.gsfc.nasa.gov and others are covered by the two wildcards), plus Playwright's browser download hosts. If `*.nasa.gov` does not also match the bare `nasa.gov`, add `nasa.gov` too.
- [ ] **Step 4: Environment variables** (`.env` format):

```text
BASH_DEFAULT_TIMEOUT_MS=600000
BASH_MAX_TIMEOUT_MS=1200000
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
```

- [ ] **Step 5: Setup script** (paste as is):

```bash
#!/bin/bash
# Space_visualizer cloud environment: Node 24 and Chromium for Playwright.
# Must finish in about 5 minutes to be cached. Must exit 0.
set -u
base=https://nodejs.org/dist/latest-v24.x
file=$(curl -fsSL "$base/SHASUMS256.txt" | grep -o 'node-v24[0-9.]*-linux-x64\.tar\.xz' | head -1)
if [ -n "$file" ]; then
  mkdir -p /opt/node24
  curl -fsSL "$base/$file" | tar -xJ -C /opt/node24 --strip-components=1
fi
# Chromium for the e2e tests, matching @playwright/test in package-lock.json (1.63.0 on 2026-10-16).
PATH=/opt/node24/bin:$PATH PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  npx -y playwright@1.63.0 install --with-deps chromium || true
exit 0
```

  When `@playwright/test` is upgraded, update the version here too (the browser build is tied to it).
- [ ] **Step 6: Make it the default** for this repo's sessions (select it in the environment selector before starting the first session).
  Check: starting a session shows `space-visualizer` under the prompt box.

## Task 2: Root `CLAUDE.md` (the bridge for cloud sessions)

**Files:**
- Create: `CLAUDE.md`

Local sessions read this file too, so it holds only what every session needs and points to the vault for the rest. Keep it under 40 lines.

- [x] **Step 1: Write `CLAUDE.md`** (exists in the working tree since 2026-10-29, on branch `cloud-setup`, not yet committed) with these sections, in this order:
  1. *Read first:* `Space_visualizer/Start here.md`, then the newest note in `Space_visualizer/Sessions/`, then the plan the task names. In a cloud session, read `Space_visualizer/Cloud sessions.md` before anything else.
  2. *Hard rules* (one line each): cited official sources only; the vault is the documentation and is updated in the same piece of work; the commit trailer and PR footer from [[Start here]] §3; commit or push only when asked or as the agreed end-of-section step; never kill processes by name; never run two Playwright runs at once in one machine.
  3. *Commands:* `npm test`, `npm run typecheck`, `npx playwright test <file>`, `npm run data`, `npm run data:offline`.
  4. *In a cloud session* (`CLAUDE_CODE_REMOTE=true`): no GPU, no `pipeline/raw/` cache, no texture work; follow `Space_visualizer/Cloud sessions.md` §3–§5; push after every finished step.
- [ ] **Step 2: Check it locally.** Start a new local Claude Code session in the repo and run `/context`.
  Expected: `CLAUDE.md` is listed under Memory files.
- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md pointing sessions to the vault's Start here"
```

## Task 3: Cloud-only `SessionStart` hook

**Files:**
- Create: `.claude/settings.json`
- Create: `scripts/cloud-session-start.sh`

**Interfaces:**
- Produces: in a cloud session, `node` resolves to `/opt/node24/bin/node` for every Bash command (exported through `$CLAUDE_ENV_FILE`), and `node_modules/` matches `package-lock.json`.

- [x] **Step 1: `.claude/settings.json`** (exists since 2026-10-29, not yet committed) with one `SessionStart` hook, matcher `startup|resume`, command `bash "$CLAUDE_PROJECT_DIR/scripts/cloud-session-start.sh"`, `timeout` 600. No other settings.
- [x] **Step 2: `scripts/cloud-session-start.sh`** (exists since 2026-10-29, not yet committed; LF endings already covered by `.gitattributes` `* text=auto eol=lf`) (LF line endings; add `*.sh text eol=lf` to `.gitattributes` if it is not already covered). Behaviour, in order:
  1. `exit 0` unless `CLAUDE_CODE_REMOTE` is `true`.
  2. If `/opt/node24/bin/node` exists: append `export PATH=/opt/node24/bin:$PATH` to `$CLAUDE_ENV_FILE` and use that PATH for the rest of the script. Otherwise print `WARNING: Node 24 missing; the environment setup script did not run. Tests need Node >= 24.` to stderr.
  3. Hash-guarded install, as in the Claude Code docs example: if `sha256sum --check --status node_modules/.cloud-install.sha256` fails, delete the hash file, run `npm ci`, and on success write the hashes of `package.json`, `package-lock.json` and this script.
  4. Print one status line: `cloud session ready: node <version>, deps <installed|cached>`.
  5. Always `exit 0` (a failed install is reported, not fatal, so the session still opens).
- [ ] **Step 3: Check locally (Windows).** Start a new local session.
  Expected: no hook error; nothing installed (the script exits at step 1). Also run `bash scripts/cloud-session-start.sh; echo $?` in Git Bash → prints nothing, then `0`.
- [ ] **Step 4: Check the cloud path by simulation** in Git Bash: `CLAUDE_CODE_REMOTE=true CLAUDE_ENV_FILE=$(mktemp) bash scripts/cloud-session-start.sh`.
  Expected: the Node 24 warning (there is no `/opt/node24` on Windows) and exit code 0. Do **not** let it run `npm ci` on the dev machine: run it from a scratch copy of the repo, or stop at the warning by temporarily pointing `CLAUDE_PROJECT_DIR` at an empty folder. The real check is Task 7.
- [ ] **Step 5: Commit**

```bash
git add .claude/settings.json scripts/cloud-session-start.sh .gitattributes
git commit -m "chore: cloud-only SessionStart hook for Node 24 and npm ci"
```

## Task 4: GitHub Actions CI (typecheck and unit tests)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow.** Name `CI`. Triggers: `push` (all branches) and `pull_request`. One job on `ubuntu-latest`: `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: 24` and `cache: npm`, then `npm ci`, `npm run typecheck`, `npm test`. No e2e job for now (8–10 min under SwiftShader; add later if wanted). No secrets.
- [ ] **Step 2: Confirm the unit tests need no network.** Run `npm test` locally with Wi-Fi off, or check that no test calls a real URL (`grep -rn "https://" src pipeline --include=*.test.ts*` shows only strings used as data, not fetched).
  Expected: all 690 tests pass offline.
- [ ] **Step 3: Commit, then push when the user agrees** (pushing is outward-facing).
  Expected after push: the Actions tab shows CI green on the branch.

```bash
git add .github/workflows/ci.yml
git commit -m "ci: typecheck and unit tests on push and pull request"
```

## Task 5: Vault notes for cloud sessions (done locally, 2026-10-16)

**Files:** `Space_visualizer/Cloud sessions.md` (the guide a cloud session reads first), `Space_visualizer/Plans/2026-10-16-cloud-task-queue.md` (the jobs), [[Start here]] §5b and §6, `Home.md`, `Sessions/2026-10-16-session-cloud-plan.md`.

- [x] **Step 1:** Write [[Cloud sessions]] and [[2026-10-16-cloud-task-queue]]; point [[Start here]] §5b and Home to them.
- [ ] **Step 2: Commit** (when the user agrees)

```bash
git add "Space_visualizer/Cloud sessions.md" Space_visualizer/Plans/ "Space_visualizer/Start here.md" Space_visualizer/Home.md Space_visualizer/Sessions/
git commit -m "docs(vault): cloud sessions guide, task queue and setup plan"
```

## Task 6: Push the vault notes

- [ ] **Step 1:** With the user's go-ahead, push the branch that holds Task 5 (the current base branch in the queue, `m2b1-details`, unless D1 merged everything into `main`), using the HTTPS command in [[Start here]] §3.
  Check: `git ls-remote origin <branch>` shows the new commit. Cloud sessions clone from GitHub, so the guide and the queue do not reach them before this.

## Task 7: First cloud session = queue task Q1

Tasks 2, 3 and 4 are done by the first cloud session, together with the checks below, as task **Q1** in [[2026-10-16-cloud-task-queue]]. The user starts it at claude.ai/code (repo `Space_visualizer`, environment `space-visualizer`) with:
> Do task Q1 from Space_visualizer/Plans/2026-10-16-cloud-task-queue.md. Read Space_visualizer/Cloud sessions.md first and follow it.

Checks the session runs and records in this plan's Execution record:
- [ ] **Step 1:** The setup checklist shows the setup script finishing.
- [ ] **Step 2:** After Task 3's hook exists, a new session's hook line says `cloud session ready` (check this in the second cloud session).
- [ ] **Step 3:** `node --version` prints `v24.`
- [ ] **Step 4:** `npm run typecheck` is clean and `npm test` passes (690 tests on 2026-10-16). Record the wall time.
- [ ] **Step 5:** `npm run data` succeeds. It downloads about 25–40 MB. Then `git diff --stat public/data` shows only `retrievedAt` changes (a known carry-over item). Revert them with `git checkout -- public/data`. Record any `host_not_allowed` host so the user can add it in Task 1 Step 3.
- [ ] **Step 6:** `npx playwright test e2e/details.spec.ts` passes. Record the wall time. A full `npx playwright test` is optional; if run, record its time (local reference: 8.2 min).
- [ ] **Step 7:** Local follow-ups for the user on the PC: Task 2 Step 2 and Task 3 Steps 3–4 (the Windows checks: no hook error in a local session).

## After setup

The setup ends here. How cloud sessions work in this project (what to send, rules, hand-back, troubleshooting) is in [[Cloud sessions]]. The jobs to give them, in parallel waves, are in [[2026-10-16-cloud-task-queue]]. Q1 in that queue runs Tasks 2–4 and 7 of this plan inside the first cloud session, so the user only has to do Task 1 in the browser and approve the push in Task 6.

Optional, once the basics work:
- **Auto-fix on PRs:** in a cloud session, open the CI status bar and turn on **Auto-fix**, so Claude fixes red CI and answers review comments on its PR.
- **`/code-review ultra`:** a deep multi-agent review in the cloud for a finished section branch, as an alternative to the local Opus whole-branch review. The user starts it; it is billed.
- **A weekly "source drift" routine** (`/schedule` or claude.ai/code/routines, environment `space-visualizer`): runs `npm run data` and `npm run textures:verify`; if a quote check fails or data changes beyond `retrievedAt`, it writes a short report and opens a PR. This guards the accuracy goal as NASA pages change.
- **Projects (D4):** one project "Space visualizer" whose instructions are [[Cloud sessions]] §4; Claude then starts and tracks the threads.

## Execution record

(Filled in during execution: rulings, the pilot's timings and any blocked hosts.)

**2026-10-29 (recorded during a vault check):**
- **Files created locally:** `CLAUDE.md`, `.claude/settings.json` and `scripts/cloud-session-start.sh` were created in the working tree on a new local branch, `cloud-setup`, which is at the same commit as `m2b1-details` (`d30d9ec`). No session note records who made them. **Nothing is committed or pushed yet**, so cloud sessions, which clone from GitHub, can't see them or the vault's cloud notes.
- **Deviation from Task 3 Step 2.2:** if `/opt/node24` is missing, the hook downloads Node 24 from nodejs.org itself, checking its SHA-256, instead of only printing a warning. It also exits at once on non-Linux machines. It still always exits 0.
- **CLAUDE.md wording:** it has no separate "In a cloud session" section. It points cloud sessions to [[Cloud sessions]] and the queue under *Read first*, and puts the no-GPU / no-cache rule under *Commands*. It is 26 lines, under the 40-line limit.
- **Not done yet:** Task 2 Step 2 (`/context` check), Task 3 Steps 3–4 (local checks), Task 4 (CI workflow, no `.github/` yet), and Tasks 1, 5 Step 2, 6 and 7. User decisions D1–D4 are still open.

