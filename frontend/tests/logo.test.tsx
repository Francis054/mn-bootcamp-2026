import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HatMark, Lockup } from '@/components/Brand';
import { COMMUNITY_BADGE_BARE } from '@/domain/siteImages';
import { Loader } from '@/components/Loader';

const LOGO = path.resolve(process.cwd(), 'public/assets/logo');

describe('community badge', () => {
  it('ships the masked badge, the favicon crop and the social image', () => {
    for (const file of ['community-badge.webp', 'community-badge.png', 'community-badge-bare.webp', 'favicon-32.png', 'apple-touch-icon.png', 'og-image.png', 'maxim-nyansa-foundation-logo.png']) {
      expect(existsSync(`${LOGO}/${file}`), file).toBe(true);
    }
  });

  it('uses the badge crop beside the community name and keeps the foundation plate separate', async () => {
    render(
      <MemoryRouter>
        <Lockup />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /cyber bootcamp/i });
    const art = link.querySelector(`img[src="${COMMUNITY_BADGE_BARE}"]`);
    expect(art).not.toBeNull();
    expect(art).toHaveAttribute('alt', '');
    expect(link.querySelector('img[src="/assets/logo/maxim-nyansa-foundation-logo.png"]')).not.toBeNull();
    expect(link).toHaveTextContent('Cyber Bootcamp');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('names the full badge and draws the tagline on the original artwork', async () => {
    render(<HatMark label="Cyber Bootcamp" />);
    const badge = screen.getByRole('img', { name: 'Cyber Bootcamp' });
    expect(badge.querySelector('img')).toHaveAttribute('src', COMMUNITY_BADGE_BARE);
    expect(badge).toHaveTextContent('STRONGER TOGETHER');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('puts the badge in the in-page loader and keeps the status text polite', async () => {
    render(<Loader message="Loading the bootcamp…" />);
    const status = screen.getByRole('status');
    expect(status.querySelector(`img[src="${COMMUNITY_BADGE_BARE}"]`)).not.toBeNull();
    expect(status.querySelector('.sr-only')).toHaveTextContent('Loading the bootcamp…');
    expect(screen.getByText('Loading the bootcamp…', { selector: 'p' })).toHaveAttribute('aria-hidden', 'true');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });
});
