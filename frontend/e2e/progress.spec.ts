import { expect, test } from '@playwright/test';

test('the trainee directory stays up without sign-in or sign-up links', async ({ page }) => {
  await page.goto('/trainees');
  await page.locator('.boot-screen').waitFor({ state: 'detached' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const hrefs = await page.locator('a').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? ''));
  expect(hrefs.filter((href) => href === '/login' || href === '/signup' || href.startsWith('/portal'))).toEqual([]);

  await page.goto('/login');
  await page.locator('.boot-screen').waitFor({ state: 'detached' });
  await expect(page.getByRole('heading', { name: /that page is not on this site/i })).toBeVisible();
});
