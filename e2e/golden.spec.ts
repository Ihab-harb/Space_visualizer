import { expect, test } from '@playwright/test';

/** Golden views (spec §7). Screenshots go to test-results/golden/ for review against the look checklist. */
const VIEWS = [
  { name: '1-earth-terminator', url: '/?jd=2461317.5&pause=1&target=earth&dist=26000&azSun=90&el=12' },
  { name: '2-saturn-rings', url: '/?jd=2453371.5&pause=1&target=saturn&dist=420000&azSun=55&el=16' },
  { name: '3-sun', url: '/?jd=2461317.5&pause=1&target=sun&dist=4500000&az=0&el=8' },
  { name: '0-mars', url: '/?jd=2461317.5&pause=1&target=mars&dist=14000&azSun=60&el=15' },
  { name: '4-overview', url: '/?jd=2461317.5&pause=1' },
];

for (const view of VIEWS) {
  test(`golden ${view.name}`, async ({ page }) => {
    await page.goto(view.url);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/golden/${view.name}.png` });
  });
}

test('golden 5-phone', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('/?jd=2461317.5&pause=1&target=jupiter&dist=600000&azSun=70&el=10');
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/golden/5-phone.png' });
  await page.close();
});
