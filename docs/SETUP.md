# Setup and running guide

This guide covers everything needed to install, run, test and refresh the data for the Solar System Visualizer on a fresh machine. For an overview of the project, see the [README](../README.md).

## 1. What to install

| Tool | Version | Why | Check with |
|---|---|---|---|
| [Node.js](https://nodejs.org/) | **24.15 or newer** (24.x LTS recommended) | Runs the dev server, tests and data pipeline. `package.json` requires ≥ 24; the jsdom test library asks for ≥ 24.15. | `node --version` |
| npm | Comes with Node.js (11.x) | Installs dependencies, runs scripts | `npm --version` |
| [Git](https://git-scm.com/) | Any recent version | Clone the repository | `git --version` |
| A web browser with **WebGL** | Current Chrome, Edge, Firefox or Safari, with hardware acceleration on | Shows the 3D scene | Visit [get.webgl.org](https://get.webgl.org/) |

Optional, only to rebuild textures: about 6 GB free disk space for the imagery cache (the Venus radar product adds about 170 MB to it; the committed textures are enough to run the app) and 16 GB RAM recommended for `npm run textures:hd` (the build runs Node with an 8 GB heap).

Everything else (React, Three.js, Vite, test tools) is installed by npm in step 2. No database, server or API key is needed: the app runs entirely in the browser from data files committed to the repository.

## 2. Get the code and install dependencies

```bash
git clone https://github.com/Ihab-harb/Space_visualizer.git
cd Space_visualizer
npm install
```

To run the end-to-end browser tests (optional), also download Playwright's Chromium once:

```bash
npx playwright install chromium
```

## 3. Run the app

```bash
npm run dev
```

Vite prints a local address, normally <http://localhost:5173/>. Open it in your browser. The page reloads automatically when you edit the code. Stop the server with `Ctrl+C`.

### Production build

```bash
npm run build     # type-checks, then writes an optimized static site to dist/
npm run preview   # serves dist/ locally to try the production build
```

The contents of `dist/` can be hosted on any static web host.

## 4. Using the app

| Action | How |
|---|---|
| Rotate the view | Drag with the left mouse button (one finger on touch screens) |
| Pan | Right-drag, or Shift + drag |
| Zoom | Mouse wheel, or pinch |
| Select a body | Click the body or its label: the header (top left) shows its facts and narrative |
| Centre the view on a body | Double-click it, or press **Centre view** in the header |
| Orbit view / Follow view | Control panel (top right), or keys **1** / **2**; **Esc** returns to Orbit |
| Keep a body's surface still under the camera | In Follow view, tick **Rotate with body** in the control panel |
| Real sizes instead of enlarged bodies | **True scale** in the control panel |
| Control time | Bottom bar: Reverse, Play/Pause, Speed (real time up to 1 year per second), **Now**, or drag the 1800-2050 timeline |
| Facts, imagery and sources | **Facts & sources** in the header, or key **F**; click a `[n]` in the header to jump to that source |
| Guided tour | **Tour** in the bottom bar, or key **T**; any key, click, wheel or touch stops it |
| Venus radar map | Select Venus, open the drawer (**F**) and switch on **Show Magellan radar** (or open `?target=venus&radar=1`) |
| Jump to a date | Type `YYYY-MM-DD` or `YYYY-MM-DD HH:MM` (UTC) and press **Go**. Use negative years for BC (0 = 1 BC, −1000 = 1001 BC). Supported years: −4712 to 9999. Dates before 15 Oct 1582 use the Julian calendar. |

An amber note in the bottom bar means the date is outside 1800–2050, where JPL's lower-accuracy long-range elements are used. Outside 3000 BC–AD 3000, positions are extrapolated.

## 5. Tests and checks

| Command | What it does |
|---|---|
| `npm test` | Runs all unit tests once (Vitest) |
| `npm run test:watch` | Re-runs unit tests as you edit |
| `npm run typecheck` | Checks TypeScript types without building |
| `npm run e2e` | Runs end-to-end tests in headless Chromium (Playwright); starts the dev server automatically if it isn't running |

### Golden views

`npx playwright test e2e/golden.spec.ts` writes screenshots to `test-results/golden/`. The URL parameters `jd`, `date`, `pause`, `target`, `dist`, `az`, `azSun`, `el` and `tier` also work in the browser for sharing a view.

### Quality, effects and the performance probe

Use the Quality control (key **Q**) and Camera effects toggle (key **E**) in the control panel, or the URL parameters `quality=auto|high|medium|low` and `fx=0|1`. `radar=1` turns on the Venus radar view.

`npm run perf` runs Chromium against the dev server and records median and 95th-percentile frame time at High, Medium and Low (5 s each, 1600x900, Earth view), plus 20 s of Auto. Results go to the console and `test-results/perf/perf.json`. It needs a real GPU: check that the printed renderer is not SwiftShader. If it is, set `headless: false` in `playwright.perf.config.ts`, or add `channel: 'chrome'` if Chrome is installed. The probe fails if the renderer looks like software (SwiftShader, llvmpipe) and records `software` in the JSON. `--use-angle=d3d11` in `playwright.perf.config.ts` is Windows-specific; change it on macOS or Linux. Playwright clears `test-results/` on the next normal run, so copy `perf.json` if you need to keep it. It is not part of `npm run e2e`.

## 6. Refreshing the data (optional)

The app reads `public/data/*.json`, which is generated from official sources and committed to the repository, so you do **not** need to run the pipeline to use the app.

| Command | What it does | Needs internet |
|---|---|---|
| `npm run data` | Downloads the JPL, NASA NSSDCA, NASA NAIF and NASA Science sources, the USGS Gazetteer zips for Mercury, Venus and Mars (about 12 MB) and the curated mission and interior pages; validates them (every curated sentence must be on its page), measures accuracy against the Horizons reference, and rewrites `public/data/` including the per-body details files. If anything fails, nothing is written. | Yes |
| `npm run data:offline` | Same, using only the copies cached in `pipeline/raw/` by the last online run. The Gazetteer zips and the curated pages must be in that cache too, so run `npm run data` once first. | No |
| `npm run horizons:reference` | Re-downloads the 72 JPL Horizons reference positions used to test and measure accuracy (`pipeline/reference/`). Run `npm run data` afterwards to update the measured accuracy shown in the app. | Yes |

Review the resulting `git diff` before committing refreshed data.

### Refreshing the textures

See the Imagery section of the README: `npm run textures`, `npm run textures:hd`, `npm run textures -- --offline` and `npm run textures:verify`.

HD tiers (4k/8k) are only requested when their files exist at the moment the dev server or build starts, so **restart `npm run dev` after `npm run textures:hd`**.

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| "3D graphics are not available" | WebGL is off or unsupported. Turn on hardware acceleration in the browser settings and update the browser and graphics driver. |
| "Could not load the data" | `public/data/` is missing or invalid. Run `git checkout -- public/data` to restore the committed files, or `npm run data` to regenerate them. |
| `npm install` prints `EBADENGINE` warnings | Your Node.js is older than a dependency wants. Upgrade to Node.js 24.15 or newer. |
| Port 5173 already in use | Vite picks the next free port and prints it; use that address. |
| `npm run e2e` says the browser is missing | Run `npx playwright install chromium`. |
| `npm run data` fails with a network error | A source may be temporarily down. Run `npm run data:offline` to rebuild from the cache, or try again later. The committed data stays unchanged on failure. |
| Texture build fails a validation (for example the Mars peak check) | The source product may have changed layout. Run `npm run textures:verify`, and see the vault's Data Sources notes. |
| Very slow in a VM or remote desktop | There is probably no real GPU. Auto drops straight to Low when frames over 250 ms come back to back: three in a row, or at least two in a row totalling more than 1 s (any normal frame resets the count). This cannot happen in the first 5 s after start-up or after choosing Auto; the median rule (steps down above 18 ms) starts after a 3 s warm-up. Low can still be slow on a software renderer: force it from the start with `?quality=low`, and add `&fx=0` to turn camera effects off. |
| Tour stops immediately | Any key, click, wheel or touch ends it by design. Start it with **T** or the Tour button and leave the mouse and keyboard alone. |
| Black planets | A shader failed to compile. Check the browser console for `THREE.WebGLProgram`, and report the GPU and browser. |

## 8. Where things are

| Path | Contents |
|---|---|
| `src/core/` | Astronomy and data logic in pure TypeScript: time scales, orbit calculations, rotation models, data schemas |
| `src/state/` | App state (time, selection, view, loaded catalogue) |
| `src/scene/`, `src/camera/` | 3D scene and camera views (React Three Fiber) |
| `src/ui/` | Interface: header, control panel, facts drawer, bottom bar, hotkeys |
| `pipeline/` | Data pipeline: downloads, parsers, validation, Horizons reference |
| `public/data/` | Generated data the app loads |
| `e2e/` | End-to-end browser tests |
| `Space_visualizer/` | Project documentation as an [Obsidian](https://obsidian.md/) vault: design spec, plans, architecture notes, data-source notes, decisions, changelog. The notes are plain Markdown and also readable on GitHub. |
