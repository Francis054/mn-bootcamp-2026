import { expect, test } from '@playwright/test';

test('public projects stay up without a trainee sign-in page', async ({ page }) => {
  await page.goto('/projects');
  await page.locator('.boot-screen').waitFor({ state: 'detached' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /^sign in$/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^sign up$/i })).toHaveCount(0);

  await page.goto('/signup');
  await page.locator('.boot-screen').waitFor({ state: 'detached' });
  await expect(page.getByRole('heading', { name: /that page is not on this site/i })).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveCount(0);
});
