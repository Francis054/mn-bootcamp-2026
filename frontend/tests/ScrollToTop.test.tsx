import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RobotsMeta, ScrollToTop } from '@/components/ScrollToTop';
import { SiteHeader } from '@/components/SiteChrome';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function Pages() {
  const navigate = useNavigate();
  return (
    <>
      <ScrollToTop />
      <RobotsMeta />
      <button type="button" onClick={() => navigate(-1)}>Back</button>
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<><h1>Home</h1><a href="#intro">Intro</a><h2 id="intro">Intro heading</h2><Link to="/">Home link</Link><Link to="/about">About</Link><Link to="/about#team">Team</Link><Link to="/about#missing">Missing</Link></>} />
          <Route path="/about" element={<><h1>About</h1><h2 id="team">Team</h2><Link to="/">Home</Link></>} />
          <Route path="/admin/login" element={<h1>Sign in</h1>} />
        </Routes>
      </main>
    </>
  );
}

function renderAt(pathName = '/') {
  return render(
    <MemoryRouter initialEntries={[pathName]}>
      <Pages />
    </MemoryRouter>,
  );
}

describe('ScrollToTop', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    document.documentElement.classList.remove('is-nav-scroll');
    document.head.querySelector('meta[name="robots"]')?.remove();
  });

  it('scrolls to the top when the route changes and pins scroll while the page settles', async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    renderAt('/');
    scrollTo.mockClear();
    await user.click(screen.getByRole('link', { name: 'About' }));
    expect(await screen.findByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(document.documentElement.classList.contains('is-nav-scroll')).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('main')));
    scrollTo.mockRestore();
  });

  it('scrolls to the top when the current page link is clicked', async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    renderAt('/');
    scrollTo.mockClear();
    await user.click(screen.getByRole('link', { name: 'Home link' }));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(JSON.stringify(scrollTo.mock.calls)).not.toContain('smooth');
    scrollTo.mockRestore();
  });

  it('scrolls smoothly to the top of the open page when motion is allowed', async () => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    renderAt('/');
    scrollTo.mockClear();
    await user.click(screen.getByRole('link', { name: 'Home link' }));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0, behavior: 'smooth' }));
    scrollTo.mockRestore();
  });

  it('scrolls to a hash target and falls back to the top when the target is missing', async () => {
    const user = userEvent.setup();
    const intoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    renderAt('/');
    intoView.mockClear();
    await user.click(screen.getByRole('link', { name: 'Team' }));
    expect(await screen.findByRole('heading', { name: 'Team' })).toBeInTheDocument();
    expect(intoView).toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('team')));
    await user.click(screen.getByRole('link', { name: 'Home' }));
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    intoView.mockClear();
    scrollTo.mockClear();
    await user.click(screen.getByRole('link', { name: 'Missing' }));
    expect(await screen.findByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(intoView).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    intoView.mockRestore();
    scrollTo.mockRestore();
  });

  it('scrolls to the top when a navigation remounts the tree', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const first = renderAt('/');
    first.unmount();
    scrollTo.mockClear();
    renderAt('/about');
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(document.documentElement.classList.contains('is-nav-scroll')).toBe(true);
    scrollTo.mockRestore();
  });

  it('does not pull the page back to the top after the reader scrolls', async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    renderAt('/');
    await user.click(screen.getByRole('link', { name: 'About' }));
    expect(await screen.findByRole('heading', { name: 'About' })).toBeInTheDocument();
    scrollTo.mockClear();
    window.dispatchEvent(new Event('wheel'));
    document.body.appendChild(document.createElement('div'));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(scrollTo).not.toHaveBeenCalled();
    scrollTo.mockRestore();
  });

  it('starts at the top on back', async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    renderAt('/');
    await user.click(screen.getByRole('link', { name: 'About' }));
    expect(await screen.findByRole('heading', { name: 'About' })).toBeInTheDocument();
    scrollTo.mockClear();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockRestore();
  });

  it('closes the mobile menu on navigation, including the page already open', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    render(
      <MemoryRouter initialEntries={['/']}>
        <ScrollToTop />
        <SiteHeader page="home" tone="dark" />
        <main id="main" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<h1>Home</h1>} />
            <Route path="/trainees" element={<h1>Trainees</h1>} />
          </Routes>
        </main>
      </MemoryRouter>,
    );
    const toggle = screen.getByRole('button', { name: /open menu/i });
    await user.click(toggle);
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Home' }));
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('button', { name: /open menu/i })).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Trainees' }));
    expect(await screen.findByRole('heading', { name: 'Trainees' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('button', { name: /open menu/i })).toHaveAttribute('aria-expanded', 'false');
    vi.mocked(window.scrollTo).mockRestore();
  });

  it('marks admin routes noindex and public routes indexable', async () => {
    const first = renderAt('/');
    await waitFor(() => expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow'));
    first.unmount();
    renderAt('/admin/login');
    await waitFor(() => expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow'));
  });
});

describe('crawl files', () => {
  it('does not advertise the admin panel', () => {
    const robots = readFileSync(path.join(root, 'public/robots.txt'), 'utf8');
    expect(robots.toLowerCase()).not.toContain('admin');
    const html = readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(html).toContain('noindex, nofollow');
    expect(html).not.toMatch(/admin portal|staff login/i);
    expect(html.toLowerCase()).not.toContain('application/ld+json');
    for (const name of readdirSync(path.join(root, 'public'))) {
      if (!/sitemap|robots/i.test(name)) continue;
      const text = readFileSync(path.join(root, 'public', name), 'utf8').toLowerCase();
      expect(text, name).not.toContain('admin');
      expect(text, name).not.toContain('staff login');
    }
  });
});
