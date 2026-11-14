import { expect, test } from '@playwright/test';

let pageErrors: string[] = [];
let shaderErrors: string[] = [];
let badHdResponses: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  shaderErrors = [];
  badHdResponses = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Shader Error|THREE\.WebGLProgram/.test(msg.text())) shaderErrors.push(msg.text().slice(0, 500));
  });
  page.on('response', (r) => {
    if (!/_(4k|8k)\.webp(\?|$)/.test(r.url())) return;
    const type = r.headers()['content-type'] ?? '';
    if (!r.ok() || !type.startsWith('image/')) badHdResponses.push(`${r.status()} ${type} ${r.url()}`);
  });
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
  expect(shaderErrors).toEqual([]);
  expect(badHdResponses).toEqual([]);
});

for (const q of ['high', 'medium', 'low'] as const) {
  test(`quality ${q} can be forced`, async ({ page }) => {
    await page.goto(`/?pause=1&quality=${q}`);
    await expect(page.locator(`.scene[data-quality="${q}"][data-quality-mode="${q}"]`)).toBeAttached();
    await page.waitForTimeout(1500);
  });
}

test('High only requests HD tiers that exist in the build', async ({ page }) => {
  await page.goto('/?pause=1&quality=high&target=earth&dist=36000&azSun=90&el=12');
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 });
  await page.waitForTimeout(1000);
});

test('camera effects off leaves only bloom and a neutral tone map', async ({ page }) => {
  await page.goto('/?pause=1&quality=high&fx=0');
  await expect(page.locator('.scene')).toHaveAttribute('data-fx', 'bloom,tonemap');
});

test('Low runs the reduced stack', async ({ page }) => {
  await page.goto('/?pause=1&quality=low&fx=1');
  await expect(page.locator('.scene')).toHaveAttribute('data-fx', 'bloom,exposure,tonemap,vignette');
});

async function composerPasses(page: import('@playwright/test').Page): Promise<string[][]> {
  await page.waitForFunction(() => (window.__svPasses?.().length ?? 0) > 0);
  return page.evaluate(() => window.__svPasses!());
}
const FX_NAME: Record<string, string> = {
  BloomEffect: 'bloom',
  GodRaysEffect: 'rays',
  LensFlareEffect: 'flare',
  AnamorphicStreakEffect: 'streaks',
  DepthOfFieldEffect: 'dof',
  ExposureEffect: 'exposure',
  ToneMappingEffect: 'tonemap',
  ChromaticAberrationEffect: 'chromatic',
  VignetteEffect: 'vignette',
  NoiseEffect: 'grain',
};

test('the composer assembles exactly the passes data-fx reports (Low)', async ({ page }) => {
  await page.goto('/?pause=1&quality=low&fx=1');
  const passes = await composerPasses(page);
  const names = passes.flat().map((n) => FX_NAME[n] ?? n);
  const fx = await page.locator('.scene').getAttribute('data-fx');
  expect(names.join(',')).toBe(fx);
  expect(fx).toBe('bloom,exposure,tonemap,vignette');
  expect(passes, 'Low has no chromatic aberration, so vignette merges into the HDR pass').toHaveLength(1);
});

test('chromatic aberration runs in a later pass than tone mapping (High)', async ({ page }) => {
  await page.goto('/?pause=1&quality=high&fx=1');
  const passes = await composerPasses(page);
  const at = (name: string) => passes.findIndex((p) => p.includes(name));
  expect(at('ToneMappingEffect')).toBeGreaterThanOrEqual(0);
  expect(at('ChromaticAberrationEffect')).toBeGreaterThan(at('ToneMappingEffect'));
  expect(at('VignetteEffect')).toBeGreaterThanOrEqual(at('ChromaticAberrationEffect'));
});

test('camera effects off assembles only bloom and tone mapping', async ({ page }) => {
  await page.goto('/?pause=1&quality=high&fx=0');
  const names = (await composerPasses(page)).flat().map((n) => FX_NAME[n] ?? n);
  expect(names).toEqual(['bloom', 'tonemap']);
});

test('High with a focused body runs the full stack', async ({ page }) => {
  await page.goto('/?pause=1&quality=high&fx=1&target=earth');
  await expect(page.locator('.scene')).toHaveAttribute('data-fx', 'bloom,rays,flare,streaks,dof,exposure,tonemap,chromatic,vignette,grain');
  const passes = await composerPasses(page);
  const names = passes.flat().map((n) => FX_NAME[n] ?? n);
  expect(names.join(',')).toBe((await page.locator('.scene').getAttribute('data-fx'))!);
  console.log('composer passes: ' + JSON.stringify(passes));
  await page.waitForTimeout(1500);
});

test('selecting and deselecting keeps the composer: depth of field stays mounted and goes neutral (High)', async ({ page }) => {
  await page.goto('/?pause=1&quality=high&fx=1&target=earth');
  const fx = 'bloom,rays,flare,streaks,dof,exposure,tonemap,chromatic,vignette,grain';
  await expect(page.locator('.scene')).toHaveAttribute('data-fx', fx);
  await composerPasses(page);
  await page.evaluate(() => {
    (window as unknown as { __svComposerBefore: unknown }).__svComposerBefore = window.__svComposer!();
  });
  await page.getByRole('button', { name: 'Deselect' }).click();
  await expect(page.locator('.body-label.is-selected')).toHaveCount(0);
  await page.waitForTimeout(800);
  await expect(page.locator('.scene')).toHaveAttribute('data-fx', fx);
  await page.locator('.body-label', { hasText: 'Earth' }).dispatchEvent('click');
  await expect(page.locator('.body-label.is-selected')).toHaveCount(1);
  await page.waitForTimeout(800);
  const same = await page.evaluate(() => window.__svComposer!() === (window as unknown as { __svComposerBefore: unknown }).__svComposerBefore);
  expect(same, 'the EffectComposer was rebuilt on select or deselect').toBe(true);
});

test('Q cycles quality and E toggles camera effects', async ({ page }) => {
  await page.goto('/?pause=1&quality=low');
  await expect(page.locator('.scene[data-quality-mode="low"]')).toBeAttached();
  await page.keyboard.press('q');
  await expect(page.locator('.scene[data-quality-mode="auto"]')).toBeAttached();
  await page.keyboard.press('e');
  await expect(page.locator('.scene')).toHaveAttribute('data-fx', 'bloom,tonemap');
});

test('toggling quality and effects repeatedly does not leak GPU resources', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/?pause=1&quality=low&target=earth');
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  const info = () => page.evaluate(() => window.__svRenderInfo!());
  const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const baseline = await info();
  // Each iteration presses q (low > auto > high > medium > low) then e (effects flip, starting from on). Over 8 iterations the
  // loop visits High with effects on at iterations 2 and 6 (and Low with effects on at 4 and 8). Every state waits for its data-fx.
  const modes = ['auto', 'high', 'medium', 'low'] as const;
  const peaks: { textures: number; geometries: number; programs: number }[] = [];
  let peak = baseline;
  let highWithEffectsVisits = 0;
  const programsAfterCycle: number[] = [];
  for (let i = 0; i < 8; i++) {
    const mode = modes[i % 4];
    const effectsOn = i % 2 === 1;
    await page.keyboard.press('q');
    await expect(page.locator(`.scene[data-quality-mode="${mode}"]`)).toBeAttached();
    await page.keyboard.press('e');
    if (effectsOn) {
      if (mode === 'high') {
        await expect(page.locator('.scene')).toHaveAttribute('data-fx', /dof/, { timeout: 30_000 });
        highWithEffectsVisits++;
      }
    } else {
      await expect(page.locator('.scene')).toHaveAttribute('data-fx', 'bloom,tonemap');
    }
    await frames();
    await page.waitForTimeout(600);
    await frames();
    const now = await info();
    if (mode === 'high' && effectsOn) peaks.push(now);
    peak = { textures: Math.max(peak.textures, now.textures), geometries: Math.max(peak.geometries, now.geometries), programs: Math.max(peak.programs, now.programs) };
    if (i % 4 === 3) programsAfterCycle.push(now.programs);
  }
  expect(highWithEffectsVisits).toBe(2);
  await expect(page.locator('.scene[data-quality-mode="low"]')).toBeAttached();
  await page.waitForTimeout(2000);
  const after = await info();
  console.log(`render info baseline=${JSON.stringify(baseline)} highPeaks=${JSON.stringify(peaks)} peak=${JSON.stringify(peak)} programsAfterCycles=${JSON.stringify(programsAfterCycle)} after=${JSON.stringify(after)}`);
  // High with effects built its passes (render targets) on top of the Low baseline.
  expect(peaks[0].textures).toBeGreaterThan(baseline.textures);
  expect(after.textures).toBeLessThanOrEqual(baseline.textures + 4);
  expect(after.geometries).toBeLessThanOrEqual(baseline.geometries + 4);
  expect(after.programs).toBeLessThanOrEqual(peak.programs);
  expect(programsAfterCycle[1]).toBeLessThanOrEqual(programsAfterCycle[0]);
});
