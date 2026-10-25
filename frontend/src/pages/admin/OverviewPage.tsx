import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { ErrorState, LoadingRows, StatusBadge } from '@/components/feedback';
import { usePageMeta } from '@/components/SiteChrome';
import { usesMockApi } from '@/config/runtime';
import { moduleName } from '@/dev/fixtures';
import { currentWeek, formatDate } from '@/domain/format';
import type { BootcampEvent, Lesson, MediaItem, Page, Trainee } from '@/domain/types';
import { useContent } from '@/hooks/useContent';
import { useAsync } from '@/hooks/useAsync';

export function OverviewPage() {
  const auth = useAuth();
  const mock = usesMockApi();
  const store = useContent();
  const remote = useAsync('admin-overview', async () => {
    const [classes, trainees, events, media] = await Promise.all([
      api<Page<Lesson>>({ method: 'GET', path: '/admin/classes', query: { page: 1, pageSize: 50, sort: 'week', dir: 'asc' } }),
      api<Page<Trainee>>({ method: 'GET', path: '/admin/trainees', query: { page: 1, pageSize: 50 } }),
      api<Page<BootcampEvent>>({ method: 'GET', path: '/admin/events', query: { page: 1, pageSize: 50 } }),
      api<MediaItem[]>({ method: 'GET', path: '/admin/media' }),
    ]);
    return { lessons: classes.items, trainees: trainees.items, events: events.items, media };
  }, !mock);
  usePageMeta('Overview');
  const source = mock ? store : remote.data;
  if (!mock && remote.loading) return <LoadingRows />;
  if (!mock && remote.error) return <ErrorState title="Overview unavailable" text={remote.error.message} />;
  const lessons = source?.lessons ?? [];
  const trainees = source?.trainees ?? [];
  const media = source?.media ?? [];
  const events = source?.events ?? [];
  const week = currentWeek();
  const published = lessons.filter((lesson) => lesson.scheduleStatus !== 'upcoming').length;
  const review = events.filter((event) => event.dateTbc).length + media.filter((item) => item.consent === 'pending').length;
  const upcoming = lessons.filter((lesson) => lesson.scheduleStatus !== 'done').slice(0, 5);
  const hour = new Date().getUTCHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <>
      <div className="a-head">
        <div><span className="a-sub">{formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{mock ? ' · development clock' : ''}</span><h1>{hello}, {auth.displayName || 'there'}</h1><p>{mock ? 'Here’s the 2026 cohort in the development adapter. Counts are fixture totals, not live analytics.' : 'Counts come from the admin lists. They are records in the API, not analytics.'}</p></div>
        <div className="a-head__actions">
          <Link className="btn btn--ghost btn--sm" to="/"><Icon name="eye" className="i--sm" />View site</Link>
          {auth.allowed('content.write') ? <Link className="btn btn--dark btn--sm" to="/admin/classes/new"><Icon name="plus" className="i--sm" />New class</Link> : null}
        </div>
      </div>
      <div className="a-stats">
        <div className="a-stat a-stat--dark"><div className="a-stat__top">Cohort progress<span className="a-stat__ic"><Icon name="flag" className="i--sm" /></span></div><b>Week {week}</b><small>of 12 · 5 Oct – 25 Dec 2026</small><div className="mini-bar"><span style={{ width: `${(week / 12) * 100}%` }} /></div></div>
        <div className="a-stat"><div className="a-stat__top">Classes past week 1<span className="a-stat__ic"><Icon name="book" className="i--sm" /></span></div><b>{published}</b><small>Sample count</small></div>
        <div className="a-stat"><div className="a-stat__top">Trainee profiles<span className="a-stat__ic"><Icon name="users" className="i--sm" /></span></div><b>{trainees.length}</b><small>All labelled samples</small></div>
        <div className="a-stat"><div className="a-stat__top">Items needing review<span className="a-stat__ic"><Icon name="alert" className="i--sm" /></span></div><b>{review}</b><small>TBC events and consent records</small></div>
      </div>
      <div className="a-grid">
        <section className="panel span-8" aria-labelledby="h-wk">
          <div className="panel__head"><h2 id="h-wk">Classes by week</h2></div>
          <div className="panel__body"><div className="chart" role="img" aria-label="Classes per week. Completed weeks are darker, the current week is highlighted, later weeks are scheduled.">{lessons.map((lesson, index) => <div className="chart__col" key={lesson.id}><div className={`chart__bar${lesson.scheduleStatus === 'done' ? ' is-done' : lesson.scheduleStatus === 'now' ? ' is-now' : ''}`} style={{ height: `${40 + ((lesson.week * 37) % 50)}%`, ['--i' as string]: index }} title={`Week ${lesson.week}: ${lesson.title}`} /><small>W{lesson.week}</small></div>)}</div></div>
        </section>
        <section className="panel span-4">
          <div className="panel__head"><h2>Quick actions</h2></div>
          <div className="panel__body quick">
            <Link to="/admin/classes/timetable"><Icon name="calendar" />Open the timetable</Link>
            <Link to="/admin/classes/new"><Icon name="plus" />Add a class</Link>
            <Link to="/admin/media"><Icon name="upload" />Media library</Link>
            <Link to="/admin/events/new"><Icon name="calendar" />Create event</Link>
            <Link to="/admin/content"><Icon name="edit" />Edit homepage</Link>
          </div>
        </section>
        <section className="panel span-7">
          <div className="panel__head"><h2>Coming up</h2><Link className="link" to="/admin/classes">All classes</Link></div>
          <div className="table-wrap"><table className="table table--cards"><thead><tr><th>Class</th><th>Week</th><th>Status</th></tr></thead><tbody>
            {upcoming.map((lesson) => <tr key={lesson.id}><td><b>{lesson.title}</b><small>{moduleName(lesson.moduleId)}</small></td><td>W{lesson.week} · {formatDate(lesson.date)}</td><td><StatusBadge status={lesson.scheduleStatus} /></td></tr>)}
          </tbody></table></div>
        </section>
        <section className="panel span-5">
          <div className="panel__head"><h2>Recent activity</h2><span className="badge badge--warning">Sample</span></div>
          <ul className="activity">
            <li><span className="a-ic"><Icon name="check-circle" className="i--sm" /></span><div><b>Sample activity only</b><br /><span className="muted">The adapter does not record an audit log yet.</span></div></li>
          </ul>
        </section>
        <section className="panel span-12">
          <div className="panel__head"><h2>Before a real launch</h2></div>
          <ul className="activity">
            <li><span className="a-ic"><Icon name="image" className="i--sm" /></span><div><b>Photo consent records</b><br /><span className="muted">The owner confirmed consent for the included photos. Individual release metadata is still a placeholder.</span></div><Link className="btn btn--ghost btn--xs" to="/admin/media">Review</Link></li>
            <li><span className="a-ic"><Icon name="calendar" className="i--sm" /></span><div><b>Hackathon details</b><br /><span className="muted">Date, venue and whether bootcamp trainees took part are to be confirmed.</span></div><Link className="btn btn--ghost btn--xs" to="/admin/events/hackathon">Edit</Link></li>
            <li><span className="a-ic"><Icon name="book" className="i--sm" /></span><div><b>12-week timetable</b><br /><span className="muted">The workbook sets 12 weeks, from 5 October to 25 December 2026. Lesson notes are still samples.</span></div><Link className="btn btn--ghost btn--xs" to="/admin/classes/timetable">Open</Link></li>
            <li><span className="a-ic"><Icon name="award" className="i--sm" /></span><div><b>Foundation figures</b><br /><span className="muted">Permission to display the impact counters is still TBC.</span></div><Link className="btn btn--ghost btn--xs" to="/admin/about">Open</Link></li>
          </ul>
        </section>
      </div>
    </>
  );
}
