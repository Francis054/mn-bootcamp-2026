import { Outlet, useLocation } from 'react-router-dom';
import { CommunityIconLinks } from '@/components/Brand';
import { PageTransition, ProtoFlag, SiteFooter, SiteHeader } from '@/components/SiteChrome';

const PAGES: Record<string, { page: string; tone: 'light' | 'dark' }> = {
  '/': { page: 'home', tone: 'dark' },
  '/bootcamp': { page: 'overview', tone: 'dark' },
  '/journey': { page: 'journey', tone: 'light' },
  '/classes': { page: 'classes', tone: 'light' },
  '/projects': { page: 'projects', tone: 'dark' },
  '/trainees': { page: 'trainees', tone: 'light' },
  '/events': { page: 'events', tone: 'light' },
  '/gallery': { page: 'gallery', tone: 'light' },
  '/about': { page: 'about', tone: 'light' },
  '/anniversary': { page: 'anniversary', tone: 'dark' },
  '/contact': { page: 'contact', tone: 'light' },
};

export function PublicLayout() {
  const { pathname } = useLocation();
  const key = pathname.startsWith('/classes/') ? '/classes' : pathname.startsWith('/projects/') ? '/projects' : pathname.startsWith('/trainees/') ? '/trainees' : pathname.startsWith('/events/') ? '/events' : pathname;
  const handle = PAGES[key] ?? { page: '', tone: 'light' as const };
  return (
    <>
      <CommunityIconLinks />
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader page={handle.page ?? ''} tone={handle.tone ?? 'light'} />
      <main id="main"><Outlet /></main>
      <SiteFooter />
      <ProtoFlag />
      <PageTransition />
    </>
  );
}
