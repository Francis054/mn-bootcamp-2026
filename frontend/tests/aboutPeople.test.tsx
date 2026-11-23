import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { api } from '@/api/client';
import { AuthProvider } from '@/auth/AuthProvider';
import { ConfirmProvider, ToastProvider } from '@/components/feedback';
import { aboutPersonFieldErrors, normalizePublicAboutPeople } from '@/domain/aboutPeople';
import { setSession } from '@/dev/session';
import { updateState } from '@/dev/store';

const TINY_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

function signIn(role: 'editor' | 'viewer') {
  const people = {
    editor: {
      id: 'dev-editor',
      email: 'editor@example.test',
      displayName: 'Sample Editor',
      initials: 'SE',
      hue: 60,
      role: 'editor' as const,
    },
    viewer: {
      id: 'dev-viewer',
      email: 'viewer@example.test',
      displayName: 'Sample Viewer',
      initials: 'SV',
      hue: 190,
      role: 'viewer' as const,
    },
  };
  setSession({
    mode: 'development',
    user: people[role],
    expiresAt: Date.now() + 60_000,
  });
}

describe('about people', () => {
  it('treats the description as optional and keeps an unsafe photo address off the page', () => {
    expect(
      aboutPersonFieldErrors({
        group: 'partner',
        name: 'Ama Boateng',
        title: '',
        description: '',
        file: null,
      }),
    ).toEqual({});
    expect(
      aboutPersonFieldErrors({
        group: 'team',
        name: '',
        title: '',
        description: '',
      }).name,
    ).toBe('Enter a name.');
    const [person] = normalizePublicAboutPeople([
      {
        id: '1',
        group: 'partner',
        name: 'Ama Boateng',
        description: '',
        photoUrl: 'javascript:alert(1)',
      },
      { id: '2', group: 'supporter', name: 'Old label' },
    ]);
    expect(person?.group).toBe('partner');
    expect(person?.description).toBe('');
    expect(person?.photoUrl).toBeNull();
    expect(
      normalizePublicAboutPeople([{ id: '2', group: 'supporter', name: 'Old label' }]),
    ).toEqual([]);
  });

  it('lets an editor save a partner without a description and refuses a viewer', async () => {
    signIn('editor');
    const created = await api<{
      id: string;
      group: string;
      description: string;
      published: boolean;
      photoUrl: string | null;
    }>({
      method: 'POST',
      path: '/admin/about-people',
      body: { group: 'partner', name: 'Ama Boateng', published: true },
    });
    expect(created.group).toBe('partner');
    expect(created.description).toBe('');
    expect(created.published).toBe(true);
    const file = new File([TINY_PNG], 'portrait.png', { type: 'image/png' });
    const body = new FormData();
    body.set('file', file);
    const withPhoto = await api<{ photoUrl: string | null }>({
      method: 'POST',
      path: `/admin/about-people/${created.id}/photo`,
      body,
    });
    expect(withPhoto.photoUrl?.startsWith('data:image/png;base64,')).toBe(true);

    const visible = await api<Array<{ name: string; group: string }>>({
      method: 'GET',
      path: '/public/about-people',
    });
    expect(visible.map((person) => person.name)).toEqual(['Ama Boateng']);

    await api({
      method: 'PATCH',
      path: `/admin/about-people/${created.id}`,
      body: { published: false },
    });
    expect(await api({ method: 'GET', path: '/public/about-people' })).toEqual([]);

    signIn('viewer');
    await expect(
      api({
        method: 'POST',
        path: '/admin/about-people',
        body: { group: 'team', name: 'Kojo' },
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await api<unknown[]>({ method: 'GET', path: '/admin/about-people' })).toHaveLength(1);
  });

  it('orders founder, team, then partners', async () => {
    signIn('editor');
    await api({
      method: 'POST',
      path: '/admin/about-people',
      body: { group: 'partner', name: 'Partner One', published: true },
    });
    await api({
      method: 'POST',
      path: '/admin/about-people',
      body: { group: 'founder', name: 'Founder One', published: true },
    });
    await api({
      method: 'POST',
      path: '/admin/about-people',
      body: { group: 'team', name: 'Team One', published: true },
    });
    const visible = await api<Array<{ group: string }>>({
      method: 'GET',
      path: '/public/about-people',
    });
    expect(visible.map((person) => person.group)).toEqual(['founder', 'team', 'partner']);
  });
});

describe('about people pages', () => {
  it('hides the public section when nobody is published', async () => {
    renderAt('/about');
    expect(await screen.findByRole('heading', { name: /maximal wisdom/i })).toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByRole('heading', { name: 'Our People' })).not.toBeInTheDocument();
    expect(screen.queryByText(/no people/i)).not.toBeInTheDocument();
  });

  it('shows founder, team, and partners, and skips an empty description', async () => {
    updateState((state) => ({
      ...state,
      aboutPeople: [
        {
          id: 'p1',
          group: 'partner',
          name: 'Ama Boateng',
          title: 'Advisor',
          description: '',
          photoUrl: null,
          width: 0,
          height: 0,
          displayOrder: 0,
          published: true,
        },
        {
          id: 'f1',
          group: 'founder',
          name: 'Kwame Mensah',
          title: 'Founder',
          description: 'Started the Foundation in Accra.',
          photoUrl: null,
          width: 0,
          height: 0,
          displayOrder: 0,
          published: true,
        },
        {
          id: 't1',
          group: 'team',
          name: 'Abena Owusu',
          title: '',
          description: '',
          photoUrl: null,
          width: 0,
          height: 0,
          displayOrder: 0,
          published: true,
        },
        {
          id: 'draft',
          group: 'team',
          name: 'Hidden Person',
          title: '',
          description: 'Should stay off the page.',
          photoUrl: null,
          width: 0,
          height: 0,
          displayOrder: 1,
          published: false,
        },
      ],
    }));
    renderAt('/about');
    expect(await screen.findByRole('heading', { name: 'Our People' })).toBeInTheDocument();
    const founder = screen.getByRole('heading', { name: 'Founder' });
    const team = screen.getByRole('heading', { name: 'Team' });
    const partners = screen.getByRole('heading', { name: 'Partners' });
    expect(founder.compareDocumentPosition(team) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(team.compareDocumentPosition(partners) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Kwame Mensah' })).toBeInTheDocument();
    expect(screen.getByText('Started the Foundation in Accra.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Abena Owusu' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ama Boateng' })).toBeInTheDocument();
    expect(screen.getByText('Advisor')).toBeInTheDocument();
    expect(screen.queryByText('Should stay off the page.')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden Person')).not.toBeInTheDocument();
  });

  it('saves from the admin page without an error toast when the description is left blank', async () => {
    signIn('editor');
    const user = userEvent.setup();
    renderAt('/admin/people');
    expect(await screen.findByRole('heading', { name: 'Our people' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Our people' })).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).not.toBeRequired();
    expect(screen.getByRole('option', { name: 'Partners' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Supporters' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Friends of the Foundation' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add person' }));
    expect(await screen.findByText('Enter a name.')).toBeInTheDocument();
    expect(screen.queryByText('Could not save')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^group/i), 'partner');
    await user.type(screen.getByLabelText(/^name/i), 'Ama Boateng');
    await user.click(screen.getByRole('button', { name: 'Add person' }));
    expect(await screen.findByText('Person saved')).toBeInTheDocument();
    expect(screen.queryByText('Could not save')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Partners' })).toBeInTheDocument();
    expect(screen.getByText('Ama Boateng')).toBeInTheDocument();
  });

  it('lets a viewer read the list and keeps the write controls hidden', async () => {
    updateState((state) => ({
      ...state,
      aboutPeople: [
        {
          id: 'f1',
          group: 'founder',
          name: 'Kwame Mensah',
          title: '',
          description: '',
          photoUrl: null,
          width: 0,
          height: 0,
          displayOrder: 0,
          published: false,
        },
      ],
    }));
    signIn('viewer');
    renderAt('/admin/people');
    expect(await screen.findByRole('heading', { name: 'Our people' })).toBeInTheDocument();
    expect(screen.getByText('Kwame Mensah')).toBeInTheDocument();
    expect(screen.getByText(/an editor or an administrator can add/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add person' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
  });
});
