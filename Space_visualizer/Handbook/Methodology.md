---
title: Methodology
tags: [handbook, process]
date: 2026-11-19
---

# Methodology

Back to [[Handbook]] · Rules: [[Rules]] · Process in brief: [[Start here]] §4

How the work is done: how a section goes from an idea to merged code, how values are found and proven, how visuals are judged, and how results are verified and recorded.

## 1. From idea to merged code

### 1.1 Design talk
- Each section starts with a conversation with the user, **one question at a time**. Where a choice is visual, the builder makes two or three **mockups** and the user picks one (the pins' style, the Explore layout, the composition chart).
- Each option is shown with its trade-offs. The builder recommends one; the user decides.
- The builder lists the smaller choices it would make as **"My calls"** for the user to check, instead of asking about each.

**Why:** the user owns what is built; the builder owns how. Asking one thing at a time keeps each answer clear, and mockups settle visual questions faster than words.

### 1.2 Spec
- The design is written as a spec in `Specs/`: intent, the user's decisions (and whose each is), approaches considered, the design, data, testing, out of scope, what is left to the builder, and the builder's calls.
- The user approves the spec. Changes made while building go into its **"Amended while building"** section with the reason.

### 1.3 Plan
- A plan in `Plans/` breaks the spec into tasks. Each task names its files and interfaces, the tests that must fail first, the commands to run with their expected output, and the commit.
- The header holds the goal, the architecture, the **global constraints** every task must keep, and a **Review Focus**: the edge cases most likely to break, each pinned to a test.
- Deviations from the spec decided while planning are listed as **scope rulings** that executors must not undo.

**Why:** a plan an implementer can follow without guessing is what makes per-task review possible.

### 1.4 Subagent-driven build
For each task:
1. A **fresh implementer** gets a brief (the task, the rules, the stop conditions) and works test-first.
2. A **fresh reviewer** checks spec compliance first, then code quality, and does not trust the implementer's report.
3. **Fix rounds** follow until the review is clean (at most 5).

Then:
4. A **whole-branch review** on the most capable model looks across tasks.
5. **One fix wave** addresses its findings, and **one scoped re-review** confirms them.

Progress, rulings and deferred minor findings are kept in a git-ignored ledger (`.superpowers/sdd/<plan>/`) and **copied into the plan's Execution record before the ledger is deleted**.

**Why:** an author cannot review their own work well. Fresh reviewers per task catch local mistakes early; the final review catches what crosses tasks. Writing rulings with their cost lets the user undo any of them cheaply.

### 1.5 Finish
- The docs and the vault are updated in the same piece of work.
- The user decides when to push and open the PR. Completed sections are merged into `main` with merge commits.
- Open questions go to the user as a numbered list, and work carries on with what does not depend on the answers.

## 2. Finding and proving values

### 2.1 Choosing a source
1. Look for the publisher of record (JPL for positions, NSSDCA for physical facts, the IAU Gazetteer through USGS for feature names, NASA, USGS or ESA pages for descriptive sentences).
2. Prefer machine-readable products (APIs, kernels, fact-sheet tables) over prose.
3. When no official source gives a value, record nothing, unless a decision note allows a narrow exception (papers for interiors, names databases for Earth positions).
4. Write down every source tried and why it was used or not, in a **research log** (kept in the plan's Execution record and the Data Sources note).

### 2.2 Proving a parsed value
- The pipeline fetches the source into the cache, parses it with a tested parser, and attaches the source id.
- Tests use **real recorded responses** as fixtures, with expected numbers read from them.
- Zod checks the shape, units and plausible ranges; the build fails naming the field.

### 2.3 Proving a curated value (the quote method)
For values that are not in a table (interior layers, missions, landmarks):
1. Find the sentence on an official page that states the value.
2. **Copy it exactly, by script**, from the fetched page text. Never retype it.
3. Store the value with the sentence and the page's source id.
4. The build checks that the sentence is still on the page (normalising only quotes, dashes, spaces and case), that it is at least 6 words, and that the stored number or date appears in it in the stored unit.

**Why:** a hand-curated value can be mistyped or outlive its page. The sentence makes it checkable forever, and the check catches a page that changed (as NSSDCA's chronology page did in November 2026).

### 2.4 Measuring accuracy
- Each orbit model is measured against committed JPL Horizons reference vectors. The drawer shows the published error and the measured one.
- The Moon's table is measured on held-out samples (366,720 of them) it was not fitted on.

**Why:** a published accuracy can be optimistic. A measured one is what the user is actually shown.

### 2.5 Earth positions
- Find the place's record in an allowed names database by searching by name, then **check the class and the place** (many places share a name).
- Store the record id; the build fetches the record and takes its name, point (with its own digits) and class.
- Never use a picture's centre coordinates, a map reading, or memory.

## 3. Judging visuals
- **Golden views:** fixed scenes (date, camera, quality) rendered by Playwright, saved as screenshots, and reviewed against a written look checklist (twilight band, ring shadows, Sun halo, readable overview, phone layout).
- **Screenshot-and-refine loop:** render, look at the image, fix, repeat. Tuned constants are recorded with their old value, new value and the reason.
- **Measured looks:** where a look can be measured, it is (patch luminance, hue, contrast), so a later change that breaks it shows as a number.
- **Placement guards:** tests that a map is not mirrored or shifted, using physical facts about known places (a mare is dark, Hudson Bay is water), never values read off the same map.
- **Illustrative is labelled:** any visual that is not data is labelled on screen.

**Why:** visuals are one of three equal goals, and a shader that compiles can still look wrong. Numbers and checklists make "looks right" reviewable.

## 4. Verification before any claim
- Unit tests (`npm test`), the typecheck, the offline data build, and the relevant end-to-end tests are run before work is called done, and their numbers are reported.
- A flaky end-to-end test is rerun alone; its cause is named.
- A screenshot is looked at, not just taken.
- Reports state what failed, what was skipped and why, plainly.

## 5. Recording
- **Where each thing goes:** user decisions and requests in the session note (in the user's words); design in the spec; rulings, research logs, tuned values and test numbers in the plan's Execution record; lasting choices in a decision note; deferred items in the carry-over note; source details in Data Sources notes; history in the Changelog.
- **When:** in the same piece of work as the change, and before stopping.

**Why:** the next session (or person) starts from the record. Anything not written down is lost when the chat ends.
