import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { currentEnv } from "@/config/runtime";
import { Field } from "@/components/controls";
import { useToast } from "@/components/feedback";
import type { CvDetails, CvVisibility } from "@/domain/cv";
import { isApiError } from "@/domain/types";

const VISIBILITY: { id: CvVisibility; label: string; hint: string }[] = [
  {
    id: "private",
    label: "Private",
    hint: "Only an administrator can open it.",
  },
  {
    id: "on_request",
    label: "On request",
    hint: "The usual choice. The file stays off the public page.",
  },
  {
    id: "public",
    label: "Public",
    hint: "Visitors can download it after an administrator approves it.",
  },
];

export function CvEditor() {
  const toast = useToast();
  const [cv, setCv] = useState<CvDetails | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [visibility, setVisibility] = useState<CvVisibility>("on_request");

  useEffect(() => {
    let cancel = false;
    api<{ cv: CvDetails | null }>({ method: "GET", path: "/portal/cv" })
      .then((result) => {
        if (cancel) return;
        setCv(result.cv);
        if (result.cv) setVisibility(result.cv.visibility);
      })
      .catch((err: unknown) => {
        if (!cancel)
          setError(
            isApiError(err) ? err.message : "Your CV could not be loaded.",
          );
      })
      .finally(() => {
        if (!cancel) setLoaded(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast("CV too large", "A CV must be 5 MB or smaller.", "error");
      return;
    }
    const body = new FormData();
    body.set("file", file);
    body.set("visibility", visibility);
    setPending(true);
    try {
      const saved = await api<CvDetails>({
        method: "POST",
        path: "/portal/cv",
        body,
      });
      setCv(saved);
      setVisibility(saved.visibility);
      toast(
        "CV sent for review",
        "An administrator will look at it before it can be offered publicly.",
        "success",
      );
    } catch (err) {
      toast(
        "CV not saved",
        isApiError(err) ? err.message : "The CV could not be saved.",
        "error",
      );
    } finally {
      setPending(false);
    }
  };

  const saveVisibility = async (next: CvVisibility) => {
    setVisibility(next);
    if (!cv) return;
    setPending(true);
    try {
      const saved = await api<CvDetails>({
        method: "PATCH",
        path: "/portal/cv",
        body: { visibility: next },
      });
      setCv(saved);
      toast(
        "Visibility saved",
        "A public download still waits until the CV is approved.",
        "success",
      );
    } catch (err) {
      toast(
        "Could not save",
        isApiError(err) ? err.message : "The choice could not be saved.",
        "error",
      );
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    setPending(true);
    try {
      await api({ method: "DELETE", path: "/portal/cv" });
      setCv(null);
      toast("CV removed", "The file has been deleted.", "success");
    } catch (err) {
      toast(
        "Could not remove",
        isApiError(err) ? err.message : "The CV could not be removed.",
        "error",
      );
    } finally {
      setPending(false);
    }
  };

  const download = () => {
    if (currentEnv().apiMode !== "live") {
      toast(
        "Preview only",
        "This preview keeps the CV in the browser. The live site downloads the file.",
        "info",
      );
      return;
    }
    window.location.assign("/api/v1/portal/cv/file");
  };

  return (
    <section className="portal-card">
      <h2>CV</h2>
      <p className="muted">
        Upload one PDF, at most 5 MB and 10 pages. A new file goes to the review
        queue. Visitors can download it only after approval, and only if you
        choose public.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {!loaded && !error ? <p role="status">Loading your CV.</p> : null}
      {cv ? (
        <p>
          {cv.fileName} · {Math.max(1, Math.round(cv.sizeBytes / 1024))} KB ·{" "}
          {statusLabel(cv.reviewStatus)}
          {cv.rejectionReason ? ` — ${cv.rejectionReason}` : ""}
        </p>
      ) : loaded ? (
        <p>No CV yet. On request is the usual choice.</p>
      ) : null}
      <fieldset className="portal-actions" disabled={pending}>
        <legend className="label">Who can receive it</legend>
        {VISIBILITY.map((choice) => (
          <label key={choice.id} className="check">
            <input
              type="radio"
              name="cv-visibility"
              value={choice.id}
              checked={visibility === choice.id}
              onChange={() => void saveVisibility(choice.id)}
            />
            <span>
              {choice.label}. {choice.hint}
            </span>
          </label>
        ))}
      </fieldset>
      <Field
        id="cv-file"
        label={cv ? "Replace the PDF" : "Choose a PDF"}
        required={false}
      >
        <input
          className="input"
          id="cv-file"
          type="file"
          accept="application/pdf,.pdf"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void upload(file);
          }}
        />
      </Field>
      {cv ? (
        <div className="portal-actions">
          <button
            className="btn btn--sm"
            type="button"
            disabled={pending}
            onClick={download}
          >
            Download my CV
          </button>
          <button
            className="btn btn--sm"
            type="button"
            disabled={pending}
            onClick={() => void remove()}
          >
            Remove CV
          </button>
        </div>
      ) : null}
    </section>
  );
}

function statusLabel(status: CvDetails["reviewStatus"]): string {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Waiting for review";
}
