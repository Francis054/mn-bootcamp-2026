import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { HatMark, Photo, Reveal } from '@/components/Brand';
import { Crumbs, usePageMeta } from '@/components/SiteChrome';
import { Chips, Tabs } from '@/components/controls';
import { EmptyState, ErrorState } from '@/components/feedback';
import { Icon } from '@/components/Icon';
import { Netlines } from '@/components/Netlines';
import { MODULES, PHASES } from '@/dev/fixtures';
import { currentWeek, formatDate } from '@/domain/format';
import { usePublicContent } from '@/hooks/useContent';
import { moduleOf, PageIntro, PublicGate, SampleMark, scheduleText, useTimelineProgress } from './helpers';

export function BootcampPage() {
  const week = currentWeek();
  return (
    <>
      <PageIntro dark title="Bootcamp overview" crumbs={[{ label: 'Home', to: '/' }, { label: 'Bootcamp' }, { label: 'Overview' }]} eyebrow="Cyber Security Bootcamp 2026" headline={'Six disciplines.\nOne cohort.\nZero cost.'} aside={<><Reveal><HatMark className="hat-seal hat-seal--hero" /></Reveal><Reveal><p className="lead">A practical, in-person programme at the Maxim Nyansa Foundation in Accra, built around the skills security teams hire for.</p></Reveal><Reveal><div className="flex wrap" style={{ marginTop: 24 }}><Link className="btn" to="/journey">Follow the journey <span className="arrow"><Icon name="arrow-right" className="i--sm" /></span></Link><a className="btn btn--ghost-light" href="https://maximnyansaapplications.com/" target="_blank" rel="noopener">Applications site <Icon name="external" className="i--sm" /></a></div></Reveal></>}>
        <Netlines />
        <dl className="facts" style={{ marginTop: 64 }}>
          <div><dt>Training starts</dt><dd>5 Oct 2026</dd></div>
          <div><dt>Training ends</dt><dd>December 2026</dd></div>
          <div><dt>Format</dt><dd>In person</dd></div>
          <div><dt>Cost</dt><dd>Free</dd></div>
          <div><dt>Venue</dt><dd>Foundation premises</dd></div>
        </dl>
        <figure className="detail-media mask-reveal is-in" style={{ marginTop: 64 }}><Photo file="electronics-lab" alt="Hands-on work at a Foundation build table" width={1600} height={1066} sizes="100vw" priority /></figure>
      </PageIntro>
      <section className="section" aria-labelledby="mod-title">
        <div className="container">
          <div className="sec-head">
            <div className="sec-head__title"><span className="eyebrow"><HatMark />The six modules</span><h2 id="mod-title" className="h2">What the cohort studies.</h2></div>
            <div className="sec-head__aside"><p className="muted">Topics are confirmed. The weekly order is still to be confirmed, so the sequence below is a labelled sample.</p><span className="tbc">Order TBC</span></div>
          </div>
          <div className="mod-grid">
            {MODULES.map((module, index) => (
              <article className="mod" key={module.id}>
                <span className="mod__n">0{index + 1}</span>
                <Icon name={module.icon as 'shield'} />
                <h3>{module.name}</h3>
                <p>{module.summary}</p>
                <Link className="link" to={`/classes?module=${module.id}`}>Sample lessons <Icon name="arrow-right" className="i--sm" /></Link>
              </article>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 28 }}>Indicative plan: week {week} of 12. EXIN exams for this cohort are to be confirmed. Published sources mention 12–16, 14 and 18 weeks.</p>
        </div>
      </section>
      <section className="section section--paper">
        <div className="container split">
          <div className="split__a"><span className="eyebrow">Who it is for</span><h2 className="h2" style={{ marginTop: 16 }}>Young people building a start in cybersecurity.</h2></div>
          <div className="split__b"><p className="lead">The 2020 pilot, requested by earlier trainees, ran at Tantra Hills with 14 participants. This 2026 cohort is a separate programme. Trainee numbers for 2026 are not published here.</p><span className="ph">Cohort size TBC</span></div>
        </div>
      </section>
    </>
  );
}

export function JourneyPage() {
  const { lessons, events, loading, error } = usePublicContent();
  const [phase, setPhase] = useState('all');
  const reached = useTimelineProgress(true);
  const week = currentWeek();
  const visible = lessons.filter((lesson) => phase === 'all' || String(lesson.phase) === phase);
  const milestoneWeek: Record<string, number> = { start: 1, reception: 1, durbar: 1, midpoint: 7, hackathon: 1 };
  return (
    <PublicGate loading={loading} error={error}>
    <>
      <PageIntro title="Journey" crumbs={[{ label: 'Home', to: '/' }, { label: 'Bootcamp' }, { label: 'Journey' }]} eyebrow="Timeline · Oct–Dec 2026" headline={'Twelve weeks,\none milestone\nat a time.'} aside={<><Reveal><p className="lead">Start and end dates are confirmed. The weekly plan is an indicative structure to show how the journey will be published.</p></Reveal><Reveal><div className="flex wrap" style={{ marginTop: 16 }}><span className="verified">Dates verified</span><span className="tbc">Weekly plan TBC</span></div></Reveal></>}>
        <div className="cohort-bar" style={{ marginTop: 56, color: 'var(--ink)' }}><span className="label">5 Oct</span><div className="meter" style={{ ['--p' as string]: week / 12, background: 'var(--line)' }}><i /></div><span className="label">Dec 2026</span><span className="badge badge--lime">Week {week} · in progress</span></div>
      </PageIntro>
      <section className="section" style={{ paddingTop: 'var(--s-9)' }}>
        <div className="container jt">
          <aside className="jt__side">
            <div className="sticky">
              <Tabs label="Filter timeline" value={phase} onChange={setPhase} tabs={[{ id: 'all', label: 'All' }, { id: '1', label: 'Phase 1' }, { id: '2', label: 'Phase 2' }, { id: '3', label: 'Phase 3' }]} />
              <nav className="toc" style={{ marginTop: 32 }} aria-label="Phases">
                {PHASES.map((item) => <a key={item.id} href={`#ph-${item.id}`}>Phase {item.id} · {item.name}</a>)}
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
              {PHASES.filter((item) => phase === 'all' || String(item.id) === phase).map((item) => (
                <li className="tl__phase" id={`ph-${item.id}`} key={item.id}>Phase {item.id} · {item.name}</li>
              ))}
              {visible.map((lesson, index) => {
                const markers = events.filter((event) => milestoneWeek[event.id] === lesson.week && event.id !== 'graduation');
                return (
                  <span key={lesson.id} style={{ display: 'contents' }}>
                    {markers.map((event) => (
                      <li className={`tl__item tl__item--milestone${index < reached ? ' is-reached' : ''}`} key={event.id}>
                        <span className="tl__dot" />
                        <Link className="tl__card" to={`/events/${event.id}`}><span className="tl__date">{event.whenLabel}</span><h3>{event.title}</h3><p style={{ opacity: 0.8, fontSize: 15 }}>{event.summary}</p></Link>
                      </li>
                    ))}
                    <li className={`tl__item${lesson.scheduleStatus === 'now' ? ' is-now' : ''}${index < reached ? ' is-reached' : ''}`}>
                      <span className="tl__dot" />
                      <Link className="tl__card" to={`/classes/${lesson.id}`}>
                        <div className="flex wrap" style={{ gap: 10, justifyContent: 'space-between' }}><span className="tl__date">Week {lesson.week} · w/c {formatDate(lesson.date)}</span><span className={`st st--${lesson.scheduleStatus}`}>{scheduleText(lesson.scheduleStatus)}</span></div>
                        <h3>{lesson.title}</h3>
                        <p className="muted" style={{ fontSize: 15 }}>{moduleOf(lesson.moduleId).name} · {lesson.format}</p>
                      </Link>
                    </li>
                  </span>
                );
              })}
              {events.filter((event) => event.id === 'graduation').map((event) => (
                <li className="tl__item tl__item--milestone" key={event.id}><span className="tl__dot" /><Link className="tl__card" to={`/events/${event.id}`}><span className="tl__date">{event.whenLabel}</span><h3>{event.title}</h3><p>{event.summary}</p><span className="tbc">Details to be confirmed</span></Link></li>
              ))}
            </ol> : <EmptyState icon="calendar" title="No classes are published yet" text="The weekly plan appears here after a lesson is published. Start and end dates above are already confirmed." />}
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
      <PageIntro title="Class archive" crumbs={[{ label: 'Home', to: '/' }, { label: 'Bootcamp' }, { label: 'Classes' }]} eyebrow="Class archive" headline={'Every lesson,\nin one place.'} aside={<><p className="lead">Notes, labs and resources are published after each class.</p>{lessons.some((lesson) => lesson.listing !== 'public') ? <span className="ph" style={{ marginTop: 16 }}>Sample lessons are labelled</span> : null}</>} />
      <section className="section" style={{ paddingTop: 'var(--s-7)' }}>
        <div className="container">
          <Tabs label="Filter by module" value={moduleId} onChange={setModuleId} tabs={[{ id: 'all', label: 'All modules' }, ...MODULES.map((module) => ({ id: module.id, label: module.short }))]} />
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
          <div className="flex wrap" style={{ gap: 10, marginTop: 8 }}><span className="tag">{module.name}</span><span className={`st st--${lesson.scheduleStatus}`}>{scheduleText(lesson.scheduleStatus)}</span><SampleMark listing={lesson.listing}>Sample lesson content</SampleMark></div>
          <h1>{lesson.title}</h1>
          <div className="meta-row"><span><Icon name="calendar" className="i--sm" />Week {lesson.week} · w/c {formatDate(lesson.date, { weekday: 'short', year: 'numeric' })}</span><span><Icon name="clock" className="i--sm" />{lesson.format}</span><span><Icon name="map-pin" className="i--sm" />{lesson.room || 'Tantra Hills, Accra'}</span></div>
          <figure className="detail-media mask-reveal is-in"><Photo file={lesson.cover} alt="" width={1600} height={1066} sizes="100vw" priority /></figure>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 'var(--s-9)' }}>
        <div className="container lesson-layout">
          <aside className="lesson-layout__side"><nav className="toc sticky" aria-label="On this page"><a href="#overview" className="is-active">Overview</a><a href="#objectives">Objectives</a><a href="#lab">Lab walkthrough</a><a href="#resources">Resources</a></nav></aside>
          <article className="lesson-layout__main prose-wrap">
            <section id="overview"><h2>Overview</h2><p className="lead">{lesson.summary}</p><p className="muted" style={{ marginTop: 16 }}>This is placeholder text showing the layout of a lesson write-up. Real notes will be added by the trainers after each class. Trainer names are not published until consent is recorded.</p></section>
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
              <div className="callout callout--dark"><span className="label" style={{ color: 'var(--mn-lime)' }}>Module</span><h3 style={{ marginTop: 8 }}>{module.name}</h3><p style={{ opacity: 0.8, fontSize: 14 }}>{module.summary}</p><Link className="link" style={{ color: 'var(--mn-lime)', marginTop: 12 }} to="/bootcamp">All modules <Icon name="arrow-right" className="i--sm" /></Link></div>
              <div className="callout"><h3>Trainer</h3><p style={{ fontSize: 14 }}>Trainer details will be published with consent. <span className="ph">Placeholder</span></p></div>
            </div>
          </aside>
        </div>
      </section>
    </>
    )}
    </PublicGate>
  );
}
