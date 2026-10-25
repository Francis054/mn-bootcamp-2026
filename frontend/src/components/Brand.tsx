import { useEffect, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.8l7.5 2.9v5.6c0 4.8-3.2 8-7.5 9.9-4.3-1.9-7.5-5.1-7.5-9.9V5.7z" />
      <path d="M12 7.5v9M8.5 10.5L12 7.5l3.5 3" />
    </svg>
  );
}

export function OfficialLogo({ width }: { width?: number }) {
  return (
    <span className="logo-plate">
      <img src="/assets/logo/maxim-nyansa-foundation-logo.png" width={200} height={41} alt="Maxim Nyansa Foundation logo" style={width ? { width } : undefined} />
    </span>
  );
}

export function Lockup({ to = '/' }: { to?: string }) {
  return (
    <Link className="lockup" to={to} aria-label="2026 Cyber Bootcamp by Maxim Nyansa Foundation — home">
      <span className="wordmark">
        <span className="wordmark__mark"><Mark /></span>
        <span className="wordmark__text"><b>Cyber Bootcamp</b><small>2026 · Accra</small></span>
      </span>
      <span className="lockup__divider" aria-hidden="true" />
      <OfficialLogo />
    </Link>
  );
}

export function Avatar({ initials, hue, size }: { initials: string; hue: number; size?: 'sm' | 'lg' }) {
  return <span className={`avatar${size ? ` avatar--${size}` : ''}`} style={{ ['--h' as string]: hue }} aria-hidden="true">{initials}</span>;
}

export function Cover({ kind, label }: { kind: string; label?: string }) {
  return (
    <div className={`cover cover--${kind}`} aria-hidden="true">
      <div className="cover__art" />
      {label ? <span className="cover__label">{label}</span> : null}
    </div>
  );
}

/** Local gallery slugs keep the sized webp pair. Full https addresses, including Cloudinary, are used as given. */
export function pictureSource(file: string): { src: string; srcSet?: string } | null {
  const value = file.trim();
  if (!value) return null;
  if (/^https:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      return { src: value };
    } catch {
      return null;
    }
  }
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('..') && !value.includes('\\')) {
    return { src: value };
  }
  if (/^[a-z0-9-]+$/i.test(value)) {
    return {
      src: `/assets/img/${value}-1600.webp`,
      srcSet: `/assets/img/${value}-800.webp 800w, /assets/img/${value}-1600.webp 1600w`,
    };
  }
  return null;
}

export function Photo({ file, alt, width, height, sizes, priority = false, onError }: { file: string; alt: string; width: number; height: number; sizes?: string; priority?: boolean; onError?: () => void }) {
  const picture = pictureSource(file);
  if (!picture) return null;
  return (
    <img
      src={picture.src}
      srcSet={picture.srcSet}
      sizes={picture.srcSet ? sizes : undefined}
      width={width}
      height={height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onError={onError}
    />
  );
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useReveal<T extends Element>(watchParent = false) {
  const [node, setNode] = useState<T | null>(null);
  const [on, setOn] = useState(reducedMotion);
  useEffect(() => {
    if (!node || on) return;
    const target = watchParent ? node.parentElement ?? node : node;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setOn(true);
        observer.disconnect();
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [node, on, watchParent]);
  return { ref: setNode, on, node };
}

/** Matches the prototype’s light scroll parallax. Skipped when motion is reduced. */
function useParallaxShift(node: Element | null, amount?: number) {
  const [y, setY] = useState(0);
  useEffect(() => {
    if (!node || !amount || reducedMotion()) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const next = (rect.top + rect.height / 2 - window.innerHeight / 2) * -amount;
      setY((current) => (Math.abs(current - next) < 0.5 ? current : next));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [node, amount]);
  return amount && !reducedMotion() ? y : 0;
}

export function Reveal({ as = 'div', className = '', reveal = '', mask = false, i, parallax, style, children, ...rest }: { as?: 'div' | 'figure' | 'span'; className?: string; reveal?: '' | 'fade' | 'left' | 'scale'; mask?: boolean; i?: number; parallax?: number; style?: CSSProperties; children?: ReactNode } & Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'style' | 'children'>) {
  const seen = useReveal<HTMLElement>(mask);
  const shift = useParallaxShift(seen.node, parallax);
  const merged: CSSProperties = {
    ...style,
    ...(i !== undefined ? { ['--i' as string]: i } : {}),
    ...(shift ? { transform: `translate3d(0, ${shift}px, 0)` } : {}),
  };
  const Tag = as as ElementType;
  return (
    <Tag ref={seen.ref} className={`${className}${mask ? ' mask-reveal' : ''}${seen.on ? ' is-in' : ''}`.trim()} data-reveal={mask ? undefined : reveal} data-parallax={parallax} style={merged} {...rest}>
      {children}
    </Tag>
  );
}

function lineNodes(line: string): ReactNode {
  const bits = line.split(/(\*[^*]+\*)/g);
  return bits.map((bit, index) => (bit.startsWith('*') && bit.endsWith('*') ? <em key={index}>{bit.slice(1, -1)}</em> : <span key={index}>{bit}</span>));
}

export function SplitHeading({ as: Tag = 'h2', text, className = '', id }: { as?: 'h1' | 'h2' | 'h3'; text: string; className?: string; id?: string }) {
  const seen = useReveal<HTMLHeadingElement>();
  const parts = text.split('\n');
  return (
    <Tag id={id} ref={seen.ref} className={`${className}${seen.on ? ' is-in' : ''}`.trim()} data-reveal="fade">
      {parts.map((part, index) => (
        <span className="split-line" style={{ ['--l' as string]: index }} key={index}><span>{lineNodes(part)}</span></span>
      ))}
    </Tag>
  );
}

export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [shown, setShown] = useState(() => (reducedMotion() ? `${value.toLocaleString('en-GB')}${suffix}` : `0${suffix}`));
  useEffect(() => {
    if (!node) return;
    if (reducedMotion()) {
      setShown(`${value.toLocaleString('en-GB')}${suffix}`);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / 1600);
        const current = Math.round(value * (1 - (1 - progress) ** 4));
        setShown(`${current.toLocaleString('en-GB')}${suffix}`);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, suffix, value]);
  return <b ref={setNode} data-count={value}>{shown}</b>;
}
