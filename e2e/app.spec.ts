import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  // Let a few frames render, then confirm nothing threw.
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('places labels next to their bodies, not stacked in a corner', async ({ page }) => {
  const box = await page.getByRole('button', { name: 'Sun', exact: true }).boundingBox();
  expect(box).not.toBeNull();
  // The Sun is the initial orbit target, so its label sits near the middle of the viewport.
  expect(box!.x).toBeGreaterThan(200);
  expect(box!.y).toBeGreaterThan(150);
});

test('shows cited information for a planet', async ({ page }) => {
  await page.screenshot({ path: 'test-results/overview.png' });
  // dispatchEvent: the label may sit under another panel at some dates; we test selection, not hit-testing.
  await page.getByRole('button', { name: 'Jupiter', exact: true }).dispatchEvent('click');
  const panel = page.getByRole('complementary', { name: 'Body information' });
  await expect(panel.getByRole('heading', { name: 'Jupiter' })).toBeVisible();
  await expect(panel.getByRole('link', { name: /Planetary Fact Sheet/ })).toHaveAttribute('href', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/');
  await expect(panel).toContainText('Measured against JPL Horizons');
  await page.screenshot({ path: 'test-results/jupiter-panel.png' });
});

test('panels sit above scene labels', async ({ page }) => {
  await page.getByRole('button', { name: 'Jupiter', exact: true }).dispatchEvent('click');
  const panel = page.getByRole('complementary', { name: 'Body information' });
  await expect(panel).toBeVisible();
  // Wherever a label overlaps the panel, the panel must be the element on top.
  const labelsOnTop = await page.evaluate(() => {
    const panelEl = document.querySelector('.info-panel')!;
    const p = panelEl.getBoundingClientRect();
    return [...document.querySelectorAll('.body-label')]
      .map((label) => {
        const r = label.getBoundingClientRect();
        const x = r.x + r.width / 2;
        const y = r.y + r.height / 2;
        const inside = x > p.left && x < p.right && y > p.top && y < p.bottom;
        return inside && !panelEl.contains(document.elementFromPoint(x, y)) ? label.textContent : null;
      })
      .filter(Boolean);
  });
  expect(labelsOnTop).toEqual([]);
});

test('switches camera views with the keyboard', async ({ page }) => {
  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Orbit' })).toHaveAttribute('aria-pressed', 'true');
});

test('jumps in time and warns about accuracy', async ({ page }) => {
  await page.getByLabel('Go to date (UTC)').fill('1500-01-01');
  await page.getByLabel('Go to date (UTC)').press('Enter');
  await expect(page.getByLabel('Simulation date')).toContainText('1500');
  await expect(page.getByRole('status')).toContainText('Outside 1800–2050');
  await page.getByRole('button', { name: 'Now' }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
});
