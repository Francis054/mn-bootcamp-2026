import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mark, OfficialLogo } from '@/components/Brand';
import { Tabs } from '@/components/controls';
import { Icon, type IconName } from '@/components/Icon';
import {
  FINDING,
  HINTS,
  MODES,
  OBJECTIVES,
  PROMPT,
  SAMPLE_COMMANDS,
  applyCommand,
  buildFeedback,
  closeApp,
  completedCount,
  createWorkstation,
  enterMode,
  fixAvailable,
  isMode,
  isWindowShown,
  labTasks,
  markFixReviewed,
  markLessonRead,
  openApp,
  recordFinding,
  revealHint,
  type AppId,
  type WorkstationSnapshot,
} from './lab';
import { NetworkModel } from './NetworkModel';
import { loadWorkstation, safeLessonId, saveWorkstation } from './storage';

const APP_META: Record<AppId, { label: string; blurb: string; icon: IconName }> = {
  notes: { label: 'Lesson', blurb: 'Addresses, ports, and services', icon: 'book' },
  terminal: { label: 'Terminal', blurb: 'Simulated practice commands', icon: 'terminal' },
  map: { label: 'Network', blurb: 'Model of the training LAN', icon: 'network' },
  lab: { label: 'Lab brief', blurb: 'Target, checks, and finding', icon: 'scan' },
  defend: { label: 'Defend', blurb: 'The recommended fix', icon: 'shield' },
  progress: { label: 'Progress', blurb: 'Objectives and feedback', icon: 'award' },
};

export function WorkstationApp() {
  const [params] = useSearchParams();
  const lessonParam = safeLessonId(params.get('lesson'));
  const [state, setState] = useState(() => {
    const saved = loadWorkstation();
    if (saved) return lessonParam ? { ...saved, returnLessonId: lessonParam } : saved;
    return createWorkstation(lessonParam);
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const [draft, setDraft] = useState('');
  const [histIndex, setHistIndex] = useState(-1);
  const [findingDraft, setFindingDraft] = useState('');
  const [launcher, setLauncher] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [live, setLive] = useState('');
  const [celebrate, setCelebrate] = useState<{ key: number; label: string } | null>(null);
  const commandRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const launcherButtonRef = useRef<HTMLButtonElement>(null);
  const firstAppRef = useRef<HTMLButtonElement>(null);
  const clock = useClock();

  useEffect(() => { saveWorkstation(state); }, [state]);
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [state.lines]);
  useEffect(() => {
    if (state.active === 'terminal') commandRef.current?.focus();
  }, [state.active]);
  useEffect(() => {
    if (!celebrate) return undefined;
    const timer = window.setTimeout(() => setCelebrate(null), 4200);
    return () => window.clearTimeout(timer);
  }, [celebrate]);
  useEffect(() => {
    if (!launcher) return undefined;
    firstAppRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setLauncher(false);
      launcherButtonRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [launcher]);

  function commit(next: WorkstationSnapshot, message?: string) {
    const gained = OBJECTIVES.filter((item) => !stateRef.current.objectives[item.id] && next.objectives[item.id]);
    stateRef.current = next;
    saveWorkstation(next);
    setState(next);
    if (gained.length) {
      const label = gained.map((item) => item.label).join('. ');
      setCelebrate({ key: Date.now(), label });
      setLive(`Objective complete: ${label}.`);
      return;
    }
    if (message) setLive(message);
  }

  function focusApp(app: AppId) {
    const current = stateRef.current;
    if (!current.open.includes(app)) {
      commit(openApp(current, app), `${APP_META[app].label} open.`);
      return;
    }
    if (current.active === app) return;
    const next = { ...current, active: app };
    stateRef.current = next;
    setState(next);
  }

  const done = completedCount(state);
  const backTo = state.returnLessonId ? `/classes/${state.returnLessonId}` : '/classes';
  const feedback = buildFeedback(state);

  return (
    <div className="ws">
      <a className="skip-link" href="#ws-main">Skip to the workstation</a>
      <p className="sr-only" role="status">{live}</p>
      <header className="ws-top">
        <Link className="ws-brand" to="/" aria-label="2026 Cyber Bootcamp by Maxim Nyansa Foundation — home">
          <span className="wordmark__mark"><Mark /></span>
          <span className="ws-brand__text"><b>Cyber Bootcamp</b><small>Learning workstation</small></span>
        </Link>
        <span className="ws-logo"><OfficialLogo width={150} /></span>
        <div className="ws-top__actions">
          <span className="ws-sim">Simulated lab</span>
          <Link className="btn btn--ghost-light btn--sm" to={backTo}>{state.returnLessonId ? 'Back to the lesson' : 'Back to classes'}</Link>
        </div>
        <div className="ws-top__title">
          <h1>Discover and Secure a Training Network</h1>
          <p>Fictional target 10.10.8.20. Commands stay in this browser. Beginner demo for the week 1 networks lesson.</p>
        </div>
      </header>
      <main id="ws-main">
        <div className="ws-modes">
          <Tabs label="Workstation mode" value={state.mode} onChange={(id) => { if (isMode(id)) commit(enterMode(stateRef.current, id), `${labelForMode(id)} mode.`); }} tabs={[...MODES]} />
          <p className="ws-score"><span>{done} of 4 objectives</span><span className="meter is-in" style={{ ['--p' as string]: done / 4 }}><i /></span></p>
        </div>
        <div className="ws-stage">
          <Window app="notes" state={state} onFocus={focusApp} onClose={(app) => commit(closeApp(state, app), `${APP_META[app].label} closed.`)}>
            <Notes read={state.objectives.read} onRead={() => commit(markLessonRead(stateRef.current))} onShowMap={() => focusApp('map')} />
          </Window>
          <Window app="terminal" state={state} onFocus={focusApp} onClose={(app) => commit(closeApp(state, app), `${APP_META[app].label} closed.`)}>
            <div className="ws-simbar">Simulated output. Prepared for this lesson, not a live machine.</div>
            <div className="ws-term" ref={scrollRef} tabIndex={0} aria-label="Simulated terminal output">
              {state.lines.map((line) => (
                <div key={line.id} className={`ws-line ws-line--${line.kind}`}>
                  {line.kind === 'in' ? <span className="ws-prompt">{PROMPT} </span> : null}{line.text}
                </div>
              ))}
            </div>
            <form className="ws-promptline" onSubmit={(event) => {
              event.preventDefault();
              const value = draft;
              if (!value.trim()) return;
              const next = applyCommand(stateRef.current, value);
              const name = value.trim().split(/\s+/)[0] ?? 'command';
              commit(next, name.toLowerCase() === 'clear' ? 'Terminal cleared. The simulated banner stays.' : `Simulated output added for ${name}.`);
              setDraft('');
              setHistIndex(-1);
            }}>
              <div className="ws-chips">
                {SAMPLE_COMMANDS.map((command) => (
                  <button key={command} type="button" className="ws-chip" onClick={() => { setDraft(command); commandRef.current?.focus(); }}>
                    <span className="sr-only">Put </span>{command}<span className="sr-only"> on the command line</span>
                  </button>
                ))}
              </div>
              <div className="ws-promptline__row">
                <label className="ws-prompt" htmlFor="ws-command"><span className="sr-only">Command </span><span aria-hidden="true">{PROMPT}</span></label>
                <input
                  id="ws-command"
                  ref={commandRef}
                  className="ws-command"
                  name="command"
                  value={draft}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-describedby="ws-command-hint"
                  onChange={(event) => { setDraft(event.target.value); setHistIndex(-1); }}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                    if (!state.history.length) return;
                    event.preventDefault();
                    const start = histIndex < 0 ? state.history.length : histIndex;
                    const next = event.key === 'ArrowUp' ? Math.max(0, start - 1) : Math.min(state.history.length, start + 1);
                    if (next === state.history.length) { setHistIndex(-1); setDraft(''); return; }
                    setHistIndex(next);
                    setDraft(state.history[next] ?? '');
                  }}
                />
              </div>
              <p id="ws-command-hint" className="ws-hint">Enter runs the simulated command. Up arrow recalls an earlier one. Type help for the list.</p>
            </form>
            <button className="ws-jump btn btn--ghost-light btn--xs" type="button" onClick={() => focusApp('lab')}>Show the lab brief</button>
          </Window>
          <Window app="map" state={state} onFocus={focusApp} onClose={(app) => commit(closeApp(state, app), `${APP_META[app].label} closed.`)}>
            <NetworkModel state={state} />
          </Window>
          <Window app="lab" state={state} onFocus={focusApp} onClose={(app) => commit(closeApp(state, app), `${APP_META[app].label} closed.`)}>
            <LabPane
              state={state}
              findingDraft={findingDraft}
              onDraft={setFindingDraft}
              onSubmit={() => {
                const next = recordFinding(stateRef.current, findingDraft);
                commit(next, next.findingNote);
              }}
              onHint={() => {
                const next = revealHint(stateRef.current);
                if (next === stateRef.current) setLive('No further hints. Compare the open ports with the lesson.');
                else commit(next, 'A hint is shown in the lab brief.');
              }}
              onShowTerminal={() => focusApp('terminal')}
            />
          </Window>
          <Window app="defend" state={state} onFocus={focusApp} onClose={(app) => commit(closeApp(state, app), `${APP_META[app].label} closed.`)}>
            <Defend state={state} onReview={() => commit(markFixReviewed(stateRef.current))} />
          </Window>
          <Window app="progress" state={state} onFocus={focusApp} onClose={(app) => commit(closeApp(state, app), `${APP_META[app].label} closed.`)}>
            <section id="ws-assessment" aria-labelledby="ws-feedback-title">
              <h3 id="ws-feedback-title">{feedback.title}</h3>
              <p><strong>{feedback.summary}</strong></p>
              {feedback.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
            <h3>Objectives</h3>
            <ul className="ws-objectives">
              {OBJECTIVES.map((item) => (
                <li key={item.id} data-done={state.objectives[item.id] ? 'true' : 'false'}>
                  <span>{state.objectives[item.id] ? 'Complete' : 'Not yet'}</span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
            <h3>Commands you ran</h3>
            {state.history.length ? (
              <ol className="ws-history">{state.history.slice(-8).map((item, index) => <li key={`${item}-${index}`}><code>{item}</code></li>)}</ol>
            ) : <p>Commands from the terminal are listed here.</p>}
            <div className="ws-actions">
              {resetArmed ? (
                <>
                  <button className="btn btn--danger btn--sm" type="button" onClick={() => {
                    commit(createWorkstation(state.returnLessonId), 'Practice reset. Progress in this tab has been cleared.');
                    setDraft('');
                    setFindingDraft('');
                    setHistIndex(-1);
                    setResetArmed(false);
                    setCelebrate(null);
                  }}>Confirm reset</button>
                  <button className="btn btn--ghost-light btn--sm" type="button" onClick={() => setResetArmed(false)}>Keep my progress</button>
                </>
              ) : <button className="btn btn--ghost-light btn--sm" type="button" onClick={() => setResetArmed(true)}>Reset this practice</button>}
            </div>
          </Window>
        </div>
        <div className="ws-dock">
          {launcher ? <button className="ws-backdrop" type="button" aria-label="Close applications" onClick={() => setLauncher(false)} /> : null}
          {launcher ? (
            <div role="menu" id="ws-launcher" aria-label="Applications" className="ws-launcher" onKeyDown={(event) => {
              if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
              const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
              const index = items.indexOf(document.activeElement as HTMLButtonElement);
              if (index < 0) return;
              event.preventDefault();
              const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
              items[next]?.focus();
            }}>
              {(Object.keys(APP_META) as AppId[]).map((app, index) => (
                <button
                  key={app}
                  ref={index === 0 ? firstAppRef : undefined}
                  role="menuitem"
                  type="button"
                  onClick={() => { commit(openApp(state, app), `${APP_META[app].label} open.`); setLauncher(false); }}
                >
                  <Icon name={APP_META[app].icon} />
                  <b>{APP_META[app].label}</b>
                  <small>{APP_META[app].blurb}</small>
                </button>
              ))}
            </div>
          ) : null}
          <div className="ws-taskbar" role="toolbar" aria-label="Workstation applications">
            <button
              ref={launcherButtonRef}
              className="ws-launch"
              type="button"
              aria-haspopup="menu"
              aria-expanded={launcher}
              aria-controls={launcher ? 'ws-launcher' : undefined}
              onClick={() => setLauncher((open) => !open)}
            >
              <Icon name="grid" />
              <span className="sr-only">Applications</span>
            </button>
            {(Object.keys(APP_META) as AppId[]).map((app) => {
              const open = state.open.includes(app);
              return (
                <button
                  key={app}
                  type="button"
                  className={`ws-dock__btn${state.active === app ? ' is-active' : ''}`}
                  aria-pressed={open}
                  aria-label={open ? `Focus ${APP_META[app].label}` : `Open ${APP_META[app].label}`}
                  onClick={() => focusApp(app)}
                >
                  <Icon name={APP_META[app].icon} className="i--sm" />
                  <span>{APP_META[app].label}</span>
                </button>
              );
            })}
            <div className="ws-clock"><span className="sr-only">Local time </span>{clock}</div>
          </div>
        </div>
      </main>
      {celebrate ? (
        <div className="ws-celebrate" aria-hidden="true" key={celebrate.key}>
          <span className="ws-celebrate__shards">{Array.from({ length: 8 }, (_, index) => <i key={index} style={{ ['--i' as string]: index }} />)}</span>
          <p><strong>Objective complete</strong><span>{celebrate.label}</span></p>
        </div>
      ) : null}
    </div>
  );
}

function labelForMode(id: string): string {
  return MODES.find((mode) => mode.id === id)?.label ?? 'Workstation';
}

function Window({ app, state, onFocus, onClose, children }: { app: AppId; state: WorkstationSnapshot; onFocus: (app: AppId) => void; onClose: (app: AppId) => void; children: ReactNode }) {
  const titleId = `ws-title-${app}`;
  const shown = isWindowShown(state, app);
  return (
    <section
      className={`ws-window ws-window--${app}${state.active === app ? ' is-active' : ''}`}
      role="region"
      aria-labelledby={titleId}
      hidden={!shown}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('button, a')) return;
        onFocus(app);
      }}
    >
      <div className="ws-window__bar">
        <Icon name={APP_META[app].icon} className="i--sm" />
        <h2 id={titleId}>{APP_META[app].label}</h2>
        <button type="button" className="ws-iconbtn" aria-label={`Close ${APP_META[app].label}`} onClick={() => onClose(app)}><Icon name="x" className="i--sm" /></button>
      </div>
      <div className="ws-body">{children}</div>
    </section>
  );
}

function Notes({ read, onRead, onShowMap }: { read: boolean; onRead: () => void; onShowMap: () => void }) {
  return (
    <>
      <h3>Addresses, ports, and services</h3>
      <p>Every device on this lab network has an IP address. That is the number other devices use to reach it. Your workstation is <strong>10.10.8.15</strong>. The training server is <strong>10.10.8.20</strong>. The <code>/24</code> means the first three numbers, 10.10.8, name the network, and the last number picks the device. Addresses that start with 10 are private. They are used inside a lab or an office. 10.10.8.20 is not a public internet address. It exists only in this story.</p>
      <p>A port is a numbered door on that address. One address can have many doors. Port 22 is the usual door for SSH, a remote login. Port 80 is the usual door for a website. Port 21 is the usual door for FTP, an old way to move files.</p>
      <p>A service is the program listening behind a door. An open port only tells you that some program answered. It does not tell you whether that program should be answering. SSH that demands a key is a normal locked door. A file service that lets anyone in with the name anonymous is an open cupboard.</p>
      <div className="ws-tablewrap">
        <table>
          <caption>Doors you will meet on the training server</caption>
          <thead><tr><th scope="col">Port</th><th scope="col">Usual service</th><th scope="col">What to notice</th></tr></thead>
          <tbody>
            <tr><td>21</td><td>FTP</td><td>Does it ask for a personal login?</td></tr>
            <tr><td>22</td><td>SSH</td><td>A key request is a normal lock.</td></tr>
            <tr><td>80</td><td>HTTP</td><td>The lab portal is meant to be readable.</td></tr>
          </tbody>
        </table>
      </div>
      <p>Find which door on 10.10.8.20 is the open cupboard, name it in the lab brief, and then read the fix. You will not change a real server. The terminal only prints prepared answers, and the network model repeats the same facts in a picture.</p>
      <div className="ws-actions">
        {read ? <p className="ws-note ws-note--ok">Explanation marked as read.</p> : <button className="btn btn--sm" type="button" onClick={onRead}>Mark this explanation as read</button>}
        <button className="btn btn--ghost-light btn--sm" type="button" onClick={onShowMap}>Show the network model</button>
      </div>
    </>
  );
}

function LabPane({ state, findingDraft, onDraft, onSubmit, onHint, onShowTerminal }: {
  state: WorkstationSnapshot;
  findingDraft: string;
  onDraft: (value: string) => void;
  onSubmit: () => void;
  onHint: () => void;
  onShowTerminal: () => void;
}) {
  return (
    <>
      <h3>Target environment</h3>
      <p>One service on the target is left open on purpose. The network model uses the same status as this list.</p>
      <dl className="ws-facts">
        <div><dt>Lab</dt><dd>Nyansa training LAN, fictional</dd></div>
        <div><dt>Your workstation</dt><dd>ws-01 · 10.10.8.15</dd></div>
        <div><dt>Training target</dt><dd>lab-server · 10.10.8.20</dd></div>
        <div><dt>Network</dt><dd>10.10.8.0/24, a private range</dd></div>
        <div><dt>Scope</dt><dd>Only 10.10.8.20</dd></div>
      </dl>
      <h3>Checks</h3>
      <ul className="ws-tasks">
        {labTasks(state).map((task) => (
          <li key={task.id} data-done={task.done ? 'true' : 'false'}>
            <span className="ws-task__state">{task.done ? 'Done' : 'To do'}</span>
            <span>{task.label}</span>
            <code>{task.detail}</code>
          </li>
        ))}
      </ul>
      <h3>Exposed service</h3>
      {state.finding ? (
        <p className="ws-note ws-note--ok">{state.findingNote} Recorded as {FINDING}.</p>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
          <label htmlFor="finding-service">Which service should not be open like this?</label>
          <input
            id="finding-service"
            className="ws-field"
            value={findingDraft}
            aria-invalid={state.findingTone === 'warn' || undefined}
            aria-describedby="finding-note"
            autoComplete="off"
            onChange={(event) => onDraft(event.target.value)}
          />
          <p id="finding-note" className={state.findingTone === 'warn' ? 'ws-note ws-note--warn' : 'ws-hint'} role={state.findingNote ? 'status' : undefined}>
            {state.findingNote || 'Type the service name or the port number. One answer.'}
          </p>
          <button className="btn btn--sm" type="submit">Record finding</button>
        </form>
      )}
      <h3>Hints</h3>
      {state.hintsShown ? <ol className="ws-hints">{HINTS.slice(0, state.hintsShown).map((hint) => <li key={hint}>{hint}</li>)}</ol> : <p>Hints stay hidden until you ask. Three are available.</p>}
      <div className="ws-actions">
        <button className="btn btn--ghost-light btn--sm" type="button" onClick={onHint} disabled={state.hintsShown >= HINTS.length}>Show a hint</button>
        <button className="ws-jump btn btn--ghost-light btn--xs" type="button" onClick={onShowTerminal}>Show the terminal</button>
      </div>
    </>
  );
}

function Defend({ state, onReview }: { state: WorkstationSnapshot; onReview: () => void }) {
  if (!fixAvailable(state)) {
    return (
      <>
        <h3>A fix has a shape before it has a name</h3>
        <p>When a service is exposed, the usual defensive choices are to turn it off, replace it with one that asks for a personal login, or allow it only from a trusted machine.</p>
        <p>The service in this lab is named here after you have seen it in the terminal. Inspect the file service from Practice, or record the finding, then come back.</p>
      </>
    );
  }
  return (
    <>
      <h3>Close the anonymous FTP share</h3>
      <p>Port 21 on lab-server (10.10.8.20) is FTP, and the simulated session accepted the username anonymous. It then listed README-lab.txt and backup-notes.txt. Anyone on the training LAN could read those files. SSH on port 22 did not do that: it asked for a key. The website on port 80 is the lab portal and is meant to be readable.</p>
      <ol className="ws-steps">
        <li>Turn anonymous login off. If nobody needs FTP, stop the service and close port 21.</li>
        <li>Move file sharing to SFTP, which uses SSH on port 22. That door already asks for a key in this lab.</li>
        <li>If a share has to remain, allow it only from the trainer machine, not from every address in 10.10.8.0/24.</li>
        <li>Take lab notes off any share that opens without a personal login.</li>
      </ol>
      <p>You do not need another scan. Naming the open door and choosing this fix is the exercise. Nothing here changes a real server. The network model turns that port green once you mark the fix reviewed.</p>
      <div className="ws-actions">
        {state.objectives.fix ? <p className="ws-note ws-note--ok">Fix reviewed. Port 21 is marked secured in the model.</p> : <button className="btn btn--sm" type="button" onClick={onReview}>I have reviewed the recommended fix</button>}
      </div>
    </>
  );
}

function useClock(): string {
  const [label, setLabel] = useState(() => formatClock(new Date()));
  useEffect(() => {
    const timer = window.setInterval(() => setLabel(formatClock(new Date())), 15000);
    return () => window.clearInterval(timer);
  }, []);
  return label;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
