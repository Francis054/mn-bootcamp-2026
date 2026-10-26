import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function bootDone(page: Page) {
  await expect(page.locator('.boot-screen')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator('#boot')).toHaveCount(0);
}

async function revealHeader(page: Page) {
  await page.evaluate(() => {
    // A gesture ends the navigation settle, which otherwise keeps the new page at the top.
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 40 }));
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.max(max, 900));
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(640);
  // The bar hides on the way down and stays hidden near the bottom. Scroll back
  // above that threshold so the links can be clicked, while still leaving the page offset.
  await page.evaluate(() => window.scrollTo(0, 480));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  await expect(page.locator('header.site-header')).not.toHaveClass(/is-hidden/, { timeout: 5_000 });
}

async function expectTop(page: Page) {
  await expect(page.locator('main h1, main h2').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect.poll(() => page.evaluate(() => document.getElementById('main')?.scrollTop ?? 0)).toBe(0);
}

async function fromBottomOfHome(page: Page) {
  const path = new URL(page.url()).pathname;
  if (path !== '/') {
    await page.locator('header a.lockup').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /secure the future/i })).toBeVisible();
  }
  await revealHeader(page);
}

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== 'desktop', 'This spec sets 1440×900 and 390×844 itself.');
});

test('public navigation starts at the top', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await bootDone(page);
  await expect(page.getByRole('heading', { name: /secure the future/i })).toBeVisible();
  const hrefs = await page.locator('a').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? ''));
  expect(hrefs.filter((href) => href === '/admin' || href.startsWith('/admin/'))).toEqual([]);

  const primary = page.getByRole('navigation', { name: 'Primary' });
  const visits: Array<{ name: string | RegExp; url: RegExp; exact?: boolean }> = [
    { name: 'Trainees', url: /\/trainees$/, exact: true },
    { name: 'Events', url: /\/events$/, exact: true },
    { name: 'Gallery', url: /\/gallery$/, exact: true },
    { name: '10 Years', url: /\/anniversary$/ },
    { name: 'About', url: /\/about$/, exact: true },
  ];
  for (const visit of visits) {
    await fromBottomOfHome(page);
    await primary.getByRole('link', { name: visit.name, exact: visit.exact }).click();
    await expect(page).toHaveURL(visit.url);
    await expectTop(page);
  }

  const menuVisits: Array<{ name: RegExp; url: RegExp }> = [
    { name: /^Overview/, url: /\/bootcamp$/ },
    { name: /^Schedule/, url: /\/schedule$/ },
    { name: /Three-month journey/, url: /\/journey$/ },
    { name: /Class archive/, url: /\/classes$/ },
    { name: /Projects & labs/, url: /\/projects$/ },
  ];
  for (const visit of menuVisits) {
    await fromBottomOfHome(page);
    await page.getByRole('button', { name: 'Bootcamp', exact: true }).hover();
    await page.getByRole('menuitem', { name: visit.name }).click();
    await expect(page).toHaveURL(visit.url);
    await expectTop(page);
  }

  await fromBottomOfHome(page);
  await page.getByRole('link', { name: /follow the cohort/i }).click();
  await expect(page).toHaveURL(/\/journey$/);
  await expectTop(page);

  await fromBottomOfHome(page);
  await page.locator('footer').getByRole('link', { name: 'Contact page' }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await expectTop(page);

  await fromBottomOfHome(page);
  await page.locator('header a.lockup').click();
  await expect(page).toHaveURL(/\/$/);
  await expectTop(page);

  await revealHeader(page);
  await primary.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expectTop(page);

  await fromBottomOfHome(page);
  await primary.getByRole('link', { name: 'About', exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expectTop(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expectTop(page);

  await revealHeader(page);
  await page.locator('a.scroll-cue').click();
  await expect.poll(async () => page.locator('#intro').evaluate((el) => el.getBoundingClientRect().top)).toBeLessThan(160);
  await expect.poll(async () => page.locator('#intro').evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThan(-8);
});

test('mobile menu navigation starts at the top', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await bootDone(page);
  await expect(page.getByRole('heading', { name: /secure the future/i })).toBeVisible();

  const links = ['Home', 'Overview', 'Schedule', 'Three-month journey', 'Class archive', 'Projects & labs', 'Trainees', 'Events', 'Gallery', '10 Years', 'About'];
  for (const name of links) {
    if (name !== 'Home') {
      await page.locator('header a.lockup').click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: /secure the future/i })).toBeVisible();
    }
    await revealHeader(page);
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(200);
    await page.getByRole('button', { name: /open menu/i }).click();
    await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('button', { name: /open menu/i })).toHaveAttribute('aria-expanded', 'false');
    if (name === 'Home') await expect(page).toHaveURL(/\/$/);
    await expectTop(page);
  }

  await revealHeader(page);
  await page.locator('footer').getByRole('link', { name: 'Overview' }).click();
  await expect(page).toHaveURL(/\/bootcamp$/);
  await expectTop(page);
});

test('admin navigation starts at the top', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/login');
  await bootDone(page);
  await page.getByLabel('Work email').fill('administrator@example.test');
  await page.getByLabel('Password', { exact: true }).fill('length-ok');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /sample administrator/i })).toBeVisible();
  await page.addStyleTag({ content: 'main#main{min-height:3200px !important}' });

  const nav = page.getByRole('navigation', { name: 'Admin' });
  for (const name of ['Classes', 'Trainees', 'Projects']) {
    await page.evaluate(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 40 }));
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/${name.toLowerCase()}$`));
    await expectTop(page);
  }

  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 40 }));
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  await page.getByRole('link', { name: 'View public site' }).click();
  await expect(page).toHaveURL(/\/$/);
  await bootDone(page);
  await expectTop(page);
});
