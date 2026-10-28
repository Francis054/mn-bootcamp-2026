import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const PASSWORD = 'Correct-horse-1';

async function shot(page: import('@playwright/test').Page, name: string) {
  await mkdir('/opt/cursor/artifacts/screenshots', { recursive: true });
  await page.screenshot({ path: `/opt/cursor/artifacts/screenshots/${name}.png`, fullPage: true });
}

async function clientGo(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((next) => {
    window.history.pushState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

test('trainee signup, verification, portal, and the admin queue', async ({ page }, info) => {
  const suffix = info.project.name;
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
  await page.locator('.boot-screen').waitFor({ state: 'detached' });
  await shot(page, `trainee-signup-${suffix}`);

  await page.getByLabel('Name').fill('Sample Person');
  await page.getByLabel('Email').fill('not-on-roster@example.test');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox', { name: /creating a trainee account/i }).check();
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByText(/if this email is on the cohort list/i)).toBeVisible();

  await clientGo(page, '/login');
  await clientGo(page, '/signup');
  await page.getByLabel('Name').fill('Roster Person');
  await page.getByLabel('Email').fill('trainee05@example.test');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox', { name: /creating a trainee account/i }).check();
  await page.getByRole('button', { name: /create account/i }).click();
  await page.getByRole('link', { name: /development confirmation link/i }).click();
  await expect(page.getByText(/email confirmed/i)).toBeVisible();
  await shot(page, `trainee-verify-${suffix}`);

  await page.getByRole('link', { name: /trainee sign in/i }).click();
  await expect(page.getByRole('heading', { name: /trainee sign in/i })).toBeVisible();
  await shot(page, `trainee-login-${suffix}`);
  await page.getByLabel('Email').fill('trainee05@example.test');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /hello, roster person/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Headline', exact: true }).fill('Aspiring SOC analyst');
  await page.getByRole('textbox', { name: 'Short bio', exact: true }).fill('I am learning detection and response.');
  await page.getByRole('textbox', { name: 'Location', exact: true }).fill('Accra');
  await page.getByRole('textbox', { name: 'LinkedIn', exact: true }).fill('https://www.linkedin.com/in/roster-person');
  await page.getByRole('textbox', { name: 'GitHub', exact: true }).fill('https://github.com/roster-person');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText(/Saved/)).toBeVisible();
  await page.getByRole('checkbox', { name: /name, headline/i }).check();
  await expect(page.getByText('Consent saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.getByText('Pending review')).toBeVisible();
  await shot(page, `trainee-profile-${suffix}`);

  await page.getByRole('button', { name: /log out/i }).click();
  await clientGo(page, '/admin/login');
  await page.getByLabel('Work email').fill('administrator@example.test');
  await page.getByLabel('Password', { exact: true }).fill('length-ok');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /sample administrator/i })).toBeVisible();
  await clientGo(page, '/admin/review');
  await expect(page.getByRole('heading', { name: /review queue/i })).toBeVisible();
  await expect(page.getByText('trainee05@example.test')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Short bio', exact: true })).toHaveValue(/learning detection/);
  await page.waitForFunction(() => document.querySelector('.boot-screen') === null);
  await shot(page, `admin-review-${suffix}`);

  await clientGo(page, '/admin/pending-registrations');
  await expect(page.getByRole('heading', { name: /signup requests/i })).toBeVisible();
  await expect(page.getByText('not-on-roster@example.test')).toBeVisible();
  await page.waitForFunction(() => document.querySelector('.boot-screen') === null);
  await shot(page, `admin-pending-${suffix}`);
});
