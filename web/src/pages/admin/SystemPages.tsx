import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { DragList, ErrorSummary, Field, SaveBar, bindBeforeUnload } from '@/components/controls';
import { EmptyState, ErrorState, LoadingRows, StatusBadge, useConfirm, useToast } from '@/components/feedback';
import { Photo } from '@/components/Brand';
import { usePageMeta } from '@/components/SiteChrome';
import { usesMockApi } from '@/config/runtime';
import { ALBUM_LABEL } from '@/dev/fixtures';
import { ROLE_LABEL } from '@/domain/permissions';
import type { AboutContent, DevUser, HomepageContent, MediaItem, Milestone, Role, SiteSettings } from '@/domain/types';
import { isApiError } from '@/domain/types';
import { emailAddress } from '@/domain/validate';
import { useAsync } from '@/hooks/useAsync';

export function ContentEditorPage() {
  const toast = useToast();
  const auth = useAuth();
  const record = useAsync('home', () => api<HomepageContent>({ method: 'GET', path: '/admin/home' }));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  usePageMeta('Content editor');
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  if (record.loading) return <LoadingRows />;
  if (record.error || !record.data) return <ErrorState title="Could not load the homepage" text={record.error?.message ?? 'Missing.'} />;
  const home = record.data;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    try {
      await api({ method: 'PUT', path: '/admin/home', body: {
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
      } });
      setDirty(false);
      toast('Homepage updated', 'The public home page reads this copy from the development adapter. Use *asterisks* for emphasis.');
    } catch (error) {
      toast('Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  return (
    <form onSubmit={(event) => void submit(event)} onChange={() => setDirty(true)}>
      <div className="a-head"><div><h1>Content editor</h1><p>Homepage copy. Emphasis uses *asterisks*, not HTML, so a headline cannot inject markup.</p></div><Link className="btn btn--ghost btn--sm" to="/">Preview</Link></div>
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
      {auth.allowed('content.write') ? <SaveBar dirty={dirty} pending={pending} label="Save homepage" /> : null}
    </form>
  );
}

export function TimelineEditorPage() {
  const toast = useToast();
  const auth = useAuth();
  const record = useAsync('milestones', () => api<Milestone[]>({ method: 'GET', path: '/admin/milestones' }));
  const [rows, setRows] = useState<Milestone[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  usePageMeta('Timeline');
  useEffect(() => { if (record.data && !rows) setRows(record.data); }, [record.data, rows]);
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  if (record.loading || !rows) return <LoadingRows />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      await api({ method: 'PUT', path: '/admin/milestones', body: { milestones: rows } });
      setDirty(false);
      toast('Timeline saved', 'Years without a source stay labelled to be supplied.');
    } catch (error) {
      toast('Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  return (
    <form onSubmit={(event) => void submit(event)}>
      <div className="a-head"><div><h1>Bootcamp & foundation timeline</h1><p>Reorder with the handle or the arrow keys. Do not invent years.</p></div></div>
      <DragList items={rows.map((row) => row.id)} onChange={(ids) => { setRows(ids.map((id) => rows.find((row) => row.id === id)).filter((row): row is Milestone => Boolean(row))); setDirty(true); }} render={(id) => {
        const row = rows.find((item) => item.id === id);
        return row ? <span><b>{row.year}</b> — {row.title}{row.source ? '' : ' · TBC'}</span> : id;
      }} />
      {auth.allowed('content.write') ? <SaveBar dirty={dirty} pending={pending} label="Save order" /> : null}
    </form>
  );
}

export function AboutEditorPage() {
  const toast = useToast();
  const auth = useAuth();
  const record = useAsync('about', () => api<AboutContent>({ method: 'GET', path: '/admin/about' }));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  usePageMeta('About and anniversary');
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  if (record.loading || !record.data) return record.error ? <ErrorState title="Could not load about" text={record.error.message} /> : <LoadingRows />;
  const about = record.data;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    try {
      await api({ method: 'PUT', path: '/admin/about', body: {
        ...about,
        mission: String(data.mission ?? ''),
        vision: String(data.vision ?? ''),
        values: String(data.values ?? '').split('\n').map((line) => line.trim()).filter(Boolean),
        figuresPermission: data.figuresPermission === 'on',
      } });
      setDirty(false);
      toast('About page saved', 'Foundation figures stay labelled until permission is recorded.');
    } catch (error) {
      toast('Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  return (
    <form onSubmit={(event) => void submit(event)} onChange={() => setDirty(true)}>
      <div className="a-head"><div><h1>About and 10 Years</h1><p>Mission and vision should stay the Foundation’s own words.</p></div><Link className="btn btn--ghost btn--sm" to="/about">Preview about</Link><Link className="btn btn--ghost btn--sm" to="/anniversary">Preview anniversary</Link></div>
      <Field id="mission" label="Mission"><textarea className="textarea" id="mission" name="mission" defaultValue={about.mission} disabled={!auth.allowed('content.write')} /></Field>
      <Field id="vision" label="Vision"><textarea className="textarea" id="vision" name="vision" defaultValue={about.vision} disabled={!auth.allowed('content.write')} /></Field>
      <Field id="values" label="Values" hint="One per line."><textarea className="textarea" id="values" name="values" defaultValue={about.values.join('\n')} disabled={!auth.allowed('content.write')} /></Field>
      <label className="check"><input type="checkbox" name="figuresPermission" defaultChecked={about.figuresPermission} disabled={!auth.allowed('content.write')} /> Permission received to present foundation-wide counters as display-ready</label>
      {auth.allowed('content.write') ? <SaveBar dirty={dirty} pending={pending} label="Save about" /> : null}
    </form>
  );
}

export function MediaPage() {
  const auth = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [nonce, setNonce] = useState(0);
  const [album, setAlbum] = useState('');
  const record = useAsync(`media:${nonce}`, () => api<MediaItem[]>({ method: 'GET', path: '/admin/media' }));
  usePageMeta('Media library');
  const rows = (record.data ?? []).filter((item) => !album || item.album === album);
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get('file');
    const alt = String(data.get('alt') ?? '');
    const album = String(data.get('album') ?? 'community');
    const chosen = file instanceof File && file.size > 0 ? file : null;
    try {
      if (chosen) {
        const body = new FormData();
        body.set('alt', alt);
        body.set('caption', alt);
        body.set('album', album);
        body.set('file', chosen);
        await api({ method: 'POST', path: '/admin/media', body });
        toast('Photo saved', 'It stays hidden until consent is verified and it is published.');
      } else {
        await api({ method: 'POST', path: '/admin/media', body: { alt, caption: alt, album } });
        toast('Metadata saved', usesMockApi() ? 'The file stayed in this browser. Nothing was uploaded to storage.' : 'No file was attached. Add a photo to store it.');
      }
      setNonce((value) => value + 1);
      event.currentTarget.reset();
    } catch (error) {
      toast('Could not add media', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };
  return (
    <>
      <div className="a-head"><div><h1>Gallery and media</h1><p>Describe images without naming people. New uploads start hidden until published.</p></div></div>
      {auth.allowed('media.write') ? (
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
      <div className="lesson-grid">
        {rows.map((item) => (
          <article className="card" key={item.id}>
            <div className="card__media">{item.src.startsWith('http') || item.src.startsWith('/') ? <img src={item.src} alt={item.alt} width={item.width} height={item.height} /> : item.file && item.file !== 'upload' ? <Photo file={item.file} alt={item.alt} width={item.width} height={item.height} sizes="240px" /> : <img src={item.src} alt={item.alt} />}</div>
            <div className="card__body">
              <div className="card__meta"><StatusBadge status={item.consent} /><StatusBadge status={item.listing} /></div>
              <h3 className="card__title" style={{ fontSize: 16 }}>{item.caption}</h3>
              <p className="muted">{ALBUM_LABEL[item.album]}</p>
              {auth.allowed('media.write') && item.consent === 'verified' ? <button className="btn btn--ghost btn--xs" type="button" onClick={() => void (async () => {
                try {
                  await api({ method: 'POST', path: `/admin/media/${item.id}/withdraw-consent` });
                  toast('Consent withdrawn', 'The photo is no longer public.');
                  setNonce((value) => value + 1);
                } catch (error) {
                  toast('Could not withdraw consent', isApiError(error) ? error.message : 'Request failed.', 'error');
                }
              })()}>Withdraw consent</button> : null}
              {auth.allowed('media.write') ? <button className="btn btn--ghost btn--xs" type="button" onClick={() => void (async () => {
                const ok = await confirm({ title: 'Remove this image?', text: 'The photo is removed from the library.', danger: true });
                if (!ok) return;
                await api({ method: 'DELETE', path: `/admin/media/${item.id}` });
                setNonce((value) => value + 1);
              })()}>Remove</button> : null}
            </div>
          </article>
        ))}
      </div>
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
    const invalid = emailAddress(email) ?? (role ? null : 'Choose viewer, editor or administrator.');
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
      toast('Role updated', 'The development adapter re-checked your permission. A backend must do this again.');
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

export function SettingsPage() {
  const toast = useToast();
  const record = useAsync('settings', () => api<SiteSettings>({ method: 'GET', path: '/admin/settings' }));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  usePageMeta('Settings');
  useEffect(() => bindBeforeUnload(dirty), [dirty]);
  if (record.loading || !record.data) return record.error ? <ErrorState title="Settings unavailable" text={record.error.message} /> : <LoadingRows />;
  const settings = record.data;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    try {
      await api({ method: 'PUT', path: '/admin/settings', body: {
        siteName: String(data.siteName ?? ''),
        timeZone: settings.timeZone,
        contactEmail: String(data.contactEmail ?? ''),
        accent: String(data.accent ?? settings.accent),
        reduceMotion: data.reduceMotion === 'on',
        notifications: { projects: data.projects === 'on', consent: data.consent === 'on', digest: data.digest === 'on' },
      } });
      setDirty(false);
      toast('Settings saved', 'Stored in the development adapter only.');
    } catch (error) {
      toast('Could not save', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally { setPending(false); }
  };
  return (
    <form onSubmit={(event) => void submit(event)} onChange={() => setDirty(true)}>
      <div className="a-head"><div><h1>Settings</h1><p>Administrators only. The accent field does not restyle the public site in this build.</p></div></div>
      <Field id="siteName" label="Site name"><input className="input" id="siteName" name="siteName" defaultValue={settings.siteName} /></Field>
      <Field id="contactEmail" label="Contact email"><input className="input" id="contactEmail" name="contactEmail" type="email" defaultValue={settings.contactEmail} /></Field>
      <Field id="accent" label="Accent" hint="Recorded only. Design tokens stay in CSS."><input className="input" id="accent" name="accent" defaultValue={settings.accent} /></Field>
      <label className="check"><input type="checkbox" name="reduceMotion" defaultChecked={settings.reduceMotion} /> Prefer reduced motion in future player settings</label>
      <label className="check"><input type="checkbox" name="projects" defaultChecked={settings.notifications.projects} /> Sample: project review notices</label>
      <label className="check"><input type="checkbox" name="consent" defaultChecked={settings.notifications.consent} /> Sample: consent reminders</label>
      <label className="check"><input type="checkbox" name="digest" defaultChecked={settings.notifications.digest} /> Sample: weekly digest</label>
      <SaveBar dirty={dirty} pending={pending} label="Save settings" />
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
        <Field id="next" label="New password" error={errors.next} hint={usesMockApi() ? 'At least 8 characters in the development adapter.' : 'At least 12 characters, with a letter and a number.'}><input className="input" id="next" name="next" type="password" autoComplete="new-password" /></Field>
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
