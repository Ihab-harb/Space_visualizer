import { expect, test } from '@playwright/test';
import sharp from 'sharp';

/** Golden views (spec §7). Screenshots go to test-results/golden/ for review against the look checklist. */
const VIEWS = [
  { name: '1-earth-terminator', url: '/?jd=2461317.5&pause=1&target=earth&dist=36000&azSun=90&el=12&quality=high&fx=1' },
  { name: '2-saturn-rings', url: '/?jd=2453371.5&pause=1&target=saturn&dist=420000&azSun=55&el=16&quality=high&fx=1' },
  // 2008-09-01: the Sun is about 4 degrees from the ring plane, so the unlit face and the globe's shadow are easy to judge.
  { name: '2b-saturn-equinox', url: '/?jd=2454710.5&pause=1&target=saturn&dist=420000&azSun=55&el=6&quality=high&fx=1' },
  { name: '3-sun', url: '/?jd=2461317.5&pause=1&target=sun&dist=4500000&az=0&el=8&quality=high&fx=1' },
  // The Sun small in frame (about 4e7 km): the view where the lens flare, god rays and streak must read (3-sun waives them).
  { name: '3c-sun-far', url: '/?jd=2461317.5&pause=1&target=sun&dist=40000000&az=0&el=8&quality=high&fx=1' },
  // The Sun directly behind Earth: no lens flare and no god rays while the disc is hidden.
  { name: '3b-sun-behind-earth', url: '/?jd=2461317.5&pause=1&target=earth&dist=20000&azSun=180&el=0&quality=high&fx=1' },
  // The Sun partly behind Earth's upper limb: rays from the hidden part must not cross the planet (see the luminance test below).
  { name: '3d-sun-partial', url: '/?jd=2461317.5&pause=1&target=earth&dist=20000&azSun=180&el=18.6&quality=high&fx=1' },
  { name: '0-mars', url: '/?jd=2461317.5&pause=1&target=mars&dist=14000&azSun=60&el=15&quality=high&fx=1' },
  { name: '0b-venus-radar', url: '/?jd=2461317.5&pause=1&target=venus&dist=30000&azSun=60&el=10&radar=1&quality=high&fx=1' },
  { name: '4-overview', url: '/?jd=2461317.5&pause=1&quality=high&fx=1' },
  // The Moon (M2b.2). JDs are TDB, from the app's utcToTdb(calendarToJd(...)); quarter and full dates from moonPhase over
  // systemState. az/el for the Moon views are Earth's ecliptic direction seen from the Moon, so the camera sits on the Earth side.
  // 2026-10-18 16:00 UTC: first quarter (lit fraction 0.5005, waxing).
  { name: '6-moon-quarter', url: '/?jd=2461332.16747&pause=1&target=moon&dist=5500&az=114.82&el=2.77&quality=high&fx=1' },
  // 2026-10-26 04:00 UTC: full Moon (lit fraction 0.9984), 4.6 degrees off the ecliptic, so no eclipse.
  { name: '6b-moon-full', url: '/?jd=2461339.66747&pause=1&target=moon&dist=5500&az=-147.73&el=-4.57&quality=high&fx=1' },
  // First quarter again, from about 1 million km on the Sun side: both bodies lit, the Moon well clear of Earth.
  { name: '6c-earth-moon', url: '/?jd=2461332.16747&pause=1&target=earth&dist=1000000&azSun=-25&el=15&quality=high&fx=1' },
  // 2024-04-08 18:17 UTC (total solar eclipse): the Sun behind the camera (about 20 degrees off its line, so the Moon stays out
  // of frame) and the Moon's shadow on North America right of the info panel. The umbra fell near 25 N, 105 W.
  { name: '6d-solar-eclipse-2024', url: '/?jd=2460409.26261&pause=1&target=earth&dist=15000&az=2.7&el=24&quality=high&fx=1' },
  // 2025-03-14 06:58 UTC (total lunar eclipse, near greatest): the Moon inside Earth's umbra, seen from the Earth side.
  { name: '6e-lunar-eclipse-2025', url: '/?jd=2460748.79108&pause=1&target=moon&dist=5500&az=-6.38&el=-0.32&quality=high&fx=1' },
  // The overview: the Moon sits inside Earth's drawn disc, so it and its label are hidden.
  { name: '6f-overview-moon-hidden', url: '/?jd=2461317.5&pause=1&quality=high&fx=1' },
];

// Golden views take 21-47 s each on SwiftShader, plus up to 30 s for textures; the global 60 s leaves no margin. The Earth guard
// below keeps its own 180 s.
test.describe.configure({ timeout: 120_000 });

let pageErrors: string[] = [];
let shaderErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  shaderErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Shader Error|THREE\.WebGLProgram/.test(msg.text())) shaderErrors.push(msg.text().slice(0, 500));
  });
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
  expect(shaderErrors).toEqual([]);
});

for (const view of VIEWS) {
  test(`golden ${view.name}`, async ({ page }) => {
    await page.goto(view.url);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 }); // a golden fails if textures never load
    await page.waitForTimeout(1500);
    // The radar view must say on screen that it is not a photograph, drawer closed or not.
    if (view.name === '0b-venus-radar') await expect(page.getByText('Radar view · not visible light')).toBeVisible();
    // The Moon views must show the Moon; the overview must hide it (spec §6).
    if (view.name.startsWith('6')) {
      const moonLabel = page.locator('[data-label-id="moon"]');
      if (view.name === '6f-overview-moon-hidden') await expect(moonLabel).toBeHidden();
      else if (!view.name.startsWith('6d')) await expect(moonLabel).toBeVisible();
    }
    await page.screenshot({ path: `test-results/golden/${view.name}.png` });
  });
}

/**
 * Explore golden views (M2b.3 spec §6 and §7), reviewed against the visual bar. The URL opens Explore directly; reduced motion
 * makes the scene and the overlay cut straight to their final state, so no screenshot catches a CSS fade or a transition
 * half-way. The wait is for the scene's own signal (`__svExplore`: progress and focus at 1), then for every CSS animation to
 * finish and the labels to be fully shown.
 */
const EXPLORE_VIEWS = [
  { name: '7-earth-exploded', url: '/?jd=2461317.5&pause=1&target=earth&explore=1&view=exploded&quality=high&fx=1', body: 'earth', view: 'exploded', labels: 4 },
  { name: '7b-earth-section', url: '/?jd=2461317.5&pause=1&target=earth&explore=1&view=section&quality=high&fx=1', body: 'earth', view: 'section', labels: 4 },
  { name: '7c-jupiter-section', url: '/?jd=2461317.5&pause=1&target=jupiter&explore=1&view=section&quality=high&fx=1', body: 'jupiter', view: 'section', labels: 3 },
  { name: '7d-sun-exploded', url: '/?jd=2461317.5&pause=1&target=sun&explore=1&view=exploded&quality=high&fx=1', body: 'sun', view: 'exploded', labels: 3 },
  { name: '7e-moon-section', url: '/?jd=2461317.5&pause=1&target=moon&explore=1&view=section&quality=high&fx=1', body: 'moon', view: 'section', labels: 3 },
  { name: '7f-phone-earth-exploded', url: '/?jd=2461317.5&pause=1&target=earth&explore=1&view=exploded&quality=high&fx=1', body: 'earth', view: 'exploded', labels: 4, phone: true },
  // Review fix wave: a ringed giant cut open (rings hidden, map band filled, diffuse core as a soft band, the depth ruler) and
  // the tilted ice giant exploded along the view's vertical.
  { name: '7g-saturn-section', url: '/?jd=2461317.5&pause=1&target=saturn&explore=1&view=section&quality=high&fx=1', body: 'saturn', view: 'section', labels: 3 },
  { name: '7h-uranus-exploded', url: '/?jd=2461317.5&pause=1&target=uranus&explore=1&view=exploded&quality=high&fx=1', body: 'uranus', view: 'exploded', labels: 3 },
] as const;

for (const view of EXPLORE_VIEWS) {
  test(`golden ${view.name}`, async ({ browser }) => {
    const phone = 'phone' in view && view.phone;
    const page = await browser.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /Shader Error|THREE\.WebGLProgram/.test(msg.text())) errors.push(msg.text().slice(0, 500));
    });
    await page.goto(view.url);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 }); // a golden fails if textures never load
    await page.waitForFunction(
      ({ body, v }) => {
        const e = window.__svExplore?.();
        return !!e && e.bodyId === body && e.view === v && e.progress >= 1 && e.focus >= 1;
      },
      { body: view.body, v: view.view },
      { timeout: 60_000 },
    );
    // Labels (or a phone's numbered dots) all shown, at full opacity, and no CSS animation still running.
    const shown = phone ? '.xdot:not([hidden])' : '.xlabel:not([data-mode="hidden"])';
    await expect(page.locator(shown)).toHaveCount(view.labels, { timeout: 30_000 });
    await page.waitForFunction(() => {
      const root = document.querySelector<HTMLElement>('.xlabels');
      const settled = document.getAnimations().every((a) => a.playState !== 'running');
      return !!root && root.style.visibility === 'visible' && Number(root.style.opacity || 1) >= 1 && settled;
    }, null, { timeout: 30_000 });
    // Spec §4.2: Jupiter's sizes come from a paper, so the view says "Estimate".
    if (view.body === 'jupiter') await expect(page.locator('.explore-notes .tag--estimate')).toBeVisible();
    await page.waitForTimeout(1500); // bloom and depth of field settle over a few frames
    await page.screenshot({ path: `test-results/golden/${view.name}.png` });
    await page.close();
    expect(errors).toEqual([]);
  });
}

/**
 * Surface golden views (M2b.4a spec §7): landmark pins on the globe, a selected pin with its card, the list open, a phone.
 * Reduced motion makes the entry and the turn to a selected feature cuts. Dates: Mars 2461317.9 puts Olympus Mons and
 * Tharsis on the facing side; Earth 2461317.4 puts North America on the sunlit side (Explore opens on the sunlit side, and at
 * the usual 2461317.5 that is the Pacific with the US at the limb); the Moon keeps one face to Earth, so the usual date.
 */
const SURFACE_VIEWS = [
  { name: '8-mars-surface', url: '/?jd=2461317.9&pause=1&target=mars&explore=1&quality=high&fx=1', body: 'mars', pins: 5 },
  { name: '8b-moon-surface-card', url: '/?jd=2461317.5&pause=1&target=moon&explore=1&feature=tycho&quality=high&fx=1', body: 'moon', pins: 5, card: 'Tycho' },
  { name: '8c-earth-surface', url: '/?jd=2461317.4&pause=1&target=earth&explore=1&quality=high&fx=1', body: 'earth', pins: 5 },
  { name: '8d-venus-surface-radar', url: '/?jd=2461317.5&pause=1&target=venus&explore=1&quality=high&fx=1', body: 'venus', pins: 3, radar: true },
  { name: '8e-mars-list', url: '/?jd=2461317.9&pause=1&target=mars&explore=1&quality=high&fx=1', body: 'mars', pins: 5, list: true },
  { name: '8f-phone-mars-surface', url: '/?jd=2461317.9&pause=1&target=mars&explore=1&quality=high&fx=1', body: 'mars', pins: 5, phone: true },
] as const;

for (const view of SURFACE_VIEWS) {
  test(`golden ${view.name}`, async ({ browser }) => {
    const phone = 'phone' in view && view.phone;
    const page = await browser.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /Shader Error|THREE\.WebGLProgram/.test(msg.text())) errors.push(msg.text().slice(0, 500));
    });
    await page.goto(view.url);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 }); // a golden fails if textures never load
    await page.waitForFunction(
      (body) => {
        const e = window.__svExplore?.();
        return !!e && e.bodyId === body && e.view === 'whole' && e.focus >= 1;
      },
      view.body,
      { timeout: 60_000 },
    );
    await expect.poll(() => page.locator('.xpin:visible').count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(view.pins);
    if ('card' in view) {
      await expect(page.getByRole('region', { name: view.card }).getByRole('heading', { name: view.card })).toBeVisible();
      await expect(page.locator('.xpin.is-selected')).toBeVisible();
    }
    if ('radar' in view) await expect(page.getByText('Radar view · not visible light')).toBeVisible();
    if ('list' in view) {
      await page.getByRole('button', { name: /^All features/ }).click();
      await expect(page.getByRole('region', { name: 'All features' })).toBeVisible();
    }
    // Pins shown at full opacity, and no CSS animation or transition still running.
    await page.waitForFunction(() => {
      const root = document.querySelector<HTMLElement>('.xpins');
      const settled = document.getAnimations().every((a) => a.playState !== 'running');
      return !!root && root.style.visibility === 'visible' && Number(root.style.opacity || 1) >= 1 && settled;
    }, null, { timeout: 30_000 });
    await page.waitForTimeout(1500); // bloom and depth of field settle over a few frames
    await page.screenshot({ path: `test-results/golden/${view.name}.png` });
    await page.close();
    expect(errors).toEqual([]);
  });
}

/**
 * Guard against a silent atmosphere failure (NaN/Inf or a grey veil over the night side).
 * Viewport 1280x720, Earth disc centred near (638, 360) with radius about 140 px; azSun=90 puts the day half on the
 * left. Patches are 16x16 px at the disc's vertical centre, about 40% of the radius either side of the centre,
 * clear of the "Earth" label (which sits at the centre).
 */
test('earth atmosphere keeps the night side dark and the scene visible', async ({ page }) => {
  test.setTimeout(180_000); // two full-size SwiftShader screenshots, run in parallel with other workers
  await page.goto('/?jd=2461317.5&pause=1&target=earth&dist=36000&azSun=90&el=12&quality=high&fx=1');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 }); // a golden fails if textures never load
  await page.waitForTimeout(1500);
  const buffer = await page.locator('canvas').screenshot();
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const box = (await page.locator('canvas').boundingBox())!;
  const cx = Math.round(box.width * 0.4984); // disc centre x (about 638 px)
  const cy = Math.round(box.height * 0.5);
  const luminance = (x0: number, y0: number) => {
    let sum = 0;
    let n = 0;
    for (let y = y0 - 8; y < y0 + 8; y++) {
      for (let x = x0 - 8; x < x0 + 8; x++) {
        const i = (y * info.width + x) * 3;
        sum += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
        n++;
      }
    }
    return sum / n;
  };
  let max = 0;
  for (let y = cy - 100; y < cy + 100; y++) for (let x = cx - 100; x < cx + 100; x++) for (let c = 0; c < 3; c++) max = Math.max(max, data[(y * info.width + x) * 3 + c]!);
  const night = luminance(cx + 55, cy);
  const day = luminance(cx - 55, cy);
  console.log(`atmosphere guard: max=${max} night=${night.toFixed(1)} day=${day.toFixed(1)}`);
  expect(max).toBeGreaterThan(40);
  expect(night).toBeLessThan(35);
  expect(day).toBeGreaterThan(night + 40);

  // Star-field check: depth of field softens the background but must not erase it. The sky region (200x120 px, left of the
  // disc, below the top bar, clear of labels, orbit lines and panels) was chosen from this view rendered with depth of
  // field off, where it held 98 pixels above 90 (191 with it on: the bokeh spreads each star over more pixels).
  const SKY_X = 20;
  const SKY_Y = 380;
  const SKY_W = 200;
  const SKY_H = 120;
  let stars = 0;
  for (let y = SKY_Y; y < SKY_Y + SKY_H; y++) {
    for (let x = SKY_X; x < SKY_X + SKY_W; x++) {
      const i = (y * info.width + x) * 3;
      if (Math.max(data[i]!, data[i + 1]!, data[i + 2]!) > 90) stars++;
    }
  }
  console.log(`atmosphere guard: stars=${stars}`);
  // Floor catches erased stars; ceiling catches a grey veil (measured 98 with depth of field off, about 192 on, of 24000 px).
  expect(stars).toBeGreaterThanOrEqual(30);
  expect(stars).toBeLessThan(SKY_W * SKY_H * 0.25);

  // Sharpness check: the selected body must stay in focus. Local contrast (sum of absolute horizontal luminance differences)
  // over a cloud-rich day-side patch (80x60 px, up-left of the disc centre, clear of the "Earth" label) is compared with the
  // same patch after closing the info panel: that deselects the body, which makes the (still mounted) depth-of-field pass
  // neutral and leaves the camera, time and every other effect unchanged, so the only difference is depth of field.
  const PATCH_X = 520;
  const PATCH_Y = 285;
  const PATCH_W = 80;
  const PATCH_H = 60;
  const contrast = (px: Buffer, width: number) => {
    let sum = 0;
    for (let y = PATCH_Y; y < PATCH_Y + PATCH_H; y++) {
      for (let x = PATCH_X; x < PATCH_X + PATCH_W - 1; x++) {
        const a = (y * width + x) * 3;
        const b = a + 3;
        sum += Math.abs(0.2126 * (px[b]! - px[a]!) + 0.7152 * (px[b + 1]! - px[a + 1]!) + 0.0722 * (px[b + 2]! - px[a + 2]!));
      }
    }
    return sum;
  };
  const withDof = contrast(data, info.width);
  await page.getByRole('button', { name: 'Deselect' }).click();
  await page.waitForTimeout(1500);
  const off = await sharp(await page.locator('canvas').screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const withoutDof = contrast(off.data, off.info.width);
  console.log(`atmosphere guard: sharpness dof=${withDof.toFixed(0)} off=${withoutDof.toFixed(0)} ratio=${(withDof / withoutDof).toFixed(3)}`);
  expect(withoutDof).toBeGreaterThan(0);
  expect(withDof).toBeGreaterThanOrEqual(0.7 * withoutDof);
});

test('golden 5-phone', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('/?jd=2461317.5&pause=1&target=jupiter&dist=600000&azSun=70&el=10&quality=high&fx=1');
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 }); // a golden fails if textures never load
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/golden/5-phone.png' });
  await page.close();
});

// The phone with the facts drawer open (key F): the sheet must sit between the header and the bottom bar.
test('golden 5b-phone-drawer', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('/?jd=2461317.5&pause=1&target=jupiter&dist=600000&azSun=70&el=10&quality=high&fx=1');
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 }); // a golden fails if textures never load
  await page.keyboard.press('f');
  await page.waitForTimeout(1500);
  console.log(`phone bottom bar height: ${(await page.locator('.bottom-bar').boundingBox())!.height}px`);
  await page.screenshot({ path: 'test-results/golden/5b-phone-drawer.png' });
  await page.close();
});

/**
 * God rays must not cross a planet that hides part of the Sun (3d-sun-partial: Earth at 20,000 km, the Sun behind the upper limb).
 * Viewport 1280x720: the limb is at about y=100 above the centre x=640; the patch is 24x24 px centred at (PATCH_CX, PATCH_CY) on
 * the night side just inside the limb (about 30 px below where the Sun is hidden), clear of the "Sun" label (y about 117).
 */
test('god rays do not cross the planet hiding part of the Sun', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?jd=2461317.5&pause=1&target=earth&dist=20000&azSun=180&el=18.6&quality=high&fx=1');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  const { data, info } = await sharp(await page.locator('canvas').screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const PATCH_CX = 640;
  const PATCH_CY = 150;
  let sum = 0;
  for (let y = PATCH_CY - 12; y < PATCH_CY + 12; y++) {
    for (let x = PATCH_CX - 12; x < PATCH_CX + 12; x++) {
      const i = (y * info.width + x) * 3;
      sum += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
    }
  }
  const mean = sum / (24 * 24);
  console.log(`god-ray occlusion: night patch mean luminance=${mean.toFixed(2)}`);
  // Measured (SwiftShader, quality=high): 80.24 with the composer's default autoClear (rays cross the planet), 74.85 with
  // autoClear={false} and the proxy at 1.02 R. The rays add about 5 grey levels here; the rest is limb glow (bloom, atmosphere),
  // so half of the unfixed value is unreachable and the threshold sits midway between the two measurements.
  expect(mean).toBeLessThan(77.5);
});
