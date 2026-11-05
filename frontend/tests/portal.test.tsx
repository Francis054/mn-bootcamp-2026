import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { api } from '@/api/client';
import { App } from '@/App';
import { AuthProvider } from '@/auth/AuthProvider';
import { ToastProvider } from '@/components/feedback';
import { readDevMail } from '@/dev/trainee-auth';
import { clearSession, setSession } from '@/dev/session';

const PASSWORD = 'Correct-horse-1';

function asAdmin(): void {
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
}

async function approveEmail(email: string): Promise<void> {
  asAdmin();
  const rows = await api<Array<{ id: string; email: string }>>({ method: 'GET', path: '/admin/pending-registrations' });
  const row = rows.find((item) => item.email === email);
  if (!row) throw new Error('pending row missing');
  await api({ method: 'POST', path: `/admin/pending-registrations/${row.id}/approve` });
  clearSession();
}

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

describe('trainee portal screens', () => {
  it('offers trainee sign-in and sign-up from the trainees menu', async () => {
    const user = userEvent.setup();
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /secure the future/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Trainee sign in / Create account' })).not.toBeInTheDocument();
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    await user.click(within(primary).getByRole('button', { name: 'Trainees' }));
    expect(within(primary).getByRole('menuitem', { name: /sign in/i })).toHaveAttribute('href', '/login');
    expect(within(primary).getByRole('menuitem', { name: /sign up/i })).toHaveAttribute('href', '/signup');
    const hrefs = [...document.querySelectorAll('a')].map((anchor) => anchor.getAttribute('href') ?? '');
    expect(hrefs.filter((href) => href === '/admin' || href.startsWith('/admin/'))).toEqual([]);
  });

  it('shows the same signup reply for a roster email and an unknown one', async () => {
    const user = userEvent.setup();
    renderAt('/signup');
    expect(await screen.findByRole('heading', { name: /create your account/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^name/i), 'Sample Person');
    await user.type(screen.getByLabelText(/^email/i), 'trainee01@example.test');
    await user.type(screen.getByLabelText(/^password/i), PASSWORD);
    await user.type(screen.getByLabelText(/^confirm password/i), PASSWORD);
    await user.click(screen.getByRole('checkbox', { name: /creating a trainee account/i }));
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByRole('heading', { name: /registration received/i })).toBeInTheDocument();
    expect(screen.getByText(/waiting for an administrator to approve it/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /development confirmation link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request another link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /request another/i })).not.toBeInTheDocument();

    const unknown = await api<{ message: string }>({
      method: 'POST',
      path: '/public/trainee-signup',
      body: {
        email: 'not-on-roster@example.test',
        password: PASSWORD,
        confirm: PASSWORD,
        displayName: 'New Person',
        acceptTerms: true,
      },
    });
    expect(unknown.message).toMatch(/waiting for an administrator to approve it/i);
    expect(readDevMail().some((item) => item.to === 'trainee01@example.test' && item.text.includes('/verify-email'))).toBe(false);
    expect(readDevMail().some((item) => item.to === 'not-on-roster@example.test')).toBe(false);
  });

  it('blocks sign-in until approval, then opens the portal', async () => {
    const user = userEvent.setup();
    await api({
      method: 'POST',
      path: '/public/trainee-signup',
      body: {
        email: 'trainee02@example.test',
        password: PASSWORD,
        confirm: PASSWORD,
        acceptTerms: true,
      },
    });
    await expect(
      api({
        method: 'POST',
        path: '/auth/login',
        body: { email: 'trainee02@example.test', password: PASSWORD, developmentAck: true },
      }),
    ).rejects.toMatchObject({ status: 403, code: 'TRAINEE_PENDING_APPROVAL' });
    await expect(
      api({
        method: 'POST',
        path: '/auth/login',
        body: { email: 'trainee02@example.test', password: 'Wrong-password-1', developmentAck: true },
      }),
    ).rejects.toMatchObject({ status: 401, code: 'unauthenticated' });

    const waiting = renderAt('/login');
    await user.type(await screen.findByLabelText(/^email/i), 'trainee02@example.test');
    await user.type(screen.getByLabelText(/^password/i), PASSWORD);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('heading', { name: /waiting for approval/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /request another/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request another/i })).not.toBeInTheDocument();
    waiting.unmount();

    await approveEmail('trainee02@example.test');

    renderAt('/login');
    await user.type(await screen.findByLabelText(/^email/i), 'trainee02@example.test');
    await user.type(screen.getByLabelText(/^password/i), PASSWORD);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('heading', { name: /hello, sample trainee 02/i })).toBeInTheDocument();
    expect(screen.getByText(/account is active/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Portfolio' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'CV' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /log out/i }));
    expect(await screen.findByRole('heading', { name: /trainee sign in/i })).toBeInTheDocument();
  });

  it('shows a rejected registration and a deactivated account without leaking a wrong password', async () => {
    const user = userEvent.setup();
    await api({
      method: 'POST',
      path: '/public/trainee-signup',
      body: {
        email: 'turned-down@example.test',
        password: PASSWORD,
        confirm: PASSWORD,
        displayName: 'Turned Down',
        acceptTerms: true,
      },
    });
    asAdmin();
    const pending = await api<Array<{ id: string; email: string }>>({ method: 'GET', path: '/admin/pending-registrations' });
    const row = pending.find((item) => item.email === 'turned-down@example.test');
    if (!row) throw new Error('pending row missing');
    await api({ method: 'POST', path: `/admin/pending-registrations/${row.id}/reject` });
    clearSession();

    const rejected = renderAt('/login');
    await user.type(await screen.findByLabelText(/^email/i), 'turned-down@example.test');
    await user.type(screen.getByLabelText(/^password/i), 'Wrong-password-1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/email or password is not correct/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /not approved/i })).not.toBeInTheDocument();
    rejected.unmount();

    const rejectedRight = renderAt('/login');
    await user.type(await screen.findByLabelText(/^email/i), 'turned-down@example.test');
    await user.type(screen.getByLabelText(/^password/i), PASSWORD);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('heading', { name: /registration was not approved/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request another/i })).not.toBeInTheDocument();
    rejectedRight.unmount();

    await api({
      method: 'POST',
      path: '/public/trainee-signup',
      body: {
        email: 'paused@example.test',
        password: PASSWORD,
        confirm: PASSWORD,
        displayName: 'Paused Person',
        acceptTerms: true,
      },
    });
    await approveEmail('paused@example.test');
    asAdmin();
    const accounts = await api<Array<{ id: string; email: string }>>({ method: 'GET', path: '/admin/trainee-accounts' });
    const account = accounts.find((item) => item.email === 'paused@example.test');
    if (!account) throw new Error('account missing');
    await api({ method: 'POST', path: `/admin/trainee-accounts/${account.id}/disable` });
    clearSession();

    renderAt('/login');
    await user.type(await screen.findByLabelText(/^email/i), 'paused@example.test');
    await user.type(screen.getByLabelText(/^password/i), PASSWORD);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('heading', { name: /account deactivated/i })).toBeInTheDocument();
    expect(screen.getByText(/administrator can enable it/i)).toBeInTheDocument();
  });
});
