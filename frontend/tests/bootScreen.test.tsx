import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BootScreen } from '@/components/BootScreen';
import { resetBootForTests, useBootHold } from '@/components/bootHold';

function Hold({ pending }: { pending: boolean }) {
  useBootHold(pending);
  return null;
}

function boot() {
  return (
    <>
      <BootScreen />
      <Hold pending />
    </>
  );
}

describe('boot screen', () => {
  afterEach(() => {
    resetBootForTests();
  });

  it('has no skip button and still leaves once the page is ready', async () => {
    resetBootForTests();
    const view = render(boot());
    expect(screen.getByRole('dialog', { name: /secure environment loading/i })).toBeInTheDocument();
    expect(screen.getByText('ACCESS GRANTED')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => { requestAnimationFrame(() => resolve(undefined)); });
    });
    expect(screen.getByRole('dialog', { name: /secure environment loading/i })).toBeInTheDocument();

    view.rerender(
      <>
        <BootScreen />
        <Hold pending={false} />
      </>,
    );
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 40); });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lets Escape dismiss the loader with no control on screen', async () => {
    resetBootForTests();
    render(boot());
    expect(screen.getByRole('dialog', { name: /secure environment loading/i })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await new Promise((resolve) => { setTimeout(resolve, 20); });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
