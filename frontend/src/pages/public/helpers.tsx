import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Photo, Reveal, SplitHeading } from '@/components/Brand';
import { displayPhotoUrl } from '@/domain/photo';
import { LoadGate } from '@/components/Loader';
import { Crumbs, usePageMeta } from '@/components/SiteChrome';
import { ErrorState } from '@/components/feedback';
import { Icon } from '@/components/Icon';
import { MODULES } from '@/dev/fixtures';
import { APP_TODAY, formatDate, parseUtcDate } from '@/domain/format';
import type { ModuleId, ModuleInfo, PublicEvent, ScheduleStatus } from '@/domain/types';

export function TraineeArt({
  trainee,
  variant,
}: {
  trainee: { photoUrl?: string | null; displayName: string; initials: string; hue: number };
  variant: 'card' | 'profile';
}) {
  const photo = displayPhotoUrl(trainee.photoUrl);
  const className = variant === 'profile' ? 'profile-art mask-reveal is-in' : 'tcard__art';
  return (
    <div className={className} style={{ ['--h' as string]: trainee.hue }}>
      {photo ? (
        <img className="trainee-photo" src={photo} alt={trainee.displayName} />
      ) : (
        <>
          <span className="ph">{variant === 'profile' ? 'Placeholder portrait' : 'Placeholder'}</span>
          <Avatar initials={trainee.initials} hue={trainee.hue} size={variant === 'profile' ? 'lg' : undefined} />
        </>
      )}
    </div>
  );
}

export function moduleOf(id: ModuleId | string): ModuleInfo {
  const found = MODULES.find((item) => item.id === id);
  if (found) return found;
  const first = MODULES[0];
  if (!first) throw new Error('Module catalogue is empty.');
  return first;
}

/** Full-page gate. Empty copy is only rendered once loading has really finished. */
export function PublicGate({
  loading,
  error,
  errorTitle = 'This page could not be loaded',
  children,
}: {
  loading: boolean;
  error: string | null;
  errorTitle?: string;
  children: ReactNode;
}) {
  return (
    <LoadGate pending={loading} variant="page" message="Loading the bootcamp…">
      {error ? (
        <section className="section">
          <div className="container">
            <ErrorState title={errorTitle} text={error} onRetry={() => window.location.reload()} />
          </div>
        </section>
      ) : children}
    </LoadGate>
  );
}

export function SampleMark({ listing, children }: { listing?: string; children: string }) {
  if (listing === 'public') return null;
  return <span className="ph">{children}</span>;
}

export function scheduleText(status: ScheduleStatus): string {
  if (status === 'now') return 'This week';
  if (status === 'done') return 'Completed';
  return 'Upcoming';
}

export function PageIntro({
  title,
  crumbs,
  eyebrow,
  headline,
  aside,
  dark = false,
  children,
}: {
  title: string;
  crumbs: Array<{ label: string; to?: string }>;
  eyebrow: string;
  headline: string;
  aside?: ReactNode;
  dark?: boolean;
  children?: ReactNode;
}) {
  usePageMeta(title);
  return (
    <section className={`page-hero${dark ? ' page-hero--dark' : ''}`} style={dark ? { paddingBottom: 0 } : undefined}>
      <div className="container" style={{ position: 'relative' }}>
        <Crumbs items={crumbs} />
        <div className="split" style={{ alignItems: 'end' }}>
          <div className="split__a" style={{ gridColumn: '1 / span 7' }}>
            <Reveal><span className="eyebrow">{eyebrow}</span></Reveal>
            <SplitHeading as="h1" className="h1" text={headline} />
          </div>
          {aside ? <div className="split__b" style={{ gridColumn: '9 / span 4' }}>{aside}</div> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export function EventRow({ event, index = 0 }: { event: PublicEvent; index?: number }) {
  const day = event.dateTbc ? 'TBC' : String(parseUtcDate(event.date).getUTCDate()).padStart(2, '0');
  const month = event.dateTbc ? 'Oct 2026' : formatDate(event.date, { day: undefined, month: 'short', year: 'numeric' });
  const past = !event.dateTbc && parseUtcDate(event.date) < APP_TODAY;
  return (
    <Reveal i={index}>
      <Link className="ev" to={`/events/${event.id}`}>
        <div className="ev__date"><b>{day}</b><span>{month}</span></div>
        <div>
          <div className="flex wrap" style={{ gap: 8, marginBottom: 10 }}>
            <span className="tag">{event.kind}</span>
            {event.verified ? <span className="verified">Verified</span> : null}
            {event.dateTbc ? <span className="tbc">Details to be confirmed</span> : null}
            {event.sample ? <span className="ph">Sample milestone</span> : null}
            {past && !event.dateTbc && !event.sample ? null : null}
          </div>
          <h3>{event.title}</h3>
          <div className="ev__meta">
            <span><Icon name="clock" className="i--sm" />{event.whenLabel}</span>
            <span><Icon name="map-pin" className="i--sm" />{event.place}</span>
          </div>
        </div>
        <div className="ev__img"><Photo file={event.image} alt="" width={800} height={533} sizes="180px" /></div>
        <span className="go"><Icon name="arrow-right" /></span>
      </Link>
    </Reveal>
  );
}

export function useTimelineProgress(active: boolean) {
  const [reached, setReached] = useState(0);
  useEffect(() => {
    if (!active) return;
    let removeScroll = () => {};
    let observer: MutationObserver | undefined;
    const attach = () => {
      const root = document.querySelector<HTMLElement>('[data-tl]');
      const bar = root?.querySelector<HTMLElement>('.tl__progress');
      const items = [...(root?.querySelectorAll<HTMLElement>('.tl__item') ?? [])];
      if (!root || !bar) return false;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        bar.style.height = 'calc(100% - 16px)';
        setReached(items.length);
        return true;
      }
      const update = () => {
        const rect = root.getBoundingClientRect();
        const mid = window.innerHeight * 0.6;
        const progress = rect.height ? Math.max(0, Math.min(1, (mid - rect.top) / rect.height)) : 0;
        bar.style.height = `${progress * (rect.height - 16)}px`;
        setReached(items.filter((item) => item.getBoundingClientRect().top < mid).length);
      };
      update();
      window.addEventListener('scroll', update, { passive: true });
      removeScroll = () => window.removeEventListener('scroll', update);
      return true;
    };
    if (!attach()) {
      observer = new MutationObserver(() => {
        if (attach()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    return () => {
      removeScroll();
      observer?.disconnect();
    };
  }, [active]);
  return reached;
}

export function downloadCalendar(event: PublicEvent) {
  const stamp = event.date.replace(/-/g, '');
  const timed = Boolean(event.startTime);
  const start = timed ? `${stamp}T${event.startTime.replace(':', '')}00` : stamp;
  const endLine = event.endTime ? `DTEND:${stamp}T${event.endTime.replace(':', '')}00\n` : '';
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Maxim Nyansa Foundation//Bootcamp 2026//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@bootcamp.local`,
    `DTSTART${timed ? '' : ';VALUE=DATE'}:${start}`,
    endLine.trim(),
    `SUMMARY:${event.title}`,
    `LOCATION:${event.place}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${event.id}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}
