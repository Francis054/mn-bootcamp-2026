import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const PORTRAIT = 'public/assets/img/participant-portrait-800.webp';
const TEAM = 'public/assets/img/guests-smiling-800.webp';
const PARTNER = 'public/assets/img/presenters-yellow-room-800.webp';

async function shot(page: Page, name: string) {
  await mkdir('/opt/cursor/artifacts/screenshots', { recursive: true });
  await page.screenshot({
    path: `/opt/cursor/artifacts/screenshots/${name}.png`,
    fullPage: true,
  });
}

async function signIn(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Work email').fill('editor@example.test');
  await page.getByLabel('Password', { exact: true }).fill('length-ok');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /sample editor/i })).toBeVisible();
}

async function clientGo(page: Page, path: string) {
  await page.evaluate((next) => {
    window.history.pushState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

test('an editor adds founder, team, and partners for the about page', async ({ page }, info) => {
  await signIn(page);
  await clientGo(page, '/admin/people');
  await expect(page.getByRole('heading', { name: 'Our people' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Partners' })).toBeAttached();

  await addPerson(page, {
    group: 'Founder',
    name: 'Kwame Mensah',
    title: 'Founder',
    description: 'Started the Foundation in Accra.',
    photo: PORTRAIT,
  });
  await addPerson(page, {
    group: 'Team',
    name: 'Abena Owusu',
    title: 'Programme lead',
    photo: TEAM,
  });
  await addPerson(page, {
    group: 'Partners',
    name: 'Ama Boateng',
    title: 'Advisor',
    photo: PARTNER,
  });
  await expect(page.getByText('Could not save')).toHaveCount(0);
  await page.evaluate(() => {
    document.querySelectorAll('.toast').forEach((node) => node.remove());
  });
  await shot(page, `about-people-admin-${info.project.name}`);

  await clientGo(page, '/about');
  await expect(page.getByRole('heading', { name: 'Our People' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Founder' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Partners' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kwame Mensah' })).toBeVisible();
  await expect(page.getByText('Started the Foundation in Accra.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Abena Owusu' })).toBeVisible();
  await expect(page.getByText('Programme lead')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ama Boateng' })).toBeVisible();
  await page.evaluate(() => {
    document.querySelectorAll('.toast').forEach((node) => node.remove());
    const heading = document.getElementById('our-people');
    if (!heading) return;
    const top = heading.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo(0, Math.max(0, top));
  });
  await page.locator('#our-people').waitFor();
  await shot(page, `about-people-public-${info.project.name}`);
  await page.addStyleTag({
    content: 'header, .skip-link, .toast { visibility: hidden !important; }',
  });
  const section = page.locator('section').filter({ has: page.locator('#our-people') });
  await mkdir('/opt/cursor/artifacts/screenshots', { recursive: true });
  await section.screenshot({
    path: `/opt/cursor/artifacts/screenshots/about-people-section-${info.project.name}.png`,
  });
});

async function addPerson(
  page: Page,
  input: {
    group: string;
    name: string;
    title?: string;
    description?: string;
    photo?: string;
  },
) {
  await page.getByLabel(/^group/i).selectOption({ label: input.group });
  await page.getByLabel(/^name/i).fill(input.name);
  await page.getByLabel(/^title/i).fill(input.title ?? '');
  await page.getByLabel(/^description/i).fill(input.description ?? '');
  if (input.photo) await page.locator('#file').setInputFiles(input.photo);
  await page.getByLabel(/show on the about page/i).check();
  await page.getByRole('button', { name: 'Add person' }).click();
  await expect(page.locator('.mi-name', { hasText: input.name })).toBeVisible();
  await expect(page.getByText('Could not save')).toHaveCount(0);
}
