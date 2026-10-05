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
