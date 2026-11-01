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

test('the week preview follows the pointer after the page has scrolled', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await bootDone(page);
  await page.locator('#classes-title').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('main')!).transform)).toBe('none');
  const row = page.locator('.row-link').first();
  await expect(row).toBeVisible();
  const box = await row.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await expect.poll(() => page.evaluate(({ x, y }) => {
    const peek = document.querySelector('.row-peek');
    if (!peek) return { dx: 999, dy: 999, display: 'missing' };
    const rect = peek.getBoundingClientRect();
    return {
      dx: Math.abs(Math.round(rect.left + rect.width / 2 - x)),
      dy: Math.abs(Math.round(rect.top + rect.height / 2 - y)),
      display: getComputedStyle(peek).display,
      close: Math.abs(Math.round(rect.left + rect.width / 2 - x)) <= 2 && Math.abs(Math.round(rect.top + rect.height / 2 - y)) <= 2,
    };
  }, { x, y })).toMatchObject({ display: 'block', close: true });
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(400);
});

test('a narrow screen keeps the week rows and hides the preview', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await bootDone(page);
  await page.locator('#classes-title').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('main')!).transform)).toBe('none');
  await expect(page.locator('.row-link').first()).toBeVisible();
  const metrics = await page.evaluate(() => ({
    peek: getComputedStyle(document.querySelector('.row-peek')!).display,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(metrics.peek).toBe('none');
  expect(metrics.overflow).toBeLessThanOrEqual(1);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('main does not keep a transform and the preview stays hidden', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await bootDone(page);
    await page.locator('#classes-title').scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => ({
      transform: getComputedStyle(document.querySelector('main')!).transform,
      peek: getComputedStyle(document.querySelector('.row-peek')!).display,
      entered: document.body.classList.contains('page-enter'),
    }))).toEqual({ transform: 'none', peek: 'none', entered: false });
  });
});
