import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HatMark, Lockup } from '@/components/Brand';
import { Loader } from '@/components/Loader';

const LOGO = path.resolve(process.cwd(), 'public/assets/logo');

describe('community hat logo', () => {
  it('ships the mark, the compact icon and the wordmark as SVG', () => {
    for (const file of [
      'logo-mark.svg',
      'logo-icon.svg',
      'logo-icon-app.svg',
      'logo-wordmark.svg',
      'logo-wordmark-on-dark.svg',
      'hat-black.svg',
      'hat-ethical.svg',
    ]) {
      expect(existsSync(`${LOGO}/${file}`), file).toBe(true);
    }
  });

  it('uses the compact icon beside the community wordmark', async () => {
    render(<MemoryRouter><Lockup /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /cyber bootcamp/i });
    const icon = link.querySelector('img[src="/assets/logo/logo-icon.svg"]');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('alt', '');
    expect(link).toHaveTextContent('Cyber Bootcamp');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('names the primary mark when it is the content', async () => {
    render(<HatMark label="Cyber Bootcamp" />);
    expect(screen.getByRole('img', { name: 'Cyber Bootcamp' })).toHaveAttribute('src', '/assets/logo/logo-mark.svg');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('puts both hats in the loader and keeps the status text polite', () => {
    render(<Loader message="Loading the bootcamp…" />);
    const status = screen.getByRole('status');
    expect(status.querySelector('img[src="/assets/logo/hat-black.svg"]')).not.toBeNull();
    expect(status.querySelector('img[src="/assets/logo/hat-ethical.svg"]')).not.toBeNull();
    expect(status.querySelector('.sr-only')).toHaveTextContent('Loading the bootcamp…');
  });
});
