/**
 * Client checks for admin forms. The sentences match the API so a blocked
 * Save and a 422 response point at the same field with the same words.
 */

export type CheckMode = 'save' | 'publish';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const HTTP_URL = /^https?:\/\/\S+\.\S+/;
const CLASS_TITLE = 'Give the class a title.';
const CLASS_SUMMARY = 'Write a short summary for the class card.';
const EVENT_SOURCE = 'Enter a full link starting with https://';
const PROJECT_LINK = 'Enter a full link starting with https://.';
const CONSENT = 'Consent is required before this profile can be published.';
const SITE_LINK = 'Enter a link or a site path.';

export function classFieldErrors(
  input: {
    title: string;
    moduleId: string;
    week: string;
    date: string;
    summary: string;
  },
  _mode: CheckMode = 'save',
): Record<string, string> {
  void _mode;
  const errors: Record<string, string> = {};
  assign(errors, 'title', bounded(input.title, CLASS_TITLE, 6, 200));
  if (!input.moduleId.trim() || input.moduleId.trim().length > 40) errors.moduleId = 'Choose a module.';
  const week = Number(input.week);
  if (!Number.isInteger(week) || week < 1 || week > 18) errors.week = 'Enter a week from 1 to 18.';
  assign(errors, 'date', calendarDate(input.date, true));
  assign(errors, 'summary', bounded(input.summary, CLASS_SUMMARY, 20, 2000));
  return errors;
}

export function traineeFieldErrors(
  input: {
    displayName: string;
    email: string;
    track: string;
    focus: string;
    linkedin: string;
    portfolio: string;
    headline?: string;
    location?: string;
    github?: string;
    consentReceived: boolean;
    publicationStatus: string;
  },
  mode: CheckMode,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.displayName.trim()) errors.displayName = 'Enter a display name.';
  else if (input.displayName.trim().length > 120) errors.displayName = 'Use at most 120 characters.';
  assign(errors, 'email', emailProblem(input.email, true));
  if (!['Blue team', 'Red team', 'GRC & Awareness'].includes(input.track)) {
    errors.track = 'Choose Blue team, Red team, or GRC & Awareness.';
  }
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(input.focus.trim())) errors.focus = 'Choose a module.';
  assign(errors, 'linkedin', optionalHttp(input.linkedin));
  assign(errors, 'portfolio', optionalHttp(input.portfolio));
  assign(errors, 'githubUrl', optionalHttp(input.github ?? ''));
  if ((input.headline ?? '').trim().length > 160) errors.headline = 'Use at most 160 characters.';
  if ((input.location ?? '').trim().length > 120) errors.location = 'Use at most 120 characters.';
  const publishing = mode === 'publish' || input.publicationStatus === 'published';
  if (publishing && !input.consentReceived) {
    errors.consentReceived = CONSENT;
    errors.publicationStatus = CONSENT;
  }
  return errors;
}

/** A consent refusal from the API is shown on the checkbox as well as the workflow. */
export function withConsentField(errors: Record<string, string>): Record<string, string> {
  const message = errors.publicationStatus;
  if (message?.startsWith('Consent') && !errors.consentReceived) {
    return { ...errors, consentReceived: message };
  }
  return errors;
}

export function projectFieldErrors(input: {
  title: string;
  type: string;
  moduleId: string;
  abstract: string;
  repositoryUrl: string;
  demoUrl: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  assign(errors, 'title', bounded(input.title, 'Give the project a title.', 6, 200));
  if (!['Lab', 'CTF', 'Case study', 'Community project', 'Capstone'].includes(input.type)) {
    errors.type = 'Choose a type.';
  }
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(input.moduleId.trim())) errors.moduleId = 'Choose a module.';
  assign(errors, 'abstract', bounded(input.abstract, 'Write an abstract of at least 30 characters.', 30, 5000));
  assign(errors, 'repositoryUrl', httpsLink(input.repositoryUrl, PROJECT_LINK));
  assign(errors, 'demoUrl', httpsLink(input.demoUrl, PROJECT_LINK));
  return errors;
}

export function eventFieldErrors(input: {
  title: string;
  place: string;
  summary: string;
  date: string;
  dateTbc: boolean;
  startTime: string;
  endTime: string;
  verified: boolean;
  sourceUrl: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.title.trim()) errors.title = 'Give the event a name.';
  else if (input.title.trim().length > 200) errors.title = 'Use at most 200 characters.';
  if (!input.place.trim()) errors.place = 'Enter a venue, or “Venue to be confirmed”.';
  assign(errors, 'summary', bounded(input.summary, 'Write a summary of at least 20 characters.', 20, 5000));
  if (!input.dateTbc && !input.date.trim()) errors.date = 'Pick a date.';
  else if (input.date.trim()) assign(errors, 'date', calendarDate(input.date, false));
  if (input.dateTbc && (input.startTime.trim() || input.endTime.trim())) {
    errors.startTime = 'Leave the times blank while the date is to be confirmed.';
  } else {
    assign(errors, 'startTime', clock(input.startTime));
    assign(errors, 'endTime', clock(input.endTime));
  }
  if (input.verified) {
    if (!input.sourceUrl.trim()) errors.sourceUrl = EVENT_SOURCE;
    else assign(errors, 'sourceUrl', httpsLink(input.sourceUrl, EVENT_SOURCE));
  } else {
    assign(errors, 'sourceUrl', httpsLink(input.sourceUrl, EVENT_SOURCE));
  }
  return errors;
}

export function homeFieldErrors(input: { ctaHref: string; footerCtaHref: string; theme: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  assign(errors, 'ctaHref', siteLink(input.ctaHref));
  assign(errors, 'footerCtaHref', siteLink(input.footerCtaHref));
  if (input.theme !== 'dark' && input.theme !== 'light') errors.theme = 'Choose a theme.';
  return errors;
}

export function aboutFieldErrors(input: { email: string; website: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  assign(errors, 'email', emailProblem(input.email, false));
  assign(errors, 'website', siteLink(input.website));
  return errors;
}

export function milestoneFieldErrors(rows: Array<{ year: string; title: string }>): Record<string, string> {
  if (rows.some((row) => !row.year.trim() || !row.title.trim())) {
    return { milestones: 'Check each milestone. Year and title are required.' };
  }
  return {};
}

export function mediaFieldErrors(input: { alt: string }, mode: CheckMode, consent: { verified: boolean; withdrawn: boolean; confirmed: boolean }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.alt.trim()) errors.alt = 'Describe the image without naming anyone.';
  else if (input.alt.trim().length > 300) errors.alt = 'Use at most 300 characters.';
  if (mode === 'publish') {
    if (consent.withdrawn) errors.consent = 'Consent was withdrawn. This photo cannot be published.';
    else if (!consent.verified && !consent.confirmed) errors.consent = 'Verify consent before this photo can be published.';
  }
  return errors;
}

export function inviteFieldErrors(input: { email: string; role: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  assign(errors, 'invite', emailProblem(input.email, true));
  if (!input.role) errors['invite-role'] = 'Choose viewer, editor, trainer, trainee, or administrator.';
  return errors;
}

export function settingsFieldErrors(input: {
  siteName: string;
  contactEmail: string;
  accent: string;
  stats: Array<{ id: string; label: string; value: number; suffix: string }>;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.siteName.trim()) errors.siteName = 'Enter a site name.';
  assign(errors, 'contactEmail', emailProblem(input.contactEmail, true));
  if (!/^#[0-9A-Fa-f]{6}$/.test(input.accent.trim())) errors.accent = 'Use a colour like #88CC00.';
  const stat = input.stats.find((row) => !row.label.trim() || !Number.isInteger(row.value) || row.value < 0 || row.suffix.length > 8);
  if (stat) errors[`stat-label-${stat.id}`] = 'Check each counter. Use a label and a whole number from zero.';
  return errors;
}

export function passwordFieldErrors(input: { current: string; next: string; confirm: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.current) errors.current = 'Enter your current password.';
  if (!input.next) errors.next = 'Choose a new password.';
  else if (input.next.length < 12) errors.next = 'Use at least 12 characters.';
  else if (!/[A-Za-z]/.test(input.next) || !/[0-9]/.test(input.next)) {
    errors.next = 'Use at least one letter and one number.';
  }
  if (input.next !== input.confirm) errors.confirm = 'The two passwords do not match.';
  return errors;
}

/** Show a phase failure on the week field, which is the control the editor sees. */
export function withPhaseOnWeek(errors: Record<string, string>): Record<string, string> {
  if (errors.phase && !errors.week) return { ...errors, week: errors.phase };
  return errors;
}

function bounded(value: string, empty: string, min: number, max: number): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return empty;
  if (trimmed.length < min) return 'Use at least ' + String(min) + ' characters.';
  if (trimmed.length > max) return 'Use at most ' + String(max) + ' characters.';
  return undefined;
}

function calendarDate(value: string, required: boolean): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return required ? 'Pick a date.' : undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return 'Pick a date.';
  const [year, month, day] = trimmed.split('-').map((part) => Number(part));
  if (!year || !month || !day) return 'Pick a date.';
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    return 'Pick a date.';
  }
  return undefined;
}

function clock(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const match = /^(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) return 'Use 24-hour time, like 17:00.';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return 'Use 24-hour time, like 17:00.';
  return undefined;
}

function emailProblem(value: string, required: boolean): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return required ? 'Enter your email address.' : undefined;
  if (trimmed.length > 320 || !EMAIL.test(trimmed)) return 'Enter a valid email address, like name@example.com.';
  return undefined;
}

function optionalHttp(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 500 || !HTTP_URL.test(trimmed)) return EVENT_SOURCE;
  return undefined;
}

function httpsLink(value: string, message: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' || url.username || url.password) return message;
  } catch {
    return message;
  }
  return undefined;
}

function siteLink(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return SITE_LINK;
  if (trimmed.startsWith('/') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) return undefined;
  return SITE_LINK;
}

function assign(errors: Record<string, string>, key: string, message: string | undefined): void {
  if (message) errors[key] = message;
}
