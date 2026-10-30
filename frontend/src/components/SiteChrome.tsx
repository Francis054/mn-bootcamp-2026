import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { APP_NAVIGATED } from '@/components/ScrollToTop';
import { usesMockApi } from '@/config/runtime';
import { clearSession } from '@/dev/session';
import { Lockup, Mark } from './Brand';
import { Icon, type IconName } from './Icon';

type NavLinkItem = { id: string; label: string; to: string; sub: string; icon: IconName };
type NavActionItem = { id: string; label: string; action: 'sign-out'; sub: string; icon: IconName };
type NavEntry = NavLinkItem | NavActionItem;

const BOOTCAMP: NavLinkItem[] = [
  { id: 'overview', label: 'Overview', to: '/bootcamp', sub: 'The 12-week Cybersecurity Bootcamp', icon: 'shield' },
  { id: 'schedule', label: 'Schedule', to: '/schedule', sub: 'Daily timetable, 5 Oct – 25 Dec', icon: 'calendar' },
  { id: 'journey', label: 'Three-month journey', to: '/journey', sub: '5 Oct – 25 Dec 2026, week by week', icon: 'commit' },
  { id: 'classes', label: 'Class archive', to: '/classes', sub: 'Sample lesson notes', icon: 'book' },
  { id: 'projects', label: 'Projects & labs', to: '/projects', sub: 'Practical work from the cohort', icon: 'terminal' },
];

const LINKS_BEFORE = [{ id: 'home', label: 'Home', to: '/' }];
const LINKS_AFTER = [
  { id: 'events', label: 'Events', to: '/events' },
  { id: 'gallery', label: 'Gallery', to: '/gallery' },
  { id: 'anniversary', label: '10 Years', to: '/anniversary' },
  { id: 'about', label: 'About', to: '/about' },
];

function traineeEntries(signedIn: boolean): NavEntry[] {
  const directory: NavLinkItem = { id: 'trainees', label: 'Meet the trainees', to: '/trainees', sub: 'The 2026 cohort', icon: 'users' };
  if (signedIn) {
    return [
      directory,
      { id: 'portal', label: 'My portal', to: '/portal', sub: 'Profile, portfolio, and journey', icon: 'user' },
      { id: 'sign-out', label: 'Sign out', action: 'sign-out', sub: 'End this session', icon: 'log-out' },
    ];
  }
  return [
    directory,
    { id: 'sign-in', label: 'Sign in', to: '/login', sub: 'Open the trainee portal', icon: 'lock' },
    { id: 'sign-up', label: 'Sign up', to: '/signup', sub: 'Use your cohort email', icon: 'plus' },
  ];
}

function isAction(item: NavEntry): item is NavActionItem {
  return 'action' in item;
}

function DesktopMenu({
  id,
  label,
  page,
  openId,
  items,
  onOpen,
  onToggle,
  onClose,
  onSignOut,
}: {
  id: string;
  label: string;
  page: string;
  openId: string | null;
  items: NavEntry[];
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  onClose: (id: string) => void;
  onSignOut: () => void;
}) {
  const rootRef = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openedByPointer = useRef(false);
  const isOpen = openId === id;
  const current = items.some((item) => item.id === page);
  const focusItem = (next: number) => {
    const entries = [...(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    if (!entries.length) return;
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const target = index === -1 ? 0 : (index + next + entries.length) % entries.length;
    entries[target]?.focus();
  };
  const onMenuKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === ' ' && event.target instanceof HTMLAnchorElement) {
      event.preventDefault();
      event.target.click();
    }
  };
  return (
    <li
      ref={rootRef}
      className={`has-menu${isOpen ? ' is-open' : ''}`}
      data-menu={id}
      onMouseEnter={() => {
        if (openId !== id) openedByPointer.current = true;
        onOpen(id);
      }}
      onMouseLeave={() => {
        openedByPointer.current = false;
        onClose(id);
      }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onClose(id); }}
    >
      <button
        ref={buttonRef}
        className="nav-link"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={`${id}-menu`}
        aria-current={current ? 'page' : undefined}
        onClick={() => {
          if (openedByPointer.current) {
            openedByPointer.current = false;
            onOpen(id);
            return;
          }
          onToggle(id);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          flushSync(() => onOpen(id));
          rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
        }}
      >
        {label}<Icon name="chevron-down" className="i--sm" />
      </button>
      <div className="dropdown" id={`${id}-menu`} role="menu" aria-label={label} aria-hidden={isOpen ? undefined : true} inert={isOpen ? undefined : true} onKeyDown={onMenuKey}>
        {items.map((child) => isAction(child) ? (
          <button className="dropdown__item" role="menuitem" type="button" key={child.id} onClick={() => { onClose(id); onSignOut(); }}>
            <span className="ic"><Icon name={child.icon} /></span><b>{child.label}</b><span>{child.sub}</span>
          </button>
        ) : (
          <Link role="menuitem" to={child.to} key={child.id} aria-current={child.id === page ? 'page' : undefined} onClick={() => onClose(id)}>
            <span className="ic"><Icon name={child.icon} /></span><b>{child.label}</b><span>{child.sub}</span>
          </Link>
        ))}
      </div>
    </li>
  );
}

export function SiteHeader({ page, tone }: { page: string; tone: 'light' | 'dark' }) {
  const [solid, setSolid] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [traineeOpen, setTraineeOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const traineeSignedIn = auth.signedIn && auth.role === 'trainee';
  const trainees = traineeEntries(traineeSignedIn);
  const closeMenus = useCallback(() => {
    setMenu(false);
    setOpenMenu(null);
    setTraineeOpen(true);
    document.body.classList.remove('menu-open');
    document.body.style.overflow = '';
  }, []);
  useEffect(() => {
    closeMenus();
  }, [closeMenus, location.pathname, location.search, location.hash, location.key]);
  useEffect(() => {
    window.addEventListener(APP_NAVIGATED, closeMenus);
    return () => {
      window.removeEventListener(APP_NAVIGATED, closeMenus);
      document.body.classList.remove('menu-open');
      document.body.style.overflow = '';
    };
  }, [closeMenus]);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (!openMenu) return;
    const onPointer = (event: PointerEvent) => {
      const root = document.querySelector(`[data-menu="${openMenu}"]`);
      if (event.target instanceof Node && root?.contains(event.target)) return;
      setOpenMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const root = document.querySelector(`[data-menu="${openMenu}"]`);
      const inside = Boolean(root?.contains(document.activeElement));
      event.preventDefault();
      setOpenMenu(null);
      if (inside) root?.querySelector('button')?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);
  const toggleMenu = (next: boolean) => {
    setMenu(next);
    if (next) setTraineeOpen(true);
    document.body.classList.toggle('menu-open', next);
    document.body.style.overflow = next ? 'hidden' : '';
  };
  useEffect(() => {
    if (!menu) return;
    const block = (event: TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (document.getElementById('mobile-menu')?.contains(target)) return;
      event.preventDefault();
    };
    document.addEventListener('touchmove', block, { passive: false });
    return () => document.removeEventListener('touchmove', block);
  }, [menu]);
  const signOut = async () => {
    await api({ method: 'POST', path: '/auth/logout' });
    clearSession();
    closeMenus();
    navigate('/login');
  };
  const linkItem = (item: { id: string; label: string; to: string }) => (
    <li key={item.id}><NavLink className="nav-link" to={item.to} end={item.to === '/'}>{item.label}</NavLink></li>
  );
  const menuProps = {
    page,
    openId: openMenu,
    onOpen: (id: string) => setOpenMenu(id),
    onToggle: (id: string) => setOpenMenu((current) => (current === id ? null : id)),
    onClose: (id: string) => setOpenMenu((current) => (current === id ? null : current)),
    onSignOut: () => { void signOut(); },
  };
  return (
    <>
      <header className={`site-header${solid ? ' is-solid' : ''}`} data-tone={tone}>
        <div className="container bar">
          <Lockup />
          <nav className="nav" aria-label="Primary">
            <ul>
              {LINKS_BEFORE.map(linkItem)}
              <DesktopMenu id="bootcamp" label="Bootcamp" items={BOOTCAMP} {...menuProps} />
              <DesktopMenu id="trainees" label="Trainees" items={trainees} {...menuProps} />
              {LINKS_AFTER.map(linkItem)}
            </ul>
          </nav>
          <Link className="btn btn--sm header-cta" to="/journey">Follow the cohort <span className="arrow"><Icon name="arrow-right" className="i--sm" /></span></Link>
          <button className="menu-toggle" type="button" aria-expanded={menu} aria-controls="mobile-menu" aria-label={menu ? 'Close menu' : 'Open menu'} onClick={() => toggleMenu(!menu)}><span className="bars"><i /><i /><i /></span></button>
        </div>
      </header>
      <div className="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
        <nav aria-label="Mobile">
          <ol>
            {LINKS_BEFORE.map((item) => (
              <li key={item.id}><Link to={item.to} aria-current={item.id === page ? 'page' : undefined} onClick={() => toggleMenu(false)}>{item.label}</Link></li>
            ))}
            {BOOTCAMP.map((item) => (
              <li key={item.id}><Link to={item.to} aria-current={item.id === page ? 'page' : undefined} onClick={() => toggleMenu(false)}>{item.label}</Link></li>
            ))}
            <li className={`mm-group${traineeOpen ? ' is-open' : ''}`}>
              <button type="button" aria-expanded={traineeOpen} aria-controls="mobile-trainees" aria-current={trainees.some((item) => item.id === page) ? 'page' : undefined} onClick={() => setTraineeOpen((value) => !value)}>
                Trainees<Icon name="chevron-down" className="i--sm" />
              </button>
              <ul className="mm-sub" id="mobile-trainees" hidden={!traineeOpen}>
                {trainees.map((item) => (
                  <li key={item.id}>
                    {isAction(item) ? (
                      <button type="button" onClick={() => { void signOut(); }}>{item.label}</button>
                    ) : (
                      <Link to={item.to} aria-current={item.id === page ? 'page' : undefined} onClick={() => toggleMenu(false)}>{item.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </li>
            {LINKS_AFTER.map((item) => (
              <li key={item.id}><Link to={item.to} aria-current={item.id === page ? 'page' : undefined} onClick={() => toggleMenu(false)}>{item.label}</Link></li>
            ))}
          </ol>
        </nav>
        <div className="mm-foot">
          <Link className="btn" to="/journey" onClick={() => toggleMenu(false)}>Follow the cohort <span className="arrow"><Icon name="arrow-right" className="i--sm" /></span></Link>
          {usesMockApi() ? <span className="label" style={{ color: '#8FA597' }}>Development · sample data</span> : null}
        </div>
      </div>
    </>
  );
}

const SOCIAL = [
  ['https://www.linkedin.com/company/maxim-nyansa-foundation', 'LinkedIn', 'linkedin'],
  ['https://facebook.com/maximnyansa', 'Facebook', 'facebook'],
  ['https://instagram.com/maxim_nyansa', 'Instagram', 'instagram'],
  ['https://twitter.com/MaximNyansa', 'X (Twitter)', 'twitter'],
  ['https://www.youtube.com/channel/UCTYJus0hr3iI9wvxqzHle-g', 'YouTube', 'youtube'],
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <Lockup />
            <p>A community site for the free 2026 Cybersecurity Bootcamp, run by the Maxim Nyansa Foundation — creating career perspectives for young people with information technology since 2016.</p>
          </div>
          <div><h3>Bootcamp</h3><ul>
            <li><Link to="/bootcamp">Overview</Link></li><li><Link to="/schedule">Schedule</Link></li><li><Link to="/journey">Journey</Link></li><li><Link to="/classes">Class archive</Link></li><li><Link to="/projects">Projects & labs</Link></li><li><Link to="/trainees">Trainees</Link></li>
          </ul></div>
          <div><h3>Community</h3><ul>
            <li><Link to="/events">Events</Link></li><li><Link to="/gallery">Gallery</Link></li><li><Link to="/anniversary">10 Years of Impact</Link></li><li><Link to="/about">About the Foundation</Link></li>
            <li><a href="https://maximnyansa.com/" target="_blank" rel="noopener">maximnyansa.com <Icon name="arrow-up-right" className="i--sm" /></a></li>
          </ul></div>
          <div><h3>Visit</h3><ul>
            <li>Coral Avenue – Tantra Hills<br />Accra, Ghana</li>
            <li><a href="mailto:mninfo@maximnyansa.com">mninfo@maximnyansa.com</a></li>
            <li><Link to="/contact">Contact page</Link></li>
          </ul>
            <div className="socials" style={{ marginTop: 20 }}>
              {SOCIAL.map(([href, label, icon]) => <a key={label} href={href} target="_blank" rel="noopener" aria-label={label}><Icon name={icon} className="i--sm" /></a>)}
            </div>
          </div>
        </div>
        <div className="footer-big" aria-hidden="true">Secure the future.</div>
        <div className="footer-bottom">
          <span>© 2026 Maxim Nyansa Foundation{usesMockApi() ? ' · Development build — sample data, not a live site' : ''}</span>
        </div>
      </div>
    </footer>
  );
}

export function PageTransition() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => { document.body.classList.add('page-enter'); }, [location.pathname]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest('a[href]');
      if (!anchor || anchor.getAttribute('target') === '_blank' || anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href.startsWith('/') || href.startsWith('//')) return;
      event.preventDefault();
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        navigate(href);
        return;
      }
      document.querySelector('.page-veil')?.classList.add('is-leaving');
      window.setTimeout(() => {
        navigate(href);
        document.querySelector('.page-veil')?.classList.remove('is-leaving');
      }, 380);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [navigate]);
  return <div className="page-veil" />;
}

export function Crumbs({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <ol className="crumbs">
      {items.map((item, index) => (
        <li key={item.label} aria-current={index === items.length - 1 ? 'page' : undefined}>
          {item.to && index < items.length - 1 ? <Link to={item.to}>{item.label}</Link> : item.label}
        </li>
      ))}
    </ol>
  );
}

export function ProtoFlag() {
  if (!usesMockApi()) return null;
  return <span className="proto-flag">Development · sample data</span>;
}

export function usePageMeta(title: string) {
  useEffect(() => {
    document.title = `${title} · 2026 Cybersecurity Bootcamp · Maxim Nyansa Foundation`;
  }, [title]);
}

export function ShellMark() {
  return <span className="wordmark__mark"><Mark /></span>;
}
