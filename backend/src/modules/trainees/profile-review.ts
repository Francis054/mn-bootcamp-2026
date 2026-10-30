export const REVIEW_STATUSES = ['draft', 'pending', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const SUBMIT_NEEDS_CONSENT = 'Agree to a public profile before you submit it for review.';
export const SUBMIT_NEEDS_CHANGES = 'Change the profile before you submit it again.';
export const ALREADY_PENDING = 'This profile is already waiting for review.';
export const APPROVE_ONLY_PENDING = 'Only a profile that is waiting for review can be approved.';
export const REJECT_ONLY_PENDING = 'Only a profile that is waiting for review can be rejected.';
export const REJECT_NEEDS_REASON = 'Enter a reason the trainee can read.';
export const REJECT_REASON_LIMIT = 'Use at most 500 characters.';

export function isReviewStatus(value: string): value is ReviewStatus {
  return (REVIEW_STATUSES as readonly string[]).includes(value);
}

/**
 * A saved edit of an approved or rejected profile becomes a draft.
 * A profile already waiting for review stays pending, so the queue shows the latest text.
 */
export function statusAfterEdit(status: ReviewStatus): ReviewStatus {
  if (status === 'pending') return 'pending';
  return 'draft';
}

export function submitForReview(
  status: ReviewStatus,
  publicProfileConsent: boolean,
): { ok: true; status: 'pending' } | { ok: false; message: string } {
  if (!publicProfileConsent) return { ok: false, message: SUBMIT_NEEDS_CONSENT };
  if (status === 'pending') return { ok: false, message: ALREADY_PENDING };
  if (status === 'approved') return { ok: false, message: SUBMIT_NEEDS_CHANGES };
  return { ok: true, status: 'pending' };
}

export function approveReview(
  status: ReviewStatus,
): { ok: true; status: 'approved' } | { ok: false; message: string } {
  if (status !== 'pending') return { ok: false, message: APPROVE_ONLY_PENDING };
  return { ok: true, status: 'approved' };
}

export function rejectReview(
  status: ReviewStatus,
  reason: string,
): { ok: true; status: 'rejected'; reason: string } | { ok: false; message: string } {
  if (status !== 'pending') return { ok: false, message: REJECT_ONLY_PENDING };
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, message: REJECT_NEEDS_REASON };
  if (trimmed.length > 500) return { ok: false, message: REJECT_REASON_LIMIT };
  return { ok: true, status: 'rejected', reason: trimmed };
}

/** The photo on the public site. Consent is separate from approval of the bytes. */
export function visiblePhotoUrl(photoUrl: string | null, photoConsent: boolean): string | null {
  if (!photoUrl || !photoConsent) return null;
  return photoUrl;
}
