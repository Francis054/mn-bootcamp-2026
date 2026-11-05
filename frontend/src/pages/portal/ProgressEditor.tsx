import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Field } from '@/components/controls';
import { ErrorState } from '@/components/feedback';
import { Loader } from '@/components/Loader';
import { isApiError } from '@/domain/types';
import { KIND_LABEL, type PortfolioItem } from '@/domain/portfolio';
import { SKILL_LEVELS, SKILL_LEVEL_LABEL, levelLabel, type EventRecord, type SkillRecord } from '@/domain/progress';

const STATUS: Record<SkillRecord['status'], string> = {
  draft: 'Draft',
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function ProgressEditor() {
  return (
    <>
      <SkillEditor />
      <EventEditor />
    </>
  );
}

function SkillEditor() {
  const [rows, setRows] = useState<SkillRecord[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<SkillRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const load = () => {
    api<SkillRecord[]>({ method: 'GET', path: '/portal/skills' })
      .then(setRows)
      .catch((err: unknown) => setError(isApiError(err) ? err.message : 'Skills could not be loaded.'));
  };
  useEffect(() => { load(); }, []);
  if (error && !rows) return <ErrorState title="Skills could not be opened" text={error} />;
  if (!rows) return <p role="status"><Loader variant="inline" label="Loading skills" /> Loading skills.</p>;
  return (
    <section className="portal-card progress-editor" id="skills-editor" aria-labelledby="skills-title">
      <h2 id="skills-title">Skills</h2>
      <p className="muted">Rate each skill from learning to can teach. You can point at a portfolio item, including a case study, as evidence. It stays a draft until you submit it, and it appears on your public profile only after approval and consent.</p>
      <ul className="progress-list">
        {rows.map((row) => (
          <li key={row.id}>
            <div className="portfolio-item__head">
              <h3>{row.draft.name || 'Untitled skill'}</h3>
              <span className="tag">{STATUS[row.status]}</span>
              <span className="tag">{levelLabel(row.draft.level)}</span>
            </div>
            {row.rejectionReason ? <p role="status">Not approved: {row.rejectionReason}</p> : null}
            <button className="btn btn--sm" type="button" onClick={() => { setEditing(row); setCreating(false); }}>Edit</button>
          </li>
        ))}
      </ul>
      {creating || editing ? (
        <SkillForm
          skill={editing}
          onCancel={() => { setEditing(null); setCreating(false); }}
          onSaved={(row) => { setEditing(row); setCreating(false); load(); }}
        />
      ) : <button className="btn btn--dark btn--sm" type="button" onClick={() => { setCreating(true); setEditing(null); }}>Add a skill</button>}
    </section>
  );
}

function SkillForm({ skill, onCancel, onSaved }: { skill: SkillRecord | null; onCancel: () => void; onSaved: (row: SkillRecord) => void }) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  useEffect(() => {
    api<PortfolioItem[]>({ method: 'GET', path: '/portal/portfolio' }).then(setItems).catch(() => setItems([]));
  }, []);
  const draft = skill?.draft;
  const [name, setName] = useState(draft?.name ?? '');
  const [level, setLevel] = useState(String(draft?.level ?? 1));
  const [evidenceItemId, setEvidenceItemId] = useState(draft?.evidenceItemId ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [current, setCurrent] = useState(skill);
  const body = { name, level: Number(level), evidenceItemId: evidenceItemId || null };
  const save = async () => {
    setPending(true);
    setErrors({});
    try {
      const saved = current
        ? await api<SkillRecord>({ method: 'PATCH', path: `/portal/skills/${current.id}`, body })
        : await api<SkillRecord>({ method: 'POST', path: '/portal/skills', body });
      setCurrent(saved);
      setNotice('Saved. Submit it when you want a review.');
      onSaved(saved);
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) setErrors(error.fieldErrors);
      setNotice(isApiError(error) ? error.message : 'Could not save the skill.');
    } finally {
      setPending(false);
    }
  };
  const submit = async () => {
    if (!current) return;
    setPending(true);
    try {
      const saved = await api<SkillRecord>({ method: 'POST', path: `/portal/skills/${current.id}/submit` });
      setCurrent(saved);
      setNotice('Submitted for review. The last approved version stays public.');
      onSaved(saved);
    } catch (error) {
      setNotice(isApiError(error) ? error.message : 'Could not submit the skill.');
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="portal-form">
      {notice ? <p role="status">{notice}</p> : null}
      <Field id="skill-name" label="Skill" error={errors.name}>
        <input className="input" id="skill-name" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field id="skill-level" label="Level" error={errors.level}>
        <select className="select" id="skill-level" value={level} onChange={(event) => setLevel(event.target.value)}>
          {SKILL_LEVELS.map((value) => <option key={value} value={value}>{SKILL_LEVEL_LABEL[value]}</option>)}
        </select>
      </Field>
      <Field id="skill-evidence" label="Evidence" error={errors.evidenceItemId}>
        <select className="select" id="skill-evidence" value={evidenceItemId} onChange={(event) => setEvidenceItemId(event.target.value)}>
          <option value="">No portfolio item</option>
          {items.map((item) => <option key={item.id} value={item.id}>{KIND_LABEL[item.draft.kind]}: {item.draft.title || 'Untitled'}</option>)}
        </select>
      </Field>
      <div className="portal-actions">
        <button className="btn btn--dark btn--sm" type="button" disabled={pending} onClick={() => void save()}>Save skill</button>
        {current ? <button className="btn btn--sm" type="button" disabled={pending} onClick={() => void submit()}>Submit skill for review</button> : null}
        <button className="btn btn--sm" type="button" onClick={onCancel}>Close</button>
      </div>
    </div>
  );
}

function EventEditor() {
  const [rows, setRows] = useState<EventRecord[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<EventRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const load = () => {
    api<EventRecord[]>({ method: 'GET', path: '/portal/events' })
      .then(setRows)
      .catch((err: unknown) => setError(isApiError(err) ? err.message : 'Events could not be loaded.'));
  };
  useEffect(() => { load(); }, []);
  if (error && !rows) return <ErrorState title="Events could not be opened" text={error} />;
  if (!rows) return <p role="status"><Loader variant="inline" label="Loading events" /> Loading events.</p>;
  return (
    <section className="portal-card progress-editor" id="events-editor" aria-labelledby="events-title">
      <h2 id="events-title">Events attended</h2>
      <p className="muted">Workshops, meetups, and CTFs you took part in. A link or a certificate image is optional. The certificate uses the same image checks as your profile photo.</p>
      <ul className="progress-list">
        {rows.map((row) => (
          <li key={row.id}>
            <div className="portfolio-item__head">
              <h3>{row.draft.title || 'Untitled event'}</h3>
              <span className="tag">{STATUS[row.status]}</span>
            </div>
            {row.rejectionReason ? <p role="status">Not approved: {row.rejectionReason}</p> : null}
            <button className="btn btn--sm" type="button" onClick={() => { setEditing(row); setCreating(false); }}>Edit</button>
          </li>
        ))}
      </ul>
      {creating || editing ? (
        <EventForm event={editing} onCancel={() => { setEditing(null); setCreating(false); }} onSaved={(row) => { setEditing(row); setCreating(false); load(); }} />
      ) : <button className="btn btn--dark btn--sm" type="button" onClick={() => { setCreating(true); setEditing(null); }}>Add an event</button>}
    </section>
  );
}

function EventForm({ event, onCancel, onSaved }: { event: EventRecord | null; onCancel: () => void; onSaved: (row: EventRecord) => void }) {
  const draft = event?.draft;
  const [title, setTitle] = useState(draft?.title ?? '');
  const [eventDate, setEventDate] = useState(draft?.eventDate ?? '');
  const [organiser, setOrganiser] = useState(draft?.organiser ?? '');
  const [link, setLink] = useState(draft?.link ?? '');
  const [current, setCurrent] = useState(event);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const body = { title, eventDate: eventDate || null, organiser, link: link || null };
  const save = async () => {
    setPending(true);
    setErrors({});
    try {
      const saved = current
        ? await api<EventRecord>({ method: 'PATCH', path: `/portal/events/${current.id}`, body })
        : await api<EventRecord>({ method: 'POST', path: '/portal/events', body });
      setCurrent(saved);
      setNotice('Saved. Submit it when you want a review.');
      onSaved(saved);
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) setErrors(error.fieldErrors);
      setNotice(isApiError(error) ? error.message : 'Could not save the event.');
    } finally {
      setPending(false);
    }
  };
  const submit = async () => {
    if (!current) return;
    setPending(true);
    try {
      const saved = await api<EventRecord>({ method: 'POST', path: `/portal/events/${current.id}/submit` });
      setCurrent(saved);
      setNotice('Submitted for review.');
      onSaved(saved);
    } catch (error) {
      setNotice(isApiError(error) ? error.message : 'Could not submit the event.');
    } finally {
      setPending(false);
    }
  };
  const certificate = async (file: File) => {
    if (!current) {
      setNotice('Save the event before you add a certificate.');
      return;
    }
    const payload = new FormData();
    payload.set('file', file);
    setPending(true);
    try {
      const saved = await api<EventRecord>({ method: 'POST', path: `/portal/events/${current.id}/certificate`, body: payload });
      setCurrent(saved);
      setNotice('Certificate saved on the draft.');
      onSaved(saved);
    } catch (error) {
      setNotice(isApiError(error) ? error.message : 'Could not store the certificate.');
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="portal-form">
      {notice ? <p role="status">{notice}</p> : null}
      <Field id="event-title" label="Title" error={errors.title}>
        <input className="input" id="event-title" value={title} onChange={(input) => setTitle(input.target.value)} />
      </Field>
      <Field id="event-date" label="Date" error={errors.eventDate}>
        <input className="input" id="event-date" type="date" value={eventDate} onChange={(input) => setEventDate(input.target.value)} />
      </Field>
      <Field id="event-organiser" label="Organiser" error={errors.organiser}>
        <input className="input" id="event-organiser" value={organiser} onChange={(input) => setOrganiser(input.target.value)} />
      </Field>
      <Field id="event-link" label="Link" error={errors.link}>
        <input className="input" id="event-link" type="url" value={link} placeholder="https://" onChange={(input) => setLink(input.target.value)} />
      </Field>
      <Field id="event-certificate" label="Certificate image" error={errors.certificate}>
        <input className="input" id="event-certificate" type="file" accept="image/jpeg,image/png,image/webp" onChange={(input) => { const file = input.target.files?.[0]; if (file) void certificate(file); }} />
      </Field>
      {current?.draft.certificateUrl ? <img className="event-cert" src={current.draft.certificateUrl} alt="" /> : null}
      <div className="portal-actions">
        <button className="btn btn--dark btn--sm" type="button" disabled={pending} onClick={() => void save()}>Save event</button>
        {current ? <button className="btn btn--sm" type="button" disabled={pending} onClick={() => void submit()}>Submit event for review</button> : null}
        <button className="btn btn--sm" type="button" onClick={onCancel}>Close</button>
      </div>
    </div>
  );
}
