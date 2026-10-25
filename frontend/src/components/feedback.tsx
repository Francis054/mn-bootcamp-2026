import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader } from './Loader';
import { Icon } from './Icon';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; title: string; message?: string; kind: ToastKind }

const ToastContext = createContext<(title: string, message?: string, kind?: ToastKind) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((title: string, message?: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, title, message, kind }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {items.map((item) => (
          <div className={`toast${item.kind === 'error' ? ' toast--error' : ''}`} key={item.id}>
            <Icon name={item.kind === 'error' ? 'alert' : 'check-circle'} />
            <div><b>{item.title}</b>{item.message}</div>
            <button type="button" aria-label="Dismiss" onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}><Icon name="x" className="i--sm" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

interface ConfirmOptions { title: string; text: string; ok?: string; danger?: boolean }
const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const ask = useCallback((next: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current = resolve;
    setOptions(next);
  }), []);
  const close = (value: boolean) => {
    setOptions(null);
    resolver.current?.(value);
    resolver.current = null;
  };
  useEffect(() => {
    if (!options || !dialog.current) return;
    const root = dialog.current;
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
    buttons[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
      if (event.key !== 'Tab') return;
      const list = [...root.querySelectorAll<HTMLButtonElement>('button')];
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [options]);
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {options ? (
        <div className="modal-backdrop is-open" onClick={(event) => { if (event.target === event.currentTarget) close(false); }}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text" ref={dialog}>
            <div className="modal__icon"><Icon name={options.danger === false ? 'info' : 'trash'} /></div>
            <h2 id="confirm-title">{options.title}</h2>
            <p id="confirm-text" className="muted">{options.text}</p>
            <div className="modal__actions">
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => close(false)}>Cancel</button>
              <button className={`btn btn--sm${options.danger === false ? '' : ' btn--danger'}`} type="button" onClick={() => close(true)}>{options.ok ?? 'Delete'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export interface LightboxItem { src: string; alt: string; caption: string; category: string; width: number; height: number }
const LightboxContext = createContext<(items: LightboxItem[], index: number) => void>(() => undefined);
export function useLightbox() { return useContext(LightboxContext); }

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<LightboxItem[]>([]);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [swap, setSwap] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const show = useCallback((next: LightboxItem[], start: number) => {
    setItems(next);
    setIndex(start);
    setOpen(true);
    document.body.style.overflow = 'hidden';
  }, []);
  const close = () => {
    setOpen(false);
    document.body.style.overflow = '';
  };
  const go = useCallback((delta: number) => {
    setSwap(true);
    window.setTimeout(() => {
      setIndex((current) => (current + delta + items.length) % Math.max(items.length, 1));
      setSwap(false);
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  }, [items.length]);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, go]);
  const item = items[index];
  const touchX = useRef(0);
  return (
    <LightboxContext.Provider value={show}>
      {children}
      <div className={`lightbox${open ? ' is-open' : ''}`} role="dialog" aria-modal="true" aria-label="Photo viewer" hidden={!open}>
        <div className="lightbox__top">
          <span className="lb-count">{String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span>
          <button className="lightbox__close" type="button" aria-label="Close (Esc)" ref={closeRef} onClick={close}><Icon name="x" /></button>
        </div>
        <div className="lightbox__stage" onClick={(event) => { if (event.target === event.currentTarget) close(); }}
          onTouchStart={(event) => { touchX.current = event.touches[0]?.clientX ?? 0; }}
          onTouchEnd={(event) => { const dx = (event.changedTouches[0]?.clientX ?? 0) - touchX.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}>
          <button className="lightbox__nav lightbox__nav--prev" type="button" aria-label="Previous photo" onClick={() => go(-1)}><Icon name="arrow-left" /></button>
          {item ? <img src={item.src} alt={item.alt} width={item.width} height={item.height} className={swap ? 'is-swapping' : undefined} /> : null}
          <button className="lightbox__nav lightbox__nav--next" type="button" aria-label="Next photo" onClick={() => go(1)}><Icon name="arrow-right" /></button>
        </div>
        <div className="lightbox__cap"><span className="lb-cap">{item ? `${item.caption} — names withheld` : ''}</span><span className="tag lb-cat">{item?.category}</span></div>
      </div>
    </LightboxContext.Provider>
  );
}

export function EmptyState({ icon = 'search', title, text, action }: { icon?: 'search' | 'users' | 'layers' | 'calendar' | 'image' | 'mail'; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__art"><Icon name={icon} className="i--lg" /></div>
      <h3>{title}</h3>
      {text ? <p className="muted">{text}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ title, text, onRetry }: { title: string; text: string; onRetry?: () => void }) {
  return (
    <div className="empty" role="alert">
      <div className="empty__art" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}><Icon name="alert" /></div>
      <h3>{title}</h3>
      <p>{text}</p>
      {onRetry ? <button className="btn btn--dark btn--sm" type="button" onClick={onRetry}>Try again</button> : null}
    </div>
  );
}

export function LoadingRows() {
  return <Loader variant="panel" message="Loading the bootcamp…" label="Loading" />;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    published: ['success', 'Published'],
    done: ['success', 'Published'],
    draft: ['', 'Draft'],
    now: ['lime', 'Live this week'],
    upcoming: ['info', 'Scheduled'],
    scheduled: ['info', 'Scheduled'],
    in_review: ['warning', 'In review'],
    review: ['warning', 'In review'],
    tbc: ['danger', 'Needs confirmation'],
    verified: ['success', 'Verified'],
    sample: ['warning', 'Sample'],
    consent: ['warning', 'Consent pending'],
    pending: ['warning', 'Consent pending'],
    withdrawn: ['danger', 'Consent withdrawn'],
    active: ['success', 'Active'],
  };
  const [tone, label] = map[status] ?? ['', status];
  return <span className={`badge${tone ? ` badge--${tone}` : ''}`}><span className="dot" />{label}</span>;
}
