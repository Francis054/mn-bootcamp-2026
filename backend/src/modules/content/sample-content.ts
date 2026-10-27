import type { PublicationStatus } from '../curriculum/publication.js';
import type { ContentId } from './content.entity.js';
import type { AboutContent, HomepageContent, Milestone, SiteSettings } from './content.types.js';

/**
 * Labelled sample copy. Counters are zeros with sample labels.
 * Real foundation-wide totals are not stored here.
 */

const SAMPLE_NOTE = 'Sample copy for the development seed.';

export interface SampleSingleton {
  id: ContentId;
  draft: object;
  publishedDocument: object | null;
  publicationStatus: PublicationStatus;
}

export function buildSampleContent(): SampleSingleton[] {
  return [
    {
      id: 'homepage',
      draft: sampleHomepage(),
      publishedDocument: null,
      publicationStatus: 'draft',
    },
    { id: 'about', draft: sampleAbout(), publishedDocument: null, publicationStatus: 'draft' },
    {
      id: 'milestones',
      draft: { milestones: sampleMilestones() },
      publishedDocument: null,
      publicationStatus: 'draft',
    },
    {
      id: 'settings',
      draft: sampleSettings(),
      publishedDocument: null,
      publicationStatus: 'draft',
    },
  ];
}

function sampleHomepage(): HomepageContent {
  return {
    eyebrow: '2026 Cybersecurity Bootcamp',
    headline: 'Learn.\nBuild.\n*Secure the Future.*',
    lead: 'A free, in-person cybersecurity bootcamp in Accra. Twelve weeks, from 5 October to 25 December 2026.',
    ctaLabel: 'Explore the bootcamp',
    ctaHref: '/bootcamp',
    theme: 'dark',
    announcement: 'Hackathon details to be confirmed — check back soon',
    showAnnouncement: false,
    footerCtaHeading: 'Help secure the next generation.',
    footerCtaHref: 'https://maximnyansa.com/get-involved/',
  };
}

function sampleAbout(): AboutContent {
  return {
    mission:
      'To create career perspectives for young people with the use of information technology.',
    vision:
      'Investing in young Africans, empowering them with relevant IT skills to drive personal, market, and innovative growth.',
    values: [
      'Empowerment',
      'Family',
      'Hope',
      'Quality',
      'Synergy',
      'Practicality',
      'Humility',
      'Equality',
    ],
    address: 'Coral Avenue – Tantra Hills, Accra, Ghana',
    email: 'mninfo@maximnyansa.com',
    website: 'https://maximnyansa.com/',
    figuresPermission: false,
  };
}

function sampleMilestones(): Milestone[] {
  return [
    {
      id: 'y2016',
      year: '2016',
      title: 'The Foundation is established',
      description: `${SAMPLE_NOTE} First pilots are recorded on the Foundation site.`,
      source: 'maximnyansa.com',
    },
    {
      id: 'y2018',
      year: '2018',
      title: 'Milestone to be supplied',
      description: 'Awaiting a confirmed highlight from the Foundation.',
      source: '',
    },
    {
      id: 'y2026',
      year: '2026',
      title: 'Ten years, and a new cohort',
      description: `${SAMPLE_NOTE} The 2026 cohort dates stay on the events list.`,
      source: 'maximnyansa.com',
    },
  ];
}

function sampleSettings(): SiteSettings {
  return {
    siteName: '2026 Cybersecurity Bootcamp',
    timeZone: 'Africa/Accra (GMT)',
    contactEmail: 'mninfo@maximnyansa.com',
    accent: '#88CC00',
    reduceMotion: false,
    notifications: { projects: true, consent: true, digest: false },
    foundationStats: [
      { id: 'schools', label: 'Sample counter — school projects', value: 0, suffix: '' },
      { id: 'students', label: 'Sample counter — students', value: 0, suffix: '' },
      { id: 'graduates', label: 'Sample counter — trainees', value: 0, suffix: '' },
      { id: 'teachers', label: 'Sample counter — teachers', value: 0, suffix: '' },
    ],
  };
}
