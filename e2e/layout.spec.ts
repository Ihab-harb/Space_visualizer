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
  for (const [target, drawer] of [['jupiter', false], ['jupiter', true], ['moon', false], ['moon', true]] as const) {
    test(`panels never overlap at ${vp.width}x${vp.height} for ${target}, drawer ${drawer ? 'open' : 'closed'}`, async ({ browser }) => {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto(`/?target=${target}&pause=1&quality=low`);
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

/**
 * Explore (M2b.3 spec §3.3 and §7): at every viewport the top bar (title, view switch, ✕, notes), the floating layer labels
 * (numbered dots on a phone) and the bottom strip never overlap one another, and the page does not scroll.
 */
for (const vp of VIEWPORTS) {
  for (const view of ['exploded', 'section'] as const) {
    test(`Explore ${view} at ${vp.width}x${vp.height}: top bar, labels and bottom strip stay apart, no scroll`, async ({ browser }) => {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto(`/?jd=2461317.5&target=earth&pause=1&quality=low&explore=1&view=${view}`);
      await expect(page.locator('canvas')).toBeVisible();
      await page.waitForFunction((v) => {
        const e = window.__svExplore?.();
        return !!e && e.view === v && e.progress >= 1 && e.focus >= 1;
      }, view, { timeout: 30_000 });
      // Every Earth layer has its label (or dot), then two frames so the projector has laid them out at their final places.
      await expect(page.locator('.xlabel:not([data-mode="hidden"]), .xdot:not([hidden])')).toHaveCount(4, { timeout: 30_000 });
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const parts = await page.evaluate(() => {
        const rect = (el: Element) => el.getBoundingClientRect().toJSON() as DOMRect;
        const reserved = [...document.querySelectorAll('[data-explore-reserved]')].map((el) => ({ name: `reserved:${(el as HTMLElement).dataset.exploreReserved}`, r: rect(el) }));
        const labels = [...document.querySelectorAll<HTMLElement>('.xlabel:not([data-mode="hidden"]), .xdot:not([hidden])')]
          .filter((el) => el.offsetParent !== null || el.getClientRects().length > 0)
          .map((el) => ({ name: `label:${el.textContent?.slice(0, 24)}`, r: rect(el) }));
        // The Half-section depth ruler (wider screens only) is laid out with the labels and must keep clear of everything too.
        // Its root is a zero-size anchor: its box is the union of what it draws (lines; title and values unless compact).
        const union = (els: Element[]) => {
          const rs = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0);
          const left = Math.min(...rs.map((r) => r.left));
          const top = Math.min(...rs.map((r) => r.top));
          const right = Math.max(...rs.map((r) => r.right));
          const bottom = Math.max(...rs.map((r) => r.bottom));
          return { left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top } as DOMRect;
        };
        const ruler = [...document.querySelectorAll<HTMLElement>('.xruler:not([data-mode="hidden"])')].map((el) => ({
          name: `ruler:${el.dataset.mode}`,
          r: union([...el.querySelectorAll('line'), ...(el.dataset.mode === 'full' ? el.querySelectorAll('.xruler__title, .xruler__value:not(:empty)') : [])]),
        }));
        return { reserved, labels, ruler };
      });
      // Every layer of Earth has a label (or a dot), all on screen.
      expect(parts.labels.length, 'visible labels').toBe(4);
      // The ruler shows in Half-section above phone width (ticks and values at 1280 x 720), never on a phone or in Exploded.
      expect(parts.ruler.length, 'depth ruler shown').toBe(view === 'section' && vp.width > 720 ? 1 : 0);
      if (view === 'section' && vp.width === 1280) expect(parts.ruler[0]!.name).toBe('ruler:full');
      const all = [...parts.reserved, ...parts.labels, ...parts.ruler].filter((p) => p.r.width > 0 && p.r.height > 0);
      for (const p of parts.labels) {
        expect(p.r.left, `${p.name} inside the left edge`).toBeGreaterThanOrEqual(-0.5);
        expect(p.r.right, `${p.name} inside the right edge`).toBeLessThanOrEqual(vp.width + 0.5);
        expect(p.r.top, `${p.name} inside the top edge`).toBeGreaterThanOrEqual(-0.5);
        expect(p.r.bottom, `${p.name} inside the bottom edge`).toBeLessThanOrEqual(vp.height + 0.5);
      }
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          expect(intersects(all[i]!.r, all[j]!.r), `${all[i]!.name} overlaps ${all[j]!.name}`).toBe(false);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
      await page.close();
    });
  }
}
