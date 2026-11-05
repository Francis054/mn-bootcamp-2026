import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/auth/AuthProvider';
import { ToastProvider } from '@/components/feedback';
import { App } from '@/App';

const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
  (char) => char.charCodeAt(0),
);

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

describe('profile photo on the sample pages', () => {
  it('uploads a photo in the admin form and shows it on the profile, directory, and home cards', async () => {
    const user = userEvent.setup();
    renderAt('/admin/login?next=/admin/trainees/1');
    await user.type(await screen.findByLabelText(/work email/i), 'administrator@example.test');
    await user.type(screen.getByLabelText(/^password/i), 'length-ok');
    await user.click(screen.getByRole('checkbox', { name: /not production authentication/i }));
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('heading', { name: 'Sample Trainee 01' })).toBeInTheDocument();
    expect(screen.getByText('No photo yet')).toBeInTheDocument();
    expect(screen.queryByText('Placeholder portrait')).not.toBeInTheDocument();

    const file = new File([PNG], 'portrait.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/profile photo/i), file);
    expect(await screen.findByRole('button', { name: 'Replace photo' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /consent/i }));
    expect(screen.getByRole('img', { name: 'Sample Trainee 01' })).toHaveAttribute('src', expect.stringMatching(/^blob:/));

    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('Profile saved')).toBeInTheDocument();
    const saved = screen.getByRole('img', { name: 'Sample Trainee 01' });
    expect(saved).toHaveAttribute('src', expect.stringMatching(/^data:image\/png;base64,/));

    const site = screen.getAllByRole('link', { name: /view public site/i })[0];
    if (!site) throw new Error('The public site link is missing.');
    await user.click(site);
    expect(await screen.findByRole('heading', { name: /meet the trainees/i })).toBeInTheDocument();
    const homeCard = screen.getByRole('link', { name: /Sample Trainee 01/ });
    expect(within(homeCard).getByRole('img', { name: 'Sample Trainee 01' })).toHaveAttribute(
      'src',
      expect.stringMatching(/^data:image\/png;base64,/),
    );
    expect(within(homeCard).queryByText('Placeholder')).not.toBeInTheDocument();

    await user.click(homeCard);
    expect(await screen.findByRole('heading', { name: 'Sample Trainee 01' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Sample Trainee 01' })).toHaveAttribute(
      'src',
      expect.stringMatching(/^data:image\/png;base64,/),
    );
    expect(screen.queryByText('Placeholder portrait')).not.toBeInTheDocument();

    const directoryLink = screen.getAllByRole('link', { name: 'Trainees' })[0];
    if (!directoryLink) throw new Error('The trainees link is missing.');
    await user.click(directoryLink);
    const directory = await screen.findByRole('link', { name: /Sample Trainee 01/ });
    expect(within(directory).getByRole('img', { name: 'Sample Trainee 01' })).toBeInTheDocument();
    expect(within(directory).queryByText('Placeholder')).not.toBeInTheDocument();
    // Sign-in, upload, and three lazy pages. The default 5s is too tight on CI.
  }, 15_000);

  it('rejects a file that is not a JPEG, PNG, or WebP before save', async () => {
    const user = userEvent.setup();
    renderAt('/admin/login?next=/admin/trainees/1');
    await user.type(await screen.findByLabelText(/work email/i), 'editor@example.test');
    await user.type(screen.getByLabelText(/^password/i), 'length-ok');
    await user.click(screen.getByRole('checkbox', { name: /not production authentication/i }));
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('heading', { name: 'Sample Trainee 01' })).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText(/profile photo/i),
      new File(['hello'], 'notes.jpg', { type: 'image/jpeg' }),
    );
    expect(await screen.findByText('Use a JPEG, PNG, or WebP image.')).toBeInTheDocument();
    expect(screen.getByText('No photo yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace photo' })).not.toBeInTheDocument();
  });
});
