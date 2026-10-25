import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { Avatar, CountUp, OfficialLogo, Photo, SplitHeading } from '@/components/Brand';
import { Chips, ErrorSummary, Field, Tabs } from '@/components/controls';
import { EmptyState, ErrorState, useLightbox, useToast } from '@/components/feedback';
import { Loader } from '@/components/Loader';
import { Icon, type IconName } from '@/components/Icon';
import { Netlines } from '@/components/Netlines';
import { TenMark } from '@/components/TenMark';
import { usePageMeta } from '@/components/SiteChrome';
import { ALBUM_LABEL, MODULES } from '@/dev/fixtures';
import { usesMockApi } from '@/config/runtime';
import { APP_TODAY, parseUtcDate } from '@/domain/format';
import { isApiError } from '@/domain/types';
import { collect, emailAddress, minLength, required } from '@/domain/validate';
import { usePublicContent } from '@/hooks/useContent';
import { downloadCalendar, EventRow, moduleOf, PageIntro, PublicGate, SampleMark } from './helpers';

export function TraineesPage() {
  const { trainees, loading, error } = usePublicContent();
  const [focus, setFocus] = useState('all');
  const [query, setQuery] = useState('');
  const rows = trainees.filter((trainee) => {
    const text = `${trainee.displayName} ${(trainee.skills ?? []).join(' ')} ${trainee.track}`.toLowerCase();
    return (focus === 'all' || trainee.focus === focus) && text.includes(query.trim().toLowerCase());
  });
  return (
    <PublicGate loading={loading} error={error}>
    <>
      <PageIntro title="Trainees" crumbs={[{ label: 'Home', to: '/' }, { label: 'Trainees' }]} eyebrow="The 2026 cohort" headline={usesMockApi() ? 'Twelve sample\nprofiles.' : trainees.length ? 'The people\nin this cohort.' : 'Profiles after\nconsent.'} aside={<p className="lead">{usesMockApi() ? 'Names, photos and links appear only after each person gives consent. Every card here is a labelled placeholder.' : 'Names, photos and links appear only after each person gives consent and the profile is published.'}</p>} />
      <section className="section" style={{ paddingTop: 'var(--s-7)' }}>
        <div className="container">
          <div className="toolbar">
            <div className="input-icon"><Icon name="search" className="i--sm" /><input className="input" type="search" placeholder="Search sample names or skills" aria-label="Search trainees" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            <Tabs label="Filter by focus" value={focus} onChange={setFocus} tabs={[{ id: 'all', label: 'All focuses' }, ...MODULES.map((module) => ({ id: module.id, label: module.short }))]} />
            <span className="result-count" aria-live="polite">{rows.length} profiles</span>
          </div>
            {!loading && !error && trainees.length === 0 ? <EmptyState icon="users" title="No public profiles yet" text="A profile is listed after the person consents and an administrator publishes it." /> : rows.length ? (
              <div className="t-grid">
                {rows.map((trainee) => (
                  <Link className="tcard" to={`/trainees/${trainee.id}`} key={trainee.id}>
                    <div className="tcard__art" style={{ ['--h' as string]: trainee.hue }}><span className="ph">Placeholder</span><Avatar initials={trainee.initials} hue={trainee.hue} /></div>
                    <div className="tcard__body"><h3>{trainee.displayName}</h3><p>{trainee.track} · {moduleOf(trainee.focus).short}</p><div className="tcard__tags">{(trainee.skills ?? []).slice(0, 2).map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></div>
                  </Link>
                ))}
              </div>
            ) : <EmptyState icon="users" title="No profiles match" text="Try another focus or clear the search." action={<button className="btn btn--ghost btn--sm" type="button" onClick={() => { setFocus('all'); setQuery(''); }}>Reset</button>} />}
        </div>
      </section>
    </>
    </PublicGate>
  );
}

export function TraineePage() {
  const { id = '' } = useParams();
  const { trainees, projects, loading, error } = usePublicContent();
  const trainee = trainees.find((item) => item.id === id);
  const [tab, setTab] = useState('about');
  const toast = useToast();
  usePageMeta(trainee?.displayName ?? 'Trainee');
  const related = projects.filter((project) => project.moduleId === trainee?.focus).slice(0, 2);
  return (
    <PublicGate loading={loading} error={error} errorTitle="This profile could not be loaded">
    {!trainee ? (
      <section className="section"><div className="container"><ErrorState title="This profile is not public" text="Profiles stay hidden until they are a published record or a labelled sample. Private contact details are never sent to this page." /></div></section>
    ) : (
    <>
      <section className="profile-head">
        <div className="container">
          <ol className="crumbs"><li><Link to="/">Home</Link></li><li><Link to="/trainees">Trainees</Link></li><li aria-current="page">{trainee.displayName}</li></ol>
          <div className="profile-head__grid" style={{ marginTop: 32 }}>
            <div className="profile-art mask-reveal is-in" style={{ ['--h' as string]: trainee.hue }}><span className="ph">Placeholder portrait</span><Avatar initials={trainee.initials} hue={trainee.hue} size="lg" /></div>
            <div>
              <div className="flex wrap" style={{ gap: 10 }}><span className="badge badge--lime">{trainee.statusLabel}</span><SampleMark listing={trainee.listing}>Sample profile — placeholder</SampleMark></div>
              <h1 style={{ marginTop: 16 }}>{trainee.displayName}</h1>
              <p className="lead">{trainee.track} · focus on {moduleOf(trainee.focus).name}</p>
            </div>
            <div className="flex wrap">
              <button className="btn btn--ghost btn--sm" type="button" disabled title="Links appear after consent">LinkedIn · after consent</button>
              <button className="btn btn--dark btn--sm" type="button" onClick={() => { void navigator.clipboard?.writeText(window.location.href); toast('Link copied', 'This copies the address only. No private fields are included.', 'info'); }}><Icon name="copy" className="i--sm" />Copy profile link</button>
            </div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container split">
          <div className="split__a">
            <dl className="kv"><div><dt>Track</dt><dd>{trainee.track}</dd></div><div><dt>Focus</dt><dd>{moduleOf(trainee.focus).name}</dd></div><div><dt>Consent</dt><dd>{trainee.listing === 'public' ? 'Published profile' : 'Not received · sample only'}</dd></div></dl>
            <div style={{ marginTop: 24 }}><span className="label">Skills in progress</span><div className="flex wrap" style={{ gap: 8, marginTop: 12 }}>{(trainee.skills ?? []).map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></div>
          </div>
          <div className="split__b">
            <Tabs label="Profile sections" value={tab} onChange={setTab} tabs={[{ id: 'about', label: 'About' }, { id: 'progress', label: 'Progress' }, { id: 'work', label: 'Work' }]} />
            {tab === 'about' ? <div style={{ marginTop: 24 }}><p>{trainee.bio}</p>{trainee.quote ? <blockquote style={{ marginTop: 20 }}>“{trainee.quote}”</blockquote> : null}<p className="muted" style={{ marginTop: 16 }}>Email, notes and external links are administrative fields and are not on this page.</p></div> : null}
            {tab === 'progress' ? <p className="muted" style={{ marginTop: 24 }}>Week-by-week progress will be recorded by trainers. Nothing here is an assessment result.</p> : null}
            {tab === 'work' ? <div style={{ marginTop: 24 }}>{related.length ? related.map((project) => <Link key={project.id} className="link" to={`/projects/${project.id}`}>{project.title}</Link>) : <p className="muted">No sample projects in this focus yet.</p>}</div> : null}
          </div>
        </div>
      </section>
    </>
    )}
    </PublicGate>
  );
}

export function ProjectsPage() {
  const { projects, loading, error } = usePublicContent();
  const [type, setType] = useState('');
  const types = ['Lab', 'CTF', 'Case study', 'Community project', 'Capstone'];
  const rows = projects.filter((project) => !type || project.type === type);
  return (
    <PublicGate loading={loading} error={error}>
    <>
      <PageIntro dark title="Projects & labs" crumbs={[{ label: 'Home', to: '/' }, { label: 'Bootcamp' }, { label: 'Projects & labs' }]} eyebrow="Projects & labs" headline={'Built in the lab.\nReady for the field.'} aside={<><p className="lead">Every bootcamp includes a real-life project. Finished work appears here after it is published.</p>{projects.some((project) => project.listing !== 'public') ? <span className="ph" style={{ marginTop: 16 }}>Sample projects are labelled</span> : null}</>}>
        <Netlines />
      </PageIntro>
      <section className="section">
        <div className="container">
          <div className="toolbar">
            <Tabs label="Filter by type" value={type} onChange={setType} tabs={[{ id: '', label: 'All' }, ...types.map((item) => ({ id: item, label: item === 'Community project' ? 'Community' : item === 'Case study' ? 'Case studies' : item === 'Lab' ? 'Labs' : item }))]} />
            <span className="result-count" aria-live="polite">{rows.length} projects</span>
          </div>
          {!loading && !error && projects.length === 0 ? <EmptyState icon="layers" title="No projects are published yet" text="A project appears here after it is published and its listing is not hidden." /> : rows.length ? (
            <div className="lesson-grid">
              {rows.map((project) => (
                <Link className="card" to={`/projects/${project.id}`} key={project.id}>
                  <div className="card__media"><Photo file={project.image} alt="" width={800} height={533} sizes="33vw" /></div>
                  <div className="card__body"><div className="card__meta"><span className="tag">{project.type}</span><SampleMark listing={project.listing}>Sample</SampleMark></div><h3 className="card__title">{project.title}</h3><p className="muted" style={{ marginTop: 8 }}>{moduleOf(project.moduleId).name}</p></div>
                </Link>
              ))}
            </div>
          ) : <EmptyState icon="layers" title="Nothing here yet" text="Projects of this type will appear as the cohort completes them." />}
        </div>
      </section>
      <section className="section section--paper">
        <div className="container split">
          <div className="split__a"><span className="eyebrow">Safety first</span><h2 className="h2" style={{ marginTop: 20 }}>Every lab runs in an isolated environment.</h2></div>
          <div className="split__b"><p className="lead">Offensive techniques are only ever practised on machines built for the purpose, with a written scope. Nothing on this site describes how to attack a real organisation.</p><span className="ph" style={{ marginTop: 16 }}>Policy wording to be confirmed with trainers</span></div>
        </div>
      </section>
    </>
    </PublicGate>
  );
}

export function ProjectPage() {
  const { id = '' } = useParams();
  const { projects, loading, error } = usePublicContent();
  const project = projects.find((item) => item.id === id);
  usePageMeta(project?.title ?? 'Project');
  return (
    <PublicGate loading={loading} error={error} errorTitle="This project could not be loaded">
    {!project ? (
      <section className="section"><div className="container"><ErrorState title="This project is not available" text="Drafts and hidden listings stay off this page. Publish the project with a public or sample listing to show it." /></div></section>
    ) : (
    <section className="section">
      <div className="container">
        <ol className="crumbs"><li><Link to="/">Home</Link></li><li><Link to="/projects">Projects</Link></li><li aria-current="page">{project.title}</li></ol>
        <div className="flex wrap" style={{ gap: 10, marginTop: 24 }}><span className="tag">{project.type}</span><SampleMark listing={project.listing}>Sample project</SampleMark><span className="tag">{moduleOf(project.moduleId).name}</span></div>
        <h1 style={{ marginTop: 16 }}>{project.title}</h1>
        <p className="lead">{project.abstract}</p>
        <figure className="detail-media" style={{ marginTop: 32 }}><Photo file={project.image} alt="" width={1600} height={1066} sizes="100vw" /></figure>
        <div className="split" style={{ marginTop: 48 }}>
          <div><h2>Approach</h2>{(project.steps ?? []).length ? <ol className="steps">{(project.steps ?? []).map((step) => <li key={step}><h4>{step}</h4><p className="muted">Placeholder step. Real write-ups will be added when a team agrees to share the work.</p></li>)}</ol> : <p className="muted">The approach will be added when the team shares the write-up.</p>}</div>
          <aside><div className="callout"><h3>Tools</h3><p>{project.tools || 'Tools will be listed with the write-up.'}</p><p className="muted" style={{ marginTop: 12 }}>Repository and demo links stay private until a share agreement is recorded. They are not on this page.</p><p style={{ marginTop: 12 }}>{(project.team ?? []).length ? `Team: ${(project.team ?? []).join(', ')}` : 'No team names are published yet.'}</p></div></aside>
        </div>
      </div>
    </section>
    )}
    </PublicGate>
  );
}

export function EventsPage() {
  const { events, loading, error } = usePublicContent();
  const [filter, setFilter] = useState('all');
  const rows = events.filter((event) => {
    const past = !event.dateTbc && parseUtcDate(event.date) < APP_TODAY;
    if (filter === 'upcoming') return event.dateTbc || !past;
    if (filter === 'past') return past;
    if (filter === 'Anniversary' || filter === 'Milestone') return event.kind === filter;
    return true;
  });
  return (
    <PublicGate loading={loading} error={error}>
    <>
      <PageIntro title="Events" crumbs={[{ label: 'Home', to: '/' }, { label: 'Events' }]} eyebrow="Events & milestones" headline={'Where the cohort\nmeets the community.'} aside={<p className="lead">Each event is marked as verified, sample, or to be confirmed. The hackathon’s link to the bootcamp is unconfirmed.</p>} />
      <section className="section" style={{ paddingTop: 'var(--s-7)' }}>
        <div className="container">
          <div className="toolbar">
            <Chips label="Filter events" value={filter} onChange={setFilter} options={[{ id: 'all', label: 'All' }, { id: 'upcoming', label: 'Upcoming' }, { id: 'past', label: 'Past' }, { id: 'Anniversary', label: 'Anniversary' }, { id: 'Milestone', label: 'Milestones' }]} />
            <span className="result-count" aria-live="polite">{rows.length} events</span>
          </div>
            {!loading && !error && events.length === 0 ? <EmptyState icon="calendar" title="No events are published yet" text="An event appears here after it is published and its listing is not hidden." /> : rows.length ? <div className="ev-list">{rows.map((event, index) => <EventRow event={event} index={index} key={event.id} />)}</div> : <EmptyState icon="calendar" title="No events in this view" text="Try another filter. Upcoming, past, anniversary, and milestone views use the published list." />}
        </div>
      </section>
    </>
    </PublicGate>
  );
}

export function EventPage() {
  const { id = '' } = useParams();
  const { events, loading, error } = usePublicContent();
  const event = events.find((item) => item.id === id);
  usePageMeta(event?.title ?? 'Event');
  const canCalendar = Boolean(event && event.calendarDownload && !event.dateTbc);
  return (
    <PublicGate loading={loading} error={error} errorTitle="This event could not be loaded">
    {!event ? (
      <section className="section"><div className="container"><ErrorState title="This event is not available" text="It may still be a hidden draft, or the link may be wrong." /></div></section>
    ) : (
    <section className="section">
      <div className="container">
        <ol className="crumbs"><li><Link to="/">Home</Link></li><li><Link to="/events">Events</Link></li><li aria-current="page">{event.title}</li></ol>
        <div className="flex wrap" style={{ gap: 10, marginTop: 24 }}>
          <span className="tag">{event.kind}</span>
          {event.verified ? <span className="verified">Verified</span> : null}
          {event.dateTbc ? <span className="tbc">To be confirmed</span> : null}
          {event.sample ? <span className="ph">Sample</span> : null}
        </div>
        <h1 style={{ marginTop: 16 }}>{event.title}</h1>
        <p className="lead">{event.summary}</p>
        <div className="meta-row"><span><Icon name="clock" className="i--sm" />{event.whenLabel}</span><span><Icon name="map-pin" className="i--sm" />{event.place}</span></div>
        <figure className="detail-media" style={{ marginTop: 28 }}><Photo file={event.image} alt="" width={1600} height={1066} sizes="100vw" /></figure>
        <div className="prose-wrap" style={{ marginTop: 40 }}>
          {event.body?.kind === 'callout' ? <div className={`callout${event.body.tone === 'warn' ? '' : event.body.tone === 'lime' ? ' callout--dark' : ''}`}><h2>{event.body.title}</h2><p>{event.body.text}</p></div> : null}
          {event.body?.kind === 'steps' ? <><h2>{event.body.title}</h2><ol className="steps">{(event.body.steps ?? []).map((step) => <li key={step}><h4>{step}</h4></li>)}</ol>{event.body.note ? <p className="muted">{event.body.note}</p> : null}</> : null}
          {event.body?.kind === 'placeholder' ? <p>{event.body.text}</p> : null}
          {!event.body ? <p className="muted">More detail will be added when this event is updated.</p> : null}
          <p className="muted" style={{ marginTop: 24 }}>Source: {event.sourceUrl ? <a href={event.sourceUrl} target="_blank" rel="noopener">{event.source}</a> : event.source}</p>
          {canCalendar ? <button className="btn btn--dark btn--sm" type="button" onClick={() => downloadCalendar(event)}><Icon name="download" className="i--sm" />Add to calendar</button> : <p className="tbc">Calendar download stays off until the date is confirmed.</p>}
        </div>
      </div>
    </section>
    )}
    </PublicGate>
  );
}

export function GalleryPage() {
  const { media, loading, error } = usePublicContent();
  const [album, setAlbum] = useState('');
  const open = useLightbox();
  const rows = media.filter((item) => !album || item.album === album);
  const items = useMemo(() => rows.map((item) => ({ src: item.src.startsWith('http') || item.src.startsWith('/') ? item.src : `/assets/img/${item.file || 'electronics-lab'}-1600.webp`, alt: item.alt, caption: item.caption, category: ALBUM_LABEL[item.album as keyof typeof ALBUM_LABEL] ?? item.album, width: item.width, height: item.height })), [rows]);
  return (
    <PublicGate loading={loading} error={error}>
    <>
      <PageIntro title="Gallery" crumbs={[{ label: 'Home', to: '/' }, { label: 'Gallery' }]} eyebrow="Gallery" headline={'Moments worth\nremembering.'} aside={<><p className="lead">Open a photo, then use the arrow keys to browse and Escape to close.</p><p className="muted" style={{ marginTop: 12 }}>People are not named. The Foundation has confirmed consent for the included photographs.</p></>} />
      <section className="section" style={{ paddingTop: 'var(--s-7)' }}>
        <div className="container">
          <div className="toolbar">
            <Tabs label="Filter photos" value={album} onChange={setAlbum} tabs={[{ id: '', label: 'All' }, { id: 'anniversary', label: '10th anniversary' }, { id: 'hackathon', label: 'Hackathon (TBC)' }, { id: 'community', label: 'Community' }]} />
            <span className="result-count" aria-live="polite">{rows.length} photos</span>
          </div>
          {!loading && !error && media.length === 0 ? <EmptyState icon="image" title="No photos are published yet" text="A photo appears here after consent is verified and an administrator publishes it." /> : rows.length ? (
            <div className="masonry">
              {rows.map((item, index) => (
                <button className="m-item" type="button" key={item.id} aria-label={`Open photo: ${item.caption}`} onClick={() => open(items, index)}>
                  {(item.src ?? '').startsWith('http') || (item.src ?? '').startsWith('/') ? <img src={item.src} alt={item.alt} width={item.width} height={item.height} /> : <Photo file={item.file || 'electronics-lab'} alt={item.alt} width={item.width} height={item.height} sizes="(max-width:560px) 50vw, 33vw" />}
                  <figcaption>{item.caption}<br /><span style={{ opacity: 0.7 }}>{ALBUM_LABEL[item.album as keyof typeof ALBUM_LABEL] ?? item.album}{item.consent === 'pending' ? ' · consent record pending' : ''}</span></figcaption>
                </button>
              ))}
            </div>
          ) : <EmptyState icon="image" title="No photos in this album" text="Try another album, or publish photos into this one." />}
        </div>
      </section>
    </>
    </PublicGate>
  );
}

export function AboutPage() {
  const { about, milestones, foundationStats, loading, error } = usePublicContent();
  usePageMeta('About');
  return (
    <PublicGate loading={loading} error={error} errorTitle="The about page could not be loaded">
    {!about ? (
      <section className="section"><div className="container"><h1>The about page is not published yet.</h1></div></section>
    ) : (
    <>
      <PageIntro title="About" crumbs={[{ label: 'Home', to: '/' }, { label: 'About' }]} eyebrow="About the Foundation" headline={'Maximal wisdom,\nshared widely.'} aside={<><OfficialLogo width={180} /><p className="lead">Established in Ghana in 2016 to create career perspectives for young Africans through information technology.</p></>} />
      <section className="section" style={{ paddingTop: 0 }}><div className="container"><figure className="detail-media"><Photo file="anniversary-group-outdoor" alt="An outdoor group photo at a Foundation event" width={1600} height={1067} sizes="100vw" /></figure></div></section>
      <section className="section">
        <div className="container split split--even">
          <div><span className="eyebrow">Mission</span><p className="statement" style={{ marginTop: 20, fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>“{about.mission}”</p></div>
          <div><span className="eyebrow">Vision</span><p className="statement" style={{ marginTop: 20, fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>“{about.vision}”</p></div>
        </div>
      </section>
      <section className="section section--paper">
        <div className="container">
          <div className="sec-head"><div className="sec-head__title"><span className="eyebrow">Our values</span><h2 className="h2">Eight values, one way of working.</h2></div><span className="verified">From maximnyansa.com</span></div>
          <div className="values">{(about.values ?? []).length ? (about.values ?? []).map((value, index) => <div key={value}><span>{String(index + 1).padStart(2, '0')}</span>{value}</div>) : <p className="muted">Values will appear when the about page is published with them.</p>}</div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <span className="eyebrow">Foundation timeline</span>
          <h2 className="h2" style={{ margin: '16px 0 32px' }}>A decade, with gaps still to fill.</h2>
          <ol className="tl"><li className="tl__progress" style={{ height: 'calc(100% - 16px)' }} />
            {milestones.map((item) => (
              <li className="tl__item is-reached" key={item.id}><span className="tl__dot" /><div className="tl__card"><span className="tl__date">{item.year}</span><h3>{item.title}</h3><p>{item.description}</p>{item.source ? <span className="muted">{item.source}</span> : <span className="tbc">To be supplied</span>}</div></li>
            ))}
          </ol>
        </div>
      </section>
      {foundationStats.length ? (
        <section className="section section--dark">
          <div className="container">
            <div className="sec-head"><div><span className="eyebrow">Foundation-wide figures</span><h2 className="h2">Not bootcamp statistics.</h2></div><span className={about.figuresPermission ? 'verified' : 'tbc'}>{about.figuresPermission ? 'Published counters' : 'Self-reported · permission to display TBC'}</span></div>
            <div className="stats">{foundationStats.map((stat) => <div className="stat" key={stat.id}><CountUp value={stat.value} suffix={stat.suffix} /><span>{stat.label}</span></div>)}</div>
            <p className="muted" style={{ marginTop: 20 }}>These counters describe the Foundation’s wider work, not the 2026 cohort. Address: {about.address}. Email: <a href={`mailto:${about.email}`}>{about.email}</a>.</p>
          </div>
        </section>
      ) : (
        <section className="section">
          <div className="container"><p className="muted">Foundation counters stay hidden until they are published. Address: {about.address}. Email: <a href={`mailto:${about.email}`}>{about.email}</a>.</p>          </div>
        </section>
      )}
    </>
    )}
    </PublicGate>
  );
}

export function AnniversaryPage() {
  const { events, media, loading, error } = usePublicContent();
  const photos = media.filter((item) => item.album === 'anniversary').slice(0, 4);
  const featured = events.filter((event) => event.showOnAnniversary);
  usePageMeta('10 Years of Impact');
  const replay = () => {
    const node = document.getElementById('ten');
    if (!node) return;
    node.classList.remove('is-in');
    requestAnimationFrame(() => node.classList.add('is-in'));
  };
  return (
    <PublicGate loading={loading} error={error}>
    <>
      <section className="anni-hero">
        <div className="container anni-hero__grid">
          <div className="ten-wrap">
            <TenMark id="ten" caption="MAXIM NYANSA @ 10" />
            <button className="btn btn--ghost-light btn--sm" type="button" onClick={replay} style={{ position: 'absolute', right: 0, bottom: -8 }}><Icon name="play" className="i--sm" />Replay</button>
          </div>
          <div className="anni-hero__copy">
            <span className="years">2016 — 2026</span>
            <SplitHeading as="h1" text={'10 Years of\nCreating Career\n*Perspectives.*'} />
            <p className="lead">Shaping the Future Through AI, Innovation and Digital Skills.</p>
            <div className="flex wrap" style={{ marginTop: 28 }}><span className="pill pill--gold">#MaximNyansaAt10</span><span className="pill pill--lime">#10YearsOfImpact</span></div>
          </div>
        </div>
      </section>
      <div className="kente" aria-hidden="true" />
      <section className="section">
        <div className="container">
          <span className="eyebrow">The story so far</span>
          <h2 className="statement" style={{ marginTop: 24 }}>From a pilot in one Accra school <span className="soft">to a Foundation that trains young people for careers in tech.</span></h2>
          <p className="lead" style={{ marginTop: 24 }}>The theme for the tenth year is “10 Years of Creating Career Perspectives.” The Dutch sister organisation is Climbing The Right Tree. The name Maxim Nyansa means maximal wisdom, and the logo is the Adinkra symbol for climbing the right tree.</p>
        </div>
      </section>
      <section className="section section--dark">
        <div className="container">
          <h2 className="h2">October 2026</h2>
          <div className="ev-list" style={{ marginTop: 28 }}>
              {featured.length ? featured.map((event, index) => <EventRow event={event} index={index} key={event.id} />) : <p>No anniversary events are published yet. The story above still stands.</p>}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="gal-teaser">{photos.length ? photos.map((item) => <Link className="m-item" to="/gallery" key={item.id}>{item.src.startsWith('http') || item.src.startsWith('/') ? <img src={item.src} alt={item.alt} width={item.width} height={item.height} /> : <Photo file={item.file} alt={item.alt} width={item.width} height={item.height} sizes="40vw" />}</Link>) : <p className="muted">No published anniversary photos yet.</p>}</div>
          <p className="muted" style={{ marginTop: 16 }}>People in these photographs are not identified.</p>
        </div>
      </section>
    </>
    </PublicGate>
  );
}

const TOPICS = ['The 2026 bootcamp', 'Partnering or volunteering', 'Media and photos', 'Something else'];

export function ContactPage() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '');
    const email = String(data.get('email') ?? '');
    const message = String(data.get('message') ?? '');
    const consent = data.get('consent') === 'on';
    const fieldErrors = collect({
      name: required(name, 'Enter your name.'),
      email: emailAddress(email),
      message: required(message, 'Write a short message.') ?? minLength(message, 20, 'Use at least 20 characters.'),
      consent: consent ? null : 'Tick to confirm you understand this message is not delivered.',
    });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    setPending(true);
    try {
      const result = await api<{ delivered: boolean; message: string }>({
        method: 'POST',
        path: '/public/enquiries',
        body: { name, email, topic: String(data.get('topic') ?? TOPICS[0]), message, consent: true, company: String(data.get('company') ?? '') },
      });
      setStatus(result.message);
      setDone(true);
    } catch (error) {
      if (isApiError(error)) setErrors(error.fieldErrors ?? { form: error.message });
      else setErrors({ form: 'The enquiry could not be validated.' });
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <PageIntro title="Contact" crumbs={[{ label: 'Home', to: '/' }, { label: 'Contact' }]} eyebrow="Get in touch" headline={'Questions about\nthe bootcamp?'} aside={<p className="lead">Reach the Maxim Nyansa Foundation team in Accra. Applications for the 2026 cohort go through the Foundation’s application site.</p>} />
      <section className="section" style={{ paddingTop: 'var(--s-8)' }}>
        <div className="container contact-grid">
          <div className="contact-side">
            <ContactCard icon="map-pin" label="Visit" text="Coral Avenue – Tantra Hills, Accra, Ghana" />
            <ContactCard icon="mail" label="Email" text="mninfo@maximnyansa.com" href="mailto:mninfo@maximnyansa.com" />
            <ContactCard icon="globe" label="Website" text="maximnyansa.com" href="https://maximnyansa.com/" />
            <ContactCard icon="external" label="Applications" text="maximnyansaapplications.com" href="https://maximnyansaapplications.com/" note="Intake dates for future cohorts are TBC." />
          </div>
          <div className="card contact-form-card">
            {done ? (
              <div className="contact-done" tabIndex={-1}>
                <h3>{usesMockApi() ? 'Form accepted by the development adapter' : 'Message saved'}</h3>
                <p className="muted">{status || (usesMockApi() ? 'Nothing was emailed or stored on a server.' : 'The team can read this in the enquiry inbox.')}</p>
                <button className="btn btn--ghost btn--sm" type="button" onClick={() => { setDone(false); setStatus(''); }}>Write another</button>
              </div>
            ) : (
              <form onSubmit={(event) => void submit(event)} noValidate>
                <div className="between" style={{ marginBottom: 8 }}><h2 className="h3">Send an enquiry</h2>{usesMockApi() ? <span className="ph">Not sent · development adapter</span> : null}</div>
                <p className="muted" style={{ marginBottom: 24 }}>{usesMockApi() ? 'This form validates your message and keeps it in memory for this browser session only. It does not contact the Foundation.' : 'This form sends the message to the bootcamp API. Leave the extra company field empty.'}</p>
                <ErrorSummary errors={errors} />
                <div className="form-grid">
                  <Field id="name" label="Your name" error={errors.name}><input className="input" id="name" name="name" autoComplete="name" aria-invalid={Boolean(errors.name)} /></Field>
                  <Field id="email" label="Email" error={errors.email}><input className="input" id="email" name="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} /></Field>
                  <Field id="topic" label="Topic" className="span-2"><select className="select" id="topic" name="topic">{TOPICS.map((topic) => <option key={topic}>{topic}</option>)}</select></Field>
                  <Field id="message" label="Message" error={errors.message} hint="At least 20 characters." className="span-2"><textarea className="textarea" id="message" name="message" maxLength={600} aria-invalid={Boolean(errors.message)} /></Field>
                  <div className="field span-2"><label className="check"><input type="checkbox" name="consent" /> I understand this message is not delivered</label>{errors.consent ? <div className="error-msg">{errors.consent}</div> : null}</div>
                </div>
                <div style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
                  <label htmlFor="company">Company</label>
                  <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
                </div>
                {errors.form ? <p role="alert">{errors.form}</p> : null}
                <button className={`btn${pending ? ' is-loading' : ''}`} type="submit" disabled={pending} aria-busy={pending || undefined}>{pending ? <Loader variant="inline" label="Sending" /> : null}Send enquiry</button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function ContactCard({ icon, label, text, href, note }: { icon: IconName; label: string; text: string; href?: string; note?: string }) {
  return (
    <div className="card contact-card"><span className="contact-card__ic"><Icon name={icon} /></span><div><span className="label">{label}</span><p>{href ? <a className="link" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener">{text}</a> : text}</p>{note ? <p className="muted">{note}</p> : null}</div><span className="verified">Verified</span></div>
  );
}

export function NotFoundPage() {
  usePageMeta('Page not found');
  return (
    <section className="section"><div className="container"><ErrorState title="That page is not on this site" text="Use the menu to get back to the bootcamp, or open the class archive." /></div></section>
  );
}
