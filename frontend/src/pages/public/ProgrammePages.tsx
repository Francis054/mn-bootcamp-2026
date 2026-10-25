import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Photo, Reveal } from '@/components/Brand';
import { Crumbs, usePageMeta } from '@/components/SiteChrome';
import { Chips, Tabs } from '@/components/controls';
import { EmptyState, ErrorState } from '@/components/feedback';
import { Icon, type IconName } from '@/components/Icon';
import { Netlines } from '@/components/Netlines';
import { MODULES } from '@/dev/fixtures';
import { currentWeek, formatDate, parseUtcDate } from '@/domain/format';
import { blockForWeek, outlineLines, weeksOf, type TrainerRef } from '@/domain/timetable';
import { usePublicContent } from '@/hooks/useContent';
import { useTimetable } from '@/hooks/useTimetable';
import { moduleOf, PageIntro, PublicGate, SampleMark, scheduleText, useTimelineProgress } from './helpers';

const OVERVIEW_STEPS = [
  { title: 'Hands-on practice', text: 'Learning by doing, in labs and on real tools rather than slides alone.' },
  { title: 'Soft skills', text: 'Communication, teamwork and presenting findings, all part of the programme.' },
  { title: 'Career coaching', text: 'Support to turn new skills into job applications and interviews.' },
  { title: 'A real-life project', text: 'Each bootcamp includes a practical project applied to a real problem.' },
] as const;

export function BootcampPage() {
  const timetable = useTimetable();
  const week = timetable.data?.currentWeek ?? currentWeek();
  const ends = timetable.data?.programme?.endsOn ?? '2026-12-25';
  const blocks = timetable.data?.blocks ?? [];
  return (
    <>
      <PageIntro dark backdrop={<Netlines />} headlineClassName="is-wide" title="Bootcamp overview" crumbs={[{ label: 'Home', to: '/' }, { label: 'Bootcamp' }, { label: 'Overview' }]} eyebrow="Cyber Security Bootcamp 2026" headline={'Six disciplines.\nOne cohort.\nZero cost.'} aside={<><Reveal><p className="lead">A practical, in-person programme at the Maxim Nyansa Foundation in Accra, built around the skills security teams hire for. Training runs from 5 October to {formatDate(ends, { year: 'numeric' })}.</p></Reveal><Reveal><div className="flex wrap" style={{ marginTop: 24 }}><Link className="btn" to="/journey">Follow the journey <span className="arrow"><Icon name="arrow-right" className="i--sm" /></span></Link><Link className="btn btn--ghost-light" to="/schedule">See the timetable <span className="arrow"><Icon name="arrow-right" className="i--sm" /></span></Link><a className="btn btn--ghost-light" href="https://maximnyansaapplications.com/" target="_blank" rel="noopener">Applications site <Icon name="external" className="i--sm" /></a></div></Reveal></>}>
        <dl className="facts" style={{ marginTop: 64 }}>
          <div><dt>Training starts</dt><dd>5 Oct 2026</dd></div>
          <div><dt>Training ends</dt><dd>{formatDate(ends, { year: 'numeric' })}</dd></div>
          <div><dt>Format</dt><dd>In person</dd></div>
          <div><dt>Cost</dt><dd>Free</dd></div>
          <div><dt>Venue</dt><dd>Foundation premises</dd></div>
        </dl>
        <figure className="detail-media mask-reveal is-in" style={{ marginTop: 64 }}><Photo file="electronics-lab" alt="Hands-on work at a Foundation build table" width={1600} height={1066} sizes="100vw" priority /></figure>
      </PageIntro>
      <section className="section" aria-labelledby="mod-title">
        <div className="container">
          <div className="sec-head">
            <div className="sec-head__title"><Reveal><span className="eyebrow">Curriculum</span></Reveal><Reveal><h2 id="mod-title" className="h2">What the cohort learns.</h2></Reveal></div>
            <Reveal className="sec-head__aside"><p className="muted">The six areas below are confirmed by the Foundation. Their order and weekly split are still to be confirmed.</p><span className="verified">Topics verified</span></Reveal>
          </div>
          <div className="modules">
            {MODULES.map((module, index) => (
              <article className="module" key={module.id}>
                <span className="mi"><Icon name={module.icon as IconName} /></span>
                <div>
                  <span className="n">Module {String(index + 1).padStart(2, '0')}</span>
                  <h3>{module.name}</h3>
                  <p className="muted">{module.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section section--paper" aria-labelledby="blocks-title">
        <div className="container">
          <div className="sec-head">
            <div className="sec-head__title"><Reveal><span className="eyebrow">The three blocks</span></Reveal><Reveal><h2 id="blocks-title" className="h2">Twelve weeks on the timetable.</h2></Reveal></div>
            <Reveal className="sec-head__aside"><p className="muted">Block names, week order and topics come from the timetable. Sample lesson notes in the archive use a separate set of tags.</p><Link className="link" to="/schedule">Daily timetable <Icon name="arrow-right" className="i--sm" /></Link></Reveal>
          </div>
          <div className="modules">
            {blocks.map((block) => (
              <article className="module" key={block.id}>
                <span className="mi" aria-hidden="true">{String(block.sortOrder).padStart(2, '0')}</span>
                <div>
                  <span className="n">Block {String(block.sortOrder).padStart(2, '0')}</span>
                  <h3>{block.name}</h3>
                  <p className="muted">{block.professionalismTheme}. {block.cybersecurityTheme}.</p>
                  <ul className="objectives">{block.weeks.map((item) => <li key={item.id}><span>Week {item.number} · {item.title}</span></li>)}</ul>
                  <Link className="link" to={`/schedule?week=${block.weeks[0]?.number ?? 1}`}>Open this block <Icon name="arrow-right" className="i--sm" /></Link>
                </div>
              </article>
            ))}
          </div>
          {timetable.loading ? <p className="muted" style={{ marginTop: 28 }}>Loading the timetable.</p> : null}
          {timetable.error ? <p className="muted" style={{ marginTop: 28 }}>{timetable.error.message}</p> : null}
          <p className="muted" style={{ marginTop: 28 }}>Week {week} of 12. Week 12 includes integrated exam revision and a 40-question mock assessment.</p>
        </div>
      </section>
      <section className="section section--paper" aria-labelledby="how-title">
        <div className="container split">
          <div className="split__a">
            <div className="sticky">
              <Reveal><span className="eyebrow">How training works</span></Reveal>
              <Reveal><h2 id="how-title" className="h2" style={{ margin: '20px 0' }}>Practical first. Career-ready by design.</h2></Reveal>
              <Reveal><p className="muted">The Foundation’s IT professional training combines technical practice with the skills that help graduates get hired.</p></Reveal>
              <Reveal><figure className="photo" style={{ marginTop: 32, aspectRatio: '4 / 3' }}><Photo file="presenters-yellow-room" alt="Presenters speaking to a room" width={1600} height={1066} sizes="(max-width:900px) 100vw, 40vw" /></figure></Reveal>
            </div>
          </div>
          <div className="split__b">
            <ol className="steps">
              {OVERVIEW_STEPS.map((step) => (
                <li key={step.title}><h4>{step.title}</h4><p className="muted">{step.text}</p></li>
              ))}
              <li><h4>Certification exams</h4><p className="muted">Foundation bootcamps include EXIN certification exams. <span className="tbc">Exams for this cohort to be confirmed</span></p></li>
            </ol>
            <Reveal><div className="callout callout--lime" style={{ marginTop: 16 }}><h3>Where it all started</h3><p>The Foundation piloted its first cybersecurity bootcamp in 2020 with 14 trainees. The 2026 cohort builds on that pilot.</p></div></Reveal>
          </div>
        </div>
      </section>
      <section className="section" aria-labelledby="faq-title">
        <div className="container split">
          <div className="split__a"><Reveal><span className="eyebrow">Questions</span></Reveal><Reveal><h2 id="faq-title" className="h2" style={{ marginTop: 20 }}>Good to know.</h2></Reveal></div>
          <div className="split__b">
            <details className="faq" open><summary>Does the bootcamp cost anything?<span className="pm"><Icon name="plus" className="i--sm" /></span></summary><div className="faq-body">No. The 2026 Cyber Security Bootcamp is free.</div></details>
            <details className="faq"><summary>Where does training happen?<span className="pm"><Icon name="plus" className="i--sm" /></span></summary><div className="faq-body">In person at the Maxim Nyansa Foundation premises, Coral Avenue – Tantra Hills, Accra.</div></details>
            <details className="faq"><summary>When does it run?<span className="pm"><Icon name="plus" className="i--sm" /></span></summary><div className="faq-body">Training started on 5 October 2026 and ends on {formatDate(ends, { year: 'numeric' })}. The graduation date is still to be confirmed.</div></details>
            <details className="faq"><summary>Can I still apply?<span className="pm"><Icon name="plus" className="i--sm" /></span></summary><div className="faq-body">Applications were taken through maximnyansaapplications.com. This cohort has already started, so watch the Foundation’s channels for the next intake. <span className="ph">Next intake copy to be confirmed</span></div></details>
            <details className="faq"><summary>How long is the programme?<span className="pm"><Icon name="plus" className="i--sm" /></span></summary><div className="faq-body">About three months. The Foundation’s pages describe bootcamp lengths of 12 to 18 weeks, so the exact length for 2026 is to be confirmed.</div></details>
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <Reveal reveal="scale"><div className="cta-block"><h2>See the plan week by week.</h2><div className="cta-side"><p>Follow the indicative timeline from week one to graduation.</p><Link className="btn btn--dark" to="/journey">Open the journey <span className="arrow"><Icon name="arrow-right" className="i--sm" /></span></Link></div></div></Reveal>
        </div>
      </section>
    </>
  );
}

export function JourneyPage() {
  const { events, loading, error } = usePublicContent();
  const timetable = useTimetable();
  const [blockId, setBlockId] = useState('all');
  const reached = useTimelineProgress(true);
  const weekNumber = timetable.data?.currentWeek ?? currentWeek();
  const blocks = timetable.data?.blocks ?? [];
  const visible = weeksOf(timetable.data).filter((item) => blockId === 'all' || blockForWeek(timetable.data ?? { blocks }, item.number)?.id === blockId);
  return (
    <PublicGate loading={loading || timetable.loading} error={error ?? timetable.error?.message ?? null}>
    <>
      <PageIntro title="Journey" crumbs={[{ label: 'Home', to: '/' }, { label: 'Bootcamp' }, { label: 'Journey' }]} eyebrow="Timeline · 5 Oct – 25 Dec 2026" headline={'Twelve weeks,\none milestone\nat a time.'} aside={<><Reveal><p className="lead">The weekly plan is the timetable: three blocks, from 5 October to 25 December 2026.</p></Reveal><Reveal><div className="flex wrap" style={{ marginTop: 16 }}><span className="verified">Dates on the timetable</span><Link className="link" to="/schedule">Daily timetable <Icon name="arrow-right" className="i--sm" /></Link></div></Reveal></>}>
        <div className="cohort-bar" style={{ marginTop: 56, color: 'var(--ink)' }}><span className="label">5 Oct</span><div className="meter" style={{ ['--p' as string]: weekNumber / 12, background: 'var(--line)' }}><i /></div><span className="label">25 Dec</span><span className="badge badge--lime">Week {weekNumber} · in progress</span></div>
      </PageIntro>
      <section className="section" style={{ paddingTop: 'var(--s-9)' }}>
        <div className="container jt">
          <aside className="jt__side">
            <div className="sticky">
              <Tabs label="Filter timeline" value={blockId} onChange={setBlockId} tabs={[{ id: 'all', label: 'All' }, ...blocks.map((block) => ({ id: block.id, label: `Block ${block.sortOrder}` }))]} />
              <nav className="toc" style={{ marginTop: 32 }} aria-label="Blocks">
                {blocks.map((item) => <a key={item.id} href={`#ph-${item.id}`}>Block {item.sortOrder} · {item.name}</a>)}
              </nav>
              <div className="callout" style={{ marginTop: 32 }}>
                <h3>Legend</h3>
                <p style={{ display: 'grid', gap: 10, fontSize: 14 }}><span className="st st--done">Completed</span><span className="st st--now">This week</span><span className="st st--upcoming">Upcoming</span></p>
              </div>
            </div>
          </aside>
          <div className="jt__main">
            {visible.length ? <ol className="tl" data-tl>
              <li className="tl__progress" aria-hidden="true" />
              {blocks.filter((item) => blockId === 'all' || item.id === blockId).map((item) => (
                <li className="tl__phase" id={`ph-${item.id}`} key={item.id}>Block {item.sortOrder} · {item.name}</li>
              ))}
              {visible.map((item, index) => {
                const status = item.number < weekNumber ? 'done' : item.number === weekNumber ? 'now' : 'upcoming';
                const end = parseUtcDate(item.startsOn);
                end.setUTCDate(end.getUTCDate() + 7);
                const markers = events.filter((event) => event.id !== 'graduation' && !event.dateTbc && parseUtcDate(event.date) >= parseUtcDate(item.startsOn) && parseUtcDate(event.date) < end);
                return (
                  <span key={item.id} style={{ display: 'contents' }}>
                    {markers.map((event) => (
                      <li className={`tl__item tl__item--milestone${index < reached ? ' is-reached' : ''}`} key={event.id}>
                        <span className="tl__dot" />
                        <Link className="tl__card" to={`/events/${event.id}`}><span className="tl__date">{event.whenLabel}</span><h3>{event.title}</h3><p style={{ opacity: 0.8, fontSize: 15 }}>{event.summary}</p></Link>
                      </li>
                    ))}
                    <li className={`tl__item${status === 'now' ? ' is-now' : ''}${index < reached ? ' is-reached' : ''}`}>
                      <span className="tl__dot" />
                      <Link className="tl__card" to={`/schedule?week=${item.number}`}>
                        <div className="flex wrap" style={{ gap: 10, justifyContent: 'space-between' }}><span className="tl__date">Week {item.number} · w/c {formatDate(item.startsOn)}</span><span className={`st st--${status}`}>{scheduleText(status)}</span></div>
                        <h3>{item.title}</h3>
                        <p className="muted" style={{ fontSize: 15 }}>{outlineLines(item.cybersecurity)[0]}</p>
                      </Link>
                    </li>
                  </span>
                );
              })}
              {events.filter((event) => event.id === 'graduation').map((event) => (
                <li className="tl__item tl__item--milestone" key={event.id}><span className="tl__dot" /><Link className="tl__card" to={`/events/${event.id}`}><span className="tl__date">{event.whenLabel}</span><h3>{event.title}</h3><p>{event.summary}</p><span className="tbc">Ceremony details to be confirmed</span></Link></li>
              ))}
            </ol> : <EmptyState icon="calendar" title="The timetable is not available" text="Week titles appear here from the published schedule. The start and end dates are 5 October and 25 December 2026." />}
          </div>
        </div>
      </section>
    </>
    </PublicGate>
  );
}

export function ClassesPage() {
  const { lessons, loading, error } = usePublicContent();
  const [params] = useSearchParams();
  const [moduleId, setModuleId] = useState(params.get('module') ?? 'all');
  const [status, setStatus] = useState(params.get('status') ?? 'all');
  const [sort, setSort] = useState<'asc' | 'desc'>('asc');
  const filtered = useMemo(() => {
    const rows = lessons.filter((lesson) => (moduleId === 'all' || lesson.moduleId === moduleId) && (status === 'all' || lesson.scheduleStatus === status));
    return [...rows].sort((a, b) => (sort === 'desc' ? b.week - a.week : a.week - b.week));
  }, [lessons, moduleId, sort, status]);
  return (
    <PublicGate loading={loading} error={error}>
    <>
      <PageIntro title="Class archive" crumbs={[{ label: 'Home', to: '/' }, { label: 'Bootcamp' }, { label: 'Classes' }]} eyebrow="Class archive" headline={'Every lesson,\nin one place.'} aside={<><p className="lead">These cards are sample lesson notes. The daily timetable is the schedule.</p><Link className="link" to="/schedule" style={{ marginTop: 16 }}>Open the timetable <Icon name="arrow-right" className="i--sm" /></Link></>} />
      <section className="section" style={{ paddingTop: 'var(--s-7)' }}>
        <div className="container">
          <p className="muted" style={{ marginBottom: 16 }}>The filters below are archive tags from the sample catalogue. They are not the three blocks on the timetable.</p>
          <Tabs label="Filter by archive tag" value={moduleId} onChange={setModuleId} tabs={[{ id: 'all', label: 'All tags' }, ...MODULES.map((module) => ({ id: module.id, label: module.short }))]} />
          <div className="toolbar" style={{ marginTop: 24 }}>
            <Chips label="Filter by status" value={status} onChange={setStatus} options={[{ id: 'all', label: 'All weeks' }, { id: 'done', label: 'Completed' }, { id: 'now', label: 'This week' }, { id: 'upcoming', label: 'Upcoming' }]} />
            <label className="select-wrap" style={{ marginLeft: 'auto' }}><span className="sr-only">Sort</span>
              <select className="select" value={sort} onChange={(event) => setSort(event.target.value === 'desc' ? 'desc' : 'asc')}><option value="asc">Oldest first</option><option value="desc">Newest first</option></select>
            </label>
            <span className="result-count" aria-live="polite">{filtered.length} of {lessons.length} classes</span>
          </div>
          {!loading && !error && lessons.length === 0 ? <EmptyState icon="layers" title="No classes are published yet" text="Lessons appear here after they are saved and published. A hidden listing stays off this page." /> : filtered.length ? (
            <div className="lesson-grid">
              {filtered.map((lesson) => (
                <Link className="card lesson-card" to={`/classes/${lesson.id}`} key={lesson.id}>
                  <div className="card__media" style={{ position: 'relative' }}><span className="wkbig">{String(lesson.week).padStart(2, '0')}</span><Photo file={lesson.cover} alt="" width={800} height={533} sizes="(max-width:700px) 100vw, 33vw" /></div>
                  <div className="card__body">
                    <div className="card__meta"><span className="tag">{moduleOf(lesson.moduleId).short}</span><span className={`st st--${lesson.scheduleStatus}`}>{scheduleText(lesson.scheduleStatus)}</span></div>
                    <h3 className="card__title">{lesson.title}</h3>
                    <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>w/c {formatDate(lesson.date)} · {lesson.format}</p>
                  </div>
                  <div className="card__foot"><SampleMark listing={lesson.listing}>Sample lesson</SampleMark><span className="go"><Icon name="arrow-right" className="i--sm" /></span></div>
                </Link>
              ))}
            </div>
          ) : <EmptyState title="No classes match" text="Try another module or status." action={<button className="btn btn--ghost btn--sm" type="button" onClick={() => { setModuleId('all'); setStatus('all'); }}>Reset filters</button>} />}
        </div>
      </section>
    </>
    </PublicGate>
  );
}

export function LessonPage() {
  const { id = '' } = useParams();
  const { lessons, loading, error } = usePublicContent();
  const timetable = useTimetable();
  const lesson = lessons.find((item) => item.id === id);
  const index = lessons.findIndex((item) => item.id === id);
  const previous = index > 0 ? lessons[index - 1] : undefined;
  const next = index >= 0 ? lessons[index + 1] : undefined;
  usePageMeta(lesson?.title ?? 'Lesson');
  const module = lesson ? moduleOf(lesson.moduleId) : null;
  return (
    <PublicGate loading={loading} error={error} errorTitle="This lesson could not be loaded">
    {!lesson || !module ? (
      <section className="section"><div className="container"><ErrorState title="This lesson is not available" text="It may be a draft, hidden, or the link may be wrong. Public pages only show published or labelled sample lessons." /></div></section>
    ) : (
    <>
      <section className="detail-hero">
        <div className="container">
          <Crumbs items={[{ label: 'Home', to: '/' }, { label: 'Classes', to: '/classes' }, { label: `Week ${lesson.week}` }]} />
          <div className="flex wrap" style={{ gap: 10, marginTop: 8 }}><span className="tag">Archive tag · {module.name}</span><span className={`st st--${lesson.scheduleStatus}`}>{scheduleText(lesson.scheduleStatus)}</span><SampleMark listing={lesson.listing}>Sample lesson content</SampleMark></div>
          <h1>{lesson.title}</h1>
          <div className="meta-row"><span><Icon name="calendar" className="i--sm" />Week {lesson.week} · w/c {formatDate(lesson.date, { weekday: 'short', year: 'numeric' })}</span><span><Icon name="clock" className="i--sm" />{lesson.format}</span><span><Icon name="map-pin" className="i--sm" />{lesson.room || 'Tantra Hills, Accra'}</span></div>
          <figure className="detail-media mask-reveal is-in"><Photo file={lesson.cover} alt="" width={1600} height={1066} sizes="100vw" priority /></figure>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 'var(--s-9)' }}>
        <div className="container lesson-layout">
          <aside className="lesson-layout__side"><nav className="toc sticky" aria-label="On this page"><a href="#overview" className="is-active">Overview</a><a href="#objectives">Objectives</a><a href="#lab">Lab walkthrough</a><a href="#resources">Resources</a></nav></aside>
          <article className="lesson-layout__main prose-wrap">
            <section id="overview"><h2>Overview</h2><p className="lead">{lesson.summary}</p><p className="muted" style={{ marginTop: 16 }}>This is a sample lesson note. The daily timetable is the schedule. Objectives and the lab below are still placeholders.</p></section>
            <section id="objectives"><h2>Objectives</h2>{lesson.objectives.length ? <ul className="objectives">{lesson.objectives.map((item) => <li key={item}><Icon name="check-circle" /><span>{item}</span></li>)}</ul> : <p className="muted">Objectives will be added with the lesson notes.</p>}</section>
            <section id="lab"><h2>Lab walkthrough</h2>
              <ol className="steps">
                <li><h4>Set up the lab environment</h4><p className="muted">{lesson.lab}</p></li>
                <li><h4>Run the exercise</h4><p className="muted">Follow the guided task in pairs, only on the isolated lab machines, and record what you observe.</p><pre className="code">{lesson.codeSample}</pre></li>
                <li><h4>Debrief</h4><p className="muted">Share findings with the group and note what you would do differently.</p></li>
              </ol>
            </section>
            <section id="resources"><h2>Resources</h2>
              <div className="res"><Icon name="file" /><span style={{ flex: 1 }}>Lesson slides (PDF)</span><button className="btn btn--ghost btn--xs" type="button" disabled>Available after class</button></div>
              <div className="res"><Icon name="terminal" /><span style={{ flex: 1 }}>Lab instructions</span><button className="btn btn--ghost btn--xs" type="button" disabled>Available after class</button></div>
              <div className="res"><Icon name="play" /><span style={{ flex: 1 }}>Session recording</span><span className="tbc">Recording policy TBC</span></div>
            </section>
            <nav className="pager" aria-label="Lesson navigation">
              {previous ? <Link to={`/classes/${previous.id}`}><small><Icon name="arrow-left" className="i--sm" /> Previous · Week {previous.week}</small><b>{previous.title}</b></Link> : <span>First lesson</span>}
              {next ? <Link className="next" to={`/classes/${next.id}`}><small>Next · Week {next.week} <Icon name="arrow-right" className="i--sm" /></small><b>{next.title}</b></Link> : <span>Last lesson</span>}
            </nav>
          </article>
          <aside className="lesson-layout__aside">
            <div className="sticky" style={{ display: 'grid', gap: 16 }}>
              <div className="callout callout--dark"><span className="label" style={{ color: 'var(--mn-lime)' }}>Archive tag</span><h3 style={{ marginTop: 8 }}>{module.name}</h3><p style={{ opacity: 0.8, fontSize: 14 }}>This tag comes from the sample catalogue. It is not a block in the 12-week outline.</p><Link className="link" style={{ color: 'var(--mn-lime)', marginTop: 12 }} to={`/schedule?week=${lesson.week}`}>Week {lesson.week} on the timetable <Icon name="arrow-right" className="i--sm" /></Link></div>
              <WeekTrainers weekNumber={lesson.week} trainers={[...(weeksOf(timetable.data).find((item) => item.number === lesson.week)?.professionalismTrainers ?? []), ...(weeksOf(timetable.data).find((item) => item.number === lesson.week)?.cybersecurityTrainers ?? [])]} />
            </div>
          </aside>
        </div>
      </section>
    </>
    )}
    </PublicGate>
  );
}

function WeekTrainers({ weekNumber, trainers }: { weekNumber: number; trainers: TrainerRef[] }) {
  const unique = trainers.filter((trainer, index) => trainers.findIndex((item) => item.id === trainer.id) === index);
  return (
    <div className="callout">
      <h3>Proposed trainers</h3>
      <p style={{ fontSize: 14 }}>{unique.length ? `${unique.map((trainer) => trainer.displayName).join(', ')}. These names are proposed. The daily allocation is still pending.` : `The outline does not name trainers for week ${weekNumber}.`}</p>
      <Link className="link" to={`/schedule?week=${weekNumber}`}>See the week <Icon name="arrow-right" className="i--sm" /></Link>
    </div>
  );
}
