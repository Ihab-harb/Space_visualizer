import { expect, test, type Locator, type Page } from '@playwright/test';

/** Panels must sit clear of the control panel, whose height grows when its controls wrap (phones) or its hint wraps (desktop). */
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 720 },
];

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  return (await locator.boundingBox())!;
}

function intersects(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(500); // the bar publishes its edge after mount
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('the sky credit does not overlap the control panel', async ({ page }) => {
      await open(page, '/?quality=low');
      expect(intersects(await box(page.locator('.sky-credit')), await box(page.locator('.control-panel')))).toBe(false);
    });

    test('the info panel of a selected body does not overlap the control panel', async ({ page }) => {
      await open(page, '/?quality=low&target=earth');
      const bar = await box(page.locator('.control-panel'));
      const panel = await box(page.locator('.info-panel'));
      expect(intersects(panel, bar)).toBe(false);
      expect(intersects(await box(page.locator('.sky-credit')), bar)).toBe(false);
    });
  });
}
