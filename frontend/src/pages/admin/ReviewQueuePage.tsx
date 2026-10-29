import { useState } from 'react';
import { api } from '@/api/client';
import { Field } from '@/components/controls';
import { EmptyState, ErrorState, LoadingRows, useToast } from '@/components/feedback';
import { usePageMeta } from '@/components/SiteChrome';
import { isApiError } from '@/domain/types';
import type { ProfileFields, ReviewStatus } from '@/domain/portalProfile';
import { KIND_LABEL, type PortfolioContent, type PortfolioReviewShape } from '@/domain/portfolio';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/auth/AuthProvider';

interface ReviewItem {
  traineeId: string;
  email: string;
  displayName: string;
  status: ReviewStatus;
  submittedAt: string | null;
  draft: ProfileFields;
  live: ProfileFields;
  consents: { publicProfile: boolean; publicPhoto: boolean; contactRelay: boolean };
}

export function ReviewQueuePage() {
  const toast = useToast();
  const auth = useAuth();
  const writable = auth.allowed('content.write');
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, ProfileFields>>({});
  const record = useAsync(`review:${nonce}`, () => api<ReviewItem[]>({ method: 'GET', path: '/admin/review-queue' }));
  const items = useAsync(`review-items:${nonce}`, () => api<PortfolioReviewShape[]>({ method: 'GET', path: '/admin/review-queue/items' }));
  usePageMeta('Review queue');
  const reload = () => setNonce((value) => value + 1);
  const approve = async (item: ReviewItem) => {
    setBusy(item.traineeId);
    try {
      const draft = edits[item.traineeId];
      if (draft) {
        await api({ method: 'PATCH', path: `/admin/review-queue/${item.traineeId}`, body: draft });
      }
      await api({ method: 'POST', path: `/admin/review-queue/${item.traineeId}/approve` });
      toast('Profile approved', 'The approved version can appear on the public site when the trainee has agreed.', 'success');
      reload();
    } catch (error) {
      toast('Could not approve', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setBusy('');
    }
  };
  const reject = async (item: ReviewItem) => {
    const reason = (reasons[item.traineeId] ?? '').trim();
    if (!reason) {
      toast('Add a reason', 'The trainee will see this reason.', 'error');
      return;
    }
    setBusy(item.traineeId);
    try {
      await api({ method: 'POST', path: `/admin/review-queue/${item.traineeId}/reject`, body: { reason } });
      toast('Profile rejected', 'The last approved version stays public.', 'success');
      reload();
    } catch (error) {
      toast('Could not reject', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setBusy('');
    }
  };
  return (
    <>
      <div className="a-head"><div><h1>Review queue</h1><p>Profiles and portfolio items a trainee submitted. The last approved version stays on the public site until you approve the new one.</p></div></div>
      {record.loading || items.loading ? <LoadingRows /> : null}
      {record.error ? <ErrorState title="Could not load the review queue" text={record.error.message} /> : null}
      {items.error ? <ErrorState title="Could not load portfolio items" text={items.error.message} /> : null}
      {!record.loading && !items.loading && record.data && !record.data.length && items.data && !items.data.length ? <EmptyState icon="users" title="Nothing is waiting" text="When a trainee submits a profile or a portfolio item, it is listed here." /> : null}
      <div className="review-list">
        {record.data?.map((item) => {
          const draft = edits[item.traineeId] ?? item.draft;
          return (
            <article className="portal-card review-card" key={item.traineeId}>
              <h2>{draft.displayName}</h2>
              <p className="muted">{item.email}</p>
              <p>Last approved version: {item.live.headline || item.live.bio || 'Nothing has been approved yet.'}</p>
              <Field id={`headline-${item.traineeId}`} label="Headline">
                <input className="input" id={`headline-${item.traineeId}`} value={draft.headline} disabled={!writable} onChange={(event) => setEdits({ ...edits, [item.traineeId]: { ...draft, headline: event.target.value } })} />
              </Field>
              <Field id={`bio-${item.traineeId}`} label="Short bio">
                <textarea className="textarea" id={`bio-${item.traineeId}`} value={draft.bio} disabled={!writable} rows={4} onChange={(event) => setEdits({ ...edits, [item.traineeId]: { ...draft, bio: event.target.value } })} />
              </Field>
              <p>Location: {draft.location || 'Not set'}</p>
              <p>LinkedIn: {draft.linkedin || 'Not set'}</p>
              <p>GitHub: {draft.githubUrl || 'Not set'}</p>
              <p>Portfolio: {draft.portfolio || 'Not set'}</p>
              {draft.photoUrl ? <img className="portal-photo" src={draft.photoUrl} alt="" /> : <p className="muted">No photo in this submission.</p>}
              <p className="muted">Consent: profile {item.consents.publicProfile ? 'yes' : 'no'}, photo {item.consents.publicPhoto ? 'yes' : 'no'}, contact {item.consents.contactRelay ? 'yes' : 'no'}.</p>
              {writable ? (
                <div className="portal-actions">
                  <button className="btn btn--dark btn--sm" type="button" disabled={busy === item.traineeId} onClick={() => void approve(item)}>Approve</button>
                  <Field id={`reason-${item.traineeId}`} label="Reason if you reject">
                    <input className="input" id={`reason-${item.traineeId}`} value={reasons[item.traineeId] ?? ''} onChange={(event) => setReasons({ ...reasons, [item.traineeId]: event.target.value })} />
                  </Field>
                  <button className="btn btn--sm" type="button" disabled={busy === item.traineeId} onClick={() => void reject(item)}>Reject</button>
                </div>
              ) : <p className="muted">You can read this queue. An editor or an administrator approves it.</p>}
            </article>
          );
        })}
      </div>
      <PortfolioReviewList
        rows={items.data ?? []}
        writable={writable}
        busy={busy}
        setBusy={setBusy}
        reload={reload}
        toast={toast}
      />
    </>
  );
}

function mediaLabel(provider: string | null): string {
  if (provider === 'youtube') return 'YouTube';
  if (provider === 'vimeo') return 'Vimeo';
  if (provider === 'loom') return 'Loom';
  return 'Uploaded video';
}

function PortfolioReviewList({
  rows,
  writable,
  busy,
  setBusy,
  reload,
  toast,
}: {
  rows: PortfolioReviewShape[];
  writable: boolean;
  busy: string;
  setBusy: (value: string) => void;
  reload: () => void;
  toast: (title: string, text: string, tone: 'success' | 'error') => void;
}) {
  const [edits, setEdits] = useState<Record<string, PortfolioContent>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  if (!rows.length) return null;
  const approve = async (item: PortfolioReviewShape) => {
    setBusy(item.id);
    try {
      const draft = edits[item.id];
      if (draft) await api({ method: 'PATCH', path: `/admin/review-queue/items/${item.id}`, body: draft });
      await api({ method: 'POST', path: `/admin/review-queue/items/${item.id}/approve` });
      toast('Item approved', 'The approved version can appear on the public profile when the trainee has agreed.', 'success');
      reload();
    } catch (error) {
      toast('Could not approve', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setBusy('');
    }
  };
  const reject = async (item: PortfolioReviewShape) => {
    const reason = (reasons[item.id] ?? '').trim();
    if (!reason) {
      toast('Add a reason', 'The trainee will see this reason.', 'error');
      return;
    }
    setBusy(item.id);
    try {
      await api({ method: 'POST', path: `/admin/review-queue/items/${item.id}/reject`, body: { reason } });
      toast('Item rejected', 'The last approved version stays public.', 'success');
      reload();
    } catch (error) {
      toast('Could not reject', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setBusy('');
    }
  };
  const remove = async (item: PortfolioReviewShape) => {
    setBusy(item.id);
    try {
      await api({ method: 'DELETE', path: `/admin/review-queue/items/${item.id}` });
      toast('Item deleted', 'It has been removed from the public profile.', 'success');
      reload();
    } catch (error) {
      toast('Could not delete', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setBusy('');
    }
  };
  return (
    <section className="review-list" aria-labelledby="portfolio-review-title">
      <h2 id="portfolio-review-title">Portfolio items</h2>
      {rows.map((item) => {
        const draft = edits[item.id] ?? item.draft;
        return (
          <article className="portal-card review-card" key={item.id}>
            <h3>{draft.title || 'Untitled item'}</h3>
            <p className="muted">{item.traineeName} · {item.email}</p>
            <p className="tag">{KIND_LABEL[draft.kind]}</p>
            <p>Last approved version: {item.live.title || 'Nothing has been approved yet.'}</p>
            <Field id={`item-title-${item.id}`} label="Title">
              <input className="input" id={`item-title-${item.id}`} value={draft.title} disabled={!writable} onChange={(event) => setEdits({ ...edits, [item.id]: { ...draft, title: event.target.value } })} />
            </Field>
            <Field id={`item-summary-${item.id}`} label="Summary or write-up">
              <textarea className="textarea" id={`item-summary-${item.id}`} rows={4} value={draft.summary} disabled={!writable} onChange={(event) => setEdits({ ...edits, [item.id]: { ...draft, summary: event.target.value } })} />
            </Field>
            <p>Skills or tools: {draft.skills.join(', ') || 'None'}</p>
            <p>Repository: {draft.repositoryUrl || 'Not set'}</p>
            <p>Demo: {draft.demoUrl || 'Not set'}</p>
            {draft.media.map((media) => <p key={media.id}>{media.kind === 'image' ? media.alt || 'Picture' : mediaLabel(media.provider)}</p>)}
            <p className="muted">Consent: profile {item.consents.publicProfile ? 'yes' : 'no'}, photo {item.consents.publicPhoto ? 'yes' : 'no'}.</p>
            {writable ? (
              <div className="portal-actions">
                <button className="btn btn--dark btn--sm" type="button" disabled={busy === item.id} onClick={() => void approve(item)}>Approve item</button>
                <Field id={`item-reason-${item.id}`} label="Reason if you reject">
                  <input className="input" id={`item-reason-${item.id}`} value={reasons[item.id] ?? ''} onChange={(event) => setReasons({ ...reasons, [item.id]: event.target.value })} />
                </Field>
                <button className="btn btn--sm" type="button" disabled={busy === item.id} onClick={() => void reject(item)}>Reject item</button>
                <button className="btn btn--sm" type="button" disabled={busy === item.id} onClick={() => void remove(item)}>Delete item</button>
              </div>
            ) : <p className="muted">You can read this queue. An editor or an administrator approves it.</p>}
          </article>
        );
      })}
    </section>
  );
}
