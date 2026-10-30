import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const PASSWORD = 'Correct-horse-1';
const YOUTUBE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

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

test('trainee portfolio editor, admin review, and the public profile', async ({ page }, info) => {
  const suffix = info.project.name;
  await page.goto('/signup');
  await page.locator('.boot-screen').waitFor({ state: 'detached' });
  await page.getByLabel('Name').fill('Portfolio Person');
  await page.getByLabel('Email').fill('trainee05@example.test');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox', { name: /creating a trainee account/i }).check();
  await page.getByRole('button', { name: /create account/i }).click();
  await page.getByRole('link', { name: /development confirmation link/i }).click();
  await page.getByRole('link', { name: /trainee sign in/i }).click();
  await page.getByLabel('Email').fill('trainee05@example.test');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /hello, portfolio person/i })).toBeVisible();

  await page.getByRole('textbox', { name: 'Headline', exact: true }).fill('Aspiring SOC analyst');
  await page.getByRole('textbox', { name: 'Short bio', exact: true }).fill('I am learning detection and response.');
  await page.getByRole('checkbox', { name: /name, headline/i }).check();
  await page.getByRole('checkbox', { name: /profile photo/i }).check();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.getByText('Pending review').first()).toBeVisible();

  await page.getByRole('button', { name: 'Add a portfolio item' }).click();
  await page.getByLabel('Kind').selectOption('lab');
  await page.getByLabel('Title').fill('Packet capture lab');
  await page.getByLabel('Summary or write-up').fill('A write-up of a lab on an isolated network.');
  await page.getByLabel('Skills or tools').fill('Wireshark, tcpdump');
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByText(/Saved/)).toBeVisible();
  await page.getByLabel('Video link').fill(YOUTUBE);
  await page.getByRole('button', { name: 'Add video link' }).click();
  await expect(page.getByText(/Video link saved/)).toBeVisible();
  await page.getByRole('button', { name: 'Submit item for review' }).click();
  await expect(page.getByText('Pending review').last()).toBeVisible();
  await page.waitForFunction(() => document.querySelector('.boot-screen') === null);
  await shot(page, `portfolio-editor-${suffix}`);

  await page.getByRole('button', { name: /log out/i }).click();
  await clientGo(page, '/admin/login');
  await page.getByLabel('Work email').fill('administrator@example.test');
  await page.getByLabel('Password', { exact: true }).fill('length-ok');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /sign in/i }).click();
  await clientGo(page, '/admin/review');
  await expect(page.getByRole('heading', { name: /review queue/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Portfolio items' })).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('Packet capture lab');
  await page.waitForFunction(() => document.querySelector('.boot-screen') === null);
  await shot(page, `portfolio-review-${suffix}`);
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByRole('button', { name: 'Approve item' }).click();
  await expect(page.getByText('Nothing is waiting')).toBeVisible();

  await clientGo(page, '/trainees/5');
  await page.getByRole('tab', { name: 'Work' }).click();
  await expect(page.getByRole('heading', { name: 'Packet capture lab' })).toBeVisible();
  await expect(page.locator('iframe.portfolio-frame')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  const hrefs = await page.locator('a').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''));
  expect(hrefs.filter((href) => href === '/admin' || href.startsWith('/admin/'))).toEqual([]);
  await page.waitForFunction(() => document.querySelector('.boot-screen') === null);
  await shot(page, `portfolio-public-${suffix}`);
  if (suffix === 'desktop') {
    await page.setViewportSize({ width: 768, height: 1024 });
    await shot(page, 'portfolio-public-tablet');
  }
});
