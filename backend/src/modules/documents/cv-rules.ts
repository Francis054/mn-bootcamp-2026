/** How a trainee offers the current CV. On request is the default. */
export const CV_VISIBILITIES = ['private', 'on_request', 'public'] as const;
export type CvVisibility = (typeof CV_VISIBILITIES)[number];

export type CvReviewStatus = 'pending' | 'approved' | 'rejected';

/** What a public profile may say. It is never a file address. */
export interface PublicCv {
  available: boolean;
  mode: 'public' | 'on_request' | null;
}

export const HIDDEN_CV: PublicCv = { available: false, mode: null };

/** Employers ask here when `cvRequestAllowed` is true. The file stays in the private bucket. */
export const CV_REQUEST_PATH = '/api/v1/public/trainees/:id/cv-request';

export function cvRequestAllowed(cv: PublicCv): boolean {
  return cv.available && cv.mode === 'on_request';
}

export function isCvVisibility(value: string): value is CvVisibility {
  return (CV_VISIBILITIES as readonly string[]).includes(value);
}

export function publicCvFrom(visibility: CvVisibility, reviewStatus: CvReviewStatus): PublicCv {
  if (reviewStatus !== 'approved') return HIDDEN_CV;
  if (visibility === 'public') return { available: true, mode: 'public' };
  if (visibility === 'on_request') return { available: true, mode: 'on_request' };
  return HIDDEN_CV;
}

/** Public is the wider grant. On request does not publish the file. Private grants neither. */
export function consentGrants(visibility: CvVisibility): {
  cv_public: boolean;
  cv_on_request: boolean;
} {
  if (visibility === 'public') return { cv_public: true, cv_on_request: true };
  if (visibility === 'on_request') return { cv_public: false, cv_on_request: true };
  return { cv_public: false, cv_on_request: false };
}

export function safeCvFileName(raw: string): string {
  const base = raw.split(/[/\\]/).pop() ?? '';
  const cleaned = base
    .replace(/[^\w. -]/g, '')
    .trim()
    .slice(0, 180);
  if (!cleaned) return 'cv.pdf';
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
}

/** `attachment` only. The name is a short ASCII fallback so the header cannot change the disposition. */
export function attachmentDisposition(fileName: string): string {
  const cleaned = fileName.replace(/[^A-Za-z0-9._-]/g, '') || 'cv.pdf';
  const withExt = cleaned.toLowerCase().endsWith('.pdf') ? cleaned : 'cv.pdf';
  return `attachment; filename="${withExt.slice(0, 80)}"`;
}

export function readVisibilityBody(body: unknown): { value?: CvVisibility; error?: string } {
  if (!isRecord(body) || !('visibility' in body))
    return { error: 'Choose private, on request, or public.' };
  if (typeof body.visibility !== 'string' || !isCvVisibility(body.visibility)) {
    return { error: 'Choose private, on request, or public.' };
  }
  return { value: body.visibility };
}

export function readRejectionReason(body: unknown): { value?: string; error?: string } {
  if (!isRecord(body) || typeof body.reason !== 'string')
    return { error: 'Add a reason the trainee can read.' };
  const reason = body.reason.trim();
  if (!reason) return { error: 'Add a reason the trainee can read.' };
  if (reason.length > 500) return { error: 'Keep the reason to 500 characters.' };
  return { value: reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
