import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { currentEnv } from "@/config/runtime";
import { Field } from "@/components/controls";
import { useToast } from "@/components/feedback";
import { useAsync } from "@/hooks/useAsync";
import type { CvDetails } from "@/domain/cv";
import { isApiError } from "@/domain/types";

interface QueueItem extends CvDetails {
  traineeId: string;
  traineeName: string;
}

export function TraineeCvPanel({ traineeId }: { traineeId: string }) {
  const auth = useAuth();
  const toast = useToast();
  const administrator = auth.role === "administrator";
  const [nonce, setNonce] = useState(0);
  const [pending, setPending] = useState(false);
  const record = useAsync(`trainee-cv:${traineeId}:${nonce}`, () =>
    api<{ cv: CvDetails | null }>({
      method: "GET",
      path: `/admin/trainees/${traineeId}/cv`,
    }),
  );
  const cv = record.data?.cv ?? null;

  const replace = async (file: File | undefined) => {
    if (!file || !administrator) return;
    const body = new FormData();
    body.set("file", file);
    body.set("visibility", cv?.visibility ?? "on_request");
    setPending(true);
    try {
      await api({
        method: "POST",
        path: `/admin/trainees/${traineeId}/cv`,
        body,
      });
      toast(
        "CV replaced",
        "The previous file was deleted. The new one waits for review.",
        "success",
      );
      setNonce((value) => value + 1);
    } catch (error) {
      toast(
        "Could not replace",
        isApiError(error) ? error.message : "Request failed.",
        "error",
      );
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!administrator) return;
    setPending(true);
    try {
      await api({ method: "DELETE", path: `/admin/trainees/${traineeId}/cv` });
      toast("CV removed", "The file has been deleted.", "success");
      setNonce((value) => value + 1);
    } catch (error) {
      toast(
        "Could not remove",
        isApiError(error) ? error.message : "Request failed.",
        "error",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="portal-card" style={{ marginTop: 24 }}>
      <h2>CV</h2>
      {record.loading ? <p role="status">Loading the CV.</p> : null}
      {record.error ? <p role="alert">{record.error.message}</p> : null}
      {!record.loading && !cv ? (
        <p>This trainee has not uploaded a CV.</p>
      ) : null}
      {cv ? <CvSummary cv={cv} /> : null}
      <div className="portal-actions">
        {administrator && cv ? (
          <button
            className="btn btn--sm"
            type="button"
            onClick={() => downloadAdmin(traineeId, toast)}
          >
            Download CV
          </button>
        ) : null}
        {administrator ? (
          <Field
            id={`admin-cv-${traineeId}`}
            label={cv ? "Replace the PDF" : "Upload a PDF"}
            required={false}
          >
            <input
              className="input"
              id={`admin-cv-${traineeId}`}
              type="file"
              accept="application/pdf,.pdf"
              disabled={pending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void replace(file);
              }}
            />
          </Field>
        ) : (
          <p className="muted">
            Editors can approve a CV. Only an administrator can download,
            replace, or remove it.
          </p>
        )}
        {administrator && cv ? (
          <button
            className="btn btn--sm"
            type="button"
            disabled={pending}
            onClick={() => void remove()}
          >
            Remove CV
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function CvReviewList({
  rows,
  writable,
  administrator,
  busy,
  reasons,
  setReasons,
  onApprove,
  onReject,
  onRemove,
}: {
  rows: QueueItem[];
  writable: boolean;
  administrator: boolean;
  busy: string;
  reasons: Record<string, string>;
  setReasons: (next: Record<string, string>) => void;
  onApprove: (item: QueueItem) => void;
  onReject: (item: QueueItem) => void;
  onRemove: (item: QueueItem) => void;
}) {
  const toast = useToast();
  if (!rows.length) return null;
  return (
    <section className="review-list" aria-labelledby="cv-review-title">
      <h2 id="cv-review-title">CVs</h2>
      {rows.map((item) => (
        <article className="portal-card review-card" key={item.id}>
          <h3>{item.traineeName}</h3>
          <CvSummary cv={item} />
          <p>
            <Link to={`/admin/trainees/${item.traineeId}`}>
              Open this trainee
            </Link>
          </p>
          {writable ? (
            <div className="portal-actions">
              <button
                className="btn btn--dark btn--sm"
                type="button"
                disabled={busy === item.id}
                onClick={() => onApprove(item)}
              >
                Approve CV
              </button>
              <Field id={`cv-reason-${item.id}`} label="Reason if you reject">
                <input
                  className="input"
                  id={`cv-reason-${item.id}`}
                  value={reasons[item.id] ?? ""}
                  onChange={(event) =>
                    setReasons({ ...reasons, [item.id]: event.target.value })
                  }
                />
              </Field>
              <button
                className="btn btn--sm"
                type="button"
                disabled={busy === item.id}
                onClick={() => onReject(item)}
              >
                Reject CV
              </button>
              {administrator ? (
                <button
                  className="btn btn--sm"
                  type="button"
                  onClick={() => downloadAdmin(item.traineeId, toast)}
                >
                  Download CV
                </button>
              ) : null}
              {administrator ? (
                <button
                  className="btn btn--sm"
                  type="button"
                  disabled={busy === item.id}
                  onClick={() => onRemove(item)}
                >
                  Remove CV
                </button>
              ) : null}
            </div>
          ) : (
            <p className="muted">
              You can read this queue. An editor or an administrator approves
              it.
            </p>
          )}
        </article>
      ))}
    </section>
  );
}

function CvSummary({ cv }: { cv: CvDetails }) {
  const visibility =
    cv.visibility === "public"
      ? "Public"
      : cv.visibility === "private"
        ? "Private"
        : "On request";
  const status =
    cv.reviewStatus === "approved"
      ? "Approved"
      : cv.reviewStatus === "rejected"
        ? "Rejected"
        : "Waiting for review";
  return (
    <p>
      {cv.fileName} · {visibility} · {status}
      {cv.rejectionReason ? ` — ${cv.rejectionReason}` : ""}
    </p>
  );
}

function downloadAdmin(
  traineeId: string,
  toast: (
    title: string,
    text: string,
    tone: "info" | "success" | "error",
  ) => void,
): void {
  if (currentEnv().apiMode !== "live") {
    toast(
      "Preview only",
      "This preview cannot download the file. The live site can.",
      "info",
    );
    return;
  }
  window.location.assign(`/api/v1/admin/trainees/${traineeId}/cv/file`);
}

export type { QueueItem as CvQueueItem };
