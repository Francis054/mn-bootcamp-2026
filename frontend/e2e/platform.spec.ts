import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function shot(page: import('@playwright/test').Page, name: string) {
  await mkdir('/opt/cursor/artifacts/screenshots', { recursive: true });
  await page.screenshot({ path: `/opt/cursor/artifacts/screenshots/${name}.png` });
}

async function signIn(page: import('@playwright/test').Page, email: string) {
  await page.goto('/admin/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('length-ok');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /sign in/i }).click();
}

async function clientGo(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((next) => {
    window.history.pushState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

test('public home, classes and contact validation', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /secure the future/i })).toBeVisible();
  const hero = page.locator('figure.hm-1');
  await expect(hero).toBeVisible();
  await expect.poll(() => hero.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(10);
  const heroBox = await hero.boundingBox();
  expect(heroBox?.width ?? 0).toBeGreaterThan(120);
  expect(heroBox?.height ?? 0).toBeGreaterThan(120);
  await shot(page, `home-${info.project.name}`);
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: /open menu/i }).click();
    await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Meet the trainees', exact: true }).click();
  } else {
    const primary = page.getByRole('navigation', { name: 'Primary' });
    await primary.getByRole('button', { name: 'Trainees', exact: true }).click();
    await primary.getByRole('menuitem', { name: /meet the trainees/i }).click();
  }
  await expect(page).toHaveURL(/\/trainees$/);
  await page.goto('/classes');
  await expect(page.getByRole('heading', { name: /every lesson/i })).toBeVisible();
  await shot(page, `classes-${info.project.name}`);
  await page.goto('/contact');
  await page.getByRole('button', { name: /send enquiry/i }).click();
  await expect(page.locator('#name-err')).toHaveText(/enter your name/i);
  await page.goto('/');
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  const serious = axe.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious');
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

test('development sign-in, role gate, expiry and sign-out', async ({ page }, info) => {
  await page.goto('/admin/login');
  await shot(page, `login-${info.project.name}`);
  await signIn(page, 'viewer@example.test');
  await expect(page.getByRole('heading', { name: /sample viewer/i })).toBeVisible();
  await clientGo(page, '/admin/settings');
  await expect(page.getByRole('heading', { name: /access to that screen/i })).toBeVisible();
  await signIn(page, 'administrator@example.test');
  await expect(page.getByRole('heading', { name: /sample administrator/i })).toBeVisible();
  await shot(page, `admin-overview-${info.project.name}`);
  await clientGo(page, '/admin/classes/1');
  await expect(page.getByRole('heading', { name: /edit class/i })).toBeVisible();
  if (info.project.name === 'desktop') await shot(page, 'admin-class-desktop');
  await clientGo(page, '/admin/account');
  await page.getByRole('button', { name: /expire development session/i }).click();
  await expect(page.getByRole('heading', { name: /session expired/i })).toBeVisible();
  await signIn(page, 'editor@example.test');
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: /sign out/i }).click();
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
});
