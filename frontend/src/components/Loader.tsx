import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CommunityBadge } from '@/components/CommunityBadge';
import { useBootCovering, useBootHold } from '@/components/bootHold';

/** Wait this long before a loader appears, so a fast response never flashes one. */
export const LOADER_SHOW_DELAY_MS = 150;

/** Once the loader is on screen, keep it up at least this long so it does not blink. */
export const LOADER_MIN_VISIBLE_MS = 400;

export type LoaderVariant = 'page' | 'panel' | 'inline';

function dismissBootSplash(): void {
  delete document.documentElement.dataset.bootHold;
  document.getElementById('boot')?.remove();
}

/**
 * The HTML splash stays up through the short pause before the React loader.
 * Child effects run first and can set `data-boot-hold` before this fires.
 */
export function AfterBoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (document.documentElement.dataset.bootHold === '1') return;
      dismissBootSplash();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return children;
}

export function Loader({ variant = 'page', message = 'Loading the bootcamp…', label }: { variant?: LoaderVariant; message?: string; label?: string }) {
  const text = label ?? message;
  useEffect(() => {
    if (variant === 'inline') return;
    dismissBootSplash();
  }, [variant]);
  const art =
    variant === 'inline' ? (
      <span className="brand-loader__stage" aria-hidden="true">
        <span className="brand-loader__ring" />
      </span>
    ) : (
      <span className="brand-loader__stage" aria-hidden="true">
        <CommunityBadge className="brand-loader__badge" />
        <span className="brand-loader__ring" />
      </span>
    );
  if (variant === 'inline') {
    return (
      <span className="brand-loader brand-loader--inline" role="status" aria-live="polite">
        <span className="sr-only">{text}</span>
        {art}
      </span>
    );
  }
  return (
    <div className={`brand-loader brand-loader--${variant}`} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{text}</span>
      {art}
      <p className="brand-loader__kicker" aria-hidden="true">
        Maxim Nyansa
      </p>
      <p className="brand-loader__message" aria-hidden="true">
        {message}
      </p>
    </div>
  );
}

/** Shows the loader only after a short delay, then keeps it visible briefly. */
export function useDeferredLoading(active: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef<number | null>(null);
  useEffect(() => {
    if (!active) {
      if (!visible) return;
      const elapsed = shownAt.current == null ? 0 : Date.now() - shownAt.current;
      const wait = Math.max(0, LOADER_MIN_VISIBLE_MS - elapsed);
      const timer = window.setTimeout(() => {
        shownAt.current = null;
        setVisible(false);
      }, wait);
      return () => window.clearTimeout(timer);
    }
    if (visible) return;
    const timer = window.setTimeout(() => {
      shownAt.current = Date.now();
      setVisible(true);
    }, LOADER_SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, visible]);
  return visible;
}

export function LoadGate({ pending, variant = 'page', message = 'Loading the bootcamp…', label, children }: { pending: boolean; variant?: LoaderVariant; message?: string; label?: string; children: ReactNode }) {
  useBootHold(variant === 'page' && pending);
  const covering = useBootCovering();
  const show = useDeferredLoading(pending);
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    if (show) setReveal(true);
  }, [show]);
  useEffect(() => {
    if (pending && !show) {
      document.documentElement.dataset.bootHold = '1';
      return;
    }
    dismissBootSplash();
  }, [pending, show]);
  if (variant === 'page' && covering) {
    return pending ? null : <div className="loader-ready">{children}</div>;
  }
  if (pending || show) {
    if (!show) return <div className={`loader-hold loader-hold--${variant}`} aria-hidden="true" />;
    return <Loader variant={variant} message={message} label={label} />;
  }
  return <div className={reveal ? 'loader-reveal' : 'loader-ready'}>{children}</div>;
}

/** Suspense fallback. A very fast chunk never flashes the loader. */
export function RouteFallback({ variant = 'page' }: { variant?: 'page' | 'panel' }) {
  useBootHold(variant === 'page');
  const covering = useBootCovering();
  const show = useDeferredLoading(true);
  if (variant === 'page' && covering) return null;
  if (!show) return <div className={`loader-hold loader-hold--${variant}`} aria-hidden="true" />;
  return <Loader variant={variant} message="Loading the bootcamp…" />;
}
