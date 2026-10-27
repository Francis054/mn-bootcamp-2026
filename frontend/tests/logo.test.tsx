import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HatMark, Lockup } from '@/components/Brand';
import { Loader } from '@/components/Loader';

const LOGO = path.resolve(process.cwd(), 'public/assets/logo');
const BOOT = path.resolve(process.cwd(), 'public/assets/boot');
const MARK = '/assets/logo/community-badge.webp';

describe('community badge', () => {
  it('ships the photographic badge, the favicon crop, the social image, and a short loader clip', () => {
    for (const file of ['community-badge.webp', 'community-badge.png', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'og-image.png', 'maxim-nyansa-foundation-logo.png']) {
      expect(existsSync(`${LOGO}/${file}`), file).toBe(true);
    }
    expect(statSync(`${LOGO}/community-badge.webp`).size).toBeLessThanOrEqual(150 * 1024);
    expect(statSync(`${LOGO}/community-badge.png`).size).toBeLessThanOrEqual(150 * 1024);
    for (const file of ['loader.mp4', 'loader.webm', 'loader-poster.jpg', 'loader-start.jpg']) {
      expect(existsSync(`${BOOT}/${file}`), file).toBe(true);
    }
    expect(statSync(`${BOOT}/loader.mp4`).size).toBeLessThanOrEqual(1.5 * 1024 * 1024);
    expect(statSync(`${BOOT}/loader.webm`).size).toBeLessThanOrEqual(1.5 * 1024 * 1024);
  });

  it('uses the white-hat mark beside the community name and keeps the foundation plate separate', async () => {
    render(
      <MemoryRouter>
        <Lockup />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /2026 cybersecurity bootcamp/i });
    const art = link.querySelector(`img[src="${MARK}"]`);
    expect(art).not.toBeNull();
    expect(art).toHaveAttribute('alt', '');
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
    expect(badge.querySelector('img')).toHaveAttribute('src', MARK);
    expect(badge).toHaveTextContent('STRONGER TOGETHER');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('puts the mark in the in-page loader and keeps the status text polite', async () => {
    render(<Loader message="Loading the bootcamp…" />);
    const status = screen.getByRole('status');
    expect(status.querySelector(`img[src="${MARK}"]`)).not.toBeNull();
    expect(status.querySelector('.sr-only')).toHaveTextContent('Loading the bootcamp…');
    expect(screen.getByText('Loading the bootcamp…', { selector: 'p' })).toHaveAttribute('aria-hidden', 'true');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });
});
