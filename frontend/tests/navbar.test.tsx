import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { AuthProvider } from '@/auth/AuthProvider';
import { ToastProvider } from '@/components/feedback';
import { rememberSignedIn } from '@/dev/session';
import type { Role } from '@/domain/types';

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

function signIn(role: Role) {
  act(() => {
    rememberSignedIn({
      id: `nav-${role}`,
      email: `${role}@example.test`,
      displayName: `Sample ${role}`,
      initials: 'SN',
      hue: 140,
      role,
    }, Date.now() + 60_000);
  });
}

function hrefs() {
  return [...document.querySelectorAll('a')].map((anchor) => anchor.getAttribute('href') ?? '');
}

describe('public navbar', () => {
  it('keeps trainee sign-in and sign-up inside the trainees menu', async () => {
    const user = userEvent.setup();
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /secure the future/i })).toBeInTheDocument();
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    const mobile = screen.getByRole('navigation', { name: 'Mobile' });
    expect(screen.queryByRole('link', { name: /trainee sign in \/ create account/i })).not.toBeInTheDocument();
    expect(within(primary).queryByRole('link', { name: /^sign in$/i })).not.toBeInTheDocument();
    expect(within(primary).queryByRole('link', { name: /^sign up$/i })).not.toBeInTheDocument();
    expect(document.querySelector('header')?.textContent ?? '').not.toMatch(/create account/i);
    expect(hrefs().filter((href) => href === '/admin' || href.startsWith('/admin/'))).toEqual([]);
    expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument();

    const button = within(primary).getByRole('button', { name: 'Trainees' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(document.getElementById('trainees-menu')).toHaveAttribute('aria-hidden', 'true');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('trainees-menu')).not.toHaveAttribute('aria-hidden');
    expect(within(primary).getByRole('menuitem', { name: /meet the trainees/i })).toHaveAttribute('href', '/trainees');
    expect(within(primary).getByRole('menuitem', { name: /sign in/i })).toHaveAttribute('href', '/login');
    expect(within(primary).getByRole('menuitem', { name: /sign up/i })).toHaveAttribute('href', '/signup');
    expect(within(primary).queryByRole('menuitem', { name: /create account/i })).not.toBeInTheDocument();

    const trainees = within(mobile).getByRole('button', { name: 'Trainees' });
    expect(trainees).toHaveAttribute('aria-expanded', 'true');
    expect(within(mobile).getByRole('link', { name: 'Meet the trainees' })).toHaveAttribute('href', '/trainees');
    expect(within(mobile).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(within(mobile).getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup');
    expect(within(mobile).queryByRole('link', { name: /create account/i })).not.toBeInTheDocument();
    await user.click(trainees);
    expect(trainees).toHaveAttribute('aria-expanded', 'false');
    expect(within(mobile).queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument();
  });

  it('opens and closes the trainees menu from the keyboard and from outside clicks', async () => {
    const user = userEvent.setup();
    const focus = HTMLElement.prototype.focus;
    const guard = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function focusGuard(this: HTMLElement, options?: FocusOptions) {
      if (this.id === 'main') return;
      focus.call(this, options);
    });
    renderAt('/');
    try {
      expect(await screen.findByRole('heading', { name: /secure the future/i })).toBeInTheDocument();
      const primary = screen.getByRole('navigation', { name: 'Primary' });
      const button = within(primary).getByRole('button', { name: 'Trainees' });
      button.focus();
      await user.keyboard('{Enter}');
      expect(button).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('{Escape}');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveFocus();

      await user.keyboard(' ');
      expect(button).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('{ArrowDown}');
      expect(within(primary).getByRole('menuitem', { name: /meet the trainees/i })).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(within(primary).getByRole('menuitem', { name: /sign in/i })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute('aria-expanded', 'false');

      await user.keyboard('{ArrowDown}');
      expect(button).toHaveAttribute('aria-expanded', 'true');
      await user.tab();
      expect(within(primary).getByRole('menuitem', { name: /sign in/i })).toHaveFocus();
      await user.tab();
      await user.tab();
      expect(button).toHaveAttribute('aria-expanded', 'false');

      await user.click(button);
      await user.click(screen.getByRole('heading', { name: /secure the future/i }));
      expect(button).toHaveAttribute('aria-expanded', 'false');

      await user.click(button);
      await user.click(within(primary).getByRole('menuitem', { name: /meet the trainees/i }));
      expect(await screen.findByRole('heading', { name: /twelve sample|the people|profiles after/i })).toBeInTheDocument();
      expect(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Trainees' })).toHaveAttribute('aria-expanded', 'false');
    } finally {
      guard.mockRestore();
    }
  });

  it('shows the portal and sign-out once a trainee is signed in', async () => {
    const user = userEvent.setup();
    signIn('trainee');
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /secure the future/i })).toBeInTheDocument();
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    const mobile = screen.getByRole('navigation', { name: 'Mobile' });
    await user.click(within(primary).getByRole('button', { name: 'Trainees' }));
    expect(within(primary).getByRole('menuitem', { name: /my portal/i })).toHaveAttribute('href', '/portal');
    expect(within(primary).getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
    expect(within(primary).queryByRole('menuitem', { name: /sign in/i })).not.toBeInTheDocument();
    expect(within(primary).queryByRole('menuitem', { name: /sign up/i })).not.toBeInTheDocument();
    expect(within(mobile).getByRole('link', { name: 'My portal' })).toHaveAttribute('href', '/portal');
    expect(within(mobile).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(within(mobile).queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument();
    expect(hrefs().filter((href) => href === '/admin' || href.startsWith('/admin/'))).toEqual([]);

    await user.click(within(primary).getByRole('menuitem', { name: /sign out/i }));
    expect(await screen.findByRole('heading', { name: /trainee sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup');
  });

  it('does not offer an admin destination when someone else is signed in', async () => {
    const user = userEvent.setup();
    signIn('administrator');
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /secure the future/i })).toBeInTheDocument();
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    await user.click(within(primary).getByRole('button', { name: 'Trainees' }));
    expect(within(primary).getByRole('menuitem', { name: /sign up/i })).toHaveAttribute('href', '/signup');
    expect(within(primary).queryByRole('menuitem', { name: /my portal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /admin/i })).not.toBeInTheDocument();
    expect(hrefs().filter((href) => href === '/admin' || href.startsWith('/admin/'))).toEqual([]);
  });
});
