import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState, LoadingRows } from '@/components/feedback';
import { formatDate } from '@/domain/format';
import {
  blockForWeek,
  outlineLines,
  timeRange,
  trainerLine,
  weeksOf,
  type PublicSession,
  type PublicWeek,
} from '@/domain/timetable';
import { useTimetable } from '@/hooks/useTimetable';
import { PageIntro } from './helpers';

const TYPE_LABEL: Record<PublicSession['type'], string> = {
  devotion: 'Devotion',
  standup: 'Standup',
  theory: 'Theory',
  practical: 'Practical',
  break: 'Break',
  group: 'Group',
  event: 'Event',
};

export function SchedulePage() {
  const timetable = useTimetable();
  const [params, setParams] = useSearchParams();
  const data = timetable.data;
  const weeks = weeksOf(data);
  const requested = Number(params.get('week') ?? '');
  const selected = weeks.some((week) => week.number === requested) ? requested : (data?.currentWeek ?? 1);
  const week = weeks.find((item) => item.number === selected);
  const block = data && week ? blockForWeek(data, week.number) : undefined;
  const days = useMemo(() => groupDays(week), [week]);
  const programme = data?.programme;

  return (
    <>
      <PageIntro
        title="Schedule"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Bootcamp' }, { label: 'Schedule' }]}
        eyebrow={programme ? programme.name : 'Cybersecurity Bootcamp'}
        headline={'Twelve weeks,\nday by day.'}
        aside={
          <>
            <p className="lead">
              {programme
                ? `${formatDate(programme.startsOn, { year: 'numeric' })} to ${formatDate(programme.endsOn, { year: 'numeric' })}. Devotion at 8:00 a.m., then the day’s sessions through 5:00 p.m.`
                : 'The daily timetable loads from the published programme.'}
            </p>
            <div className="flex wrap" style={{ marginTop: 16 }}>
              <Link className="btn btn--ghost btn--sm" to="/bootcamp">Programme outline</Link>
              <Link className="btn btn--ghost btn--sm" to="/classes">Sample lesson notes</Link>
            </div>
          </>
        }
      />
      <section className="section" style={{ paddingTop: 'var(--s-7)' }}>
        <div className="container">
          {timetable.loading ? <LoadingRows /> : null}
          {timetable.error ? <ErrorState title="The timetable could not be loaded" text={timetable.error.message} /> : null}
          {data && week && block ? (
            <>
              <div className="week-switch" role="tablist" aria-label="Choose a week">
                {weeks.map((item) => (
                  <button
                    key={item.id}
                    className={`week-switch__btn${item.number === week.number ? ' is-on' : ''}${item.number === data.currentWeek ? ' is-current' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={item.number === week.number}
                    onClick={() => setParams({ week: String(item.number) })}
                  >
                    <b>W{String(item.number).padStart(2, '0')}</b>
                    <span>{item.title}</span>
                  </button>
                ))}
              </div>
              <article className="week-sheet">
                <header className="week-sheet__head">
                  <div>
                    <span className="eyebrow">Block {block.sortOrder} · {block.name}</span>
                    <h2 className="h2" style={{ marginTop: 8 }}>Week {week.number}. {week.title}</h2>
                    <p className="muted">Week commencing {formatDate(week.startsOn, { weekday: 'long', year: 'numeric' })}{week.number === data.currentWeek ? ' · this week' : ''}</p>
                  </div>
                  <div className="week-sheet__themes">
                    <p><b>{block.professionalismTheme}</b></p>
                    <p><b>{block.cybersecurityTheme}</b></p>
                  </div>
                </header>
                <div className="week-sheet__grid">
                  <section>
                    <h3>General professionalism</h3>
                    <ul>{outlineLines(week.professionalism).map((line) => <li key={line}>{line}</li>)}</ul>
                    <TrainerNames label="Proposed trainers" trainers={week.professionalismTrainers} empty="The outline does not name a professionalism trainer for this week." />
                  </section>
                  <section>
                    <h3>Cybersecurity</h3>
                    <ul>{outlineLines(week.cybersecurity).map((line) => <li key={line}>{line}</li>)}</ul>
                    <TrainerNames label="Proposed trainers" trainers={week.cybersecurityTrainers} empty="The outline does not name a cybersecurity trainer for this week." />
                  </section>
                  <section>
                    <h3>Weekly deliverable</h3>
                    {week.deliverables.length ? (
                      <ul>{week.deliverables.map((item) => <li key={item.id}>{item.title}</li>)}</ul>
                    ) : <p className="muted">No deliverable is listed for this week.</p>}
                  </section>
                </div>
                <p className="muted week-sheet__note">Trainer names are proposed. The workbook says the daily allocation is still pending. A name on a session is the sheet’s proposal for that slot.</p>
              </article>
              <div className="day-board">
                {days.map((day) => (
                  <section className={`day-card${day.date === data.today ? ' is-today' : ''}`} key={day.date} aria-label={day.label}>
                    <header>
                      <h3>{day.label}</h3>
                      {day.date === data.today ? <span className="badge badge--lime">Today</span> : null}
                    </header>
                    <ol>
                      {day.sessions.map((session) => (
                        <li key={session.id} className={`sess sess--${session.type}`}>
                          <time>{timeRange(session.startTime, session.endTime) || 'Time not set'}</time>
                          <div>
                            <div className="sess__meta">
                              <span className="tag">{TYPE_LABEL[session.type]}</span>
                              {session.activity ? <b>{session.activity}</b> : null}
                            </div>
                            {session.topic ? <p className="sess__topic">{session.topic}</p> : null}
                            {trainerLine(session) ? <p className="sess__who">{trainerLine(session)}</p> : null}
                            {session.notes ? <p className="sess__note">{session.notes}</p> : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
              {programme?.rules.length ? (
                <aside className="callout" style={{ marginTop: 28 }}>
                  <h3>How the day is built</h3>
                  {programme.rules.slice(1).map((rule) => <p key={rule}>{rule}</p>)}
                </aside>
              ) : null}
            </>
          ) : null}
          {data && !week ? <ErrorState title="That week is not on the timetable" text="Choose a week from 1 to 12." /> : null}
        </div>
      </section>
    </>
  );
}

function TrainerNames({ label, trainers, empty }: { label: string; trainers: PublicWeek['professionalismTrainers']; empty: string }) {
  return (
    <p className="sess__who">
      {label}: {trainers.length ? trainers.map((trainer) => trainer.displayName).join(', ') : empty}
      {trainers.some((trainer) => trainer.proposed) ? ' · proposed' : ''}
      {trainers.some((trainer) => trainer.kind === 'group') ? ' · includes a group, not a login' : ''}
    </p>
  );
}

function groupDays(week: PublicWeek | undefined): Array<{ date: string; label: string; sessions: PublicSession[] }> {
  if (!week) return [];
  const groups = new Map<string, PublicSession[]>();
  for (const session of week.sessions) {
    const list = groups.get(session.date) ?? [];
    list.push(session);
    groups.set(session.date, list);
  }
  return [...groups.entries()].map(([date, sessions]) => ({
    date,
    label: `${sessions[0]?.day ?? ''} ${formatDate(date, { year: 'numeric' })}`.trim(),
    sessions,
  }));
}
