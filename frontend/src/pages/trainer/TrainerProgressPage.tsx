import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { ErrorState } from '@/components/feedback';
import { Loader } from '@/components/Loader';
import { ShellMark, usePageMeta } from '@/components/SiteChrome';
import { clearSession } from '@/dev/session';
import { isApiError } from '@/domain/types';
import { levelLabel, type TrainerProgressRow } from '@/domain/progress';

/** Read-only skills and events for a trainer whose login is linked on the timetable. */
export function TrainerProgressPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TrainerProgressRow[] | null>(null);
  const [error, setError] = useState('');
  usePageMeta('Trainer progress');
  useEffect(() => {
    let cancel = false;
    api<TrainerProgressRow[]>({ method: 'GET', path: '/progress/trainees' })
      .then((result) => { if (!cancel) setRows(result); })
      .catch((err: unknown) => { if (!cancel) setError(isApiError(err) ? err.message : 'Progress could not be loaded.'); });
    return () => { cancel = true; };
  }, []);
  const signOut = async () => {
    await api({ method: 'POST', path: '/auth/logout' });
    clearSession();
    navigate('/admin/login');
  };
  return (
    <div className="portal-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="portal-bar">
        <Link className="portal-brand" to="/trainer"><ShellMark /><span><b>Trainer view</b><small>Skills and events</small></span></Link>
        <div className="portal-bar__actions">
          <button className="btn btn--sm" type="button" onClick={() => void signOut()}>Log out</button>
        </div>
      </header>
      <main id="main" className="section">
        <div className="container">
          <h1>Trainee skills and events</h1>
          <p className="muted">This is a read-only view. An administrator approves what can appear on the public site. Email addresses are not shown here.</p>
          {error ? <ErrorState title="Progress could not be opened" text={error} /> : null}
          {!rows && !error ? <p role="status"><Loader variant="inline" label="Loading progress" /> Loading progress.</p> : null}
          {rows && !rows.length ? <p>No trainee has added a skill or an event yet.</p> : null}
          <div className="progress-public">
            {rows?.map((trainee) => (
              <section className="portal-card" key={trainee.id}>
                <h2>{trainee.displayName}</h2>
                <h3>Skills</h3>
                {trainee.skills.length ? trainee.skills.map((skill) => (
                  <p key={skill.id}>{skill.draft.name || skill.live.name} · {levelLabel(skill.draft.level)} · {skill.status}</p>
                )) : <p className="muted">No skills.</p>}
                <h3>Events attended</h3>
                {trainee.events.length ? trainee.events.map((event) => (
                  <p key={event.id}>{event.draft.title || event.live.title} · {event.draft.organiser} · {event.status}</p>
                )) : <p className="muted">No events.</p>}
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
