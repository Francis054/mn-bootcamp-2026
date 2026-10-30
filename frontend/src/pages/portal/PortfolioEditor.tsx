import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { ErrorSummary, Field } from '@/components/controls';
import { isApiError } from '@/domain/types';
import {
  KIND_LABEL,
  PORTFOLIO_KINDS,
  VIDEO_LINK_MESSAGE,
  parseVideoLink,
  safeMediaUrl,
  videoEmbedUrl,
  type PortfolioFields,
  type PortfolioItem,
  type PortfolioKind,
  type PortfolioMedia,
} from '@/domain/portfolio';

const STATUS: Record<PortfolioItem['status'], string> = {
  draft: 'Draft',
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function PortfolioEditor() {
  const [items, setItems] = useState<PortfolioItem[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const load = () => {
    api<PortfolioItem[]>({ method: 'GET', path: '/portal/portfolio' })
      .then(setItems)
      .catch((err: unknown) => setError(isApiError(err) ? err.message : 'Your portfolio could not be loaded.'));
  };
  useEffect(load, []);
  const loaded = items ?? [];
  const replace = (next: PortfolioItem) => setItems(loaded.map((item) => (item.id === next.id ? next : item)));
  const move = async (index: number, direction: -1 | 1) => {
    const ids = loaded.map((item) => item.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    const swap = ids[index];
    ids[index] = ids[target] ?? '';
    ids[target] = swap ?? '';
    const next = await api<PortfolioItem[]>({ method: 'POST', path: '/portal/portfolio/reorder', body: { ids } });
    setItems(next);
  };
  return (
    <section className="portal-card portfolio-editor" aria-labelledby="portfolio-title">
      <h2 id="portfolio-title">Portfolio</h2>
      <p className="muted">Add a project, a lab, or a case study. A new or changed item stays a draft until an administrator approves it. The last approved version stays on your public profile.</p>
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!items ? <p role="status">Loading your portfolio.</p> : null}
      {items && !items.length && !adding ? <p>No portfolio items yet.</p> : null}
      <div className="portfolio-list">
        {loaded.map((item, index) => (
          <article className="portfolio-item" key={item.id}>
            <div className="portfolio-item__head">
              <h3>{item.draft.title || 'Untitled item'}</h3>
              <span className="tag">{KIND_LABEL[item.draft.kind]}</span>
              <span className="tag">{STATUS[item.status]}</span>
            </div>
            {item.status === 'rejected' ? <p role="alert">Rejected: {item.rejectionReason}</p> : null}
            {item.status === 'pending' ? <p>An administrator still has to approve this version.</p> : null}
            <p>{item.draft.summary}</p>
            <ItemForm
              item={item}
              onSaved={(next, message) => {
                replace(next);
                setNotice(message);
              }}
              onDeleted={() => {
                setItems(loaded.filter((row) => row.id !== item.id));
                setNotice('Deleted. It is no longer on your public profile.');
              }}
            />
            <div className="portal-actions">
              <button className="btn btn--sm" type="button" disabled={index === 0} onClick={() => void move(index, -1)}>Move earlier</button>
              <button className="btn btn--sm" type="button" disabled={index === loaded.length - 1} onClick={() => void move(index, 1)}>Move later</button>
            </div>
          </article>
        ))}
      </div>
      {adding ? (
        <ItemForm
          onSaved={(next, message) => {
            setItems([...loaded, next]);
            setAdding(false);
            setNotice(message);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button className="btn btn--dark" type="button" onClick={() => setAdding(true)}>Add a portfolio item</button>
      )}
    </section>
  );
}

function ItemForm({
  item,
  onSaved,
  onDeleted,
  onCancel,
}: {
  item?: PortfolioItem;
  onSaved: (item: PortfolioItem, message: string) => void;
  onDeleted?: () => void;
  onCancel?: () => void;
}) {
  const source = item?.draft;
  const [fields, setFields] = useState<PortfolioFields>(source ? { ...source } : { ...blank() });
  const [skills, setSkills] = useState((source?.skills ?? []).join(', '));
  const [videoUrl, setVideoUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const idPrefix = item?.id ?? 'new';
  const save = async () => {
    const body = {
      kind: fields.kind,
      title: fields.title,
      summary: fields.summary,
      skills: skills.split(',').map((item) => item.trim()).filter(Boolean),
      startedOn: fields.startedOn || null,
      completedOn: fields.completedOn || null,
      repositoryUrl: fields.repositoryUrl || null,
      demoUrl: fields.demoUrl || null,
    };
    const fieldErrors = clientErrors(body);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return null;
    setPending(true);
    try {
      const saved = item
        ? await api<PortfolioItem>({ method: 'PATCH', path: `/portal/portfolio/${item.id}`, body })
        : await api<PortfolioItem>({ method: 'POST', path: '/portal/portfolio', body });
      onSaved(saved, 'Saved. Submit it when you want an administrator to review the public version.');
      return saved;
    } catch (error) {
      setErrors(isApiError(error) && error.fieldErrors ? error.fieldErrors : { form: isApiError(error) ? error.message : 'The item could not be saved.' });
      return null;
    } finally {
      setPending(false);
    }
  };
  const submit = async () => {
    const saved = await save();
    if (!saved) return;
    setPending(true);
    try {
      const result = await api<PortfolioItem>({ method: 'POST', path: `/portal/portfolio/${saved.id}/submit` });
      onSaved(result, 'Submitted. The last approved version stays public until this one is approved.');
    } catch (error) {
      setErrors({ form: isApiError(error) ? error.message : 'The item could not be submitted.' });
    } finally {
      setPending(false);
    }
  };
  const uploadImage = async (file: File | undefined) => {
    if (!item || !file) return;
    const payload = new FormData();
    payload.set('file', file);
    payload.set('alt', alt);
    setPending(true);
    try {
      const result = await api<PortfolioItem>({ method: 'POST', path: `/portal/portfolio/${item.id}/images`, body: payload });
      onSaved(result, 'Picture saved on the draft.');
      setAlt('');
    } catch (error) {
      setErrors(isApiError(error) && error.fieldErrors ? error.fieldErrors : { image: isApiError(error) ? error.message : 'The picture could not be uploaded.' });
    } finally {
      setPending(false);
    }
  };
  const addVideo = async () => {
    if (!item) return;
    if (!parseVideoLink(videoUrl)) {
      setErrors({ video: VIDEO_LINK_MESSAGE });
      return;
    }
    setPending(true);
    try {
      const result = await api<PortfolioItem>({ method: 'POST', path: `/portal/portfolio/${item.id}/videos`, body: { url: videoUrl } });
      onSaved(result, 'Video link saved on the draft.');
      setVideoUrl('');
    } catch (error) {
      setErrors(isApiError(error) && error.fieldErrors ? error.fieldErrors : { video: isApiError(error) ? error.message : 'The video link could not be saved.' });
    } finally {
      setPending(false);
    }
  };
  const uploadVideo = async (file: File | undefined) => {
    if (!item || !file) return;
    setPending(true);
    try {
      const mime = file.type || 'video/mp4';
      const granted = await api<{ grantId: string; mode: 'api' | 'cloudinary'; uploadUrl?: string; fields?: Record<string, string> }>({
        method: 'POST',
        path: `/portal/portfolio/${item.id}/videos/grant`,
        body: { mime, bytes: file.size },
      });
      if (granted.mode === 'cloudinary' && granted.uploadUrl && granted.fields) {
        const payload = new FormData();
        payload.set('file', file);
        for (const [key, value] of Object.entries(granted.fields)) payload.set(key, value);
        const uploaded = await fetch(granted.uploadUrl, { method: 'POST', body: payload });
        if (!uploaded.ok) throw new Error('The video service refused the file.');
        const result = await api<PortfolioItem>({ method: 'POST', path: `/portal/portfolio/${item.id}/videos/complete`, body: { grantId: granted.grantId } });
        onSaved(result, 'Video saved on the draft.');
      } else {
        const payload = new FormData();
        payload.set('file', file);
        payload.set('grantId', granted.grantId);
        const result = await api<PortfolioItem>({ method: 'POST', path: `/portal/portfolio/${item.id}/videos/file`, body: payload });
        onSaved(result, 'Video saved on the draft.');
      }
    } catch (error) {
      setErrors(isApiError(error) && error.fieldErrors ? error.fieldErrors : { video: isApiError(error) ? error.message : 'The video could not be uploaded.' });
    } finally {
      setPending(false);
    }
  };
  const removePiece = async (media: PortfolioMedia) => {
    if (!item) return;
    const section = media.kind === 'image' ? 'images' : 'videos';
    const result = await api<PortfolioItem>({ method: 'DELETE', path: `/portal/portfolio/${item.id}/${section}/${media.id}` });
    onSaved(result, 'Removed from the draft.');
  };
  const removeItem = async () => {
    if (!item || !onDeleted) return;
    if (!window.confirm('Delete this portfolio item? The public copy is removed as well.')) return;
    await api({ method: 'DELETE', path: `/portal/portfolio/${item.id}` });
    onDeleted();
  };
  return (
    <div className="portfolio-form">
      <ErrorSummary errors={errors} />
      <Field id={`${idPrefix}-kind`} label="Kind" error={errors.kind}>
        <select id={`${idPrefix}-kind`} className="input" value={fields.kind} onChange={(event) => setFields({ ...fields, kind: event.target.value as PortfolioKind })}>
          {PORTFOLIO_KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}
        </select>
      </Field>
      <Field id={`${idPrefix}-title`} label="Title" error={errors.title}>
        <input className="input" id={`${idPrefix}-title`} value={fields.title} onChange={(event) => setFields({ ...fields, title: event.target.value })} />
      </Field>
      <Field id={`${idPrefix}-summary`} label="Summary or write-up" error={errors.summary}>
        <textarea className="textarea" id={`${idPrefix}-summary`} rows={5} value={fields.summary} onChange={(event) => setFields({ ...fields, summary: event.target.value })} />
      </Field>
      <Field id={`${idPrefix}-skills`} label="Skills or tools" error={errors.skills} hint="Separate them with commas.">
        <input className="input" id={`${idPrefix}-skills`} value={skills} onChange={(event) => setSkills(event.target.value)} />
      </Field>
      <div className="portfolio-dates">
        <Field id={`${idPrefix}-started`} label="Started" error={errors.startedOn} hint="Optional.">
          <input className="input" id={`${idPrefix}-started`} type="date" value={fields.startedOn ?? ''} onChange={(event) => setFields({ ...fields, startedOn: event.target.value || null })} />
        </Field>
        <Field id={`${idPrefix}-completed`} label="Completed" error={errors.completedOn} hint="Optional.">
          <input className="input" id={`${idPrefix}-completed`} type="date" value={fields.completedOn ?? ''} onChange={(event) => setFields({ ...fields, completedOn: event.target.value || null })} />
        </Field>
      </div>
      <Field id={`${idPrefix}-repo`} label="Repository link" error={errors.repositoryUrl} hint="Optional. https only.">
        <input className="input" id={`${idPrefix}-repo`} inputMode="url" value={fields.repositoryUrl ?? ''} onChange={(event) => setFields({ ...fields, repositoryUrl: event.target.value })} />
      </Field>
      <Field id={`${idPrefix}-demo`} label="Demo link" error={errors.demoUrl} hint="Optional. https only.">
        <input className="input" id={`${idPrefix}-demo`} inputMode="url" value={fields.demoUrl ?? ''} onChange={(event) => setFields({ ...fields, demoUrl: event.target.value })} />
      </Field>
      {item ? (
        <>
          <MediaGallery media={item.draft.media} title={item.draft.title} onRemove={(media) => void removePiece(media)} />
          <Field id={`${idPrefix}-alt`} label="Picture description" error={errors.image} hint="JPEG, PNG, or WebP. SVG files are not accepted.">
            <input className="input" id={`${idPrefix}-alt`} value={alt} onChange={(event) => setAlt(event.target.value)} />
          </Field>
          <input aria-label="Picture file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadImage(event.target.files?.[0])} />
          <Field id={`${idPrefix}-video`} label="Video link" error={errors.video} hint="YouTube, Vimeo, or Loom. Other sites are refused.">
            <input className="input" id={`${idPrefix}-video`} inputMode="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} />
          </Field>
          <button className="btn btn--sm" type="button" onClick={() => void addVideo()} disabled={pending}>Add video link</button>
          <Field id={`${idPrefix}-video-file`} label="Video file" hint="MP4, WebM, or MOV from your device. A large file uploads directly to storage.">
            <input id={`${idPrefix}-video-file`} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => void uploadVideo(event.target.files?.[0])} />
          </Field>
        </>
      ) : <p className="muted">Save the item first, then add pictures and videos.</p>}
      <div className="portal-actions">
        <button className="btn btn--dark" type="button" onClick={() => void save()} disabled={pending}>Save item</button>
        {item ? <button className="btn" type="button" onClick={() => void submit()} disabled={pending || item.status === 'pending'}>Submit item for review</button> : null}
        {item && onDeleted ? <button className="btn btn--sm" type="button" onClick={() => void removeItem()}>Delete item</button> : null}
        {onCancel ? <button className="btn btn--sm" type="button" onClick={onCancel}>Cancel</button> : null}
      </div>
    </div>
  );
}

export function MediaGallery({ media, title, onRemove }: { media: PortfolioMedia[]; title: string; onRemove?: (media: PortfolioMedia) => void }) {
  if (!media.length) return null;
  return (
    <div className="portfolio-media">
      {media.map((item) => {
        const embed = item.kind === 'video_link' ? videoEmbedUrl(item.provider ?? '', item.externalId ?? '') : null;
        const src = safeMediaUrl(item.url);
        return (
          <figure key={item.id}>
            {item.kind === 'image' && src ? <img src={src} alt={item.alt} /> : null}
            {item.kind === 'video_file' && src ? <video src={src} controls preload="metadata" aria-label={`${title} video`} /> : null}
            {embed ? (
              <iframe className="portfolio-frame" src={embed} title={`${title} video`} sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" loading="lazy" />
            ) : null}
            {onRemove ? <button className="btn btn--sm" type="button" onClick={() => onRemove(item)}>Remove</button> : null}
          </figure>
        );
      })}
    </div>
  );
}

function blank(): PortfolioFields {
  return { kind: 'project', title: '', summary: '', skills: [], startedOn: null, completedOn: null, repositoryUrl: null, demoUrl: null };
}

function clientErrors(body: { title: string; summary: string; repositoryUrl: string | null; demoUrl: string | null }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!body.title.trim()) errors.title = 'Enter a title.';
  if (body.summary.length > 20000) errors.summary = 'Use at most 20000 characters.';
  if (body.repositoryUrl && !body.repositoryUrl.startsWith('https://')) errors.repositoryUrl = 'Enter a full link starting with https://.';
  if (body.demoUrl && !body.demoUrl.startsWith('https://')) errors.demoUrl = 'Enter a full link starting with https://.';
  return errors;
}
