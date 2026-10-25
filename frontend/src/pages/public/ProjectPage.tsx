import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Cover, Photo, pictureSource } from '@/components/Brand';
import { ErrorState } from '@/components/feedback';
import { Icon } from '@/components/Icon';
import { Crumbs, usePageMeta } from '@/components/SiteChrome';
import { publicHttpsUrl } from '@/domain/publicContract';
import type { PublicProject, PublicTrainee } from '@/domain/types';
import { usePublicContent } from '@/hooks/useContent';
import { moduleOf, PublicGate, SampleMark } from './helpers';
import {
  challengeCopy,
  coverKind,
  imageCaption,
  projectFacts,
  projectSteps,
  reflectionCopy,
} from './projectDetail';

const SECTIONS = [
  { id: 'challenge', label: 'The challenge' },
  { id: 'approach', label: 'Approach' },
  { id: 'result', label: 'What we learned' },
] as const;

const SECTION_IDS = SECTIONS.map((section) => section.id);

function useSectionHighlight(ids: readonly string[], ready: boolean) {
  const [active, setActive] = useState(ids[0] ?? '');
  useEffect(() => {
    if (!ready || typeof IntersectionObserver === 'undefined') return;
    const nodes = ids.flatMap((id) => {
      const node = document.getElementById(id);
      return node ? [node] : [];
    });
    if (!nodes.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const next = visible[0]?.target.id;
      if (next) setActive(next);
    }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [ids, ready]);
  return [active, setActive] as const;
}

export function ProjectPage() {
  const { id = '' } = useParams();
  const { projects, trainees, loading, error } = usePublicContent();
  const project = projects.find((item) => item.id === id);
  usePageMeta(project?.title ?? 'Project');
  const [active, setActive] = useSectionHighlight(SECTION_IDS, Boolean(project) && !loading && !error);
  useEffect(() => {
    setActive(SECTION_IDS[0] ?? '');
    document.documentElement.scrollTop = 0;
  }, [id, setActive]);

  return (
    <PublicGate loading={loading} error={error} errorTitle="This project could not be loaded">
      {!project ? (
        <section className="section"><div className="container"><ErrorState title="This project is not available" text="Drafts and hidden listings stay off this page. Publish the project with a public or sample listing to show it." /></div></section>
      ) : (
        <ProjectCaseStudy project={project} projects={projects} trainees={trainees} active={active} onSelect={setActive} />
      )}
    </PublicGate>
  );
}

function ProjectCaseStudy({
  project,
  projects,
  trainees,
  active,
  onSelect,
}: {
  project: PublicProject;
  projects: PublicProject[];
  trainees: PublicTrainee[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const module = moduleOf(project.moduleId);
  const facts = projectFacts(project);
  const steps = projectSteps(project.steps);
  const index = projects.findIndex((item) => item.id === project.id);
  const previous = index > 0 ? projects[index - 1] : undefined;
  const next = index >= 0 && index < projects.length - 1 ? projects[index + 1] : undefined;
  const repository = publicHttpsUrl(project.repositoryUrl);
  const demo = publicHttpsUrl(project.demoUrl);
  const links = [
    repository ? { href: repository, label: 'Repository' } : null,
    demo ? { href: demo, label: 'Demo' } : null,
  ].filter((item): item is { href: string; label: string } => item !== null);

  return (
    <>
      <section className="detail-hero">
        <div className="container">
          <Crumbs items={[{ label: 'Home', to: '/' }, { label: 'Projects', to: '/projects' }, { label: project.title }]} />
          <div className="flex wrap" style={{ gap: 10, marginTop: 24 }}>
            <span className="tag">{project.type}</span>
            <span className="tag">{module.name}</span>
            <SampleMark listing={project.listing}>Sample case study</SampleMark>
          </div>
          <h1>{project.title}</h1>
          <div className="meta-row">
            <span><Icon name="users" className="i--sm" /><TeamLine team={project.team} trainees={trainees} /></span>
            <span><Icon name="calendar" className="i--sm" />2026 cohort</span>
            <span><Icon name="shield" className="i--sm" />Isolated lab environment</span>
          </div>
          <figure className="detail-media detail-media--wide mask-reveal is-in" aria-hidden="true">
            <Cover kind={coverKind(project.cover)} label={module.name} />
          </figure>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 'var(--s-9)' }}>
        <div className="container">
          {facts.length ? (
            <dl className="facts project-facts" style={{ ['--fact-cols' as string]: facts.length }}>
              {facts.map((fact) => (
                <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
              ))}
            </dl>
          ) : null}
          <div className="split">
            <div className="split__a">
              <div className="case-toc sticky">
                <span className="eyebrow">Case study</span>
                <nav className="toc" aria-label="On this page" style={{ marginTop: 24 }}>
                  {SECTIONS.map((section) => (
                    <a key={section.id} href={`#${section.id}`} className={active === section.id ? 'is-active' : undefined} onClick={() => onSelect(section.id)}>{section.label}</a>
                  ))}
                </nav>
              </div>
            </div>
            <div className="split__b case-study">
              <section id="challenge" style={{ paddingBottom: 48 }}>
                <h2 className="h3" style={{ marginBottom: 16 }}>The challenge</h2>
                <p className="lead">{challengeCopy(project)}</p>
              </section>
              <section id="approach" style={{ paddingBottom: steps.length ? 0 : 48 }}>
                <h2 className="h3" style={{ marginBottom: 16 }}>Approach</h2>
                {steps.length ? (
                  <ol className="steps">
                    {steps.map((step, index) => (
                      <li key={`${step.title}-${index}`}>
                        {step.prose ? <p>{step.title}</p> : <h4>{step.title}</h4>}
                        {step.note ? <p className="muted">{step.note}</p> : null}
                      </li>
                    ))}
                  </ol>
                ) : <p className="muted">The approach will be added when the team shares the write-up.</p>}
              </section>
              <CasePhoto image={project.image} caption={imageCaption(project.image, project.title)} />
              <section id="result">
                <h2 className="h3" style={{ marginBottom: 16 }}>What we learned</h2>
                <div className="callout callout--lime"><p>{reflectionCopy(project)}</p></div>
                {links.length ? (
                  <div className="case-links">
                    {links.map((link) => (
                      <a key={link.label} className="btn btn--ghost btn--sm" href={link.href} target="_blank" rel="noopener noreferrer">{link.label} <Icon name="external" className="i--sm" /></a>
                    ))}
                  </div>
                ) : null}
              </section>
              <ProjectPager previous={previous} next={next} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function TeamLine({ team, trainees }: { team: string[]; trainees: PublicTrainee[] }) {
  const names = team.map((name) => name.trim()).filter(Boolean);
  if (!names.length) return <>Team to be named</>;
  return (
    <>
      Team:{' '}
      {names.map((name, index) => {
        const trainee = trainees.find((item) => item.displayName.trim().toLowerCase() === name.toLowerCase());
        return (
          <span key={`${name}-${index}`}>
            {index > 0 ? ', ' : null}
            {trainee ? <Link className="link" to={`/trainees/${trainee.id}`}>{name}</Link> : name}
          </span>
        );
      })}
    </>
  );
}

function CasePhoto({ image, caption }: { image: string; caption: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !pictureSource(image)) return null;
  return (
    <figure className="photo case-photo">
      <div className="case-photo__frame">
        <Photo file={image} alt="" width={1600} height={1066} sizes="(max-width: 900px) 100vw, 60vw" onError={() => setFailed(true)} />
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function ProjectPager({ previous, next }: { previous?: PublicProject; next?: PublicProject }) {
  if (!previous && !next) return null;
  return (
    <nav className="pager" aria-label="More projects">
      {previous ? (
        <Link to={`/projects/${previous.id}`}><small><Icon name="arrow-left" className="i--sm" /> Previous</small> <b>{previous.title}</b></Link>
      ) : <span />}
      {next ? (
        <Link className="next" to={`/projects/${next.id}`}><small>Next <Icon name="arrow-right" className="i--sm" /></small> <b>{next.title}</b></Link>
      ) : <span />}
    </nav>
  );
}
