import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { api } from '@/api/client';
import { usePageMeta } from '@/components/SiteChrome';
import { EmptyState, ErrorState, LoadingRows, useToast } from '@/components/feedback';
import { isApiError } from '@/domain/types';
import { useAsync } from '@/hooks/useAsync';

interface ContactRequest {
  id: string;
  traineeId: string;
  traineeName: string;
  fromName: string;
  fromOrg: string;
  fromEmail: string;
  message: string;
  status: 'new' | 'forwarded' | 'blocked' | 'failed';
  forwardedAt: string | null;
  createdAt: string;
}

interface CvRequest {
  id: string;
  traineeId: string;
  traineeName: string;
  fromName: string;
  fromOrg: string;
  fromEmail: string;
  message: string;
  status: 'new' | 'sent' | 'blocked' | 'failed';
  sentAt: string | null;
  createdAt: string;
}

const CONTACT_STATUS: Record<ContactRequest['status'], string> = {
  new: 'Saved, email not sent',
  forwarded: 'Passed on',
  blocked: 'Sender blocked',
  failed: 'Email failed',
};

const CV_STATUS: Record<CvRequest['status'], string> = {
  new: 'Saved, link not sent',
  sent: 'Link emailed',
  blocked: 'Sender blocked',
  failed: 'Email failed',
};

export function ContactRequestsPage() {
  const toast = useToast();
  const auth = useAuth();
  const canWrite = auth.allowed('content.write');
  const [nonce, setNonce] = useState(0);
  const contacts = useAsync(`contacts:${nonce}`, () => api<ContactRequest[]>({ method: 'GET', path: '/admin/contact-requests' }));
  const cvRequests = useAsync(`cv-requests:${nonce}`, () => api<CvRequest[]>({ method: 'GET', path: '/admin/cv-requests' }));
  usePageMeta('Employer messages');
  const loading = contacts.loading || cvRequests.loading;
  const block = async (row: ContactRequest) => {
    try {
      await api({ method: 'POST', path: `/admin/contact-requests/${row.id}/block` });
      toast('Sender blocked', row.fromName);
      setNonce((value) => value + 1);
    } catch (error) {
      toast('Could not block', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };
  const send = async (row: CvRequest) => {
    try {
      await api({ method: 'POST', path: `/admin/cv-requests/${row.id}/send` });
      toast('Send attempted', 'If email is not set up, the request stays in this list and no download link is shown here.');
      setNonce((value) => value + 1);
    } catch (error) {
      toast('Could not send', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };
  return (
    <>
      <div className="a-head"><div><h1>Employer messages</h1><p>Messages and CV requests from the public site. Trainee email addresses are not listed here.</p></div></div>
      {loading ? <LoadingRows /> : null}
      {!loading && contacts.error ? <ErrorState title="Could not load messages" text={contacts.error.message} /> : null}
      {!loading && !contacts.error && contacts.data && !contacts.data.length ? <EmptyState icon="mail" title="No employer messages yet" text="A message appears here after someone uses the contact form on a public profile. A filled company field is treated as spam and is not stored." /> : null}
      {!loading && contacts.data?.length ? (
        <table className="table table--cards">
          <thead><tr><th>Trainee</th><th>From</th><th>Message</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {contacts.data.map((row) => (
              <tr key={row.id}>
                <td><b>{row.traineeName}</b></td>
                <td><b>{row.fromName}</b><small>{row.fromOrg ? `${row.fromOrg} · ` : ''}{row.fromEmail}</small></td>
                <td>{row.message}</td>
                <td>{CONTACT_STATUS[row.status]}</td>
                <td className="cell-actions">
                  {canWrite && row.status !== 'blocked' ? <button className="btn btn--ghost btn--sm" type="button" onClick={() => void block(row)}>Block sender</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {!loading && !cvRequests.error ? <h2 className="h3" style={{ marginTop: 32 }}>CV requests</h2> : null}
      {!loading && cvRequests.error ? <ErrorState title="Could not load CV requests" text={cvRequests.error.message} /> : null}
      {!loading && !cvRequests.error && cvRequests.data && !cvRequests.data.length ? <EmptyState icon="layers" title="No CV requests yet" text="A request appears here when someone asks for a CV that is shared on request." /> : null}
      {!loading && cvRequests.data?.length ? (
        <table className="table table--cards">
          <thead><tr><th>Trainee</th><th>From</th><th>Message</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {cvRequests.data.map((row) => (
              <tr key={row.id}>
                <td><b>{row.traineeName}</b></td>
                <td><b>{row.fromName}</b><small>{row.fromEmail}</small></td>
                <td>{row.message}</td>
                <td>{CV_STATUS[row.status]}</td>
                <td className="cell-actions">
                  {canWrite && row.status !== 'blocked' ? <button className="btn btn--ghost btn--sm" type="button" onClick={() => void send(row)}>Send download link</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}
