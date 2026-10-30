import { projectUrlProblem } from '../projects/project-url.js';
import { displayNameMessage, plainTextMessage } from './trainee.rules.js';

export const LINKEDIN_LINK = 'Use a https://www.linkedin.com link.';
export const GITHUB_LINK = 'Use a https://github.com link.';

export interface ProfileText {
  displayName: string;
  headline: string;
  bio: string;
  location: string;
  linkedin: string | null;
  githubUrl: string | null;
  portfolio: string | null;
}

export interface ProfilePatch {
  displayName?: string;
  headline?: string;
  bio?: string;
  location?: string;
  linkedin?: string | null;
  githubUrl?: string | null;
  portfolio?: string | null;
}

/** Read a trainee's own profile edit. A trainee id in the body is ignored. */
export function readProfilePatch(body: unknown): {
  value: ProfilePatch;
  errors: Record<string, string>;
} {
  if (!isRecord(body)) return { value: {}, errors: { form: 'Check the highlighted fields.' } };
  const errors: Record<string, string> = {};
  const value: ProfilePatch = {};
  if ('displayName' in body) {
    const message = displayNameMessage(body.displayName);
    if (message) errors.displayName = message;
    else value.displayName = String(body.displayName).trim();
  }
  if ('headline' in body) {
    const message = shortText(body.headline, 160);
    if (message) errors.headline = message;
    else value.headline = String(body.headline).trim();
  }
  if ('bio' in body) {
    const message = plainTextMessage(body.bio, 5000);
    if (message) errors.bio = message;
    else value.bio = String(body.bio);
  }
  if ('location' in body) {
    const message = shortText(body.location, 120);
    if (message) errors.location = message;
    else value.location = String(body.location).trim();
  }
  if ('linkedin' in body) assignLink(errors, value, 'linkedin', body.linkedin, linkedinProblem);
  if ('githubUrl' in body) assignLink(errors, value, 'githubUrl', body.githubUrl, githubProblem);
  if ('portfolio' in body) assignLink(errors, value, 'portfolio', body.portfolio, portfolioProblem);
  return { value, errors };
}

export function linkedinProblem(value: string): string | undefined {
  return hostProblem(value, LINKEDIN_LINK, (host) => host === 'linkedin.com' || host.endsWith('.linkedin.com'));
}

export function githubProblem(value: string): string | undefined {
  return hostProblem(value, GITHUB_LINK, (host) => host === 'github.com' || host === 'www.github.com');
}

function portfolioProblem(value: string): string | undefined {
  return projectUrlProblem(value);
}

function hostProblem(
  value: string,
  message: string,
  allowed: (host: string) => boolean,
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return message;
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return message;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!allowed(host)) return message;
  if (trimmed.length > 500) return message;
  return undefined;
}

function assignLink(
  errors: Record<string, string>,
  value: ProfilePatch,
  key: 'linkedin' | 'githubUrl' | 'portfolio',
  raw: unknown,
  problem: (value: string) => string | undefined,
): void {
  if (raw === null) {
    value[key] = null;
    return;
  }
  if (typeof raw !== 'string') {
    errors[key] = key === 'githubUrl' ? GITHUB_LINK : key === 'linkedin' ? LINKEDIN_LINK : 'Enter a full link starting with https://.';
    return;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    value[key] = null;
    return;
  }
  const message = problem(trimmed);
  if (message) errors[key] = message;
  else value[key] = trimmed;
}

function shortText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return 'Use plain text.';
  if (value.trim().length > max) return `Use at most ${max} characters.`;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
