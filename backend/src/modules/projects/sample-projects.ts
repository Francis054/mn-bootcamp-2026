import { slugify } from '../curriculum/slug.js';
import type { Listing, PublicationStatus } from '../curriculum/publication.js';
import type { ProjectType } from './project-types.js';

/**
 * Labelled sample projects. They are drafts or in review, and the linked
 * sample trainees have not agreed to share links, so nothing here is public.
 */

const ROWS: Array<{
  id: string;
  title: string;
  moduleId: string;
  type: ProjectType;
  cover: string;
  image: string;
  tools: string;
}> = [
  {
    id: '1',
    title: 'Home network hardening lab',
    moduleId: 'network',
    type: 'Lab',
    cover: 'terminal',
    image: 'hack-coding-team',
    tools: 'pfSense, Wireshark',
  },
  {
    id: '2',
    title: 'Capture-the-flag practice set',
    moduleId: 'ethical',
    type: 'CTF',
    cover: 'flag',
    image: 'electronics-lab',
    tools: 'Kali Linux',
  },
  {
    id: '3',
    title: 'Vulnerability scan of a test web app',
    moduleId: 'vuln',
    type: 'Lab',
    cover: 'scan',
    image: 'vr-demo-group',
    tools: 'Nmap, OpenVAS',
  },
  {
    id: '4',
    title: 'Forensic timeline from a disk image',
    moduleId: 'forensics',
    type: 'Case study',
    cover: 'grid',
    image: 'participant-phone',
    tools: 'Autopsy',
  },
  {
    id: '5',
    title: 'Phishing-awareness campaign for a school',
    moduleId: 'awareness',
    type: 'Community project',
    cover: 'wave',
    image: 'presenters-yellow-room',
    tools: 'Slides, survey',
  },
  {
    id: '6',
    title: 'Incident response playbook',
    moduleId: 'incident',
    type: 'Capstone',
    cover: 'shield',
    image: 'trio-google-neon',
    tools: 'Playbook template',
  },
];

export interface SampleProject {
  id: string;
  title: string;
  slug: string;
  type: ProjectType;
  moduleId: string;
  cover: string;
  image: string;
  abstract: string;
  tools: string;
  steps: string[];
  team: string[];
  traineeIds: string[];
  repositoryUrl: string;
  demoUrl: string;
  labOnlyConfirmed: boolean;
  shareAgreed: boolean;
  publicationStatus: PublicationStatus;
  listing: Listing;
  internalNotes: string;
}

export function buildSampleProjects(): SampleProject[] {
  return ROWS.map((row) => ({
    ...row,
    slug: slugify(row.title),
    abstract:
      'Placeholder: a plain-language description of the problem the team set out to solve, the lab setup, what they found and what they recommend.',
    steps: ['Scope and plan', 'Build and test', 'Report'],
    team: ['Sample Trainee 01', 'Sample Trainee 04'],
    traineeIds: ['1', '4'],
    repositoryUrl: '',
    demoUrl: '',
    labOnlyConfirmed: true,
    shareAgreed: false,
    publicationStatus: Number(row.id) < 3 ? 'in_review' : 'draft',
    listing: 'sample',
    internalNotes: 'Sample project. Not a record of trainee work.',
  }));
}
