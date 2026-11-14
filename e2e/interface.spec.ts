import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

test('overview labels never overlap and the selected label always shows', async ({ page }) => {
  await page.goto('/?jd=2461317.5&pause=1&quality=low');
  await page.waitForTimeout(1500);
  const rects = await page.$$eval('.body-label:not(.is-hidden)', (els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!, b = rects[j]!;
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
    }
  }
  await page.getByRole('button', { name: 'Mercury', exact: true }).dispatchEvent('click');
  await page.waitForTimeout(400);
  await expect(page.locator('.body-label[data-label-id="mercury"]')).not.toHaveClass(/is-hidden/);
});

test('T starts the tour, any key stops it, and Orbit control returns', async ({ page }) => {
  await page.goto('/?pause=1&quality=low');
  await page.keyboard.press('t');
  await expect(page.getByRole('button', { name: /Stop tour/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Sun' })).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', { name: 'Tour', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Orbit' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'true');
});

/** Mean absolute difference (0-255) between two PNG screenshots of the same size. */
async function meanDiff(a: Buffer, b: Buffer): Promise<number> {
  const [ra, rb] = await Promise.all([a, b].map((png) => sharp(png).removeAlpha().raw().toBuffer()));
  let total = 0;
  for (let i = 0; i < ra!.length; i++) total += Math.abs(ra![i]! - rb![i]!);
  return total / ra!.length;
}

async function dragCanvas(page: Page) {
  await page.mouse.move(640, 330);
  await page.mouse.down();
  await page.mouse.move(760, 380, { steps: 8 });
  await page.mouse.up();
}

test('after a tour exit the canvas still orbits under a real drag', async ({ page }) => {
  await page.goto('/?pause=1&quality=low');
  await page.keyboard.press('t');
  await expect(page.getByRole('heading', { name: 'Sun' })).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', { name: 'Tour', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(1500); // the hand-back settles
  const canvas = page.locator('canvas');
  const settled = await canvas.screenshot();
  const settledAgain = await canvas.screenshot();
  const noise = await meanDiff(settled, settledAgain);
  await dragCanvas(page);
  await page.waitForTimeout(800);
  const dragged = await meanDiff(settled, await canvas.screenshot());
  expect(dragged, `drag changes the view (idle noise ${noise.toFixed(3)})`).toBeGreaterThan(noise + 0.5);
});

test('2 during the tour ends the tour in Follow, not Orbit (I2)', async ({ page }) => {
  await page.goto('/?pause=1&quality=low');
  await page.keyboard.press('t');
  await expect(page.getByRole('heading', { name: 'Sun' })).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: 'Tour', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(1000); // the camera hand-back runs on the next frames
  await expect(page.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Orbit' })).toHaveAttribute('aria-pressed', 'false');
});

test('a click during the tour still ends it in Orbit', async ({ page }) => {
  await page.goto('/?pause=1&quality=low');
  await page.keyboard.press('t');
  await expect(page.getByRole('heading', { name: 'Sun' })).toBeVisible({ timeout: 10_000 });
  await page.mouse.click(640, 360);
  await page.waitForTimeout(1000);
  await expect(page.getByRole('button', { name: 'Orbit' })).toHaveAttribute('aria-pressed', 'true');
});

for (const key of [' ', 'Enter']) {
  test(`${key === ' ' ? 'Space' : key} on the focused Tour button stops the tour (I1)`, async ({ page }) => {
    await page.goto('/?pause=1&quality=low');
    await page.keyboard.press('t');
    const stop = page.getByRole('button', { name: /Stop tour/ });
    await expect(stop).toHaveAttribute('aria-pressed', 'true');
    await stop.focus();
    await page.keyboard.press(key);
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: 'Tour', exact: true })).toHaveAttribute('aria-pressed', 'false');
  });
}

test('a click stops the tour', async ({ page }) => {
  await page.goto('/?pause=1&quality=low');
  await page.getByRole('button', { name: 'Tour', exact: true }).click();
  await expect(page.getByRole('button', { name: /Stop tour/ })).toBeVisible();
  await page.mouse.click(640, 360);
  await expect(page.getByRole('button', { name: 'Tour', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('selection updates the header and its cited chips', async ({ page }) => {
  await page.goto('/?pause=1&quality=low');
  await expect(page.getByRole('heading', { name: 'Solar System' })).toBeVisible();
  await page.getByRole('button', { name: 'Jupiter', exact: true }).dispatchEvent('click');
  const header = page.getByRole('banner', { name: 'Selected body' });
  await expect(header.getByRole('heading', { name: 'Jupiter' })).toBeVisible();
  await expect(header).toContainText('From Earth');
  await expect(header).toContainText('AU');
  expect(await header.getByRole('link', { name: /Source \d+/ }).count()).toBeGreaterThanOrEqual(3);
  await page.getByRole('button', { name: 'Mars', exact: true }).dispatchEvent('click');
  await expect(header.getByRole('heading', { name: 'Mars' })).toBeVisible();
});
