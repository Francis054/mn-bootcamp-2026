import { useState, type FormEvent } from 'react';
import { api } from '@/api/client';
import { ErrorSummary, Field, FormLegend } from '@/components/controls';
import { isApiError } from '@/domain/types';
import { collect, emailAddress, minLength, required } from '@/domain/validate';

interface ReachResult {
  saved: boolean;
  delivered: boolean;
  message: string;
}

const CONTACT_LABELS = {
  'contact-name': 'Your name',
  'contact-email': 'Email',
  'contact-organisation': 'Organisation',
  'contact-message': 'Message',
};

const CV_LABELS = {
  'cv-name': 'Your name',
  'cv-email': 'Email',
  'cv-organisation': 'Organisation',
  'cv-message': 'Message',
};

export function ProfilePdfLink({ traineeId }: { traineeId: string }) {
  return (
    <a className="btn btn--dark btn--sm" href={`/api/v1/public/trainees/${encodeURIComponent(traineeId)}/profile.pdf`}>
      Download profile (PDF)
    </a>
  );
}

export function ContactPanel({ traineeId }: { traineeId: string }) {
  return (
    <ReachForm
      traineeId={traineeId}
      path="contact"
      prefix="contact"
      labels={CONTACT_LABELS}
      title="Message this trainee"
      lead="The form sends your note through the site. The trainee’s email address is not shown."
      messageMin={20}
      submitLabel="Send message"
    />
  );
}

export function CvRequestPanel({ traineeId }: { traineeId: string }) {
  return (
    <ReachForm
      traineeId={traineeId}
      path="cv-request"
      prefix="cv"
      labels={CV_LABELS}
      title="Ask for this CV"
      lead="The trainee chose to share a CV when someone asks. A short download link is emailed to you. Their email address is not shown."
      messageMin={10}
      submitLabel="Request CV"
    />
  );
}

function ReachForm({
  traineeId,
  path,
  prefix,
  labels,
  title,
  lead,
  messageMin,
  submitLabel,
}: {
  traineeId: string;
  path: 'contact' | 'cv-request';
  prefix: 'contact' | 'cv';
  labels: Record<string, string>;
  title: string;
  lead: string;
  messageMin: number;
  submitLabel: string;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState('');
  const [pending, setPending] = useState(false);
  const ids = {
    name: `${prefix}-name`,
    email: `${prefix}-email`,
    organisation: `${prefix}-organisation`,
    message: `${prefix}-message`,
    company: `${prefix}-company`,
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '');
    const email = String(data.get('email') ?? '');
    const organisation = String(data.get('organisation') ?? '');
    const message = String(data.get('message') ?? '');
    const fieldErrors = collect({
      [ids.name]: required(name, 'Enter your name.'),
      [ids.email]: emailAddress(email),
      [ids.organisation]: organisation.trim().length > 160 ? 'Use at most 160 characters.' : null,
      [ids.message]: required(message, 'Write a short message.') ?? minLength(message, messageMin, `Use at least ${messageMin} characters.`),
    });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    setPending(true);
    try {
      const result = await api<ReachResult>({
        method: 'POST',
        path: `/public/trainees/${encodeURIComponent(traineeId)}/${path}`,
        body: {
          name,
          email,
          organisation,
          message,
          company: String(data.get('company') ?? ''),
        },
      });
      setDone(result.message);
      setErrors({});
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) {
        const mapped: Record<string, string> = {};
        for (const [key, value] of Object.entries(error.fieldErrors)) {
          const id = key === 'name' || key === 'email' || key === 'organisation' || key === 'message' ? ids[key] : key;
          mapped[id] = value;
        }
        setErrors(mapped);
      } else {
        setErrors({ [ids.message]: isApiError(error) ? error.message : 'The form could not be sent.' });
      }
    } finally {
      setPending(false);
    }
  };
  if (done) {
    return (
      <div className="contact-done" tabIndex={-1} style={{ marginTop: 16 }}>
        <h3>{title}</h3>
        <p>{done}</p>
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setDone('')}>Write another</button>
      </div>
    );
  }
  return (
    <form onSubmit={(event) => void submit(event)} noValidate style={{ marginTop: 16 }}>
      <h3>{title}</h3>
      <p className="muted">{lead}</p>
      <FormLegend />
      <ErrorSummary errors={errors} labels={labels} />
      <div className="form-grid">
        <Field id={ids.name} label="Your name" required error={errors[ids.name]}>
          <input className="input" id={ids.name} name="name" autoComplete="name" aria-invalid={Boolean(errors[ids.name])} />
        </Field>
        <Field id={ids.email} label="Email" required error={errors[ids.email]}>
          <input className="input" id={ids.email} name="email" type="email" autoComplete="email" aria-invalid={Boolean(errors[ids.email])} />
        </Field>
        <Field id={ids.organisation} label="Organisation" required={false} error={errors[ids.organisation]} className="span-2">
          <input className="input" id={ids.organisation} name="organisation" autoComplete="organization" aria-invalid={Boolean(errors[ids.organisation])} />
        </Field>
        <Field id={ids.message} label="Message" required error={errors[ids.message]} hint={`At least ${messageMin} characters.`} className="span-2">
          <textarea className="textarea" id={ids.message} name="message" maxLength={2000} aria-invalid={Boolean(errors[ids.message])} />
        </Field>
      </div>
      <div style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
        <label htmlFor={ids.company}>Company</label>
        <input id={ids.company} name="company" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <button className="btn btn--dark btn--sm" type="submit" disabled={pending}>{pending ? 'Sending' : submitLabel}</button>
    </form>
  );
}
