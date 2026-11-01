import { expect, test, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });

async function bootDone(page: Page) {
  await expect(page.locator('.boot-screen')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator('#boot')).toHaveCount(0);
}

test.beforeEach(({ page: _page }, info) => {
  void _page;
  test.skip(info.project.name !== 'desktop', 'This spec sets 1440×900 and 390×844 itself.');
});

test('hovering or focusing a week row shows no floating picture', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await bootDone(page);
  await page.locator('#classes-title').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('main')!).transform)).toBe('none');
  const row = page.locator('.row-link').first();
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute('href', /\/schedule\?week=\d+/);
  const box = await row.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.move(box!.x + 48, box!.y + 10);
  await row.focus();
  await expect(row).toBeFocused();
  expect(await page.evaluate(() => document.querySelector('.row-peek'))).toBeNull();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(400);
});

test('a narrow screen keeps the week rows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await bootDone(page);
  await page.locator('#classes-title').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('main')!).transform)).toBe('none');
  const row = page.locator('.row-link').first();
  await expect(row).toBeVisible();
  const box = await row.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 20, box!.y + 12);
  const metrics = await page.evaluate(() => ({
    peek: document.querySelector('.row-peek'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(metrics.peek).toBeNull();
  expect(metrics.overflow).toBeLessThanOrEqual(1);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('main does not keep a transform and no floating picture appears', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await bootDone(page);
    await page.locator('#classes-title').scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => ({
      transform: getComputedStyle(document.querySelector('main')!).transform,
      peek: document.querySelector('.row-peek'),
      entered: document.body.classList.contains('page-enter'),
    }))).toEqual({ transform: 'none', peek: null, entered: false });
  });
});
