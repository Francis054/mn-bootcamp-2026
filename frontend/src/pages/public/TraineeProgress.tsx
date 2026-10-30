import { useEffect, useState } from 'react';
import { KIND_LABEL, type PortfolioKind } from '@/domain/portfolio';
import { levelLabel, readPublicEvents, readPublicSkills, type PublicEvent, type PublicSkill } from '@/domain/progress';
import { api } from '@/api/client';

/** Approved skills and events on a public trainee profile. No staff links. */
export function TraineeProgress({ traineeId }: { traineeId: string }) {
  const [skills, setSkills] = useState<PublicSkill[] | null>(null);
  const [events, setEvents] = useState<PublicEvent[] | null>(null);
  useEffect(() => {
    let cancel = false;
    api<unknown>({ method: 'GET', path: `/public/trainees/${traineeId}/skills` })
      .then((rows) => { if (!cancel) setSkills(readPublicSkills(rows)); })
      .catch(() => { if (!cancel) setSkills([]); });
    api<unknown>({ method: 'GET', path: `/public/trainees/${traineeId}/events` })
      .then((rows) => { if (!cancel) setEvents(readPublicEvents(rows)); })
      .catch(() => { if (!cancel) setEvents([]); });
    return () => { cancel = true; };
  }, [traineeId]);
  if (!skills || !events) return <p className="muted" style={{ marginTop: 24 }}>Loading skills and events.</p>;
  if (!skills.length && !events.length) {
    return <p className="muted" style={{ marginTop: 24 }}>Approved skills and events appear here after the trainee agrees to a public profile.</p>;
  }
  return (
    <div className="progress-public">
      <section>
        <h3>Skills</h3>
        {skills.length ? (
          <ul className="progress-cards">
            {skills.map((skill) => (
              <li className="progress-card" key={skill.id}>
                <h4>{skill.name}</h4>
                <p className="tag">{levelLabel(skill.level)}</p>
                {skill.evidence ? <p>Evidence: {kindLabel(skill.evidence.kind)} · {skill.evidence.title}</p> : null}
              </li>
            ))}
          </ul>
        ) : <p className="muted">No approved skills yet.</p>}
      </section>
      <section>
        <h3>Events attended</h3>
        {events.length ? (
          <ul className="progress-cards">
            {events.map((event) => (
              <li className="progress-card" key={event.id}>
                <h4>{event.title}</h4>
                <p>{[event.eventDate, event.organiser].filter(Boolean).join(' · ')}</p>
                {event.link ? <p><a href={event.link} rel="noopener noreferrer nofollow ugc" target="_blank">Event link</a></p> : null}
                {event.certificateUrl ? <img className="event-cert" src={event.certificateUrl} alt={`${event.title} certificate`} /> : null}
              </li>
            ))}
          </ul>
        ) : <p className="muted">No approved events yet.</p>}
      </section>
    </div>
  );
}

function kindLabel(kind: string): string {
  if (kind === 'project' || kind === 'lab' || kind === 'case_study') return KIND_LABEL[kind as PortfolioKind];
  return 'Portfolio';
}
