import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { AuthProvider } from '@/auth/AuthProvider';
import { ConfirmProvider, ToastProvider } from '@/components/feedback';
import { resolveSiteImage } from '@/domain/siteImages';
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

describe('site images', () => {
  it('keeps the bundled file when a stored address is not safe', () => {
    const portrait = resolveSiteImage('home-hero-main', { url: 'javascript:alert(1)', alt: 'Replaced' });
    expect(portrait.src).toBe('/assets/img/participant-portrait-1600.webp');
    expect(portrait.fallbackSrc).toBe(portrait.src);
    expect(portrait.srcSet).toContain('800w');
    expect(portrait.alt).toBe('Replaced');

    const remote = resolveSiteImage('foundation-logo', {
      url: 'https://res.cloudinary.com/demo/image/upload/v1/mn/logo.png',
      alt: 'Updated wordmark',
      fit: 'contain',
    });
    expect(remote.src).toContain('https://');
    expect(remote.srcSet).toBeUndefined();
    expect(remote.fallbackSrc).toBe('/assets/logo/maxim-nyansa-foundation-logo.png');
    expect(resolveSiteImage('community-logo').src).toBe('/assets/logo/logo-mark.svg');
    expect(resolveSiteImage('community-logo-icon').src).toBe('/assets/logo/logo-icon.svg');
    expect(remote.alt).toBe('Updated wordmark');
  });

  it('paints the homepage hero from the original file before and after the slot list loads', async () => {
    renderAt('/');
    const photo = await screen.findByRole('img', {
      name: 'The Maxim Nyansa Foundation group in white 10-year shirts, posed in front of the anniversary banner',
    });
    expect(photo).toHaveAttribute('src', '/assets/img/participant-portrait-1600.webp');
    expect(photo).toHaveAttribute('width', '1600');
    expect(photo).toHaveAttribute('height', '756');
  });

  it('lists every slot for an administrator and keeps editors out', async () => {
    setSession({
      mode: 'development',
      user: { id: 'dev-editor', email: 'editor@example.test', displayName: 'Sample Editor', initials: 'SE', hue: 60, role: 'editor' },
      expiresAt: Date.now() + 60_000,
    });
    const editor = renderAt('/admin/site-images');
    expect(await screen.findByRole('heading', { name: 'Administrators only' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Site images' })).not.toBeInTheDocument();
    editor.unmount();

    setSession({
      mode: 'development',
      user: { id: 'dev-admin', email: 'administrator@example.test', displayName: 'Sample Administrator', initials: 'SA', hue: 140, role: 'administrator' },
      expiresAt: Date.now() + 60_000,
    });
    renderAt('/admin/site-images');
    expect(await screen.findByRole('heading', { name: 'Community logo (black hat vs ethical hat)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Parent organisation logo (Maxim Nyansa Foundation)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Homepage hero, main photo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign-in panel photo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Site images' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset to original' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Original image').length).toBeGreaterThan(0);
  });

  it('saves alt text onto the public logo and can put the original description back', async () => {
    const user = userEvent.setup();
    setSession({
      mode: 'development',
      user: { id: 'dev-admin', email: 'administrator@example.test', displayName: 'Sample Administrator', initials: 'SA', hue: 140, role: 'administrator' },
      expiresAt: Date.now() + 60_000,
    });
    const admin = renderAt('/admin/site-images');
    const card = (await screen.findByRole('heading', { name: 'Parent organisation logo (Maxim Nyansa Foundation)' })).closest('article');
    if (!card) throw new Error('Expected the parent-organisation plate.');
    const panel = within(card);
    const alt = panel.getByLabelText('Alt text for Parent organisation logo (Maxim Nyansa Foundation)');
    await user.clear(alt);
    await user.type(alt, 'Parent plate for the Foundation');
    await user.click(panel.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Alt text saved')).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Reset to original' })).toBeInTheDocument();
    admin.unmount();

    const home = renderAt('/');
    expect((await screen.findAllByRole('img', { name: 'Parent plate for the Foundation' })).length).toBeGreaterThan(0);
    home.unmount();

    const again = renderAt('/admin/site-images');
    const logo = (await screen.findByRole('heading', { name: 'Parent organisation logo (Maxim Nyansa Foundation)' })).closest('article');
    if (!logo) throw new Error('Expected the logo slot.');
    await user.click(within(logo).getByRole('button', { name: 'Reset to original' }));
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(await screen.findByText('Original image restored')).toBeInTheDocument();
    again.unmount();

    renderAt('/');
    expect((await screen.findAllByRole('img', { name: 'Maxim Nyansa Foundation logo' })).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('img', { name: 'Parent plate for the Foundation' })).toHaveLength(0);
  });
});
