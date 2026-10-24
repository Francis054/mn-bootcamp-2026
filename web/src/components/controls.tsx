import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function Tabs({ label, value, onChange, tabs }: { label: string; value: string; onChange: (id: string) => void; tabs: Array<{ id: string; label: string }> }) {
  const list = useRef<HTMLDivElement>(null);
  const [ink, setInk] = useState({ left: 0, width: 0 });
  useEffect(() => {
    const root = list.current;
    const current = root?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    if (!current) return;
    setInk({ left: current.offsetLeft, width: current.offsetWidth });
  }, [value, tabs]);
  return (
    <div className="tabs" role="tablist" aria-label={label} ref={list}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          className="tab"
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={value === tab.id}
          tabIndex={value === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            event.preventDefault();
            const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
            const item = tabs[next];
            if (item) onChange(item.id);
          }}
        >{tab.label}</button>
      ))}
      <span className="tab-ink" style={{ left: ink.left, width: ink.width }} />
    </div>
  );
}

export function Chips({ label, value, onChange, options }: { label: string; value: string; onChange: (id: string) => void; options: Array<{ id: string; label: string }> }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.id} className="chip" type="button" aria-pressed={value === option.id} onClick={() => onChange(option.id)}>{option.label}</button>
      ))}
    </div>
  );
}

export function Field({ id, label, error, hint, children, className = '' }: { id: string; label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`field${className ? ` ${className}` : ''}${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
      <div className="error-msg" id={`${id}-err`}>{error ? <><Icon name="alert" className="i--sm" />{error}</> : null}</div>
    </div>
  );
}

export function ErrorSummary({ errors }: { errors: Record<string, string> }) {
  const entries = Object.entries(errors);
  if (!entries.length) return <div className="error-summary" role="alert" />;
  return (
    <div className="error-summary is-on" role="alert" tabIndex={-1}>
      <h2><Icon name="alert" className="i--sm" /> {entries.length} {entries.length > 1 ? 'fields need' : 'field needs'} attention</h2>
      <ul>{entries.map(([id, message]) => <li key={id}><a href={`#${id}`}>{message}</a></li>)}</ul>
    </div>
  );
}

export function SaveBar({ dirty, pending, onCancel, label = 'Save' }: { dirty: boolean; pending: boolean; onCancel?: string; label?: string }) {
  return (
    <div className={`savebar${dirty ? ' is-dirty' : ''}`}>
      <span className="status">{dirty ? 'Unsaved changes' : 'Held in the development adapter · not sent to a server'}</span>
      {onCancel ? <a className="btn btn--ghost btn--sm" href={onCancel}>Cancel</a> : null}
      <button className={`btn btn--dark btn--sm${pending ? ' is-loading' : ''}`} type="submit" disabled={pending}>{label}</button>
    </div>
  );
}

export function onDirty(setDirty: (value: boolean) => void) {
  return () => setDirty(true);
}

export function bindBeforeUnload(dirty: boolean) {
  const onLeave = (event: BeforeUnloadEvent) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  };
  window.addEventListener('beforeunload', onLeave);
  return () => window.removeEventListener('beforeunload', onLeave);
}

export function DragList({ items, onChange, render }: { items: string[]; onChange: (items: string[]) => void; render?: (item: string, index: number) => ReactNode }) {
  const move = (index: number, delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    const copy = [...items];
    const [row] = copy.splice(index, 1);
    if (row === undefined) return;
    copy.splice(next, 0, row);
    onChange(copy);
  };
  return (
    <ul className="drag-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="drag-item" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
          event.preventDefault();
          const from = Number(event.dataTransfer.getData('text/plain'));
          if (Number.isNaN(from) || from === index) return;
          const copy = [...items];
          const [row] = copy.splice(from, 1);
          if (row === undefined) return;
          copy.splice(index, 0, row);
          onChange(copy);
        }}>
          <button type="button" className="drag-handle" aria-label={`Reorder item ${index + 1}`} onKeyDown={(event) => {
            if (event.key === 'ArrowUp') { event.preventDefault(); move(index, -1); }
            if (event.key === 'ArrowDown') { event.preventDefault(); move(index, 1); }
          }}><Icon name="drag" className="i--sm" /></button>
          <span className="yr">{String(index + 1).padStart(2, '0')}</span>
          <div style={{ flex: 1 }}>{render ? render(item, index) : <b>{item}</b>}</div>
          <div className="actions">
            <button type="button" className="icon-btn" data-move="-1" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}><span style={{ display: 'grid', transform: 'rotate(180deg)' }}><Icon name="chevron-down" className="i--sm" /></span></button>
            <button type="button" className="icon-btn" data-move="1" aria-label="Move down" disabled={index === items.length - 1} onClick={() => move(index, 1)}><Icon name="chevron-down" className="i--sm" /></button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function submitGuard(event: FormEvent, errors: Record<string, string>, focusId?: string): boolean {
  if (!Object.keys(errors).length) return true;
  event.preventDefault();
  const node = document.getElementById(focusId ?? Object.keys(errors)[0] ?? '');
  node?.focus();
  return false;
}

export function iconFor(name: IconName) {
  return <Icon name={name} />;
}
