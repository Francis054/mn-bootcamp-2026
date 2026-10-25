import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useAdminForm } from '@/components/adminForm';
import { ErrorSummary, Field, FormLegend } from '@/components/controls';
import { classFieldErrors, eventFieldErrors, traineeFieldErrors } from '@/domain/adminFields';

function ClassProbe() {
  const admin = useAdminForm();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const values = { title, moduleId: '', week: '1', date: '2026-10-05', summary };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        admin.block(classFieldErrors(values, 'save'));
      }}
      noValidate
    >
      <FormLegend />
      <ErrorSummary errors={admin.errors} labels={{ title: 'Title', moduleId: 'Module', summary: 'Summary' }} summaryRef={admin.summaryRef} />
      <Field id="title" label="Title" required error={admin.errors.title}>
        <input id="title" value={title} onChange={(event) => {
          const next = event.target.value;
          setTitle(next);
          admin.clearFixed('title', classFieldErrors({ ...values, title: next }, 'save').title);
        }} />
      </Field>
      <Field id="summary" label="Summary" required error={admin.errors.summary}>
        <textarea id="summary" value={summary} onChange={(event) => setSummary(event.target.value)} />
      </Field>
      <button type="submit">Save</button>
    </form>
  );
}

describe('admin form validation', () => {
  it('blocks save, names the fields, and clears a field once it is valid', async () => {
    const user = userEvent.setup();
    render(<ClassProbe />);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please fill in 3 required fields');
    expect(screen.getByRole('link', { name: 'Title' })).toHaveAttribute('href', '#title');
    expect(screen.getByText('Give the class a title.')).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/Title/)));
    await user.type(screen.getByLabelText(/Title/), 'Networks');
    expect(screen.queryByText('Give the class a title.')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Please fill in 2 required fields');
  });

  it('requires consent before a trainee can be published', () => {
    const errors = traineeFieldErrors({
      displayName: 'Sample Trainee',
      email: 'sample@example.com',
      track: 'Blue team',
      focus: 'network',
      linkedin: '',
      portfolio: '',
      consentReceived: false,
      publicationStatus: 'draft',
    }, 'publish');
    expect(errors.consentReceived).toBe('Consent is required before this profile can be published.');
    expect(traineeFieldErrors({
      displayName: 'Sample Trainee',
      email: 'sample@example.com',
      track: 'Blue team',
      focus: 'network',
      linkedin: '',
      portfolio: '',
      consentReceived: false,
      publicationStatus: 'draft',
    }, 'save')).toEqual({});
  });

  it('rejects a verified event without an https source and a confirmed date that still has a time', () => {
    expect(eventFieldErrors({
      title: 'Opening',
      place: 'Hall',
      summary: 'This summary is long enough.',
      date: '',
      dateTbc: true,
      startTime: '17:00',
      endTime: '',
      verified: true,
      sourceUrl: '',
    })).toMatchObject({
      startTime: 'Leave the times blank while the date is to be confirmed.',
      sourceUrl: 'Enter a full link starting with https://',
    });
  });
});
