import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { ErrorSummary, Field } from '@/components/controls';
import { EmptyState, ErrorState, LoadingRows, useConfirm, useToast } from '@/components/feedback';
import { usePageMeta } from '@/components/SiteChrome';
import { useAdminForm } from '@/components/adminForm';
import { profilePhotoFileProblem } from '@/domain/photo';
import { readAdminSiteImages, siteImageAltError, type SiteImageAdmin } from '@/domain/siteImages';
import { isApiError } from '@/domain/types';
import { refreshSiteImages } from '@/hooks/useSiteImages';
import { useAsync } from '@/hooks/useAsync';

export function SiteImagesPage() {
  const auth = useAuth();
  const isAdmin = auth.role === 'administrator';
  const [nonce, setNonce] = useState(0);
  const record = useAsync(`site-images:${nonce}`, () => api<unknown>({ method: 'GET', path: '/admin/site-images' }), isAdmin);
  usePageMeta('Site images');
  const rows = readAdminSiteImages(record.data);

  if (!isAdmin) {
    return (
      <>
        <div className="a-head"><div><h1>Site images</h1><p>Only an administrator can change the community logo, the parent-organisation plate, and the built-in page photographs.</p></div></div>
        <EmptyState icon="image" title="Administrators only" text="Sign in with an administrator account to replace these pictures." />
      </>
    );
  }

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Site images</h1>
          <p>These are the community hat logo, the parent-organisation plate, and the photographs built into the pages. Replacing one updates the public site. Reset puts the original file back. Gallery photos, trainee portraits, and project pictures stay on their own pages.</p>
        </div>
      </div>
      {record.loading ? <LoadingRows /> : null}
      {record.error ? <ErrorState title="Could not load site images" text={record.error.message} onRetry={() => setNonce((value) => value + 1)} /> : null}
      {!record.loading && !record.error && !rows.length ? <EmptyState icon="image" title="No image slots yet" text="The slots appear after the database migration has run." /> : null}
      <div style={{ display: 'grid', gap: 16 }}>
        {rows.map((row) => <SiteImageCard key={row.key} row={row} onSaved={() => setNonce((value) => value + 1)} />)}
      </div>
    </>
  );
}

function updatedOn(value: string): string {
  const date = value.includes('T') ? new Date(value) : new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function SiteImageCard({ row, onSaved }: { row: SiteImageAdmin; onSaved: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const form = useAdminForm();
  const [alt, setAlt] = useState(row.alt);
  const [preview, setPreview] = useState(row.url);
  const [pending, setPending] = useState(false);
  const altId = `${row.key}-alt`;
  const fileId = `${row.key}-file`;

  useEffect(() => {
    setAlt(row.alt);
    setPreview(row.url);
  }, [row.alt, row.url]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const chosen = data.get('file');
    const file = chosen instanceof File && chosen.size > 0 ? chosen : undefined;
    const problems: Record<string, string> = {};
    const altProblem = siteImageAltError(alt);
    if (altProblem) problems[altId] = altProblem;
    if (file) {
      const fileProblem = profilePhotoFileProblem(file);
      if (fileProblem) problems[fileId] = fileProblem;
    }
    if (!form.block(problems)) return;
    setPending(true);
    try {
      if (file) {
        const body = new FormData();
        body.set('alt', alt.trim());
        body.set('file', file);
        await api({ method: 'POST', path: `/admin/site-images/${row.key}/image`, body });
        toast('Image saved', 'The public site will show this picture.');
      } else {
        await api({ method: 'PATCH', path: `/admin/site-images/${row.key}`, body: { alt: alt.trim() } });
        toast('Alt text saved', 'The description on the public page was updated.');
      }
      form.setErrors({});
      refreshSiteImages();
      onSaved();
    } catch (error) {
      if (isApiError(error)) {
        const fields = error.fieldErrors ?? {};
        const mapped: Record<string, string> = {};
        if (fields.alt) mapped[altId] = fields.alt;
        if (fields.file) mapped[fileId] = fields.file;
        form.applyServer(Object.keys(mapped).length ? mapped : fields);
      }
      toast('Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setPending(false);
    }
  };

  const reset = async () => {
    const ok = await confirm({
      title: `Reset ${row.label}?`,
      text: 'The original picture and description will be used again. An uploaded file will be removed.',
      ok: 'Reset',
      danger: true,
    });
    if (!ok) return;
    setPending(true);
    try {
      await api({ method: 'POST', path: `/admin/site-images/${row.key}/reset` });
      toast('Original image restored', `${row.label} is back to the bundled picture.`);
      refreshSiteImages();
      onSaved();
    } catch (error) {
      toast('Could not reset', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <article className="panel" aria-labelledby={`${row.key}-title`}>
      <div className="panel__head">
        <h2 id={`${row.key}-title`}>{row.label}</h2>
        <span className="ph">{row.usingDefault ? 'Original image' : 'Custom image'}</span>
      </div>
      <form onSubmit={(event) => void save(event)} noValidate>
        <div className="panel__body form-grid">
          <p className="muted full" style={{ margin: 0 }}>{row.description}</p>
          <img
            className="site-image-preview full"
            src={preview}
            alt=""
            width={row.width}
            height={row.height}
            style={{ objectFit: row.fit }}
            onError={() => {
              if (preview !== row.defaultUrl) setPreview(row.defaultUrl);
            }}
          />
          <ErrorSummary errors={form.errors} labels={{ [altId]: 'Alt text', [fileId]: 'Replacement image' }} summaryRef={form.summaryRef} />
          <Field id={altId} label={`Alt text for ${row.label}`} error={form.errors[altId]} hint="What a visitor who cannot see the picture should hear. Leave this empty only when the picture is decorative.">
            <input className="input" id={altId} name="alt" value={alt} onChange={(event) => { setAlt(event.target.value); form.clearFixed(altId, siteImageAltError(event.target.value)); }} />
          </Field>
          <Field id={fileId} label={`Replacement image for ${row.label}`} error={form.errors[fileId]} hint="JPEG, PNG, or WebP. Leave this empty to change only the alt text.">
            <input className="input" id={fileId} name="file" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" />
          </Field>
          {row.updatedAt ? <p className="muted full" style={{ margin: 0 }}>Updated {updatedOn(row.updatedAt)}</p> : null}
        </div>
        <div className="panel__foot">
          <button className="btn btn--dark btn--sm" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
          {row.usingDefault ? <span /> : <button className="btn btn--ghost btn--sm" type="button" disabled={pending} onClick={() => void reset()}>Reset to original</button>}
        </div>
      </form>
    </article>
  );
}
