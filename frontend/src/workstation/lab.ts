/** Simulated beginner lab. Nothing in this module contacts a network or a shell. */

export const PROMPT = 'trainee@ws-01:~$';

export const BANNER =
  'Simulated output. These lines are written for the lesson. This terminal does not run commands on your computer or contact a real network.';

export const FINDING = 'Anonymous FTP (port 21)';

export const APPS = ['notes', 'terminal', 'map', 'lab', 'defend', 'progress'] as const;
export type AppId = (typeof APPS)[number];

export const MODES = [
  { id: 'learn', label: 'Learn' },
  { id: 'practice', label: 'Practice' },
  { id: 'defend', label: 'Defend' },
  { id: 'assessment', label: 'Assessment' },
] as const;
export type Mode = (typeof MODES)[number]['id'];

export const OBJECTIVES = [
  { id: 'read', label: 'Read how an address, a port, and a service fit together' },
  { id: 'scan', label: 'List the services on the training target' },
  { id: 'name', label: 'Name the exposed service' },
  { id: 'fix', label: 'Review the recommended defensive fix' },
] as const;
export type ObjectiveId = (typeof OBJECTIVES)[number]['id'];

export const HINTS = [
  'Start with ip addr. This workstation should show 10.10.8.15 on eth0. The lab brief names the target.',
  'ping 10.10.8.20 checks that the target answers. Then nmap -sV 10.10.8.20 lists the programs behind the open ports.',
  'One listed port is FTP, port 21. Run ftp 10.10.8.20 and see whether it asks for a personal login.',
] as const;

export const SAMPLE_COMMANDS = ['ip addr', 'ping 10.10.8.20', 'nmap -sV 10.10.8.20', 'ftp 10.10.8.20'] as const;

export const ENVIRONMENT: Array<[string, string]> = [
  ['Lab', 'Nyansa training LAN, fictional'],
  ['Your workstation', 'ws-01 · 10.10.8.15'],
  ['Training target', 'lab-server · 10.10.8.20'],
  ['Network', '10.10.8.0/24, a private range'],
  ['Scope', 'Only 10.10.8.20'],
  ['What is live', 'Nothing. Replies are written for the lesson.'],
];

export interface TermLine {
  id: number;
  kind: 'banner' | 'in' | 'out' | 'err';
  text: string;
}

export interface LabFlags {
  sawAddress: boolean;
  sawPing: boolean;
  sawScan: boolean;
  sawFtp: boolean;
  sawHttp: boolean;
  sawSsh: boolean;
}

export interface WorkstationSnapshot {
  mode: Mode;
  open: AppId[];
  active: AppId | null;
  lines: TermLine[];
  nextLineId: number;
  history: string[];
  hintsShown: number;
  finding: string;
  findingNote: string;
  findingTone: '' | 'ok' | 'warn';
  flags: LabFlags;
  objectives: Record<ObjectiveId, boolean>;
  returnLessonId: string;
}

export interface LabTask {
  id: string;
  label: string;
  detail: string;
  done: boolean;
}

export interface Feedback {
  title: string;
  summary: string;
  paragraphs: string[];
}

const HELP = `Practice commands for the Nyansa training LAN.
Simulated terminal: nothing runs on your computer or on a real network.

  help                     show this list
  ip addr                  this workstation address
  ping 10.10.8.20          does the training target answer
  nmap -sV 10.10.8.20      services on the training target
  ftp 10.10.8.20           try the file service
  curl http://10.10.8.20/  read the lab portal
  ssh trainee@10.10.8.20   try the remote login
  hint                     next lesson hint
  clear                    clear the screen

Also available: whoami, hostname, pwd, ls, cat lab-brief.txt, date, history.`;

const IP_REPORT = `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000
    link/ether 02:10:08:00:00:15 brd ff:ff:ff:ff:ff:ff
    inet 10.10.8.15/24 brd 10.10.8.255 scope global eth0
       valid_lft forever preferred_lft forever
Simulated addresses for ws-01.`;

const NMAP_REPORT = `Starting Nmap 7.94 ( https://nmap.org ) at 2026-10-25 09:15 GMT
Nmap scan report for lab-server (10.10.8.20)
Host is up (0.00041s latency).
Not shown: 997 closed ports
PORT   STATE SERVICE VERSION
21/tcp open  ftp     vsftpd 3.0.5
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu
80/tcp open  http    nginx 1.24.0
Service Info: OS: Linux
Nmap done: 1 IP address (1 host up) scanned in 1.84 seconds
Simulated report. This target is fictional and was not contacted.`;

const FTP_REPORT = `Connected to 10.10.8.20.
220 (vsFTPd 3.0.5)
Name (10.10.8.20:trainee): anonymous
331 Please specify the password.
Password: (empty — accepted)
230 Login successful.
Remote system type is UNIX.
Using binary mode to transfer files.
ftp> ls
-rw-r--r--    1 ftp      ftp           312 Oct 25 09:00 README-lab.txt
-rw-r--r--    1 ftp      ftp           188 Oct 25 09:00 backup-notes.txt
ftp> bye
221 Goodbye.
Simulated session. The username anonymous was accepted with no personal account.`;

const HTTP_REPORT = `HTTP/1.1 200 OK
Server: nginx/1.24.0
Content-Type: text/html

Nyansa Lab Portal
The training target is online.
This page is meant to be readable on the lab LAN.
Simulated page. No login and no secrets.`;

const SSH_REPORT = `trainee@10.10.8.20: Permission denied (publickey).
SSH is expected in this lab. It is asking for a key, which is a normal lock.
The exposed service is a different port.`;

const README_REPORT = `Nyansa training server
This FTP share is part of the beginner lab.
If you can read this without a password, the share is exposed.
Write down the service name and the port, then open Defend.
Simulated file.`;

const NOTES_REPORT = `Lab backup note
This file sits on a share that did not ask for a personal login.
Nothing in it is a real password.
Record the service as FTP on port 21, then open Defend.
Simulated file.`;

const LS_REPORT = `lab-brief.txt
notes.txt`;

const BRIEF_REPORT = `Nyansa training LAN
Your address: 10.10.8.15 (ws-01)
Training target: 10.10.8.20 (lab-server)
Use the lab brief beside this terminal for the checks.
Simulated local file.`;

const NOTES_LOCAL = `Ports to compare with the lesson
21  FTP   file transfer
22  SSH   remote login
80  HTTP  website
Simulated local file.`;

const UNSAFE = /[;&|`$<>(){}\\!\n\r]/;
const QUOTES = /['"]/;

const FINDING_NOTE = {
  empty: 'Name the service or the port. One answer, from the scan.',
  ssh: 'SSH on port 22 is expected in this lab. It asked for a key. Look for the service that shares files without a personal login.',
  http: 'The lab portal on port 80 is meant to be readable. Look for the service that shares files without a personal login.',
  dns: 'The scan did not show a DNS service. Use the ports in the simulated nmap report.',
  unknown: 'That does not match the exposed service. Look again at which port accepted a login with no personal account.',
} as const;

export type FindingJudgement = 'empty' | 'ftp' | keyof typeof FINDING_NOTE;

export function defaultFlags(): LabFlags {
  return { sawAddress: false, sawPing: false, sawScan: false, sawFtp: false, sawHttp: false, sawSsh: false };
}

export function defaultObjectives(): Record<ObjectiveId, boolean> {
  return { read: false, scan: false, name: false, fix: false };
}

export function isMode(value: string): value is Mode {
  return MODES.some((mode) => mode.id === value);
}

export function isAppId(value: string): value is AppId {
  return (APPS as readonly string[]).includes(value);
}

export function isWorkstationLesson(lesson: { week: number; moduleId: string }): boolean {
  return lesson.week === 1 && lesson.moduleId === 'network';
}

export function completedCount(state: WorkstationSnapshot): number {
  return OBJECTIVES.filter((item) => state.objectives[item.id]).length;
}

export function fixAvailable(state: WorkstationSnapshot): boolean {
  return state.objectives.name || state.flags.sawFtp;
}

export function labTasks(state: WorkstationSnapshot): LabTask[] {
  return [
    { id: 'addr', label: 'Read this workstation address', detail: 'ip addr', done: state.flags.sawAddress },
    { id: 'ping', label: 'Check that the training target answers', detail: 'ping 10.10.8.20', done: state.flags.sawPing },
    { id: 'scan', label: 'List the services and their versions', detail: 'nmap -sV 10.10.8.20', done: state.flags.sawScan },
    { id: 'ftp', label: 'Inspect the file service', detail: 'ftp 10.10.8.20', done: state.flags.sawFtp },
    { id: 'name', label: 'Record the exposed service', detail: 'Use the form below', done: state.objectives.name },
  ];
}

export function isWindowShown(state: WorkstationSnapshot, app: AppId): boolean {
  if (!state.open.includes(app)) return false;
  if (app !== 'terminal' && app !== 'defend') return true;
  const defendOpen = state.open.includes('defend');
  const terminalOpen = state.open.includes('terminal');
  if (state.active === 'defend' && defendOpen) return app === 'defend';
  if (state.active === 'terminal' && terminalOpen) return app === 'terminal';
  if (terminalOpen) return app === 'terminal';
  if (defendOpen) return app === 'defend';
  return false;
}

export function createWorkstation(returnLessonId = ''): WorkstationSnapshot {
  const blank: WorkstationSnapshot = {
    mode: 'learn',
    open: ['notes', 'map', 'lab', 'progress'],
    active: 'notes',
    lines: [],
    nextLineId: 1,
    history: [],
    hintsShown: 0,
    finding: '',
    findingNote: '',
    findingTone: '',
    flags: defaultFlags(),
    objectives: defaultObjectives(),
    returnLessonId,
  };
  return say(blank, 'banner', BANNER);
}

export function openApp(state: WorkstationSnapshot, app: AppId, focus = true): WorkstationSnapshot {
  const open = state.open.includes(app) ? state.open : [...state.open, app];
  return { ...state, open, active: focus ? app : state.active };
}

export function closeApp(state: WorkstationSnapshot, app: AppId): WorkstationSnapshot {
  const open = state.open.filter((item) => item !== app);
  if (state.active !== app) return { ...state, open };
  return { ...state, open, active: open[open.length - 1] ?? null };
}

export function enterMode(state: WorkstationSnapshot, mode: Mode): WorkstationSnapshot {
  const next = { ...state, mode };
  if (mode === 'practice') return openApp(openApp(next, 'lab', false), 'terminal', true);
  const app: AppId = mode === 'learn' ? 'notes' : mode === 'defend' ? 'defend' : 'progress';
  return openApp(next, app, true);
}

export function markLessonRead(state: WorkstationSnapshot): WorkstationSnapshot {
  if (state.objectives.read) return state;
  return { ...state, objectives: { ...state.objectives, read: true } };
}

export function markFixReviewed(state: WorkstationSnapshot): WorkstationSnapshot {
  if (!fixAvailable(state) || state.objectives.fix) return state;
  return { ...state, objectives: { ...state.objectives, fix: true } };
}

export function revealHint(state: WorkstationSnapshot): WorkstationSnapshot {
  if (state.hintsShown >= HINTS.length) return state;
  return { ...state, hintsShown: state.hintsShown + 1 };
}

export function judgeFinding(raw: string): FindingJudgement {
  const text = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 'empty';
  const ftp = new Set([
    'ftp', 'port 21', '21', '21 tcp', 'tcp 21', 'anonymous', 'anonymous ftp', 'ftp anonymous', 'vsftpd',
    'file transfer', 'file transfer protocol', 'ftp port 21', 'port 21 ftp', 'anonymous ftp port 21',
  ]);
  if (ftp.has(text)) return 'ftp';
  const ssh = new Set(['ssh', '22', 'port 22', '22 tcp', 'openssh', 'secure shell']);
  if (ssh.has(text)) return 'ssh';
  const http = new Set(['http', '80', 'port 80', '80 tcp', 'nginx', 'web', 'website', 'portal', 'http portal']);
  if (http.has(text)) return 'http';
  const dns = new Set(['dns', '53', 'port 53', 'domain']);
  if (dns.has(text)) return 'dns';
  return 'unknown';
}

export function recordFinding(state: WorkstationSnapshot, raw: string): WorkstationSnapshot {
  const judgement = judgeFinding(raw);
  if (judgement === 'ftp') {
    return {
      ...state,
      finding: FINDING,
      findingTone: 'ok',
      findingNote: 'Recorded. Anonymous FTP on port 21 accepted the username anonymous and listed files. That is the exposed service.',
      objectives: { ...state.objectives, name: true },
    };
  }
  if (state.objectives.name) return state;
  return { ...state, findingTone: 'warn', findingNote: FINDING_NOTE[judgement] };
}

export function buildFeedback(state: WorkstationSnapshot): Feedback {
  const done = completedCount(state);
  const paragraphs: string[] = [];
  if (state.objectives.name) {
    paragraphs.push('You named the exposed service: anonymous FTP on port 21 of lab-server (10.10.8.20). The simulated session accepted the username anonymous and listed README-lab.txt and backup-notes.txt.');
  } else if (state.flags.sawScan) {
    paragraphs.push('You have a service list for 10.10.8.20. Three ports answered. Record the one that shares files without a personal login.');
  } else if (state.flags.sawPing) {
    paragraphs.push('The training target answered a ping. The next check is nmap -sV 10.10.8.20.');
  } else {
    paragraphs.push('The target has not been checked yet. In Practice, read your address, ping 10.10.8.20, then list services.');
  }
  if (state.flags.sawSsh && state.objectives.name) {
    paragraphs.push('SSH on port 22 refused a password and asked for a key. That door is not the problem in this lab.');
  }
  if (state.objectives.fix) {
    paragraphs.push('The defensive fix is reviewed: turn off anonymous FTP or stop the service, move file sharing to SFTP on the SSH port, and do not leave lab notes on a share the whole training LAN can open.');
  } else if (fixAvailable(state)) {
    paragraphs.push('Open Defend and review the recommended fix. That is the last security objective.');
  }
  if (!state.objectives.read) {
    paragraphs.push('The Learn panel still has the short explanation of an address, a port, and a service.');
  }
  if (!state.objectives.scan && state.objectives.name) {
    paragraphs.push('The finding is recorded, and the scan objective is still open. Run nmap -sV 10.10.8.20 so the service list is part of your notes.');
  }
  const title = done === 4 ? 'Practice complete' : done === 0 ? 'Assessment' : 'Assessment in progress';
  return { title, summary: `${done} of 4 objectives complete.`, paragraphs };
}

export function applyCommand(state: WorkstationSnapshot, raw: string): WorkstationSnapshot {
  const input = raw.replace(/\r\n/g, '\n').trim();
  if (!input) return state;
  if (input.length > 160) {
    return say(state, 'err', 'That line is too long for this practice terminal. Try a single command such as nmap -sV 10.10.8.20.');
  }
  const history = [...state.history, input].slice(-30);
  let next: WorkstationSnapshot = { ...state, history };
  if (UNSAFE.test(input)) {
    next = say(next, 'in', input);
    return say(next, 'err', 'This practice terminal only runs one lesson command at a time. It cannot chain commands, redirect output, or touch a real system.');
  }
  if (QUOTES.test(input)) {
    next = say(next, 'in', input);
    return say(next, 'err', 'Quotes are not needed here. Try the command without them, for example ping 10.10.8.20.');
  }
  const parts = input.split(/\s+/);
  const token = parts[0] ?? '';
  if (!/^[a-z?][a-z0-9+.-]*$/i.test(token)) {
    next = say(next, 'in', input);
    return say(next, 'err', 'Type help for the lesson commands. This terminal is simulated.');
  }
  const cmd = normalizeCommand(token);
  const args = parts.slice(1);
  if (cmd === 'clear') {
    const existing = next.lines.find((line) => line.kind === 'banner');
    const banner = existing ?? { id: next.nextLineId, kind: 'banner' as const, text: BANNER };
    return { ...next, lines: [banner], nextLineId: existing ? next.nextLineId : next.nextLineId + 1 };
  }
  next = say(next, 'in', input);
  if (cmd === 'sudo') {
    return say(next, 'err', 'This terminal has no administrator path. Stay with the lesson commands from help.');
  }
  switch (cmd) {
    case 'help':
      return say(next, 'out', HELP);
    case 'whoami':
      return say(next, 'out', 'trainee');
    case 'hostname':
      return say(next, 'out', 'ws-01');
    case 'pwd':
      return say(next, 'out', '/home/trainee');
    case 'date':
      return say(next, 'out', 'Sun Oct 25 09:15:00 GMT 2026\nSimulated clock for the lab story. The taskbar clock is your own computer.');
    case 'uname':
      return say(next, 'out', 'Linux ws-01 6.8.0-lab #1 SMP Sat Oct 25 09:15:00 GMT 2026 x86_64 GNU/Linux\nSimulated kernel string.');
    case 'history':
      return say(next, 'out', next.history.map((item, index) => `  ${index + 1}  ${item}`).join('\n'));
    case 'hint':
      return printHint(next);
    case 'ls':
      return say(next, 'out', LS_REPORT);
    case 'cd':
      return say(next, 'out', 'This practice terminal stays in /home/trainee.');
    case 'exit':
      return say(next, 'out', 'There is nothing to exit. Close the window from its title bar, or keep working.');
    case 'man':
    case 'wget':
      return say(next, 'err', cmd === 'wget' ? 'Use curl for this lesson. Try curl http://10.10.8.20/' : 'Manual pages are not installed in this simulation. Type help.');
    case 'cat':
      return handleCat(next, args);
    case 'ip':
      return handleIp(next, args);
    case 'ping':
      return handlePing(next, args);
    case 'nmap':
      return handleNmap(next, args);
    case 'ftp':
      return handleFtp(next, args);
    case 'curl':
      return handleCurl(next, args);
    case 'ssh':
      return handleSsh(next, args);
    default:
      return say(next, 'err', `bash: ${cmd}: command not found\nType help for the lesson commands. This terminal is simulated.`);
  }
}

function normalizeCommand(token: string): string {
  const value = token.toLowerCase();
  if (value === '?' || value === 'commands') return 'help';
  if (value === 'ifconfig') return 'ip';
  return value;
}

function say(state: WorkstationSnapshot, kind: TermLine['kind'], text: string): WorkstationSnapshot {
  let nextId = state.nextLineId;
  const added: TermLine[] = text.split('\n').map((part) => {
    const line: TermLine = { id: nextId, kind, text: part };
    nextId += 1;
    return line;
  });
  let lines = [...state.lines, ...added];
  if (lines.length > 180) {
    const banner = lines.find((line) => line.kind === 'banner');
    lines = lines.slice(-150);
    if (banner && lines[0]?.id !== banner.id) lines = [banner, ...lines.filter((line) => line.id !== banner.id)];
  }
  return { ...state, lines, nextLineId: nextId };
}

function withFlag(state: WorkstationSnapshot, patch: Partial<LabFlags>, objective?: ObjectiveId): WorkstationSnapshot {
  const objectives = objective ? { ...state.objectives, [objective]: true as const } : state.objectives;
  return { ...state, flags: { ...state.flags, ...patch }, objectives };
}

function printHint(state: WorkstationSnapshot): WorkstationSnapshot {
  if (state.hintsShown >= HINTS.length) {
    return say(state, 'out', 'No further hints. Compare the open ports with the lesson: which one shares files without a personal login?');
  }
  const text = HINTS[state.hintsShown] ?? '';
  return say({ ...state, hintsShown: state.hintsShown + 1 }, 'out', text);
}

function handleCat(state: WorkstationSnapshot, args: string[]): WorkstationSnapshot {
  const name = (args[0] ?? '').replace(/^\.\//, '');
  if (args.length !== 1) return say(state, 'err', 'Usage: cat lab-brief.txt');
  if (name === 'lab-brief.txt') return say(state, 'out', BRIEF_REPORT);
  if (name === 'notes.txt') return say(state, 'out', NOTES_LOCAL);
  if (name === 'README-lab.txt' || name === 'backup-notes.txt') {
    return say(state, 'err', 'That file is on the training target, not on this workstation. Try ftp 10.10.8.20 or curl ftp://10.10.8.20/' + name);
  }
  return say(state, 'err', `cat: ${name}: No such file`);
}

function handleIp(state: WorkstationSnapshot, args: string[]): WorkstationSnapshot {
  const joined = args.map((item) => item.toLowerCase()).join(' ');
  const ok = joined === '' || ['a', 'addr', 'address', 'addr show', '-br', 'a show', 'eth0'].includes(joined);
  if (!ok) return say(state, 'err', 'Usage: ip addr');
  return say(withFlag(state, { sawAddress: true }), 'out', IP_REPORT);
}

function hostKind(host: string): 'target' | 'self' | 'lan' | 'other' {
  const value = host.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (value === '10.10.8.20' || value === 'lab-server') return 'target';
  if (value === '10.10.8.15' || value === 'ws-01' || value === 'localhost' || value === '127.0.0.1') return 'self';
  if (/^10\.10\.8\.\d{1,3}$/.test(value)) return 'lan';
  return 'other';
}

function outsideCopy(host: string, kind: 'lan' | 'other' | 'self'): string {
  if (kind === 'self') return `${host} is this workstation (ws-01), not the training target.`;
  if (kind === 'lan') return `No reply from ${host}. In this lab the training target is 10.10.8.20. Nothing was sent.`;
  return `${host} is outside the training LAN. Practice only against 10.10.8.20. Nothing was sent.`;
}

function handlePing(state: WorkstationSnapshot, args: string[]): WorkstationSnapshot {
  let count = 3;
  const hosts: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === '-c') {
      const value = Number(args[index + 1]);
      if (!Number.isInteger(value) || value < 1 || value > 4) {
        return say(state, 'err', 'This simulated ping accepts -c 1 to -c 4, then the training target.');
      }
      count = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('-')) return say(state, 'err', 'This simulated ping only supports -c and the target 10.10.8.20.');
    hosts.push(arg);
  }
  if (hosts.length !== 1) return say(state, 'err', 'Usage: ping 10.10.8.20');
  const host = hosts[0] ?? '';
  const kind = hostKind(host);
  if (kind !== 'target') return say(state, 'err', outsideCopy(host, kind));
  const times = ['0.42', '0.38', '0.41', '0.39'];
  const lines = ['PING 10.10.8.20 (10.10.8.20) 56(84) bytes of data.'];
  for (let seq = 1; seq <= count; seq += 1) lines.push(`64 bytes from 10.10.8.20: icmp_seq=${seq} ttl=64 time=${times[seq - 1] ?? '0.40'} ms`);
  lines.push('', '--- 10.10.8.20 ping statistics ---', `${count} packets transmitted, ${count} received, 0% packet loss, time ${count * 12}ms`, 'Simulated replies. No packets left this browser.');
  return say(withFlag(state, { sawPing: true }), 'out', lines.join('\n'));
}

function handleNmap(state: WorkstationSnapshot, args: string[]): WorkstationSnapshot {
  const flags = new Set(['-sv', '-f', '-pn', '--open']);
  const hosts: string[] = [];
  for (const arg of args) {
    if (arg.startsWith('-')) {
      if (!flags.has(arg.toLowerCase())) {
        return say(state, 'err', 'This simulated nmap supports -sV and -F against 10.10.8.20 only.');
      }
      continue;
    }
    hosts.push(arg);
  }
  if (hosts.length !== 1) return say(state, 'err', 'Usage: nmap -sV 10.10.8.20');
  const host = hosts[0] ?? '';
  const kind = hostKind(host);
  if (kind !== 'target') return say(state, 'err', `This simulated nmap only reports on 10.10.8.20. ${outsideCopy(host, kind)}`);
  return say(withFlag(state, { sawScan: true }, 'scan'), 'out', NMAP_REPORT);
}

function handleFtp(state: WorkstationSnapshot, args: string[]): WorkstationSnapshot {
  if (args.length !== 1) return say(state, 'err', 'Usage: ftp 10.10.8.20');
  const host = args[0] ?? '';
  const kind = hostKind(host);
  if (kind !== 'target') return say(state, 'err', `ftp: ${outsideCopy(host, kind)}`);
  return say(withFlag(state, { sawFtp: true }), 'out', FTP_REPORT);
}

function handleCurl(state: WorkstationSnapshot, args: string[]): WorkstationSnapshot {
  if (args.length !== 1) return say(state, 'err', 'Usage: curl http://10.10.8.20/');
  const raw = args[0] ?? '';
  const match = /^(https?|ftp):\/\/([^/\s]+)(\/[^?\s]*)?$/i.exec(raw);
  if (!match) return say(state, 'err', 'Usage: curl http://10.10.8.20/');
  const proto = (match[1] ?? '').toLowerCase();
  const host = match[2] ?? '';
  const path = decodePath(match[3] ?? '/');
  if (proto === 'https') return say(state, 'err', 'This lab target only has the plain HTTP page on port 80. Try curl http://10.10.8.20/');
  const kind = hostKind(host);
  if (kind !== 'target') return say(state, 'err', `curl: ${outsideCopy(host, kind)}`);
  if (proto === 'http') {
    if (path === '/') return say(withFlag(state, { sawHttp: true }), 'out', HTTP_REPORT);
    return say(state, 'err', `HTTP/1.1 404 Not Found\nSimulated page. Nothing is published at ${path}.`);
  }
  const next = withFlag(state, { sawFtp: true });
  if (path === '/') return say(next, 'out', FTP_REPORT);
  if (path === '/readme-lab.txt') return say(next, 'out', README_REPORT);
  if (path === '/backup-notes.txt') return say(next, 'out', NOTES_REPORT);
  return say(next, 'err', `550 ${path}: No such file on the simulated FTP share.`);
}

function decodePath(path: string): string {
  const trimmed = path.replace(/\/+$/, '').toLowerCase();
  return trimmed === '' ? '/' : trimmed;
}

function handleSsh(state: WorkstationSnapshot, args: string[]): WorkstationSnapshot {
  if (args.length !== 1) return say(state, 'err', 'Usage: ssh trainee@10.10.8.20');
  const token = args[0] ?? '';
  const host = token.includes('@') ? token.slice(token.indexOf('@') + 1) : token;
  const user = token.includes('@') ? token.slice(0, token.indexOf('@')) : 'trainee';
  if (user.toLowerCase() !== 'trainee') return say(state, 'err', 'This lab account is trainee. Try ssh trainee@10.10.8.20');
  const kind = hostKind(host);
  if (kind !== 'target') return say(state, 'err', `ssh: ${outsideCopy(host, kind)}`);
  return say(withFlag(state, { sawSsh: true }), 'out', SSH_REPORT);
}
