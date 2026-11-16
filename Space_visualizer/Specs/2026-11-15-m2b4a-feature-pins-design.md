---
title: M2b.4a Feature pins — Design Spec
date: 2026-11-15
status: approved
amends: "[[2026-10-30-m2b3-explore-interior-design]]"
milestone: M2b.4a
tags: [spec, m2b, features, explore]
---

# M2b.4a Feature pins — Design Spec

Back to [[Home]] · Outline: M2 spec §8 ([[2026-10-04-m2-cinematic-and-rich-bodies-design]], "clickable feature pins on the globe") · Builds on Explore, [[2026-10-30-m2b3-explore-interior-design]] · Data from [[2026-10-10-m2b1-body-details-design]] · Session: [[2026-11-15-session-m2b4-pins]]

## 1. Intent

M2b.4 was "feature pins and fields". The user split it in two on 2026-11-15: **M2b.4a, feature pins** (this spec) and **M2b.4b, magnetic field lines and aurora** (its own spec later).

This section puts **named surface features on the globe**. A visitor opens a body in Explore and sees its best-known places named: Olympus Mons, Tycho, the Himalaya. Clicking one tells them what it is, in an official source's own words. Behind the landmarks sits the full list of features the app already holds, with search.

The standing goals apply: accuracy, information and visuals carry equal weight; every value is cited; and the user's anti-goals from M2b.3 still hold: it fails "if the planets don't look right and the controls are impractical."

**Success criteria**
- In Explore, the body opens on a **Surface** tab with landmark pins on the globe, named, without covering the surface.
- Clicking a pin or a name turns the view to it and opens a card. Everything on the card is cited.
- An "All features" list with search reaches every feature in the data (the 200 largest each for Mercury, Venus, the Moon and Mars).
- Earth has landmarks.
- The interior views work as before, under an **Interior** tab.
- Pins sit on the right spot of the picture, on every body. A build or test check proves it.
- No regression in accuracy, citations, existing tests or the existing interface.

## 2. Decisions

| Topic | Decision | Whose |
|---|---|---|
| Sections | M2b.4 is two sections: pins first (M2b.4a), then fields and aurora (M2b.4b) | User |
| Shape | **Landmarks first, atlas behind.** About 15 to 25 hand-picked landmark pins per body show by default. An "All features" list with search holds every feature; picking one drops a pin and turns the globe to it | User (option C of three) |
| Earth | **Curated landmarks only**, about 15 to 25. No full list in this section. "We might later add a full list for earth", so nothing here may rule that out | User |
| Earth positions | **An official names database may give an Earth landmark's position**: USGS GNIS for the United States, the NGA GEOnet Names Server for the rest of the world. The NGA is a new publisher for the project. The descriptive sentence still comes from NASA, USGS or ESA (§6.2) | User (option B of two, 2026-11-15) |
| Where pins live | **Two tabs in Explore: Surface and Interior.** Surface is the whole globe with pins. Interior holds Exploded and Half-section. Fields gets its own tab in M2b.4b | User (option A of three mockups) |
| Pin style | **Names beside the globe, with thin leader lines to dots on the surface**, in the style of the interior labels. Names fade out and in as the globe turns | User (option A of three mockups) |
| Mockups | `Assets/m2b4a/`: ![[mockup-1-explore-tabs.png]] ![[mockup-2-pin-styles.png]] (each image shows the chosen option A; the other options were lower on the page) | My call |
| Everything marked *(my call)* below | Put to the user as a list on 2026-11-15; the user said "go ahead" | Mine |

## 3. Approaches

**The feature's shape** (the user chose):
- A. Landmarks only: clean, but wastes the 200 features per body already in the data.
- B. Full atlas with search and type filters only: no new data, but the largest features are mostly huge, obscure regions, and the famous places are often too small to be in the list.
- **C. Landmarks first, atlas behind (chosen):** the calm look of A with the depth of B. The most work.

**How it is built** *(my call; the user handed me the how)*:
- **Reuse Explore's label system (chosen).** Pins are DOM labels with SVG leader lines, placed each frame by a projector in the Canvas, using the same layout function as the interior labels (`src/ui/explore/labelLayout.ts`, `src/scene/interior/InteriorLabels.tsx`). Landmark sentences go through the same quote-checking pipeline as missions and interiors (`pipeline/reference/`, `pipeline/sources/quotedReference.ts`). The two tabs then look like one design, and the text stays sharp at any zoom.
- Not chosen: pins and names as 3D objects in the scene (sprites or meshes). Text would be less sharp, it would duplicate the label layout, and it would fight depth of field and bloom.
- Not chosen: baking names into the surface texture. It cannot be clicked, searched or cited.

## 4. Explore: Surface and Interior tabs

### 4.1 The tabs
- **Top centre:** a two-way switch **Surface · Interior**. It replaces the Whole · Exploded · Half-section switch as the main control.
- **Surface** is today's Whole view, plus pins. **Opening Explore lands on Surface** *(my call)*.
- **Interior** shows a second, smaller switch under the tabs: **Exploded · Half-section**. Choosing Interior opens the interior view used last in this Explore session, Exploded the first time *(my call)*. Going back to Surface closes the body (the existing closing animation), then the pins fade in.
- **Top left:** "EXPLORE · SURFACE" or "EXPLORE · INTERIOR" over the body name.
- **Keys** *(my call)*: **1** Surface, **2** Exploded, **3** Half-section, as today (1 was Whole). Esc steps back one level: the feature card or the list, then Explore. The chart and layer-card rules are unchanged.
- **URL** *(my call)*: `view=surface|exploded|section`. `view=whole` stays as an alias of `surface`, so old links work. `feature=<id>` selects a feature on Surface (see §5.4 for the id).
- **Bodies with no interior data:** the Interior tab still shows, and says "No interior data yet", as the switch's place does today.
- **The bottom composition strip stays on both tabs** *(my call)*. Nothing about the chart changes.
- **Room for M2b.4b:** the switch must take a third tab (Fields) without a redesign, also at phone width.

### 4.2 What Surface shows
- The whole body, with the same material as today's Whole view. Rings show, as in Whole.
- **Opens on the sunlit side** *(my call)*. When Explore opens (or the URL opens it), the camera is placed so the sunlit hemisphere faces it, turned about 35 degrees from the Sun's direction so the terminator shows (the Tour's dwell uses the same idea, see [[camera]]). Today the Explore camera keeps the direction it was entered from, which opens Mercury on its night side. This changes the M2b.3 entry framing, so the M2b.3 goldens are re-shot. The Half-section cut still turns to face the camera when chosen.
- **Venus shows its radar map on Surface** *(my call)*. The named features are on the ground, which the clouds hide. Entering Surface on Venus turns the existing radar view on (`viewStore.venusRadar`), and the "Radar view · not visible light" tag is shown in the Explore overlay (today the tag lives in the header, which Explore hides, so it needs a new home there); leaving Explore restores what the user had. In Interior, Venus is unchanged from today.
- **Earth keeps its clouds on Surface** *(my call)*. The clouds are part of how Earth looks, and a dot marks a place whether or not a cloud is over it. The placement guard and the placement review (§6.4) are done against the cloud-free colour map, so clouds cannot hide a wrong pin.
- **Bodies without features** (the Sun, Jupiter, Saturn, Uranus, Neptune): Surface shows the globe and a short note, "No named surface features" *(my call)*. For the giants the note may add that they have no solid surface only if a cited sentence says so.
- Time is paused and the body's orientation is frozen in Explore (M2b.3), so pins stay put. The user orbits the camera to see the far side.

## 5. Pins, card and list

### 5.1 Pins on the globe
- **A pin is one dot at the feature's official centre** (latitude and longitude from the source) *(my call)*. No outlines or footprints, even for regions thousands of km wide. The card gives the size.
- **Landmark pins show by default.** Each has a dot on the surface. Those on the facing side also get a **name beside the globe with a thin leader line**, capitals, in the interior labels' style.
- **Facing side only:** a dot shows when its point on the sphere faces the camera, and fades near the limb. Dots on the far side are hidden (the body is opaque). Dots show on the night side too, at the same brightness: they are interface, not surface.
- **How many names** *(my call)*: as many as fit without overlap, by the existing layout rules. Priority: the selected pin, the hovered pin, then the landmarks in their curated order (§6.2 gives each a rank). A landmark whose name does not fit keeps its dot; hovering or focusing the dot shows the name.
- **Names never overlap** each other, the tabs, the card, the list or the bottom strip (the existing `data-explore-reserved` rule). Leader lines on one side do not cross.
- **As the camera turns**, names fade out and in; they do not jump. Under reduced motion they switch without a fade.
- **Selected pin:** highlighted in the interaction colour (cyan), as in the mockups.

### 5.2 Clicking a pin
- Click or tap a dot or a name: the camera **turns to face the feature** (a short orbit, about 0.8 s, distance unchanged; a cut under reduced motion), the pin is selected and the **feature card** opens.
- Click empty space, or press Esc, to clear the selection.
- Pins and names are reachable by keyboard, in priority order, with the feature's name as the accessible name.

### 5.3 The feature card
A glass card on the right, where the layer card sits in Interior, built the same way.
- **A landmark's card:** its type, and "Landmark"; the name; **the quoted official sentence** with its `[n]`; size; position (latitude and longitude in the source's convention, see §6.4); how it got its name; the year the name was approved; a Sources list.
- **Any other feature's card:** the same, without the quote. Every row comes from the Gazetteer and is cited to it.
- **Type in plain words** *(my call)*: most Gazetteer types are Latin ("Mons", "Planitia", "Rupes"). The card shows such a type with its meaning ("Mons · mountain"), taken from the USGS Gazetteer's own descriptor-terms page and cited. If that page cannot be used under the quote rules, the card shows the Latin type alone. Types already in English ("Crater", and the Moon's "Satellite Feature", a lettered crater named after a nearby one) are shown as they are, with no gloss.
- **Earth landmarks** have no Gazetteer rows. Their card shows only what their sources state: name, a plain type, the quoted sentence, position, and size if a source gives one.
- Citations work as in the layer card: its own Sources list, numbers from the shared `citationModel`.

### 5.4 The "All features" list
- A button on the left of the Surface tab, "All features (200) · Search" *(placement left to the builder; it must not collide with the bottom strip)*. It opens a glass panel on the left.
- **Content:** every feature in the body's data: name, type, size. Landmarks are marked and listed first; the rest follow, largest first. A search box filters by name as you type, ignoring case and accents. No type filters in this section *(my call)*.
- **Picking a row** selects that feature: the camera turns to it, its card opens, and if it is not a landmark it gets a **temporary pin** that stays until the selection is cleared or changes.
- **Earth:** the same panel, titled "Landmarks (n)", listing only the landmarks. This is the place a full Earth list would later fill.
- **Feature id:** each feature and landmark has a stable id (a slug of its name, unique within the body) used by the URL and the selection state.
- Bodies without features have no button.

### 5.5 Phone width (≤ 720 px) *(my call)*
As for the layers today: names become **numbered dots**, and a tap-to-open numbered list at the bottom carries the names. The feature card and the All features panel are bottom sheets. The tabs fit on one row.

## 6. Data

### 6.1 What exists
`public/data/solar-system/details/<id>.json` → `features` (M2b.1): the 200 largest approved features from the USGS Gazetteer for **Mercury, Venus, the Moon and Mars**, each with `name`, `type`, `latDeg`, `lonDegE`, `diameterKm`, `origin` and `approvedYear`, plus `totalApproved` and `thresholdKm`.

**A fault found in this data (2026-11-15):** Mercury's list has 200 rows but 193 distinct names. Seven names appear twice (Discovery Rupes, Mirni Rupes, Kunisada, Michelangelo, Matisse, Milton, Lange), with values that differ slightly or not at all. Venus, the Moon and Mars have no duplicates. This section fixes it first *(my call)*: the plan finds the cause in the Gazetteer source files, the built list holds **one row per approved feature**, and it is refilled to 200. If the two rows of a pair differ, the plan records which one the Gazetteer's own feature page shows and keeps that. The facts drawer's Mercury data changes with this; the Changelog says so. The build then fails on a duplicate name within a body.

 `features` is null for Earth, the Sun and the giants. The Gazetteer gives no descriptions.

### 6.2 New: curated landmarks
A new curated file in `pipeline/reference/` (beside `missions.json` and `interiors.json`), under the same rules (`pipeline/reference/README.md`): official hosts only, the exact sentence stored, the build fails if the sentence is not on the fetched page.

- **A landmark needs two things** *(my call)*: (1) an official page with **a sentence about it worth showing**, at least 6 words, quote-checked; (2) **an official position**.
- **Mercury, Venus, the Moon, Mars:** position, size, type, name origin and approval year come from the **Gazetteer**, matched by exact name. A landmark may be smaller than the 200-feature size cut (Tycho is about 85 km; the Moon's cut is 143 km): the pipeline then pulls that one feature from the Gazetteer data by name. The build fails if a landmark's name is not an approved Gazetteer feature of that body.
- **Earth** (the user's decision, 2026-11-15): the Gazetteer has no Earth entries. An Earth landmark's position comes from one of two places, in this order of preference:
  1. **An official names database**, playing the part the USGS Gazetteer plays for the other bodies: the U.S. Board on Geographic Names data, which is **USGS GNIS** for the United States and the **NGA GEOnet Names Server** for the rest of the world. The landmark is matched to one database record by name, and the record's id is stored, so the match can be checked again. The position is that record's, cited to the database.
  2. **A quoted sentence** on a NASA, USGS or ESA page that states the latitude and longitude (the rule below).

  **No position is ever read off a map or a picture, and none is typed from memory.** An Earth landmark with no citable position is dropped. The descriptive sentence always comes from NASA (including Earth Observatory and SVS), USGS or ESA, never from the names database.
- **The NGA as a source** *(the rule is the user's; the details are my call)*: this amends the source rule (M2 spec §2) for one use only, Earth landmark positions. It is recorded as a decision note, `0010` (to be written with the plan, as 0009 was). The NGA's host is added to the allowed hosts **for position sources only**, not to the list for quoted sentences. A names-database record is data, not a sentence, so it is checked as the Gazetteer rows are (the fetched record holds the name and the numbers), not by the 6-word quote rule. Fetched records go into the `pipeline/raw/` cache, so offline builds work.
- **To confirm by research in the build:** that GNIS and the GEOnet Names Server can be fetched by the pipeline, under what licence, and that they hold the wanted landmarks. A wide place (a mountain range, a desert) has one point in such a database; the card says the position is the database's point for the name, not a measured centre. If neither database can be used, Earth falls back to the quoted-sentence path alone and the user is told.
- **Reading a stated position** *(my call)*: the README has no rule for coordinates today; this section adds one. A position counts when the quote states latitude and longitude as numbers with their hemisphere or sign. Degrees and minutes may be turned into decimal degrees, and west or south into the stored sign convention: that is a change of notation, like the ISO form of a quoted date, not a derived value. The card prints the position as the source wrote it. A caption or a data line counts if it is on the fetched page and the quote is at least 6 words long.
- **Rank:** landmarks are stored in priority order, best known first. The order decides which names show when not all fit. It is an editorial choice, not data, and the UI does not present it as a ranking.
- **Counts follow the sources:** the target is 15 to 25 per body for Mercury, Venus, Earth, the Moon and Mars. If the sources only support fewer, the body gets fewer; no landmark is padded in. **Earth is the main risk**: official sentences that give coordinates may be scarce. Fewer than 8 for any body is reported to the user before the section is called done.
- **Choosing them:** research in the build, logged in the plan's Execution record as M2b.3's paper research was (what was looked for, what was found, what was rejected and why). Prefer features NASA's own planet and Moon overview pages name.
- **No research papers** for landmark sentences. Decision 0009 covers interior estimates only.
- **Numbers inside a quote** are shown only as part of the quoted sentence. No number is lifted out of a landmark quote into a data field, except an Earth position (the rule above) or an Earth size in km (the README's existing kilometre rule).

### 6.3 Shape of the built data
Left to the plan, within these needs:
- The app can load, per body, the landmark list in rank order (each with id, name, type, position, optional size, the quote text and its `sourceId`, and whether the rest came from the Gazetteer) and the full feature list.
- Earth can carry landmarks while `features` stays null.
- Adding a full Earth list later needs no change to the landmark data.
- Every `sourceId` resolves in `sources.json`. `checkDetails` gains rules: landmark ids unique; positions in range; a Gazetteer landmark's values equal the Gazetteer's.
- Details files stay loaded on demand, one per body.

### 6.4 Coordinates and placing pins on the picture
This is the accuracy heart of the section.
- The Gazetteer gives planetocentric latitude and east longitude from 0 to 360 degrees in each body's IAU frame. The card prints them as "14.0° S, 301.0° E", from the stored numbers, cited.
- A pin's 3D position comes from the same body-fixed frame the texture is mapped in, so a pin must land on its feature in the image. **Each body's map has its own longitude origin and direction; these must be checked, not assumed.**
- **A placement guard per body with pins** *(my call)*: it runs in `npm test` (or `npm run data:offline`), so it works **on the committed files only**: the 1k or 2k colour maps, and the Venus radar map. No elevation data is committed, so the guard cannot use it. For each body, at least two well-separated features that stand out in brightness on the colour map are checked at their Gazetteer positions against their surroundings (for example a dark mare against bright highlands on the Moon, a dark region such as Syrtis Major and a bright basin such as Hellas on Mars, Caloris on Mercury, a continent against ocean on Earth). The pair must be chosen so that a mirrored or a shifted longitude fails. Today only Venus (Maxwell Montes) and the Mars elevation data have an orientation check, both inside the local texture build; the Mars colour map, Mercury, the Moon's colour map and Earth have none, and the carry-over note says the Venus check may miss a mirror. Stronger checks may be added to the local texture build as well, but they do not replace the committed-file guard.
- **Pins follow the drawn shape:** bodies are drawn oblate (`BodyMesh.tsx`), so a pin's point is computed on the same flattened shape, not on a sphere.
- **Screenshot review** of every landmark on every body: the dot sits on the feature.

## 7. Looking right
- The planet picture stays the hero. Names sit off the globe; lines are thin; dots are small with a soft glow, as in the mockups. Colours: white dots and text, cyan for the selected pin.
- Depth of field focuses on the body as today; pins and names are DOM, so they stay sharp.
- **Screenshot loop:** every body with pins on Surface at 1280×720, from the opening view and from at least one other side; a selected pin with its card; the list open; one phone-width view. Reviewed by eye until it looks right. The reviewed images go to `Assets/m2b4a/`.

## 8. Testing
- **Unit:** the tab and view state (Surface, Interior, remembered interior view, Esc order, keys, URL with the `whole` alias and `feature=`); pin projection and facing-side rule; name priority and layout (no overlaps, landmarks before others, the selected pin first); the list (order, search ignoring case and accents); the card's content for a Gazetteer landmark, a plain feature and an Earth landmark; the sunlit-side entry camera; the turn-to-feature camera move.
- **Pipeline:** landmark quotes pass the quote check; a landmark not in the Gazetteer fails; an Earth landmark without a quoted position fails; the placement guards.
- **End-to-end:** open Explore on Mars and see pins; click a pin and read its card; search the list and pick a non-landmark; switch to Interior and back; Earth shows landmarks; Jupiter shows the note; the URL opens a feature; the layout stays clear of overlaps at the existing five viewport sizes; no page errors.
- **Golden views:** Mars Surface; the Moon Surface with a card open; Earth Surface; Venus Surface (radar); the list open; phone width. The M2b.3 goldens are re-shot for the new entry direction.
- The existing Explore tests are updated for the tabs, not deleted.

## 9. Out of scope
- Magnetic field lines and aurora (M2b.4b); chapters (M2b.5); Exhibit mode (M2c).
- Landing-site pins (mission data has no coordinates yet).
- A full feature list for Earth.
- Feature outlines or footprints; type filters; features of other moons (M3).
- Features of the giants' atmospheres (the Great Red Spot and the like are not in the Gazetteer data held today).
- Pins outside Explore.

## 10. Left to the builder
- The built data's exact shape and file layout (§6.3), and whether the schema version changes.
- How the tab and view state is stored (extend `exploreStore` or add to it).
- Exact fades, timings and easing within the stated feel; the limb fade rule.
- Where the All features button sits on the left, and the list's exact look, within the Explore glass style.
- How the placement guards measure "stands out", within §6.4.
- Which landmarks, within §6.2's rules.

## 11. My calls, for the user to check
1. Opening Explore lands on Surface; Interior opens the interior view used last (Exploded first).
2. Keys 1, 2, 3 are Surface, Exploded, Half-section; `view=whole` still works in links.
3. Surface opens on the sunlit side, 35 degrees off the Sun's direction. The M2b.3 goldens are re-shot.
4. Venus shows its radar map on Surface, labelled.
5. A pin is one dot at the official centre; no outlines.
6. Names show for as many landmarks as fit, in a curated order; the rest keep a dot.
7. The card gives the Latin type with its plain meaning from the USGS descriptor terms.
8. The list has search but no type filters; landmarks first, then by size.
9. Giants and the Sun show "No named surface features".
10. Phone: numbered dots and a list; card and list as bottom sheets.
11. A landmark needs an official quotable sentence and an official position. Counts follow the sources; fewer than 8 on any body is reported.
12. No research papers for landmark sentences.
13. A placement guard per body proves pins land on the picture.
14. The composition strip stays on both tabs.
15. Built by reusing Explore's DOM label system and the quote-checking pipeline, not 3D pin objects.
16. Mercury's seven duplicated feature rows are fixed first: one row per approved feature, refilled to 200.
17. Earth keeps its clouds on Surface.
18. A stated position may be converted in notation (degrees and minutes to decimal, west to a sign), never derived.
19. The placement guards run in `npm test` on the committed colour maps.
20. The NGA host is allowed for position sources only; database records are checked as data, like Gazetteer rows; decision note 0010 records the change.

## 12. Answered by the user
**Where do Earth landmark positions come from?** Asked 2026-11-15; the user chose **B**. It is written into §2 and §6.2. The two options were:
- **A. Only from a quoted sentence on a NASA, USGS or ESA page** that states the latitude and longitude. Strictest. Few such sentences exist, and wide places such as mountain ranges rarely have a stated centre, so Earth may end with a handful of landmarks, or none.
- **B. Also allow an official names database for the position**, as the USGS Gazetteer is for the other bodies: the U.S. Board on Geographic Names data (USGS GNIS for the United States; the NGA GEOnet Names Server for the rest of the world). It is an official government source, but the NGA is a new publisher for this project and its host is not in `OFFICIAL_HOSTS`, so this needs the user's yes. The descriptive sentence still comes from NASA, USGS or ESA. Whether these databases hold each wanted landmark, and can be fetched by the pipeline, is to be confirmed by research in the build.

## 12a. Amended while building
Changes made while building, with the reason. The plan's Execution record ([[2026-11-15-m2b4a-feature-pins]]) has the rulings, the research logs and the tuned values.
- **Earth positions came from GNIS only (§2, §6.2), until Task 12 (next item).** The NGA GEOnet Names Server could not be reached from this network (every try timed out at connect, while `www.nga.mil` answered), so no GNS record could be fetched or checked. Earth has 21 landmarks, all in the United States (13) and Antarctica (8). The user was told, as §6.2 asks; it is open for the user. The GNS code paths stay in place and fail the build if used. NASA image-centre coordinates were not accepted as positions: an image centre is not where the feature is.
- **Earth positions from other official sources (§2, §6.2; Task 12, 2026-11-16).** The user, after GNS failed: "it didn't work use other official sources that have similar data". Earth now has 43 landmarks: 21 from GNIS, 12 volcanoes from NOAA NCEI's Volcano Locations Database, 4 undersea features from the IHO-IOC GEBCO gazetteer, 4 Canadian places from Natural Resources Canada and 2 New Zealand places from LINZ. Every continent has landmarks, and so do the Atlantic and the Pacific. National sources are used only for their own country, checked on the record's own territory field. Australia is not covered (no licence stated). The sources form a registry; GNS stays in it, not in use. Rules: [[0010-names-databases-for-earth-positions]].
- **GNIS area files, not single records (§6.2).** GNIS has no fetch of one record. The pipeline downloads the staged file for the record's area (a state, or Antarctica; 1 to 3 MB each), finds the record by its Feature ID and caches the file in `pipeline/raw/`. Each Earth position stores the database, the record id and the area. The source cited is the USGS download page, as for the planetary Gazetteer's zip.
- **Earth types are the GNIS feature class (§5.3).** §5.3 asked for "a plain type". A curated word ("Canyon") was first shown with the GNIS citation, which does not say it. Now the type is the record's own class, cited to GNIS ("Valley" for the Grand Canyon, "Glacier" for an ice shelf, "Cape" for the Antarctic Peninsula). A curated type is allowed only for a quoted-position landmark, shown without a citation; there are none today.
- **The build fails on a duplicate feature id, not a duplicate name (§6.1).** Every duplicated name found was one feature listed twice (same Gazetteer link); those rows are merged. Two different features that share a name are allowed and get distinct ids (a type suffix). Mercury's approved total is now 606 (was 614).
- **Names stay on their own side of the globe (§5.1).** A pin's name that does not fit on its own side is not shown; the dot stays and names itself on hover. The selected pin is exempt and may cross over: after the turn it sits near the centre, and it is ranked first. Names move at most 7 % of the viewport height from their pin, so leaders stay near level.
- **Dots near the screen edge are hidden (§5.1).** A dot shows only when it faces the camera and its centre is at least 11 px inside every edge. Otherwise an off-screen pin would be an invisible tab stop, and a name would pull a leader in from outside the picture.
- **The search box shows only for more than 10 entries (§5.4).** Earth (21 landmarks) has one.
- **Phone list (§5.5):** the list sheet has a "Close list" link, because the sheet covers its own button. The card and the list are one sheet at a time: the card covers the list button, as the layer card covers the Layers button. Numbered dots sit on their features and are not pulled apart, so two dots can overlap where two landmarks share a spot (Gale and Aeolis Mons).
- **The list button counts every entry (§5.4):** "All features (207) · Search" on Mars (200 Gazetteer features plus 7 landmarks below the size cut).
- **Night side and the turn (§5.1, §5.2):** pins on the night side keep full brightness, and the turn faces the feature without regard to the Sun, so a selected feature can land in the dark. Polar features are viewed from at most 70 degrees of elevation.
- **Type meanings (§5.3):** a meaning's quote may be two rows of the USGS table run together, to reach the 6-word minimum. The card shows only the meaning and its citation.
- **Quotes keep the page's spacing (§6.2):** a stray space before punctuation (where a link ends) stays in the stored quote, because the quote must match the page; the card tidies it for display only.
- **Placement guards (§6.4):** each guard's disc is sized from the feature's diameter, and each carries a stated physical prior (maria dark, a facula bright, Venus highlands radar-bright). Earth's guard measures land against water, with Lake Superior, the McMurdo Dry Valleys and Mauna Loa, and since Task 12 also Hudson Bay and Fujisan (at least two guards catch a mirror and a half-turn). The Venus planitiae have no consistent radar sign and are not guarded.
- **Surface says when details are loading or failed (§4.1, fix wave).** On Surface the notes row shows "Loading surface features…" (`role="status"`) while the details load, and "Could not load the surface features." with a Retry button (`role="alert"`) after a failed load. Before, a failed load left a bare globe. The Interior tab keeps its own three messages.
- **An unknown feature id is cleared (§4.3, fix wave).** Once a body's details are ready, a selected id they do not name (a wrong `feature=` in the URL, or an id from another body) is cleared: no card, no pin, no invisible selection, and the camera stops looking it up. While the details load the id is kept, so a valid URL id still works.
- **Earth positions show hemisphere letters (§5.3, fix wave).** A names-database position is shown with the record's own digits and the hemisphere: "36.112764° N, 113.9960696° W" (a minus sign becomes S or W; nothing is rounded). The stored text is unchanged. The fixed line about the names database's point stays.
