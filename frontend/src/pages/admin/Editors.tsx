import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { useAdminForm } from '@/components/adminForm';
import { ErrorSummary, Field, FormLegend, SaveBar, bindBeforeUnload } from '@/components/controls';
import { ErrorState, LoadingRows, useConfirm, useToast } from '@/components/feedback';
import { usePageMeta } from '@/components/SiteChrome';
import { isApiPublic } from '@/domain/publish';
import type { BootcampEvent, Lesson, Project, PublicationStatus, Trainee } from '@/domain/types';
import { isApiError } from '@/domain/types';
import { classFieldErrors, eventFieldErrors, projectFieldErrors, traineeFieldErrors, withConsentField, withPhaseOnWeek } from '@/domain/adminFields';
import { useAsync } from '@/hooks/useAsync';
import { selectedIds, useAllPages, useMediaOptions, useModules, withCurrent } from './options';

function useEditorRecord<T extends { id: string }>(path: string, id: string | undefined) {
  const enabled = Boolean(id && id !== 'new');
  return useAsync(`${path}:${id ?? 'new'}`, () => api<T>({ method: 'GET', path: `${path}/${id}` }), enabled);
}

const CLASS_LABELS = { title: 'Title', moduleId: 'Module', week: 'Week', date: 'Date', summary: 'Summary' };
const TRAINEE_LABELS = { displayName: 'Display name', email: 'Email', track: 'Track', focus: 'Focus', linkedin: 'LinkedIn', portfolio: 'Portfolio', consentReceived: 'Consent', publicationStatus: 'Workflow' };
const PROJECT_LABELS = { title: 'Title', type: 'Type', moduleId: 'Module', abstract: 'Abstract', repositoryUrl: 'Repository URL', demoUrl: 'Demo URL', traineeIds: 'Trainees', lessonIds: 'Classes' };
const EVENT_LABELS = { title: 'Title', date: 'Date', place: 'Place', summary: 'Summary', startTime: 'Start time', endTime: 'End time', sourceUrl: 'Source URL', lessonIds: 'Classes', projectIds: 'Projects', mediaIds: 'Photos' };

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
  const admin = useAdminForm();
  const modules = withCurrent(useModules(), initial?.moduleId);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const modeRef = useRef<'save' | 'publish'>('save');
  const writable = auth.allowed('content.write');
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  const read = (form: HTMLFormElement) => {
    const data = Object.fromEntries(new FormData(form));
    return {
      title: String(data.title ?? ''),
      moduleId: String(data.moduleId ?? ''),
      week: String(data.week ?? ''),
      date: String(data.date ?? ''),
      summary: String(data.summary ?? ''),
    };
  };
  const submit = async (form: HTMLFormElement, publish: boolean) => {
    if (!writable) return;
    modeRef.current = publish ? 'publish' : 'save';
    const values = read(form);
    if (!admin.block(classFieldErrors(values, modeRef.current))) return;
    const data = Object.fromEntries(new FormData(form));
    let listing = data.listing === 'public' ? 'public' : data.listing === 'sample' ? 'sample' : 'hidden';
    if (publish && listing === 'hidden') listing = 'public';
    const body = {
      title: values.title,
      slug: String(data.slug ?? ''),
      moduleId: values.moduleId,
      week: Number(values.week),
      date: values.date,
      format: String(data.format ?? 'Lecture + lab'),
      room: String(data.room ?? ''),
      summary: values.summary,
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
      admin.setErrors({});
      toast(publish ? 'Class published' : 'Class saved', publish ? 'The class archive shows a published class whose listing is not hidden.' : 'A hidden listing stays off the public site until you publish.');
      navigate(`/admin/classes/${saved.id}`);
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) admin.applyServer(withPhaseOnWeek(error.fieldErrors));
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
    <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget, false); }} onChange={(event) => { setDirty(true); const id = eventTargetId(event.target); if (!id || !formRef.current) return; const problems = classFieldErrors(read(formRef.current), modeRef.current); admin.clearFixed(id, problems[id]); }} noValidate>
      <div className="a-head"><div><h1>{initial ? 'Edit class' : 'New class'}</h1><p>Sample curriculum. Order is still to be confirmed.</p></div>{initial ? <Link className="btn btn--ghost btn--sm" to={isApiPublic(initial) ? `/classes/${initial.id}` : `/admin/classes/${initial.id}`}>Preview</Link> : null}</div>
      <FormLegend />
      <ErrorSummary errors={admin.errors} labels={CLASS_LABELS} summaryRef={admin.summaryRef} />
      <div className="form-layout">
        <div className="form-stack">
          <section className="panel"><div className="panel__head"><h2>Basics</h2></div><div className="panel__body form-grid">
            <Field id="title" label="Class title" required error={admin.errors.title} className="full"><input className="input" id="title" name="title" defaultValue={initial?.title ?? ''} disabled={!writable} /></Field>
            <Field id="slug" label="URL slug" required={false} error={admin.errors.slug}><input className="input" id="slug" name="slug" defaultValue={initial?.slug ?? ''} disabled={!writable} /></Field>
            <Field id="moduleId" label="Module" required error={admin.errors.moduleId}><select className="select" id="moduleId" name="moduleId" defaultValue={initial?.moduleId ?? ''} disabled={!writable}><option value="">Choose…</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}</select></Field>
            <Field id="week" label="Week" required error={admin.errors.week}><input className="input" id="week" name="week" type="number" min={1} max={18} defaultValue={initial?.week ?? 1} disabled={!writable} /></Field>
            <Field id="date" label="Date" required error={admin.errors.date}><input className="input" id="date" name="date" type="date" defaultValue={initial?.date ?? '2026-10-05'} disabled={!writable} /></Field>
            <Field id="format" label="Format" required={false}><select className="select" id="format" name="format" defaultValue={initial?.format ?? 'Lecture + lab'} disabled={!writable}><option>Lecture + lab</option><option>Hands-on lab</option><option>Workshop</option></select></Field>
            <Field id="room" label="Room" required={false}><input className="input" id="room" name="room" defaultValue={initial?.room ?? ''} disabled={!writable} /></Field>
          </div></section>
          <section className="panel"><div className="panel__head"><h2>Content</h2></div><div className="panel__body form-stack">
            <Field id="summary" label="Summary" required error={admin.errors.summary}><textarea className="textarea" id="summary" name="summary" defaultValue={initial?.summary ?? ''} disabled={!writable} /></Field>
            <Field id="objectives" label="Objectives" required={false} hint="One per line."><textarea className="textarea" id="objectives" name="objectives" defaultValue={(initial?.objectives ?? []).join('\n')} disabled={!writable} /></Field>
            <Field id="lab" label="Lab notes" required={false}><textarea className="textarea" id="lab" name="lab" defaultValue={initial?.lab ?? ''} disabled={!writable} /></Field>
            <Field id="codeSample" label="Lab illustration" required={false} hint="Shown as text. Keep it to the isolated lab."><textarea className="textarea" id="codeSample" name="codeSample" defaultValue={initial?.codeSample ?? ''} disabled={!writable} /></Field>
            <Field id="internalNotes" label="Internal notes" required={false} hint="Never shown on the public lesson."><textarea className="textarea" id="internalNotes" name="internalNotes" defaultValue={initial?.internalNotes ?? ''} disabled={!writable} /></Field>
          </div></section>
        </div>
        <aside className="form-side">
          <section className="panel"><div className="panel__head"><h2>Publishing</h2></div><div className="panel__body">
            <Field id="publicationStatus" label="Workflow" required={false}><select className="select" id="publicationStatus" name="publicationStatus" defaultValue={initial?.publicationStatus ?? 'draft'} disabled={!writable}><option value="draft">Draft</option><option value="in_review">In review</option><option value="scheduled">Scheduled</option><option value="published">Published</option></select></Field>
            <Field id="listing" label="Listing" required={false} hint="Sample stays visible and labelled. Hidden stays off the public site."><select className="select" id="listing" name="listing" defaultValue={initial?.listing ?? 'hidden'} disabled={!writable}><option value="hidden">Hidden</option><option value="sample">Sample</option><option value="public">Public</option></select></Field>
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
  const admin = useAdminForm();
  const modules = withCurrent(useModules(), initial?.focus);
  const classes = useAllPages<Lesson>('/admin/classes');
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const modeRef = useRef<'save' | 'publish'>('save');
  const writable = auth.allowed('content.write');
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  const read = (form: HTMLFormElement) => {
    const data = Object.fromEntries(new FormData(form));
    return {
      displayName: String(data.displayName ?? ''),
      email: String(data.email ?? ''),
      track: String(data.track ?? ''),
      focus: String(data.focus ?? ''),
      linkedin: String(data.linkedin ?? ''),
      portfolio: String(data.portfolio ?? ''),
      consentReceived: data.consentReceived === 'on',
      publicationStatus: String(data.publicationStatus ?? 'draft'),
    };
  };
  const save = async (form: HTMLFormElement, publish: boolean) => {
    modeRef.current = publish ? 'publish' : 'save';
    const values = read(form);
    if (!admin.block(traineeFieldErrors(values, modeRef.current))) return;
    const data = Object.fromEntries(new FormData(form));
    let listing = String(data.listing ?? 'sample');
    if (publish && listing === 'hidden') listing = 'public';
    const body = {
      displayName: values.displayName,
      email: values.email,
      track: values.track,
      focus: values.focus,
      skills: String(data.skills ?? '').split(',').map((item) => item.trim()).filter(Boolean),
      bio: String(data.bio ?? ''),
      quote: String(data.quote ?? ''),
      linkedin: optionalLink(values.linkedin),
      portfolio: optionalLink(values.portfolio),
      consentReceived: values.consentReceived,
      lessonIds: selectedIds(form, 'lessonIds'),
      listing,
      publicationStatus: publish ? 'published' : values.publicationStatus,
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
      admin.setErrors({});
      navigate(`/admin/trainees/${saved.id}`);
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) admin.applyServer(withConsentField(error.fieldErrors));
      toast(publish ? 'Could not publish' : 'Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  return (
    <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void save(event.currentTarget, false); }} onChange={(event) => { setDirty(true); const id = eventTargetId(event.target); if (!id || !formRef.current) return; const problems = traineeFieldErrors(read(formRef.current), modeRef.current); admin.clearFixed(id, problems[id]); if (id === 'consentReceived') admin.clearFixed('publicationStatus', problems.publicationStatus); }} noValidate>
      <div className="a-head"><div><h1>{initial ? initial.displayName : 'New trainee'}</h1><p>Do not enter a real person’s name. Samples only until consent exists.</p></div>{initial ? <Link className="btn btn--ghost btn--sm" to={isApiPublic(initial) ? `/trainees/${initial.id}` : `/admin/trainees/${initial.id}`}>Preview</Link> : null}</div>
      <FormLegend />
      <ErrorSummary errors={admin.errors} labels={TRAINEE_LABELS} summaryRef={admin.summaryRef} />
      <div className="form-grid">
        <Field id="displayName" label="Display name" required error={admin.errors.displayName}><input className="input" id="displayName" name="displayName" defaultValue={initial?.displayName ?? ''} disabled={!writable} /></Field>
        <Field id="email" label="Email" required error={admin.errors.email} hint="Private. Stripped from the public profile."><input className="input" id="email" name="email" type="email" defaultValue={initial?.email ?? ''} disabled={!writable} /></Field>
        <Field id="track" label="Track" required error={admin.errors.track}><select className="select" id="track" name="track" defaultValue={initial?.track ?? 'Blue team'} disabled={!writable}><option>Blue team</option><option>Red team</option><option>GRC & Awareness</option></select></Field>
        <Field id="focus" label="Focus" required error={admin.errors.focus}><select className="select" id="focus" name="focus" defaultValue={initial?.focus ?? ''} disabled={!writable}><option value="">Choose…</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}</select></Field>
        <Field id="skills" label="Skills" required={false} className="span-2" hint="Comma separated."><input className="input" id="skills" name="skills" defaultValue={initial?.skills.join(', ') ?? ''} disabled={!writable} /></Field>
        <Field id="bio" label="Bio" required={false} className="span-2"><textarea className="textarea" id="bio" name="bio" defaultValue={initial?.bio ?? ''} disabled={!writable} /></Field>
        <Field id="quote" label="Quote" required={false} className="span-2"><input className="input" id="quote" name="quote" defaultValue={initial?.quote ?? ''} disabled={!writable} /></Field>
        <Field id="linkedin" label="LinkedIn" required={false} error={admin.errors.linkedin} hint="Leave blank, or use a full http:// or https:// link."><input className="input" id="linkedin" name="linkedin" defaultValue={initial?.linkedin ?? ''} disabled={!writable} /></Field>
        <Field id="portfolio" label="Portfolio" required={false} error={admin.errors.portfolio} hint="Leave blank, or use a full http:// or https:// link."><input className="input" id="portfolio" name="portfolio" defaultValue={initial?.portfolio ?? ''} disabled={!writable} /></Field>
        <RelationSelect id="lessonIds" label="Classes" error={admin.errors.lessonIds} disabled={!writable} selected={initial?.lessonIds ?? []} options={classes.map((lesson) => ({ id: lesson.id, label: `W${String(lesson.week).padStart(2, '0')} ${lesson.title}` }))} />
        <Field id="statusLabel" label="Status label" required={false}><input className="input" id="statusLabel" name="statusLabel" defaultValue={initial?.statusLabel ?? 'In training'} disabled={!writable} /></Field>
        <Field id="publicationStatus" label="Workflow" required={false} error={admin.errors.publicationStatus}><select className="select" id="publicationStatus" name="publicationStatus" defaultValue={initial?.publicationStatus ?? 'draft'} disabled={!writable}><option value="draft">Draft</option><option value="in_review">In review</option><option value="published">Published</option></select></Field>
        <Field id="listing" label="Listing" required={false}><select className="select" id="listing" name="listing" defaultValue={initial?.listing ?? 'sample'} disabled={!writable}><option value="hidden">Hidden</option><option value="sample">Sample</option><option value="public">Public</option></select></Field>
        <Field id="consentReceived" label="Consent" required={false} error={admin.errors.consentReceived} hint="Required before this profile can be published." className="span-2"><input type="checkbox" id="consentReceived" name="consentReceived" defaultChecked={initial?.consentReceived ?? false} disabled={!writable} /></Field>
        <Field id="internalNotes" label="Internal notes" required={false} className="span-2"><textarea className="textarea" id="internalNotes" name="internalNotes" defaultValue={initial?.internalNotes ?? ''} disabled={!writable} /></Field>
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
  const admin = useAdminForm();
  const modules = withCurrent(useModules(), initial?.moduleId);
  const classes = useAllPages<Lesson>('/admin/classes');
  const trainees = useAllPages<Trainee>('/admin/trainees');
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const writable = auth.allowed('content.write');
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  const read = (form: HTMLFormElement) => {
    const data = Object.fromEntries(new FormData(form));
    return {
      title: String(data.title ?? ''),
      type: String(data.type ?? ''),
      moduleId: String(data.moduleId ?? ''),
      abstract: String(data.abstract ?? ''),
      repositoryUrl: String(data.repositoryUrl ?? ''),
      demoUrl: String(data.demoUrl ?? ''),
    };
  };
  const save = async (form: HTMLFormElement, publish: boolean) => {
    if (!admin.block(projectFieldErrors(read(form)))) return;
    const data = Object.fromEntries(new FormData(form));
    let listing = String(data.listing ?? 'public');
    if (publish && listing === 'hidden') listing = 'public';
    const values = read(form);
    const body = {
      title: values.title,
      type: values.type,
      moduleId: values.moduleId,
      abstract: values.abstract,
      tools: String(data.tools ?? ''),
      steps: String(data.steps ?? '').split('\n').map((line) => line.trim()).filter(Boolean),
      team: String(data.team ?? '').split(',').map((item) => item.trim()).filter(Boolean),
      traineeIds: selectedIds(form, 'traineeIds'),
      lessonIds: selectedIds(form, 'lessonIds'),
      repositoryUrl: optionalLink(values.repositoryUrl) ?? '',
      demoUrl: optionalLink(values.demoUrl) ?? '',
      labOnlyConfirmed: data.labOnlyConfirmed === 'on',
      shareAgreed: data.shareAgreed === 'on',
      publicationStatus: publish ? 'published' : String(data.publicationStatus ?? 'draft'),
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
      admin.setErrors({});
      navigate(`/admin/projects/${saved.id}`);
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) admin.applyServer(error.fieldErrors);
      toast(publish ? 'Could not publish' : 'Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  return (
    <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void save(event.currentTarget, false); }} onChange={(event) => { setDirty(true); const id = eventTargetId(event.target); if (!id || !formRef.current) return; admin.clearFixed(id, projectFieldErrors(read(formRef.current))[id]); }} noValidate>
      <div className="a-head"><div><h1>{initial ? 'Edit project' : 'New project'}</h1></div>{initial ? <Link className="btn btn--ghost btn--sm" to={isApiPublic(initial) ? `/projects/${initial.id}` : `/admin/projects/${initial.id}`}>Preview</Link> : null}</div>
      <FormLegend />
      <ErrorSummary errors={admin.errors} labels={PROJECT_LABELS} summaryRef={admin.summaryRef} />
      <div className="form-grid">
        <Field id="title" label="Title" required error={admin.errors.title} className="span-2" hint="At least 6 characters."><input className="input" id="title" name="title" defaultValue={initial?.title ?? ''} disabled={!writable} /></Field>
        <Field id="type" label="Type" required error={admin.errors.type}><select className="select" id="type" name="type" defaultValue={initial?.type ?? ''} disabled={!writable}><option value="">Choose…</option><option>Lab</option><option>CTF</option><option>Case study</option><option>Community project</option><option>Capstone</option></select></Field>
        <Field id="moduleId" label="Module" required error={admin.errors.moduleId}><select className="select" id="moduleId" name="moduleId" defaultValue={initial?.moduleId ?? ''} disabled={!writable}><option value="">Choose…</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}</select></Field>
        <Field id="abstract" label="Abstract" required error={admin.errors.abstract} className="span-2" hint="At least 30 characters."><textarea className="textarea" id="abstract" name="abstract" defaultValue={initial?.abstract ?? ''} disabled={!writable} /></Field>
        <Field id="tools" label="Tools" required={false} className="span-2"><input className="input" id="tools" name="tools" defaultValue={initial?.tools ?? ''} disabled={!writable} /></Field>
        <Field id="steps" label="Steps" required={false} className="span-2" hint="One per line."><textarea className="textarea" id="steps" name="steps" defaultValue={initial?.steps.join('\n') ?? ''} disabled={!writable} /></Field>
        <Field id="team" label="Sample team" required={false} hint="Comma separated placeholders."><input className="input" id="team" name="team" defaultValue={initial?.team.join(', ') ?? ''} disabled={!writable} /></Field>
        <RelationSelect id="traineeIds" label="Trainees" error={admin.errors.traineeIds} disabled={!writable} selected={initial?.traineeIds ?? []} options={trainees.map((trainee) => ({ id: trainee.id, label: trainee.displayName }))} />
        <RelationSelect id="lessonIds" label="Classes" error={admin.errors.lessonIds} disabled={!writable} selected={initial?.lessonIds ?? []} options={classes.map((lesson) => ({ id: lesson.id, label: lesson.title }))} />
        <Field id="publicationStatus" label="Workflow" required={false}><select className="select" id="publicationStatus" name="publicationStatus" defaultValue={initial?.publicationStatus ?? 'draft'} disabled={!writable}><option value="draft">Draft</option><option value="in_review">In review</option><option value="published">Published</option></select></Field>
        <Field id="listing" label="Listing" required={false} hint="Hidden stays off the public site. Publish turns a hidden listing into public."><select className="select" id="listing" name="listing" defaultValue={initial?.listing ?? 'public'} disabled={!writable}><option value="hidden">Hidden</option><option value="sample">Sample</option><option value="public">Public</option></select></Field>
        <Field id="repositoryUrl" label="Repository URL" required={false} error={admin.errors.repositoryUrl} hint="Optional. Private until share is agreed. Use https://."><input className="input" id="repositoryUrl" name="repositoryUrl" defaultValue={initial?.repositoryUrl ?? ''} disabled={!writable} /></Field>
        <Field id="demoUrl" label="Demo URL" required={false} error={admin.errors.demoUrl} hint="Optional. Use https://."><input className="input" id="demoUrl" name="demoUrl" defaultValue={initial?.demoUrl ?? ''} disabled={!writable} /></Field>
        <Field id="labOnlyConfirmed" label="Lab only" required={false}><input type="checkbox" id="labOnlyConfirmed" name="labOnlyConfirmed" defaultChecked={initial?.labOnlyConfirmed ?? true} disabled={!writable} /></Field>
        <Field id="shareAgreed" label="Share links" required={false}><input type="checkbox" id="shareAgreed" name="shareAgreed" defaultChecked={initial?.shareAgreed ?? false} disabled={!writable} /></Field>
        <Field id="internalNotes" label="Internal notes" required={false} className="span-2"><textarea className="textarea" id="internalNotes" name="internalNotes" defaultValue={initial?.internalNotes ?? ''} disabled={!writable} /></Field>
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
  const admin = useAdminForm();
  const classes = useAllPages<Lesson>('/admin/classes');
  const projects = useAllPages<Project>('/admin/projects');
  const media = useMediaOptions();
  const [dateTbc, setDateTbc] = useState(initial?.dateTbc ?? false);
  const [startTime, setStartTime] = useState(initial?.startTime ?? '');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '');
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const writable = auth.allowed('content.write');
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  const read = (form: HTMLFormElement) => {
    const data = Object.fromEntries(new FormData(form));
    const tbc = data.dateTbc === 'on';
    return {
      title: String(data.title ?? ''),
      place: String(data.place ?? ''),
      summary: String(data.summary ?? ''),
      date: String(data.date ?? ''),
      dateTbc: tbc,
      startTime: tbc ? '' : String(data.startTime ?? ''),
      endTime: tbc ? '' : String(data.endTime ?? ''),
      verified: data.verified === 'on',
      sourceUrl: String(data.sourceUrl ?? ''),
    };
  };
  const save = async (form: HTMLFormElement, publish: boolean) => {
    const values = read(form);
    if (!admin.block(eventFieldErrors(values))) return;
    const data = Object.fromEntries(new FormData(form));
    let listing = String(data.listing ?? 'public');
    if (publish && listing === 'hidden') listing = 'public';
    const body = {
      title: values.title,
      date: values.date,
      dateTbc: values.dateTbc,
      startTime: values.startTime,
      endTime: values.endTime,
      whenLabel: String(data.whenLabel ?? ''),
      place: values.place,
      kind: String(data.kind ?? 'Milestone'),
      verified: values.verified,
      sample: data.sample === 'on',
      summary: values.summary,
      source: String(data.source ?? ''),
      sourceUrl: optionalLink(values.sourceUrl) ?? '',
      showOnAnniversary: data.showOnAnniversary === 'on',
      calendarDownload: data.calendarDownload === 'on',
      lessonIds: selectedIds(form, 'lessonIds'),
      projectIds: selectedIds(form, 'projectIds'),
      mediaIds: selectedIds(form, 'mediaIds'),
      publicationStatus: publish ? 'published' : String(data.publicationStatus ?? 'draft'),
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
      admin.setErrors({});
      navigate(`/admin/events/${saved.id}`);
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) admin.applyServer(error.fieldErrors);
      toast(publish ? 'Could not publish' : 'Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  return (
    <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void save(event.currentTarget, false); }} onChange={(event) => { setDirty(true); const id = eventTargetId(event.target); if (!id || !formRef.current) return; const problems = eventFieldErrors(read(formRef.current)); admin.clearFixed(id, problems[id]); if (id === 'dateTbc' || id === 'startTime' || id === 'endTime') { admin.clearFixed('startTime', problems.startTime); admin.clearFixed('endTime', problems.endTime); admin.clearFixed('date', problems.date); } }} noValidate>
      <div className="a-head"><div><h1>{initial ? initial.title : 'New event'}</h1><p>Do not invent a date. Mark it to be confirmed instead.</p></div>{initial ? <Link className="btn btn--ghost btn--sm" to={isApiPublic(initial) ? `/events/${initial.id}` : `/admin/events/${initial.id}`}>Preview</Link> : null}</div>
      <FormLegend />
      <ErrorSummary errors={admin.errors} labels={EVENT_LABELS} summaryRef={admin.summaryRef} />
      <div className="form-grid">
        <Field id="title" label="Title" required error={admin.errors.title} className="span-2"><input className="input" id="title" name="title" defaultValue={initial?.title ?? ''} disabled={!writable} /></Field>
        <Field id="date" label="Date" required={!dateTbc} error={admin.errors.date}><input className="input" id="date" name="date" type="date" defaultValue={initial?.date ?? ''} disabled={!writable} /></Field>
        <Field id="whenLabel" label="When label" required={false}><input className="input" id="whenLabel" name="whenLabel" defaultValue={initial?.whenLabel ?? ''} disabled={!writable} /></Field>
        <Field id="startTime" label="Start time" required={false} error={admin.errors.startTime} hint="Leave blank while the date is to be confirmed."><input className="input" id="startTime" name="startTime" type="time" value={dateTbc ? '' : startTime} disabled={!writable || dateTbc} onChange={(event) => setStartTime(event.target.value)} /></Field>
        <Field id="endTime" label="End time" required={false} error={admin.errors.endTime}><input className="input" id="endTime" name="endTime" type="time" value={dateTbc ? '' : endTime} disabled={!writable || dateTbc} onChange={(event) => setEndTime(event.target.value)} /></Field>
        <Field id="place" label="Place" required error={admin.errors.place} className="span-2"><input className="input" id="place" name="place" defaultValue={initial?.place ?? ''} disabled={!writable} /></Field>
        <Field id="kind" label="Kind" required={false}><select className="select" id="kind" name="kind" defaultValue={initial?.kind ?? 'Milestone'} disabled={!writable}><option>Milestone</option><option>Anniversary</option><option>Partner event</option></select></Field>
        <Field id="publicationStatus" label="Workflow" required={false}><select className="select" id="publicationStatus" name="publicationStatus" defaultValue={initial?.publicationStatus ?? 'draft'} disabled={!writable}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option></select></Field>
        <Field id="summary" label="Summary" required error={admin.errors.summary} className="span-2" hint="At least 20 characters."><textarea className="textarea" id="summary" name="summary" defaultValue={initial?.summary ?? ''} disabled={!writable} /></Field>
        <Field id="source" label="Source note" required={false} className="span-2"><input className="input" id="source" name="source" defaultValue={initial?.source ?? ''} disabled={!writable} /></Field>
        <Field id="sourceUrl" label="Source URL" required={false} error={admin.errors.sourceUrl} className="span-2" hint="Required when the event is marked verified. Use a public https:// link."><input className="input" id="sourceUrl" name="sourceUrl" defaultValue={initial?.sourceUrl ?? ''} disabled={!writable} /></Field>
        <RelationSelect id="lessonIds" label="Classes" error={admin.errors.lessonIds} disabled={!writable} selected={initial?.lessonIds ?? []} options={classes.map((lesson) => ({ id: lesson.id, label: lesson.title }))} />
        <RelationSelect id="projectIds" label="Projects" error={admin.errors.projectIds} disabled={!writable} selected={initial?.projectIds ?? []} options={projects.map((project) => ({ id: project.id, label: project.title }))} />
        <RelationSelect id="mediaIds" label="Photos" error={admin.errors.mediaIds} disabled={!writable} selected={initial?.mediaIds ?? []} options={media.map((item) => ({ id: item.id, label: item.caption || item.alt || item.id }))} />
        <Field id="listing" label="Listing" required={false} hint="Hidden stays off the public site. Publish turns a hidden listing into public."><select className="select" id="listing" name="listing" defaultValue={initial?.listing ?? 'public'} disabled={!writable}><option value="hidden">Hidden</option><option value="sample">Sample</option><option value="public">Public</option></select></Field>
        <Field id="internalNotes" label="Internal notes" required={false} className="span-2"><textarea className="textarea" id="internalNotes" name="internalNotes" defaultValue={initial?.internalNotes ?? ''} disabled={!writable} /></Field>
        <Field id="dateTbc" label="Date to be confirmed" required={false} error={admin.errors.dateTbc}><input type="checkbox" id="dateTbc" name="dateTbc" checked={dateTbc} disabled={!writable} onChange={(event) => { setDateTbc(event.target.checked); if (event.target.checked) { setStartTime(''); setEndTime(''); } }} /></Field>
        <Field id="verified" label="Verified" required={false}><input type="checkbox" id="verified" name="verified" defaultChecked={initial?.verified ?? false} disabled={!writable} /></Field>
        <Field id="sample" label="Sample milestone" required={false}><input type="checkbox" id="sample" name="sample" defaultChecked={initial?.sample ?? true} disabled={!writable} /></Field>
        <Field id="showOnAnniversary" label="Anniversary page" required={false}><input type="checkbox" id="showOnAnniversary" name="showOnAnniversary" defaultChecked={initial?.showOnAnniversary ?? false} disabled={!writable} /></Field>
        <Field id="calendarDownload" label="Calendar download" required={false}><input type="checkbox" id="calendarDownload" name="calendarDownload" defaultChecked={initial?.calendarDownload ?? false} disabled={!writable} /></Field>
      </div>
      {writable ? <SaveBar dirty={dirty} pending={pending} onCancel="/admin/events" label="Save event" extra={<button className="btn btn--sm" type="button" disabled={pending} onClick={() => { if (formRef.current) void save(formRef.current, true); }}>Publish</button>} /> : null}
    </form>
  );
}

function RelationSelect({ id, label, options, selected, error, disabled }: { id: string; label: string; options: Array<{ id: string; label: string }>; selected: string[]; error?: string; disabled: boolean }) {
  const known = new Set(options.map((option) => option.id));
  const rows = [...options];
  for (const chosen of selected) {
    if (!known.has(chosen)) rows.unshift({ id: chosen, label: chosen });
  }
  return (
    <Field id={id} label={label} required={false} error={error} hint="Optional. Choose one or more.">
      <select className="select" id={id} name={id} multiple size={Math.min(6, Math.max(3, rows.length || 3))} defaultValue={selected} disabled={disabled} key={rows.map((row) => row.id).join('|')}>
        {rows.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </Field>
  );
}

function eventTargetId(target: EventTarget): string {
  return target instanceof HTMLElement ? target.id : '';
}
