import { expect, test, type Page } from '@playwright/test';

async function dismissBoot(page: Page) {
  await page.locator('.boot-screen').waitFor({ state: 'visible' });
  await page.locator('.boot-screen').waitFor({ state: 'detached' });
}

test('the loading screen plays, trainee sign-in is hidden, and staff sign-in still works', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  await page.goto('/');
  await dismissBoot(page);
  await expect(page.getByRole('heading', { name: /secure the future/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trainee sign in / Create account' })).toHaveCount(0);

  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: /open menu/i }).click();
    const mobile = page.getByRole('dialog', { name: 'Menu' });
    await expect(mobile.getByRole('link', { name: 'Meet the trainees' })).toBeVisible();
    await expect(mobile.getByRole('link', { name: 'Sign in', exact: true })).toHaveCount(0);
    await expect(mobile.getByRole('link', { name: 'Sign up', exact: true })).toHaveCount(0);
    await expect(mobile.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
    await page.getByRole('button', { name: /close menu/i }).click();
  } else {
    const primary = page.getByRole('navigation', { name: 'Primary' });
    await primary.getByRole('button', { name: 'Trainees', exact: true }).click();
    const menu = page.getByRole('menu', { name: 'Trainees' });
    await expect(menu.getByRole('menuitem', { name: /meet the trainees/i })).toHaveAttribute('href', '/trainees');
    await expect(menu.getByRole('menuitem', { name: /sign in/i })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: /sign up/i })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: /sign out/i })).toHaveCount(0);
  }

  for (const path of ['/login', '/signup', '/forgot-password', '/portal', '/verify-email']) {
    await page.goto(path);
    await page.locator('.boot-screen').waitFor({ state: 'detached' });
    await expect(page.getByRole('heading', { name: /that page is not on this site/i })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toHaveCount(0);
  }

  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await page.getByLabel('Work email').fill('administrator@example.test');
  await page.getByLabel('Password', { exact: true }).fill('length-ok');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /sample administrator/i })).toBeVisible();
  expect(errors).toEqual([]);
});
