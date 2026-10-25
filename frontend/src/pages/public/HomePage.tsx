import { useRef, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Cover, HatMark, Photo, Reveal, SplitHeading } from '@/components/Brand';
import { Icon } from '@/components/Icon';
import { Netlines } from '@/components/Netlines';
import { SiteImage } from '@/components/SiteImage';
import { TenMark } from '@/components/TenMark';
import { EmptyState } from '@/components/feedback';
import { usePageMeta } from '@/components/SiteChrome';
import { usesMockApi } from '@/config/runtime';
import { currentWeek, formatDate, parseUtcDate } from '@/domain/format';
import { outlineLines, weeksOf } from '@/domain/timetable';
import { useAuth } from '@/auth/AuthProvider';
import { usePublicContent } from '@/hooks/useContent';
import { useSiteImage } from '@/hooks/useSiteImages';
import { useTimetable } from '@/hooks/useTimetable';
import { moduleOf, PublicGate, SampleMark, TraineeArt } from './helpers';

export function HomePage() {
  const content = usePublicContent();
  const timetable = useTimetable();
  const { projects, trainees, events, media } = content;
  const homepage = content.homepage;
  const auth = useAuth();
  usePageMeta('Home');
  const week = timetable.data?.currentWeek ?? currentWeek();
  const outlineWeeks = weeksOf(timetable.data);
  const featuredWeeks = [
    outlineWeeks.find((item) => item.number === week),
    ...outlineWeeks.filter((item) => item.number > week),
  ].filter((item) => item !== undefined).slice(0, 3);
  const endsOn = timetable.data?.programme?.endsOn ?? '2026-12-25';
  const featureProject = projects[0];
  const sideProjects = [projects[2], projects[5]].filter((item) => item !== undefined);
  const peek = useRef<HTMLDivElement>(null);
  const peekPhotos = [
    useSiteImage('home-class-peek-1'),
    useSiteImage('home-class-peek-2'),
    useSiteImage('home-class-peek-3'),
    useSiteImage('home-class-peek-4'),
  ];
  const movePeek = (index: number) => (event: MouseEvent) => {
    const node = peek.current;
    const image = node?.querySelector('img');
    const chosen = peekPhotos[index % peekPhotos.length];
    if (!node || !image || !chosen) return;
    const src = hoverSrc(chosen.src);
    image.dataset.fallback = hoverSrc(chosen.fallbackSrc);
    delete image.dataset.fell;
    if (image.getAttribute('src') !== src) image.src = src;
    node.classList.add('is-on');
    node.style.left = `${event.clientX}px`;
    node.style.top = `${event.clientY}px`;
  };
  return (
    <PublicGate loading={content.loading} error={content.error} errorTitle="The published site could not be loaded">
    {homepage ? <>
      {homepage.showAnnouncement ? <div className="dev-banner"><strong>Announcement.</strong> {homepage.announcement}</div> : null}
      <section className="hero" aria-labelledby="hero-title">
        <Netlines />
        <div className="container">
          <div className="hero__grid">
            <div className="hero__copy">
              <Reveal reveal="fade">
                <div className="hero__badges">
                  <span className="pill pill--lime"><span className="blink" />{homepage.eyebrow}</span>
                  <Link className="pill pill--gold" to="/anniversary" style={{ textDecoration: 'none' }}>10 Years of Impact · 2016–2026</Link>
                </div>
              </Reveal>
              <SplitHeading as="h1" id="hero-title" text={homepage.headline} />
              <Reveal i={4}><p className="lead">{homepage.lead}</p></Reveal>
              <Reveal i={5}>
                <div className="hero__ctas">
                  <Link className="btn" to={homepage.ctaHref}>{homepage.ctaLabel} <span className="arrow"><Icon name="arrow-right" className="i--sm" /></span></Link>
                  <Link className="btn btn--ghost-light" to="/journey">See the journey</Link>
                </div>
              </Reveal>
              <dl className="hero__facts">
                <div><dt>Starts</dt><dd>5 Oct 2026</dd></div>
                <div><dt>Ends</dt><dd>{formatDate(endsOn, { year: 'numeric' })}</dd></div>
                <div><dt>Cost</dt><dd>Free</dd></div>
                <div><dt>Where</dt><dd>Tantra Hills, Accra</dd></div>
              </dl>
            </div>
            <div className="hero__media" aria-label="Photos from the Maxim Nyansa community">
              <Reveal as="span" reveal="scale" i={6} className="hm-frame" aria-hidden="true" />
              <Reveal as="figure" mask parallax={0.04} i={0} className="hm-1"><SiteImage slot="home-hero-main" sizes="(max-width:1100px) 100vw, 40vw" priority /></Reveal>
              <Reveal as="figure" mask i={1} className="hm-2"><SiteImage slot="home-hero-side" sizes="(max-width:1100px) 50vw, 20vw" priority /></Reveal>
              <Reveal as="figure" mask i={2} className="hm-3"><SiteImage slot="home-hero-accent" sizes="(max-width:1100px) 45vw, 18vw" /></Reveal>
              <Reveal className="status-card" i={7}>
                <span className="label">Cohort status · live</span>
                <b>Week {week} of the bootcamp</b>
                <div className="meter" style={{ ['--p' as string]: week / 12 }}><i /></div>
                <span className="label" style={{ display: 'block', marginTop: 8, fontSize: 10 }}>12 weeks · 5 Oct – 25 Dec 2026</span>
              </Reveal>
            </div>
          </div>
        </div>
        <a className="scroll-cue" href="#intro"><span />Scroll</a>
      </section>
      <div className="marquee" aria-label="Weekly topics">
        <div className="marquee__track">
          {[0, 1].map((copy) => (outlineWeeks.length ? outlineWeeks : [{ id: 'bootcamp', title: 'Cybersecurity Bootcamp' }]).map((item) => (
            <div className="marquee__item" key={`${copy}-${item.id}`} aria-hidden={copy === 1 || undefined}>{item.title}</div>
          )))}
        </div>
      </div>
      <section className="section" id="intro" aria-labelledby="intro-title">
        <div className="container">
          <Reveal><span className="eyebrow"><HatMark />Why this bootcamp</span></Reveal>
          <h2 id="intro-title" className="statement" style={{ marginTop: 24 }}>Maxim Nyansa means <span className="hl-under">maximal wisdom.</span> <span className="soft">For ten years, the Foundation has turned that idea into careers in tech.</span></h2>
          <div className="intro-grid">
            <div className="intro-card"><span className="num">01 — Mission</span><h3>Career perspectives through IT</h3><blockquote>“To create career perspectives for young people with the use of information technology.”</blockquote></div>
            <div className="intro-card"><span className="num">02 — The bootcamp</span><h3>Free, practical, in person</h3><p>Twelve weeks, from 5 October to 25 December 2026, taught in person at the Foundation’s premises in Tantra Hills, Accra. Each weekday starts with devotion at 8:00 a.m.</p></div>
            <div className="intro-card"><span className="num">03 — The symbol</span><h3>Climbing the right tree</h3><p>The logo is an Adinkra symbol meaning “climbing the right tree”: whoever works for a good cause can expect the help of others.</p><Link className="link" to="/about" style={{ marginTop: 16 }}>About the Foundation <Icon name="arrow-right" className="i--sm" /></Link></div>
          </div>
        </div>
      </section>
      <section className="section section--dark" aria-labelledby="journey-title" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="container">
          <div className="sec-head">
            <div className="sec-head__title"><Reveal><span className="eyebrow">The three-month journey</span></Reveal><SplitHeading id="journey-title" className="h2" text={'From foundations\nto the capstone.'} /></div>
            <Reveal className="sec-head__aside"><p className="muted">The cohort runs from 5 October to 25 December 2026, in the three blocks on the timetable.</p><Link className="link" to="/schedule">Open the daily timetable <Icon name="arrow-right" className="i--sm" /></Link></Reveal>
          </div>
          <div className="phases">
            {(timetable.data?.blocks ?? []).map((block) => {
              const numbers = block.weeks.map((item) => item.number);
              const active = numbers.includes(week);
              const done = numbers.length > 0 && numbers.every((number) => number < week);
              const first = block.weeks[0];
              const last = block.weeks[block.weeks.length - 1];
              return (
                <article className={`phase${active ? ' is-now' : ''}`} key={block.id}>
                  <span className="phase__n">0{block.sortOrder}</span>
                  <h3>{block.name}</h3>
                  <p>{block.professionalismTheme}. {block.cybersecurityTheme}.</p>
                  <ul>{block.weeks.map((item) => <li className="tag" key={item.id}>{item.title}</li>)}</ul>
                  <div className="phase__foot"><span>{first && last ? `${formatDate(first.startsOn)} – ${formatDate(fridayOn(last.startsOn))}` : ''}</span><span className={`st ${active ? 'st--now' : done ? 'st--done' : 'st--upcoming'}`}>{active ? 'In progress' : done ? 'Completed' : 'Upcoming'}</span></div>
                </article>
              );
            })}
          </div>
          <Reveal>
            <div className="cohort-bar"><span className="label">5 Oct</span><div className="meter" style={{ ['--p' as string]: week / 12 }}><i /></div><span className="label">25 Dec</span><Link className="btn btn--ghost-light btn--sm" to="/schedule">Daily timetable</Link></div>
          </Reveal>
        </div>
      </section>
      <section className="section" aria-labelledby="classes-title">
        <div className="container">
          <div className="sec-head">
            <div className="sec-head__title"><Reveal><span className="eyebrow">This week</span></Reveal><Reveal><h2 id="classes-title" className="h2">What the timetable says.</h2></Reveal></div>
            <Reveal className="sec-head__aside"><p className="muted">Lesson write-ups in the class archive are samples. This list is the week’s title, topic and deliverable.</p><Link className="link" to="/schedule">Open the schedule <Icon name="arrow-right" className="i--sm" /></Link></Reveal>
          </div>
          <div className="rows">
            {featuredWeeks.length ? null : <EmptyState icon="calendar" title="The timetable is not loaded yet" text="Week titles appear here from the published schedule." />}
            {featuredWeeks.map((item, index) => (
              <Link className="row-link" key={item.id} to={`/schedule?week=${item.number}`} onMouseEnter={movePeek(index)} onMouseMove={movePeek(index)} onMouseLeave={() => peek.current?.classList.remove('is-on')}>
                <span className="wk">Week<b>{String(item.number).padStart(2, '0')}</b></span>
                <div><h3>{item.title}</h3><p className="muted">{outlineLines(item.cybersecurity)[0]}</p></div>
                <span className="row-mod tag">{item.deliverables[0]?.title ?? 'Weekly deliverable'}</span>
                <span className={`row-status st ${item.number === week ? 'st--now' : 'st--upcoming'}`}>{item.number === week ? 'This week' : `w/c ${formatDate(item.startsOn)}`}</span>
                <span className="go"><Icon name="arrow-right" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="section section--paper" aria-labelledby="proj-title">
        <div className="container">
          <div className="sec-head">
            <div className="sec-head__title"><Reveal><span className="eyebrow">Projects & labs</span></Reveal><Reveal><h2 id="proj-title" className="h2">Practice on real problems, safely.</h2></Reveal></div>
            <Reveal className="sec-head__aside"><p className="muted">Each week includes a practical session from 2:00 to 4:00 p.m. and a weekly deliverable. Assignments sit outside class. Project pages fill in as the cohort completes them.</p><Link className="link" to="/projects">All projects <Icon name="arrow-right" className="i--sm" /></Link></Reveal>
          </div>
          <div className="proj-feature">
            {featureProject ? <div className="pf-main"><ProjectCard project={featureProject} large /></div> : <EmptyState icon="layers" title="No projects are published yet" text="Labs and case studies appear here after they are published." />}
            <div className="pf-side">{sideProjects.map((project) => <div key={project.id}><ProjectCard project={project} /></div>)}</div>
          </div>
        </div>
      </section>
      <section className="section" aria-labelledby="tr-title">
        <div className="container">
          <div className="sec-head">
            <div className="sec-head__title"><Reveal><span className="eyebrow">The cohort</span></Reveal><Reveal><h2 id="tr-title" className="h2">Meet the trainees.</h2></Reveal></div>
            <Reveal className="sec-head__aside"><p className="muted">Real names and photos will appear only after each trainee gives consent. Until then, every profile is a sample.</p><Link className="link" to="/trainees">Trainee directory <Icon name="arrow-right" className="i--sm" /></Link></Reveal>
          </div>
          <div className="t-strip">
            {trainees.length ? null : <EmptyState icon="users" title="No public profiles yet" text="Trainee cards appear after consent is recorded and the profile is published." />}
            {trainees.slice(0, 6).map((trainee) => (
              <Link className="tcard" to={`/trainees/${trainee.id}`} key={trainee.id}>
                <TraineeArt trainee={trainee} variant="card" />
                <div className="tcard__body"><h3>{trainee.displayName}</h3><p>Focus: {moduleOf(trainee.focus).name}</p></div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="section section--dark" aria-labelledby="ev-title">
        <div className="container">
          <div className="sec-head">
            <div className="sec-head__title"><Reveal><span className="eyebrow">Events & milestones</span></Reveal><Reveal><h2 id="ev-title" className="h2">An October to remember.</h2></Reveal></div>
            <Reveal className="sec-head__aside"><p className="muted">The bootcamp opened in the same week the Foundation celebrated ten years.</p><Link className="btn btn--ghost-light btn--sm" to="/events">All events</Link></Reveal>
          </div>
          <div className="ev-list">
            {events.length ? null : <EmptyState icon="calendar" title="No events are published yet" text="Milestones appear here after they are published." />}
            {events.slice(0, 4).map((event, index) => {
              const day = event.dateTbc ? 'TBC' : String(new Date(`${event.date}T00:00:00Z`).getUTCDate()).padStart(2, '0');
              return (
                <Reveal i={index} key={event.id}>
                  <Link className="ev" to={`/events/${event.id}`}>
                    <div className="ev__date"><b>{day}</b><span>{event.dateTbc ? 'Oct 2026' : formatDate(event.date, { day: undefined, month: 'short', year: 'numeric' })}</span></div>
                    <div>
                      <div className="flex wrap" style={{ gap: 8, marginBottom: 10 }}>
                        <span className="tag">{event.kind}</span>
                        {event.verified ? <span className="verified">Verified</span> : null}
                        {event.dateTbc ? <span className="tbc">Details to be confirmed</span> : null}
                        {event.sample ? <span className="ph">Sample</span> : null}
                      </div>
                      <h3>{event.title}</h3>
                      <div className="ev__meta"><span><Icon name="clock" className="i--sm" />{event.whenLabel}</span><span><Icon name="map-pin" className="i--sm" />{event.place}</span></div>
                    </div>
                    <div className="ev__img"><Photo file={event.image} alt="" width={800} height={533} sizes="180px" /></div>
                    <span className="go"><Icon name="arrow-right" /></span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>
      <section className="section" aria-labelledby="gal-title">
        <div className="container">
          <div className="sec-head">
            <div className="sec-head__title"><Reveal><span className="eyebrow">Gallery</span></Reveal><Reveal><h2 id="gal-title" className="h2">Moments from the community.</h2></Reveal></div>
            <Reveal className="sec-head__aside"><p className="muted">Photos from Foundation community events. Names are withheld until consent is recorded.</p><Link className="link" to="/gallery">Open the gallery <Icon name="arrow-right" className="i--sm" /></Link></Reveal>
          </div>
          <div className="gal-teaser">
            {usesMockApi() ? ['hack-group-google-wall', 'anniversary-signature-wall', 'guests-smiling', 'electronics-lab', 'vr-group-lounge'].map((file, index) => (
              <Link className={`m-item gt-${index + 1}`} to="/gallery" key={file} aria-label="Open the gallery">
                <Photo file={file} alt="" width={1600} height={1066} sizes="(max-width:760px) 50vw, 30vw" />
              </Link>
            )) : media.length ? media.slice(0, 5).map((item, index) => (
              <Link className={`m-item gt-${index + 1}`} to="/gallery" key={item.id} aria-label={item.alt || 'Open the gallery'}>
                {(item.src ?? '').startsWith('http') || (item.src ?? '').startsWith('/')
                  ? <img src={item.src} alt={item.alt} width={item.width || 1600} height={item.height || 1066} />
                  : <Photo file={item.file} alt={item.alt} width={item.width || 1600} height={item.height || 1066} sizes="(max-width:760px) 50vw, 30vw" />}
              </Link>
            )) : <EmptyState icon="image" title="No published photos yet" text="Photos appear here after consent is verified and the album is published." />}
          </div>
        </div>
      </section>
      <section className="section anni" aria-labelledby="anni-title">
        <div className="container anni__grid">
          <div className="anni__ten"><TenMark id="ten-home" caption="2016 — 2026" /></div>
          <div className="anni__copy">
            <Reveal><span className="years">2016 — 2026</span></Reveal>
            <SplitHeading id="anni-title" text={'10 Years of Creating\nCareer Perspectives.'} />
            <Reveal><p className="lead">Founded in Ghana in 2016, the Foundation marked its tenth year in October 2026 with a reception alongside the Ghana Netherlands Business & Culture Council and a Grand Durbar that included a cybersecurity panel.</p></Reveal>
            <Reveal><div className="flex wrap" style={{ marginTop: 32 }}><Link className="btn" to="/anniversary">Explore 10 Years of Impact <span className="arrow"><Icon name="arrow-right" className="i--sm" /></span></Link><span className="verified">Verified facts only</span></div></Reveal>
          </div>
        </div>
      </section>
      <section className="section" aria-labelledby="cta-title">
        <div className="container">
          <Reveal reveal="scale">
            <div className="cta-block">
              <svg className="cta-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><path d="M12 2.8l7.5 2.9v5.6c0 4.8-3.2 8-7.5 9.9-4.3-1.9-7.5-5.1-7.5-9.9V5.7z" /></svg>
              <h2 id="cta-title">{homepage.footerCtaHeading}</h2>
              <div className="cta-side">
                <p>Mentor a trainee, host a lab, or donate end-of-life computers that the Foundation refurbishes for schools.</p>
                <div className="flex wrap">
                  <a className="btn btn--dark" href={homepage.footerCtaHref} target="_blank" rel="noopener">Get involved <span className="arrow"><Icon name="arrow-up-right" className="i--sm" /></span></a>
                  <a className="btn btn--ghost" href="mailto:mninfo@maximnyansa.com">Email the team</a>
                </div>
                <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>Foundation-wide counters stay off this page until they are published. They are not cohort results.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
      <div className="row-peek" ref={peek} aria-hidden="true"><img alt="" width={800} height={600} src={hoverSrc(peekPhotos[0]?.src ?? '')} onError={(event) => {
        const image = event.currentTarget;
        const fallback = image.dataset.fallback;
        if (!fallback || image.dataset.fell === '1') return;
        image.dataset.fell = '1';
        image.src = fallback;
      }} /></div>
    </> : (
      <section className="section"><div className="container"><h1>The homepage is not published yet.</h1><p>Published homepage copy will appear here.</p>{auth.allowed('content.write') ? <p><Link to="/admin/content">Open the content editor to publish it.</Link></p> : null}</div></section>
    )}
    </PublicGate>
  );
}

/** The floating class preview is small, so a bundled pair uses the 800-wide file. */
function hoverSrc(url: string): string {
  return url.includes('-1600.webp') ? url.replace('-1600.webp', '-800.webp') : url;
}

function fridayOn(startsOn: string): string {
  const date = parseUtcDate(startsOn);
  date.setUTCDate(date.getUTCDate() + 4);
  return date.toISOString().slice(0, 10);
}

function ProjectCard({ project, large = false }: { project: { id: string; title: string; type: string; cover: string; moduleId: string; listing?: string }; large?: boolean }) {
  const module = moduleOf(project.moduleId);
  return (
    <Link className="card" to={`/projects/${project.id}`}>
      <div className="card__media"><Cover kind={project.cover} label={module.name} /></div>
      <div className="card__body">
        <div className="card__meta"><span className="tag">{project.type}</span><SampleMark listing={project.listing}>Sample project</SampleMark></div>
        <h3 className="card__title" style={large ? { fontSize: 28 } : undefined}>{project.title}</h3>
        {large && project.listing !== 'public' ? <p className="muted" style={{ marginTop: 10 }}>A placeholder case study showing how finished trainee work will be presented: the problem, the approach and what was learned.</p> : null}
      </div>
    </Link>
  );
}
