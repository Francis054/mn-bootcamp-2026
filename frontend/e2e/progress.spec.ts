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

test('skills, events, review, and the public profile', async ({ page }, info) => {
  test.setTimeout(60_000);
  const suffix = info.project.name;
  await page.goto('/signup');
  await page.locator('.boot-screen').waitFor({ state: 'detached' });
  await page.getByLabel('Name').fill('Progress Person');
  await page.getByLabel('Email').fill('trainee06@example.test');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox', { name: /creating a trainee account/i }).check();
  await page.getByRole('button', { name: /create account/i }).click();
  await page.getByRole('link', { name: /development confirmation link/i }).click();
  await page.getByRole('link', { name: /trainee sign in/i }).click();
  await page.getByLabel('Email').fill('trainee06@example.test');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /hello, progress person/i })).toBeVisible();

  await page.getByRole('textbox', { name: 'Headline', exact: true }).fill('Aspiring detection analyst');
  await page.getByRole('textbox', { name: 'Short bio', exact: true }).fill('I am learning to explain what I practised.');
  await page.getByRole('checkbox', { name: /name, headline/i }).check();
  await page.getByRole('checkbox', { name: /profile photo/i }).check();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.getByText('Pending review').first()).toBeVisible();

  await page.getByRole('button', { name: 'Add a portfolio item' }).click();
  await page.getByLabel('Kind').selectOption('case_study');
  await page.getByLabel('Title').fill('Detection case study');
  await page.getByLabel('Summary or write-up').fill('A case study of an authorised lab investigation.');
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByText(/Saved/)).toBeVisible();
  await page.getByRole('button', { name: 'Submit item for review' }).click();
  await expect(page.getByText('An administrator still has to approve this version.').last()).toBeVisible();

  const skills = page.locator('#skills-editor');
  await skills.getByRole('button', { name: 'Add a skill' }).click();
  await skills.getByLabel('Skill', { exact: true }).fill('Packet analysis');
  await skills.getByLabel('Level').selectOption('3');
  await skills.getByLabel('Evidence').selectOption({ label: 'Case study: Detection case study' });
  await skills.getByRole('button', { name: 'Save skill' }).click();
  await expect(skills.getByText(/Saved\. Submit it when you want a review/)).toBeVisible();
  await skills.getByRole('button', { name: 'Submit skill for review' }).click();
  await expect(skills.getByText('Pending review')).toBeVisible();

  const events = page.locator('#events-editor');
  await events.getByRole('button', { name: 'Add an event' }).click();
  await events.getByLabel('Title', { exact: true }).fill('Accra weekend CTF');
  await events.getByLabel('Date').fill('2026-11-02');
  await events.getByLabel('Organiser').fill('Accra Sec');
  await events.getByLabel('Link').fill('https://example.com/ctf');
  await events.getByRole('button', { name: 'Save event' }).click();
  await events.getByRole('button', { name: 'Submit event for review' }).click();
  await expect(page.getByRole('heading', { name: 'Accra weekend CTF' })).toBeVisible();
  await page.waitForFunction(() => document.querySelector('.boot-screen') === null);
  await shot(page, `progress-editor-${suffix}`);

  await page.getByRole('button', { name: /log out/i }).click();
  await clientGo(page, '/admin/login');
  await page.getByLabel('Work email').fill('administrator@example.test');
  await page.getByLabel('Password', { exact: true }).fill('length-ok');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /sign in/i }).click();
  await clientGo(page, '/admin/review');
  await expect(page.getByRole('heading', { name: /review queue/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Events attended' })).toBeVisible();
  await page.waitForFunction(() => document.querySelector('.boot-screen') === null);
  await shot(page, `progress-review-${suffix}`);
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByRole('button', { name: 'Approve item' }).click();
  await page.getByRole('button', { name: 'Approve skill' }).click();
  await page.getByRole('button', { name: 'Approve event' }).click();
  await expect(page.getByText('Nothing is waiting')).toBeVisible();

  await clientGo(page, '/trainees/6');
  await page.getByRole('tab', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Packet analysis' })).toBeVisible();
  await expect(page.getByText('Confident')).toBeVisible();
  await expect(page.getByText(/Detection case study/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Accra weekend CTF' })).toBeVisible();
  await expect(page.getByText(/Accra Sec/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Event link' })).toHaveAttribute('href', 'https://example.com/ctf');
  const hrefs = await page.locator('a').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''));
  expect(hrefs.filter((href) => href === '/admin' || href.startsWith('/admin/'))).toEqual([]);
  await page.waitForFunction(() => document.querySelector('.boot-screen') === null);
  await shot(page, `progress-public-${suffix}`);
  if (suffix === 'desktop') {
    await page.setViewportSize({ width: 768, height: 1024 });
    await shot(page, 'progress-public-tablet');
  }
});
