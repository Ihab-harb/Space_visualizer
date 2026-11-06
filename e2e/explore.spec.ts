import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

/**
 * Explore mode end to end (M2b.3 spec §3 and §7): entering and leaving by button, key and URL, the view switch and its keys,
 * the composition chart, the Esc order, the time and the normal interface coming back, and a leave in the middle of opening.
 * Quality is Low throughout (SwiftShader); `window.__svExplore()` (dev only) reads the scene's Explore frame.
 */

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

const JD = 2461317.5;
const header = (page: Page) => page.getByRole('banner', { name: 'Selected body' });
const viewSwitch = (page: Page) => page.getByRole('radiogroup', { name: 'Interior view' });
const leaveButton = (page: Page) => page.getByRole('button', { name: 'Leave Explore' });

type ExploreFrame = { bodyId: string; view: string; progress: number; focus: number; offsets: number[]; planeOffset: number } | null;
const exploreFrame = (page: Page) => page.evaluate(() => (window.__svExplore?.() ?? null) as ExploreFrame);

async function open(page: Page, query: string) {
  await page.goto(`/?jd=${JD}&quality=low&${query}`);
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(() => typeof window.__svExplore === 'function');
}

/** Waits until the scene has finished opening a view (progress and focus both 1). */
async function settled(page: Page, bodyId: string, view: string) {
  await page.waitForFunction(
    ({ bodyId, view }) => {
      const e = window.__svExplore?.();
      // Whole has nothing to open (progress stays 0); only the focus (dimming, effects) runs up.
      return !!e && e.bodyId === bodyId && e.view === view && (view === 'whole' || e.progress >= 1) && e.focus >= 1;
    },
    { bodyId, view },
    { timeout: 30_000 },
  );
}

/** Waits until the body has fully closed and the normal interface is back. */
async function closed(page: Page) {
  await page.waitForFunction(() => window.__svExplore?.() === null, null, { timeout: 30_000 });
  await expect(header(page)).toBeVisible();
}

/** Mean absolute difference (0-255) between two PNG screenshots of the same size. */
async function meanDiff(a: Buffer, b: Buffer): Promise<number> {
  const [ra, rb] = await Promise.all([a, b].map((png) => sharp(png).removeAlpha().raw().toBuffer()));
  let total = 0;
  for (let i = 0; i < ra!.length; i++) total += Math.abs(ra![i]! - rb![i]!);
  return total / ra!.length;
}

/** The 3D scene alone: the interface on top (checked through the DOM) is hidden while the screenshot is taken. */
const SCENE_ONLY = '.header, .control-panel, .bottom-bar, .drawer, .label-layer { visibility: hidden !important; }';
const sceneShot = (page: Page) => page.locator('canvas').screenshot({ style: SCENE_ONLY });

/** Screenshots of the scene until two in a row agree (the camera has stopped moving); returns the last one. */
async function stillCanvas(page: Page, timeoutMs = 20_000): Promise<Buffer> {
  const end = Date.now() + timeoutMs;
  let prev = await sceneShot(page);
  for (;;) {
    await page.waitForTimeout(400);
    const next = await sceneShot(page);
    if ((await meanDiff(prev, next)) < 0.05 || Date.now() > end) return next;
    prev = next;
  }
}

test('the Explore button opens Explore; the interface steps aside and the switch takes focus', async ({ page }) => {
  await open(page, 'target=earth&pause=1');
  await header(page).getByRole('button', { name: /Explore/ }).click();
  await expect(header(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Time controls' })).toHaveCount(0);
  await expect(page.locator('.control-panel')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Earth' })).toBeVisible();
  await expect(page.getByText('Explore · Interior')).toBeVisible();
  await expect(viewSwitch(page).getByRole('radio', { name: 'Whole' })).toBeFocused();
  await settled(page, 'earth', 'whole');
  // Pill labels and orbit lines step aside too.
  await expect(page.locator('.body-label:not(.is-hidden)')).toHaveCount(0);
});

test('X opens Explore; the switch and keys 1-3 change the view; Esc and ✕ leave', async ({ page }) => {
  await open(page, 'target=earth&pause=1');
  await page.keyboard.press('x');
  await expect(viewSwitch(page)).toBeVisible();
  const radio = (name: string) => viewSwitch(page).getByRole('radio', { name });

  await page.keyboard.press('2');
  await expect(radio('Exploded')).toHaveAttribute('aria-checked', 'true');
  await settled(page, 'earth', 'exploded');
  const exploded = (await exploreFrame(page))!;
  expect(exploded.offsets[0]).toBeGreaterThan(exploded.offsets.at(-1)!); // the outer shell has lifted, the core stays
  await expect(page.locator('.xlabel[data-mode="full"]').first()).toBeVisible();

  await page.keyboard.press('3');
  await expect(radio('Half-section')).toHaveAttribute('aria-checked', 'true');
  await settled(page, 'earth', 'section');
  expect((await exploreFrame(page))!.planeOffset).toBeLessThan(0.01); // cut through the centre

  await radio('Exploded').click();
  await settled(page, 'earth', 'exploded');
  await radio('Whole').click();
  await expect(radio('Whole')).toHaveAttribute('aria-checked', 'true');
  await page.waitForFunction(() => {
    const e = window.__svExplore?.();
    return !!e && e.view === 'whole' && e.offsets.every((o) => o === 0) && e.planeOffset >= 1;
  });

  // Keys 1 and 2 mean views only inside Explore: after leaving they are Orbit and Follow again.
  await page.keyboard.press('Escape');
  await closed(page);
  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('x');
  await expect(leaveButton(page)).toBeVisible();
  await leaveButton(page).click();
  await closed(page);
  await expect(header(page).getByRole('heading', { name: 'Earth' })).toBeVisible();
});

test('the full chart opens and closes; Esc closes the chart first, then leaves', async ({ page }) => {
  await open(page, 'target=earth&pause=1&explore=1&view=exploded');
  await settled(page, 'earth', 'exploded');
  const strip = page.getByRole('region', { name: 'Composition' });
  await expect(strip).toContainText('N₂');
  await strip.getByRole('button', { name: /Open full chart/ }).click();
  const chart = page.getByRole('dialog', { name: 'Composition chart' });
  await expect(chart).toBeVisible();
  await expect(chart.getByRole('button', { name: 'Close chart' })).toBeFocused();
  // Labels step aside while the chart is the focus.
  await expect(page.locator('.xlabels')).toBeHidden();
  await chart.getByRole('button', { name: 'Close chart' }).click();
  await expect(chart).toHaveCount(0);
  await expect(strip.getByRole('button', { name: /Open full chart/ })).toBeFocused();

  await strip.getByRole('button', { name: /Open full chart/ }).click();
  await expect(chart).toBeVisible();
  await page.keyboard.press('Escape'); // first Esc: the chart
  await expect(chart).toHaveCount(0);
  await expect(viewSwitch(page)).toBeVisible();
  await page.keyboard.press('Escape'); // second Esc: Explore
  await expect(viewSwitch(page)).toHaveCount(0);
  await closed(page);
});

test('leaving restores the play state and speed; the date does not change', async ({ page }) => {
  await open(page, 'target=earth');
  await page.getByLabel('Speed').selectOption({ label: '1 hour/s' });
  const speed = await page.getByLabel('Speed').inputValue();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible(); // playing
  await page.keyboard.press('x');
  await expect(viewSwitch(page)).toBeVisible();
  await settled(page, 'earth', 'whole');
  await page.keyboard.press('Escape');
  await closed(page);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible(); // playing again
  await expect(page.getByLabel('Speed')).toHaveValue(speed);

  // Paused before: paused after, and the shown date is unchanged by the visit.
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const date = await page.getByLabel('Simulation date').textContent();
  await page.keyboard.press('x');
  await settled(page, 'earth', 'whole');
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  await closed(page);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.getByLabel('Simulation date')).toHaveText(date!);
});

test('explore=1&view=section opens Half-section directly; no target means no Explore', async ({ page }) => {
  await open(page, 'target=earth&pause=1&explore=1&view=section');
  await expect(viewSwitch(page).getByRole('radio', { name: 'Half-section' })).toHaveAttribute('aria-checked', 'true');
  await expect(header(page)).toHaveCount(0);
  await settled(page, 'earth', 'section');

  await open(page, 'pause=1&explore=1&view=section');
  await expect(page.getByRole('heading', { name: 'Solar System' })).toBeVisible();
  await expect(viewSwitch(page)).toHaveCount(0);
  expect(await exploreFrame(page)).toBeNull();
});

for (const [id, name, view, firstLayer] of [
  ['moon', 'Moon', 'section', 'Crust'],
  ['sun', 'Sun', 'exploded', 'Convection zone'],
] as const) {
  test(`the ${name} opens in ${view === 'section' ? 'Half-section' : 'Exploded'} with its layer labels`, async ({ page }) => {
    await open(page, `target=${id}&pause=1&explore=1&view=${view}`);
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await settled(page, id, view);
    await expect(page.locator('.xlabel', { hasText: firstLayer })).toBeVisible();
  });
}

test('clicking empty space clears the selected layer', async ({ page }) => {
  await open(page, 'target=earth&pause=1&explore=1&view=section');
  await settled(page, 'earth', 'section');
  await page.locator('.xlabel', { hasText: 'Outer core' }).click();
  const card = page.getByRole('region', { name: 'Outer core' });
  await expect(card).toBeVisible();
  // Empty sky in the lower left: no body, no layer, no overlay part.
  await page.mouse.click(60, 560);
  await expect(card).toHaveCount(0);
  await expect(page.locator('.xlabel.is-selected')).toHaveCount(0);
});

test('a leave while opening returns the camera, rings, rotation and interface exactly as before', async ({ page }) => {
  await open(page, 'target=saturn&pause=1&dist=420000&azSun=55&el=16');
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 });
  const before = await stillCanvas(page);
  const noise = await meanDiff(before, await sceneShot(page));

  await page.keyboard.press('x');
  await settled(page, 'saturn', 'whole');
  // Key 2, then Esc on the first frame where the shells have started to lift (the rings are hidden from then on); then watch
  // every frame until the interface is back: it must stay hidden while the body is still closing (spec §3.1), then return.
  // Both keys are sent from the page so the Esc lands early even when SwiftShader frames are slow.
  const samples = await page.evaluate(
    () =>
      new Promise<Array<{ open: boolean; progress: number; header: boolean }>>((resolve) => {
        const out: Array<{ open: boolean; progress: number; header: boolean }> = [];
        let sent = false;
        const t0 = performance.now();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
        const tick = () => {
          const e = window.__svExplore?.() ?? null;
          const headerShown = !!document.querySelector('[aria-label="Selected body"]');
          if (sent) out.push({ open: !!e, progress: e?.progress ?? 0, header: headerShown });
          if (!sent && e && e.view === 'exploded' && e.progress > 0) {
            if (e.progress >= 1) return resolve([]); // already open: too late to be "while opening"; the test fails below
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            sent = true;
            out.push({ open: true, progress: e.progress, header: headerShown });
          }
          if ((sent && !e && headerShown) || performance.now() - t0 > 25_000) resolve(out);
          else requestAnimationFrame(tick);
        };
        tick();
      }),
  );
  expect(samples.length, 'Esc was sent while the shells were lifting').toBeGreaterThan(2);
  expect(samples[0]!.progress).toBeLessThan(1);
  // The body reverses from where it was (no jump to closed), and the header never shows while the body is still open.
  expect(samples.some((s) => s.open && s.progress < samples[0]!.progress)).toBe(true);
  expect(samples.filter((s) => s.open && s.header)).toEqual([]);
  expect(samples.at(-1)!.header).toBe(true);
  await expect(header(page).getByRole('heading', { name: 'Saturn' })).toBeVisible();
  await expect(page.locator('.control-panel')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Time controls' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

  // Camera back where it was, rings back, the globe turned as before: the frame matches the one before Explore.
  const after = await stillCanvas(page);
  const diff = await meanDiff(before, after);
  console.log(`explore leave mid-transition: restore diff=${diff.toFixed(3)} noise=${noise.toFixed(3)}`);
  expect(diff).toBeLessThan(noise + 0.05);
});
