import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/auth/AuthProvider';
import { RoutedBoundary } from '@/components/RouteErrorBoundary';
import { ToastProvider } from '@/components/feedback';
import { setEnvForTests } from '@/config/runtime';
import { normalizeEvents, normalizeLessons, normalizeProjects, normalizeTrainees } from '@/domain/publicContract';
import { App } from '@/App';

const LIVE = { apiMode: 'live' as const, apiBaseUrl: '', authMode: 'development' as const, sessionTtlMs: 1_800_000 };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const PUBLIC = [
  '/',
  '/bootcamp',
  '/journey',
  '/classes',
  '/classes/missing-lesson',
  '/projects',
  '/projects/missing-project',
  '/trainees',
  '/trainees/missing-trainee',
  '/events',
  '/events/missing-event',
  '/gallery',
  '/about',
  '/anniversary',
  '/contact',
  '/this-page-does-not-exist',
];

const ADMIN = [
  '/admin/login',
  '/admin/forgot-password',
  '/admin/reset-password',
  '/admin/session-expired',
  '/admin/forbidden',
  '/admin',
  '/admin/classes',
  '/admin/classes/new',
  '/admin/trainees',
  '/admin/projects',
  '/admin/events',
  '/admin/media',
  '/admin/content',
  '/admin/timeline',
  '/admin/about',
  '/admin/account',
  '/admin/states',
  '/admin/users',
  '/admin/enquiries',
  '/admin/settings',
];

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <RoutedBoundary>
          <AuthProvider>
            <App />
          </AuthProvider>
        </RoutedBoundary>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('public contract normaliser', () => {
  it('fills missing arrays so a partial row cannot crash a page', () => {
    const lessons = normalizeLessons([{ id: 'c1', title: 'Packets' }]);
    const projects = normalizeProjects([{ id: 'p1', title: 'Lab' }]);
    const trainees = normalizeTrainees([{ id: 't1', displayName: 'Sample Person' }]);
    const events = normalizeEvents([{ id: 'e1', title: 'Open day' }]);
    expect(lessons[0]?.objectives).toEqual([]);
    expect(projects[0]?.steps).toEqual([]);
    expect(projects[0]?.team).toEqual([]);
    expect(trainees[0]?.skills).toEqual([]);
    expect(events[0]?.body.kind).toBe('placeholder');
    expect(normalizeLessons({ not: 'a list' })).toEqual([]);
  });
});

describe('live API routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders every public route against the empty hosted contract', async () => {
    setEnvForTests(LIVE);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/session')) return json({ authenticated: false });
      if (url.includes('/public/home') || url.includes('/public/about')) {
        return json({ error: { code: 'not_found', message: 'Content not found.' } }, 404);
      }
      if (url.includes('/public/')) return json([]);
      return json({ error: { code: 'not_found', message: 'Not found.' } }, 404);
    }));
    for (const path of PUBLIC) {
      const view = renderAt(path);
      await waitFor(() => {
        expect(document.body.textContent?.trim().length ?? 0).toBeGreaterThan(20);
      });
      expect(screen.queryByRole('heading', { name: /this page hit a problem/i })).not.toBeInTheDocument();
      view.unmount();
    }
    expect(screen.queryByText(/this page hit a problem/i)).not.toBeInTheDocument();
  });

  it('renders partial published rows without throwing', async () => {
    setEnvForTests(LIVE);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/session')) return json({ authenticated: false });
      if (url.includes('/public/home')) {
        return json({ headline: 'Learn.\nBuild.\n*Secure the Future.*', lead: 'A free bootcamp.', eyebrow: '2026' });
      }
      if (url.includes('/public/about')) return json({ error: { code: 'not_found', message: 'Content not found.' } }, 404);
      if (url.includes('/public/classes')) return json([{ id: 'c1', title: 'Packets', week: 1, moduleId: 'network', date: '2026-10-05', scheduleStatus: 'now', listing: 'public' }]);
      if (url.includes('/public/projects')) return json([{ id: 'p1', title: 'Isolated lab', type: 'Lab', moduleId: 'network', abstract: 'Practice only.', listing: 'public' }]);
      if (url.includes('/public/trainees')) return json([{ id: 't1', displayName: 'Sample Person', initials: 'SP', hue: 140, track: 'Blue team', focus: 'network', listing: 'public', statusLabel: 'In training' }]);
      if (url.includes('/public/events')) return json([{ id: 'e1', title: 'Open day', date: '2026-10-05', whenLabel: 'Morning', place: 'Accra', kind: 'Milestone', summary: 'A published milestone with no body yet.', listing: 'public' }]);
      if (url.includes('/public/media')) return json([{ id: 'm1', caption: 'A photo', alt: 'A photo', album: 'community' }]);
      if (url.includes('/public/')) return json([]);
      return json({ error: { code: 'not_found', message: 'Not found.' } }, 404);
    }));
    for (const path of ['/', '/classes/c1', '/projects/p1', '/trainees/t1', '/events/e1', '/gallery']) {
      const view = renderAt(path);
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /this page hit a problem/i })).not.toBeInTheDocument();
        expect(document.body.textContent?.trim().length ?? 0).toBeGreaterThan(20);
      });
      view.unmount();
    }
  });

  it('shows a stored profile photo on the home card and the public profile', async () => {
    setEnvForTests(LIVE);
    const photo = 'https://res.cloudinary.com/demo/image/upload/v1/mn/photo.jpg';
    const trainee = {
      id: 't1',
      displayName: 'Sample Person',
      initials: 'SP',
      hue: 140,
      track: 'Blue team',
      focus: 'network',
      listing: 'public',
      statusLabel: 'In training',
      photoUrl: photo,
    };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/session')) return json({ authenticated: false });
      if (url.includes('/public/home')) {
        return json({ headline: 'Learn.\nBuild.\n*Secure the Future.*', lead: 'A free bootcamp.', eyebrow: '2026' });
      }
      if (url.includes('/public/about')) {
        return json({ error: { code: 'not_found', message: 'Content not found.' } }, 404);
      }
      if (url.includes('/public/trainees')) return json([trainee]);
      if (url.includes('/public/')) return json([]);
      return json({ error: { code: 'not_found', message: 'Not found.' } }, 404);
    }));

    const home = renderAt('/');
    const card = await screen.findByRole('link', { name: /Sample Person/ });
    expect(within(card).getByRole('img', { name: 'Sample Person' })).toHaveAttribute('src', photo);
    expect(within(card).queryByText('Placeholder')).not.toBeInTheDocument();
    home.unmount();

    renderAt('/trainees/t1');
    expect(await screen.findByRole('img', { name: 'Sample Person' })).toHaveAttribute('src', photo);
    expect(screen.queryByText('Placeholder portrait')).not.toBeInTheDocument();
  });

  it('sends every admin route to a visible gate when the session is anonymous', async () => {
    setEnvForTests(LIVE);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/session')) return json({ authenticated: false });
      return json({ error: { code: 'unauthenticated', message: 'Sign in to continue.' } }, 401);
    }));
    for (const path of ADMIN) {
      const view = renderAt(path);
      await waitFor(() => {
        expect(document.body.textContent?.trim().length ?? 0).toBeGreaterThan(10);
      });
      expect(screen.queryByRole('heading', { name: /this page hit a problem/i })).not.toBeInTheDocument();
      view.unmount();
    }
  });
});
