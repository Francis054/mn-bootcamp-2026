import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { OfficialLogo } from '@/components/Brand';
import { CommunityBadge } from '@/components/CommunityBadge';
import { SiteImage } from '@/components/SiteImage';
import { ErrorSummary, Field } from '@/components/controls';
import { Loader } from '@/components/Loader';
import { Icon } from '@/components/Icon';
import { ShellMark, usePageMeta } from '@/components/SiteChrome';
import { usesMockApi } from '@/config/runtime';
import { isApiError, type SessionUser } from '@/domain/types';
import { collect, emailAddress, minLength, required } from '@/domain/validate';
import { rememberSignedIn } from '@/dev/session';

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mock = usesMockApi();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);
  usePageMeta('Sign in');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');
    const developmentAck = data.get('developmentAck') === 'on';
    const fieldErrors = collect({
      email: emailAddress(email),
      password: required(password, 'Enter your password.') ?? minLength(password, 8, 'Use at least 8 characters.'),
      ...(mock ? { developmentAck: developmentAck ? null : 'Confirm that you understand this is the development adapter.' } : {}),
    });
    setErrors(fieldErrors);
    setFormError('');
    if (Object.keys(fieldErrors).length) return;
    setPending(true);
    try {
      const result = await api<{ user?: SessionUser; expiresAt?: string | number }>({
        method: 'POST',
        path: '/auth/login',
        body: mock ? { email, password, developmentAck: true } : { email, password },
      });
      if (!mock && result.user && result.expiresAt !== undefined) rememberSignedIn(result.user, result.expiresAt);
      const next = params.get('next');
      if (result.user?.role === 'trainee') {
        navigate('/portal');
        return;
      }
      navigate(next && next.startsWith('/admin') ? next : '/admin');
    } catch (error) {
      setFormError(isApiError(error) ? error.message : 'Sign-in failed.');
      if (isApiError(error) && error.fieldErrors) setErrors(error.fieldErrors);
    } finally {
      setPending(false);
    }
  };
  return (
    <main id="main"><div className="login">
      <section className="login__form">
        <div className="login__brand"><span className="wordmark"><ShellMark /><span className="wordmark__text"><b>Bootcamp CMS</b><small>2026 cohort</small></span></span><OfficialLogo width={150} /></div>
        {mock ? <span className="badge badge--warning" style={{ alignSelf: 'flex-start', margin: '16px 0' }}>Development adapter — not production authentication</span> : null}
        <h1 style={{ fontSize: 34, letterSpacing: '-.03em', marginBottom: 8 }}>Welcome back</h1>
        {mock ? <p className="muted" style={{ marginBottom: 24 }}>Sign in to manage classes, trainees, events and media. The password is checked for length and then discarded. It is not stored and it is not a secret.</p> : null}
        <form onSubmit={(event) => void submit(event)} noValidate>
          <ErrorSummary errors={formError ? { form: formError, ...errors } : errors} />
          <Field id="email" label="Work email" error={errors.email} hint={mock ? 'Fixtures: viewer@example.test, editor@example.test, administrator@example.test' : undefined}>
            <input className="input" id="email" name="email" type="email" autoComplete="username" aria-invalid={Boolean(errors.email)} />
          </Field>
          <Field id="password" label="Password" error={errors.password} hint={mock ? 'Any 8+ characters. Not checked against a password store.' : 'At least 8 characters.'}>
            <div className="pw-wrap">
              <input className="input" id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" aria-invalid={Boolean(errors.password)} />
              <button className="icon-btn" type="button" aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((value) => !value)}><Icon name="eye" className="i--sm" /></button>
            </div>
          </Field>
          {mock ? <label className="check"><input type="checkbox" name="developmentAck" /> I understand this development sign-in is not production authentication</label> : null}
          {errors.developmentAck ? <div className="error-msg" role="alert">{errors.developmentAck}</div> : null}
          <button className={`btn btn--dark${pending ? ' is-loading' : ''}`} type="submit" style={{ justifyContent: 'center', marginTop: 16 }} disabled={pending} aria-busy={pending || undefined}>{pending ? <Loader variant="inline" label="Signing in" /> : null}Sign in <span className="arrow"><Icon name="arrow-right" className="i--sm" /></span></button>
          <p style={{ marginTop: 16 }}><Link to="/admin/forgot-password">Forgot password?</Link></p>
        </form>
      </section>
      <aside className="login__art" aria-hidden="true">
        <SiteImage slot="sign-in-panel" priority alt="" />
        <CommunityBadge className="login__mark" priority />
        <span className="a-sub" style={{ color: 'var(--mn-lime)' }}>Maxim Nyansa Foundation · Cybersecurity Bootcamp 2026</span>
        <h2 style={{ marginTop: 16 }}>Publish the journey, <em>week by week.</em></h2>
      </aside>
    </div></main>
  );
}

export function ForgotPasswordPage() {
  const mock = usesMockApi();
  const [message, setMessage] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  usePageMeta('Reset password');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '');
    const fieldErrors = collect({ email: emailAddress(email) });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    try {
      const result = await api<{ delivered: boolean; message: string; developmentResetPath?: string | null }>({ method: 'POST', path: '/auth/password-reset/request', body: { email } });
      setMessage(result.message);
      setLink(mock ? result.developmentResetPath ?? null : null);
    } catch (error) {
      setMessage(isApiError(error) ? error.message : 'Reset could not be requested.');
      setLink(null);
    }
  };
  return (
    <main id="main" className="section"><div className="container" style={{ maxWidth: 560 }}>
      <h1>Reset request</h1>
      <p className="muted">{mock
        ? 'No email is sent. If the address matches a development fixture, a one-time link is shown on this screen. The new password will still be discarded.'
        : 'If an account exists for that address, a reset message will be sent. The reply does not say whether the mailbox is known.'}</p>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <Field id="email" label="Email" error={errors.email}><input className="input" id="email" name="email" type="email" autoComplete="username" /></Field>
        <button className="btn btn--dark" type="submit">Request reset</button>
      </form>
      {message ? <p role="status" style={{ marginTop: 16 }}>{message}</p> : null}
      {link ? <p style={{ marginTop: 12 }}><Link to={link}>Open the development reset link</Link></p> : null}
      <p style={{ marginTop: 16 }}><Link to="/admin/login">Back to sign in</Link></p>
    </div></main>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const mock = usesMockApi();
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  usePageMeta('Choose a new password');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    const confirm = String(data.get('confirm') ?? '');
    const fieldErrors = collect({
      password: required(password, 'Choose a new password.') ?? minLength(password, mock ? 8 : 12, mock ? 'Use at least 8 characters.' : 'Use at least 12 characters.'),
      confirm: password === confirm ? null : 'The two passwords do not match.',
    });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    try {
      const result = await api<{ passwordStored?: boolean; message: string }>({ method: 'POST', path: '/auth/password-reset/complete', body: { token: params.get('token') ?? '', password, confirm } });
      setDone(true);
      setMessage(mock ? `${result.message} Stored: ${result.passwordStored ? 'yes' : 'no'}.` : result.message);
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) setErrors(error.fieldErrors);
      setMessage(isApiError(error) ? error.message : 'Reset failed.');
    }
  };
  return (
    <main id="main" className="section"><div className="container" style={{ maxWidth: 560 }}>
      <h1>Set a new password</h1>
      <p className="muted">{mock
        ? 'The development adapter validates the form and throws the password away. There is no credential store.'
        : 'Use at least 12 characters, with a letter and a number. The reset link works once.'}</p>
      {done ? <p role="status">{message}</p> : (
        <form onSubmit={(event) => void submit(event)} noValidate>
          <ErrorSummary errors={errors} />
          <Field id="password" label="New password" error={errors.password}><input className="input" id="password" name="password" type="password" autoComplete="new-password" /></Field>
          <Field id="confirm" label="Confirm password" error={errors.confirm}><input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" /></Field>
          {errors.token ? <p role="alert">{errors.token}</p> : null}
          <button className="btn btn--dark" type="submit">Complete reset</button>
        </form>
      )}
      {message && !done ? <p role="alert">{message}</p> : null}
      <p style={{ marginTop: 16 }}><Link to="/admin/login">Sign in</Link></p>
    </div></main>
  );
}

export function SessionExpiredPage() {
  usePageMeta('Session expired');
  const mock = usesMockApi();
  return (
    <main id="main" className="section"><div className="container" style={{ maxWidth: 640 }}>
      <div className="empty"><h1>Your session expired</h1><p>{mock ? 'Nothing was stored in the browser. Sign in again with the development adapter.' : 'Sign in again. The session cookie is no longer valid.'}</p><Link className="btn btn--dark" to="/admin/login">Sign in</Link></div>
    </div></main>
  );
}

export function ForbiddenPage() {
  usePageMeta('Access denied');
  const mock = usesMockApi();
  return (
    <main id="main" className="section"><div className="container" style={{ maxWidth: 640 }}>
      <div className="empty denied"><h1>You don’t have access to that screen</h1><p>{mock ? 'Your development role does not include this permission. Hiding the link is not the security boundary — the adapter refused the route.' : 'Your role does not include this permission. The API refuses the request as well.'}</p><Link className="btn btn--ghost" to="/admin">Back to overview</Link></div>
    </div></main>
  );
}
