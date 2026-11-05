import { useState } from 'react';
import { api } from '@/api/client';
import { EmptyState, ErrorState, LoadingRows, useToast } from '@/components/feedback';
import { usePageMeta } from '@/components/SiteChrome';
import { isApiError } from '@/domain/types';
import { useAsync } from '@/hooks/useAsync';

interface PendingRow {
  id: string;
  email: string;
  displayName: string;
  status: string;
  createdAt: string;
}

interface TraineeAccount {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  traineeId: string | null;
  disabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function PendingRegistrationsPage() {
  const toast = useToast();
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState('');
  const record = useAsync(`pending:${nonce}`, () => api<PendingRow[]>({ method: 'GET', path: '/admin/pending-registrations' }));
  usePageMeta('Signup requests');
  const act = async (row: PendingRow, action: 'approve' | 'reject') => {
    setBusy(row.id);
    try {
      const result = await api<{ message?: string; delivered?: boolean }>({
        method: 'POST',
        path: `/admin/pending-registrations/${row.id}/${action}`,
      });
      const detail = result.message ?? (action === 'approve' ? 'Approved.' : 'Rejected.');
      toast(action === 'approve' ? 'Signup approved' : 'Signup rejected', detail, result.delivered === false ? 'info' : 'success');
      setNonce((value) => value + 1);
    } catch (error) {
      toast('Could not update', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setBusy('');
    }
  };
  return (
    <>
      <div className="a-head"><div><h1>Signup requests</h1><p>Emails that asked for an account and were not on the cohort roster. Approving creates a hidden trainee record and sends a confirmation email.</p></div></div>
      {record.loading ? <LoadingRows /> : null}
      {record.error ? <ErrorState title="Could not load signup requests" text={record.error.message} /> : null}
      {!record.loading && record.data && !record.data.length ? <EmptyState icon="mail" title="No requests waiting" text="When someone signs up with an email that is not on the roster, it is listed here. The visitor is not told which emails are on the list." /> : null}
      {record.data?.length ? (
        <table className="table table--cards">
          <thead><tr><th>Person</th><th>Requested</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {record.data.map((row) => (
              <tr key={row.id}>
                <td><b style={{ display: 'block' }}>{row.displayName || 'No name given'}</b><small>{row.email}</small></td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>
                  <button className="btn btn--sm btn--dark" type="button" disabled={busy === row.id} onClick={() => void act(row, 'approve')}>Approve</button>
                  {' '}
                  <button className="btn btn--sm btn--ghost" type="button" disabled={busy === row.id} onClick={() => void act(row, 'reject')}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}

export function TraineeAccountsPage() {
  const toast = useToast();
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState('');
  const record = useAsync(`accounts:${nonce}`, () => api<TraineeAccount[]>({ method: 'GET', path: '/admin/trainee-accounts' }));
  usePageMeta('Trainee accounts');
  const post = async (row: TraineeAccount, action: 'disable' | 'enable' | 'resend-invite', label: string) => {
    setBusy(`${row.id}:${action}`);
    try {
      const result = await api<{ message?: string; delivered?: boolean }>({
        method: 'POST',
        path: `/admin/trainee-accounts/${row.id}/${action}`,
      });
      toast(label, result.message ?? label, result.delivered === false ? 'info' : 'success');
      setNonce((value) => value + 1);
    } catch (error) {
      toast('Could not update', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setBusy('');
    }
  };
  return (
    <>
      <div className="a-head"><div><h1>Trainee accounts</h1><p>Logins linked to the cohort. Suspending an account signs it out and later sign-in looks like a wrong password.</p></div></div>
      {record.loading ? <LoadingRows /> : null}
      {record.error ? <ErrorState title="Could not load trainee accounts" text={record.error.message} /> : null}
      {!record.loading && record.data && !record.data.length ? <EmptyState icon="users" title="No trainee accounts" text="Accounts appear here after someone on the roster signs up, or after you approve a request." /> : null}
      {record.data?.length ? (
        <table className="table table--cards">
          <thead><tr><th>Trainee</th><th>Email</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {record.data.map((row) => (
              <tr key={row.id}>
                <td><b>{row.displayName}</b><small>{row.traineeId ?? 'No roster link'}</small></td>
                <td>{row.email}</td>
                <td>{row.emailVerified ? 'Confirmed' : 'Not confirmed'}{row.disabled ? ' · Suspended' : ''}</td>
                <td>
                  {row.disabled ? (
                    <button className="btn btn--sm" type="button" disabled={busy.startsWith(row.id)} onClick={() => void post(row, 'enable', 'Account enabled')}>Enable</button>
                  ) : (
                    <button className="btn btn--sm" type="button" disabled={busy.startsWith(row.id)} onClick={() => void post(row, 'disable', 'Account suspended')}>Disable</button>
                  )}
                  {' '}
                  <button className="btn btn--sm btn--ghost" type="button" disabled={busy.startsWith(row.id)} onClick={() => void post(row, 'resend-invite', 'Email sent')}>Resend invite</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}
