import type { WorkstationSnapshot } from './lab';

export type NetTone = 'idle' | 'online' | 'exposed' | 'secured' | 'expected';

export interface NetItem {
  id: 'you' | 'target' | 'p21' | 'p22' | 'p80';
  label: string;
  detail: string;
  tone: NetTone;
}

export const TONE_LABEL: Record<NetTone, string> = {
  idle: 'Idle',
  online: 'Online',
  exposed: 'Exposed',
  secured: 'Secured',
  expected: 'Expected',
};

export function networkVisuals(state: WorkstationSnapshot): { summary: string; items: NetItem[] } {
  const scanned = state.flags.sawScan;
  const up = state.flags.sawPing || scanned;
  const found = state.flags.sawFtp || state.objectives.name;
  const secured = state.objectives.fix;
  const port21: NetTone = secured ? 'secured' : found ? 'exposed' : scanned ? 'online' : 'idle';
  const items: NetItem[] = [
    { id: 'you', label: 'ws-01', detail: '10.10.8.15 · your machine, where the checks run', tone: 'online' },
    {
      id: 'target',
      label: 'lab-server',
      detail: up ? '10.10.8.20 · answering on the training LAN' : '10.10.8.20 · not checked yet',
      tone: up ? 'online' : 'idle',
    },
    {
      id: 'p21',
      label: 'Port 21',
      detail: port21Detail(port21),
      tone: port21,
    },
    {
      id: 'p22',
      label: 'Port 22',
      detail: scanned || state.flags.sawSsh ? 'SSH · open, asks for a key' : 'SSH · not listed yet',
      tone: scanned || state.flags.sawSsh ? 'expected' : 'idle',
    },
    {
      id: 'p80',
      label: 'Port 80',
      detail: scanned || state.flags.sawHttp ? 'HTTP · lab portal, meant to be readable' : 'HTTP · not listed yet',
      tone: scanned || state.flags.sawHttp ? 'expected' : 'idle',
    },
  ];
  return { summary: summaryFor(up, scanned, port21), items };
}

function port21Detail(tone: NetTone): string {
  if (tone === 'secured') return 'FTP · marked secured in this lesson';
  if (tone === 'exposed') return 'FTP · anonymous login, exposed';
  if (tone === 'online') return 'FTP · open, not inspected';
  return 'FTP · not listed yet';
}

function summaryFor(up: boolean, scanned: boolean, port21: NetTone): string {
  if (port21 === 'secured') return 'Port 21 is marked secured. The red glow is gone and the port shows a lock. Nothing on a real network was changed.';
  if (port21 === 'exposed') return 'Port 21 is the exposed service: anonymous FTP. It glows until you review the fix.';
  if (scanned) return 'lab-server is lit and three ports are open. Inspect the file service before you name it.';
  if (up) return 'lab-server is answering. Ports stay unknown until you scan.';
  return 'Your machine is ws-01. The training server stays dark until you ping or scan it.';
}
