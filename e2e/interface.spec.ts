import { expect, test } from '@playwright/test';

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
