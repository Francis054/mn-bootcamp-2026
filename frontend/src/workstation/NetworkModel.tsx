import { useEffect, useState } from 'react';
import type { WorkstationSnapshot } from './lab';
import { TONE_LABEL, networkVisuals, type NetItem, type NetTone } from './network';

export function NetworkModel({ state }: { state: WorkstationSnapshot }) {
  const reduced = useReducedMotion();
  const { summary, items } = networkVisuals(state);
  const byId = Object.fromEntries(items.map((item) => [item.id, item])) as Record<NetItem['id'], NetItem>;
  return (
    <div className="ws-map">
      <h3>Training network</h3>
      <p className="ws-map__summary">{summary}</p>
      <div className={`ws-map__view${reduced ? ' ws-map__view--flat' : ' ws-map__view--orbit'}`}>
        {reduced ? <FlatDiagram items={byId} /> : <OrbitDiagram items={byId} />}
        <div className="ws-map__readout">
          <ul className="ws-status">
            {items.map((item) => (
              <li key={item.id}>
                <span className={`ws-status__tone ws-status__tone--${item.tone}`}>{TONE_LABEL[item.tone]}</span>
                <span className="ws-status__name">{item.label}</span>
                <span className="ws-status__detail">{item.detail}</span>
              </li>
            ))}
          </ul>
          <p className="ws-map__note">{reduced
            ? 'Flat diagram, because reduced motion is on. The list above is the same state.'
            : 'Simulated model. Drag it to look around. The list above is the same state, in text.'}</p>
        </div>
      </div>
    </div>
  );
}

function FlatDiagram({ items }: { items: Record<NetItem['id'], NetItem> }) {
  return (
    <div className="ws-flat" aria-hidden="true">
      <FlatNode item={items.you} caption="Your machine" />
      <span className={`ws-flat__wire ws-flat__wire--${items.target.tone}`} />
      <div className={`ws-flat__host ws-flat__host--${items.target.tone}`}>
        <FlatNode item={items.target} caption="Training target" />
        <ul>
          <li data-tone={items.p21.tone}>21 {TONE_LABEL[items.p21.tone]}</li>
          <li data-tone={items.p22.tone}>22 {TONE_LABEL[items.p22.tone]}</li>
          <li data-tone={items.p80.tone}>80 {TONE_LABEL[items.p80.tone]}</li>
        </ul>
      </div>
    </div>
  );
}

function FlatNode({ item, caption }: { item: NetItem; caption: string }) {
  return (
    <div className={`ws-flat__node ws-flat__node--${item.tone}`}>
      <b>{item.label}</b>
      <small>{caption}</small>
    </div>
  );
}

function OrbitDiagram({ items }: { items: Record<NetItem['id'], NetItem> }) {
  const [yaw, setYaw] = useState(-32);
  const [pitch, setPitch] = useState(18);
  const [drag, setDrag] = useState<{ x: number; y: number; yaw: number; pitch: number } | null>(null);

  useEffect(() => {
    if (!drag) return undefined;
    const move = (event: PointerEvent) => {
      setYaw(drag.yaw + (event.clientX - drag.x) * 0.45);
      setPitch(clamp(drag.pitch - (event.clientY - drag.y) * 0.3, -12, 42));
    };
    const up = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag]);

  return (
    <>
      <div
        className={`ws-scene${drag ? ' is-dragging' : ''}`}
        aria-hidden="true"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          setDrag({ x: event.clientX, y: event.clientY, yaw, pitch });
        }}
      >
        <div
          className="ws-scene__world"
          data-testid="network-3d"
          style={{
            transform: `rotateX(${pitch}deg) rotateY(${yaw}deg)`,
            ['--yaw' as string]: `${yaw}deg`,
            ['--pitch' as string]: `${pitch}deg`,
          }}
        >
          <div className="ws-floor" />
          <div className={`ws-cable ws-cable--${items.target.tone}`} />
          <Node item={items.you} className="ws-node--you" caption="You" />
          <div className="ws-node ws-node--target">
            <Cube tone={items.target.tone} size="host" />
            <span className="ws-billboard">lab-server</span>
            <Port item={items.p21} className="ws-port--21" />
            <Port item={items.p22} className="ws-port--22" />
            <Port item={items.p80} className="ws-port--80" />
          </div>
        </div>
      </div>
      <div className="ws-map__controls" role="group" aria-label="Rotate the network model">
        <button type="button" className="btn btn--ghost-light btn--xs" onClick={() => setYaw((value) => value - 24)}>Rotate left</button>
        <button type="button" className="btn btn--ghost-light btn--xs" onClick={() => setYaw((value) => value + 24)}>Rotate right</button>
        <button type="button" className="btn btn--ghost-light btn--xs" onClick={() => { setYaw(-32); setPitch(18); }}>Reset view</button>
      </div>
    </>
  );
}

function Node({ item, className, caption }: { item: NetItem; className: string; caption: string }) {
  return (
    <div className={`ws-node ${className}`}>
      <Cube tone={item.tone} size="host" />
      <span className="ws-billboard">{caption}</span>
    </div>
  );
}

function Port({ item, className }: { item: NetItem; className: string }) {
  const short = item.id === 'p21' ? '21' : item.id === 'p22' ? '22' : '80';
  const caption = item.tone === 'secured' ? `${short} locked` : short;
  return (
    <div className={`ws-port ${className}`} data-tone={item.tone}>
      <Cube tone={item.tone} size="port" />
      <span className="ws-billboard">{caption}</span>
    </div>
  );
}

function Cube({ tone, size }: { tone: NetTone; size: 'host' | 'port' }) {
  return (
    <span className={`ws-cube ws-cube--${size} ws-cube--${tone}`}>
      <i /><i /><i /><i /><i /><i />
    </span>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
