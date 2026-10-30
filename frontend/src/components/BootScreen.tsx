import { useEffect, useRef, useState } from 'react';
import { CommunityBadge } from '@/components/CommunityBadge';
import {
  BOOT_FAIL_OPEN_MS,
  BOOT_MIN_REPEAT_MS,
  bootBlocked,
  bootMinMs,
  markBootSeen,
  setBootPhase,
  useBootCovering,
} from '@/components/bootHold';
import {
  BOOT_FILM_MS,
  BOOT_GRANTED,
  BOOT_NAME,
  BOOT_REVEAL_MS,
  BOOT_SCENE1,
  BOOT_SCENE2,
  BOOT_SUCCESS,
  BOOT_VIDEO_SRC,
  BOOT_WARN,
  BOOT_WARN_OK,
  BOOT_YEAR,
  bootView,
} from '@/components/bootFilm';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Read once. React's dev replay would otherwise see the flag this effect is about to set. */
function bootPlan(): { repeat: boolean; reduced: boolean; min: number; film: boolean } {
  const reducedNow = reducedMotion();
  const base = bootMinMs();
  const film = import.meta.env.DEV && new URLSearchParams(window.location.search).get('boot') === 'film';
  return {
    repeat: base === BOOT_MIN_REPEAT_MS,
    reduced: reducedNow,
    min: reducedNow && base > 0 ? Math.min(base, BOOT_MIN_REPEAT_MS) : base,
    film,
  };
}

export function BootScreen() {
  const covering = useBootCovering();
  const [plan] = useState(bootPlan);
  const [leaving, setLeaving] = useState(false);
  const [view, setView] = useState(() => bootView(0, null, plan.repeat, plan.reduced, false, false));
  const started = useRef(0);
  const readyAt = useRef<number | null>(plan.repeat || plan.reduced ? 0 : null);

  useEffect(() => {
    dismissSplash();
    markBootSeen();
    started.current = performance.now();
    let frame = 0;
    let exitTimer = 0;
    let stopped = false;

    const finish = () => {
      setLeaving(true);
      setBootPhase('exit');
      exitTimer = window.setTimeout(() => {
        if (!stopped) setBootPhase('done');
      }, plan.reduced || plan.min === 0 ? 0 : 600);
    };

    const tick = (now: number) => {
      if (stopped) return;
      const elapsed = now - started.current;
      const appReady = !bootBlocked();
      if (plan.min === 0 && appReady) {
        finish();
        return;
      }
      if (appReady && readyAt.current == null && !plan.film) readyAt.current = elapsed;
      if (plan.film && elapsed >= BOOT_REVEAL_MS && readyAt.current == null) readyAt.current = BOOT_REVEAL_MS;
      const next = bootView(elapsed, readyAt.current, plan.repeat, plan.reduced, appReady, false);
      setView((current) => (sameView(current, next) ? current : next));
      const filmDone = plan.film && elapsed >= BOOT_FILM_MS && appReady;
      if (next.leave || filmDone || elapsed >= BOOT_FAIL_OPEN_MS) {
        finish();
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      finish();
    };

    frame = window.requestAnimationFrame(tick);
    window.addEventListener('keydown', onKey);
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(exitTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, [plan]);

  if (!covering) return null;

  const skip = () => {
    setLeaving(true);
    setBootPhase('exit');
    window.setTimeout(() => setBootPhase('done'), plan.reduced ? 0 : 600);
  };

  return (
    <div className={`boot-screen${leaving ? ' is-leaving' : ''}${plan.reduced ? ' is-still' : ''}`} role="dialog" aria-modal="true" aria-labelledby="boot-title">
      <h2 id="boot-title" className="sr-only">Secure environment loading</h2>
      <p className="sr-only" aria-live="polite">{view.scene === 3 ? `${BOOT_GRANTED}. ${BOOT_NAME} ${BOOT_YEAR}` : view.scene === 2 ? 'Verifying the authorised lab session' : 'Initializing secure environment'}</p>
      {!plan.reduced ? <div className="boot-scan" aria-hidden="true" /> : null}
      <header className="boot-top">
        <p>MN BOOTCAMP // CYBERSECURITY 2026</p>
        <button type="button" className="boot-skip" onClick={skip}>Skip</button>
      </header>
      <div className="boot-stage">
        <section className={`boot-scene${view.scene === 1 ? ' is-on' : ''}`} aria-hidden="true">
          <div className="boot-term">
            {BOOT_SCENE1.map((line, index) => (
              <p key={line} className={view.scene1[index] ? 'is-on' : ''}>{line}</p>
            ))}
          </div>
        </section>
        <section className={`boot-scene${view.scene === 2 ? ' is-on' : ''}`} aria-hidden="true">
          <div className="boot-layout">
            <div className="boot-panel">
              <p className="boot-kicker">Security verification</p>
              {BOOT_SCENE2.map((line, index) => (
                <p key={line} className={view.scene2[index] ? 'is-on' : ''}>{line}</p>
              ))}
              <p className={view.warn === 'watch' ? 'is-on is-warn' : view.warn === 'ok' ? 'is-on is-ok' : ''}>{view.warn === 'ok' ? BOOT_WARN_OK : BOOT_WARN}</p>
              <div className="boot-meter">
                <span>VERIFICATION</span>
                <b>{String(Math.round(view.progress * 100)).padStart(3, '0')}</b>
                <i style={{ transform: `scaleX(${view.progress})` }} />
              </div>
            </div>
            <div className="boot-panel boot-viz">
              <BootVideo />
              <svg className="boot-net" viewBox="0 0 320 220" aria-hidden="true">
                <path d="M36 110 H120" />
                <path d="M120 110 L200 48" />
                <path d="M120 110 L200 172" />
                <path d="M200 48 H286" />
                <path d="M200 172 H286" />
                <path d="M120 110 V40" />
                <circle cx="36" cy="110" r="4" />
                <circle cx="120" cy="110" r="5" />
                <circle cx="200" cy="48" r="4" />
                <circle cx="200" cy="172" r="4" />
                <circle cx="286" cy="48" r="3.5" />
                <circle cx="286" cy="172" r="3.5" />
                <circle cx="120" cy="40" r="3.5" />
              </svg>
            </div>
          </div>
        </section>
        <section className={`boot-scene boot-grant${view.scene === 3 ? ' is-on' : ''}`} aria-hidden="true">
          <CommunityBadge variant="mark" className="boot-hat" />
          <p className="boot-success">{BOOT_SUCCESS}</p>
          <p className="boot-granted">{BOOT_GRANTED}</p>
          <p className="boot-name">{BOOT_NAME}</p>
          <p className="boot-year">{BOOT_YEAR}</p>
        </section>
      </div>
    </div>
  );
}

function BootVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !BOOT_VIDEO_SRC) return;
    node.src = BOOT_VIDEO_SRC;
    node.addEventListener('error', () => {
      node.hidden = true;
    });
    const pending = node.play();
    if (pending) pending.catch(() => {
      node.hidden = true;
    });
  }, []);
  if (!BOOT_VIDEO_SRC) return null;
  return <video ref={ref} className="boot-video" muted playsInline preload="none" aria-hidden="true" />;
}

function sameView(current: ReturnType<typeof bootView>, next: ReturnType<typeof bootView>): boolean {
  return current.scene === next.scene
    && current.warn === next.warn
    && current.leave === next.leave
    && Math.abs(current.progress - next.progress) < 0.008
    && current.scene1.every((on, index) => on === next.scene1[index])
    && current.scene2.every((on, index) => on === next.scene2[index]);
}

function dismissSplash(): void {
  delete document.documentElement.dataset.bootHold;
  document.getElementById('boot')?.remove();
}
