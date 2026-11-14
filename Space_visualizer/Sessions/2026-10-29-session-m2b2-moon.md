---
title: "Session log: 2026-10-29 (M2b.2 the Moon)"
date: 2026-10-29
tags: [session, history, m2b]
---

# Session log: 2026-10-29 (M2b.2 the Moon)

Back to [[Home]] · Previous: [[2026-10-29-session-vault-check]]

## Requests
- "using the related obsidian vault, continue the work for this app"
- Offered the usual design questions for M2b.2. The user: "use the vaults existing plan. also at precisely 4:11 am i want you to execute a command that instructs you to continue your work".

## What was done
- Read [[Start here]], the two newest session notes, the M2 spec, the M2b.1 spec, the architecture notes and the code the Moon plugs into (catalog schema, ephemeris, build, frame state, eclipse occluders, orbit line).
- Checked the official Moon sources (CGI Moon Kit, JPL satellite mean elements, NSSDCA Moon and Planetary fact sheets, PCK00011). Findings are in the spec §9.
- Scheduled a one-time prompt in this Claude session for 2026-10-30 04:11 local time: "continue your work on M2b.2". It fires only while this session is open and idle.
- Created branch `m2b2-moon` from `m2b1-details` (`d30d9ec`). The uncommitted cloud-setup files stay in the working tree and are not staged in this section's commits.
- Wrote the spec [[2026-10-29-m2b2-moon-design]] from the vault's existing plan. Choices not in the vault are marked "my call" and listed in its §10.
- Wrote the plan [[2026-10-29-m2b2-moon]] and ran it with subagents (one implementer and one reviewer per task, one fix wave where a review found issues). Tasks 1 to 10 are committed on `m2b2-moon` (`d30d9ec..1e45e43`); Task 11 is this documentation commit.
- **Built:**
  - Chebyshev evaluator, satellite mean elements, `systemState` with the Earth-Moon barycentre split, and Moon phase ([[core]]).
  - `npm run moon:ephemeris` and the Moon table: 16-day segments, degree 12, 1.88 MB, max 0.904 km (0.4792 arcsec) over 366,720 held-out samples ([[pipeline]], [[0008-moon-chebyshev-table]]).
  - The Moon in the data build (facts, rotation, satellite orbit), Earth off the barycentre with a centre check (2,190 km, 11.8 arcsec).
  - App loads the table; orbit line, readable-scale hiding, label and Tour stop ([[scene]]); header with a Phase chip, km distances and the Moon narrative ([[ui]]).
  - Moon details: exosphere, interior, field, 12 missions and named features.
  - CGI Moon Kit colour and relief (17.5 MB committed); Moon shading, earthshine, copper eclipse tint and an eclipse-aware atmosphere shell; six golden views in `Assets/m2b2/`.
- **Docs (Task 11):** architecture notes, four new Data Sources notes, the ADR, the carry-over "From M2b.2" section, the plan's Execution record (rulings, deferred minors, measured numbers, tuned values), Changelog, Home, Start here, README and `docs/SETUP.md`.
- To keep the user's cloud-setup edits uncommitted, the three shared notes (`Changelog.md`, `Home.md`, `Start here.md`) were stashed, edited and committed on their HEAD versions, then the stash was popped. The ruling is recorded in the plan's Execution record.

## Decisions made on the user's behalf
See the spec §10 (nine calls) and the rulings in the plan's Execution record. The biggest: the Moon's 1800–2050 position comes from JPL Horizons vectors compressed to Chebyshev polynomials (≤ 1 km error), and Earth is moved off the barycentre. Rulings made while building: the 1 km target outranks the 2 MB file size (then met after rounding), no blending at the table edge, Earth's centre check uses the JPL Table 1 bound, the Moon has no Discovery entry, moon hiding applies only when readable-scale inflation causes the overlap (changed by the final review), and the eclipse tint is Earth's copper for any shadowing atmosphere.

## State
- M2b.2 is complete on branch `m2b2-moon` (stacked on `m2b1-details`). 807 unit tests and typecheck clean after the review fixes; end-to-end results are in the plan's Execution record.
- The whole-branch review, its fix wave and the scoped re-review are done (see the plan's "Whole-branch review"). The branch is **not pushed** and **no PR** is open.
- Next section: M2b.3 (cutaway and charts), per the M2b.1 spec's split.

## Open for the user
1. **The Moon's position outside 1800 to 2050.** There it uses JPL mean elements, which are off by up to about 175 degrees (784,535 km) at the far reference dates. The final review made the status bar read "out of range" for the Moon outside the table, and the Phase chip and distances there cite the mean elements. You may still choose to extend the Horizons table (more years, bigger download), or keep it as it is. See [[0008-moon-chebyshev-table]].
2. **Review the spec §10 calls** and the plan's rulings ([[2026-10-29-m2b2-moon]], Execution record).
3. **The Moon has no Discovery section.** No official "known since antiquity" sentence was found; the app shows nothing rather than an uncited line.
4. **A bright atmosphere and bloom haze** shows on Earth's full day side at close range (golden 6d). It was there before this section. A shell and bloom tuning pass is suggested.
5. **The cloud-setup files remain uncommitted** (see [[2026-10-29-session-vault-check]]).
6. **The branch is not pushed and no PR is open.** Say when to push and open the stacked PR (base `m2b1-details`).
