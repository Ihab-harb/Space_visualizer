---
title: "Session log: 2026-11-15 (M2b.4 design talk)"
date: 2026-11-15
tags: [session, history, m2b]
---

# Session log: 2026-11-15 (M2b.4 design talk)

Back to [[Home]] · Previous: [[2026-10-30-session-m2b3-explore]]

## Requests
- "use the projects corresponding obsidian vault to layout the next step in our development" → a summary of M2b.4 (feature pins, magnetic field lines, aurora) from the vault, the data that already exists, and the open design questions. No code.
- Asked: one section or two? The user: **"2 sections"**.

## Decisions
- **M2b.4 is split in two** (the user, 2026-11-15):
  - **M2b.4a, feature pins** first. The data is ready (200 Gazetteer features each for Mercury, Venus, the Moon and Mars).
  - **M2b.4b, magnetic field lines and aurora** second. It needs new shaders and new source research (there is no aurora data yet).
  - Each has its own spec, plan, branch from `main` and PR.

- **Pins shape: option C, "landmarks first, atlas behind"** (the user, 2026-11-15: "option c", after asking "what are the options for such a feature"). About 15 to 25 hand-picked landmark pins per body show by default; an "All features" list with search holds the full 200, and picking one drops a pin and turns the globe to it. The options not taken: A (landmarks only) and B (full atlas with filters only). Landing-site pins are left for later (my proposal, not yet confirmed by the user).

- **Earth: curated landmarks only** (the user, 2026-11-15: "go with 2 for now, we might later add a full list for earth"). About 15 to 25 Earth landmarks with quoted official sentences (NASA Earth Observatory, USGS); no "All features" list for Earth in this section. A full Earth list may come later, so the design must not rule it out.
- **How landmarks are picked** (my proposal, put to the user with the Earth question; not objected to): a feature is a landmark only if an official page has a quotable sentence about it; the sentence goes on the card and the build checks it, as for missions. Landmarks below the size cut are pulled from the Gazetteer by name.

- **Mockups in the browser companion** (the user: "go ahead"). Files in `.superpowers/brainstorm/94-1794699801/content/` (git-ignored; copy the chosen ones to `Assets/m2b4a/` with the spec).
- **Where pins live: option A, two tabs** (the user, 2026-11-15: "go with A"). Explore gets a top switch **Surface | Interior**. Surface shows the whole globe with pins. Interior holds Exploded and Half-section behind a second, smaller switch. Fields gets its own tab in M2b.4b. Not taken: B (rename Whole to Surface in the one switch) and C (a Features toggle layer on the Whole view).

- **Pin style: option A, names beside the globe with leader lines** (the user, 2026-11-15: "A"). Each landmark on the facing side has its name off the globe and a thin line to its dot, in the style of the interior labels; names fade out and in as the globe turns. Not taken: B (dots only, names on hover or tap) and C (names written on the surface).

- **My calls** were put to the user as a list of ten, with the build approach (reuse Explore's DOM label system and the quote-checking pipeline). The user: **"go ahead"**. They are in the spec §11 for checking.
- **Spec written:** [[2026-11-15-m2b4a-feature-pins-design]] (draft, for the user's approval). Mockup images: `Assets/m2b4a/mockup-1-explore-tabs.png`, `mockup-2-pin-styles.png`.

- **Spec review (a fresh reviewer read the draft as a builder).** It found, and the spec now carries:
  - **A data fault:** Mercury's feature list has 200 rows but 193 distinct names (seven names twice). Fixed first in this section (spec §6.1, my call).
  - The radar tag lives in the header, which Explore hides: it needs a home in the overlay (§4.2).
  - Not every Gazetteer type is Latin ("Crater", "Satellite Feature") (§5.3).
  - No elevation data is committed, and only Venus and the Mars elevation data have an orientation check today: the placement guards must work on the committed colour maps and run in `npm test` (§6.4, my call).
  - Earth keeps its clouds on Surface (§4.2, my call).
  - A rule for reading a stated position (§6.2, my call).
- **Earth landmark positions: an official names database is allowed** (the user, 2026-11-15: "B"). USGS GNIS for the United States and the NGA GEOnet Names Server for the rest of the world may give the position; the descriptive sentence still comes from NASA, USGS or ESA. The NGA is a new publisher: the source rule is amended for this one use, to be recorded as decision note 0010 with the plan. Not taken: A (only a quoted NASA, USGS or ESA sentence stating the coordinates). Still to confirm in the build: that the databases can be fetched and hold the wanted landmarks.
- **Spec approved** (the user, 2026-11-15: "the spec is apporved go ahead"). Next is the plan.

- **Plan written:** [[2026-11-15-m2b4a-feature-pins]]. Found while planning: the Mercury duplicates are in the Gazetteer's own file (614 approved rows, 606 distinct names; each row has a `link` to its feature page), and Mars has one duplicated name outside the top 200. The mesh maps longitude 0 to the map's centre column for every body (`uvForLonLat`), so the placement guards test each committed map against that.

## Open for M2b.4b (not this section)
- Field lines: a dipole drawn from the cited tilt and offset is a model, so it needs an "illustrative" label or a cited source for the real shape.
- Aurora: no data yet.
- Fields gets its own Explore tab (decided with the tabs above).

## State
- Branch `m2b4a-pins`, created in place from `main` (2026-11-15). Nothing is committed on it yet: the session note, the spec, the mockup images and the `Start here.md` pointer are uncommitted.
- No code is built. The spec is approved. The plan is written: [[2026-11-15-m2b4a-feature-pins]] (eleven tasks), waiting for the user's review. Next: the subagent-driven build (the user's standing choice).
- The mockup server was stopped after the design talk.
