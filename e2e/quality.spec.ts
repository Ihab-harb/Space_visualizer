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
  ExposureEffect: 'exposure',
  ToneMappingEffect: 'tonemap',
  ChromaticAberrationEffect: 'chromatic',
  VignetteEffect: 'vignette',
  NoiseEffect: 'grain',
};

test('the composer assembles exactly the passes data-fx reports (Low)', async ({ page }) => {
  await page.goto('/?pause=1&quality=low&fx=1');
  const names = (await composerPasses(page)).flat().map((n) => FX_NAME[n] ?? n);
  const fx = await page.locator('.scene').getAttribute('data-fx');
  expect(names.join(',')).toBe(fx);
  expect(fx).toBe('bloom,exposure,tonemap,vignette');
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
