import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { ErrorSummary, Field, FormLegend } from '@/components/controls';
import { EmptyState, ErrorState, LoadingRows, StatusBadge, useConfirm, useToast } from '@/components/feedback';
import { usePageMeta } from '@/components/SiteChrome';
import { useAdminForm } from '@/components/adminForm';
import { isApiError, type Project, type Trainee, type WorkPhoto } from '@/domain/types';
import { workPhotoAddress, workPhotoFieldErrors, workPhotoFileError } from '@/domain/workPhoto';
import { useAsync } from '@/hooks/useAsync';
import { useAllPages } from './options';

export function WorkPhotosPage() {
  const auth = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const form = useAdminForm();
  const isAdmin = auth.role === 'administrator';
  const [nonce, setNonce] = useState(0);
  const [traineeId, setTraineeId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [filterTrainee, setFilterTrainee] = useState('');
  const [pending, setPending] = useState(false);
  const trainees = useAllPages<Trainee>('/admin/trainees');
  const projects = useAllPages<Project>('/admin/projects');
  const record = useAsync(`work-photos:${nonce}`, () => api<WorkPhoto[]>({ method: 'GET', path: '/admin/work-photos' }), isAdmin);
  usePageMeta('Work photos');

  useEffect(() => {
    if (!projectId) return;
    const chosen = projects.find((project) => project.id === projectId);
    const linked = chosen?.traineeIds ?? [];
    if (!chosen || (traineeId && linked.length > 0 && !linked.includes(traineeId))) setProjectId('');
  }, [projectId, projects, traineeId]);

  const projectChoices = projects.filter((project) => {
    if (!traineeId) return true;
    const linked = project.traineeIds ?? [];
    return linked.length === 0 || linked.includes(traineeId);
  });
  const rows = (record.data ?? []).filter((photo) => !filterTrainee || photo.traineeId === filterTrainee);

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const alt = String(data.get('alt') ?? '');
    const caption = String(data.get('caption') ?? '');
    const files = [...data.getAll('file')].filter((item): item is File => item instanceof File && item.size > 0);
    const problems = workPhotoFieldErrors({ traineeId, alt, caption, fileCount: files.length });
    for (const file of files) {
      const fileProblem = workPhotoFileError(file);
      if (fileProblem) problems.file = fileProblem;
    }
    if (!form.block(problems)) return;
    setPending(true);
    let saved = 0;
    try {
      for (const file of files) {
        const body = new FormData();
        body.set('traineeId', traineeId);
        if (projectId) body.set('projectId', projectId);
        body.set('alt', alt.trim());
        if (caption.trim()) body.set('caption', caption.trim());
        body.set('file', file);
        await api({ method: 'POST', path: '/admin/work-photos', body });
        saved += 1;
      }
      toast(saved === 1 ? 'Photo saved' : `${saved} photos saved`, 'They stay off the public site until you publish them.');
      form.setErrors({});
      event.currentTarget.reset();
      setNonce((value) => value + 1);
    } catch (error) {
      if (saved > 0) setNonce((value) => value + 1);
      if (isApiError(error)) form.applyServer(error.fieldErrors);
      toast('Could not upload', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setPending(false);
    }
  };

  const publish = async (photo: WorkPhoto, live: boolean) => {
    try {
      await api({ method: 'POST', path: `/admin/work-photos/${photo.id}/${live ? 'publish' : 'unpublish'}` });
      toast(live ? 'Photo published' : 'Photo unpublished', live ? 'It can now show on the public trainee page and project page.' : 'It is off the public site again.');
      setNonce((value) => value + 1);
    } catch (error) {
      toast(live ? 'Could not publish' : 'Could not unpublish', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };

  const remove = async (photo: WorkPhoto) => {
    const ok = await confirm({ title: 'Remove this photo?', text: 'It will be deleted and will disappear from the public site if it was published.', danger: true });
    if (!ok) return;
    try {
      await api({ method: 'DELETE', path: `/admin/work-photos/${photo.id}` });
      toast('Photo removed', 'The picture has been deleted.');
      setNonce((value) => value + 1);
    } catch (error) {
      toast('Could not remove', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };

  if (!isAdmin) {
    return (
      <>
        <div className="a-head"><div><h1>Work photos</h1><p>Only an administrator can add, remove, or publish these photos.</p></div></div>
        <EmptyState icon="image" title="Administrators only" text="Sign in with an administrator account to upload photos of trainees at work." />
      </>
    );
  }

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Work photos</h1>
          <p>Add pictures of a trainee working on a project. They stay hidden until you publish them. Published photos show on that trainee’s profile and, when you pick a project, on the project page.</p>
        </div>
      </div>
      <form className="panel" onSubmit={(event) => void upload(event)} style={{ marginBottom: 24 }} noValidate>
        <div className="panel__body form-grid">
          <FormLegend />
          <ErrorSummary errors={form.errors} labels={{ traineeId: 'Trainee', projectId: 'Project', alt: 'Description', caption: 'Caption', file: 'Photos' }} summaryRef={form.summaryRef} />
          <Field id="traineeId" label="Trainee" required error={form.errors.traineeId}>
            <select className="select" id="traineeId" name="traineeId" value={traineeId} onChange={(event) => { setTraineeId(event.target.value); form.clearFixed('traineeId', event.target.value ? undefined : 'Choose a trainee.'); }}>
              <option value="">Choose a trainee</option>
              {trainees.map((trainee) => <option key={trainee.id} value={trainee.id}>{trainee.displayName}</option>)}
            </select>
          </Field>
          <Field id="projectId" label="Project" required={false} error={form.errors.projectId} hint="Optional. Leave this blank to show the photo only on the trainee profile.">
            <select className="select" id="projectId" name="projectId" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">No project</option>
              {projectChoices.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </Field>
          <Field id="alt" label="Description" required error={form.errors.alt} hint="What is happening in the photo. Do not name the person. If you choose several photos, they share this description.">
            <input className="input" id="alt" name="alt" />
          </Field>
          <Field id="caption" label="Caption" required={false} error={form.errors.caption} hint="Optional. Shown under the photo on the public site.">
            <input className="input" id="caption" name="caption" />
          </Field>
          <Field id="file" label="Photos" required error={form.errors.file} hint="JPEG, PNG, or WebP. You can choose more than one.">
            <input className="input" id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp" multiple />
          </Field>
          <button className="btn btn--dark btn--sm" type="submit" disabled={pending}>{pending ? 'Uploading…' : 'Upload photos'}</button>
        </div>
      </form>
      <div className="a-toolbar">
        <select className="select" aria-label="Filter by trainee" value={filterTrainee} onChange={(event) => setFilterTrainee(event.target.value)}>
          <option value="">All trainees</option>
          {trainees.map((trainee) => <option key={trainee.id} value={trainee.id}>{trainee.displayName}</option>)}
        </select>
        <span className="result-count">{rows.length} photos</span>
      </div>
      {record.loading ? <LoadingRows /> : null}
      {record.error ? <ErrorState title="Could not load work photos" text={record.error.message} onRetry={() => setNonce((value) => value + 1)} /> : null}
      {!record.loading && !record.error && !rows.length ? <EmptyState icon="image" title="No work photos yet" text="Choose a trainee, add one or more pictures, then publish the ones that should be public." /> : null}
      {rows.length ? (
        <div className="media-grid" role="list">
          {rows.map((photo) => {
            const src = workPhotoAddress(photo, 'admin');
            const trainee = trainees.find((item) => item.id === photo.traineeId);
            const project = projects.find((item) => item.id === photo.projectId);
            return (
              <article className="media-item" key={photo.id} style={{ display: 'block', textAlign: 'left', cursor: 'default' }}>
                {src ? <img src={src} alt="" /> : <span className="ph">Saved photo</span>}
                <span className="mi-flag"><StatusBadge status={photo.publicationStatus} /></span>
                <span className="mi-name">{trainee?.displayName ?? 'Trainee'}{project ? ` · ${project.title}` : ''}</span>
                <p style={{ padding: '0 12px 12px', margin: 0 }}>{photo.caption || photo.alt}</p>
                <div className="flex wrap" style={{ gap: 8, padding: '0 12px 12px' }}>
                  {photo.publicationStatus === 'published' ? (
                    <button className="btn btn--ghost btn--xs" type="button" onClick={() => void publish(photo, false)}>Unpublish</button>
                  ) : (
                    <button className="btn btn--dark btn--xs" type="button" onClick={() => void publish(photo, true)}>Publish</button>
                  )}
                  <button className="btn btn--ghost btn--xs" type="button" onClick={() => void remove(photo)}>Remove</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
