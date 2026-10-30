import { useState } from 'react';
import { api } from '@/api/client';
import { usePageMeta } from '@/components/SiteChrome';
import { EmptyState, ErrorState, LoadingRows, useToast } from '@/components/feedback';
import { BusyButton } from '@/components/controls';
import { isApiError } from '@/domain/types';
import { useAsync } from '@/hooks/useAsync';

interface FailedEmail {
  id: string;
  kind: string;
  to: string;
  subject: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: string;
}

interface RemovalItem {
  id: string;
  label: string;
  status: 'pending' | 'deleted' | 'failed';
  error: string | null;
  attempts: number;
}

interface RemovalReport {
  removalId: string;
  traineeId: string;
  displayName: string;
  database: { status: string; error: string | null };
  items: RemovalItem[];
}

const KIND: Record<string, string> = {
  verification: 'Signup confirmation',
  password_reset: 'Password reset',
  invitation: 'Invitation',
  existing_account: 'Existing account',
  enquiry: 'Enquiry',
  contact_relay: 'Employer message',
  cv_link: 'CV link',
  cv_notice: 'CV request notice',
  review: 'Review outcome',
};

export function FailedEmailsPage() {
  const toast = useToast();
  const [nonce, setNonce] = useState(0);
  const [pendingId, setPendingId] = useState('');
  const emails = useAsync(`failed-email:${nonce}`, () => api<FailedEmail[]>({ method: 'GET', path: '/admin/email-outbox/failed' }));
  const removals = useAsync(`removals:${nonce}`, () => api<RemovalReport[]>({ method: 'GET', path: '/admin/trainee-removals' }));
  usePageMeta('Failed emails');
  const loading = emails.loading || removals.loading;
  const resend = async (row: FailedEmail) => {
    setPendingId(row.id);
    try {
      const result = await api<{ delivered: boolean }>({ method: 'POST', path: `/admin/email-outbox/${row.id}/resend` });
      toast(result.delivered ? 'Email sent' : 'Still not sent', row.subject, result.delivered ? 'success' : 'error');
      setNonce((value) => value + 1);
    } catch (error) {
      toast('Could not resend', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setPendingId('');
    }
  };
  const retry = async (row: RemovalReport) => {
    setPendingId(row.removalId);
    try {
      await api({ method: 'POST', path: `/admin/trainee-removals/${row.removalId}/retry` });
      toast('Removal retried', row.displayName || row.traineeId);
      setNonce((value) => value + 1);
    } catch (error) {
      toast('Could not retry', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setPendingId('');
    }
  };
  return (
    <>
      <div className="a-head">
        <div>
          <h1>Failed emails</h1>
          <p>Messages that failed or got stuck. Resend tries the stored message again. The public site does not link here.</p>
        </div>
      </div>
      {loading ? <LoadingRows /> : null}
      {!loading && emails.error ? <ErrorState title="Could not load failed emails" text={emails.error.message} /> : null}
      {!loading && !emails.error && emails.data && !emails.data.length ? (
        <EmptyState icon="mail" title="No failed emails" text="A message appears here when Resend refuses it or the retry window is missed." />
      ) : null}
      {!loading && emails.data?.length ? (
        <table className="table table--cards">
          <thead>
            <tr>
              <th>When</th>
              <th>Kind</th>
              <th>To</th>
              <th>Subject</th>
              <th>Attempts</th>
              <th>Last error</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {emails.data.map((row) => (
              <tr key={row.id}>
                <td>{row.createdAt.slice(0, 16).replace('T', ' ')}</td>
                <td>{KIND[row.kind] ?? row.kind}</td>
                <td>{row.to}</td>
                <td>{row.subject}</td>
                <td>{row.attempts} / {row.maxAttempts}</td>
                <td>{row.lastError ?? row.status}</td>
                <td className="cell-actions">
                  <BusyButton pending={pendingId === row.id} busyLabel="Sending" className="btn btn--ghost btn--sm" onClick={() => void resend(row)}>
                    Resend
                  </BusyButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {!loading && !removals.error ? <h2 className="h3" style={{ marginTop: 32 }}>Files still held after a removal</h2> : null}
      {!loading && removals.error ? <ErrorState title="Could not load removals" text={removals.error.message} /> : null}
      {!loading && !removals.error && removals.data && !removals.data.length ? (
        <EmptyState icon="layers" title="No unfinished removals" text="A failed picture, video, or CV delete stays here so it can be tried again." />
      ) : null}
      {!loading && removals.data?.length ? (
        <table className="table table--cards">
          <thead>
            <tr>
              <th>Trainee</th>
              <th>Records</th>
              <th>Files</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {removals.data.map((row) => (
              <tr key={row.removalId}>
                <td><b>{row.displayName || row.traineeId}</b></td>
                <td>{row.database.status}{row.database.error ? ` — ${row.database.error}` : ''}</td>
                <td>{row.items.map((item) => `${item.label}: ${item.status}${item.error ? ` (${item.error})` : ''}`).join('; ') || 'None'}</td>
                <td className="cell-actions">
                  <BusyButton pending={pendingId === row.removalId} busyLabel="Retrying" className="btn btn--ghost btn--sm" onClick={() => void retry(row)}>
                    Retry
                  </BusyButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}
