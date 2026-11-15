import { expect, test, type Page } from '@playwright/test';

/**
 * Feature pins end to end (M2b.4a spec §4, §5 and §8): the Surface tab with landmark pins, a pin's card, the All features list
 * and its search, a temporary pin for a non-landmark, the Interior tab and back, Earth's landmarks, a body with no features,
 * Venus's radar tag and the feature= link. Quality is Low throughout (SwiftShader).
 */

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

/** Mars at this date opens with Olympus Mons and Tharsis on the facing side, and Hellas Planitia on the far side. */
const MARS_JD = 2461317.9;
const JD = 2461317.5;

const sectionSwitch = (page: Page) => page.getByRole('radiogroup', { name: 'Explore section' });
const viewSwitch = (page: Page) => page.getByRole('radiogroup', { name: 'Interior view' });
/** A pin's dot: a button named after the feature (the list rows carry the type and size in their names too). */
const pin = (page: Page, name: string) => page.locator('.xpin').and(page.getByRole('button', { name, exact: true }));
const shownPins = (page: Page) => page.locator('.xpin:visible');
const card = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const listToggle = (page: Page) => page.getByRole('button', { name: /^(All features \(\d+\) · Search|Landmarks \(\d+\))$/ });

async function open(page: Page, query: string, jd = JD) {
  await page.goto(`/?jd=${jd}&quality=low&pause=1&${query}`);
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(() => typeof window.__svExplore === 'function');
}

/** Waits until Explore is open on a body's Surface (internally the 'whole' view) with the focus fully run up. */
async function onSurface(page: Page, bodyId: string) {
  await page.waitForFunction(
    (bodyId) => {
      const e = window.__svExplore?.();
      return !!e && e.bodyId === bodyId && e.view === 'whole' && e.focus >= 1;
    },
    bodyId,
    { timeout: 30_000 },
  );
}

test('Mars opens on Surface with landmark pins', async ({ page }) => {
  await open(page, 'target=mars&explore=1', MARS_JD);
  await expect(sectionSwitch(page).getByRole('radio', { name: 'Surface' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Explore · Surface')).toBeVisible();
  await onSurface(page, 'mars');
  await expect.poll(() => shownPins(page).count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(5);
  // The facing landmarks are named beside the globe.
  await expect(page.locator('.xpin-name[data-mode="full"]', { hasText: 'Olympus Mons' })).toBeVisible();
});

test('clicking a pin opens its cited card; Esc closes the card, then leaves Explore', async ({ page }) => {
  await open(page, 'target=mars&explore=1', MARS_JD);
  await onSurface(page, 'mars');
  await pin(page, 'Olympus Mons').click();
  const c = card(page, 'Olympus Mons');
  await expect(c.getByRole('heading', { name: 'Olympus Mons' })).toBeVisible();
  await expect(c.locator('.explore-card__quote')).toBeVisible();
  await expect(c.locator('.explore-card__quote')).toContainText('[');
  await expect(c.getByRole('list', { name: 'Sources' })).toBeVisible();
  await expect(pin(page, 'Olympus Mons')).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Escape');
  await expect(c).toHaveCount(0);
  await expect(sectionSwitch(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sectionSwitch(page)).toHaveCount(0);
  await page.waitForFunction(() => window.__svExplore?.() === null, null, { timeout: 30_000 });
});

test('searching the list and picking a far-side feature turns the globe to its pin', async ({ page }) => {
  await open(page, 'target=mars&explore=1', MARS_JD);
  await onSurface(page, 'mars');
  await expect.poll(() => shownPins(page).count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(5);
  await expect(pin(page, 'Hellas Planitia')).toBeHidden(); // on the far side at this date

  await listToggle(page).click();
  const panel = page.getByRole('region', { name: 'All features' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('searchbox', { name: 'Search features' })).toBeFocused();
  await panel.getByRole('searchbox', { name: 'Search features' }).fill('hellas');
  await panel.getByRole('button', { name: /Hellas Planitia/ }).click();
  await expect(card(page, 'Hellas Planitia').getByRole('heading', { name: 'Hellas Planitia' })).toBeVisible();
  // The camera turned: the pin faces the camera within 3 s, near the middle of the globe.
  await expect(pin(page, 'Hellas Planitia')).toBeVisible({ timeout: 3_000 });
  await expect(pin(page, 'Hellas Planitia')).toHaveAttribute('aria-pressed', 'true');
  const view = page.viewportSize()!;
  await expect
    .poll(async () => {
      const b = (await pin(page, 'Hellas Planitia').boundingBox())!;
      return Math.hypot(b.x + b.width / 2 - view.width / 2, b.y + b.height / 2 - view.height / 2);
    }, { timeout: 3_000 })
    .toBeLessThan(view.height * 0.2);

  // A search with no match says so.
  await panel.getByRole('searchbox', { name: 'Search features' }).fill('zzzz');
  await expect(panel.getByText('No features match')).toBeVisible();
});

test('a non-landmark picked from the list gets a pin; clearing the selection removes it', async ({ page }) => {
  await open(page, 'target=mars&explore=1', MARS_JD);
  await onSurface(page, 'mars');
  await expect(page.locator('.xpin.is-temporary')).toHaveCount(0);
  await listToggle(page).click();
  const panel = page.getByRole('region', { name: 'All features' });
  await panel.getByRole('searchbox', { name: 'Search features' }).fill('cimmeria');
  await panel.getByRole('button', { name: /Terra Cimmeria/ }).click();
  const c = card(page, 'Terra Cimmeria');
  await expect(c.getByRole('heading', { name: 'Terra Cimmeria' })).toBeVisible();
  await expect(c.locator('.explore-card__quote')).toHaveCount(0); // not a landmark: Gazetteer rows only
  await expect(page.locator('.xpin.is-temporary')).toHaveCount(1);
  await expect(pin(page, 'Terra Cimmeria')).toBeVisible({ timeout: 3_000 });

  await c.getByRole('button', { name: 'Close feature card' }).click();
  await expect(c).toHaveCount(0);
  await expect(page.locator('.xpin.is-temporary')).toHaveCount(0);
});

test('Interior hides the pins; Surface brings them back', async ({ page }) => {
  await open(page, 'target=mars&explore=1', MARS_JD);
  await onSurface(page, 'mars');
  await expect.poll(() => shownPins(page).count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(5);

  await sectionSwitch(page).getByRole('radio', { name: 'Interior' }).click();
  await expect(viewSwitch(page).getByRole('radio', { name: 'Exploded' })).toHaveAttribute('aria-checked', 'true');
  await page.waitForFunction(() => {
    const e = window.__svExplore?.();
    return !!e && e.view === 'exploded' && e.progress >= 1 && e.focus >= 1;
  }, null, { timeout: 30_000 });
  await expect(shownPins(page)).toHaveCount(0);
  await expect(page.locator('.xpin-name:visible')).toHaveCount(0);
  await expect(listToggle(page)).toHaveCount(0);

  await sectionSwitch(page).getByRole('radio', { name: 'Surface' }).click();
  await expect(viewSwitch(page)).toHaveCount(0);
  await expect.poll(() => shownPins(page).count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(5);
  await expect(listToggle(page)).toBeVisible();
});

test('Earth shows its landmarks, listed as "Landmarks (N)"', async ({ page }) => {
  await open(page, 'target=earth&explore=1');
  await onSurface(page, 'earth');
  await expect.poll(() => shownPins(page).count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(5);
  await expect(listToggle(page)).toHaveText(/^Landmarks \(\d+\)$/);
  await listToggle(page).click();
  await expect(page.getByRole('region', { name: 'Landmarks' })).toBeVisible();
});

test('Jupiter says it has no named surface features and has no list', async ({ page }) => {
  await open(page, 'target=jupiter&explore=1');
  await onSurface(page, 'jupiter');
  await expect(page.getByText('No named surface features')).toBeVisible();
  await expect(listToggle(page)).toHaveCount(0);
  await expect(page.locator('.xpin')).toHaveCount(0);
});

test('Venus shows the radar tag on Surface', async ({ page }) => {
  await open(page, 'target=venus&explore=1');
  await onSurface(page, 'venus');
  await expect(page.getByText('Radar view · not visible light')).toBeVisible();
  await expect.poll(() => shownPins(page).count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
});

test('feature= opens its card; view=whole opens Surface', async ({ page }) => {
  await open(page, 'target=mars&explore=1&feature=valles-marineris', MARS_JD);
  await expect(card(page, 'Valles Marineris').getByRole('heading', { name: 'Valles Marineris' })).toBeVisible({ timeout: 30_000 });
  await expect(pin(page, 'Valles Marineris')).toHaveAttribute('aria-pressed', 'true');

  await open(page, 'target=mars&explore=1&view=whole', MARS_JD);
  await expect(sectionSwitch(page).getByRole('radio', { name: 'Surface' })).toHaveAttribute('aria-checked', 'true');
  await onSurface(page, 'mars');
  await expect.poll(() => shownPins(page).count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(5);
});
