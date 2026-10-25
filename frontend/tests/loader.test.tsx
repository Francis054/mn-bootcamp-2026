import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBootPhase } from '@/components/bootHold';
import { LoadGate, Loader, LOADER_MIN_VISIBLE_MS, LOADER_SHOW_DELAY_MS } from '@/components/Loader';
import { PublicGate } from '@/pages/public/helpers';

beforeEach(() => {
  setBootPhase('done');
});

afterEach(() => {
  vi.useRealTimers();
  delete document.documentElement.dataset.bootHold;
  document.getElementById('boot')?.remove();
});

describe('branded loader', () => {
  it('announces a polite status and keeps the visible message out of the name', async () => {
    render(<Loader message="Loading the bootcamp…" />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status.querySelector('.sr-only')).toHaveTextContent('Loading the bootcamp…');
    expect(screen.getByText('Loading the bootcamp…', { selector: 'p' })).toHaveAttribute('aria-hidden', 'true');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('puts a polite inline spinner inside a busy button', () => {
    render(
      <button type="button">
        Save
        <Loader variant="inline" label="Saving" />
      </button>,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Saving')).toHaveClass('sr-only');
  });

  it('skips the loader when the page is already ready', () => {
    render(
      <LoadGate pending={false}>
        <p>Ready now</p>
      </LoadGate>,
    );
    expect(screen.getByText('Ready now')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('waits before showing, then stays up so a slow load does not blink', () => {
    vi.useFakeTimers();
    document.body.append(Object.assign(document.createElement('div'), { id: 'boot' }));
    const view = render(
      <LoadGate pending>
        <p>Ready now</p>
      </LoadGate>,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready now')).not.toBeInTheDocument();
    expect(document.getElementById('boot')).not.toBeNull();
    expect(document.documentElement.dataset.bootHold).toBe('1');

    act(() => {
      vi.advanceTimersByTime(LOADER_SHOW_DELAY_MS - 1);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Loading the bootcamp…');
    expect(document.getElementById('boot')).toBeNull();

    view.rerender(
      <LoadGate pending={false}>
        <p>Ready now</p>
      </LoadGate>,
    );
    act(() => {
      vi.advanceTimersByTime(LOADER_MIN_VISIBLE_MS - 1);
    });
    expect(screen.queryByText('Ready now')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('Ready now')).toBeInTheDocument();
    expect(screen.getByText('Ready now').parentElement).toHaveClass('loader-reveal');
  });

  it('never shows the loader or an empty state for a very fast load', () => {
    vi.useFakeTimers();
    const view = render(
      <PublicGate loading error={null}>
        <p>No classes are published yet</p>
      </PublicGate>,
    );
    expect(screen.queryByText('No classes are published yet')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(80);
    });
    view.rerender(
      <PublicGate loading={false} error={null}>
        <p>No classes are published yet</p>
      </PublicGate>,
    );
    act(() => {
      vi.advanceTimersByTime(LOADER_MIN_VISIBLE_MS);
    });
    expect(screen.getByText('No classes are published yet')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
