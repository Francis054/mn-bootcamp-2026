import type { Listing, PublicationStatus } from './publication.js';
import { SAMPLE_CLOCK, phaseForWeek, scheduleFor, weekStart } from './schedule.js';

/**
 * Labelled sample curriculum for local development. These rows are not a
 * record of real classes, and they do not include foundation-wide counters.
 * The seed inserts a row only when that id is missing, so a second run does
 * not duplicate it and does not undo an edit.
 */

interface SampleTrack {
  id: string;
  name: string;
  summary: string;
  sortOrder: number;
  publicationStatus: PublicationStatus;
  listing: Listing;
}

interface SampleModule extends SampleTrack {
  short: string;
  icon: string;
}

interface SamplePhase {
  id: number;
  name: string;
  months: string;
  summary: string;
  moduleIds: string[];
  publicationStatus: PublicationStatus;
  listing: Listing;
}

export interface SampleLesson {
  id: string;
  week: number;
  moduleId: string;
  title: string;
  slug: string;
  classDate: string;
  format: string;
  phase: 1 | 2 | 3;
  publicationStatus: PublicationStatus;
  listing: Listing;
  room: string;
  summary: string;
  objectives: string[];
  lab: string;
  codeSample: string;
  cover: string;
  internalNotes: string;
}

const SAMPLE_NOTE = 'Sample fixture. Curriculum order is still to be confirmed.';

export const SAMPLE_TRACKS: SampleTrack[] = [
  {
    id: 'blue-team',
    name: 'Blue team',
    summary: 'Sample track. Defending systems. The real description is still to be confirmed.',
    sortOrder: 1,
    publicationStatus: 'published',
    listing: 'sample',
  },
  {
    id: 'red-team',
    name: 'Red team',
    summary:
      'Sample track. Testing defences in a lab, with permission. The real description is still to be confirmed.',
    sortOrder: 2,
    publicationStatus: 'published',
    listing: 'sample',
  },
  {
    id: 'grc-awareness',
    name: 'GRC & Awareness',
    summary:
      'Sample track. Governance, risk, compliance, and helping people stay safe. The real description is still to be confirmed.',
    sortOrder: 3,
    publicationStatus: 'published',
    listing: 'sample',
  },
];

export const SAMPLE_MODULES: SampleModule[] = [
  {
    id: 'network',
    name: 'Network security',
    short: 'Network',
    icon: 'network',
    summary:
      'How data moves across networks and how to defend it with firewalls, segmentation and secure configuration.',
    sortOrder: 1,
    publicationStatus: 'published',
    listing: 'sample',
  },
  {
    id: 'ethical',
    name: 'Ethical hacking',
    short: 'Ethical hacking',
    icon: 'terminal',
    summary:
      'Thinking like an attacker, legally and responsibly, to find weaknesses before others do.',
    sortOrder: 2,
    publicationStatus: 'published',
    listing: 'sample',
  },
  {
    id: 'vuln',
    name: 'Vulnerability assessment',
    short: 'Vulnerability',
    icon: 'scan',
    summary: 'Scanning systems, ranking what matters most and reporting it clearly.',
    sortOrder: 3,
    publicationStatus: 'published',
    listing: 'sample',
  },
  {
    id: 'forensics',
    name: 'Digital forensics',
    short: 'Forensics',
    icon: 'search',
    summary: 'Collecting and analysing digital evidence without breaking its chain of custody.',
    sortOrder: 4,
    publicationStatus: 'published',
    listing: 'sample',
  },
  {
    id: 'awareness',
    name: 'Security awareness',
    short: 'Awareness',
    icon: 'users',
    summary: 'Helping people recognise phishing and social engineering, the most common way in.',
    sortOrder: 5,
    publicationStatus: 'published',
    listing: 'sample',
  },
  {
    id: 'incident',
    name: 'Incident response',
    short: 'Incident response',
    icon: 'alert',
    summary: 'Detecting, containing and recovering from attacks, step by step.',
    sortOrder: 6,
    publicationStatus: 'published',
    listing: 'sample',
  },
];

export const SAMPLE_PHASES: SamplePhase[] = [
  {
    id: 1,
    name: 'Foundations',
    months: 'October',
    summary:
      'How networks work, how they are defended, and the ethics and law of security testing.',
    moduleIds: ['network', 'ethical'],
    publicationStatus: 'published',
    listing: 'sample',
  },
  {
    id: 2,
    name: 'Find & analyse',
    months: 'November',
    summary: 'Finding weaknesses before attackers do, and reading the evidence they leave behind.',
    moduleIds: ['vuln', 'forensics'],
    publicationStatus: 'published',
    listing: 'sample',
  },
  {
    id: 3,
    name: 'Respond & protect',
    months: 'December',
    summary: 'Handling incidents calmly and helping people around you stay safe online.',
    moduleIds: ['incident', 'awareness'],
    publicationStatus: 'published',
    listing: 'sample',
  },
];

const TITLES: Record<string, [string, string]> = {
  network: ['How networks really move data', 'Firewalls, segmentation and VPNs'],
  ethical: ['The ethical hacker’s mindset and the law', 'Reconnaissance in a safe lab'],
  vuln: ['Scanning and prioritising vulnerabilities', 'Writing a vulnerability report'],
  forensics: ['Evidence handling basics', 'Reading the story in a disk image'],
  awareness: ['Spotting social engineering', 'Designing an awareness session'],
  incident: ['The incident response lifecycle', 'Tabletop exercise: a simulated breach'],
};

const OBJECTIVES: Record<string, string[]> = {
  network: [
    'Explain how packets move between networks',
    'Configure a basic firewall rule set',
    'Recognise insecure network services',
  ],
  ethical: [
    'Describe the legal limits of security testing',
    'Plan a test with a written scope',
    'Use reconnaissance tools in a safe lab',
  ],
  vuln: [
    'Run an authenticated vulnerability scan',
    'Rank findings by risk',
    'Write a clear remediation note',
  ],
  forensics: [
    'Preserve evidence with hashing',
    'Build a simple event timeline',
    'Document chain of custody',
  ],
  awareness: [
    'Spot common phishing signs',
    'Explain social engineering tactics',
    'Plan a short awareness session',
  ],
  incident: [
    'Walk through the incident response lifecycle',
    'Run a tabletop exercise',
    'Write a short incident report',
  ],
};

const CODE: Record<string, string> = {
  network: '# sample: list listening ports in the lab VM\n$ ss -tulpn\n$ sudo ufw status verbose',
  ethical: '# sample: scope check before any test\n$ cat scope.txt\n10.10.0.0/24  # lab range only',
  vuln: '# sample: scan the practice target\n$ nmap -sV 10.10.0.12',
  forensics: '# sample: hash the evidence image\n$ sha256sum disk01.img > disk01.sha256',
  awareness: '# sample: inspect a suspicious link\nhttps://paypa1-secure.example/login',
  incident: '# sample: triage checklist\n[ ] identify  [ ] contain  [ ] eradicate  [ ] recover',
};

const ORDER = [
  'network',
  'network',
  'ethical',
  'ethical',
  'vuln',
  'vuln',
  'forensics',
  'awareness',
  'forensics',
  'incident',
  'incident',
  'awareness',
] as const;

const FORMATS = [
  'Lecture + lab',
  'Hands-on lab',
  'Workshop',
  'Lecture + lab',
  'Hands-on lab',
  'Workshop',
];

const COVERS = [
  'hack-coding-team',
  'electronics-lab',
  'vr-demo-group',
  'presenters-yellow-room',
  'trio-google-neon',
  'participant-phone',
  'vr-headset-moment',
  'arc-wall-trio',
  'duo-google-wall',
  'guests-seated',
  'vr-group-lounge',
  'selfie-orange-wall',
];

export function buildSampleLessons(): SampleLesson[] {
  const seen: Record<string, number> = {};
  return ORDER.map((moduleId, index) => {
    const slot = seen[moduleId] ?? 0;
    seen[moduleId] = slot + 1;
    const pair = TITLES[moduleId];
    const title = pair?.[slot % 2] ?? 'Sample lesson';
    const week = index + 1;
    const classDate = weekStart(week);
    const schedule = scheduleFor(classDate, SAMPLE_CLOCK);
    const moduleName = SAMPLE_MODULES.find((module) => module.id === moduleId)?.name ?? moduleId;
    return {
      id: String(week),
      week,
      moduleId,
      title,
      slug: slugifyTitle(title),
      classDate,
      format: FORMATS[index % FORMATS.length] ?? 'Workshop',
      phase: phaseForWeek(week),
      publicationStatus: schedule === 'upcoming' ? 'scheduled' : 'published',
      listing: 'sample',
      room: 'ICT lab — to be confirmed',
      summary: `Week ${week} of the bootcamp focuses on ${moduleName.toLowerCase()}: ${title.charAt(0).toLowerCase()}${title.slice(1)}.`,
      objectives: OBJECTIVES[moduleId] ?? [],
      lab: '# Sample lab steps\n1. Start the isolated lab VM\n2. Follow the trainer walkthrough\n3. Record findings in your notebook',
      codeSample: CODE[moduleId] ?? '',
      cover: COVERS[index] ?? 'electronics-lab',
      internalNotes: SAMPLE_NOTE,
    };
  });
}

function slugifyTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
