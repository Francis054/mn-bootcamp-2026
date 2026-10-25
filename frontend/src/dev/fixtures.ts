import type {
  AboutContent,
  BootcampEvent,
  DevUser,
  FoundationStat,
  HomepageContent,
  Lesson,
  MediaItem,
  Milestone,
  ModuleInfo,
  Project,
  SiteSettings,
  Trainee,
} from '@/domain/types';
import { scheduleFor, slugify, weekStart } from '@/domain/format';

export const MODULES: ModuleInfo[] = [
  { id: 'network', name: 'Network security', short: 'Network', icon: 'network', summary: 'How data moves across networks and how to defend it with firewalls, segmentation and secure configuration.' },
  { id: 'ethical', name: 'Ethical hacking', short: 'Ethical hacking', icon: 'terminal', summary: 'Thinking like an attacker, legally and responsibly, to find weaknesses before others do.' },
  { id: 'vuln', name: 'Vulnerability assessment', short: 'Vulnerability', icon: 'scan', summary: 'Scanning systems, ranking what matters most and reporting it clearly.' },
  { id: 'forensics', name: 'Digital forensics', short: 'Forensics', icon: 'search', summary: 'Collecting and analysing digital evidence without breaking its chain of custody.' },
  { id: 'awareness', name: 'Security awareness', short: 'Awareness', icon: 'users', summary: 'Helping people recognise phishing and social engineering, the most common way in.' },
  { id: 'incident', name: 'Incident response', short: 'Incident response', icon: 'alert', summary: 'Detecting, containing and recovering from attacks, step by step.' },
];

export const ALBUM_LABEL: Record<MediaItem['album'], string> = {
  anniversary: '10th anniversary',
  hackathon: 'AI for Impact hackathon (TBC)',
  community: 'Community',
};

const PHOTOS: Array<Omit<MediaItem, 'id' | 'src' | 'alt' | 'consent' | 'publicationStatus' | 'listing'>> = [
  { file: 'hack-group-google-wall', width: 1600, height: 1066, caption: 'Group photo in front of the Google wall', album: 'hackathon' },
  { file: 'anniversary-signature-wall', width: 1600, height: 1067, caption: 'At the 10th anniversary signature wall', album: 'anniversary' },
  { file: 'vr-headset-moment', width: 1600, height: 1066, caption: 'Trying a VR headset', album: 'hackathon' },
  { file: 'guests-smiling', width: 1280, height: 1600, caption: 'Guests in the audience', album: 'anniversary' },
  { file: 'hack-coding-team', width: 1600, height: 1066, caption: 'A team working at a laptop', album: 'hackathon' },
  { file: 'participant-portrait', width: 1600, height: 756, caption: 'The Foundation group in white 10-year shirts, posed in front of the anniversary banner', album: 'community' },
  { file: 'electronics-lab', width: 1600, height: 1066, caption: 'Hands-on electronics at the build table', album: 'hackathon' },
  { file: 'trio-google-neon', width: 1600, height: 1066, caption: 'Three attendees by the neon sign', album: 'hackathon' },
  { file: 'banners-computer4schools', width: 1600, height: 1066, caption: 'Programme banners on display', album: 'anniversary' },
  { file: 'guest-print-shirt', width: 1280, height: 1600, caption: 'A guest in a printed shirt', album: 'community' },
  { file: 'vr-group-lounge', width: 1600, height: 1280, caption: 'A VR demo in the lounge', album: 'hackathon' },
  { file: 'presenters-yellow-room', width: 1600, height: 1066, caption: 'Presenters in the yellow room', album: 'community' },
  { file: 'selfie-orange-wall', width: 1066, height: 1600, caption: 'A selfie by the orange wall', album: 'community' },
  { file: 'guests-seated', width: 1600, height: 1066, caption: 'Guests seated together', album: 'anniversary' },
  { file: 'duo-google-wall', width: 1600, height: 1066, caption: 'Two attendees by the carved wall', album: 'hackathon' },
  { file: 'participant-phone', width: 1600, height: 756, caption: 'The Foundation group in white 10-year shirts, posed in front of the anniversary banner', album: 'community' },
  { file: 'arc-wall-trio', width: 1600, height: 1066, caption: 'Conversation by the arched mural', album: 'community' },
  { file: 'vr-demo-group', width: 1600, height: 1066, caption: 'A VR demo with onlookers', album: 'hackathon' },
  { file: 'arc-wall-duo', width: 1280, height: 1600, caption: 'Two attendees by the arched mural', album: 'community' },
  { file: 'trio-google-wall', width: 1600, height: 1066, caption: 'Three attendees by the Google wall', album: 'hackathon' },
  { file: 'anniversary-group-outdoor', width: 1600, height: 1067, caption: 'Outdoor group photo', album: 'anniversary' },
];

export function mediaSrc(file: string, size: 800 | 1600 = 1600): string {
  return `/assets/img/${file}-${size}.webp`;
}

export function buildMedia(): MediaItem[] {
  return PHOTOS.map((photo, index) => ({
    ...photo,
    id: `m${index + 1}`,
    src: mediaSrc(photo.file, 800),
    alt: photo.caption,
    consent: index % 4 === 0 ? 'verified' : 'pending',
    publicationStatus: 'published',
    listing: 'sample',
  }));
}

const TITLES: Record<string, [string, string]> = {
  network: ['How networks really move data', 'Firewalls, segmentation and VPNs'],
  ethical: ['The ethical hacker’s mindset and the law', 'Reconnaissance in a safe lab'],
  vuln: ['Scanning and prioritising vulnerabilities', 'Writing a vulnerability report'],
  forensics: ['Evidence handling basics', 'Reading the story in a disk image'],
  awareness: ['Spotting social engineering', 'Designing an awareness session'],
  incident: ['The incident response lifecycle', 'Tabletop exercise: a simulated breach'],
};

const OBJECTIVES: Record<string, string[]> = {
  network: ['Explain how packets move between networks', 'Configure a basic firewall rule set', 'Recognise insecure network services'],
  ethical: ['Describe the legal limits of security testing', 'Plan a test with a written scope', 'Use reconnaissance tools in a safe lab'],
  vuln: ['Run an authenticated vulnerability scan', 'Rank findings by risk', 'Write a clear remediation note'],
  forensics: ['Preserve evidence with hashing', 'Build a simple event timeline', 'Document chain of custody'],
  awareness: ['Spot common phishing signs', 'Explain social engineering tactics', 'Plan a short awareness session'],
  incident: ['Walk through the incident response lifecycle', 'Run a tabletop exercise', 'Write a short incident report'],
};

const CODE: Record<string, string> = {
  network: '# sample: list listening ports in the lab VM\n$ ss -tulpn\n$ sudo ufw status verbose',
  ethical: '# sample: scope check before any test\n$ cat scope.txt\n10.10.0.0/24  # lab range only',
  vuln: '# sample: scan the practice target\n$ nmap -sV 10.10.0.12',
  forensics: '# sample: hash the evidence image\n$ sha256sum disk01.img > disk01.sha256',
  awareness: '# sample: inspect a suspicious link\nhttps://paypa1-secure.example/login  # look-alike domain',
  incident: '# sample: triage checklist\n[ ] identify  [ ] contain  [ ] eradicate  [ ] recover',
};

const ORDER = ['network', 'network', 'ethical', 'ethical', 'vuln', 'vuln', 'forensics', 'awareness', 'forensics', 'incident', 'incident', 'awareness'] as const;
const FORMATS = ['Lecture + lab', 'Hands-on lab', 'Workshop', 'Lecture + lab', 'Hands-on lab', 'Workshop'];
const COVERS = ['hack-coding-team', 'electronics-lab', 'vr-demo-group', 'presenters-yellow-room', 'trio-google-neon', 'participant-phone', 'vr-headset-moment', 'arc-wall-trio', 'duo-google-wall', 'guests-seated', 'vr-group-lounge', 'selfie-orange-wall'];

export function buildLessons(): Lesson[] {
  const seen: Record<string, number> = {};
  return ORDER.map((moduleId, index) => {
    const slot = seen[moduleId] ?? 0;
    seen[moduleId] = slot + 1;
    const title = TITLES[moduleId]?.[slot % 2] ?? 'Sample lesson';
    const week = index + 1;
    const date = weekStart(week);
    const scheduleStatus = scheduleFor(date);
    return {
      id: String(week),
      week,
      moduleId,
      title,
      slug: slugify(title),
      date,
      format: FORMATS[index % FORMATS.length] ?? 'Workshop',
      phase: week <= 4 ? 1 : week <= 8 ? 2 : 3,
      scheduleStatus,
      publicationStatus: scheduleStatus === 'upcoming' ? 'scheduled' : 'published',
      listing: 'sample',
      room: 'ICT lab — to be confirmed',
      summary: `Week ${week} of the bootcamp focuses on ${moduleName(moduleId).toLowerCase()}: ${title.charAt(0).toLowerCase()}${title.slice(1)}.`,
      objectives: OBJECTIVES[moduleId] ?? [],
      lab: '# Sample lab steps\n1. Start the isolated lab VM\n2. Follow the trainer walkthrough\n3. Record findings in your notebook',
      codeSample: CODE[moduleId] ?? '',
      cover: COVERS[index] ?? 'electronics-lab',
      internalNotes: 'Sample fixture. Curriculum order is still to be confirmed.',
      updatedAt: '2026-10-24T10:00:00Z',
    };
  });
}

export function moduleName(id: string): string {
  return MODULES.find((module) => module.id === id)?.name ?? id;
}

const HUES = [140, 95, 170, 60, 120, 190, 80, 150, 30, 110, 200, 160];
const SKILLS = [
  ['Linux', 'Wireshark', 'Firewalls'],
  ['Kali Linux', 'Python', 'OWASP Top 10'],
  ['Nmap', 'OpenVAS', 'Risk reports'],
  ['Autopsy', 'Chain of custody', 'Log analysis'],
  ['Phishing drills', 'Policy writing', 'Training design'],
  ['SIEM basics', 'Playbooks', 'Triage'],
];

export function buildTrainees(): Trainee[] {
  return Array.from({ length: 12 }, (_, index) => {
    const n = String(index + 1).padStart(2, '0');
    const focus = MODULES[index % 6]?.id ?? 'network';
    const track = index % 3 === 0 ? 'Blue team' : index % 3 === 1 ? 'Red team' : 'GRC & Awareness';
    return {
      id: String(index + 1),
      displayName: `Sample Trainee ${n}`,
      initials: `T${index + 1}`,
      hue: HUES[index] ?? 140,
      email: `trainee${n}@example.test`,
      track,
      focus,
      skills: SKILLS[index % 6] ?? [],
      bio: 'Placeholder: why they joined the bootcamp, what they want to do next and what they are proudest of so far. No biography is shown until the trainee writes and approves it.',
      quote: 'Sample quote — the trainee’s own words go here.',
      linkedin: '',
      portfolio: '',
      consentReceived: false,
      listing: 'sample',
      publicationStatus: 'published',
      statusLabel: 'In training',
      internalNotes: 'Development fixture. Do not replace with a real person without written consent.',
    };
  });
}

const TOOLS: Record<string, string> = {
  network: 'pfSense, Wireshark',
  ethical: 'Kali Linux',
  vuln: 'Nmap, OpenVAS',
  forensics: 'Autopsy',
  awareness: 'Slides, survey',
  incident: 'Playbook template',
};

export function buildProjects(): Project[] {
  const rows: Array<Pick<Project, 'id' | 'title' | 'moduleId' | 'type' | 'cover' | 'image'>> = [
    { id: '1', title: 'Home network hardening lab', moduleId: 'network', type: 'Lab', cover: 'terminal', image: 'hack-coding-team' },
    { id: '2', title: 'Capture-the-flag practice set', moduleId: 'ethical', type: 'CTF', cover: 'flag', image: 'electronics-lab' },
    { id: '3', title: 'Vulnerability scan of a test web app', moduleId: 'vuln', type: 'Lab', cover: 'scan', image: 'vr-demo-group' },
    { id: '4', title: 'Forensic timeline from a disk image', moduleId: 'forensics', type: 'Case study', cover: 'grid', image: 'participant-phone' },
    { id: '5', title: 'Phishing-awareness campaign for a school', moduleId: 'awareness', type: 'Community project', cover: 'wave', image: 'presenters-yellow-room' },
    { id: '6', title: 'Incident response playbook', moduleId: 'incident', type: 'Capstone', cover: 'shield', image: 'trio-google-neon' },
  ];
  return rows.map((row) => ({
    ...row,
    slug: slugify(row.title),
    abstract: 'Placeholder: a plain-language description of the problem the team set out to solve, the lab setup, what they found and what they recommend.',
    tools: TOOLS[row.moduleId] ?? 'Lab tools',
    steps: ['Scope and plan', 'Build and test', 'Report'],
    team: ['Sample Trainee 01', 'Sample Trainee 04'],
    repositoryUrl: '',
    demoUrl: '',
    labOnlyConfirmed: true,
    shareAgreed: false,
    publicationStatus: Number(row.id) < 3 ? 'in_review' : 'draft',
    listing: 'sample',
    internalNotes: 'Sample project. Not a record of trainee work.',
  }));
}

export function buildEvents(): BootcampEvent[] {
  return [
    {
      id: 'start', title: 'Bootcamp training starts', date: '2026-10-05', dateTbc: false,
      whenLabel: 'Mon 5 Oct 2026', place: 'Maxim Nyansa Foundation premises, Tantra Hills, Accra',
      kind: 'Milestone', verified: true, sample: false,
      summary: 'The free, in-person 2026 Cyber Security Bootcamp begins.',
      body: { kind: 'callout', tone: 'lime', title: 'Day one', text: 'Training began at the Maxim Nyansa Foundation premises in Tantra Hills, Accra. The bootcamp is free and in person.' },
      source: 'Bootcamp 2026 announcement — maximnyansa.com and the Foundation’s LinkedIn.',
      sourceUrl: 'https://www.linkedin.com/posts/maxim-nyansa-foundation_applications-are-open-for-the-maxim-nyansa-activity-7496108200585404418-jX54',
      image: 'electronics-lab', showOnAnniversary: false, calendarDownload: true, startTime: '', endTime: '',
      publicationStatus: 'published', listing: 'public', internalNotes: '',
    },
    {
      id: 'hackathon', title: 'AI for Impact hackathon', date: '2026-10-07', dateTbc: true,
      whenLabel: 'October 2026 · date TBC', place: 'Venue to be confirmed',
      kind: 'Partner event', verified: false, sample: false,
      summary: 'A hackathon co-organised with STEMAIDE Africa. Whether bootcamp trainees took part is still to be confirmed.',
      body: { kind: 'callout', tone: 'warn', title: 'Details to be confirmed', text: 'On 9 Oct 2026 STEMAIDE Africa announced an “AI for Impact” hackathon co-organised with Maxim Nyansa IT Solutions. The date, venue, results and whether bootcamp trainees took part are not confirmed, so this page stays a placeholder.' },
      source: 'STEMAIDE Africa LinkedIn post, 9 Oct 2026 (title only). Date, venue and bootcamp involvement are unconfirmed.',
      sourceUrl: 'https://www.linkedin.com/posts/stemaide-africa_hackathon-for-impact-they-came-they-coded-activity-7514271480533135360-FgSa',
      image: 'hack-group-google-wall', showOnAnniversary: true, calendarDownload: false, startTime: '', endTime: '',
      publicationStatus: 'published', listing: 'public', internalNotes: 'Confirm date, venue and whether bootcamp trainees took part.',
    },
    {
      id: 'reception', title: '10th anniversary reception with GNBCC', date: '2026-10-08', dateTbc: false,
      whenLabel: 'Thu 8 Oct 2026 · 5–8 PM', place: 'GNBCC, Cantonments, Accra',
      kind: 'Anniversary', verified: true, sample: false,
      summary: 'An anniversary cocktail reception with the Ghana Netherlands Business & Culture Council.',
      body: { kind: 'callout', tone: 'plain', title: 'Hosted with GNBCC', text: 'An anniversary cocktail reception with the Ghana Netherlands Business & Culture Council, 5–8 PM at GNBCC in Cantonments, Accra. Climbing The Right Tree partners from the Netherlands attended.' },
      source: 'GNBCC event listing and the Foundation’s anniversary posts.',
      sourceUrl: 'https://gnbcc.net/news/maxim-nyansa-foundation-marks-10-years-with-anniversary-cocktail-with-the-gnbcc',
      image: 'guests-seated', showOnAnniversary: true, calendarDownload: true, startTime: '17:00', endTime: '20:00',
      publicationStatus: 'published', listing: 'public', internalNotes: '',
    },
    {
      id: 'durbar', title: 'Grand Durbar', date: '2026-10-10', dateTbc: false,
      whenLabel: 'Sat 10 Oct 2026 · 11:00 AM', place: 'Maxim Nyansa Villa, Tantra Hills, Accra',
      kind: 'Anniversary', verified: true, sample: false,
      summary: 'Reflections on ten years, a cybersecurity panel discussion, student performances, partner recognition and networking.',
      body: { kind: 'steps', title: 'Programme', steps: ['Reflections on ten years', 'Cybersecurity panel discussion', 'Student performances', 'Partner recognition', 'Networking'], note: 'Order as published by the Foundation; timings within the day are not confirmed.' },
      source: 'Foundation anniversary posts (programme as published).',
      sourceUrl: 'https://www.linkedin.com/posts/maxim-nyansa-foundation_maximnyansaat10-10yearsofimpact-creatingcareerperspectives-activity-7514283655805046784-cTfk',
      image: 'anniversary-signature-wall', showOnAnniversary: true, calendarDownload: true, startTime: '11:00', endTime: '',
      publicationStatus: 'published', listing: 'public', internalNotes: '',
    },
    {
      id: 'midpoint', title: 'Mid-bootcamp review', date: '2026-11-16', dateTbc: false,
      whenLabel: 'Mid-November 2026 · sample date', place: 'Tantra Hills, Accra',
      kind: 'Milestone', verified: false, sample: true,
      summary: 'Sample milestone — placeholder for a mid-point review.',
      body: { kind: 'placeholder', text: 'More details will be added when confirmed.' },
      source: 'Sample milestone for the development fixtures.',
      sourceUrl: '',
      image: 'presenters-yellow-room', showOnAnniversary: false, calendarDownload: true, startTime: '', endTime: '',
      publicationStatus: 'scheduled', listing: 'sample', internalNotes: 'Placeholder date. Not a confirmed milestone.',
    },
    {
      id: 'graduation', title: 'Graduation', date: '2026-12-18', dateTbc: true,
      whenLabel: 'December 2026 · date TBC', place: 'To be confirmed',
      kind: 'Milestone', verified: false, sample: false,
      summary: 'Training ends in December 2026. Graduation details are still to be confirmed.',
      body: { kind: 'placeholder', text: 'Training ends in December 2026. The graduation date, venue and format are still to be confirmed.' },
      source: 'Training ends December 2026 (verified). Event details unconfirmed.',
      sourceUrl: 'https://maximnyansa.com/',
      image: 'anniversary-group-outdoor', showOnAnniversary: false, calendarDownload: false, startTime: '', endTime: '',
      publicationStatus: 'published', listing: 'public', internalNotes: 'Do not publish a graduation date until the Foundation confirms it.',
    },
  ];
}

export function buildMilestones(): Milestone[] {
  return [
    { id: 'y2016', year: '2016', title: 'The Foundation is established', description: 'First pilots in a junior high school in Accra and with a group of 10 young IT graduates.', source: 'maximnyansa.com' },
    { id: 'y2017', year: '2017', title: 'Steady growth begins', description: 'The Foundation’s work grows steadily from 2017 onwards.', source: 'maximnyansa.com' },
    { id: 'y2018', year: '2018', title: 'Milestone to be supplied', description: 'Awaiting a confirmed highlight from the Foundation.', source: '' },
    { id: 'y2019', year: '2019', title: 'Milestone to be supplied', description: 'Awaiting a confirmed highlight from the Foundation.', source: '' },
    { id: 'y2020', year: '2020', title: 'First cybersecurity bootcamp', description: 'A pilot requested by earlier trainees, run as an intensive bootcamp at the Tantra Hills training centre with 14 trainees.', source: 'Foundation post, Jan 2020' },
    { id: 'y2021', year: '2021–25', title: 'Milestones to be supplied', description: 'Alumni year groups exist for every year to 2025. Highlights to be confirmed.', source: '' },
    { id: 'y2026', year: '2026', title: 'Ten years, and a new cohort', description: 'The 2026 Cyber Security Bootcamp begins on 5 Oct, followed by the GNBCC reception on 8 Oct and the Grand Durbar on 10 Oct.', source: 'maximnyansa.com, GNBCC' },
  ];
}

export const ABOUT: AboutContent = {
  mission: 'To create career perspectives for young people with the use of information technology.',
  vision: 'Investing in young Africans, empowering them with relevant IT skills to drive personal, market, and innovative growth.',
  values: ['Empowerment', 'Family', 'Hope', 'Quality', 'Synergy', 'Practicality', 'Humility', 'Equality'],
  address: 'Coral Avenue – Tantra Hills, Accra, Ghana',
  email: 'mninfo@maximnyansa.com',
  website: 'https://maximnyansa.com/',
  figuresPermission: false,
};

export const HOMEPAGE: HomepageContent = {
  eyebrow: '2026 Cybersecurity Bootcamp',
  headline: 'Learn.\nBuild.\n*Secure the Future.*',
  lead: 'A free, in-person cybersecurity bootcamp in Accra, from network security to incident response. Follow the 2026 cohort from its first week to graduation.',
  ctaLabel: 'Explore the bootcamp',
  ctaHref: '/bootcamp',
  theme: 'dark',
  announcement: 'Hackathon details to be confirmed — check back soon',
  showAnnouncement: false,
  footerCtaHeading: 'Help secure the next generation.',
  footerCtaHref: 'https://maximnyansa.com/get-involved/',
};

export const FOUNDATION_STATS: FoundationStat[] = [
  { id: 'schools', label: 'School projects', value: 128, suffix: '' },
  { id: 'students', label: 'Students with access to ICT labs', value: 76000, suffix: '+' },
  { id: 'graduates', label: 'Trainees graduated (all bootcamps)', value: 173, suffix: '' },
  { id: 'teachers', label: 'Teachers trained', value: 800, suffix: '+' },
];

export const DEV_USERS: DevUser[] = [
  { id: 'dev-viewer', email: 'viewer@example.test', displayName: 'Sample Viewer', initials: 'SV', hue: 190, role: 'viewer', lastActiveLabel: '3 days ago', fixture: true },
  { id: 'dev-editor', email: 'editor@example.test', displayName: 'Sample Editor', initials: 'SE', hue: 60, role: 'editor', lastActiveLabel: 'Yesterday', fixture: true },
  { id: 'dev-admin', email: 'administrator@example.test', displayName: 'Sample Administrator', initials: 'SA', hue: 140, role: 'administrator', lastActiveLabel: 'Now', fixture: true },
];

export const SETTINGS: SiteSettings = {
  siteName: '2026 Cyber Bootcamp',
  timeZone: 'Africa/Accra (GMT)',
  contactEmail: 'mninfo@maximnyansa.com',
  accent: '#88CC00',
  reduceMotion: false,
  notifications: { projects: true, consent: true, digest: false },
  foundationStats: FOUNDATION_STATS,
  publicationStatus: 'draft',
};

export const PHASES = [
  { id: 1 as const, name: 'Foundations', months: 'October', summary: 'How networks work, how they are defended, and the ethics and law of security testing.', modules: ['Network security', 'Ethical hacking'] },
  { id: 2 as const, name: 'Find & analyse', months: 'November', summary: 'Finding weaknesses before attackers do, and reading the evidence they leave behind.', modules: ['Vulnerability assessment', 'Digital forensics'] },
  { id: 3 as const, name: 'Respond & protect', months: 'December', summary: 'Handling incidents calmly and helping people around you stay safe online.', modules: ['Incident response', 'Security awareness'] },
];
