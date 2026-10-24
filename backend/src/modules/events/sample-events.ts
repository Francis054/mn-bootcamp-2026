import type { Listing, PublicationStatus } from '../curriculum/publication.js';
import type { EventBody, EventKind } from './event-types.js';

/**
 * Labelled sample events. The hackathon stays to be confirmed: no clock time
 * and no venue. The midpoint is a sample milestone and stays scheduled.
 */

const NOTE = 'Sample event.';

interface SampleEvent {
  id: string;
  title: string;
  date: string;
  dateTbc: boolean;
  whenLabel: string;
  place: string;
  kind: EventKind;
  verified: boolean;
  sample: boolean;
  summary: string;
  body: EventBody;
  source: string;
  sourceUrl: string;
  image: string;
  showOnAnniversary: boolean;
  calendarDownload: boolean;
  startTime: string;
  endTime: string;
  publicationStatus: PublicationStatus;
  listing: Listing;
  internalNotes: string;
}

export function buildSampleEvents(): SampleEvent[] {
  return [
    {
      id: 'start',
      title: 'Bootcamp training starts',
      date: '2026-10-05',
      dateTbc: false,
      whenLabel: 'Mon 5 Oct 2026',
      place: 'Maxim Nyansa Foundation premises, Tantra Hills, Accra',
      kind: 'Milestone',
      verified: true,
      sample: false,
      summary: 'The free, in-person 2026 Cyber Security Bootcamp begins.',
      body: {
        kind: 'callout',
        tone: 'lime',
        title: 'Day one',
        text: 'Training began at the Maxim Nyansa Foundation premises in Tantra Hills, Accra. The bootcamp is free and in person.',
      },
      source: 'Bootcamp 2026 announcement. Sample event, labelled from the website fixtures.',
      sourceUrl:
        'https://www.linkedin.com/posts/maxim-nyansa-foundation_applications-are-open-for-the-maxim-nyansa-activity-7496108200585404418-jX54',
      image: 'electronics-lab',
      showOnAnniversary: false,
      calendarDownload: true,
      startTime: '',
      endTime: '',
      publicationStatus: 'published',
      listing: 'public',
      internalNotes: NOTE,
    },
    {
      id: 'hackathon',
      title: 'AI for Impact hackathon',
      date: '2026-10-07',
      dateTbc: true,
      whenLabel: 'October 2026 · date TBC',
      place: 'Venue to be confirmed',
      kind: 'Partner event',
      verified: false,
      sample: false,
      summary:
        'A hackathon co-organised with STEMAIDE Africa. Whether bootcamp trainees took part is still to be confirmed.',
      body: {
        kind: 'callout',
        tone: 'warn',
        title: 'Details to be confirmed',
        text: 'The date, venue, results, and whether bootcamp trainees took part are not confirmed. This page stays a placeholder. Do not invent those details.',
      },
      source: 'Title only. Date, venue, and bootcamp involvement are unconfirmed. Sample event.',
      sourceUrl: '',
      image: 'hack-group-google-wall',
      showOnAnniversary: true,
      calendarDownload: false,
      startTime: '',
      endTime: '',
      publicationStatus: 'published',
      listing: 'public',
      internalNotes: `${NOTE} Confirm date, venue, and whether bootcamp trainees took part. Do not invent those details.`,
    },
    {
      id: 'reception',
      title: '10th anniversary reception with GNBCC',
      date: '2026-10-08',
      dateTbc: false,
      whenLabel: 'Thu 8 Oct 2026 · 5–8 PM',
      place: 'GNBCC, Cantonments, Accra',
      kind: 'Anniversary',
      verified: true,
      sample: false,
      summary:
        'An anniversary cocktail reception with the Ghana Netherlands Business & Culture Council.',
      body: {
        kind: 'callout',
        tone: 'plain',
        title: 'Hosted with GNBCC',
        text: 'An anniversary cocktail reception, 5–8 PM at GNBCC in Cantonments, Accra.',
      },
      source: 'GNBCC event listing. Sample event, labelled from the website fixtures.',
      sourceUrl:
        'https://gnbcc.net/news/maxim-nyansa-foundation-marks-10-years-with-anniversary-cocktail-with-the-gnbcc',
      image: 'guests-seated',
      showOnAnniversary: true,
      calendarDownload: true,
      startTime: '17:00',
      endTime: '20:00',
      publicationStatus: 'published',
      listing: 'public',
      internalNotes: NOTE,
    },
    {
      id: 'durbar',
      title: 'Grand Durbar',
      date: '2026-10-10',
      dateTbc: false,
      whenLabel: 'Sat 10 Oct 2026 · 11:00 AM',
      place: 'Maxim Nyansa Villa, Tantra Hills, Accra',
      kind: 'Anniversary',
      verified: true,
      sample: false,
      summary:
        'Reflections on ten years, a cybersecurity panel discussion, student performances, partner recognition and networking.',
      body: {
        kind: 'steps',
        title: 'Programme',
        steps: [
          'Reflections on ten years',
          'Cybersecurity panel discussion',
          'Student performances',
          'Partner recognition',
          'Networking',
        ],
        note: 'Order as published. Timings within the day are not confirmed.',
      },
      source: 'Foundation anniversary posts. Sample event, labelled from the website fixtures.',
      sourceUrl:
        'https://www.linkedin.com/posts/maxim-nyansa-foundation_maximnyansaat10-10yearsofimpact-creatingcareerperspectives-activity-7514283655805046784-cTfk',
      image: 'anniversary-signature-wall',
      showOnAnniversary: true,
      calendarDownload: true,
      startTime: '11:00',
      endTime: '',
      publicationStatus: 'published',
      listing: 'public',
      internalNotes: NOTE,
    },
    {
      id: 'midpoint',
      title: 'Mid-bootcamp review',
      date: '2026-11-16',
      dateTbc: false,
      whenLabel: 'Mid-November 2026 · sample date',
      place: 'Tantra Hills, Accra',
      kind: 'Milestone',
      verified: false,
      sample: true,
      summary: 'Sample milestone. Placeholder for a mid-point review.',
      body: { kind: 'placeholder', text: 'More details will be added when confirmed.' },
      source: 'Sample milestone for the labelled seed.',
      sourceUrl: '',
      image: 'presenters-yellow-room',
      showOnAnniversary: false,
      calendarDownload: true,
      startTime: '',
      endTime: '',
      publicationStatus: 'scheduled',
      listing: 'sample',
      internalNotes: `${NOTE} Placeholder date. Not a confirmed milestone.`,
    },
    {
      id: 'graduation',
      title: 'Graduation',
      date: '2026-12-18',
      dateTbc: true,
      whenLabel: 'December 2026 · date TBC',
      place: 'To be confirmed',
      kind: 'Milestone',
      verified: false,
      sample: false,
      summary: 'Training ends in December 2026. Graduation details are still to be confirmed.',
      body: {
        kind: 'placeholder',
        text: 'Training ends in December 2026. The graduation date, venue, and format are still to be confirmed.',
      },
      source: 'Training ends December 2026. Event details unconfirmed. Sample event.',
      sourceUrl: 'https://maximnyansa.com/',
      image: 'anniversary-group-outdoor',
      showOnAnniversary: false,
      calendarDownload: false,
      startTime: '',
      endTime: '',
      publicationStatus: 'published',
      listing: 'public',
      internalNotes: `${NOTE} Do not publish a graduation date until it is confirmed.`,
    },
  ];
}
