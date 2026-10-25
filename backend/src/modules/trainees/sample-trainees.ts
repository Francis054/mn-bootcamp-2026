import type { Listing, PublicationStatus } from '../curriculum/publication.js';
import type { TraineeTrack } from './tracks.js';

/**
 * Labelled sample profiles for local development. These are not real people.
 * Consent is false, so the public site does not show them even though the
 * workflow says published. The third track uses the approved spelling.
 */

const FOCUS = ['network', 'ethical', 'vuln', 'forensics', 'awareness', 'incident'] as const;
const HUES = [140, 95, 170, 60, 120, 190, 80, 150, 30, 110, 200, 160];
const SKILLS = [
  ['Linux', 'Wireshark', 'Firewalls'],
  ['Kali Linux', 'Python', 'OWASP Top 10'],
  ['Nmap', 'OpenVAS', 'Risk reports'],
  ['Autopsy', 'Chain of custody', 'Log analysis'],
  ['Phishing drills', 'Policy writing', 'Training design'],
  ['SIEM basics', 'Playbooks', 'Triage'],
];

export interface SampleTrainee {
  id: string;
  displayName: string;
  initials: string;
  hue: number;
  email: string;
  track: TraineeTrack;
  focus: string;
  skills: string[];
  bio: string;
  quote: string;
  linkedin: string | null;
  portfolio: string | null;
  consentReceived: boolean;
  consentReceivedAt: null;
  consentRecordedBy: null;
  consentWithdrawnAt: null;
  linksShareConsent: boolean;
  linksShareConsentAt: null;
  linksShareConsentRecordedBy: null;
  linksShareConsentWithdrawnAt: null;
  listing: Listing;
  publicationStatus: PublicationStatus;
  statusLabel: string;
  internalNotes: string;
}

export function buildSampleTrainees(): SampleTrainee[] {
  return Array.from({ length: 12 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    const track = trackFor(index);
    const focus = FOCUS[index % FOCUS.length] ?? 'network';
    const skills = SKILLS[index % SKILLS.length] ?? [];
    const hue = HUES[index] ?? 140;
    return {
      id: String(index + 1),
      displayName: `Sample Trainee ${number}`,
      initials: `T${index + 1}`,
      hue,
      email: `trainee${number}@example.test`,
      track,
      focus,
      skills: [...skills],
      bio: 'Placeholder: why they joined the bootcamp, what they want to do next and what they are proudest of so far. No biography is shown until the trainee writes and approves it.',
      quote: 'Sample quote — the trainee’s own words go here.',
      linkedin: null,
      portfolio: null,
      consentReceived: false,
      consentReceivedAt: null,
      consentRecordedBy: null,
      consentWithdrawnAt: null,
      linksShareConsent: false,
      linksShareConsentAt: null,
      linksShareConsentRecordedBy: null,
      linksShareConsentWithdrawnAt: null,
      listing: 'sample',
      publicationStatus: 'published',
      statusLabel: 'In training',
      internalNotes:
        'Development fixture. Do not replace with a real person without written consent.',
    };
  });
}

function trackFor(index: number): TraineeTrack {
  if (index % 3 === 1) return 'Red team';
  if (index % 3 === 2) return 'GRC & Awareness';
  return 'Blue team';
}
