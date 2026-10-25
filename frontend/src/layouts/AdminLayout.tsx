import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { searchAdmin } from '@/api/search';
import { useAuth } from '@/auth/AuthProvider';
import { usesMockApi } from '@/config/runtime';
import { CommunityIconLinks, OfficialLogo } from '@/components/Brand';
import { APP_NAVIGATED } from '@/components/ScrollToTop';
import { ShellMark } from '@/components/SiteChrome';
import { Icon, type IconName } from '@/components/Icon';
import { useToast } from '@/components/feedback';
import type { Permission, SearchHit } from '@/domain/types';
import { clearSession } from '@/dev/session';

const GROUPS: Array<{ label: string; items: Array<{ id: string; label: string; icon: IconName; to: string; end?: boolean; permission: Permission; administratorOnly?: boolean }> }> = [
  { label: 'Workspace', items: [{ id: 'overview', label: 'Overview', icon: 'grid', to: '/admin', end: true, permission: 'content.read' }] },
  { label: 'Content', items: [
    { id: 'classes', label: 'Classes', icon: 'book', to: '/admin/classes', permission: 'content.read' },
    { id: 'timetable', label: 'Timetable', icon: 'calendar', to: '/admin/classes/timetable', permission: 'content.read' },
    { id: 'trainees', label: 'Trainees', icon: 'users', to: '/admin/trainees', permission: 'content.read' },
    { id: 'projects', label: 'Projects', icon: 'terminal', to: '/admin/projects', permission: 'content.read' },
    { id: 'events', label: 'Events', icon: 'calendar', to: '/admin/events', permission: 'content.read' },
    { id: 'media', label: 'Media library', icon: 'image', to: '/admin/media', permission: 'content.read' },
    { id: 'work-photos', label: 'Work photos', icon: 'upload', to: '/admin/work-photos', permission: 'content.read', administratorOnly: true },
  ] },
  { label: 'Pages', items: [
    { id: 'content', label: 'Content editor', icon: 'file', to: '/admin/content', permission: 'content.read' },
    { id: 'timeline', label: 'Timeline', icon: 'commit', to: '/admin/timeline', permission: 'content.read' },
    { id: 'about', label: 'About & 10 Years', icon: 'award', to: '/admin/about', permission: 'content.read' },
    { id: 'site-images', label: 'Site images', icon: 'image', to: '/admin/site-images', permission: 'content.read', administratorOnly: true },
  ] },
  { label: 'System', items: [
    { id: 'users', label: 'Users & roles', icon: 'users', to: '/admin/users', permission: 'users.read' },
    { id: 'enquiries', label: 'Enquiries', icon: 'mail', to: '/admin/enquiries', permission: 'users.manage' },
    { id: 'settings', label: 'Settings', icon: 'settings', to: '/admin/settings', permission: 'settings.manage' },
    { id: 'account', label: 'Account', icon: 'user', to: '/admin/account', permission: 'account.manage' },
    { id: 'states', label: 'UI states', icon: 'layers', to: '/admin/states', permission: 'content.read' },
  ] },
];

export function AdminLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mn-sb') === '1');
  const [drawer, setDrawer] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [unread, setUnread] = useState(true);
  useEffect(() => {
    document.body.classList.add('admin');
    return () => document.body.classList.remove('admin');
  }, []);
  useEffect(() => { setDrawer(false); }, [location.pathname, location.search, location.hash]);
  useEffect(() => {
    const close = () => setDrawer(false);
    window.addEventListener(APP_NAVIGATED, close);
    return () => window.removeEventListener(APP_NAVIGATED, close);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement?.tagName ?? ''))) {
        event.preventDefault();
        document.getElementById('admin-search')?.focus();
      }
      if (event.key === 'Escape') setDrawer(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const signOut = async () => {
    await api({ method: 'POST', path: '/auth/logout' });
    clearSession();
    navigate('/admin/login');
  };
  const search = async () => {
    if (!query.trim()) return;
    try {
      const results = await searchAdmin(query.trim());
      setHits(results);
      if (!results.length) toast('No matches', `Nothing matches “${query}”.`, 'info');
    } catch {
      toast('Search failed', 'The lists could not be searched.', 'error');
    }
  };
  const mock = usesMockApi();
  return (
    <>
      <CommunityIconLinks />
      <a className="skip-link" href="#main">Skip to content</a>
      {mock ? <div className="dev-banner"><strong>Development adapter.</strong> Sample data only. The live API is off for this session.</div> : null}
      <div className={`admin-shell${collapsed ? ' is-collapsed' : ''}${drawer ? ' drawer-open' : ''}`}>
        <aside className="admin-sidebar" id="admin-sidebar">
          <div className="sb-head">
            <Link className="sb-brand" to="/admin"><ShellMark /><span className="sb-text"><b>Bootcamp CMS</b><small>2026 cohort</small></span></Link>
            <button className="icon-btn sb-collapse" type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={() => {
              if (window.innerWidth <= 960) { setDrawer(false); return; }
              const next = !collapsed;
              setCollapsed(next);
              localStorage.setItem('mn-sb', next ? '1' : '0');
            }}><Icon name="sidebar" /></button>
          </div>
          <nav className="sb-nav" aria-label="Admin">
            {GROUPS.map((group) => {
              const items = group.items.filter((item) => auth.allowed(item.permission) && (!item.administratorOnly || auth.role === 'administrator'));
              if (!items.length) return null;
              return (
                <div className="sb-group" key={group.label}>
                  <span className="sb-label">{group.label}</span>
                  {items.map((item) => (
                    <NavLink key={item.id} to={item.to} end={item.end} className="sb-link" data-tip={item.label} onClick={() => setDrawer(false)}>
                      <Icon name={item.icon} /><span className="sb-text">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="sb-foot">
            <div className="sb-logo sb-text"><OfficialLogo width={130} /></div>
            <Link className="sb-link" to="/" data-tip="View site"><Icon name="external" /><span className="sb-text">View public site</span></Link>
          </div>
        </aside>
        <div className="sb-scrim" onClick={() => setDrawer(false)} />
        <div className="admin-body">
          <header className="admin-topbar">
            <button className="icon-btn tb-menu" type="button" aria-label="Open navigation" aria-expanded={drawer} aria-controls="admin-sidebar" onClick={() => setDrawer(true)}><Icon name="menu" /></button>
            <div className="tb-search input-icon">
              <Icon name="search" className="i--sm" />
              <input id="admin-search" className="input" type="search" placeholder="Search classes, trainees, events…" aria-label="Search admin" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void search(); }} />
              <kbd>/</kbd>
              {hits.length ? (
                <div className="popover" role="listbox" aria-label="Search results" style={{ display: 'block', top: '110%' }}>
                  {hits.map((hit) => <Link key={hit.href} to={hit.href} onClick={() => setHits([])}><b>{hit.type}</b> {hit.title}</Link>)}
                </div>
              ) : null}
            </div>
            {mock ? <span className="badge badge--warning tb-proto">Development adapter — sample data</span> : null}
            <div className={`tb-pop${notesOpen ? ' is-open' : ''}`}>
              <button className="icon-btn tb-bell" type="button" aria-label="Notifications" aria-expanded={notesOpen} onClick={() => { setNotesOpen((value) => !value); setUserOpen(false); }}>
                <Icon name="bell" />{unread ? <span className="tb-dot" /> : null}
              </button>
              <div className="popover" role="dialog" aria-label="Notifications">
                <div className="pop-head"><b>Notifications</b><button className="link" type="button" onClick={() => { setUnread(false); toast('All caught up', 'Sample notifications marked as read.'); }}>Mark all read</button></div>
                <ul className="notif-list">
                  <li className={unread ? 'is-unread' : ''}><Icon name="check-circle" /><div><b>Sample: class published</b><span>Week 3 — sample lesson is live</span></div></li>
                  <li className={unread ? 'is-unread' : ''}><Icon name="image" /><div><b>Sample: 4 photos uploaded</b><span>Awaiting alt text</span></div></li>
                  <li><Icon name="alert" /><div><b>Sample: consent pending</b><span>Photo release forms not yet recorded</span></div></li>
                </ul>
              </div>
            </div>
            <div className={`tb-pop${userOpen ? ' is-open' : ''}`}>
              <button className="tb-user" type="button" aria-label="Account menu" aria-expanded={userOpen} onClick={() => { setUserOpen((value) => !value); setNotesOpen(false); }}>
                <span className="avatar avatar--sm" style={{ ['--h' as string]: auth.hue }}>{auth.initials}</span>
                <span className="tb-user-name">{auth.displayName}</span>
                <Icon name="chevron-down" className="i--sm" />
              </button>
              <div className="popover popover--menu" role="menu">
                <Link role="menuitem" to="/admin/account" onClick={() => setUserOpen(false)}><Icon name="settings" className="i--sm" /> Account</Link>
                <Link role="menuitem" to="/" onClick={() => setUserOpen(false)}><Icon name="external" className="i--sm" /> View site</Link>
                <button role="menuitem" type="button" onClick={() => void signOut()}><Icon name="log-out" className="i--sm" /> Sign out</button>
              </div>
            </div>
          </header>
          <main id="main" className="admin-main" tabIndex={-1}><Outlet /></main>
        </div>
      </div>
    </>
  );
}
