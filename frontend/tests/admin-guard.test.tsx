import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { ToastProvider } from '@/components/feedback';
import { App } from '@/App';
import { clearSession, rememberSignedIn, setSession } from '@/dev/session';
import type { Role, SessionUser } from '@/domain/types';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

function user(role: Role): SessionUser {
  return {
    id: `guard-${role}`,
    email: `${role}@example.test`,
    displayName: `Sample ${role}`,
    initials: 'SR',
    hue: 140,
    role,
  };
}

function signInAs(role: Role) {
  act(() => {
    rememberSignedIn(user(role), Date.now() + 60_000);
  });
}

function signInAsFixtureAdmin() {
  act(() => {
    setSession({
      mode: 'development',
      user: {
        id: 'dev-admin',
        email: 'administrator@example.test',
        displayName: 'Sample Administrator',
        initials: 'SA',
        hue: 140,
        role: 'administrator',
      },
      expiresAt: Date.now() + 60_000,
    });
  });
}

describe('admin shell guard', () => {
  afterEach(() => {
    act(() => {
      clearSession();
    });
  });

  it('sends a trainee away from the trainee list', async () => {
    signInAs('trainee');
    renderAt('/admin/trainees');
    expect(await screen.findByRole('heading', { name: /have access to that screen/i })).toBeInTheDocument();
    expect(screen.queryByText('trainee01@example.test')).not.toBeInTheDocument();
  });

  it('sends a trainer away from the media library', async () => {
    signInAs('trainer');
    renderAt('/admin/media');
    expect(await screen.findByRole('heading', { name: /have access to that screen/i })).toBeInTheDocument();
  });

  it('lets a viewer, an editor, and an administrator open the admin shell', async () => {
    for (const role of ['viewer', 'editor', 'administrator'] as const) {
      act(() => {
        clearSession();
      });
      signInAs(role);
      const view = renderAt('/admin');
      expect(await screen.findByRole('heading', { name: new RegExp(`Sample ${role}`) })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /have access to that screen/i })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it('sends an editor away from users', async () => {
    signInAs('editor');
    renderAt('/admin/users');
    expect(await screen.findByRole('heading', { name: /have access to that screen/i })).toBeInTheDocument();
  });

  it('sends an editor away from settings', async () => {
    signInAs('editor');
    renderAt('/admin/settings');
    expect(await screen.findByRole('heading', { name: /have access to that screen/i })).toBeInTheDocument();
  });

  it('lets an administrator open users', async () => {
    signInAsFixtureAdmin();
    renderAt('/admin/users');
    expect(await screen.findByRole('heading', { name: 'Users and roles' })).toBeInTheDocument();
  });

  it('lets an administrator open settings', async () => {
    signInAsFixtureAdmin();
    renderAt('/admin/settings');
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });
});
