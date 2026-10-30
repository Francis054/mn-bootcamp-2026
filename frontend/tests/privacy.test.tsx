import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { AuthProvider } from '@/auth/AuthProvider';
import { ConfirmProvider, ToastProvider } from '@/components/feedback';
import { setSession } from '@/dev/session';

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

function signIn(role: 'administrator' | 'editor') {
  const id = role === 'administrator' ? 'dev-admin' : 'dev-editor';
  setSession({
    mode: 'development',
    user: {
      id,
      email: `${role}@example.test`,
      displayName: role === 'administrator' ? 'Sample Administrator' : 'Sample Editor',
      initials: 'SA',
      hue: 140,
      role,
    },
    expiresAt: Date.now() + 60_000,
  });
}

describe('failed emails and trainee removal', () => {
  it('lists a failed message for an administrator and hides it from an editor', async () => {
    signIn('editor');
    const editor = renderAt('/admin/failed-emails');
    expect((await screen.findAllByText('You do not have access to that.')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Failed emails' })).not.toBeInTheDocument();
    editor.unmount();

    signIn('administrator');
    renderAt('/admin/failed-emails');
    expect(await screen.findByRole('heading', { name: 'Failed emails' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Failed emails' })).toBeInTheDocument();
    expect(await screen.findByText('Confirm your Maxim Nyansa trainee account')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resend' }));
    expect(await screen.findByText('No failed emails')).toBeInTheDocument();
  });

  it('requires the saved display name before removing a trainee', async () => {
    const user = userEvent.setup();
    signIn('administrator');
    renderAt('/admin/trainees/1');
    expect(await screen.findByRole('heading', { name: 'Remove this trainee' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove trainee' }));
    expect(await screen.findByRole('link', { name: 'Confirmation' })).toBeInTheDocument();
    const field = screen.getByLabelText(/type the display name to confirm/i);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    await user.type(field, 'Wrong name');
    await user.click(screen.getByRole('button', { name: 'Remove trainee' }));
    expect(await screen.findByText('Type the trainee’s display name to confirm.')).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, 'Sample Trainee 01');
    await user.click(screen.getByRole('button', { name: 'Remove trainee' }));
    expect((await screen.findAllByText('Trainee removed')).length).toBeGreaterThan(0);
  });

  it('does not put an admin control on the public home page', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /secure the future/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Failed emails' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove trainee' })).not.toBeInTheDocument();
  });
});
