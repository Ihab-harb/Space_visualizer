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

    test('the bottom bar does not overlap the header or the control panel', async ({ page }) => {
      await open(page, '/?quality=low');
      const bar = await box(page.locator('.bottom-bar'));
      expect(intersects(bar, await box(page.locator('.header')))).toBe(false);
      expect(intersects(bar, await box(page.locator('.control-panel')))).toBe(false);
    });

    test('the drawer of a selected body does not overlap the control panel or the bottom bar', async ({ page }) => {
      await open(page, '/?quality=low&target=earth');
      const controls = await box(page.locator('.control-panel'));
      await page.keyboard.press('f');
      await page.waitForTimeout(400); // the slide-in
      const panel = await box(page.locator('.drawer'));
      expect(intersects(panel, controls)).toBe(false);
      expect(intersects(panel, await box(page.locator('.bottom-bar')))).toBe(false);
    });
  });
}
