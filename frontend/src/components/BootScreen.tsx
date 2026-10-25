import { useEffect, useRef, useState } from 'react';
import { CommunityBadge } from '@/components/CommunityBadge';
import { OfficialLogo } from '@/components/Brand';
import { BOOT_EXIT_MS, BOOT_FAIL_OPEN_MS, bootBlocked, bootMinMs, markBootSeen, setBootPhase, subscribeBoot, useBootCovering } from '@/components/bootHold';

const STATUSES = ['Securing the network...', 'Loading the bootcamp...', 'Stronger together'] as const;

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function ease(value: number): number {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function out(value: number): number {
  const t = clamp(value);
  return 1 - (1 - t) ** 3;
}

function seg(time: number, start: number, end: number): number {
  return clamp((time - start) / (end - start));
}

/** The preview's progress curve, compressed onto 0–11.7s. */
function storyProgress(time: number): number {
  const keys: Array<[number, number]> = [
    [4.2, 0],
    [5.2, 0.12],
    [6.4, 0.31],
    [7.1, 0.35],
    [8.6, 0.66],
    [9.2, 0.68],
    [10.0, 0.86],
    [10.6, 0.88],
    [11.7, 1],
  ];
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last || time <= first[0]) return 0;
  if (time >= last[0]) return 1;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const left = keys[index];
    const right = keys[index + 1];
    if (!left || !right || time < left[0] || time > right[0]) continue;
    return left[1] + (right[1] - left[1]) * ease((time - left[0]) / (right[0] - left[0]));
  }
  return 1;
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function paint(ctx: CanvasRenderingContext2D, width: number, height: number, time: number): void {
  const cx = width / 2;
  const cy = height * 0.4;
  const gradient = ctx.createRadialGradient(cx, cy, 40, cx, cy, Math.max(width, height) * 0.72);
  gradient.addColorStop(0, '#01190c');
  gradient.addColorStop(1, '#010905');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = 'rgba(136, 204, 0, 0.08)';
  ctx.lineWidth = 1;
  const step = width < 720 ? 56 : 40;
  for (let x = 0; x <= width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  const rain = out(seg(time, 0, 1));
  if (rain > 0 && width >= 520) {
    ctx.save();
    ctx.font = '12px "JetBrains Mono", ui-monospace, monospace';
    const chars = '01{}<>/+=;$#';
    const gap = width < 800 ? 28 : 22;
    for (let x = 8; x < width; x += gap) {
      const head = ((time * 90 + x * 13) % (height + 180)) - 80;
      for (let k = 0; k < 10; k += 1) {
        const y = head - k * 16;
        if (y < -20 || y > height) continue;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist < Math.min(width, height) * 0.22) continue;
        const alpha = (1 - k / 10) * 0.28 * rain;
        ctx.fillStyle = k === 0 ? `rgba(246,247,242,${alpha + 0.12})` : `rgba(136,204,0,${alpha})`;
        ctx.fillText(chars[(x + k) % chars.length] ?? '0', x, y);
      }
    }
    ctx.restore();
  }

  const curveFade = 1 - 0.55 * ease(seg(time, 3.2, 4.5));
  const drawn = out(seg(time, 0.2, 2.4));
  ctx.save();
  ctx.lineWidth = 1.4;
  const figures: Array<[number, number, number, number, string]> = [
    [width * 0.14, height * 0.82, 3, 2, 'rgba(136,204,0,'],
    [width * 0.86, height * 0.18, 5, 4, 'rgba(217,164,65,'],
    [width * 0.14, height * 0.18, 2, 3, 'rgba(200,85,61,'],
    [width * 0.86, height * 0.82, 4, 3, 'rgba(136,204,0,'],
  ];
  for (const [lx, ly, a, b, color] of figures) {
    ctx.beginPath();
    const count = Math.floor(180 * drawn);
    for (let k = 0; k < count; k += 1) {
      const u = (k / 180) * Math.PI * 2;
      const x = (lx ?? 0) + 70 * Math.sin((a ?? 1) * u + time * 0.4);
      const y = (ly ?? 0) + 48 * Math.sin((b ?? 1) * u);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `${color}${(0.55 * curveFade).toFixed(3)})`;
    ctx.stroke();
  }
  ctx.restore();

  if (time >= 1.2 && time < 4.6) {
    const meet = 3.1;
    const travel = ease(seg(time, 1.2, meet));
    const headL = travel * cx;
    const headR = width - travel * cx;
    const recolour = ease(seg(time, meet, meet + 0.5));
    const fadeOut = 1 - ease(seg(time, meet + 1, 4.4));
    const flat = ease(seg(time, meet + 0.15, meet + 0.9));
    const amp = 46 * (1 - flat) * (0.4 + 0.6 * Math.sin(clamp(travel) * Math.PI)) + 4 * flat;
    const stroke = (points: Array<[number, number]>, color: string, widthPx: number, alpha: number) => {
      if (points.length < 2 || alpha <= 0) return;
      ctx.beginPath();
      const first = points[0];
      if (!first) return;
      ctx.moveTo(first[0], first[1]);
      for (const point of points) ctx.lineTo(point[0], point[1]);
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = widthPx;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    const left: Array<[number, number]> = [];
    const right: Array<[number, number]> = [];
    for (let x = Math.max(0, headL - 420); x <= headL; x += 6) {
      const env = Math.exp(-(headL - x) / 280);
      left.push([x, cy + amp * env * Math.sin(x * 0.06 - time * 14)]);
    }
    for (let x = headR; x <= Math.min(width, headR + 420); x += 6) {
      const env = Math.exp(-(x - headR) / 280);
      right.push([x, cy + amp * env * Math.sin(x * 0.06 + time * 14)]);
    }
    const leftColor = recolour > 0.5 ? '#88CC00' : '#C8553D';
    stroke(left, leftColor, 3, fadeOut);
    stroke(right, '#88CC00', 3, fadeOut);
    const shock = seg(time, meet, meet + 1.3);
    if (shock > 0 && shock < 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, 40 + 280 * out(shock), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(136,204,0,${(0.7 * (1 - shock)).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

export function BootScreen() {
  const covering = useBootCovering();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const started = useRef(0);
  const [progress, setProgress] = useState(0);
  const [badgeIn, setBadgeIn] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const minMs = useRef(0);

  useEffect(() => {
    dismissSplash();
    minMs.current = bootMinMs();
    markBootSeen();
    started.current = performance.now();
    const reduced = reducedMotion();
    let frame = 0;
    let stopped = false;

    const tick = (now: number) => {
      if (stopped) return;
      const elapsed = now - started.current;
      const story = minMs.current === 0 ? 1 : Math.min(1, elapsed / minMs.current);
      const time = story * 11.7;
      const ready = !bootBlocked();
      let bar = storyProgress(time);
      if (!ready) bar = Math.min(bar, 0.9);
      if (ready && elapsed >= minMs.current) bar = 1;
      if (elapsed >= BOOT_FAIL_OPEN_MS) bar = 1;
      setProgress((current) => (Math.abs(current - bar) < 0.01 ? current : bar));
      setBadgeIn(reduced || time >= 3.2);

      const canvas = canvasRef.current;
      const context = canvas && !reduced ? canvas.getContext('2d') : null;
      if (canvas && context) {
        const dpr = Math.min(window.devicePixelRatio || 1, widthCap());
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(1, Math.round(rect.width * dpr));
        const h = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        paint(context, rect.width, rect.height, time);
      }

      const finished = (ready && elapsed >= minMs.current) || elapsed >= BOOT_FAIL_OPEN_MS;
      if (finished) {
        setLeaving(true);
        setBootPhase('exit');
        window.setTimeout(() => {
          if (!stopped) setBootPhase('done');
        }, BOOT_EXIT_MS);
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    const stop = subscribeBoot(() => {
      /* phase changes re-render via the store hook */
    });
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      stop();
    };
  }, []);

  if (!covering) return null;
  const status = progress < 0.33 ? 0 : progress < 0.66 ? 1 : 2;
  const label = STATUSES[status] ?? STATUSES[0];
  const reduced = reducedMotion();

  return (
    <div className={`boot-screen${leaving ? ' is-leaving' : ''}${reduced ? ' is-still' : ''}`} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading the bootcamp…</span>
      <canvas ref={canvasRef} className="boot-screen__canvas" aria-hidden="true" />
      <div className={`boot-screen__stage${badgeIn ? ' is-in' : ''}`} aria-hidden="true">
        <CommunityBadge className="boot-screen__badge" priority />
        <span className="boot-screen__ring" />
        <span className="boot-screen__orbit">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="boot-screen__meter" aria-hidden="true">
        <p className="boot-screen__status">{label}</p>
        <span className="boot-screen__pct">{Math.round(progress * 100)}%</span>
        <span className="boot-screen__track">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      </div>
      <p className="boot-screen__footer" aria-hidden="true">
        <OfficialLogo width={148} />
        <span>Cybersecurity Bootcamp 2026</span>
      </p>
    </div>
  );
}

function widthCap(): number {
  return window.innerWidth < 800 ? 1 : 1.5;
}

function dismissSplash(): void {
  delete document.documentElement.dataset.bootHold;
  document.getElementById('boot')?.remove();
}
