import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAVIGATED } from '@/components/ScrollToTop';
import { Lockup, Mark } from './Brand';
import { usesMockApi } from '@/config/runtime';
import { Icon, type IconName } from './Icon';

const MENU: Array<{ id: string; label: string; to?: string; items?: Array<{ id: string; label: string; to: string; sub: string; icon: IconName }> }> = [
  { id: 'home', label: 'Home', to: '/' },
  { id: 'bootcamp', label: 'Bootcamp', items: [
    { id: 'overview', label: 'Overview', to: '/bootcamp', sub: 'The 12-week Cybersecurity Bootcamp', icon: 'shield' },
    { id: 'schedule', label: 'Schedule', to: '/schedule', sub: 'Daily timetable, 5 Oct – 25 Dec', icon: 'calendar' },
    { id: 'journey', label: 'Three-month journey', to: '/journey', sub: '5 Oct – 25 Dec 2026, week by week', icon: 'commit' },
    { id: 'classes', label: 'Class archive', to: '/classes', sub: 'Sample lesson notes', icon: 'book' },
    { id: 'projects', label: 'Projects & labs', to: '/projects', sub: 'Practical work from the cohort', icon: 'terminal' },
  ] },
  { id: 'trainees', label: 'Trainees', to: '/trainees' },
  { id: 'events', label: 'Events', to: '/events' },
  { id: 'gallery', label: 'Gallery', to: '/gallery' },
  { id: 'anniversary', label: '10 Years', to: '/anniversary' },
  { id: 'about', label: 'About', to: '/about' },
];

export function SiteHeader({ page, tone }: { page: string; tone: 'light' | 'dark' }) {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMenu(false);
    setOpen(false);
    document.body.classList.remove('menu-open');
    document.body.style.overflow = '';
  }, [location.pathname, location.search, location.hash, location.key]);
  useEffect(() => {
    const close = () => {
      setMenu(false);
      setOpen(false);
      document.body.classList.remove('menu-open');
      document.body.style.overflow = '';
    };
    window.addEventListener(APP_NAVIGATED, close);
    return () => {
      window.removeEventListener(APP_NAVIGATED, close);
      document.body.classList.remove('menu-open');
      document.body.style.overflow = '';
    };
  }, []);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const toggleMenu = (next: boolean) => {
    setMenu(next);
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
  const flat = MENU.flatMap((item) => item.items ?? (item.to ? [{ id: item.id, label: item.label, to: item.to }] : []));
  return (
    <>
      <header className={`site-header${solid ? ' is-solid' : ''}`} data-tone={tone}>
        <div className="container bar">
          <Lockup />
          <nav className="nav" aria-label="Primary">
            <ul>
              <li><Link className="nav-link nav-link--account" to="/login">Trainee sign in / Create account</Link></li>
              {MENU.map((item) => item.items ? (
                <li key={item.id} className={`has-menu${open ? ' is-open' : ''}`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
                  <button className="nav-link" type="button" aria-expanded={open} aria-haspopup="true" aria-current={item.items.some((child) => child.id === page) ? 'page' : undefined} onClick={() => setOpen((value) => !value)}>
                    {item.label}<Icon name="chevron-down" className="i--sm" />
                  </button>
                  <div className="dropdown" role="menu">
                    {item.items.map((child) => (
                      <Link role="menuitem" to={child.to} key={child.id} aria-current={child.id === page ? 'page' : undefined} onClick={() => setOpen(false)}>
                        <span className="ic"><Icon name={child.icon} /></span><b>{child.label}</b><span>{child.sub}</span>
                      </Link>
                    ))}
                  </div>
                </li>
              ) : (
                <li key={item.id}><NavLink className="nav-link" to={item.to ?? '/'} end={item.to === '/'}>{item.label}</NavLink></li>
              ))}
            </ul>
          </nav>
          <Link className="btn btn--sm header-cta" to="/journey">Follow the cohort <span className="arrow"><Icon name="arrow-right" className="i--sm" /></span></Link>
          <button className="menu-toggle" type="button" aria-expanded={menu} aria-controls="mobile-menu" aria-label={menu ? 'Close menu' : 'Open menu'} onClick={() => toggleMenu(!menu)}><span className="bars"><i /><i /><i /></span></button>
        </div>
      </header>
      <div className="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
        <nav aria-label="Mobile">
          <ol>
            <li><Link to="/login" onClick={() => toggleMenu(false)}>Trainee sign in / Create account</Link></li>
            {flat.map((item) => (
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
