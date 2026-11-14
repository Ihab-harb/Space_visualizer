import { expect, test } from '@playwright/test';

test('details files are not requested at startup', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto('/?pause=1&quality=low');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(1500);
  expect(requested.filter((u) => u.includes('/data/solar-system/details/'))).toEqual([]);
});

test('Mars shows cited interior, atmosphere, field, missions and features', async ({ page }) => {
  await page.goto('/?target=mars&pause=1&quality=low');
  // F needs the URL target's selection, which lands with the canvas.
  await expect(page.locator('canvas')).toBeVisible();
  await page.keyboard.press('f');
  const drawer = page.getByRole('complementary', { name: 'Body information' });
  for (const heading of ['Interior', 'Atmosphere', 'Magnetic field', 'Key missions', 'Named features']) {
    await expect(drawer.getByRole('heading', { name: heading })).toBeVisible({ timeout: 10_000 });
  }
  await expect(drawer).toContainText('No global magnetic field');
  await expect(drawer).toContainText('Valles Marineris');
  for (const id of ['interior', 'atmosphere', 'missions', 'features']) {
    expect(await drawer.locator(`#details-${id} a[aria-label^="Source"]`).count()).toBeGreaterThan(0);
  }
});

test('a blocked details file shows Details unavailable and the drawer still works', async ({ page }) => {
  await page.route('**/details/mars.json', (route) => route.abort());
  await page.goto('/?target=mars&pause=1&quality=low');
  // F needs the URL target's selection, which lands with the canvas.
  await expect(page.locator('canvas')).toBeVisible();
  await page.keyboard.press('f');
  const drawer = page.getByRole('complementary', { name: 'Body information' });
  await expect(drawer.getByText('Details unavailable')).toBeVisible({ timeout: 10_000 });
  await expect(drawer.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(drawer.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(page.getByRole('banner', { name: 'Selected body' }).getByRole('heading', { name: 'Mars' })).toBeVisible();
});
