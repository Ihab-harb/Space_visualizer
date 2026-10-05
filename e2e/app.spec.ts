import { expect, test } from '@playwright/test';

let pageErrors: string[] = [];
let shaderErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  shaderErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Shader Error|THREE\.WebGLProgram/.test(msg.text())) shaderErrors.push(msg.text().slice(0, 500));
  });
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(1500); // let a few frames render
});

// Checked after every test, so errors caused by interactions are caught too.
test.afterEach(() => {
  expect(pageErrors).toEqual([]);
  expect(shaderErrors).toEqual([]);
});

test('follows a planet with co-rotation while time runs', async ({ page }) => {
  await page.getByRole('button', { name: 'Jupiter', exact: true }).dispatchEvent('click');
  await page.keyboard.press('2');
  await page.getByLabel('Rotate with body').check();
  await page.getByLabel('Speed').selectOption({ label: '1 hour/s' });
  await page.waitForTimeout(2500); // transition plus a few seconds of rotation
  const box = await page.getByRole('button', { name: 'Jupiter', exact: true }).boundingBox();
  // The followed body stays centred in the view.
  expect(Math.abs(box!.x + box!.width / 2 - 640)).toBeLessThan(80);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);
  // Back in Orbit view the pivot stays on Jupiter instead of swinging back to the Sun.
  const after = await page.getByRole('button', { name: 'Jupiter', exact: true }).boundingBox();
  expect(Math.abs(after!.x + after!.width / 2 - 640)).toBeLessThan(80);
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

test('cites the official imagery for Earth', async ({ page }) => {
  await page.goto('/?target=earth&pause=1');
  const panel = page.getByRole('complementary', { name: 'Body information' });
  const imagery = panel.locator('section', { has: page.getByRole('heading', { name: 'Imagery' }) });
  await expect(imagery).toContainText('Surface');
  await expect(imagery).toContainText('Night lights');
  await expect(panel.locator('.sources')).toContainText('Blue Marble');
});
