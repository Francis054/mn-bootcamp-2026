import { afterEach, describe, expect, it } from 'vitest';
import {
  BANNER,
  applyCommand,
  createWorkstation,
  isWindowShown,
  markFixReviewed,
  recordFinding,
  revealHint,
} from './lab';
import { networkVisuals } from './network';
import { loadWorkstation, saveWorkstation } from './storage';

afterEach(() => sessionStorage.clear());

describe('practice terminal', () => {
  it('prints a simulated help list and refuses a chained command', () => {
    const helped = applyCommand(createWorkstation(), 'help');
    expect(helped.lines.some((line) => /simulated terminal/i.test(line.text))).toBe(true);
    const blocked = applyCommand(createWorkstation(), 'nmap -sV 10.10.8.20; id');
    expect(blocked.flags.sawScan).toBe(false);
    expect(blocked.lines.some((line) => /cannot chain commands/i.test(line.text))).toBe(true);
  });

  it('reports only the fictional target and remembers the scan', () => {
    let state = applyCommand(createWorkstation(), 'ip addr');
    expect(state.flags.sawAddress).toBe(true);
    expect(state.lines.some((line) => line.text.includes('10.10.8.15/24'))).toBe(true);
    state = applyCommand(state, 'ping 8.8.8.8');
    expect(state.flags.sawPing).toBe(false);
    expect(state.lines.some((line) => /nothing was sent/i.test(line.text))).toBe(true);
    state = applyCommand(state, 'ping -c 1 10.10.8.20');
    expect(state.flags.sawPing).toBe(true);
    state = applyCommand(state, 'nmap -sV 10.10.8.20');
    expect(state.objectives.scan).toBe(true);
    expect(state.lines.some((line) => /21\/tcp open\s+ftp/.test(line.text))).toBe(true);
    state = applyCommand(state, 'ftp 10.10.8.20');
    expect(state.flags.sawFtp).toBe(true);
    expect(state.lines.some((line) => /anonymous/.test(line.text))).toBe(true);
    const ssh = applyCommand(state, 'ssh trainee@10.10.8.20');
    expect(ssh.objectives.name).toBe(false);
    expect(ssh.flags.sawSsh).toBe(true);
  });

  it('clears the screen and keeps the simulated banner', () => {
    const cleared = applyCommand(applyCommand(createWorkstation(), 'whoami'), 'clear');
    expect(cleared.lines).toEqual([expect.objectContaining({ kind: 'banner', text: BANNER })]);
  });

  it('records anonymous FTP and blocks the fix until the service has been seen', () => {
    const fresh = createWorkstation();
    expect(markFixReviewed(fresh).objectives.fix).toBe(false);
    expect(recordFinding(fresh, 'ssh').findingTone).toBe('warn');
    const named = recordFinding(fresh, 'anonymous ftp');
    expect(named.objectives.name).toBe(true);
    expect(named.finding).toBe('Anonymous FTP (port 21)');
    const seen = applyCommand(fresh, 'ftp lab-server');
    expect(markFixReviewed(seen).objectives.fix).toBe(true);
    expect(revealHint(revealHint(revealHint(revealHint(fresh)))).hintsShown).toBe(3);
  });
});

describe('network model state', () => {
  it('lights the server after a scan, turns FTP red after inspection, and locks it after the fix', () => {
    const dark = networkVisuals(createWorkstation());
    expect(dark.items.find((item) => item.id === 'target')?.tone).toBe('idle');
    const scanned = networkVisuals(applyCommand(createWorkstation(), 'nmap -sV 10.10.8.20'));
    expect(scanned.items.find((item) => item.id === 'target')?.tone).toBe('online');
    expect(scanned.items.find((item) => item.id === 'p21')?.tone).toBe('online');
    const exposed = networkVisuals(applyCommand(applyCommand(createWorkstation(), 'nmap -sV 10.10.8.20'), 'ftp 10.10.8.20'));
    expect(exposed.items.find((item) => item.id === 'p21')?.tone).toBe('exposed');
    const secured = networkVisuals(markFixReviewed(applyCommand(createWorkstation(), 'ftp 10.10.8.20')));
    expect(secured.items.find((item) => item.id === 'p21')?.tone).toBe('secured');
    expect(secured.summary).toMatch(/lock/i);
  });

  it('shows the terminal in the centre until Defend is the active window', () => {
    const open = { ...createWorkstation(), open: ['terminal', 'defend', 'map'] as ['terminal', 'defend', 'map'], active: 'notes' as const };
    expect(isWindowShown(open, 'terminal')).toBe(true);
    expect(isWindowShown(open, 'defend')).toBe(false);
    expect(isWindowShown({ ...open, active: 'defend' }, 'defend')).toBe(true);
    expect(isWindowShown({ ...open, active: 'defend' }, 'map')).toBe(true);
  });
});

describe('workstation memory', () => {
  it('round-trips progress and ignores a broken save', () => {
    const state = recordFinding(applyCommand(createWorkstation('1'), 'nmap 10.10.8.20'), '21');
    saveWorkstation(state);
    expect(loadWorkstation()?.objectives).toMatchObject({ scan: true, name: true });
    expect(loadWorkstation()?.returnLessonId).toBe('1');
    sessionStorage.setItem('mn-workstation-lab', '{');
    expect(loadWorkstation()).toBeNull();
  });
});
