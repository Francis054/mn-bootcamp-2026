import { ApiError } from "@/domain/types";
import { can } from "@/domain/permissions";
import {
  HIDDEN_CV,
  type CvDetails,
  type CvVisibility,
  type PublicCv,
} from "@/domain/cv";
import { newId } from "@/domain/format";
import { readFileBytes } from "@/domain/photo";
import { clearSession, readActiveSession } from "./session";
import { getState } from "./store";

interface StoredCv extends CvDetails {
  traineeId: string;
  bytes: Uint8Array;
}

const files = new Map<string, StoredCv>();

export function resetCvDev(): void {
  files.clear();
}

export function publicCvFor(traineeId: string): PublicCv {
  const row = current(traineeId);
  if (!row || row.reviewStatus !== "approved") return HIDDEN_CV;
  if (row.visibility === "public") return { available: true, mode: "public" };
  if (row.visibility === "on_request")
    return { available: true, mode: "on_request" };
  return HIDDEN_CV;
}

export async function cvRoute(
  method: string,
  path: string,
  raw: unknown,
): Promise<unknown | undefined> {
  if (!isCvPath(path)) return undefined;
  if (path === "/portal/cv" && method === "GET") return { cv: present(own()) };
  if (path === "/portal/cv" && method === "POST")
    return upload(await fileOf(raw), visibilityOf(raw), "self");
  if (path === "/portal/cv" && method === "PATCH")
    return setVisibility(ownRequired().id, visibilityBody(raw), "self");
  if (path === "/portal/cv" && method === "DELETE")
    return remove(ownRequired().id);
  if (path === "/portal/cv/file" && method === "GET") {
    ownRequired();
    fail("not_found", "This preview cannot download the file.", 404);
  }
  if (path === "/admin/review-queue/cvs" && method === "GET") {
    requireStaff(false);
    return [...files.values()]
      .filter((row) => row.reviewStatus === "pending")
      .map(queueItem);
  }
  const review = /^\/admin\/review-queue\/cvs\/([^/]+)\/(approve|reject)$/.exec(
    path,
  );
  if (review && method === "POST")
    return reviewCv(decodeURIComponent(review[1] ?? ""), review[2] ?? "", raw);
  const admin = /^\/admin\/trainees\/([^/]+)\/cv$/.exec(path);
  if (admin) return adminCv(method, decodeURIComponent(admin[1] ?? ""), raw);
  const link = /^\/public\/trainees\/([^/]+)\/cv-link$/.exec(path);
  if (link && method === "POST") {
    const offered = publicCvFor(decodeURIComponent(link[1] ?? ""));
    if (offered.mode !== "public")
      fail("not_found", "That CV is not available.", 404);
    return {
      path: "/api/v1/public/cv/preview.token",
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    };
  }
  return undefined;
}

function isCvPath(path: string): boolean {
  return (
    /\/cv(\/|$)/.test(path) ||
    path.includes("/cv-link") ||
    path.includes("/review-queue/cvs")
  );
}

function upload(
  file: { name: string; bytes: Uint8Array } | null,
  visibility: CvVisibility,
  source: "self" | "admin",
  traineeId?: string,
): CvDetails {
  if (source === "self") requireWrite();
  else requireAdministrator();
  const trainee = traineeId ?? ownRequired().id;
  if (!file)
    fail("validation", "Check the highlighted fields.", 422, {
      file: "Choose a PDF file.",
    });
  if (file.bytes.length > 5 * 1024 * 1024)
    fail("validation", "Check the highlighted fields.", 422, {
      file: "A CV must be 5 MB or smaller.",
    });
  if (
    file.bytes.length < 5 ||
    String.fromCharCode(...file.bytes.subarray(0, 5)) !== "%PDF-"
  ) {
    fail("validation", "Check the highlighted fields.", 422, {
      file: "Choose a PDF file.",
    });
  }
  const text = new TextDecoder("latin1").decode(file.bytes);
  if (
    /\/(?:JavaScript|JS|Launch|OpenAction|EmbeddedFile|AA)(?![A-Za-z0-9])/.test(
      text,
    )
  ) {
    fail("validation", "Check the highlighted fields.", 422, {
      file: "This PDF is not allowed because it contains active content.",
    });
  }
  const existing = current(trainee);
  const row: StoredCv = {
    id: existing?.id ?? newId("cv"),
    traineeId: trainee,
    fileName: file.name.toLowerCase().endsWith(".pdf") ? file.name : "cv.pdf",
    sizeBytes: file.bytes.length,
    sha256: "preview",
    visibility,
    reviewStatus: "pending",
    rejectionReason: "",
    submittedAt: new Date().toISOString(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    bytes: file.bytes,
  };
  if (existing) files.delete(existing.id);
  files.set(row.id, row);
  return present(row) as CvDetails;
}

function setVisibility(
  traineeId: string,
  visibility: CvVisibility,
  source: "self" | "admin",
): CvDetails {
  if (source === "self") requireWrite();
  const row = current(traineeId);
  if (!row) fail("not_found", "There is no CV to update.", 404);
  row.visibility = visibility;
  return present(row) as CvDetails;
}

function remove(traineeId: string): { removed: true } {
  const row = current(traineeId);
  if (!row) fail("not_found", "There is no CV to remove.", 404);
  files.delete(row.id);
  return { removed: true };
}

function reviewCv(id: string, action: string, raw: unknown): CvDetails {
  requireStaff(true);
  const row = files.get(id);
  if (!row || row.reviewStatus !== "pending")
    fail("not_found", "That CV is not waiting for review.", 404);
  if (action === "approve") {
    row.reviewStatus = "approved";
    row.rejectionReason = "";
    return present(row) as CvDetails;
  }
  const reason = record(raw).reason;
  if (typeof reason !== "string" || !reason.trim())
    fail("validation", "Check the highlighted fields.", 422, {
      reason: "Add a reason the trainee can read.",
    });
  row.reviewStatus = "rejected";
  row.rejectionReason = reason.trim();
  return present(row) as CvDetails;
}

async function adminCv(
  method: string,
  traineeId: string,
  raw: unknown,
): Promise<unknown> {
  if (!getState().trainees.some((item) => item.id === traineeId))
    fail("not_found", "That trainee was not found.", 404);
  if (method === "GET") {
    requireStaff(false);
    return { cv: present(current(traineeId)) };
  }
  if (method === "POST")
    return upload(await fileOf(raw), visibilityOf(raw), "admin", traineeId);
  if (method === "DELETE") {
    requireAdministrator();
    return remove(traineeId);
  }
  return undefined;
}

function current(traineeId: string): StoredCv | null {
  return [...files.values()].find((row) => row.traineeId === traineeId) ?? null;
}

function present(row: StoredCv | null): CvDetails | null {
  if (!row) return null;
  return {
    id: row.id,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    visibility: row.visibility,
    reviewStatus: row.reviewStatus,
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
  };
}

function queueItem(row: StoredCv) {
  const trainee = getState().trainees.find((item) => item.id === row.traineeId);
  return {
    ...present(row),
    traineeId: row.traineeId,
    traineeName: trainee?.displayName ?? "Trainee",
  };
}

function own(): StoredCv | null {
  return current(ownRequired().id);
}

function ownRequired() {
  const session = readActiveSession();
  if (!session) fail("unauthenticated", "Sign in to continue.", 401);
  const user = getState().users.find((item) => item.id === session.user.id);
  if (!user) {
    clearSession();
    fail(
      "unauthenticated",
      "This development session is no longer valid.",
      401,
    );
  }
  if (!can(user.role, "portal.access"))
    fail("forbidden", "You do not have access to that.", 403);
  const trainee = getState().trainees.find(
    (item) => item.id === user.traineeId,
  );
  if (!trainee)
    fail("not_found", "Your login is not linked to a trainee record yet.", 404);
  return trainee;
}

function requireWrite(): void {
  const trainee = ownRequired();
  const session = readActiveSession();
  const user = getState().users.find((item) => item.id === session?.user.id);
  if (!user || !can(user.role, "portal.write"))
    fail("forbidden", "You do not have access to that.", 403);
  void trainee;
}

function requireStaff(write: boolean): void {
  const session = readActiveSession();
  if (!session) fail("unauthenticated", "Sign in to continue.", 401);
  const user = getState().users.find((item) => item.id === session.user.id);
  if (!user)
    fail(
      "unauthenticated",
      "This development session is no longer valid.",
      401,
    );
  if (!can(user.role, write ? "content.write" : "content.read"))
    fail("forbidden", "You do not have access to that.", 403);
}

function requireAdministrator(): void {
  const session = readActiveSession();
  if (!session) fail("unauthenticated", "Sign in to continue.", 401);
  const user = getState().users.find((item) => item.id === session.user.id);
  if (!user || user.role !== "administrator")
    fail("forbidden", "You do not have access to that.", 403);
}

async function fileOf(
  raw: unknown,
): Promise<{ name: string; bytes: Uint8Array } | null> {
  if (typeof FormData === "undefined" || !(raw instanceof FormData))
    return null;
  const item = raw.get("file");
  if (typeof File === "undefined" || !(item instanceof File) || item.size === 0)
    return null;
  return { name: item.name || "cv.pdf", bytes: await readFileBytes(item) };
}

function visibilityOf(raw: unknown): CvVisibility {
  if (typeof FormData !== "undefined" && raw instanceof FormData) {
    const value = raw.get("visibility");
    if (value === "private" || value === "on_request" || value === "public")
      return value;
  }
  return "on_request";
}

function visibilityBody(raw: unknown): CvVisibility {
  const value = record(raw).visibility;
  if (value === "private" || value === "on_request" || value === "public")
    return value;
  fail("validation", "Check the highlighted fields.", 422, {
    visibility: "Choose private, on request, or public.",
  });
}

function record(value: unknown): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(typeof FormData !== "undefined" && value instanceof FormData)
  ) {
    return value as Record<string, unknown>;
  }
  return {};
}

function fail(
  code: "validation" | "unauthenticated" | "forbidden" | "not_found",
  message: string,
  status: number,
  fieldErrors?: Record<string, string>,
): never {
  throw new ApiError(code, message, status, fieldErrors);
}
