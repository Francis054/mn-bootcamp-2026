import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { TraineeAccountsPage } from '@/pages/admin/TraineeAccessPages';

const api = vi.hoisted(() => vi.fn());

vi.mock('@/api/client', () => ({
  api,
}));

const TRAINEE_ID = 'd6f9629b-6284-4943-a2a0-6ea81f09e28e';
const EMAIL = 'ada@example.test';

const account = {
  id: 'user-1',
  email: EMAIL,
  displayName: 'Francis Dey',
  emailVerified: true,
  traineeId: TRAINEE_ID,
  disabled: false,
  lastLoginAt: null,
  createdAt: '2026-11-05T00:00:00.000Z',
};

function renderPage() {
  return render(
    <ToastProvider>
      <TraineeAccountsPage />
    </ToastProvider>,
  );
}

describe('trainee account cards and invite mail', () => {
  beforeEach(() => {
    api.mockReset();
  });

  it('keeps the display name and the roster id on separate wrapping lines', async () => {
    api.mockResolvedValue([account]);
    renderPage();
    const name = await screen.findByText('Francis Dey');
    const id = screen.getByText(TRAINEE_ID);
    expect(name.tagName).toBe('B');
    expect(id.tagName).toBe('SMALL');
    expect(name.parentElement).toHaveClass('account-person');
    expect(name.parentElement).toContainElement(id);
    expect(name.textContent).toBe('Francis Dey');
    expect(name.textContent).not.toContain(TRAINEE_ID);
    const css = readFileSync(join(process.cwd(), 'src/styles/admin.css'), 'utf8');
    expect(css).toMatch(/\.account-person b,\.account-person small\{display:block/);
    expect(css).toMatch(/\.account-person b,\.account-person small\{[^}]*overflow-wrap:anywhere/);
  });

  it('does not report an undelivered invite as a success', async () => {
    const user = userEvent.setup();
    api.mockImplementation((req: { path: string }) => {
      if (req.path.endsWith('/resend-invite')) {
        return Promise.resolve({
          delivered: false,
          message: 'The email was not sent. Try again once mail is configured.',
        });
      }
      return Promise.resolve([account]);
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Resend invite' }));
    const title = await screen.findByText('Email not sent');
    const toast = title.closest('.toast');
    expect(toast).toHaveClass('toast--error');
    expect(toast).toHaveTextContent('The email was not sent. Try again once mail is configured.');
    expect(screen.queryByText('Email sent')).not.toBeInTheDocument();
    expect(toast).not.toHaveTextContent(EMAIL);
    expect(toast).not.toHaveTextContent('account exists');
    expect(toast).not.toHaveTextContent('no account');
  });

  it('reports a delivered invite as sent', async () => {
    const user = userEvent.setup();
    api.mockImplementation((req: { path: string }) => {
      if (req.path.endsWith('/resend-invite')) {
        return Promise.resolve({ delivered: true, message: 'The email was sent.' });
      }
      return Promise.resolve([account]);
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Resend invite' }));
    const title = await screen.findByText('Email sent');
    const toast = title.closest('.toast');
    expect(toast).not.toHaveClass('toast--error');
    expect(toast).toHaveTextContent('The email was sent.');
    expect(toast).not.toHaveTextContent(EMAIL);
  });
});
