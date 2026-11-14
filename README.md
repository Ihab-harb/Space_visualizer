# Solar System Visualizer

A 3D, time-accurate model of the Solar System that runs in the browser. Every planet is drawn where it really is on the date you choose, and every fact shown comes from an official source (NASA, JPL, IAU) with a citation you can follow.

The Solar System is the first "region" of a project designed to grow outward later: to nearby stars, the Milky Way and other galaxies.

## Features (Milestone 1)

- **Real positions for any date** from 4713 BC to AD 9999, computed with JPL's [Approximate Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html). The code is tested against [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/), and the app shows each planet's *measured* accuracy, not only the published figure.
- **True orientation and shape:** each planet is tilted, spun and flattened using the IAU rotation models and radii published by NASA/JPL [NAIF](https://naif.jpl.nasa.gov/).
- **Time controls:** play, pause, reverse, speeds from real time up to 1 year per second, and jumping to any date. The app warns when a date is outside the range where the formulas are accurate.
- **Camera views:** *Orbit* (rotate, pan and zoom around any body) and *Follow* (track a body, optionally rotating with its surface), with smooth fly-to transitions. The view stays precise from a planet's surface out to the edge of the Solar System.
- **Info panel with sources:** NASA descriptions, physical and orbital facts, live distances and light travel time. Every value links to its source.
- **Readable or true scale:** enlarged bodies that stay visible, or real sizes and distances.
- **Official imagery and shading (M2a.1):** NASA, USGS and STScI surface maps, rings and sky, lit by custom shaders (terminator, night lights, clouds, atmospheres, ring shadows), each image cited in the info panel.

- **Cinematic effects and adaptive quality (M2a.2):** bloom, god rays, lens flare, anamorphic streaks, depth of field, AgX tone mapping, scene-driven exposure and film grain, with High / Medium / Low presets and an Auto mode.

Still to come: moons, dwarf planets, asteroids and comets, spacecraft, filters and search, more camera views (top-down, view from a body, fly), the interface redesign and tour, and, later, regions beyond the Solar System.

## Quick start

**Requirements:** [Node.js](https://nodejs.org/) 24.15 or newer (includes npm), [Git](https://git-scm.com/), and a current browser with WebGL (Chrome, Edge, Firefox or Safari, with hardware acceleration on).

```bash
git clone https://github.com/Ihab-harb/Space_visualizer.git
cd Space_visualizer
npm install
npm run dev
```

Then open the address Vite prints (normally <http://localhost:5173/>). No server, database or API key is needed: the data is committed to the repository.

**Controls:**
- Drag to rotate, right-drag or Shift-drag to pan, scroll to zoom.
- Click a body (or its label) for its info panel; double-click to centre the view on it.
- Keys **1** / **2** switch between Orbit and Follow; **Esc** returns to Orbit.

## Quality and camera effects

- **Quality** (top bar, or key **Q**): cycles Auto, High, Medium and Low. Auto measures frame time and steps down when the median exceeds 18 ms, and steps up after 10 s under 12 ms. Phones start at Low.
- **Camera effects** (top bar, or key **E**): turns the cinematic effects on or off. Off keeps bloom (reduced) and neutral tone mapping.
- URL parameters: `?quality=auto|high|medium|low` and `?fx=0|1`, for example `?quality=low&fx=0`.
- `npm run perf`: measures frame times at each preset on your real GPU (see [docs/SETUP.md](docs/SETUP.md)).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the development server |
| `npm run build` / `npm run preview` | Builds the static production site into `dist/` / serves it locally |
| `npm test` | Runs the unit tests |
| `npm run typecheck` | Checks TypeScript types |
| `npm run e2e` | Runs the end-to-end browser tests (first run `npx playwright install chromium`) |
| `npm run perf` | Frame-time probe on the real GPU (not SwiftShader); writes `test-results/perf/perf.json` |
| `npm run data` | Re-downloads and validates the official source data (needs internet; optional) |

**[docs/SETUP.md](docs/SETUP.md)** has the full guide: installation, every command, how to use the app, refreshing the data, and troubleshooting.

## Data sources

| Source | Used for |
|---|---|
| [JPL Approximate Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html) | Planet orbits and published accuracy |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Reference positions used to test and measure accuracy |
| [NASA NSSDCA Planetary](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) and [Sun](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html) fact sheets | Physical and orbital facts |
| [NASA/JPL NAIF PCK00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc) | IAU rotation models and shape radii |
| [NASA Science](https://science.nasa.gov/) | Body descriptions |
| [IERS](https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat) and [NASA ΔT polynomials](https://eclipse.gsfc.nasa.gov/SEhelp/deltatpoly2004.html) | Converting between UTC and the time scale of the orbit formulas |

## Imagery

Planet surfaces, rings and the star sky come from official NASA, USGS and STScI products. Each image is cited in the app's info panel.

- `npm run textures`: downloads the source products (about 5 GB, cached in `pipeline/raw/textures/`) and builds the committed 1k/2k textures in `public/textures/`.
- `npm run textures:hd`: also builds 4k/8k textures locally (not committed). Open the app with `?tier=4k` or `?tier=8k` to use them; missing tiers fall back to 2k.
- `npm run textures -- --offline`: rebuilds from the cache without network access.
- `npm run textures:verify`: checks that every source URL still responds.

Procedural visuals (Venus clouds, Sun surface, band flow, cloud drift) are labelled illustrative in the app.

## Tech stack

TypeScript, React, [Three.js](https://threejs.org/) with [React Three Fiber](https://r3f.docs.pmnd.rs/) and drei, Zustand, Zod, Vite, Vitest and Playwright. The astronomy code in `src/core/` is plain TypeScript with no UI dependencies.

## Documentation

The design spec, implementation plans, architecture notes, one note per data source, decision records and the changelog live in [`Space_visualizer/`](Space_visualizer/Home.md). It is an [Obsidian](https://obsidian.md/) vault, but the notes are plain Markdown and readable on GitHub.

## License

No license has been chosen yet, so all rights are reserved by default. The source data comes from NASA/JPL and IERS public material; see each source's own terms.
