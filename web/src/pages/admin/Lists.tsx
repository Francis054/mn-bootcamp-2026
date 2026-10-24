import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, type ApiRequest } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorState, LoadingRows, StatusBadge, useConfirm, useToast } from '@/components/feedback';
import { usePageMeta } from '@/components/SiteChrome';
import { MODULES, moduleName } from '@/dev/fixtures';
import { formatDate } from '@/domain/format';
import type { BootcampEvent, Lesson, Page, Project, Trainee } from '@/domain/types';
import { isApiError } from '@/domain/types';
import { useAsync } from '@/hooks/useAsync';

function useList<T>(path: string, query: ApiRequest['query'], nonce: number) {
  const key = `${path}:${JSON.stringify(query)}:${nonce}`;
  return useAsync(key, () => api<Page<T>>({ method: 'GET', path, query }));
}

export function ClassListPage() {
  const [q, setQ] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const list = useList<Lesson>('/admin/classes', { q, page, pageSize: 8, sort: 'week', dir: 'asc', filters: { moduleId, scheduleStatus: status } }, nonce);
  usePageMeta('Classes');
  return (
    <ListShell title="Classes" text="Weekly lessons for the 2026 cohort. Titles and order are samples." newTo="/admin/classes/new" count={list.data?.total} loading={list.loading} error={list.error?.message} onRetry={() => setNonce((value) => value + 1)}>
      <Filters q={q} onQ={setQ} label="Search classes">
        <select className="select" aria-label="Module" value={moduleId} onChange={(event) => { setModuleId(event.target.value); setPage(1); }}><option value="">All modules</option>{MODULES.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}</select>
        <select className="select" aria-label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Any status</option><option value="done">Completed</option><option value="now">This week</option><option value="upcoming">Upcoming</option></select>
      </Filters>
      <BulkBar path="/admin/classes/bulk" ids={selected} onDone={() => { setSelected([]); setNonce((value) => value + 1); }} />
      <table className="table table--cards"><thead><tr><th className="chk"><input type="checkbox" aria-label="Select page" checked={Boolean(list.data?.items.length) && selected.length === list.data?.items.length} onChange={(event) => setSelected(event.target.checked ? list.data?.items.map((item) => item.id) ?? [] : [])} /></th><th>Class</th><th>Week</th><th>Module</th><th>Format</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{list.data?.items.map((lesson) => (
          <tr key={lesson.id}><td className="chk"><input type="checkbox" aria-label={`Select ${lesson.title}`} checked={selected.includes(lesson.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, lesson.id] : current.filter((id) => id !== lesson.id))} /></td>
            <td><b><Link to={`/admin/classes/${lesson.id}`}>{lesson.title}</Link></b><small>{formatDate(lesson.date)}</small></td>
            <td>W{String(lesson.week).padStart(2, '0')}</td><td>{moduleName(lesson.moduleId)}</td><td>{lesson.format}</td><td><StatusBadge status={lesson.scheduleStatus} /> <StatusBadge status={lesson.listing} /></td>
            <td className="cell-actions"><RowActions preview={`/classes/${lesson.id}`} edit={`/admin/classes/${lesson.id}`} removePath={`/admin/classes/${lesson.id}`} onDone={() => setNonce((value) => value + 1)} /></td>
          </tr>
        ))}</tbody>
      </table>
      <Pager page={list.data?.page ?? page} total={list.data?.total ?? 0} pageSize={8} onPage={setPage} />
      {!list.loading && list.data && !list.data.items.length ? <EmptyState title="No classes match" text="Try another module or clear the search." /> : null}
    </ListShell>
  );
}

export function TraineeListPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);
  const list = useList<Trainee>('/admin/trainees', { q, page, pageSize: 8, sort: 'displayName' }, nonce);
  usePageMeta('Trainees');
  return (
    <ListShell title="Trainees" text="Sample profiles. Email addresses stay in the admin adapter and are stripped from the public site." newTo="/admin/trainees/new" count={list.data?.total} loading={list.loading} error={list.error?.message} onRetry={() => setNonce((n) => n + 1)}>
      <Filters q={q} onQ={(value) => { setQ(value); setPage(1); }} label="Search trainees" />
      <table className="table table--cards"><thead><tr><th>Name</th><th>Track</th><th>Focus</th><th>Listing</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{list.data?.items.map((trainee) => <tr key={trainee.id}><td><b><Link to={`/admin/trainees/${trainee.id}`}>{trainee.displayName}</Link></b><small>{trainee.email}</small></td><td>{trainee.track}</td><td>{moduleName(trainee.focus)}</td><td><StatusBadge status={trainee.listing} /></td><td className="cell-actions"><RowActions preview={`/trainees/${trainee.id}`} edit={`/admin/trainees/${trainee.id}`} removePath={`/admin/trainees/${trainee.id}`} onDone={() => setNonce((n) => n + 1)} /></td></tr>)}</tbody>
      </table>
      <Pager page={list.data?.page ?? page} total={list.data?.total ?? 0} pageSize={8} onPage={setPage} />
    </ListShell>
  );
}

export function ProjectListPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);
  const list = useList<Project>('/admin/projects', { q, page, pageSize: 8 }, nonce);
  usePageMeta('Projects');
  return (
    <ListShell title="Projects" text="Sample labs. Repository URLs are administrative and are not shown on the public project page." newTo="/admin/projects/new" count={list.data?.total} loading={list.loading} error={list.error?.message} onRetry={() => setNonce((n) => n + 1)}>
      <Filters q={q} onQ={setQ} label="Search projects" />
      <table className="table table--cards"><thead><tr><th>Project</th><th>Type</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{list.data?.items.map((project) => <tr key={project.id}><td><b><Link to={`/admin/projects/${project.id}`}>{project.title}</Link></b></td><td>{project.type}</td><td><StatusBadge status={project.publicationStatus} /></td><td className="cell-actions"><RowActions preview={`/projects/${project.id}`} edit={`/admin/projects/${project.id}`} removePath={`/admin/projects/${project.id}`} onDone={() => setNonce((n) => n + 1)} /></td></tr>)}</tbody>
      </table>
      <Pager page={list.data?.page ?? page} total={list.data?.total ?? 0} pageSize={8} onPage={setPage} />
    </ListShell>
  );
}

export function EventListPage() {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);
  const list = useList<BootcampEvent>('/admin/events', { q, page, pageSize: 8, filters: { kind } }, nonce);
  usePageMeta('Events');
  return (
    <ListShell title="Events" text="Verified dates stay labelled. The hackathon link to the bootcamp is to be confirmed." newTo="/admin/events/new" count={list.data?.total} loading={list.loading} error={list.error?.message} onRetry={() => setNonce((n) => n + 1)}>
      <Filters q={q} onQ={setQ} label="Search events">
        <select className="select" aria-label="Kind" value={kind} onChange={(event) => setKind(event.target.value)}><option value="">Any kind</option><option>Milestone</option><option>Anniversary</option><option>Partner event</option></select>
      </Filters>
      <table className="table table--cards"><thead><tr><th>Event</th><th>When</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{list.data?.items.map((event) => <tr key={event.id}><td><b><Link to={`/admin/events/${event.id}`}>{event.title}</Link></b><small>{event.place}</small></td><td>{event.whenLabel}</td><td>{event.dateTbc ? <StatusBadge status="tbc" /> : event.sample ? <StatusBadge status="sample" /> : <StatusBadge status={event.verified ? 'verified' : 'draft'} />}</td><td className="cell-actions"><RowActions preview={`/events/${event.id}`} edit={`/admin/events/${event.id}`} removePath={`/admin/events/${event.id}`} onDone={() => setNonce((n) => n + 1)} /></td></tr>)}</tbody>
      </table>
      <Pager page={list.data?.page ?? page} total={list.data?.total ?? 0} pageSize={8} onPage={setPage} />
    </ListShell>
  );
}

function ListShell({ title, text, newTo, count, loading, error, onRetry, children }: { title: string; text: string; newTo: string; count?: number; loading: boolean; error?: string; onRetry: () => void; children: ReactNode }) {
  const auth = useAuth();
  return (
    <>
      <div className="a-head"><div><h1>{title}</h1><p>{text}</p></div><div className="a-head__actions">{auth.allowed('content.write') ? <Link className="btn btn--dark btn--sm" to={newTo}><Icon name="plus" className="i--sm" />New</Link> : <span className="badge">Read only</span>}</div></div>
      <section className="panel">
        {loading ? <LoadingRows /> : null}
        {error ? <ErrorState title="Could not load this list" text={error} onRetry={onRetry} /> : children}
        <div className="panel__foot"><span>{count ?? 0} records in the development adapter</span></div>
      </section>
    </>
  );
}

function Filters({ q, onQ, label, children }: { q: string; onQ: (value: string) => void; label: string; children?: ReactNode }) {
  return <div className="a-toolbar"><div className="input-icon"><Icon name="search" className="i--sm" /><input className="input" type="search" aria-label={label} placeholder={label} value={q} onChange={(event) => onQ(event.target.value)} /></div>{children}</div>;
}

function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="pagination" aria-label="Pagination"><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button><span aria-current="page">{page} / {pages}</span><button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}>›</button></div>;
}

function RowActions({ preview, edit, removePath, onDone }: { preview: string; edit: string; removePath: string; onDone: () => void }) {
  const auth = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const remove = async () => {
    const ok = await confirm({ title: 'Delete this record?', text: 'It will disappear from the development adapter. A backend would have to delete it again.', danger: true });
    if (!ok) return;
    try {
      await api({ method: 'DELETE', path: removePath });
      toast('Deleted', 'Removed from the development adapter.');
      onDone();
    } catch (error) {
      toast('Could not delete', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };
  return <div className="actions"><Link className="icon-btn" to={preview} aria-label="Preview"><Icon name="eye" className="i--sm" /></Link><Link className="icon-btn" to={edit} aria-label="Edit"><Icon name="edit" className="i--sm" /></Link>{auth.allowed('content.write') ? <button className="icon-btn danger" type="button" aria-label="Delete" onClick={() => void remove()}><Icon name="trash" className="i--sm" /></button> : null}</div>;
}

function BulkBar({ path, ids, onDone }: { path: string; ids: string[]; onDone: () => void }) {
  const auth = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  if (!ids.length || !auth.allowed('content.write')) return null;
  const run = async (action: 'publish' | 'delete') => {
    if (action === 'delete') {
      const ok = await confirm({ title: 'Delete selected records?', text: 'This removes them from the development adapter only. Nothing is sent to a server.', ok: 'Delete', danger: true });
      if (!ok) return;
    }
    try {
      await api({ method: 'POST', path, body: { ids, action } });
      toast(action === 'publish' ? 'Marked published' : 'Deleted', 'Updated in the development adapter.');
      onDone();
    } catch (error) {
      toast('Could not update', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };
  return <div className="bulkbar"><b>{ids.length} selected</b><button className="btn btn--xs" type="button" onClick={() => void run('publish')}>Publish</button><button className="btn btn--danger btn--xs" type="button" onClick={() => void run('delete')}>Delete</button></div>;
}
