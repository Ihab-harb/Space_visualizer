import { expect, test, type Locator, type Page } from '@playwright/test';

/** Panels must sit clear of the control panel, whose height grows when its controls wrap (phones) or its hint wraps (desktop). */
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 720 },
  // Intermediate widths: the control panel collapses behind its button below 1140 px and the drawer sits under the header below 940 px.
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'tablet-portrait', width: 800, height: 1000 },
  { name: 'narrow-desktop', width: 1100, height: 800 },
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

for (const vp of VIEWPORTS) {
  for (const drawer of [false, true]) {
    test(`panels never overlap at ${vp.width}x${vp.height}, drawer ${drawer ? 'open' : 'closed'}`, async ({ browser }) => {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto('/?target=jupiter&pause=1&quality=low');
      await expect(page.locator('canvas')).toBeVisible();
      if (drawer) await page.keyboard.press('f');
      await page.waitForTimeout(600);
      const ids = ['.header', '.control-panel', '.bottom-bar', ...(drawer ? ['.drawer'] : [])];
      const rects = await Promise.all(ids.map((s) => page.locator(s).boundingBox()));
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(intersects(rects[i]!, rects[j]!), `${ids[i]} overlaps ${ids[j]}`).toBe(false);
        }
      }
      await page.close();
    });
  }
}

test.describe('phone 390x844 specifics', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the bottom bar is compact and its controls stay inside it', async ({ page }) => {
    await open(page, '/?quality=low&pause=1');
    const bar = await box(page.locator('.bottom-bar'));
    expect(bar.height, 'bottom bar height').toBeLessThan(200);
    for (const name of ['Reverse', 'Pause', 'Play', 'Now', 'Go', 'Tour']) {
      const b = page.getByRole('button', { name, exact: true });
      if ((await b.count()) === 0) continue;
      const r = await box(b);
      expect(r.x).toBeGreaterThanOrEqual(bar.x);
      expect(r.x + r.width).toBeLessThanOrEqual(bar.x + bar.width + 0.5);
    }
    await expect(page.getByRole('slider', { name: 'Timeline 1800–2050' })).toBeVisible();
    await expect(page.getByLabel('Simulation date')).toBeVisible();
    await expect(page.getByLabel('Speed')).toBeVisible();
    // tick labels stay inside the bar (no clipped "2050")
    const ticks = page.locator('.timeline__ticks li');
    for (let i = 0; i < (await ticks.count()); i++) {
      const r = (await ticks.nth(i).boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(bar.x);
      expect(r.x + r.width).toBeLessThanOrEqual(bar.x + bar.width + 0.5);
    }
  });

  test('the open drawer sits between the header and the bottom bar with no gap under it', async ({ page }) => {
    await open(page, '/?quality=low&pause=1&target=jupiter');
    await page.keyboard.press('f');
    await page.waitForTimeout(500);
    const header = await box(page.locator('.header'));
    const bar = await box(page.locator('.bottom-bar'));
    const sheet = await box(page.locator('.drawer'));
    expect(sheet.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(Math.abs(sheet.y + sheet.height - bar.y)).toBeLessThanOrEqual(1.5);
  });

  test('the narrative is clamped and expands through an accessible button', async ({ page }) => {
    await open(page, '/?quality=low&pause=1&target=jupiter');
    const toggle = page.locator('.header__narrative-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const collapsed = await box(page.locator('.header__narrative'));
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const expanded = await box(page.locator('.header__narrative'));
    expect(expanded.height).toBeGreaterThan(collapsed.height);
  });
});

for (const vp of VIEWPORTS) {
  test(`no horizontal scroll at ${vp.width}x${vp.height}`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('/?target=jupiter&pause=1&quality=low');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.close();
  });
}

test.describe('phone open Controls dropdown', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens clear of the bar, topmost, closes again, and trades places with the drawer', async ({ page }) => {
    await open(page, '/?quality=low&pause=1&target=jupiter');
    const toggle = page.getByRole('button', { name: 'Controls' });
    await toggle.click();
    await page.waitForTimeout(500);
    const panel = await box(page.locator('.control-panel'));
    expect(intersects(panel, await box(page.locator('.bottom-bar')))).toBe(false);
    const topmost = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.control-panel'), { x: panel.x + panel.width / 2, y: panel.y + panel.height / 2 });
    expect(topmost, 'open panel is the topmost element at its centre').toBe(true);
    // opening the drawer closes the dropdown, so they never share the screen
    await page.keyboard.press('f');
    await page.waitForTimeout(500);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const sheet = await box(page.locator('.drawer'));
    expect(intersects(sheet, await box(page.locator('.control-panel')))).toBe(false);
    // and opening the dropdown closes the sheet
    await toggle.click();
    await page.waitForTimeout(500);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.drawer')).not.toHaveClass(/is-open/);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
