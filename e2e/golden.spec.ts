import { expect, test } from '@playwright/test';
import sharp from 'sharp';

/** Golden views (spec §7). Screenshots go to test-results/golden/ for review against the look checklist. */
const VIEWS = [
  { name: '1-earth-terminator', url: '/?jd=2461317.5&pause=1&target=earth&dist=36000&azSun=90&el=12&quality=high&fx=1' },
  { name: '2-saturn-rings', url: '/?jd=2453371.5&pause=1&target=saturn&dist=420000&azSun=55&el=16&quality=high&fx=1' },
  { name: '3-sun', url: '/?jd=2461317.5&pause=1&target=sun&dist=4500000&az=0&el=8&quality=high&fx=1' },
  { name: '0-mars', url: '/?jd=2461317.5&pause=1&target=mars&dist=14000&azSun=60&el=15&quality=high&fx=1' },
  { name: '4-overview', url: '/?jd=2461317.5&pause=1&quality=high&fx=1' },
];

let pageErrors: string[] = [];
let shaderErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  shaderErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Shader Error|THREE\.WebGLProgram/.test(msg.text())) shaderErrors.push(msg.text().slice(0, 500));
  });
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
  expect(shaderErrors).toEqual([]);
});

for (const view of VIEWS) {
  test(`golden ${view.name}`, async ({ page }) => {
    await page.goto(view.url);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/golden/${view.name}.png` });
  });
}

/**
 * Guard against a silent atmosphere failure (NaN/Inf or a grey veil over the night side).
 * Viewport 1280x720, Earth disc centred near (638, 360) with radius about 140 px; azSun=90 puts the day half on the
 * left. Patches are 16x16 px at the disc's vertical centre, about 40% of the radius either side of the centre,
 * clear of the "Earth" label (which sits at the centre).
 */
test('earth atmosphere keeps the night side dark and the scene visible', async ({ page }) => {
  await page.goto('/?jd=2461317.5&pause=1&target=earth&dist=36000&azSun=90&el=12&quality=high&fx=1');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  const buffer = await page.locator('canvas').screenshot();
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const box = (await page.locator('canvas').boundingBox())!;
  const cx = Math.round(box.width * 0.4984); // disc centre x (about 638 px)
  const cy = Math.round(box.height * 0.5);
  const luminance = (x0: number, y0: number) => {
    let sum = 0;
    let n = 0;
    for (let y = y0 - 8; y < y0 + 8; y++) {
      for (let x = x0 - 8; x < x0 + 8; x++) {
        const i = (y * info.width + x) * 3;
        sum += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
        n++;
      }
    }
    return sum / n;
  };
  let max = 0;
  for (let y = cy - 100; y < cy + 100; y++) for (let x = cx - 100; x < cx + 100; x++) for (let c = 0; c < 3; c++) max = Math.max(max, data[(y * info.width + x) * 3 + c]!);
  const night = luminance(cx + 55, cy);
  const day = luminance(cx - 55, cy);
  console.log(`atmosphere guard: max=${max} night=${night.toFixed(1)} day=${day.toFixed(1)}`);
  expect(max).toBeGreaterThan(40);
  expect(night).toBeLessThan(35);
  expect(day).toBeGreaterThan(night + 40);

  // Star-field check: depth of field softens the background but must not erase it. The sky region (200x120 px, left of the
  // disc, below the top bar, clear of labels, orbit lines and panels) was chosen from this view rendered with depth of
  // field off, where it held 98 pixels above 90 (191 with it on: the bokeh spreads each star over more pixels).
  const SKY_X = 20;
  const SKY_Y = 380;
  const SKY_W = 200;
  const SKY_H = 120;
  let stars = 0;
  for (let y = SKY_Y; y < SKY_Y + SKY_H; y++) {
    for (let x = SKY_X; x < SKY_X + SKY_W; x++) {
      const i = (y * info.width + x) * 3;
      if (Math.max(data[i]!, data[i + 1]!, data[i + 2]!) > 90) stars++;
    }
  }
  console.log(`atmosphere guard: stars=${stars}`);
  expect(stars).toBeGreaterThanOrEqual(3);
});

test('golden 5-phone', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('/?jd=2461317.5&pause=1&target=jupiter&dist=600000&azSun=70&el=10&quality=high&fx=1');
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/golden/5-phone.png' });
  await page.close();
});
