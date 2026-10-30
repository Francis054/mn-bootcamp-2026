import { useState } from 'react';
import { api } from '@/api/client';
import { Field } from '@/components/controls';
import { isApiError } from '@/domain/types';
import { levelLabel, type EventContent, type ProgressReview, type SkillContent } from '@/domain/progress';

export function SkillReviewList({
  rows,
  writable,
  busy,
  setBusy,
  reload,
  toast,
}: {
  rows: Array<ProgressReview<SkillContent> & { id: string }>;
  writable: boolean;
  busy: string;
  setBusy: (value: string) => void;
  reload: () => void;
  toast: (title: string, text: string, tone: 'success' | 'error') => void;
}) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  if (!rows.length) return null;
  const approve = async (id: string) => {
    setBusy(id);
    try {
      if (names[id] !== undefined) await api({ method: 'PATCH', path: `/admin/review-queue/skills/${id}`, body: { name: names[id] } });
      await api({ method: 'POST', path: `/admin/review-queue/skills/${id}/approve` });
      toast('Skill approved', 'It can appear on the public profile when the trainee has agreed.', 'success');
      reload();
    } catch (error) {
      toast('Could not approve', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setBusy('');
    }
  };
  const reject = async (id: string) => {
    const reason = (reasons[id] ?? '').trim();
    if (!reason) {
      toast('Add a reason', 'The trainee will see this reason.', 'error');
      return;
    }
    setBusy(id);
    try {
      await api({ method: 'POST', path: `/admin/review-queue/skills/${id}/reject`, body: { reason } });
      toast('Skill rejected', 'The last approved version stays public.', 'success');
      reload();
    } catch (error) {
      toast('Could not reject', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setBusy('');
    }
  };
  return (
    <section className="review-list" style={{ marginTop: 24 }}>
      <h2>Skills</h2>
      {rows.map((item) => (
        <article className="portal-card review-card" key={item.id}>
          <p className="muted">{item.traineeName} · {item.email}</p>
          <Field id={`skill-name-${item.id}`} label="Skill">
            <input className="input" id={`skill-name-${item.id}`} value={names[item.id] ?? item.draft.name} disabled={!writable} onChange={(event) => setNames({ ...names, [item.id]: event.target.value })} />
          </Field>
          <p>Level: {levelLabel(item.draft.level)}</p>
          {writable ? (
            <div className="portal-actions">
              <button className="btn btn--dark btn--sm" type="button" disabled={busy === item.id} onClick={() => void approve(item.id)}>Approve skill</button>
              <Field id={`skill-reason-${item.id}`} label="Reason if you reject">
                <input className="input" id={`skill-reason-${item.id}`} value={reasons[item.id] ?? ''} onChange={(event) => setReasons({ ...reasons, [item.id]: event.target.value })} />
              </Field>
              <button className="btn btn--sm" type="button" disabled={busy === item.id} onClick={() => void reject(item.id)}>Reject skill</button>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}

export function EventReviewList({
  rows,
  writable,
  busy,
  setBusy,
  reload,
  toast,
}: {
  rows: Array<ProgressReview<EventContent>>;
  writable: boolean;
  busy: string;
  setBusy: (value: string) => void;
  reload: () => void;
  toast: (title: string, text: string, tone: 'success' | 'error') => void;
}) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  if (!rows.length) return null;
  const approve = async (id: string) => {
    setBusy(id);
    try {
      await api({ method: 'POST', path: `/admin/review-queue/events/${id}/approve` });
      toast('Event approved', 'It can appear on the public profile when the trainee has agreed.', 'success');
      reload();
    } catch (error) {
      toast('Could not approve', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setBusy('');
    }
  };
  const reject = async (id: string) => {
    const reason = (reasons[id] ?? '').trim();
    if (!reason) {
      toast('Add a reason', 'The trainee will see this reason.', 'error');
      return;
    }
    setBusy(id);
    try {
      await api({ method: 'POST', path: `/admin/review-queue/events/${id}/reject`, body: { reason } });
      toast('Event rejected', 'The last approved version stays public.', 'success');
      reload();
    } catch (error) {
      toast('Could not reject', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setBusy('');
    }
  };
  return (
    <section className="review-list" style={{ marginTop: 24 }}>
      <h2>Events attended</h2>
      {rows.map((item) => (
        <article className="portal-card review-card" key={item.id}>
          <p className="muted">{item.traineeName} · {item.email}</p>
          <h3>{item.draft.title}</h3>
          <p>{[item.draft.eventDate, item.draft.organiser].filter(Boolean).join(' · ')}</p>
          {item.draft.link ? <p>{item.draft.link}</p> : null}
          {item.draft.certificateUrl ? <img className="event-cert" src={item.draft.certificateUrl} alt="" /> : null}
          {writable ? (
            <div className="portal-actions">
              <button className="btn btn--dark btn--sm" type="button" disabled={busy === item.id} onClick={() => void approve(item.id)}>Approve event</button>
              <Field id={`event-reason-${item.id}`} label="Reason if you reject">
                <input className="input" id={`event-reason-${item.id}`} value={reasons[item.id] ?? ''} onChange={(event) => setReasons({ ...reasons, [item.id]: event.target.value })} />
              </Field>
              <button className="btn btn--sm" type="button" disabled={busy === item.id} onClick={() => void reject(item.id)}>Reject event</button>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
