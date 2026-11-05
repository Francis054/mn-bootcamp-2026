import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { approveSignup, clientGo } from './approve-signup';

const PASSWORD = 'Correct-horse-1';

async function shot(page: import('@playwright/test').Page, name: string) {
  await mkdir('/opt/cursor/artifacts/screenshots', { recursive: true });
  await page.screenshot({ path: `/opt/cursor/artifacts/screenshots/${name}.png`, fullPage: true });
}

test('trainee signup, verification, portal, and the admin queue', async ({ page }, info) => {
  const suffix = info.project.name;
  await page.goto('/');
  await page.locator('.boot-screen').waitFor({ state: 'detached' });
  await expect(page.getByRole('heading', { name: /secure the future/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trainee sign in / Create account' })).toHaveCount(0);
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: /open menu/i }).click();
    const mobile = page.getByRole('dialog', { name: 'Menu' });
    await expect(mobile.getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute('href', '/login');
    await expect(mobile.getByRole('link', { name: 'Sign up', exact: true })).toHaveAttribute('href', '/signup');
    await mobile.getByRole('link', { name: 'Sign up', exact: true }).click();
  } else {
    const primary = page.getByRole('navigation', { name: 'Primary' });
    await primary.getByRole('button', { name: 'Trainees', exact: true }).click();
    const menu = page.getByRole('menu', { name: 'Trainees' });
    await expect(menu.getByRole('menuitem', { name: /sign in/i })).toHaveAttribute('href', '/login');
    await expect(menu.getByRole('menuitem', { name: /sign up/i })).toHaveAttribute('href', '/signup');
    await menu.getByRole('menuitem', { name: /sign up/i }).click();
  }
  await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
  await shot(page, `trainee-signup-${suffix}`);

  await page.getByLabel('Name').fill('Sample Person');
  await page.getByLabel('Email').fill('not-on-roster@example.test');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox', { name: /creating a trainee account/i }).check();
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('heading', { name: /registration received/i })).toBeVisible();
  await expect(page.getByText(/waiting for an administrator to approve it/i)).toBeVisible();

  await clientGo(page, '/login');
  await clientGo(page, '/signup');
  await page.getByLabel('Name').fill('Roster Person');
  await page.getByLabel('Email').fill('trainee05@example.test');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox', { name: /creating a trainee account/i }).check();
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('heading', { name: /registration received/i })).toBeVisible();
  await shot(page, `trainee-waiting-${suffix}`);

  await clientGo(page, '/login');
  await page.getByLabel('Email').fill('trainee05@example.test');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /waiting for approval/i })).toBeVisible();

  await approveSignup(page, 'trainee05@example.test');
  await clientGo(page, '/login');
  await expect(page.getByRole('heading', { name: /trainee sign in/i })).toBeVisible();
  await shot(page, `trainee-login-${suffix}`);
  await page.getByLabel('Email').fill('trainee05@example.test');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /hello, roster person/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
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
