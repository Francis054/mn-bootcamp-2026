import { Link } from 'react-router-dom';
import { completedCount } from './lab';
import { loadWorkstation } from './storage';

export function WorkstationEntry({ lessonId }: { lessonId: string }) {
  const saved = loadWorkstation();
  const done = saved ? completedCount(saved) : 0;
  return (
    <div className="callout callout--lime" style={{ marginTop: 28 }}>
      <h2>Practice this lesson on the workstation</h2>
      <p>Discover and Secure a Training Network is a simulated lab. Read how an IP address, a port, and a service fit together, check a fictional target, and review the defensive fix. A model of that network lights up as you go. Progress stays in this browser tab when you come back to the lesson.</p>
      {done > 0 ? <p style={{ marginTop: 10 }}><strong>{done} of 4 objectives</strong> are already complete in this tab.</p> : null}
      <div className="flex wrap" style={{ marginTop: 16 }}>
        <Link className="btn btn--sm" to={`/workstation?lesson=${encodeURIComponent(lessonId)}`}>Open the workstation</Link>
      </div>
    </div>
  );
}
