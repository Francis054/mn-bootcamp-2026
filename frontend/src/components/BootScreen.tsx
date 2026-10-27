import { useEffect, useRef, useState } from 'react';
import { OfficialLogo } from '@/components/Brand';
import { BootHacker } from '@/components/BootHacker';
import { bootFrame } from '@/components/bootScript';
import { BOOT_EXIT_MS, BOOT_FAIL_OPEN_MS, BOOT_MIN_REPEAT_MS, BOOT_SEEN_KEY, bootBlocked, bootMinMs, markBootSeen, setBootPhase, useBootCovering } from '@/components/bootHold';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function repeatVisit(): boolean {
  try {
    return sessionStorage.getItem(BOOT_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function BootScreen() {
  const covering = useBootCovering();
  const started = useRef(0);
  const minMs = useRef(0);
  const [repeat] = useState(repeatVisit);
  const [fraction, setFraction] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const reduced = reducedMotion();

  useEffect(() => {
    dismissSplash();
    const base = bootMinMs();
    minMs.current = reduced && base > 0 ? Math.min(base, BOOT_MIN_REPEAT_MS) : base;
    markBootSeen();
    started.current = performance.now();
    let frame = 0;
    let exitTimer = 0;
    let stopped = false;

    const tick = (now: number) => {
      if (stopped) return;
      const elapsed = now - started.current;
      const min = minMs.current;
      const clock = min === 0 ? 1 : Math.min(1, elapsed / min);
      const ready = !bootBlocked();
      let next = clock;
      if (!ready && elapsed < BOOT_FAIL_OPEN_MS) next = Math.min(next, 0.72);
      if ((ready && elapsed >= min) || elapsed >= BOOT_FAIL_OPEN_MS) next = 1;
      const rounded = Math.round(next * 200) / 200;
      setFraction((current) => (current === rounded ? current : rounded));
      if (next === 1) {
        setLeaving(true);
        setBootPhase('exit');
        exitTimer = window.setTimeout(() => {
          if (!stopped) setBootPhase('done');
        }, reduced ? 0 : BOOT_EXIT_MS);
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(exitTimer);
    };
  }, [reduced]);

  if (!covering) return null;
  const frame = bootFrame(reduced ? 1 : fraction, repeat, reduced);

  return (
    <div className={`boot-screen${leaving ? ' is-leaving' : ''}${reduced ? ' is-still' : ''}${frame.granted ? ' is-granted' : ''}`} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading the bootcamp…</span>
      <div className="boot-scene">
        <BootHacker />
        <div className={`boot-term${frame.granted ? ' is-granted' : ''}`}>
          <div className="boot-term__chrome" aria-hidden="true">
            <i />
            <i />
            <i />
            <span>mn-lab — cohort 2026</span>
          </div>
          <div className="boot-term__body" aria-hidden="true">
            {frame.lines.length === 0 ? <p>{frame.cursor ? <span className="boot-cursor" /> : null}</p> : null}
            {frame.lines.map((line, index) => (
              <p key={index} className={line.startsWith('$') ? 'is-prompt' : undefined}>
                {line}
                {frame.cursor && index === frame.lines.length - 1 ? <span className="boot-cursor" /> : null}
              </p>
            ))}
            {frame.granted ? <p className="boot-term__grant">ACCESS GRANTED</p> : null}
            {frame.welcome ? <p className="boot-term__welcome">welcome to MN Bootcamp 2026</p> : null}
          </div>
          <div className="boot-term__meter" aria-hidden="true">
            <span style={{ width: `${Math.round((reduced ? 1 : fraction) * 100)}%` }} />
          </div>
        </div>
      </div>
      <p className="boot-screen__footer" aria-hidden="true">
        <OfficialLogo width={148} />
        <span>Cybersecurity Bootcamp 2026</span>
      </p>
    </div>
  );
}

function dismissSplash(): void {
  delete document.documentElement.dataset.bootHold;
  document.getElementById('boot')?.remove();
}
