import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/auth/AuthProvider';
import { ToastProvider } from '@/components/feedback';
import { App } from '@/App';

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

describe('public routes', () => {
  it('renders the home story and verified facts', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /secure the future/i })).toBeInTheDocument();
    expect(screen.getByText('5 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('filters the class archive', async () => {
    const user = userEvent.setup();
    renderAt('/classes');
    expect(await screen.findByRole('heading', { name: /every lesson/i })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Network' }));
    expect(screen.getByText(/of 12 classes/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /how networks|firewalls/i }).length).toBeGreaterThan(0);
  });

  it('shows a not-found state for an unknown lesson', async () => {
    renderAt('/classes/missing');
    expect(await screen.findByRole('heading', { name: /not available/i })).toBeInTheDocument();
  });
});

describe('admin gate', () => {
  it('sends an anonymous visitor to the development sign-in', async () => {
    renderAt('/admin');
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getAllByText(/not production authentication/i).length).toBeGreaterThan(0);
  });

  it('requires the development acknowledgement', async () => {
    const user = userEvent.setup();
    renderAt('/admin/login');
    await user.type(await screen.findByLabelText(/work email/i), 'editor@example.test');
    await user.type(screen.getByLabelText(/^password/i), 'length-ok');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('link', { name: /confirm that you understand/i })).toBeInTheDocument();
  });
});
