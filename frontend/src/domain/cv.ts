/** What a public profile may say about a CV. Never a file address. */
export interface PublicCv {
  available: boolean;
  mode: "public" | "on_request" | null;
}

export type CvVisibility = "private" | "on_request" | "public";

export interface CvDetails {
  id: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  visibility: CvVisibility;
  reviewStatus: "pending" | "approved" | "rejected";
  rejectionReason: string;
  submittedAt: string | null;
  createdAt: string;
}

export const HIDDEN_CV: PublicCv = { available: false, mode: null };

/**
 * PR 5b will offer a request when this is true.
 * This screen does not collect that request.
 */
export function cvRequestAllowed(cv: PublicCv): boolean {
  return cv.available && cv.mode === "on_request";
}

/** Keep only the two public fields. A file address in the payload is dropped. */
export function readPublicCv(value: unknown): PublicCv {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return HIDDEN_CV;
  const row = value as Record<string, unknown>;
  const mode =
    row.mode === "public" || row.mode === "on_request" ? row.mode : null;
  const available = row.available === true && mode !== null;
  return available && mode ? { available: true, mode } : HIDDEN_CV;
}

/** A same-origin download path minted by the API. Anything else is ignored. */
export function isSafeCvDownloadPath(path: string): boolean {
  return /^\/api\/v1\/public\/cv\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(path);
}
