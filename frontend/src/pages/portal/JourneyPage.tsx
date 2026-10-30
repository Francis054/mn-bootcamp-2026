import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/api/client';
import { ErrorSummary, Field, FormLegend } from '@/components/controls';
import { ErrorState } from '@/components/feedback';
import { JourneyTimeline } from '@/components/JourneyTimeline';
import { LoadGate } from '@/components/Loader';
import { usePageMeta } from '@/components/SiteChrome';
import { readJourney, type JourneyBody, type JourneyItem } from '@/domain/journey';
import { isApiError } from '@/domain/types';
import { collect, required } from '@/domain/validate';
import { PortalFrame } from '@/pages/portal/PortalPages';

const EMPTY = { title: '', occurredOn: '', summary: '', visibility: '' };

export function PortalJourneyPage() {
  usePageMeta('Your journey');
  return (
    <PortalFrame>
      <JourneyEditor />
    </PortalFrame>
  );
}

function JourneyEditor() {
  const [journey, setJourney] = useState<JourneyBody | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const load = () => {
    setLoading(true);
    api<unknown>({ method: 'GET', path: '/portal/journey' })
      .then((body) => {
        setJourney(readJourney(body, 'portal'));
        setError('');
      })
      .catch((err: unknown) => {
        setError(isApiError(err) ? err.message : 'Your journey could not be loaded.');
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fieldErrors = collect({
      'milestone-title': required(fields.title, 'Enter a title.'),
      'milestone-date': required(fields.occurredOn, 'Pick a date.'),
      'milestone-summary': fields.summary.trim().length > 2000 ? 'Use at most 2000 characters.' : null,
      'milestone-visibility': fields.visibility === 'private' || fields.visibility === 'public' ? null : 'Choose private or public.',
    });
    setErrors(fieldErrors);
    setFormError('');
    if (Object.keys(fieldErrors).length) return;
    setPending(true);
    const body = {
      title: fields.title.trim(),
      occurredOn: fields.occurredOn,
      summary: fields.summary.trim(),
      visibility: fields.visibility,
    };
    try {
      if (editing) {
        await api({ method: 'PATCH', path: `/portal/journey/milestones/${editing}`, body });
      } else {
        await api({ method: 'POST', path: '/portal/journey/milestones', body });
      }
      setFields(EMPTY);
      setEditing(null);
      setNotice(editing ? 'Milestone saved.' : 'Milestone added.');
      load();
    } catch (err) {
      setFormError(isApiError(err) ? err.message : 'The milestone could not be saved.');
      if (isApiError(err) && err.fieldErrors) setErrors(mapErrors(err.fieldErrors));
    } finally {
      setPending(false);
    }
  };
  const edit = (item: JourneyItem) => {
    setEditing(item.id);
    setFields({
      title: item.title,
      occurredOn: item.occurredOn ?? '',
      summary: item.summary,
      visibility: item.visibility,
    });
    setNotice('');
    document.getElementById('milestone-title')?.focus();
  };
  const remove = async (item: JourneyItem) => {
    setPending(true);
    setFormError('');
    try {
      await api({ method: 'DELETE', path: `/portal/journey/milestones/${item.id}` });
      if (editing === item.id) {
        setEditing(null);
        setFields(EMPTY);
      }
      setNotice('Milestone deleted.');
      load();
    } catch (err) {
      setFormError(isApiError(err) ? err.message : 'The milestone could not be deleted.');
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <p className="eyebrow">Your journey</p>
      <h1>The weeks, the work, and the milestones you add.</h1>
      <p className="muted">The timetable, labs, published projects, events, and skills are filled in from records that already exist. A milestone you write can stay private or be public on your profile.</p>
      <section className="portal-card" aria-labelledby="milestone-form-title" style={{ marginTop: 24 }}>
        <h2 id="milestone-form-title">{editing ? 'Edit milestone' : 'Add a milestone'}</h2>
        {notice ? <p role="status">{notice}</p> : null}
        <form onSubmit={(event) => void save(event)} noValidate>
          <FormLegend />
          <ErrorSummary
            errors={formError ? { form: formError, ...errors } : errors}
            labels={{
              'milestone-title': 'Title',
              'milestone-date': 'Date',
              'milestone-summary': 'Note',
              'milestone-visibility': 'Who can see it',
              form: 'Form',
            }}
          />
          <div className="portal-form">
            <Field id="milestone-title" label="Title" error={errors['milestone-title']} required>
              <input className="input" id="milestone-title" name="title" value={fields.title} onChange={(event) => setFields({ ...fields, title: event.target.value })} aria-invalid={Boolean(errors['milestone-title'])} />
            </Field>
            <Field id="milestone-date" label="Date" error={errors['milestone-date']} required>
              <input className="input" id="milestone-date" name="occurredOn" type="date" value={fields.occurredOn} onChange={(event) => setFields({ ...fields, occurredOn: event.target.value })} aria-invalid={Boolean(errors['milestone-date'])} />
            </Field>
            <Field id="milestone-summary" label="Note" error={errors['milestone-summary']} hint="Optional. A sentence is enough." required={false}>
              <textarea className="textarea" id="milestone-summary" name="summary" rows={3} value={fields.summary} onChange={(event) => setFields({ ...fields, summary: event.target.value })} />
            </Field>
            <Field id="milestone-visibility" label="Who can see it" error={errors['milestone-visibility']} required>
              <select className="select" id="milestone-visibility" name="visibility" value={fields.visibility} onChange={(event) => setFields({ ...fields, visibility: event.target.value })} aria-invalid={Boolean(errors['milestone-visibility'])}>
                <option value="">Choose</option>
                <option value="private">Private — only you, in the portal</option>
                <option value="public">Public — on your published profile</option>
              </select>
            </Field>
          </div>
          <div className="portal-actions">
            <button className="btn btn--dark" type="submit" disabled={pending}>{pending ? 'Saving…' : editing ? 'Save milestone' : 'Add milestone'}</button>
            {editing ? <button className="btn" type="button" onClick={() => { setEditing(null); setFields(EMPTY); setErrors({}); }}>Cancel</button> : null}
          </div>
        </form>
      </section>
      <LoadGate pending={loading} variant="panel" message="Loading the journey…">
        {error ? <ErrorState title="Your journey could not be opened" text={error} /> : null}
        {journey ? (
          <div style={{ marginTop: 32 }}>
            <JourneyTimeline items={journey.items} onEdit={edit} onDelete={(item) => void remove(item)} />
          </div>
        ) : null}
      </LoadGate>
    </>
  );
}

function mapErrors(fieldErrors: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  const names: Record<string, string> = {
    title: 'milestone-title',
    occurredOn: 'milestone-date',
    summary: 'milestone-summary',
    visibility: 'milestone-visibility',
  };
  for (const [key, message] of Object.entries(fieldErrors)) mapped[names[key] ?? key] = message;
  return mapped;
}
