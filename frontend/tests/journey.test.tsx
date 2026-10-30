import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { api } from '@/api/client';
import { App } from '@/App';
import { AuthProvider } from '@/auth/AuthProvider';
import { ToastProvider } from '@/components/feedback';
import { readJourney } from '@/domain/journey';
import { getState, updateState } from '@/dev/store';

const PASSWORD = 'Correct-horse-1';

describe('journey privacy', () => {
  it('drops private milestones, drafts, and email addresses from a public read', () => {
    const body = readJourney({
      displayName: 'Ama Mensah',
      slug: 'ama-mensah',
      email: 'secret@example.test',
      cv: { available: true },
      internalNotes: 'staff only',
      items: [
        {
          id: 'open',
          kind: 'milestone',
          title: 'Open house talk',
          summary: 'A public note.',
          occurredOn: '2026-10-15',
          visibility: 'public',
          state: 'recorded',
          href: '/schedule?week=1',
          blockId: null,
          deliverables: [],
          editable: false,
        },
        {
          id: 'quiet',
          kind: 'milestone',
          title: 'Quiet checkpoint',
          summary: 'secret@example.test',
          occurredOn: '2026-10-16',
          visibility: 'private',
          state: 'recorded',
          href: '/admin/trainees',
          blockId: null,
          deliverables: [],
          editable: true,
        },
        {
          id: 'draft-lab',
          kind: 'lab',
          title: 'Draft lab secret',
          summary: 'Not approved.',
          occurredOn: '2026-10-18',
          visibility: 'private',
          state: 'recorded',
          href: null,
          blockId: null,
          deliverables: [],
          editable: false,
        },
      ],
    }, 'public');
    expect(body.items.map((item) => item.title)).toEqual(['Open house talk']);
    expect(body.items[0]?.href).toBe('/schedule?week=1');
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('secret@example.test');
    expect(serialized).not.toContain('Quiet checkpoint');
    expect(serialized).not.toContain('Draft lab secret');
    expect(serialized).not.toContain('/admin');
    expect(serialized).not.toContain('internalNotes');
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('cv');
  });

  it('keeps a private milestone off the public journey and names the missing fields', async () => {
    const user = userEvent.setup();
    const signup = await api<{ developmentVerifyPath: string }>({
      method: 'POST',
      path: '/public/trainee-signup',
      body: { email: 'trainee03@example.test', password: PASSWORD, confirm: PASSWORD, acceptTerms: true },
    });
    await api({ method: 'POST', path: '/public/trainee-signup/verify', body: { token: new URL(`http://localhost${signup.developmentVerifyPath}`).searchParams.get('token') } });
    await api({ method: 'POST', path: '/auth/login', body: { email: 'trainee03@example.test', password: PASSWORD, developmentAck: true } });
    const me = await api<{ traineeId: string }>({ method: 'GET', path: '/portal/me' });
    updateState((current) => ({
      ...current,
      trainees: current.trainees.map((item) => item.id === me.traineeId
        ? { ...item, consentReceived: true, publicationStatus: 'published', listing: 'public', slug: 'sample-journey' }
        : item),
    }));
    await api({
      method: 'POST',
      path: '/portal/journey/milestones',
      body: { title: 'Quiet checkpoint', occurredOn: '2026-10-15', visibility: 'private', summary: 'A private note.' },
    });
    await api({
      method: 'POST',
      path: '/portal/journey/milestones',
      body: { title: 'Open house talk', occurredOn: '2026-10-16', visibility: 'public' },
    });
    const portal = await api<unknown>({ method: 'GET', path: '/portal/journey' });
    expect(JSON.stringify(portal)).toContain('Quiet checkpoint');
    expect(JSON.stringify(portal)).not.toContain('trainee03@example.test');
    const pub = await api<unknown>({ method: 'GET', path: '/public/trainees/sample-journey/journey' });
    const parsed = readJourney(pub, 'public');
    expect(parsed.items.some((item) => item.title === 'Open house talk')).toBe(true);
    expect(parsed.items.some((item) => item.title === 'Quiet checkpoint')).toBe(false);
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toContain('Quiet checkpoint');
    expect(serialized).not.toContain('trainee03@example.test');
    expect(serialized).not.toContain(getState().trainees.find((item) => item.id === me.traineeId)?.email ?? 'missing-email');

    render(
      <MemoryRouter initialEntries={['/portal/journey']}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: /milestones you add/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add milestone' }));
    const titleLink = await screen.findByRole('link', { name: 'Title' });
    expect(titleLink).toHaveAttribute('href', '#milestone-title');
    expect(screen.getByRole('link', { name: 'Date' })).toHaveAttribute('href', '#milestone-date');
    expect(screen.getByRole('link', { name: 'Who can see it' })).toHaveAttribute('href', '#milestone-visibility');
    expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
    expect(document.querySelector('#milestone-title')?.closest('.field')?.textContent).toMatch(/\*/);
  });
});
