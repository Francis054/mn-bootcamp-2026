import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { usePageMeta } from '@/components/SiteChrome';
import { ErrorState, LoadingRows, useConfirm, useToast } from '@/components/feedback';
import { usesMockApi } from '@/config/runtime';
import { formatDate } from '@/domain/format';
import {
  SESSION_TYPES,
  TRAINER_STATUSES,
  timeRange,
  trainerLine,
  type AdminSession,
  type AdminTimetable,
  type SessionType,
  type TrainerStatus,
} from '@/domain/timetable';
import { isApiError } from '@/domain/types';
import { useAsync } from '@/hooks/useAsync';

const EMPTY = {
  weekId: '',
  date: '2026-10-05',
  type: 'theory' as SessionType,
  activity: '',
  topic: '',
  notes: '',
  startTime: '',
  endTime: '',
  trainerStatus: 'assigned' as TrainerStatus,
  trainerIds: [] as string[],
};

export function TimetablePage() {
  const auth = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const writable = auth.allowed('content.write');
  const [nonce, setNonce] = useState(0);
  const [blockId, setBlockId] = useState('');
  const [weekId, setWeekId] = useState('');
  const [date, setDate] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<typeof EMPTY | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deliverableWeek, setDeliverableWeek] = useState('');
  const [deliverableText, setDeliverableText] = useState('');
  const [profIds, setProfIds] = useState<string[]>([]);
  const [cyberIds, setCyberIds] = useState<string[]>([]);
  const record = useAsync(`admin-timetable:${nonce}`, () => api<AdminTimetable>({ method: 'GET', path: '/admin/timetable' }));
  usePageMeta('Timetable');
  const data = record.data;
  const weeks = useMemo(() => data?.blocks.flatMap((block) => block.weeks.map((week) => ({ ...week, blockId: block.id, blockName: block.name }))) ?? [], [data]);
  const visible = useMemo(() => filterSessions(data, { blockId, weekId, date, trainerId, type, q }, weeks), [data, blockId, weekId, date, trainerId, type, q, weeks]);
  const dates = [...new Set(visible.map((session) => session.date))];

  const refresh = () => setNonce((value) => value + 1);
  const saveSession = async () => {
    if (!draft) return;
    try {
      const body = {
        ...draft,
        startTime: draft.startTime || undefined,
        endTime: draft.endTime || undefined,
        trainerIds: draft.trainerIds,
      };
      if (editingId) await api({ method: 'PATCH', path: `/admin/sessions/${editingId}`, body });
      else await api({ method: 'POST', path: '/admin/sessions', body });
      toast(editingId ? 'Session updated' : 'Session added', 'The timetable list is refreshed.');
      setDraft(null);
      setEditingId(null);
      refresh();
    } catch (error) {
      toast('Could not save the session', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };
  const removeSession = async (session: AdminSession) => {
    const ok = await confirm({ title: 'Delete this session?', text: 'It leaves the timetable. A later workbook import can restore an imported row if that row is still in the file.', danger: true });
    if (!ok) return;
    try {
      await api({ method: 'DELETE', path: `/admin/sessions/${session.id}` });
      toast('Session deleted', 'Removed from the timetable.');
      refresh();
    } catch (error) {
      toast('Could not delete', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };
  const move = async (session: AdminSession, direction: 'up' | 'down') => {
    try {
      await api({ method: 'POST', path: '/admin/sessions/reorder', body: { id: session.id, direction } });
      refresh();
    } catch (error) {
      toast('Could not reorder', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };
  const openWeek = (id: string) => {
    const week = weeks.find((item) => item.id === id);
    setDeliverableWeek(id);
    setDeliverableText(week?.deliverables.map((item) => item.title).join('\n') ?? '');
    setProfIds(week?.professionalismTrainers.map((trainer) => trainer.id) ?? []);
    setCyberIds(week?.cybersecurityTrainers.map((trainer) => trainer.id) ?? []);
  };
  const saveWeek = async () => {
    if (!deliverableWeek) return;
    try {
      await api({
        method: 'PATCH',
        path: `/admin/weeks/${deliverableWeek}`,
        body: {
          deliverables: deliverableText.split('\n').map((line) => line.trim()).filter(Boolean),
          professionalismTrainerIds: profIds,
          cybersecurityTrainerIds: cyberIds,
        },
      });
      toast('Week updated', 'Deliverables and proposed trainers are saved.');
      refresh();
    } catch (error) {
      toast('Could not update the week', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };
  const upload = async (file: File) => {
    const form = new FormData();
    form.set('file', file);
    try {
      await api({ method: 'POST', path: '/admin/timetable/import', body: form });
      toast('Workbook imported', 'Sessions from the file replaced the imported rows.');
      refresh();
    } catch (error) {
      toast('Import did not run', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };
  const toggleProposed = async (id: string, proposed: boolean) => {
    try {
      await api({ method: 'PATCH', path: `/admin/trainers/${id}`, body: { proposed } });
      refresh();
    } catch (error) {
      toast('Could not update the trainer', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };

  if (record.loading && !data) return <LoadingRows />;
  if (record.error) return <ErrorState title="The timetable could not be loaded" text={record.error.message} onRetry={refresh} />;
  if (!data) return null;

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Timetable</h1>
          <p>
            {data.programme?.name ?? 'Cybersecurity Bootcamp'}
            {data.programme ? ` · ${formatDate(data.programme.startsOn, { year: 'numeric' })} – ${formatDate(data.programme.endsOn, { year: 'numeric' })}` : ''}
            . {data.sessions.length} sessions. Lesson notes stay on the class list.
          </p>
        </div>
        <div className="a-head__actions">
          <Link className="btn btn--ghost btn--sm" to="/schedule">Public schedule</Link>
          <Link className="btn btn--ghost btn--sm" to="/admin/classes">Lesson notes</Link>
          {writable ? <button className="btn btn--dark btn--sm" type="button" onClick={() => { setEditingId(null); setDraft({ ...EMPTY, weekId: weekId || weeks[0]?.id || '' }); }}><Icon name="plus" className="i--sm" />Session</button> : null}
        </div>
      </div>
      {data.warnings.length ? (
        <details className="callout" style={{ marginBottom: 16 }}>
          <summary>{data.warnings.length} import notes from the workbook</summary>
          <ul>{data.warnings.map((warning) => <li key={`${warning.code}-${warning.rows.join('-')}`}><b>{warning.code}</b> — {warning.message}</li>)}</ul>
          {data.sourceNote ? <p className="muted">{data.sourceNote}</p> : null}
        </details>
      ) : null}
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__body a-toolbar">
          <select className="select" aria-label="Block" value={blockId} onChange={(event) => { setBlockId(event.target.value); setWeekId(''); }}>
            <option value="">All blocks</option>
            {data.blocks.map((block) => <option key={block.id} value={block.id}>{block.name}</option>)}
          </select>
          <select className="select" aria-label="Week" value={weekId} onChange={(event) => setWeekId(event.target.value)}>
            <option value="">All weeks</option>
            {weeks.filter((week) => !blockId || week.blockId === blockId).map((week) => <option key={week.id} value={week.id}>Week {week.number} · {week.title}</option>)}
          </select>
          <select className="select" aria-label="Day" value={date} onChange={(event) => setDate(event.target.value)}>
            <option value="">All days</option>
            {[...new Set(data.sessions.map((session) => session.date))].map((day) => <option key={day} value={day}>{formatDate(day, { weekday: 'short', year: 'numeric' })}</option>)}
          </select>
          <select className="select" aria-label="Trainer" value={trainerId} onChange={(event) => setTrainerId(event.target.value)}>
            <option value="">Any trainer</option>
            {data.trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.displayName}</option>)}
          </select>
          <select className="select" aria-label="Session type" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Any type</option>
            {SESSION_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input className="input" type="search" aria-label="Search course or trainer" placeholder="Search course or trainer" value={q} onChange={(event) => setQ(event.target.value)} />
        </div>
      </section>
      {draft ? (
        <section className="panel" style={{ marginBottom: 16 }}>
          <div className="panel__head"><h2>{editingId ? 'Edit session' : 'New session'}</h2></div>
          <div className="panel__body form-grid">
            <label className="field">Week<select className="select" value={draft.weekId} onChange={(event) => setDraft({ ...draft, weekId: event.target.value })}>{weeks.map((week) => <option key={week.id} value={week.id}>Week {week.number}</option>)}</select></label>
            <label className="field">Date<input className="input" type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
            <label className="field">Type<select className="select" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as SessionType })}>{SESSION_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="field">Trainer status<select className="select" value={draft.trainerStatus} onChange={(event) => setDraft({ ...draft, trainerStatus: event.target.value as TrainerStatus })}>{TRAINER_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="field">Start<input className="input" value={draft.startTime} placeholder="08:00" onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} /></label>
            <label className="field">End<input className="input" value={draft.endTime} placeholder="08:30" onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} /></label>
            <label className="field full">Activity<input className="input" value={draft.activity} onChange={(event) => setDraft({ ...draft, activity: event.target.value })} /></label>
            <label className="field full">Course or topic<textarea className="textarea" value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} /></label>
            <label className="field full">Notes<textarea className="textarea" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
            <fieldset className="field full">
              <legend>Trainers</legend>
              <div className="check-grid">
                {data.trainers.map((trainer) => (
                  <label className="check" key={trainer.id}>
                    <input type="checkbox" checked={draft.trainerIds.includes(trainer.id)} onChange={(event) => setDraft({ ...draft, trainerIds: event.target.checked ? [...draft.trainerIds, trainer.id] : draft.trainerIds.filter((id) => id !== trainer.id) })} />
                    {trainer.displayName}{trainer.proposed ? ' (proposed)' : ''}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="field full flex wrap">
              <button className="btn btn--dark btn--sm" type="button" onClick={() => void saveSession()}>Save session</button>
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => { setDraft(null); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </section>
      ) : null}
      <div className="a-grid">
        <section className="panel span-8">
          <div className="panel__head"><h2>Sessions</h2><span className="muted">{visible.length} shown</span></div>
          <div className="panel__body">
            {dates.map((day) => (
              <section key={day} style={{ marginBottom: 20 }}>
                <h3>{formatDate(day, { weekday: 'long', year: 'numeric' })}{day === data.today ? ' · today' : ''}</h3>
                <table className="table table--cards">
                  <tbody>
                    {visible.filter((session) => session.date === day).map((session) => (
                      <tr key={session.id}>
                        <td><b>{timeRange(session.startTime, session.endTime) || session.rawTime || '—'}</b><small>{session.type}</small></td>
                        <td><b>{session.activity || session.topic || 'Untitled'}</b><small>{session.topic}</small><small>{trainerLine(session)}</small></td>
                        <td className="cell-actions">
                          {writable ? (
                            <div className="actions">
                              <button className="icon-btn" type="button" aria-label="Move up" onClick={() => void move(session, 'up')} style={{ transform: 'rotate(180deg)' }}><Icon name="chevron-down" className="i--sm" /></button>
                              <button className="icon-btn" type="button" aria-label="Move down" onClick={() => void move(session, 'down')}><Icon name="chevron-down" className="i--sm" /></button>
                              <button className="icon-btn" type="button" aria-label="Edit session" onClick={() => { setEditingId(session.id); setDraft({ weekId: session.weekId, date: session.date, type: session.type, activity: session.activity, topic: session.topic, notes: session.notes, startTime: session.startTime ?? '', endTime: session.endTime ?? '', trainerStatus: session.trainerStatus, trainerIds: session.trainers.map((trainer) => trainer.id) }); }}><Icon name="edit" className="i--sm" /></button>
                              <button className="icon-btn danger" type="button" aria-label="Delete session" onClick={() => void removeSession(session)}><Icon name="trash" className="i--sm" /></button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
            {!visible.length ? <p className="muted">No sessions match these filters.</p> : null}
          </div>
        </section>
        <div className="span-4" style={{ display: 'grid', gap: 16 }}>
          <section className="panel">
            <div className="panel__head"><h2>Week outline</h2></div>
            <div className="panel__body form-stack">
              <label className="field">Week
                <select className="select" value={deliverableWeek} onChange={(event) => openWeek(event.target.value)}>
                  <option value="">Choose a week</option>
                  {weeks.map((week) => <option key={week.id} value={week.id}>Week {week.number} · {week.title}</option>)}
                </select>
              </label>
              {deliverableWeek ? (
                <>
                  <label className="field">Deliverables, one per line<textarea className="textarea" value={deliverableText} onChange={(event) => setDeliverableText(event.target.value)} disabled={!writable} /></label>
                  <TrainerChecks label="Professionalism trainers" trainers={data.trainers} selected={profIds} onChange={setProfIds} disabled={!writable} />
                  <TrainerChecks label="Cybersecurity trainers" trainers={data.trainers} selected={cyberIds} onChange={setCyberIds} disabled={!writable} />
                  {writable ? <button className="btn btn--dark btn--sm" type="button" onClick={() => void saveWeek()}>Save week</button> : null}
                </>
              ) : <p className="muted">Deliverables and the proposed trainer lists are edited per week.</p>}
            </div>
          </section>
          <section className="panel">
            <div className="panel__head"><h2>Re-import</h2></div>
            <div className="panel__body">
              <p className="muted">Upload the same workbook shape. Imported rows are replaced. Sessions added in admin, with an id that did not come from the file, are kept.</p>
              {usesMockApi() ? <p className="muted">This browser session uses the development adapter, which does not parse Excel. The live API accepts the file.</p> : null}
              {writable ? <input className="input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Workbook" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} /> : <span className="badge">Read only</span>}
            </div>
          </section>
          <section className="panel">
            <div className="panel__head"><h2>Trainer records</h2></div>
            <div className="panel__body">
              <ul className="activity">
                {data.trainers.map((trainer) => (
                  <li key={trainer.id}>
                    <div><b>{trainer.displayName}</b><br /><span className="muted">{trainer.kind === 'group' ? 'Group' : 'Person'}{trainer.userId ? '' : ' · no login'}</span></div>
                    {writable ? <label className="check"><input type="checkbox" checked={trainer.proposed} onChange={(event) => void toggleProposed(trainer.id, event.target.checked)} /> Proposed</label> : trainer.proposed ? <span className="badge">Proposed</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function TrainerChecks({ label, trainers, selected, onChange, disabled }: { label: string; trainers: AdminTimetable['trainers']; selected: string[]; onChange: (ids: string[]) => void; disabled: boolean }) {
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      <div className="check-grid">
        {trainers.map((trainer) => (
          <label className="check" key={trainer.id}>
            <input type="checkbox" disabled={disabled} checked={selected.includes(trainer.id)} onChange={(event) => onChange(event.target.checked ? [...selected, trainer.id] : selected.filter((id) => id !== trainer.id))} />
            {trainer.displayName}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function filterSessions(
  data: AdminTimetable | null,
  filters: { blockId: string; weekId: string; date: string; trainerId: string; type: string; q: string },
  weeks: Array<{ id: string; blockId: string }>,
): AdminSession[] {
  if (!data) return [];
  const needle = filters.q.trim().toLowerCase();
  return data.sessions.filter((session) => {
    const week = weeks.find((item) => item.id === session.weekId);
    if (filters.blockId && week?.blockId !== filters.blockId) return false;
    if (filters.weekId && session.weekId !== filters.weekId) return false;
    if (filters.date && session.date !== filters.date) return false;
    if (filters.trainerId && !session.trainers.some((trainer) => trainer.id === filters.trainerId)) return false;
    if (filters.type && session.type !== filters.type) return false;
    if (!needle) return true;
    const names = session.trainers.map((trainer) => trainer.displayName).join(' ');
    return `${session.activity} ${session.topic} ${names}`.toLowerCase().includes(needle);
  });
}
