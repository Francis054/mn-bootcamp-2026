import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, downloadAdminFile } from '@/api/client';
import { BusyButton, ErrorSummary, Field, FormLegend } from '@/components/controls';
import { useToast } from '@/components/feedback';
import { useAdminForm } from '@/components/adminForm';
import { isApiError } from '@/domain/types';

interface RemovalItem {
  id: string;
  label: string;
  status: 'pending' | 'deleted' | 'failed';
  error: string | null;
  attempts: number;
}

interface RemovalReport {
  removalId: string;
  displayName: string;
  database: { status: string; error: string | null };
  items: RemovalItem[];
}

const LABELS = { confirmation: 'Confirmation' };

export function TraineePrivacyPanel({ traineeId, displayName }: { traineeId: string; displayName: string }) {
  const toast = useToast();
  const navigate = useNavigate();
  const admin = useAdminForm();
  const [pending, setPending] = useState<'download' | 'erase' | ''>('');
  const [report, setReport] = useState<RemovalReport | null>(null);
  const [typed, setTyped] = useState('');

  const download = async () => {
    setPending('download');
    try {
      await downloadAdminFile(`/admin/trainees/${traineeId}/export`);
      toast('Download started', 'The file contains this trainee’s data.');
    } catch (error) {
      toast('Could not download', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setPending('');
    }
  };

  const erase = async () => {
    const confirmation = typed.trim();
    if (confirmation !== displayName.trim()) {
      admin.block({ confirmation: 'Type the trainee’s display name to confirm.' });
      return;
    }
    admin.setErrors({});
    setPending('erase');
    try {
      const result = await api<RemovalReport>({
        method: 'POST',
        path: `/admin/trainees/${traineeId}/erase`,
        body: { confirmation },
      });
      setReport(result);
      const failed = result.items.filter((item) => item.status === 'failed');
      if (result.database.status === 'deleted' && failed.length === 0) {
        toast('Trainee removed', 'Records and files were deleted.');
        navigate('/admin/trainees');
        return;
      }
      toast('Removal needs another look', 'A file or the records did not delete. The result is listed below.', 'error');
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) admin.applyServer(error.fieldErrors);
      toast('Could not remove', isApiError(error) ? error.message : 'Request failed.', 'error');
    } finally {
      setPending('');
    }
  };

  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="a-head">
        <div>
          <h2>Trainee data</h2>
          <p>Download everything held about this trainee, or remove the trainee, their login, and their files. This is only for an administrator.</p>
        </div>
        <BusyButton pending={pending === 'download'} busyLabel="Preparing" className="btn btn--ghost btn--sm" onClick={() => void download()}>
          Download data
        </BusyButton>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void erase();
        }}
        noValidate
      >
        <h3 className="h3">Remove this trainee</h3>
        <p>This deletes the trainee’s records, Cloudinary files, and the CV. A failed file delete is shown and can be retried. Nothing is deleted on a schedule.</p>
        <FormLegend />
        <ErrorSummary errors={admin.errors} labels={LABELS} summaryRef={admin.summaryRef} />
        <Field
          id="confirmation"
          label="Type the display name to confirm"
          required
          error={admin.errors.confirmation}
          hint={`Type ${displayName} to confirm. This uses the saved name.`}
        >
          <input
            className="input"
            id="confirmation"
            name="confirmation"
            value={typed}
            autoComplete="off"
            onChange={(event) => {
              setTyped(event.target.value);
              const next = event.target.value.trim();
              admin.clearFixed('confirmation', next === displayName.trim() ? undefined : 'Type the trainee’s display name to confirm.');
            }}
          />
        </Field>
        <BusyButton pending={pending === 'erase'} busyLabel="Removing" type="submit" className="btn btn--danger btn--sm">
          Remove trainee
        </BusyButton>
      </form>
      {report ? (
        <div style={{ marginTop: 16 }}>
          <h3 className="h3">Removal result</h3>
          <p>Records: {report.database.status}{report.database.error ? ` — ${report.database.error}` : ''}</p>
          <ul>
            {report.items.map((item) => (
              <li key={item.id}>
                {item.label}: {item.status}
                {item.error ? ` — ${item.error}` : ''}
                {` (${item.attempts} ${item.attempts === 1 ? 'attempt' : 'attempts'})`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
