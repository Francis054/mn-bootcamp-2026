export const CONSENT_POLICY_VERSION = '2026-10-28';

export const CONSENT_WORDING = {
  publicProfile:
    'I agree that my name, headline, short bio, location, and links may appear on the public bootcamp site after an administrator approves them.',
  publicPhoto:
    'I agree that my profile photo may appear on the public bootcamp site after an administrator approves it.',
  contactRelay:
    'I agree that employers may contact me through the bootcamp site. My email address stays hidden.',
} as const;

export type ReviewStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface ProfileFields {
  displayName: string;
  headline: string;
  bio: string;
  location: string;
  linkedin: string | null;
  githubUrl: string | null;
  portfolio: string | null;
  photoUrl: string | null;
}

export interface PortalProfile {
  traineeId: string;
  email: string;
  status: ReviewStatus;
  rejectionReason: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  draft: ProfileFields;
  live: ProfileFields;
  consents: { publicProfile: boolean; publicPhoto: boolean; contactRelay: boolean };
  policyVersion: string;
  wording: typeof CONSENT_WORDING;
}

export function linkedinProblem(value: string): string | null {
  return hostProblem(value, 'Use a https://www.linkedin.com link.', (host) => host === 'linkedin.com' || host.endsWith('.linkedin.com'));
}

export function githubProblem(value: string): string | null {
  return hostProblem(value, 'Use a https://github.com link.', (host) => host === 'github.com' || host === 'www.github.com');
}

function hostProblem(value: string, message: string, allowed: (host: string) => boolean): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password || !allowed(host) || trimmed.length > 500) return message;
    return null;
  } catch {
    return message;
  }
}
