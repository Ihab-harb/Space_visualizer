---
title: M2b.3 Explore mode, interior cutaway and composition charts — Design Spec
date: 2026-10-30
status: approved
amends: "[[2026-10-04-m2-cinematic-and-rich-bodies-design]]"
milestone: M2b.3
tags: [spec, m2b, interior, charts]
---

# M2b.3 Explore mode, interior cutaway and composition charts — Design Spec

Back to [[Home]] · Outline: M2 spec §8 ([[2026-10-04-m2-cinematic-and-rich-bodies-design]]) and the M2b split in [[2026-10-10-m2b1-body-details-design]] §1 ("M2b.3: Animated interior cutaway and composition charts") · Follows [[2026-10-29-m2b2-moon]] · Session: [[2026-10-29-session-m2b2-moon]]

## 1. Intent

The user's words, from the design talk on 2026-10-30:
- The goal is **"a visually appealing design"**.
- "When a planet is selected there should be the option to **explore more about it**, with that comes the option to **slice it open and explore the inside layers**."
- "When you're in the sliced mode … you are focused on a single planet, so that should be the **main focus of the screen**."
- For bodies without official layer numbers: show "an **estimate** of what it should be like from any available data", and **allow peer-reviewed research papers "if they are well reviewed and trusted"**.
- What would make the user wince: **"if the planets don't look right and the controls are impractical."**

So this section adds an **Explore mode** for one selected body. Its first content is the interior cutaway and the composition chart. Later sections put more into it (feature pins and fields in M2b.4, chapters in M2b.5).

**Success criteria**
- From any selected body (the Sun, the eight planets, the Moon), one action opens Explore. In Explore the body fills the centre of the screen and the normal interface steps aside.
- The interior opens in two views the user can switch between at any time: **Exploded** and **Half-section** (plus **Whole**, the closed body).
- Every layer and every composition value shows its citation. Values that are estimates from research papers say so.
- Screenshot review passes for every body in both views: the bodies "look right" (section 6).
- Controls are few and familiar: one button and one key to enter, Esc or ✕ to leave, a three-way switch (and keys 1–3) for the view, the usual drag and scroll for the camera.
- No regression in accuracy, citations, existing tests or the existing interface.

## 2. Decisions

| Topic | Decision | Whose |
|---|---|---|
| Entry | An **Explore** option on the selected body; it opens a mode focused on that body | User |
| Interior views | **Exploded** (layers float apart along an axis, museum model) **and Half-section** (split in half, flat face turned to the viewer, depth ruler), switchable | User (picked B and C of three mockups) |
| Composition chart | **Ranked bars on one log scale**: every gas in one list, longest to shortest, so trace gases stay visible | User (picked B of three mockups) |
| Explore layout | **Centre stage**: body in the centre, labels floating beside each layer, view switch centred at the top, a thin composition strip at the bottom that opens the full chart | User (picked B of two mockups) |
| Focus | In Explore the body is the main focus; header, control panel, pill labels, orbit lines, other bodies and the bottom bar step aside | User |
| Missing official numbers | Show an **estimate**; **peer-reviewed research papers are allowed** if well reviewed and trusted (rules in §4) | User |
| Mockups | Kept in `Assets/m2b3/`: ![[mockup-1-cutaway-styles.png]] ![[mockup-2-composition-styles.png]] ![[mockup-3-explore-layouts.png]] (mockup 2's option A, not chosen, was later corrected for its log positions; the saved image is the first draft) | My call |
| Everything marked *(my call)* below | Proposed in the design talk; the user said "go ahead" | Mine |

## 3. Explore mode

### 3.1 Entering and leaving
- **Enter:** an **Explore** button in the selected body's header (next to Facts & sources), and the key **X** while a body is selected *(my call)*. Not available while the Tour runs (starting Explore stops the Tour, like any input).
- **Leave:** **Esc**, or the **✕** at the top right. The body closes back to Whole, then the normal view returns with the camera where it was before Explore *(my call)*.
- **Time:** pauses on entry and returns to its previous play state and speed on exit *(my call)*. The date shown does not change.
- **URL:** `explore=1` opens Explore on the `target` body, and `view=whole|exploded|section` sets the view, so golden screenshots are reproducible *(my call)*. Without a `target`, `explore=1` is ignored.
- **Always opens** *(my call)*: every body opens Explore. A body whose layers are all "Illustrative size" still opens, with the tag; a body with no interior entry at all shows Whole only, with "No interior data yet" in place of the view switch.
- **Keys** *(my call)*: the control panel's key hint and the hotkeys tests list X and, inside Explore, 1–3 and Esc. Hotkeys stay in the single owner, `src/ui/hotkeys.ts`.
- **Effects stay on** *(my call)*: dimming other bodies is a material-level fade, not a change to the post-processing stack. Depth of field focuses on the explored body.

### 3.2 What steps aside
In Explore: the header, control panel, pill labels, orbit lines, other bodies' labels, the bottom bar and the drawer are hidden (faded out; under reduced motion, removed at once). Other bodies stay in the 3D scene where they are but are dimmed; the sky stays *(my call: the scene stays physically consistent and the return is seamless)*. Camera effects and quality settings stay as they were.

### 3.3 Layout (Centre stage)
- **Top centre:** a segmented switch **Whole · Exploded · Half-section** (keys **1 · 2 · 3** in Explore; outside Explore 1 and 2 keep meaning Orbit and Follow *(my call)*).
- **Top left:** kind and name ("EXPLORE · INTERIOR" over the body name in its accent colour), as in the mockup.
- **Top right:** **✕** (leave).
- **Around the body:** one floating label per layer, joined to the layer by a thin leader line: name, state (solid, liquid, gas or plasma, where cited), the cited bound (e.g. "to 3,485 km radius") and `[n]`. Labels never overlap each other or the top controls; on overlap, the lower-priority label (inner layers yield to the selected one) collapses to its name *(my call)*.
- **Bottom strip:** the body's composition preview (the top two gases, or "No atmosphere" / the exosphere caveat) and "Open full chart ›". Opening it slides up a glass panel with the full ranked-bar chart (§5). The panel closes with ✕ or Esc (Esc first closes the panel, then leaves Explore).
- **Selecting a layer:** click or tap a layer or its label. It highlights (others dim), and a small glass card shows its full facts: bounds in the form the source states them, state, composition text, uncertainty and citations. Click empty space to clear.
- **Camera:** drag to orbit, scroll or pinch to zoom, as everywhere in the app; distance limits keep the whole body in view at the widest and the core reachable at the closest *(my call)*.
- **Phone width (≤ 720 px):** same layout; floating labels become numbered dots with a tap-to-open list at the bottom, and the full chart opens as a bottom sheet *(my call)*.

### 3.4 Animated transitions
- Whole → Exploded: the body's surface shell lifts away and the layers separate along the body's rotation axis, in about 1.2 s with easing. Exploded ↔ Half-section and back to Whole animate the same way *(my call)*. Reduced motion: cuts.
- The body stops rotating on screen while in Explore (orientation frozen at entry), so labels stay put *(my call)*.

## 4. Data

### 4.1 What exists (M2b.1, M2b.2)
`public/data/solar-system/details/<id>.json` → `interior.layers[]`, outside in: `name`, `outerRadiusKm` and `innerRadiusKm` (each `{min, max, sourceId, from, stated?}`), `state`, `composition` (cited text), `uncertain`. Bodies with layers: Sun (convection zone, radiative zone, core), Mercury, Earth, Mars, Moon. **Venus, Jupiter, Saturn, Uranus and Neptune have `interior: null`.** `atmosphere`: major gases in %, minor in ppm, the Moon's exosphere in particles per cm³ (upper limits).

### 4.2 New: research-paper estimates (user decision, 2026-10-30)
Amends the source rule (M2 spec §2) for this use: **where no official source gives a number, a value may come from a peer-reviewed research paper.** It is recorded as a decision note, [[0009-peer-reviewed-papers-for-estimates]] (to be written with the plan).
- **What counts as well reviewed and trusted** *(my call, for the user to check)*: a peer-reviewed article with a DOI in an established planetary-science or astronomy journal (for example *Nature*, *Science*, *Nature Astronomy*, *JGR Planets*, *Geophysical Research Letters*, *Icarus*, *The Planetary Science Journal*, *Astronomy & Astrophysics*, *The Astrophysical Journal*), preferably by the mission team that took the data (Juno, Cassini, Magellan, Voyager). No preprints alone, no press releases standing in for the paper, no encyclopaedias or aggregators.
- **Same verification as curated values:** each value keeps the exact sentence it came from, and the build checks that the sentence is on the fetched page. The page is the paper's DOI landing page or the publisher's open abstract; a value that appears only behind a paywall is not used *(my call: keeps the build's quote check meaningful)*.
- **Shown as estimates:** layers from papers carry `estimate: true`; the label and the layer card say "Estimate" and cite the paper; the Explore view shows an **"Estimate"** tag when any layer is an estimate.
- **Order of preference:** an official source with a number → an official source that names the layer in words plus a paper for its size → a paper alone. Official descriptions stay the first citation where they exist.
- **If no acceptable number is found** for a layer, the layer is drawn with an illustrative size, labelled **"Illustrative size"**, and shows no number.
- **Expected coverage** (to be confirmed by research in the plan): Venus (crust, mantle, core), Jupiter (molecular hydrogen envelope, metallic hydrogen, dilute core from Juno), Saturn (envelope, metallic hydrogen, diffuse core from Cassini ring seismology), Uranus and Neptune (hydrogen–helium envelope, water-ammonia-methane "ice" mantle, rocky core).
- **Fractions become km** *(my call)*: papers usually give fractions of the radius ("extends to about half the radius"). They are converted with the body's cited mean radius, exactly as M2b.1 converts percent bounds (`from: 'percent'`, the source's own numbers kept in `stated`). A stated range stays a range and is drawn as a soft band.
- **Gradual transitions count as layers** *(my call)*: a dilute or diffuse core (Jupiter from Juno, Saturn from ring seismology) is a layer whose inner or outer bound is a range, drawn as a soft band, not a hard line.
- **Where the quote is checked** *(my call)*: the citation always names the peer-reviewed journal article (DOI). The quote check runs on the first page that can be fetched and holds the published text: the DOI landing page or open abstract, else an open-access copy of the same published or accepted paper (arXiv, PubMed Central, or the NASA ADS full-text link). A preprint that was never published in a peer-reviewed journal is not accepted. No hand-verified quotes: if no copy can be fetched, the value is not used. Fetched pages go into the `pipeline/raw/` cache like every other source, so offline builds work.
- The schema's interior layer gains `estimate?: boolean` and allows an interior to mix official and paper sources. `checkDetails` keeps every existing rule (layers outside in, no gaps or overlaps within tolerance).

### 4.3 Composition data
The chart uses only existing cited data: atmosphere major (%), minor (ppm), exosphere (per cm³). No new composition data is required in this section. Layer composition stays text in the layer card.

## 5. Composition chart (ranked bars, one log scale)

- **One list per body:** every gas, longest bar first, on a single logarithmic axis. Percent and ppm are the same quantity (1 % = 10,000 ppm), so they share one axis; each value is printed in its source's own unit ("78.08 %", "420 ppm") *(per the mockup)*.
- **The Moon's exosphere** is a different quantity (particles per cm³, upper limits), so it gets its own axis and title, and each bar is marked "upper limit".
- **Marks:** thin bars with rounded data ends, one hue (sequential job: magnitude), a value label at each bar end, gas name and formula on the left, `[n]` per value. One axis only; no dual axes.
- **Hover and tap:** each bar shows a tooltip with the full name, value, unit, uncertainty (if any) and source.
- **Accessibility:** a table view of the same values; text in text colours, not the bar colour; contrast checked against the app's dark glass surface.
- **Basis label** *(my call)*: the chart title names what was measured, from the data's own note (for example "Atmosphere · dry air, by volume" for Earth, "Photosphere · by number" for the Sun). The Sun's photosphere composition is charted, titled "Photosphere", not "Atmosphere".
- **Empty states** *(my call)*: a body whose composition is only a note (Mercury's exosphere, column abundances) shows the cited note in the strip and no chart. No atmosphere → "No atmosphere", cited where the fact sheet says so.

## 6. Looking right (visual bar)

The user's first wince is bodies that "don't look right". The bar is the project's existing one (cinematic, sael.net level).
- **Outer shell:** the body's real imagery and shader (the same material as outside Explore), cut by the section plane or lifted as a shell.
- **Interior layers:** drawn as nested spheres or shells at their cited radii. Their colour and glow follow temperature and state: cool rocky crust and mantle in earthy tones, liquid outer cores glowing, hot inner cores near white, the Sun's zones in plasma tones, the giants' hydrogen layers in deep blues and violets. **These colours are illustrative** and labelled so in the layer card *(my call)*.
- **Cut faces:** the Half-section face shows the layers as clean rings with a subtle boundary line, and a depth ruler beside it with the cited bounds.
- **Thin layers:** a layer under about 1 % of the radius (Earth's crust) is drawn with a minimum visible thickness and tagged "drawn thicker than scale" *(my call)*.
- **Uncertain bounds:** where a bound is a range (min ≠ max), the boundary is drawn as a soft band across the range.
- **Lighting:** the same studio lighting, bloom and depth of field as the rest of the app; the interior emits light, so the cut is readable on the night side too.
- **The Sun** *(my call)*: its shell is the photosphere (the existing granulation shader). In Explore the corona glow, lens flare and god rays are off, and bloom is reduced so the zones read. The convection zone, radiative zone and core are nested shells like any body, in plasma tones (orange to white, hotter inward). The cut face glows; the convection zone shows faint illustrative convection cells.
- **Rings** *(my call)*: Saturn's and Uranus's rings show in Whole and are hidden in Exploded and Half-section, so they never cross the cut.
- **Explode axis** *(my call)*: screen-vertical, relative to the view frozen on entry, not the true spin axis. Uranus, lying on its side, would otherwise explode sideways and push labels off screen. The cut and explode geometry are view-relative; the body's surface map keeps its true orientation.
- **Half-section plane** *(my call)*: set facing the camera when Half-section is chosen, then fixed to the body. Orbiting shows the cut from an angle. Choosing Half-section again (button or key 3) turns it to face the camera once more.
- **Screenshot loop:** every body × every view at 1280×720, plus one phone-width view, reviewed by eye until it looks right; the reviewed images go to `Assets/m2b3/`.

## 7. Testing
- **Unit:** Explore state (enter, leave, restore time and camera, Esc order), view switching and keys, label layout (no overlaps, collapse rule), layer geometry from cited radii (thin-layer minimum, range bands), the chart's scale and ordering (percent and ppm on one axis, the exosphere on its own), the estimate tag rules, schema and checks for `estimate`.
- **Pipeline:** research-paper sources pass the same quote check; a paper source on a non-journal host is rejected; `estimate` layers validate.
- **End-to-end:** enter and leave Explore by button, key and URL; switch views; open and close the chart; no page errors; layout stays clear of overlaps at the existing five viewport sizes.
- **Golden views:** Earth Exploded, Earth Half-section, Jupiter Half-section (estimate tag), the Sun Exploded, the Moon Half-section, phone width.

## 8. Out of scope
- Feature pins, magnetic field lines and aurora (M2b.4); self-playing chapters (M2b.5). Explore is built so they can be added later.
- Exhibit mode styling (M2c).
- Moons other than Earth's Moon (M3).
- New atmosphere data; atmospheric layer profiles (temperature against height).

## 9. Left to the builder
- Rendering technique for the shells and cut faces (clipping planes, extra meshes or shader cut), as long as log depth, disposal and the quality presets keep working.
- Exact animation curves and timings within the stated feel.
- The exact label collision algorithm, within the stated rules.
- Where Explore state lives (a new store or an extension of an existing one).

## 10. My calls, for the user to check
1. Enter with the header button or **X**; leave with **Esc** or ✕; keys **1–3** switch views only inside Explore.
2. Time pauses in Explore and resumes as it was.
3. Other bodies stay in the scene, dimmed; the interface fades out.
4. The body stops spinning in Explore so labels stay put.
5. What counts as a trusted paper (journal list, DOI, mission teams), and only quotes verifiable on an open page.
6. Interior colours by temperature and state, labelled illustrative.
7. Thin layers drawn thicker than scale, tagged.
8. Phone: labels become numbered dots with a list.
9. URL parameters `explore=1` and `view=…` for reproducible screenshots.
10. Paper fractions converted to km with the cited mean radius; ranges drawn as soft bands; dilute cores count as layers.
11. Paper quotes checked on the DOI page, else an open copy of the same published paper (arXiv, PMC, NASA ADS); never hand-verified.
12. Chart titles name the basis ("dry air", "photosphere"); note-only bodies show the note, no chart.
13. The Sun in Explore: photosphere shell, no corona or flare, reduced bloom, plasma-toned zones.
14. Rings hidden in Exploded and Half-section; explode along screen-vertical; the Half-section plane faces the camera when chosen, then stays fixed to the body.
15. Explore always opens; "No interior data yet" if a body has none.

## 11. Amended while building
Changes made while building, with the reason. The plan's Execution record ([[2026-10-30-m2b3-explore-interior]]) has the rulings and tuned values.
- **Half-section face (§6):** the face is turned 45 degrees from facing the camera (`SECTION_YAW_RAD`), not square to it. The yaw was tuned on screenshots (35 degrees first, then 45) to keep a crescent of the real surface in view, as in mockup C.
- **Exploded lift (§3.4, §6):** each cap lifts clear of the dome below it, up to a total of 1.8 body radii (the first plan, a flat 0.3 R step capped at 0.8 R, hid the inner domes). The camera steps back for tall stacks so the whole stack stays in frame.
- **Phone framing (§3.3):** a portrait phone frames the body from about 5.6 radii (landscape 3.4), so the whole width fits.
- **Sun effects (§6):** the lens flare and god rays fade in any Explore session, not only when the Sun is explored. The dimmed Sun otherwise threw a starburst across another body's cut face. Bloom and the exposure floor still change only for the Sun's own view.
- **URL (§3.1):** an Explore URL ignores `dist`; Explore framing wins. Golden views cannot set the distance.
- **Explore button (§3.1):** it has no `aria-pressed` (it is an action, not a toggle) and carries `aria-keyshortcuts="X"`.
- **Keys (§3.1):** **F** (the drawer) is blocked in Explore, because the drawer is hidden.
- **Journal names (§4.2):** `TRUSTED_JOURNALS` holds canonical titles, and a short alias such as `JGR Planets` or `A&A` is accepted and normalised ([[0009-peer-reviewed-papers-for-estimates]]).
- **Estimate rule (§4.2):** a layer that cites a paper anywhere (size, state or composition) must be marked `estimate`.
- **Illustrative colours and the card (§3.3, §6):** the layer card carries the note "Illustrative colours: they show state and heat, not real colours".
