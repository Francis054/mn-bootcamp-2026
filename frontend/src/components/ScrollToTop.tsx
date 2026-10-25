import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/** Fired for any plain left-click on an in-app link, including the page already open. */
export const APP_NAVIGATED = 'mn-navigated';

const PAGE_SCROLLERS = '#root, main, .admin-body, .admin-main';
const RETRY_MS = [0, 32, 120, 400, 1000, 2000];

/**
 * First location seen in this document. Survives the error boundary remounting
 * the tree on every pathname change, and resets on a real reload so a refresh
 * can keep the browser's scroll position.
 */
let entryToken: string | null = null;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function normPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname || '/';
}

function hashId(hash: string): string {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function hashTarget(hash: string): HTMLElement | null {
  const id = hashId(hash);
  if (!id) return null;
  const byId = document.getElementById(id);
  if (byId) return byId;
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    const named = document.querySelector(`[name="${CSS.escape(id)}"]`);
    if (named instanceof HTMLElement) return named;
  }
  return null;
}

function internalUrl(href: string): URL | null {
  if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return null;
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return url;
  } catch {
    return null;
  }
}

function plainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** Drop the CSS smooth-scroll animation so a reset cannot stop halfway down a new page. */
function withoutSmoothScroll(run: () => void): void {
  const html = document.documentElement;
  const previous = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  try {
    run();
  } finally {
    html.style.scrollBehavior = previous;
  }
}

function resetScrollContainers(): void {
  document.querySelectorAll<HTMLElement>(PAGE_SCROLLERS).forEach((node) => {
    if (node.scrollTop !== 0) node.scrollTop = 0;
  });
  let node = document.getElementById('main')?.parentElement ?? null;
  while (node && node !== document.documentElement) {
    if (node.scrollTop !== 0) node.scrollTop = 0;
    node = node.parentElement;
  }
}

export function resetPageScroll(top = 0): void {
  withoutSmoothScroll(() => {
    const scrolling = document.scrollingElement;
    if (scrolling) scrolling.scrollTop = top;
    document.documentElement.scrollTop = top;
    document.body.scrollTop = top;
    try {
      window.scrollTo(0, top);
    } catch {
      /* jsdom */
    }
    resetScrollContainers();
  });
}

function scrollToHash(el: HTMLElement, smooth: boolean): void {
  if (!smooth) {
    withoutSmoothScroll(() => {
      el.scrollIntoView({ block: 'start', inline: 'nearest' });
    });
    return;
  }
  el.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' });
}

function smoothToTop(): void {
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  } catch {
    resetPageScroll(0);
  }
}

function focusWithoutScroll(node: HTMLElement | null): void {
  const target = node ?? document.getElementById('main');
  if (!(target instanceof HTMLElement)) return;
  const naturallyFocusable = target.matches('a, button, input, select, textarea, summary');
  if (!naturallyFocusable && target.tabIndex < 0) target.tabIndex = -1;
  try {
    target.focus({ preventScroll: true });
  } catch {
    target.focus();
  }
}

function notifyNavigated(): void {
  document.body.classList.remove('menu-open');
  document.body.style.overflow = '';
  window.dispatchEvent(new Event(APP_NAVIGATED));
}

interface ScrollPlan {
  hash: string;
  pageChanged: boolean;
}

function settleScroll(plan: ScrollPlan, isCurrent: () => boolean): () => void {
  const reduced = prefersReducedMotion();
  let userMoved = false;
  let stopped = false;
  let didSmooth = false;
  let focusedHash = false;
  let focusedTop = false;
  const markMoved = () => {
    userMoved = true;
  };
  const onKey = (event: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) userMoved = true;
  };
  // Wheel, touch, and keys mean the reader took over. Scroll events do not:
  // the browser clamps and restores scroll while the new page renders, and
  // treating that as input left the page mid-way down.
  window.addEventListener('wheel', markMoved, { passive: true });
  window.addEventListener('touchmove', markMoved, { passive: true });
  window.addEventListener('keydown', onKey);
  if (plan.pageChanged) document.documentElement.classList.add('is-nav-scroll');

  const apply = () => {
    if (stopped || userMoved || !isCurrent()) return;
    const target = plan.hash ? hashTarget(plan.hash) : null;
    if (target) {
      const smooth = !plan.pageChanged && !reduced && !didSmooth;
      if (smooth) didSmooth = true;
      if (smooth || plan.pageChanged || reduced) scrollToHash(target, smooth);
      if (!focusedHash) {
        focusWithoutScroll(target);
        focusedHash = true;
      }
      return;
    }
    const smoothTop = !plan.pageChanged && !plan.hash && !reduced && !didSmooth;
    if (smoothTop) {
      didSmooth = true;
      smoothToTop();
    } else if (plan.pageChanged || reduced || plan.hash) {
      resetPageScroll(0);
    }
    if (!focusedTop && !focusedHash) {
      focusWithoutScroll(null);
      focusedTop = true;
    }
  };

  apply();
  requestAnimationFrame(() => {
    if (stopped) return;
    apply();
    requestAnimationFrame(() => {
      if (!stopped) apply();
    });
  });

  const observer = new MutationObserver(() => {
    if (!stopped) apply();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const timers = RETRY_MS.map((delay) => window.setTimeout(apply, delay));
  timers.push(window.setTimeout(() => {
    if (stopped || userMoved || !isCurrent()) return;
    focusWithoutScroll(plan.hash ? hashTarget(plan.hash) : null);
  }, 0));
  // Stop once the new route has had time to render. A live observer would
  // pull the reader back to the top on later DOM updates (images, menus).
  timers.push(window.setTimeout(() => {
    stopped = true;
    observer.disconnect();
    document.documentElement.classList.remove('is-nav-scroll');
  }, 2100));

  return () => {
    stopped = true;
    document.documentElement.classList.remove('is-nav-scroll');
    observer.disconnect();
    for (const timer of timers) window.clearTimeout(timer);
    window.removeEventListener('wheel', markMoved);
    window.removeEventListener('touchmove', markMoved);
    window.removeEventListener('keydown', onKey);
  };
}

/**
 * Puts the new page at the top of whichever element actually scrolls.
 * Resets are instant across route changes: `scroll-behavior: smooth` on `html`
 * otherwise animates through the boot screen and lazy route and stops mid-page.
 * A click on the open route still scrolls, because `pathname` does not change.
 * Back and forward also start at the top — the app does not store scroll positions.
 */
export function ScrollToTop() {
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;
  const previous = useRef<{ pathname: string; search: string; hash: string } | null>(null);
  const generation = useRef(0);
  const seen = useRef('');
  const planRef = useRef<ScrollPlan & { skip: boolean }>({ hash: '', pageChanged: false, skip: true });
  const token = `${location.pathname}|${location.search}|${location.hash}|${location.key}`;
  if (seen.current !== token) {
    const prev = previous.current;
    const pageChanged = prev === null || normPath(prev.pathname) !== normPath(location.pathname) || prev.search !== location.search;
    if (entryToken === null) entryToken = token;
    // Decide during render so StrictMode's second effect pass still sees the
    // first load as a skip. Recording this inside the effect made the replay
    // look like a navigation and pinned the page to the top forever.
    // A later mount in the same document is a client navigation: the route
    // error boundary remounts the tree when the pathname changes.
    const remountedNavigation = entryToken !== token;
    planRef.current = { hash: location.hash, pageChanged, skip: prev === null && !location.hash && !remountedNavigation };
    previous.current = { pathname: location.pathname, search: location.search, hash: location.hash };
    seen.current = token;
    generation.current += 1;
  }
  const mine = generation.current;

  useLayoutEffect(() => {
    const prior = history.scrollRestoration;
    try {
      history.scrollRestoration = 'manual';
    } catch {
      /* jsdom */
    }
    return () => {
      try {
        history.scrollRestoration = prior;
      } catch {
        /* jsdom */
      }
    };
  }, []);

  useLayoutEffect(() => {
    const plan = planRef.current;
    if (plan.skip) return;
    return settleScroll(plan, () => generation.current === mine);
  }, [location.hash, location.key, location.pathname, location.search, mine]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!plainClick(event)) return;
      const origin = event.target instanceof Element ? event.target : event.target instanceof Node ? event.target.parentElement : null;
      const anchor = origin?.closest('a[href]');
      if (!anchor || anchor.getAttribute('target') === '_blank' || anchor.hasAttribute('download')) return;
      const url = internalUrl(anchor.getAttribute('href') ?? '');
      if (!url) return;
      notifyNavigated();
      const current = locationRef.current;
      const same = normPath(url.pathname) === normPath(current.pathname) && url.search === current.search && url.hash === current.hash;
      if (!same) return;
      if (prefersReducedMotion()) resetPageScroll(0);
      else smoothToTop();
      focusWithoutScroll(null);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}

/** Admin screens stay out of search indexes. Public routes stay indexable. */
export function RobotsMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const admin = pathname === '/admin' || pathname.startsWith('/admin/');
    let meta = document.head.querySelector('meta[name="robots"]');
    if (!(meta instanceof HTMLMetaElement)) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', admin ? 'noindex, nofollow' : 'index, follow');
  }, [pathname]);
  return null;
}
