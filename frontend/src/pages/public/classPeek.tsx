import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';

/** Hide the floating preview for touch, coarse pointers, and reduced motion. */
export const PEEK_HIDDEN_QUERY =
  '(hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)';

export function peekTracksPointer(
  match: (query: string) => { matches: boolean } = (query) => window.matchMedia(query),
): boolean {
  if (typeof window === 'undefined') return false;
  return !match(PEEK_HIDDEN_QUERY).matches;
}

/** Viewport position. The outer element must not transition `transform`. */
export function peekPlacement(x: number, y: number): string {
  return `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -50%)`;
}

export function hoverSrc(url: string): string {
  return url.includes('-1600.webp') ? url.replace('-1600.webp', '-800.webp') : url;
}

interface PeekPhoto {
  src: string;
  fallbackSrc: string;
}

/**
 * Follows the pointer with a compositor transform, one update per frame.
 * The node is portaled to `document.body` so a transform on `main` cannot
 * turn `position: fixed` into a document-relative box.
 */
export function useClassPeek(photos: readonly PeekPhoto[]) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const frame = useRef(0);
  const point = useRef<{ x: number; y: number; index: number } | null>(null);
  const shownSrc = useRef('');
  const photosRef = useRef(photos);
  const [mounted, setMounted] = useState(false);
  photosRef.current = photos;

  useEffect(() => {
    return () => {
      if (frame.current) window.cancelAnimationFrame(frame.current);
    };
  }, []);

  const paint = () => {
    frame.current = 0;
    const next = point.current;
    const node = nodeRef.current;
    const image = imageRef.current;
    if (next && (!node || !image)) {
      frame.current = window.requestAnimationFrame(paint);
      return;
    }
    if (!next || !node || !image || !peekTracksPointer()) {
      node?.classList.remove('is-on');
      return;
    }
    const chosen = photosRef.current[next.index % photosRef.current.length];
    if (!chosen) return;
    const src = hoverSrc(chosen.src);
    if (shownSrc.current !== src) {
      shownSrc.current = src;
      image.dataset.fallback = hoverSrc(chosen.fallbackSrc);
      delete image.dataset.fell;
      image.src = src;
    }
    node.style.transform = peekPlacement(next.x, next.y);
    node.classList.add('is-on');
  };

  const movePeek = (index: number) => (event: ReactMouseEvent) => {
    if (!peekTracksPointer()) return;
    if (!mounted) setMounted(true);
    point.current = { x: event.clientX, y: event.clientY, index };
    if (frame.current) return;
    frame.current = window.requestAnimationFrame(paint);
  };

  const hidePeek = () => {
    point.current = null;
    nodeRef.current?.classList.remove('is-on');
  };

  const first = photos[0];
  const preview =
    !mounted || typeof document === 'undefined'
      ? null
      : createPortal(
          <div className="row-peek" ref={nodeRef} aria-hidden="true">
            <div className="row-peek__frame">
              <img
                ref={imageRef}
                alt=""
                width={800}
                height={600}
                src={hoverSrc(first?.src ?? '')}
                onError={(event) => {
                  const image = event.currentTarget;
                  const fallback = image.dataset.fallback;
                  if (!fallback || image.dataset.fell === '1') return;
                  image.dataset.fell = '1';
                  image.src = fallback;
                }}
              />
            </div>
          </div>,
          document.body,
        );

  return { movePeek, hidePeek, preview };
}
