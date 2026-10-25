import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { ErrorSummary, Field, SaveBar, bindBeforeUnload } from '@/components/controls';
import { ErrorState, LoadingRows, useConfirm, useToast } from '@/components/feedback';
import { usePageMeta } from '@/components/SiteChrome';
import { MODULES } from '@/dev/fixtures';
import { isApiPublic } from '@/domain/publish';
import type { BootcampEvent, Lesson, Project, PublicationStatus, Trainee } from '@/domain/types';
import { isApiError } from '@/domain/types';
import { useAsync } from '@/hooks/useAsync';

function useEditorRecord<T extends { id: string }>(path: string, id: string | undefined) {
  const enabled = Boolean(id && id !== 'new');
  return useAsync(`${path}:${id ?? 'new'}`, () => api<T>({ method: 'GET', path: `${path}/${id}` }), enabled);
}

export function ClassEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const record = useEditorRecord<Lesson>('/admin/classes', isNew ? undefined : id);
  usePageMeta(isNew ? 'New class' : 'Edit class');
  if (!isNew && record.loading) return <LoadingRows />;
  if (!isNew && record.error) return <ErrorState title="Could not load the class" text={record.error.message} />;
  if (!isNew && record.data === null && !record.loading) return <ErrorState title="Class not found" text="It may have been deleted, or the link may be wrong." />;
  return <ClassForm initial={record.data} />;
}

function ClassForm({ initial }: { initial: Lesson | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const auth = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const writable = auth.allowed('content.write');
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  const submit = async (form: HTMLFormElement, publish: boolean) => {
    if (!writable) return;
    const data = Object.fromEntries(new FormData(form));
    let listing = data.listing === 'public' ? 'public' : data.listing === 'sample' ? 'sample' : 'hidden';
    if (publish && listing === 'hidden') listing = 'public';
    const body = {
      title: String(data.title ?? ''),
      slug: String(data.slug ?? ''),
      moduleId: String(data.moduleId ?? ''),
      week: Number(data.week ?? 1),
      date: String(data.date ?? ''),
      format: String(data.format ?? 'Lecture + lab'),
      room: String(data.room ?? ''),
      summary: String(data.summary ?? ''),
      objectives: String(data.objectives ?? '').split('\n').map((line) => line.trim()).filter(Boolean),
      lab: String(data.lab ?? ''),
      codeSample: String(data.codeSample ?? ''),
      publicationStatus: (publish ? 'published' : String(data.publicationStatus ?? 'draft')) as PublicationStatus,
      listing,
      internalNotes: String(data.internalNotes ?? ''),
    };
    setPending(true);
    try {
      const saved = initial
        ? await api<Lesson>({ method: 'PATCH', path: `/admin/classes/${initial.id}`, body })
        : await api<Lesson>({ method: 'POST', path: '/admin/classes', body });
      if (publish) await api({ method: 'POST', path: `/admin/classes/${saved.id}/publish` });
      setDirty(false);
      toast(publish ? 'Class published' : 'Class saved', publish ? 'The class archive shows a published class whose listing is not hidden.' : 'A hidden listing stays off the public site until you publish.');
      navigate(`/admin/classes/${saved.id}`);
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) setErrors(error.fieldErrors);
      toast(publish ? 'Could not publish' : 'Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setPending(false);
    }
  };
  const remove = async () => {
    if (!initial) return;
    const ok = await confirm({ title: 'Delete this class?', text: 'The public archive will stop showing it if it was a sample.', danger: true });
    if (!ok) return;
    await api({ method: 'DELETE', path: `/admin/classes/${initial.id}` });
    navigate('/admin/classes');
  };
  return (
    <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget, false); }} onChange={() => setDirty(true)} noValidate>
      <div className="a-head"><div><h1>{initial ? 'Edit class' : 'New class'}</h1><p>Sample curriculum. Order is still to be confirmed.</p></div>{initial ? <Link className="btn btn--ghost btn--sm" to={isApiPublic(initial) ? `/classes/${initial.id}` : `/admin/classes/${initial.id}`}>Preview</Link> : null}</div>
      <ErrorSummary errors={errors} />
      <div className="form-layout">
        <div className="form-stack">
          <section className="panel"><div className="panel__head"><h2>Basics</h2></div><div className="panel__body form-grid">
            <Field id="title" label="Class title" error={errors.title} className="full"><input className="input" id="title" name="title" defaultValue={initial?.title ?? ''} disabled={!writable} /></Field>
            <Field id="slug" label="URL slug" error={errors.slug}><input className="input" id="slug" name="slug" defaultValue={initial?.slug ?? ''} disabled={!writable} /></Field>
            <Field id="moduleId" label="Module" error={errors.moduleId}><select className="select" id="moduleId" name="moduleId" defaultValue={initial?.moduleId ?? ''} disabled={!writable}><option value="">Choose…</option>{MODULES.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}</select></Field>
            <Field id="week" label="Week" error={errors.week}><input className="input" id="week" name="week" type="number" min={1} max={18} defaultValue={initial?.week ?? 1} disabled={!writable} /></Field>
            <Field id="date" label="Date" error={errors.date}><input className="input" id="date" name="date" type="date" defaultValue={initial?.date ?? '2026-10-05'} disabled={!writable} /></Field>
            <Field id="format" label="Format"><select className="select" id="format" name="format" defaultValue={initial?.format ?? 'Lecture + lab'} disabled={!writable}><option>Lecture + lab</option><option>Hands-on lab</option><option>Workshop</option></select></Field>
            <Field id="room" label="Room"><input className="input" id="room" name="room" defaultValue={initial?.room ?? ''} disabled={!writable} /></Field>
          </div></section>
          <section className="panel"><div className="panel__head"><h2>Content</h2></div><div className="panel__body form-stack">
            <Field id="summary" label="Summary" error={errors.summary}><textarea className="textarea" id="summary" name="summary" defaultValue={initial?.summary ?? ''} disabled={!writable} /></Field>
            <Field id="objectives" label="Objectives" hint="One per line."><textarea className="textarea" id="objectives" name="objectives" defaultValue={(initial?.objectives ?? []).join('\n')} disabled={!writable} /></Field>
            <Field id="lab" label="Lab notes"><textarea className="textarea" id="lab" name="lab" defaultValue={initial?.lab ?? ''} disabled={!writable} /></Field>
            <Field id="codeSample" label="Lab illustration" hint="Shown as text. Keep it to the isolated lab."><textarea className="textarea" id="codeSample" name="codeSample" defaultValue={initial?.codeSample ?? ''} disabled={!writable} /></Field>
            <Field id="internalNotes" label="Internal notes" hint="Never shown on the public lesson."><textarea className="textarea" id="internalNotes" name="internalNotes" defaultValue={initial?.internalNotes ?? ''} disabled={!writable} /></Field>
          </div></section>
        </div>
        <aside className="form-side">
          <section className="panel"><div className="panel__head"><h2>Publishing</h2></div><div className="panel__body">
            <Field id="publicationStatus" label="Workflow"><select className="select" id="publicationStatus" name="publicationStatus" defaultValue={initial?.publicationStatus ?? 'draft'} disabled={!writable}><option value="draft">Draft</option><option value="in_review">In review</option><option value="scheduled">Scheduled</option><option value="published">Published</option></select></Field>
            <Field id="listing" label="Listing" hint="Sample stays visible and labelled. Hidden stays off the public site."><select className="select" id="listing" name="listing" defaultValue={initial?.listing ?? 'hidden'} disabled={!writable}><option value="hidden">Hidden</option><option value="sample">Sample</option><option value="public">Public</option></select></Field>
          </div></section>
          {initial && writable ? <button className="btn btn--ghost btn--sm" type="button" onClick={() => void remove()}>Delete class</button> : null}
        </aside>
      </div>
      {writable ? <SaveBar dirty={dirty} pending={pending} onCancel="/admin/classes" label="Save class" extra={<button className="btn btn--sm" type="button" disabled={pending} onClick={() => { if (formRef.current) void submit(formRef.current, true); }}>Publish</button>} /> : <p className="muted">Viewers can read this form. Saving is refused for this role.</p>}
    </form>
  );
}

export function TraineeEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const record = useEditorRecord<Trainee>('/admin/trainees', isNew ? undefined : id);
  usePageMeta(isNew ? 'New trainee' : 'Edit trainee');
  if (!isNew && record.loading) return <LoadingRows />;
  if (!isNew && (record.error || record.data === null)) return <ErrorState title="Trainee not found" text={record.error?.message ?? 'It may have been deleted, or the link may be wrong.'} />;
  return <TraineeForm initial={record.data} />;
}

function TraineeForm({ initial }: { initial: Trainee | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const writable = auth.allowed('content.write');
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  const save = async (form: HTMLFormElement, publish: boolean) => {
    const data = Object.fromEntries(new FormData(form));
    const consentReceived = data.consentReceived === 'on';
    let listing = String(data.listing ?? 'sample');
    if (publish && listing === 'hidden') listing = 'public';
    if (publish && !consentReceived) {
      setErrors({ consentReceived: 'Record consent before publishing this profile.' });
      toast('Consent required', 'Tick consent before this profile can be published.', 'error');
      return;
    }
    const body = {
      displayName: String(data.displayName ?? ''),
      email: String(data.email ?? ''),
      track: String(data.track ?? 'Blue team'),
      focus: String(data.focus ?? 'network'),
      skills: String(data.skills ?? '').split(',').map((item) => item.trim()).filter(Boolean),
      bio: String(data.bio ?? ''),
      quote: String(data.quote ?? ''),
      linkedin: optionalLink(String(data.linkedin ?? '')),
      portfolio: optionalLink(String(data.portfolio ?? '')),
      consentReceived,
      listing,
      publicationStatus: String(data.publicationStatus ?? 'draft'),
      statusLabel: String(data.statusLabel ?? 'In training'),
      internalNotes: String(data.internalNotes ?? ''),
    };
    setPending(true);
    try {
      const saved = initial
        ? await api<Trainee>({ method: 'PATCH', path: `/admin/trainees/${initial.id}`, body })
        : await api<Trainee>({ method: 'POST', path: '/admin/trainees', body });
      if (publish) await api({ method: 'POST', path: `/admin/trainees/${saved.id}/publish` });
      toast(publish ? 'Profile published' : 'Profile saved', publish ? 'The public trainees page can show this profile.' : 'LinkedIn and portfolio can stay empty.');
      setDirty(false);
      setErrors({});
      navigate(`/admin/trainees/${saved.id}`);
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) setErrors(error.fieldErrors);
      toast(publish ? 'Could not publish' : 'Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  return (
    <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void save(event.currentTarget, false); }} onChange={() => setDirty(true)} noValidate>
      <div className="a-head"><div><h1>{initial ? initial.displayName : 'New trainee'}</h1><p>Do not enter a real person’s name. Samples only until consent exists.</p></div>{initial ? <Link className="btn btn--ghost btn--sm" to={isApiPublic(initial) ? `/trainees/${initial.id}` : `/admin/trainees/${initial.id}`}>Preview</Link> : null}</div>
      <ErrorSummary errors={errors} />
      <div className="form-grid">
        <Field id="displayName" label="Display name" error={errors.displayName}><input className="input" id="displayName" name="displayName" defaultValue={initial?.displayName ?? ''} disabled={!writable} /></Field>
        <Field id="email" label="Email" error={errors.email} hint="Private. Stripped from the public profile."><input className="input" id="email" name="email" type="email" defaultValue={initial?.email ?? ''} disabled={!writable} /></Field>
        <Field id="track" label="Track"><select className="select" id="track" name="track" defaultValue={initial?.track ?? 'Blue team'} disabled={!writable}><option>Blue team</option><option>Red team</option><option>GRC & Awareness</option></select></Field>
        <Field id="focus" label="Focus"><select className="select" id="focus" name="focus" defaultValue={initial?.focus ?? 'network'} disabled={!writable}>{MODULES.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}</select></Field>
        <Field id="skills" label="Skills" className="span-2" hint="Comma separated."><input className="input" id="skills" name="skills" defaultValue={initial?.skills.join(', ') ?? ''} disabled={!writable} /></Field>
        <Field id="bio" label="Bio" className="span-2"><textarea className="textarea" id="bio" name="bio" defaultValue={initial?.bio ?? ''} disabled={!writable} /></Field>
        <Field id="quote" label="Quote" className="span-2"><input className="input" id="quote" name="quote" defaultValue={initial?.quote ?? ''} disabled={!writable} /></Field>
        <Field id="linkedin" label="LinkedIn" error={errors.linkedin} hint="Optional. Leave blank, or use a full https:// link."><input className="input" id="linkedin" name="linkedin" defaultValue={initial?.linkedin ?? ''} disabled={!writable} /></Field>
        <Field id="portfolio" label="Portfolio" error={errors.portfolio} hint="Optional. Leave blank, or use a full https:// link."><input className="input" id="portfolio" name="portfolio" defaultValue={initial?.portfolio ?? ''} disabled={!writable} /></Field>
        <Field id="statusLabel" label="Status label"><input className="input" id="statusLabel" name="statusLabel" defaultValue={initial?.statusLabel ?? 'In training'} disabled={!writable} /></Field>
        <Field id="publicationStatus" label="Workflow"><select className="select" id="publicationStatus" name="publicationStatus" defaultValue={initial?.publicationStatus ?? 'draft'} disabled={!writable}><option value="draft">Draft</option><option value="in_review">In review</option><option value="published">Published</option></select></Field>
        <Field id="listing" label="Listing"><select className="select" id="listing" name="listing" defaultValue={initial?.listing ?? 'sample'} disabled={!writable}><option value="hidden">Hidden</option><option value="sample">Sample</option><option value="public">Public</option></select></Field>
        <div className="field span-2"><label className="check"><input type="checkbox" name="consentReceived" defaultChecked={initial?.consentReceived ?? false} disabled={!writable} /> Consent received. Public listing is refused without this.</label></div>
        <Field id="internalNotes" label="Internal notes" className="span-2"><textarea className="textarea" id="internalNotes" name="internalNotes" defaultValue={initial?.internalNotes ?? ''} disabled={!writable} /></Field>
      </div>
      {writable ? <SaveBar dirty={dirty} pending={pending} onCancel="/admin/trainees" label="Save profile" extra={<button className="btn btn--sm" type="button" disabled={pending} onClick={() => { if (formRef.current) void save(formRef.current, true); }}>Publish</button>} /> : null}
    </form>
  );
}

export function ProjectEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const record = useEditorRecord<Project>('/admin/projects', isNew ? undefined : id);
  usePageMeta(isNew ? 'New project' : 'Edit project');
  if (!isNew && record.loading) return <LoadingRows />;
  if (!isNew && (record.error || record.data === null)) return <ErrorState title="Project not found" text={record.error?.message ?? 'It may have been deleted, or the link may be wrong.'} />;
  return <ProjectForm initial={record.data} />;
}

function ProjectForm({ initial }: { initial: Project | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const writable = auth.allowed('content.write');
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  const save = async (form: HTMLFormElement, publish: boolean) => {
    const data = Object.fromEntries(new FormData(form));
    let listing = String(data.listing ?? 'public');
    if (publish && listing === 'hidden') listing = 'public';
    const body = {
      title: String(data.title ?? ''),
      type: String(data.type ?? ''),
      moduleId: String(data.moduleId ?? 'network'),
      abstract: String(data.abstract ?? ''),
      tools: String(data.tools ?? ''),
      steps: String(data.steps ?? '').split('\n').map((line) => line.trim()).filter(Boolean),
      team: String(data.team ?? '').split(',').map((item) => item.trim()).filter(Boolean),
      repositoryUrl: optionalLink(String(data.repositoryUrl ?? '')) ?? '',
      demoUrl: optionalLink(String(data.demoUrl ?? '')) ?? '',
      labOnlyConfirmed: data.labOnlyConfirmed === 'on',
      shareAgreed: data.shareAgreed === 'on',
      publicationStatus: String(data.publicationStatus ?? 'draft'),
      listing,
      internalNotes: String(data.internalNotes ?? ''),
      image: initial?.image ?? 'electronics-lab',
      cover: initial?.cover ?? 'terminal',
    };
    setPending(true);
    try {
      const saved = initial ? await api<Project>({ method: 'PATCH', path: `/admin/projects/${initial.id}`, body }) : await api<Project>({ method: 'POST', path: '/admin/projects', body });
      if (publish) await api({ method: 'POST', path: `/admin/projects/${saved.id}/publish` });
      toast(publish ? 'Project published' : 'Project saved', publish ? 'A public listing now appears on the projects page.' : 'Repository and demo links stay off the public page. A hidden listing stays off the site until you publish.');
      setDirty(false);
      setErrors({});
      navigate(`/admin/projects/${saved.id}`);
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) setErrors(error.fieldErrors);
      toast(publish ? 'Could not publish' : 'Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  return (
    <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void save(event.currentTarget, false); }} onChange={() => setDirty(true)} noValidate>
      <div className="a-head"><div><h1>{initial ? 'Edit project' : 'New project'}</h1></div>{initial ? <Link className="btn btn--ghost btn--sm" to={isApiPublic(initial) ? `/projects/${initial.id}` : `/admin/projects/${initial.id}`}>Preview</Link> : null}</div>
      <ErrorSummary errors={errors} />
      <div className="form-grid">
        <Field id="title" label="Title" error={errors.title} className="span-2" hint="At least 6 characters."><input className="input" id="title" name="title" defaultValue={initial?.title ?? ''} disabled={!writable} /></Field>
        <Field id="type" label="Type" error={errors.type}><select className="select" id="type" name="type" defaultValue={initial?.type ?? ''} disabled={!writable}><option value="">Choose…</option><option>Lab</option><option>CTF</option><option>Case study</option><option>Community project</option><option>Capstone</option></select></Field>
        <Field id="moduleId" label="Module"><select className="select" id="moduleId" name="moduleId" defaultValue={initial?.moduleId ?? 'network'} disabled={!writable}>{MODULES.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}</select></Field>
        <Field id="abstract" label="Abstract" error={errors.abstract} className="span-2" hint="At least 30 characters."><textarea className="textarea" id="abstract" name="abstract" defaultValue={initial?.abstract ?? ''} disabled={!writable} /></Field>
        <Field id="tools" label="Tools" className="span-2"><input className="input" id="tools" name="tools" defaultValue={initial?.tools ?? ''} disabled={!writable} /></Field>
        <Field id="steps" label="Steps" className="span-2" hint="One per line."><textarea className="textarea" id="steps" name="steps" defaultValue={initial?.steps.join('\n') ?? ''} disabled={!writable} /></Field>
        <Field id="team" label="Sample team" hint="Comma separated placeholders."><input className="input" id="team" name="team" defaultValue={initial?.team.join(', ') ?? ''} disabled={!writable} /></Field>
        <Field id="publicationStatus" label="Workflow"><select className="select" id="publicationStatus" name="publicationStatus" defaultValue={initial?.publicationStatus ?? 'draft'} disabled={!writable}><option value="draft">Draft</option><option value="in_review">In review</option><option value="published">Published</option></select></Field>
        <Field id="listing" label="Listing" hint="Hidden stays off the public site. Publish turns a hidden listing into public."><select className="select" id="listing" name="listing" defaultValue={initial?.listing ?? 'public'} disabled={!writable}><option value="hidden">Hidden</option><option value="sample">Sample</option><option value="public">Public</option></select></Field>
        <Field id="repositoryUrl" label="Repository URL" error={errors.repositoryUrl} hint="Optional. Private until share is agreed."><input className="input" id="repositoryUrl" name="repositoryUrl" defaultValue={initial?.repositoryUrl ?? ''} disabled={!writable} /></Field>
        <Field id="demoUrl" label="Demo URL" error={errors.demoUrl}><input className="input" id="demoUrl" name="demoUrl" defaultValue={initial?.demoUrl ?? ''} disabled={!writable} /></Field>
        <div className="field"><label className="check"><input type="checkbox" name="labOnlyConfirmed" defaultChecked={initial?.labOnlyConfirmed ?? true} disabled={!writable} /> Lab-only confirmed</label></div>
        <div className="field"><label className="check"><input type="checkbox" name="shareAgreed" defaultChecked={initial?.shareAgreed ?? false} disabled={!writable} /> Team agreed to share links</label></div>
        <Field id="internalNotes" label="Internal notes" className="span-2"><textarea className="textarea" id="internalNotes" name="internalNotes" defaultValue={initial?.internalNotes ?? ''} disabled={!writable} /></Field>
      </div>
      {writable ? <SaveBar dirty={dirty} pending={pending} onCancel="/admin/projects" label="Save project" extra={<button className="btn btn--sm" type="button" disabled={pending} onClick={() => { if (formRef.current) void save(formRef.current, true); }}>Publish</button>} /> : null}
    </form>
  );
}

export function EventEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const record = useEditorRecord<BootcampEvent>('/admin/events', isNew ? undefined : id);
  usePageMeta(isNew ? 'New event' : 'Edit event');
  if (!isNew && record.loading) return <LoadingRows />;
  if (!isNew && (record.error || record.data === null)) return <ErrorState title="Event not found" text={record.error?.message ?? 'It may have been deleted, or the link may be wrong.'} />;
  return <EventForm initial={record.data} />;
}

function optionalLink(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function EventForm({ initial }: { initial: BootcampEvent | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const writable = auth.allowed('content.write');
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  const save = async (form: HTMLFormElement, publish: boolean) => {
    const data = Object.fromEntries(new FormData(form));
    let listing = String(data.listing ?? 'public');
    if (publish && listing === 'hidden') listing = 'public';
    const body = {
      title: String(data.title ?? ''),
      date: String(data.date ?? ''),
      dateTbc: data.dateTbc === 'on',
      whenLabel: String(data.whenLabel ?? ''),
      place: String(data.place ?? ''),
      kind: String(data.kind ?? 'Milestone'),
      verified: data.verified === 'on',
      sample: data.sample === 'on',
      summary: String(data.summary ?? ''),
      source: String(data.source ?? ''),
      sourceUrl: optionalLink(String(data.sourceUrl ?? '')) ?? '',
      showOnAnniversary: data.showOnAnniversary === 'on',
      calendarDownload: data.calendarDownload === 'on',
      publicationStatus: String(data.publicationStatus ?? 'draft'),
      listing,
      internalNotes: String(data.internalNotes ?? ''),
      body: initial?.body,
      image: initial?.image ?? 'guests-seated',
    };
    setPending(true);
    try {
      const saved = initial ? await api<BootcampEvent>({ method: 'PATCH', path: `/admin/events/${initial.id}`, body }) : await api<BootcampEvent>({ method: 'POST', path: '/admin/events', body });
      if (publish) await api({ method: 'POST', path: `/admin/events/${saved.id}/publish` });
      toast(publish ? 'Event published' : 'Event saved', publish ? 'The public events page shows a published event whose listing is not hidden.' : 'A hidden listing stays off the public site until you publish.');
      setDirty(false);
      setErrors({});
      navigate(`/admin/events/${saved.id}`);
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) setErrors(error.fieldErrors);
      toast(publish ? 'Could not publish' : 'Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  return (
    <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void save(event.currentTarget, false); }} onChange={() => setDirty(true)} noValidate>
      <div className="a-head"><div><h1>{initial ? initial.title : 'New event'}</h1><p>Do not invent a date. Mark it to be confirmed instead.</p></div>{initial ? <Link className="btn btn--ghost btn--sm" to={isApiPublic(initial) ? `/events/${initial.id}` : `/admin/events/${initial.id}`}>Preview</Link> : null}</div>
      <ErrorSummary errors={errors} />
      <div className="form-grid">
        <Field id="title" label="Title" error={errors.title} className="span-2"><input className="input" id="title" name="title" defaultValue={initial?.title ?? ''} disabled={!writable} /></Field>
        <Field id="date" label="Date" error={errors.date}><input className="input" id="date" name="date" type="date" defaultValue={initial?.date ?? '2026-10-24'} disabled={!writable} /></Field>
        <Field id="whenLabel" label="When label"><input className="input" id="whenLabel" name="whenLabel" defaultValue={initial?.whenLabel ?? ''} disabled={!writable} /></Field>
        <Field id="place" label="Place" error={errors.place} className="span-2"><input className="input" id="place" name="place" defaultValue={initial?.place ?? ''} disabled={!writable} /></Field>
        <Field id="kind" label="Kind"><select className="select" id="kind" name="kind" defaultValue={initial?.kind ?? 'Milestone'} disabled={!writable}><option>Milestone</option><option>Anniversary</option><option>Partner event</option></select></Field>
        <Field id="publicationStatus" label="Workflow"><select className="select" id="publicationStatus" name="publicationStatus" defaultValue={initial?.publicationStatus ?? 'draft'} disabled={!writable}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option></select></Field>
        <Field id="summary" label="Summary" error={errors.summary} className="span-2" hint="At least 20 characters."><textarea className="textarea" id="summary" name="summary" defaultValue={initial?.summary ?? ''} disabled={!writable} /></Field>
        <Field id="source" label="Source note" className="span-2"><input className="input" id="source" name="source" defaultValue={initial?.source ?? ''} disabled={!writable} /></Field>
        <Field id="sourceUrl" label="Source URL" error={errors.sourceUrl} className="span-2" hint="Required when the event is marked verified. Otherwise optional."><input className="input" id="sourceUrl" name="sourceUrl" defaultValue={initial?.sourceUrl ?? ''} disabled={!writable} /></Field>
        <Field id="listing" label="Listing" hint="Hidden stays off the public site. Publish turns a hidden listing into public."><select className="select" id="listing" name="listing" defaultValue={initial?.listing ?? 'public'} disabled={!writable}><option value="hidden">Hidden</option><option value="sample">Sample</option><option value="public">Public</option></select></Field>
        <Field id="internalNotes" label="Internal notes" className="span-2"><textarea className="textarea" id="internalNotes" name="internalNotes" defaultValue={initial?.internalNotes ?? ''} disabled={!writable} /></Field>
        <div className="field"><label className="check"><input type="checkbox" name="dateTbc" defaultChecked={initial?.dateTbc ?? false} disabled={!writable} /> Date to be confirmed</label></div>
        <div className="field"><label className="check"><input type="checkbox" name="verified" defaultChecked={initial?.verified ?? false} disabled={!writable} /> Verified against a source</label></div>
        <div className="field"><label className="check"><input type="checkbox" name="sample" defaultChecked={initial?.sample ?? true} disabled={!writable} /> Sample milestone</label></div>
        <div className="field"><label className="check"><input type="checkbox" name="showOnAnniversary" defaultChecked={initial?.showOnAnniversary ?? false} disabled={!writable} /> Show on anniversary page</label></div>
        <div className="field"><label className="check"><input type="checkbox" name="calendarDownload" defaultChecked={initial?.calendarDownload ?? false} disabled={!writable} /> Allow calendar download</label></div>
      </div>
      {writable ? <SaveBar dirty={dirty} pending={pending} onCancel="/admin/events" label="Save event" extra={<button className="btn btn--sm" type="button" disabled={pending} onClick={() => { if (formRef.current) void save(formRef.current, true); }}>Publish</button>} /> : null}
    </form>
  );
}
