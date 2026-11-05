import { expect, type Page } from '@playwright/test';

/** Stay inside the running page. A full load would drop the development adapter's memory. */
export async function clientGo(page: Page, path: string): Promise<void> {
  await page.evaluate((next) => {
    window.history.pushState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

/** Approves one trainee registration in the development adapter. */
export async function approveSignup(page: Page, email: string): Promise<void> {
  await clientGo(page, '/admin/login');
  await page.getByLabel('Work email').fill('administrator@example.test');
  await page.getByLabel('Password', { exact: true }).fill('length-ok');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /sample administrator/i })).toBeVisible();
  await clientGo(page, '/admin/pending-registrations');
  await expect(page.getByRole('heading', { name: /signup requests/i })).toBeVisible();
  const row = page.getByRole('row', { name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
  await row.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(email)).toHaveCount(0);
}
