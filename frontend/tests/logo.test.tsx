import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HatMark, Lockup } from '@/components/Brand';
import { Loader } from '@/components/Loader';

const LOGO = path.resolve(process.cwd(), 'public/assets/logo');
describe('community badge', () => {
  it('ships the fedora logo, the favicon crop, and the social image', () => {
    for (const file of ['community-badge.webp', 'community-badge.png', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'og-image.png', 'maxim-nyansa-foundation-logo.png']) {
      expect(existsSync(`${LOGO}/${file}`), file).toBe(true);
    }
    expect(statSync(`${LOGO}/community-badge.webp`).size).toBeLessThanOrEqual(150 * 1024);
    expect(statSync(`${LOGO}/community-badge.png`).size).toBeLessThanOrEqual(450 * 1024);
    expect(existsSync(path.resolve(process.cwd(), 'public/assets/boot/loader.mp4'))).toBe(false);
  });

  it('uses the white-hat mark beside the community name and keeps the foundation plate separate', async () => {
    render(
      <MemoryRouter>
        <Lockup />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /2026 cybersecurity bootcamp/i });
    expect(link.querySelector('img[src="/assets/logo/community-badge.webp"]')).not.toBeNull();
    expect(link.querySelector('.hood-mark')).toBeNull();
    expect(link.querySelector('img[src="/assets/logo/maxim-nyansa-foundation-logo.png"]')).not.toBeNull();
    expect(link).toHaveTextContent('Cybersecurity');
    expect(link).toHaveTextContent('Bootcamp · 2026');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('names the full mark and keeps the tagline with the original artwork', async () => {
    render(<HatMark label="Cyber Bootcamp" />);
    const badge = screen.getByRole('img', { name: 'Cyber Bootcamp' });
    expect(badge.querySelector('img.community-badge__art')).not.toBeNull();
    expect(badge).toHaveTextContent('STRONGER TOGETHER');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('puts the mark in the in-page loader and keeps the status text polite', async () => {
    render(<Loader message="Loading the bootcamp…" />);
    const status = screen.getByRole('status');
    expect(status.querySelector('img.community-badge__art')).not.toBeNull();
    expect(status.querySelector('.sr-only')).toHaveTextContent('Loading the bootcamp…');
    expect(screen.getByText('Loading the bootcamp…', { selector: 'p' })).toHaveAttribute('aria-hidden', 'true');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });
});
