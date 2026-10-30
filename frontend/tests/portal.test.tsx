import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { api } from '@/api/client';
import { App } from '@/App';
import { AuthProvider } from '@/auth/AuthProvider';
import { ToastProvider } from '@/components/feedback';
import { readDevMail } from '@/dev/trainee-auth';

const PASSWORD = 'Correct-horse-1';

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
  it('offers trainee sign-in from the public header and the mobile menu', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /secure the future/i })).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Trainee sign in / Create account' });
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(links.every((link) => link.getAttribute('href') === '/login')).toBe(true);
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
    expect(await screen.findByText(/if this email is on the cohort list/i)).toBeInTheDocument();
    const rosterLink = screen.getByRole('link', { name: /development confirmation link/i }).getAttribute('href');

    const unknown = await api<{ message: string; developmentVerifyPath: string | null }>({
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
    expect(unknown.message).toMatch(/if this email is on the cohort list/i);
    expect(unknown.developmentVerifyPath).toBeNull();
    expect(rosterLink).toContain('/verify-email?token=');
    expect(readDevMail().some((item) => item.to === 'trainee01@example.test' && item.html.includes('href='))).toBe(true);
    expect(readDevMail().some((item) => item.to === 'not-on-roster@example.test')).toBe(false);
  });

  it('confirms a token, blocks an unverified login, and opens the portal', async () => {
    const user = userEvent.setup();
    const signup = await api<{ developmentVerifyPath: string }>({
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
    ).rejects.toMatchObject({ status: 403 });

    const verified = renderAt(signup.developmentVerifyPath);
    expect(await screen.findByText(/email confirmed/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /trainee sign in/i })).toHaveAttribute('href', '/login');
    verified.unmount();

    const resend = renderAt('/verify-email');
    expect(await screen.findByRole('button', { name: /request another link/i })).toBeInTheDocument();
    resend.unmount();

    renderAt('/login');
    await user.type(await screen.findByLabelText(/^email/i), 'trainee02@example.test');
    await user.type(screen.getByLabelText(/^password/i), PASSWORD);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('heading', { name: /hello, sample trainee 02/i })).toBeInTheDocument();
    expect(screen.getByText(/email is confirmed/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Portfolio' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'CV' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /log out/i }));
    expect(await screen.findByRole('heading', { name: /trainee sign in/i })).toBeInTheDocument();
  });
});
