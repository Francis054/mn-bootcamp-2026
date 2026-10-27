import { useEffect, useRef, useState } from 'react';
import { OfficialLogo } from '@/components/Brand';
import { BOOT_EXIT_MS, BOOT_FAIL_OPEN_MS, BOOT_MIN_REPEAT_MS, bootBlocked, bootMinMs, markBootSeen, setBootPhase, useBootCovering } from '@/components/bootHold';

const START = '/assets/boot/loader-start.jpg';
const POSTER = '/assets/boot/loader-poster.jpg';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Read once. React's dev replay would otherwise see the flag this effect is about to set. */
function bootPlan(): { repeat: boolean; reduced: boolean; min: number } {
  const reducedNow = reducedMotion();
  const base = bootMinMs();
  return {
    repeat: base === BOOT_MIN_REPEAT_MS,
    reduced: reducedNow,
    min: reducedNow && base > 0 ? Math.min(base, BOOT_MIN_REPEAT_MS) : base,
  };
}

export function BootScreen() {
  const covering = useBootCovering();
  const started = useRef(0);
  const minMs = useRef(0);
  const [plan] = useState(bootPlan);
  const [leaving, setLeaving] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const playClip = !plan.reduced && !plan.repeat && !videoFailed;

  useEffect(() => {
    dismissSplash();
    minMs.current = plan.min;
    markBootSeen();
    started.current = performance.now();
    let frame = 0;
    let exitTimer = 0;
    let stopped = false;

    const tick = (now: number) => {
      if (stopped) return;
      const elapsed = now - started.current;
      const min = minMs.current;
      const ready = !bootBlocked();
      if ((ready && elapsed >= min) || elapsed >= BOOT_FAIL_OPEN_MS) {
        setLeaving(true);
        setBootPhase('exit');
        exitTimer = window.setTimeout(() => {
          if (!stopped) setBootPhase('done');
        }, plan.reduced ? 0 : BOOT_EXIT_MS);
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
  }, [plan]);

  if (!covering) return null;

  return (
    <div className={`boot-screen${leaving ? ' is-leaving' : ''}${plan.reduced ? ' is-still' : ''}`} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading the bootcamp… ACCESS GRANTED. welcome to MN Bootcamp 2026</span>
      {playClip ? (
        <video className="boot-video" autoPlay muted playsInline poster={START} preload="auto" onError={() => setVideoFailed(true)}>
          <source src="/assets/boot/loader.webm" type="video/webm" />
          <source src="/assets/boot/loader.mp4" type="video/mp4" />
        </video>
      ) : (
        <img className="boot-still" src={POSTER} alt="" onError={() => setPosterFailed(true)} />
      )}
      {posterFailed ? (
        <p className="boot-fallback" aria-hidden="true">
          <strong>ACCESS GRANTED</strong>
          <span>welcome to MN Bootcamp 2026</span>
        </p>
      ) : null}
      <p className="boot-screen__brand" aria-hidden="true">
        <OfficialLogo width={148} />
      </p>
    </div>
  );
}

function dismissSplash(): void {
  delete document.documentElement.dataset.bootHold;
  document.getElementById('boot')?.remove();
}
