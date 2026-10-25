import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { DragList, ErrorSummary, Field, PublishActions, SaveBar, bindBeforeUnload } from '@/components/controls';
import { EmptyState, ErrorState, LoadingRows, StatusBadge, useConfirm, useToast } from '@/components/feedback';
import { Photo } from '@/components/Brand';
import { usePageMeta } from '@/components/SiteChrome';
import { usesMockApi } from '@/config/runtime';
import { ALBUM_LABEL } from '@/dev/fixtures';
import { ROLE_CHOICE, ROLE_LABEL } from '@/domain/permissions';
import type { AboutContent, DevUser, EnquiryRecord, FoundationStat, HomepageContent, MediaItem, Milestone, Role, SiteSettings } from '@/domain/types';
import { isApiError } from '@/domain/types';
import { emailAddress } from '@/domain/validate';
import { useAsync } from '@/hooks/useAsync';

export function ContentEditorPage() {
  const toast = useToast();
  const auth = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const record = useAsync('home', () => api<HomepageContent>({ method: 'GET', path: '/admin/home' }));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState(record.data?.publicationStatus ?? 'draft');
  usePageMeta('Content editor');
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  useEffect(() => { if (record.data?.publicationStatus) setStatus(record.data.publicationStatus); }, [record.data]);
  if (record.loading) return <LoadingRows />;
  if (record.error || !record.data) return <ErrorState title="Could not load the homepage" text={record.error?.message ?? 'Missing.'} />;
  const home = record.data;
  const bodyFrom = (form: HTMLFormElement) => {
    const data = Object.fromEntries(new FormData(form));
    return {
      eyebrow: String(data.eyebrow ?? ''),
      headline: String(data.headline ?? ''),
      lead: String(data.lead ?? ''),
      ctaLabel: String(data.ctaLabel ?? ''),
      ctaHref: String(data.ctaHref ?? '/bootcamp'),
      theme: home.theme,
      announcement: String(data.announcement ?? ''),
      showAnnouncement: data.showAnnouncement === 'on',
      footerCtaHeading: String(data.footerCtaHeading ?? ''),
      footerCtaHref: String(data.footerCtaHref ?? home.footerCtaHref),
    };
  };
  const saveDraft = async (form: HTMLFormElement) => {
    await api({ method: 'PUT', path: '/admin/home', body: bodyFrom(form) });
    setDirty(false);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    try {
      await saveDraft(event.currentTarget);
      toast('Homepage draft saved', 'Publish to show this copy on the public homepage. Use *asterisks* for emphasis.');
    } catch (error) {
      toast('Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  const publish = async (live: boolean) => {
    const form = formRef.current;
    if (!form) return;
    setPending(true);
    try {
      if (live) await saveDraft(form);
      const next = await api<HomepageContent>({ method: 'POST', path: live ? '/admin/home/publish' : '/admin/home/unpublish' });
      setStatus(next.publicationStatus ?? (live ? 'published' : 'draft'));
      setDirty(false);
      toast(live ? 'Homepage published' : 'Homepage unpublished', live ? 'The public homepage now shows this copy.' : 'The public homepage is hidden again.');
    } catch (error) {
      toast(live ? 'Could not publish' : 'Could not unpublish', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  return (
    <form ref={formRef} onSubmit={(event) => void submit(event)} onChange={() => setDirty(true)}>
      <div className="a-head"><div><h1>Content editor</h1><p>Homepage copy. Save keeps a draft. Publish shows it on the public site. Emphasis uses *asterisks*, not HTML.</p></div><Link className="btn btn--ghost btn--sm" to="/">Preview</Link></div>
      <div className="form-grid">
        <Field id="eyebrow" label="Eyebrow"><input className="input" id="eyebrow" name="eyebrow" defaultValue={home.eyebrow} disabled={!auth.allowed('content.write')} /></Field>
        <Field id="ctaLabel" label="Button label"><input className="input" id="ctaLabel" name="ctaLabel" defaultValue={home.ctaLabel} disabled={!auth.allowed('content.write')} /></Field>
        <Field id="headline" label="Headline" className="span-2" hint="Line breaks are kept. Wrap a phrase in *asterisks* to emphasise it."><textarea className="textarea" id="headline" name="headline" defaultValue={home.headline} disabled={!auth.allowed('content.write')} /></Field>
        <Field id="lead" label="Lead" className="span-2"><textarea className="textarea" id="lead" name="lead" defaultValue={home.lead} disabled={!auth.allowed('content.write')} /></Field>
        <Field id="ctaHref" label="Button link"><input className="input" id="ctaHref" name="ctaHref" defaultValue={home.ctaHref} disabled={!auth.allowed('content.write')} /></Field>
        <Field id="footerCtaHeading" label="Footer heading"><input className="input" id="footerCtaHeading" name="footerCtaHeading" defaultValue={home.footerCtaHeading} disabled={!auth.allowed('content.write')} /></Field>
        <Field id="footerCtaHref" label="Get involved link" className="span-2"><input className="input" id="footerCtaHref" name="footerCtaHref" defaultValue={home.footerCtaHref} disabled={!auth.allowed('content.write')} /></Field>
        <Field id="announcement" label="Announcement" className="span-2"><input className="input" id="announcement" name="announcement" defaultValue={home.announcement} disabled={!auth.allowed('content.write')} /></Field>
        <div className="field span-2"><label className="check"><input type="checkbox" name="showAnnouncement" defaultChecked={home.showAnnouncement} disabled={!auth.allowed('content.write')} /> Show announcement</label></div>
      </div>
      {auth.allowed('content.write') ? <SaveBar dirty={dirty} pending={pending} label="Save homepage" extra={<PublishActions status={status} pending={pending} onPublish={() => void publish(true)} onUnpublish={() => void publish(false)} />} /> : null}
    </form>
  );
}

export function TimelineEditorPage() {
  const toast = useToast();
  const auth = useAuth();
  const record = useAsync('milestones', () => api<{ milestones: Milestone[]; publicationStatus?: string }>({ method: 'GET', path: '/admin/milestones' }));
  const [rows, setRows] = useState<Milestone[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('draft');
  usePageMeta('Timeline');
  useEffect(() => {
    if (record.data && !rows) {
      setRows(record.data.milestones ?? []);
      if (record.data.publicationStatus) setStatus(record.data.publicationStatus);
    }
  }, [record.data, rows]);
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  if (record.loading || !rows) return <LoadingRows />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      await api({ method: 'PUT', path: '/admin/milestones', body: { milestones: rows } });
      setDirty(false);
      toast('Timeline draft saved', 'Publish to show this order on the public site. Years without a source stay labelled to be supplied.');
    } catch (error) {
      toast('Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  const publish = async (live: boolean) => {
    if (!rows) return;
    setPending(true);
    try {
      await api({ method: 'PUT', path: '/admin/milestones', body: { milestones: rows } });
      await api({ method: 'POST', path: live ? '/admin/milestones/publish' : '/admin/milestones/unpublish' });
      setStatus(live ? 'published' : 'draft');
      setDirty(false);
      toast(live ? 'Timeline published' : 'Timeline unpublished', live ? 'The public anniversary timeline now uses this order.' : 'The public timeline is hidden again.');
    } catch (error) {
      toast(live ? 'Could not publish' : 'Could not unpublish', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  return (
    <form onSubmit={(event) => void submit(event)}>
      <div className="a-head"><div><h1>Bootcamp & foundation timeline</h1><p>Reorder with the handle or the arrow keys. Save keeps a draft. Publish shows it on the public site. Do not invent years.</p></div></div>
      <DragList items={rows.map((row) => row.id)} onChange={(ids) => { setRows(ids.map((id) => rows.find((row) => row.id === id)).filter((row): row is Milestone => Boolean(row))); setDirty(true); }} render={(id) => {
        const row = rows.find((item) => item.id === id);
        return row ? <span><b>{row.year}</b> — {row.title}{row.source ? '' : ' · TBC'}</span> : id;
      }} />
      {auth.allowed('content.write') ? <SaveBar dirty={dirty} pending={pending} label="Save order" extra={<PublishActions status={status} pending={pending} onPublish={() => void publish(true)} onUnpublish={() => void publish(false)} />} /> : null}
    </form>
  );
}

export function AboutEditorPage() {
  const toast = useToast();
  const auth = useAuth();
  const record = useAsync('about', () => api<AboutContent>({ method: 'GET', path: '/admin/about' }));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('draft');
  const formRef = useRef<HTMLFormElement>(null);
  usePageMeta('About and anniversary');
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  useEffect(() => { if (record.data?.publicationStatus) setStatus(record.data.publicationStatus); }, [record.data]);
  if (record.loading || !record.data) return record.error ? <ErrorState title="Could not load about" text={record.error.message} /> : <LoadingRows />;
  const about = record.data;
  const saveDraft = async (form: HTMLFormElement) => {
    const data = Object.fromEntries(new FormData(form));
    await api({ method: 'PUT', path: '/admin/about', body: {
      ...about,
      mission: String(data.mission ?? ''),
      vision: String(data.vision ?? ''),
      values: String(data.values ?? '').split('\n').map((line) => line.trim()).filter(Boolean),
      figuresPermission: data.figuresPermission === 'on',
    } });
    setDirty(false);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    try {
      await saveDraft(event.currentTarget);
      toast('About draft saved', 'Publish to show this copy on the public about page.');
    } catch (error) {
      toast('Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  const publish = async (live: boolean) => {
    const form = formRef.current;
    if (!form) return;
    setPending(true);
    try {
      if (live) await saveDraft(form);
      const next = await api<AboutContent>({ method: 'POST', path: live ? '/admin/about/publish' : '/admin/about/unpublish' });
      setStatus(next.publicationStatus ?? (live ? 'published' : 'draft'));
      toast(live ? 'About page published' : 'About page unpublished', live ? 'The public about page now shows this copy.' : 'The public about page is hidden again.');
    } catch (error) {
      toast(live ? 'Could not publish' : 'Could not unpublish', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  return (
    <form ref={formRef} onSubmit={(event) => void submit(event)} onChange={() => setDirty(true)}>
      <div className="a-head"><div><h1>About and 10 Years</h1><p>Mission and vision should stay the Foundation’s own words. Save keeps a draft. Publish shows it on the public site.</p></div><Link className="btn btn--ghost btn--sm" to="/about">Preview about</Link><Link className="btn btn--ghost btn--sm" to="/anniversary">Preview anniversary</Link></div>
      <Field id="mission" label="Mission"><textarea className="textarea" id="mission" name="mission" defaultValue={about.mission} disabled={!auth.allowed('content.write')} /></Field>
      <Field id="vision" label="Vision"><textarea className="textarea" id="vision" name="vision" defaultValue={about.vision} disabled={!auth.allowed('content.write')} /></Field>
      <Field id="values" label="Values" hint="One per line."><textarea className="textarea" id="values" name="values" defaultValue={about.values.join('\n')} disabled={!auth.allowed('content.write')} /></Field>
      <label className="check"><input type="checkbox" name="figuresPermission" defaultChecked={about.figuresPermission} disabled={!auth.allowed('content.write')} /> Permission received to present foundation-wide counters as display-ready</label>
      {auth.allowed('content.write') ? <SaveBar dirty={dirty} pending={pending} label="Save about" extra={<PublishActions status={status} pending={pending} onPublish={() => void publish(true)} onUnpublish={() => void publish(false)} />} /> : null}
    </form>
  );
}

export function MediaPage() {
  const auth = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [nonce, setNonce] = useState(0);
  const [album, setAlbum] = useState('');
  const [activeId, setActiveId] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const record = useAsync(`media:${nonce}`, () => api<MediaItem[]>({ method: 'GET', path: '/admin/media' }));
  usePageMeta('Media library');
  const canUpload = auth.allowed('media.upload') || auth.allowed('media.write');
  const canPublish = auth.allowed('media.write');
  const rows = (record.data ?? []).filter((item) => !album || item.album === album);
  const active = rows.find((item) => item.id === activeId) ?? rows[0];
  useEffect(() => {
    setConsentChecked(active?.consent === 'verified');
  }, [active?.id, active?.consent]);
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get('file');
    const alt = String(data.get('alt') ?? '');
    const chosenAlbum = String(data.get('album') ?? 'community');
    const chosen = file instanceof File && file.size > 0 ? file : null;
    try {
      if (chosen) {
        const body = new FormData();
        body.set('alt', alt);
        body.set('caption', alt);
        body.set('album', chosenAlbum);
        body.set('file', chosen);
        await api({ method: 'POST', path: '/admin/media', body });
        toast('Photo saved', 'It stays hidden until an editor or administrator publishes it.');
      } else {
        await api({ method: 'POST', path: '/admin/media', body: { alt, caption: alt, album: chosenAlbum } });
        toast('Metadata saved', usesMockApi() ? 'The file stayed in this browser. Nothing was uploaded to storage.' : 'No file was attached. Add a photo to store it.');
      }
      setNonce((value) => value + 1);
      event.currentTarget.reset();
    } catch (error) {
      toast('Could not add media', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };
  const publish = async (item: MediaItem) => {
    if (item.consent === 'withdrawn') {
      toast('Cannot publish', 'Consent was withdrawn. This photo cannot be published.', 'error');
      return;
    }
    if (!consentChecked && item.consent !== 'verified') {
      toast('Confirm consent', 'Tick consent for everyone pictured before publishing.', 'error');
      return;
    }
    try {
      if (auth.role === 'administrator') {
        await api({ method: 'POST', path: `/admin/media/${item.id}/publish`, body: { confirmConsent: true, listing: 'public' } });
      } else {
        if (item.consent !== 'verified') {
          await api({ method: 'PATCH', path: `/admin/media/${item.id}`, body: { consent: 'verified' } });
        }
        await api({ method: 'POST', path: `/admin/media/${item.id}/publish`, body: { listing: 'public' } });
      }
      toast('Photo published', 'Consent is recorded and the photo is on the public gallery.');
      setNonce((value) => value + 1);
    } catch (error) {
      toast('Could not publish', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };
  return (
    <>
      <div className="a-head"><div><h1>Gallery and media</h1><p>Describe images without naming people. Trainees and trainers can upload. An editor confirms consent, then publishes. An administrator can confirm consent and publish together.</p></div></div>
      {canUpload ? (
        <form className="panel" onSubmit={(event) => void upload(event)} style={{ marginBottom: 24 }}>
          <div className="panel__body form-grid">
            <Field id="alt" label="Alt text" hint="No names."><input className="input" id="alt" name="alt" required /></Field>
            <Field id="album" label="Album"><select className="select" id="album" name="album"><option value="community">Community</option><option value="anniversary">10th anniversary</option><option value="hackathon">Hackathon (TBC)</option></select></Field>
            <Field id="file" label="Image file" hint="Sent as the photo when a file is chosen."><input className="input" id="file" name="file" type="file" accept="image/*" /></Field>
            <button className="btn btn--dark btn--sm" type="submit">Add to library</button>
          </div>
        </form>
      ) : null}
      <div className="a-toolbar">
        <select className="select" aria-label="Filter album" value={album} onChange={(event) => setAlbum(event.target.value)}><option value="">All albums</option><option value="anniversary">10th anniversary</option><option value="hackathon">Hackathon (TBC)</option><option value="community">Community</option></select>
        <span className="result-count">{rows.length} items</span>
      </div>
      {record.loading ? <LoadingRows /> : null}
      {record.error ? <ErrorState title="Could not load media" text={record.error.message} onRetry={() => setNonce((value) => value + 1)} /> : null}
      {!record.loading && !rows.length ? <EmptyState icon="image" title="No media in this album" /> : null}
      {rows.length ? (
        <div className="media-layout">
          <div className="media-grid" role="list">
            {rows.map((item) => (
              <button className="media-item" type="button" key={item.id} aria-pressed={active?.id === item.id} onClick={() => setActiveId(item.id)}>
                {item.src.startsWith('http') || item.src.startsWith('/') ? <img src={item.src} alt="" /> : item.file && item.file !== 'upload' ? <Photo file={item.file} alt="" width={item.width} height={item.height} sizes="240px" /> : <img src={item.src} alt="" />}
                <span className="mi-flag">{item.consent === 'verified' ? null : <StatusBadge status={item.consent} />}</span>
                <span className="mi-name">{item.caption || item.file}</span>
              </button>
            ))}
          </div>
          {active ? (
            <aside className="panel media-detail">
              <div className="panel__head"><h2>Review</h2><StatusBadge status={active.publicationStatus} /></div>
              <div className="panel__body form-stack">
                {active.src.startsWith('http') || active.src.startsWith('/') ? <img src={active.src} alt={active.alt} /> : active.file && active.file !== 'upload' ? <Photo file={active.file} alt={active.alt} width={active.width} height={active.height} sizes="320px" /> : <img src={active.src} alt={active.alt} />}
                <p>{active.alt}</p>
                <p className="muted">{ALBUM_LABEL[active.album]} · <StatusBadge status={active.consent} /> <StatusBadge status={active.listing} /></p>
                {active.uploadedBy && active.uploadedBy === auth.userId ? <p className="muted">You uploaded this photo.</p> : null}
                {canPublish && active.consent !== 'withdrawn' ? (
                  <label className="check"><input type="checkbox" checked={consentChecked || active.consent === 'verified'} disabled={active.consent === 'verified'} onChange={(event) => setConsentChecked(event.target.checked)} /> Consent confirmed for everyone pictured</label>
                ) : null}
                {active.consent === 'withdrawn' ? <p>Consent was withdrawn. This photo cannot be published.</p> : null}
                <div className="flex wrap" style={{ gap: 8 }}>
                  {canPublish && active.consent !== 'withdrawn' ? <button className="btn btn--dark btn--sm" type="button" onClick={() => void publish(active)}>{auth.role === 'administrator' ? 'Confirm consent and publish' : 'Publish'}</button> : null}
                  {canPublish && active.consent === 'verified' ? <button className="btn btn--ghost btn--sm" type="button" onClick={() => void (async () => {
                    try {
                      await api({ method: 'POST', path: `/admin/media/${active.id}/withdraw-consent` });
                      toast('Consent withdrawn', 'The photo is no longer public.');
                      setNonce((value) => value + 1);
                    } catch (error) {
                      toast('Could not withdraw consent', isApiError(error) ? error.message : 'Request failed.', 'error');
                    }
                  })()}>Withdraw consent</button> : null}
                  {canPublish ? <button className="btn btn--ghost btn--sm" type="button" onClick={() => void (async () => {
                    const ok = await confirm({ title: 'Remove this image?', text: 'The photo is removed from the library.', danger: true });
                    if (!ok) return;
                    await api({ method: 'DELETE', path: `/admin/media/${active.id}` });
                    setActiveId('');
                    setNonce((value) => value + 1);
                  })()}>Remove</button> : null}
                </div>
                {!canPublish ? <p className="muted">Uploads stay hidden until an editor or administrator publishes them.</p> : null}
              </div>
            </aside>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function UsersPage() {
  const auth = useAuth();
  const toast = useToast();
  const [nonce, setNonce] = useState(0);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const record = useAsync(`users:${nonce}`, () => api<DevUser[]>({ method: 'GET', path: '/admin/users' }));
  usePageMeta('Users and roles');
  const invite = async (event: FormEvent) => {
    event.preventDefault();
    const invalid = emailAddress(email) ?? (role ? null : ROLE_CHOICE);
    if (invalid) { setError(invalid); return; }
    try {
      const result = await api<{ delivered: boolean; message: string }>({ method: 'POST', path: '/admin/users/invite', body: { email, role } });
      toast(result.delivered ? 'Invitation sent' : 'Account saved', result.message, result.delivered ? 'success' : 'info');
      setEmail('');
      setRole('');
      setNonce((value) => value + 1);
    } catch (err) {
      toast('Could not invite', isApiError(err) ? err.message : 'Request failed.', 'error');
    }
  };
  const change = async (id: string, role: Role) => {
    try {
      await api({ method: 'PATCH', path: `/admin/users/${id}`, body: { role } });
      toast('Role updated', usesMockApi() ? 'The development adapter re-checked your permission.' : 'The API saved the new role.');
      setNonce((value) => value + 1);
    } catch (err) {
      toast('Role not changed', isApiError(err) ? err.message : 'Request failed.', 'error');
    }
  };
  return (
    <>
      <div className="a-head"><div><h1>Users and roles</h1><p>Fixtures only. Signing in does not make someone an administrator.</p></div></div>
      {record.loading ? <LoadingRows /> : null}
      {record.error ? <ErrorState title="Could not load users" text={record.error.message} /> : null}
      <table className="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>
        {record.data?.map((user) => <tr key={user.id}><td><b>{user.displayName}</b><small>{user.fixture ? 'Development fixture' : ''}</small></td><td>{user.email}</td><td>{auth.allowed('users.manage') ? <select className="select" aria-label={`Role for ${user.displayName}`} value={user.role} onChange={(event) => void change(user.id, event.target.value as Role)}>{(Object.keys(ROLE_LABEL) as Role[]).map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}</select> : ROLE_LABEL[user.role]}</td></tr>)}
      </tbody></table>
      {auth.allowed('users.manage') ? (
        <form onSubmit={(event) => void invite(event)} style={{ marginTop: 24 }}>
          <Field id="invite" label="Invite email" error={error} hint="Choose a role. The invitation does not default to administrator."><input className="input" id="invite" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
          <Field id="invite-role" label="Role"><select className="select" id="invite-role" aria-label="Role for the invitation" value={role} onChange={(event) => setRole(event.target.value)}><option value="">Choose a role</option>{(Object.keys(ROLE_LABEL) as Role[]).map((item) => <option key={item} value={item}>{ROLE_LABEL[item]}</option>)}</select></Field>
          <button className="btn btn--dark btn--sm" type="submit">Invite</button>
        </form>
      ) : <p className="muted">You can see users. Changing roles needs the users.manage permission.</p>}
    </>
  );
}

export function EnquiriesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [nonce, setNonce] = useState(0);
  const record = useAsync(`enquiries:${nonce}`, () => api<EnquiryRecord[]>({ method: 'GET', path: '/admin/enquiries' }));
  usePageMeta('Enquiries');
  const setHandled = async (row: EnquiryRecord, handled: boolean) => {
    try {
      await api({ method: 'PATCH', path: `/admin/enquiries/${row.id}`, body: { handled } });
      toast(handled ? 'Marked handled' : 'Marked open', row.topic);
      setNonce((value) => value + 1);
    } catch (error) {
      toast('Could not update', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };
  const remove = async (row: EnquiryRecord) => {
    const ok = await confirm({ title: 'Delete this enquiry?', text: 'The message is removed from the inbox. This does not email the sender.', danger: true });
    if (!ok) return;
    try {
      await api({ method: 'DELETE', path: `/admin/enquiries/${row.id}` });
      toast('Enquiry deleted', row.topic);
      setNonce((value) => value + 1);
    } catch (error) {
      toast('Could not delete', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };
  return (
    <>
      <div className="a-head"><div><h1>Enquiries</h1><p>Messages from the public contact form. Only an administrator can read them.</p></div></div>
      {record.loading ? <LoadingRows /> : null}
      {record.error ? <ErrorState title="Could not load enquiries" text={record.error.message} /> : null}
      {!record.loading && record.data && !record.data.length ? <EmptyState icon="mail" title="No enquiries yet" text="When someone sends the contact form, the message is listed here. A filled company field is treated as spam and is not stored." /> : null}
      {record.data?.length ? (
        <table className="table table--cards">
          <thead><tr><th>From</th><th>Topic</th><th>Message</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {record.data.map((row) => (
              <tr key={row.id}>
                <td><b>{row.name}</b><small>{row.email}</small></td>
                <td>{row.topic}</td>
                <td>{row.message}</td>
                <td>{row.handled ? <span className="badge badge--success"><span className="dot" />Handled</span> : <span className="badge"><span className="dot" />Open</span>}{row.notified ? <span className="badge">Emailed</span> : null}</td>
                <td className="cell-actions">
                  <button className="btn btn--ghost btn--sm" type="button" onClick={() => void setHandled(row, !row.handled)}>{row.handled ? 'Reopen' : 'Mark handled'}</button>
                  <button className="btn btn--ghost btn--sm" type="button" onClick={() => void remove(row)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}

export function SettingsPage() {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const record = useAsync('settings', () => api<SiteSettings>({ method: 'GET', path: '/admin/settings' }));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('draft');
  const [stats, setStats] = useState<FoundationStat[] | null>(null);
  usePageMeta('Settings');
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  useEffect(() => {
    if (!record.data) return;
    if (record.data.publicationStatus) setStatus(record.data.publicationStatus);
    if (!stats) setStats(record.data.foundationStats ?? []);
  }, [record.data, stats]);
  if (record.loading || !record.data || !stats) return record.error ? <ErrorState title="Settings unavailable" text={record.error.message} /> : <LoadingRows />;
  const settings = record.data;
  const bodyFrom = (form: HTMLFormElement) => {
    const data = Object.fromEntries(new FormData(form));
    return {
      siteName: String(data.siteName ?? ''),
      timeZone: settings.timeZone,
      contactEmail: String(data.contactEmail ?? ''),
      accent: String(data.accent ?? settings.accent),
      reduceMotion: data.reduceMotion === 'on',
      notifications: { projects: data.projects === 'on', consent: data.consent === 'on', digest: data.digest === 'on' },
      foundationStats: stats.map((stat) => ({ ...stat, value: Number(stat.value) || 0 })),
    };
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    try {
      await api({ method: 'PUT', path: '/admin/settings', body: bodyFrom(event.currentTarget) });
      setDirty(false);
      toast('Settings draft saved', 'Publish to show the foundation counters on the public site.');
    } catch (error) {
      toast('Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  const publish = async (live: boolean) => {
    const form = formRef.current;
    if (!form) return;
    setPending(true);
    try {
      if (live) await api({ method: 'PUT', path: '/admin/settings', body: bodyFrom(form) });
      const next = await api<SiteSettings>({ method: 'POST', path: live ? '/admin/settings/publish' : '/admin/settings/unpublish' });
      setStatus(next.publicationStatus ?? (live ? 'published' : 'draft'));
      setDirty(false);
      toast(live ? 'Settings published' : 'Settings unpublished', live ? 'Published counters now appear on the public site.' : 'The public counters are hidden again.');
    } catch (error) {
      toast(live ? 'Could not publish' : 'Could not unpublish', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  return (
    <form ref={formRef} onSubmit={(event) => void submit(event)} onChange={() => setDirty(true)}>
      <div className="a-head"><div><h1>Settings</h1><p>Administrators only. Save keeps a draft. Publish shows the foundation counters on the public site. Use only numbers the Foundation has confirmed.</p></div></div>
      <Field id="siteName" label="Site name"><input className="input" id="siteName" name="siteName" defaultValue={settings.siteName} /></Field>
      <Field id="contactEmail" label="Contact email"><input className="input" id="contactEmail" name="contactEmail" type="email" defaultValue={settings.contactEmail} /></Field>
      <Field id="accent" label="Accent" hint="Recorded only. Design tokens stay in CSS."><input className="input" id="accent" name="accent" defaultValue={settings.accent} /></Field>
      <label className="check"><input type="checkbox" name="reduceMotion" defaultChecked={settings.reduceMotion} /> Prefer reduced motion in future player settings</label>
      <label className="check"><input type="checkbox" name="projects" defaultChecked={settings.notifications.projects} /> Project review notices</label>
      <label className="check"><input type="checkbox" name="consent" defaultChecked={settings.notifications.consent} /> Consent reminders</label>
      <label className="check"><input type="checkbox" name="digest" defaultChecked={settings.notifications.digest} /> Weekly digest</label>
      <h2 style={{ marginTop: 28 }}>Foundation counters</h2>
      {stats.map((stat, index) => (
        <div className="form-grid" key={stat.id}>
          <Field id={`stat-label-${stat.id}`} label="Label"><input className="input" id={`stat-label-${stat.id}`} value={stat.label} onChange={(event) => setStats(stats.map((row, rowIndex) => rowIndex === index ? { ...row, label: event.target.value } : row))} /></Field>
          <Field id={`stat-value-${stat.id}`} label="Value" hint="Whole number from zero."><input className="input" id={`stat-value-${stat.id}`} inputMode="numeric" value={String(stat.value)} onChange={(event) => setStats(stats.map((row, rowIndex) => rowIndex === index ? { ...row, value: Number(event.target.value.replace(/[^\d]/g, '')) || 0 } : row))} /></Field>
          <Field id={`stat-suffix-${stat.id}`} label="Suffix"><input className="input" id={`stat-suffix-${stat.id}`} value={stat.suffix} maxLength={8} onChange={(event) => setStats(stats.map((row, rowIndex) => rowIndex === index ? { ...row, suffix: event.target.value } : row))} /></Field>
        </div>
      ))}
      <SaveBar dirty={dirty} pending={pending} label="Save settings" extra={<PublishActions status={status} pending={pending} onPublish={() => void publish(true)} onUnpublish={() => void publish(false)} />} />
    </form>
  );
}

export function AccountPage() {
  const auth = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  usePageMeta('Account');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api<{ message: string }>({ method: 'POST', path: '/admin/account/password', body: { current: data.current, next: data.next, confirm: data.confirm } });
      setErrors({});
      setMessage(result.message);
    } catch (error) {
      if (isApiError(error)) {
        setErrors(error.fieldErrors ?? {});
        setMessage(error.message);
        return;
      }
      setMessage('Password change failed.');
    }
  };
  return (
    <>
      <div className="a-head"><div><h1>Account</h1><p>Signed in as {auth.displayName} · {auth.email} · {auth.role}</p></div></div>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <ErrorSummary errors={errors} />
        <Field id="current" label="Current password" error={errors.current}><input className="input" id="current" name="current" type="password" autoComplete="current-password" /></Field>
        <Field id="next" label="New password" error={errors.next} hint="At least 12 characters, with a letter and a number."><input className="input" id="next" name="next" type="password" autoComplete="new-password" /></Field>
        <Field id="confirm" label="Confirm" error={errors.confirm}><input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" /></Field>
        <button className="btn btn--dark btn--sm" type="submit">Change password</button>
        {message ? <p role="status">{message}</p> : null}
        {usesMockApi() ? <p className="muted">This returns pending. The password is not stored.</p> : null}
      </form>
      {usesMockApi() ? <button className="btn btn--ghost btn--sm" type="button" style={{ marginTop: 24 }} onClick={() => void api({ method: 'POST', path: '/auth/session/expire' })}>Expire development session</button> : null}
    </>
  );
}

export function StatesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  usePageMeta('UI states');
  return (
    <>
      <div className="a-head"><div><h1>UI states</h1><p>Reference for loading, empty, error, success and access states. These are the real components used elsewhere.</p></div></div>
      <div className="state-grid">
        <article className="state-card"><header><b>Empty</b></header><div className="state-card__body"><EmptyState icon="layers" title="No projects yet" text="Projects appear here once a team submits work for review." /></div></article>
        <article className="state-card"><header><b>Loading</b></header><div className="state-card__body"><LoadingRows /></div></article>
        <article className="state-card"><header><b>Error</b></header><div className="state-card__body"><ErrorState title="Couldn’t load events" text="A future backend would return this as a server failure." onRetry={() => toast('Retry', 'No request was sent.', 'info')} /></div></article>
        <article className="state-card"><header><b>Toasts and confirm</b></header><div className="state-card__body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn--ghost btn--sm" type="button" onClick={() => toast('Saved', 'Sample success.')}>Success</button>
          <button className="btn btn--ghost btn--sm" type="button" onClick={() => toast('Heads up', 'Sample info.', 'info')}>Info</button>
          <button className="btn btn--danger btn--sm" type="button" onClick={() => void confirm({ title: 'Delete sample?', text: 'Nothing is deleted from this catalogue.', danger: true })}>Confirm</button>
        </div></article>
        <article className="state-card"><header><b>Access</b></header><div className="state-card__body"><p>Viewers are sent to the forbidden screen if they open Settings. Editors cannot open Users. <Link to="/admin/forbidden">Open the forbidden screen</Link></p></div></article>
      </div>
    </>
  );
}
