---
title: "Session log: 2026-11-15 (M2b.4 design talk and the M2b.4a build)"
date: 2026-11-15
tags: [session, history, m2b]
---

# Session log: 2026-11-15 (M2b.4 design talk and the M2b.4a build)

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

## The build (2026-11-15)
- **Subagent-driven, all eleven tasks built and review-clean** on branch `m2b4a-pins`: a fresh implementer and a fresh reviewer per task (sonnet; opus for Tasks 4, 5, 9 and 11). Tasks 4, 8, 9 and 10 needed one fix round each. The usage limit stopped the work three times (in Task 4's re-review, in Task 9 and in Task 11); each time it resumed after the user said "continue".
  1. One Gazetteer row per feature and stable feature ids. Mercury's approved total went from 614 to 606.
  2. `surfacePoint` and the placement guards on the committed maps (rebuilt on physical priors after the first version picked guards by scanning the map).
  3. The landmarks pipeline: quote checks, type meanings, the details schema.
  4. Landmarks for Mercury (16), Venus (16), the Moon (16) and Mars (17), with a research log.
  5. Earth's 21 landmarks, positions from USGS GNIS; decision [[0010-names-databases-for-earth-positions]] and data note [[Earth names databases (GNIS, GNS)]].
  6. Explore state: tabs, feature selection, list, URL and keys.
  7. Camera: Explore opens on the sunlit side; the view turns to a selected feature.
  8. Overlay: Surface and Interior tabs, the interior sub-switch, Surface notes, the Venus radar on Surface.
  9. Pins on the globe with names and leader lines.
  10. The feature card, the All features list and search.
  11. End-to-end tests (`e2e/features.spec.ts`, a Surface layout check at five sizes), six new golden views, the eight M2b.3 goldens re-shot, a fix for hidden interior phone dots, and this documentation.
- **Tests at the end:** 1,197 unit tests, typecheck clean, 144 end-to-end tests. The one full run passed 137 of 144 on a loaded machine (21.8 minutes); six canvas-wait timeouts passed on a re-run, and one new layout assertion was corrected.
- **Decisions made on the user's behalf** (rulings) are in the plan's Execution record, [[2026-11-15-m2b4a-feature-pins]], each with its cost if wrong. The ones the user may notice: Earth positions from GNIS only; NASA image-centre coordinates not accepted as positions; Earth types are GNIS feature classes; names stay on their own side of the globe; the build fails on a duplicate feature id, not a duplicate name. The spec's §12a lists where the build departs from the spec.
- **Golden views:** `Assets/m2b4a/` (Mars Surface, the Moon with Tycho's card, Earth with North America at `jd=2461317.4`, Venus radar, Mars with the list open, phone Mars); `Assets/m2b3/` re-shot.

## Task 12: Earth landmarks from other official sources (2026-11-16)
- **Request** (the user, after hearing the NGA server could not be reached): **"it didn't work use other official sources that have similar data"**.
- **Ruling** (the controller, for the user to check): an official position source is a government agency or an intergovernmental body publishing a names dataset with coordinates, fetchable with no key, login or browser, with terms that allow use with attribution. A national source only for its own country. No GeoNames.org, OpenStreetMap, Wikidata, Wikipedia, Natural Earth or commercial services. Recorded in [[0010-names-databases-for-earth-positions]] (second decision).
- **Done:** four new position sources, in a registry beside GNIS: NOAA NCEI's Volcano Locations Database (worldwide volcanoes), the IHO-IOC GEBCO Gazetteer of Undersea Feature Names (worldwide), Natural Resources Canada's Canadian Geographical Names Database (Canada) and LINZ's New Zealand Gazetteer (New Zealand). **Earth now has 43 landmarks** (21 kept as they were, 22 new), on every continent and in the Atlantic and Pacific: for example Fujisan, Kilimanjaro, Challenger Deep, Etna, Vesuvius, Hudson Bay, Krakatau, Aoraki/Mount Cook. Each sentence is still from NASA, USGS or ESA. Two new placement guards (Hudson Bay, Fujisan). Details: [[Earth names databases (GNIS, GNS)]] and the plan's Execution record ("Task 12").
- **Not covered:** Australia (its national gazetteer states no licence anywhere reachable), and famous wide places with no reachable official point (the Himalaya and Everest, the Sahara, the Amazon, the Nile, the Great Barrier Reef).

## Open for the user
1. **Earth's landmarks now cover every continent, Australia included (Task 13),** but not wide places such as the Himalaya, the Sahara or the Amazon. The user accepted the four Task 12 sources ("use the new sources") and Australia ("keep australia": Geoscience Australia's site licence, CC BY 4.0). Common names are shown with the database's name beside them ("have both versions of the names"). Still open: the GEOnet Names Server is unreachable; it would cover the wide places. The Great Barrier Reef has no Australian record.
2. **Earth type words are the databases' own classes, and some read oddly:** Larsen Ice Shelf "Glacier", Antarctic Peninsula "Cape", Vinson Massif "Range", Grand Canyon "Valley" (GNIS); Aoraki/Mount Cook "Hill" (LINZ); Gosses Bluff "Cliff" (the Australian gazetteer). Friendlier words would have to be shown without a source.
3. **Some quoted sentences state a size that differs from the Gazetteer size on the same card:** Mare Humorum 825 km in the quote against 420 km (the basin against the mare), Artemis Corona 2,100 against 2,600 km, Mead 280 against 270 km. Each is shown with its own source.
4. **Explore opens on the sunlit side, so Earth can open over an ocean (the Pacific at the usual test date),** with the US pins at the top limb.
5. **Check the pins on a real GPU.** They were checked on SwiftShader only.
6. **Mercury's Apollodorus dot sits about 15 km off the crater centre,** likely the Mercury map's alignment; the Moon, Mars and Earth dots are centred by the same code.
7. **Weak landmark sentences (Task 13, "fix the weak scentences").** Replaced from other official pages: Kandinsky, Apollodorus, Mendelssohn, Elysium Planitia, Meteor Crater, Yellowstone Caldera, Aoraki/Mount Cook, Mount Pinatubo, Whakaari / White Island. Dropped, as no official sentence met the bar: Nathair Facula, Fonteyn (Mercury), Sif Mons (Venus). **Still weak, kept for the user to decide** (no better sentence found): Gula Mons and Sapas Mons (mostly coordinates), Mare Imbrium (it also names Orientale), Meridiani Planum (mission-led). Elysium Planitia's new sentence starts "Just north of the divide". Checked and kept: Teide, Nyiragongo, the Mid-Atlantic Ridge, Syrtis Major Planum (quoted as "Syrtis Major").
8. **A feature picked from the far side can land on the night side after the turn** (real lighting; the pins stay bright). Look at one before calling the section done.
9. Closed: the reviews are done, the branch is pushed and PR #9 is open.

## Open for M2b.4b (not this section)
- Field lines: a dipole drawn from the cited tilt and offset is a model, so it needs an "illustrative" label or a cited source for the real shape.
- Aurora: no data yet.
- Fields gets its own Explore tab (decided with the tabs above).

## State
- Before the build: branch `m2b4a-pins`, created in place from `main`; the spec, the plan, the session note and the mockups were committed as the docs commit `2876eae`. The mockup server was stopped after the design talk.
- At the end: all eleven tasks are committed on `m2b4a-pins` (`78ba9a3` to the Task 11 docs commit) and review-clean. **The whole-branch review (verdict: with fixes), its fix wave (`b0673de`, `44e8e43`) and the scoped re-review (all addressed) are done.** Final numbers: 1,211 unit tests in 122 files, typecheck clean; `features`, `explore` and `layout` end-to-end 77 of 77. Not pushed; no PR is open. The execution ledger (`.superpowers/sdd/2026-11-15-m2b4a-feature-pins/`) is kept until the final review; every ruling and deferred finding is already in the plan's Execution record and in [[2026-10-05-m2a1-carry-over]] ("From M2b.4a").
- Task 12 (2026-11-16): two commits on `m2b4a-pins` (`e1b44a6` the code and data, then these notes). 1,231 unit tests in 122 files, typecheck clean; `npm run data` and `data:offline` clean; end-to-end `features` and `golden` 44 of 44. Task 12 was then reviewed (no Critical issue); two fixes made (the country check now fails closed; the Whakaari sentence got its full stop back) and two sentences listed as weak (item 7).
- Next: the user's call on the open items above, and on pushing the branch and opening the PR (base `main`). Then M2b.4b.

- 2026-11-16: asked what to do with the open list, the user said "go ahead". Read as the first item: the branch was pushed and **PR #9** opened against `main` (https://github.com/Ihab-harb/Space_visualizer/pull/9). The other open items are choices and still wait for the user.
- 2026-11-16, the user: "use the new sources", "delete the scratch folder", "explain point 6". The four sources are accepted (decision note 0010). The scratch folder is deleted. The smaller open items were explained and still wait for answers.

## The user's answers on the smaller items (2026-11-16)
The user, in their words:
- "a. clarify the difference for the user" (two sizes on one card)
- "b. we should be able to rotate the planet to get the side we need" (Earth opening over an ocean)
- "c. we will hande the UI clutter at a later point" (closing the list on pick)
- "d. light the area when selected" (night-side pins)
- "e. will be handled later" (Tab reaching the pins)

What was done:
- **a. A line on the card.** When the quoted sentence states a width that is not the card's Size, the card adds: "The size in the sentence and the Size above come from different sources. They may measure different parts or outlines of the feature." The line does not explain each case, because no source does. A scan found ten such cards, not three: Mare Humorum, Mare Imbrium, Clavius, Vallis Schroteri, Copernicus (Moon); Artemis Corona, Mead, Sapas Mons, Cleopatra (Venus); Caloris Planitia (Mercury); Tharsis Montes and Arsia Mons (Mars).
- **b. No change needed.** Dragging already turns the globe in Explore, and the wheel zooms. The opening view stays on the sunlit side. An end-to-end test now proves the drag.
- **d. Feature light.** A selected feature on the night side gets a soft pool of light. It is illustrative. It never brightens the day side. Screenshots: `Assets/m2b4a/9a-feature-light-moon.png`, `9b-feature-light-mars.png`, `9c-feature-light-earth.png`.
- **c and e:** left for later, in the carry-over note.

## The user's second set of answers (2026-11-16)
The user, in their words: "keep australia", "have both versions of the names", "fix the weak scentences", "label it".
- **Both names (done).** A names-database landmark can be shown under the name its quoted page uses. Its position then carries `"recordName"`, the record's own name. The build checks that `recordName` is the record's name and that the shown name is on the quoted page. The card shows both: the common name as the title, and "(NOAA NCEI name: Fujisan)" beside the position. Ten landmarks: Mount Fuji, Mount Kilimanjaro, Mount Etna, Mount Vesuvius, Mount Pinatubo, Eyjafjallajökull, Popocatépetl, Mount Tambora, Teide (the record is "Tenerife"), Pingualuit Crater. Their ids changed with the names (`fujisan` is now `mount-fuji`). Réservoir Manicouagan stays: its NASA page names the crater in English, not the reservoir.
- **Label (done).** While the feature light is lighting ground, the Surface notes show "Feature light · illustrative". Not shown for a feature in daylight.
- **Australia and the weak sentences:** Task 13, with web research (below). "keep australia" is read as: cover Australia, accepting Geoscience Australia's site licence.

## Task 13: Australia and the weak sentences (2026-11-16 to 2026-11-19)
- **Australia.** A new position source: Geoscience Australia's Composite Gazetteer of Australia, one record per query from its map service. Only records of a state or mainland territory authority count; Antarctic and offshore records fail the build. Six landmarks: Uluru, Kati Thanda-Lake Eyre, Shark Bay, K'gari, Wolfe Creek Crater, Gosses Bluff. Earth has 49. Uluru is a new placement guard.
- **Weak sentences.** Nine replaced, three dropped (Nathair Facula, Fonteyn, Sif Mons), four kept for the user (item 7). Mercury has 14 landmarks, Venus 15.
- Research log and rulings: the plan's Execution record, "Task 13". Sources: [[Earth names databases (GNIS, GNS)]]. Decision: [[0010-names-databases-for-earth-positions]] (third decision).
- Screenshot: `Assets/m2b4a/8d-earth-australia.png`.
- **Found on the way, not fixed:** `npm run data` now fails on the network. NSSDCA's chronology page became a script-loaded app, so two Venera launch quotes are no longer on it. The local cache was restored from the Internet Archive copy of 2026-10-07, so `data:offline` builds. It needs its own fix ([[2026-10-05-m2a1-carry-over]], "From Task 13").

## The project handbook (2026-11-19)
The user: "i need you to fully document the ethodology and general structure a well as code quality and requirements used in this project, everything used as a rule everything used as a source and the logic behind every decision and every source should be noted".
- Done: a `Handbook/` folder in the vault, linked from [[Home]] and [[Start here]]. [[Methodology]], [[Structure]], [[Code quality and requirements]], [[Rules]] (every rule with where it is stated and why, marked where code enforces it), [[Sources register]] (all 216 sources, generated from the data by `node scripts/sources-register.mjs`, with why each family is trusted, what each source supplies, and the sources not used and why), [[Decision register]] (every decision and ruling with its reason, and the open ones).
- Not committed yet: the user decides.
- Still open from before: push to PR #9; the six still-weak sentences; the broken network data build (Venera quotes).
