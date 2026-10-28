import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { OfficialLogo } from '@/components/Brand';
import { CommunityBadge } from '@/components/CommunityBadge';
import { ErrorSummary, Field } from '@/components/controls';
import { EmptyState, ErrorState } from '@/components/feedback';
import { Icon } from '@/components/Icon';
import { Loader } from '@/components/Loader';
import { ShellMark, usePageMeta } from '@/components/SiteChrome';
import { SiteImage } from '@/components/SiteImage';
import { usesMockApi } from '@/config/runtime';
import { isApiError, type SessionUser } from '@/domain/types';
import { collect, emailAddress, minLength, newPassword, required } from '@/domain/validate';
import { clearSession, rememberSignedIn } from '@/dev/session';

const ACCEPTED = 'If this email is on the cohort list, we sent a link. If you do not see it, request another from the verification page.';

const verifyJobs = new Map<string, Promise<{ verified: boolean; message: string }>>();

function verifyOnce(token: string): Promise<{ verified: boolean; message: string }> {
  const existing = verifyJobs.get(token);
  if (existing) return existing;
  const job = api<{ verified: boolean; message: string }>({
    method: 'POST',
    path: '/public/trainee-signup/verify',
    body: { token },
  });
  verifyJobs.set(token, job);
  return job;
}

export function resetVerifyJobsForTests(): void {
  verifyJobs.clear();
}

function AuthSplit({ title, children, art }: { title: string; children: ReactNode; art: string }) {
  return (
    <main id="main">
      <div className="login">
        <section className="login__form">
          <div className="login__brand">
            <span className="wordmark">
              <ShellMark />
              <span className="wordmark__text"><b>Trainee portal</b><small>2026 cohort</small></span>
            </span>
            <OfficialLogo width={150} />
          </div>
          <h1 style={{ fontSize: 34, letterSpacing: '-.03em', marginBottom: 8 }}>{title}</h1>
          {children}
          <p style={{ marginTop: 20 }}><Link to="/">Back to the bootcamp site</Link></p>
        </section>
        <aside className="login__art" aria-hidden="true">
          <SiteImage slot="sign-in-panel" priority alt="" />
          <CommunityBadge className="login__mark" priority />
          <span className="a-sub" style={{ color: 'var(--mn-lime)' }}>Maxim Nyansa Foundation · Cybersecurity Bootcamp 2026</span>
          <h2 style={{ marginTop: 16 }}>{art}</h2>
        </aside>
      </div>
    </main>
  );
}

export function SignupPage() {
  const mock = usesMockApi();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState('');
  const [devLink, setDevLink] = useState<string | null>(null);
  usePageMeta('Create a trainee account');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');
    const confirm = String(data.get('confirm') ?? '');
    const displayName = String(data.get('displayName') ?? '');
    const acceptTerms = data.get('acceptTerms') === 'on';
    const fieldErrors = collect({
      email: emailAddress(email),
      displayName: displayName.trim().length > 120 ? 'Use at most 120 characters.' : null,
      password: newPassword(password, email),
      confirm: password === confirm ? null : 'The two passwords do not match.',
      acceptTerms: acceptTerms ? null : 'Tick to confirm you are creating a trainee account.',
    });
    setErrors(fieldErrors);
    setFormError('');
    if (Object.keys(fieldErrors).length) return;
    setPending(true);
    try {
      const result = await api<{ message: string; developmentVerifyPath?: string | null }>({
        method: 'POST',
        path: '/public/trainee-signup',
        body: {
          email,
          password,
          confirm,
          displayName,
          acceptTerms: true,
          company: String(data.get('company') ?? ''),
        },
      });
      setDone(result.message);
      setDevLink(mock ? result.developmentVerifyPath ?? null : null);
    } catch (error) {
      setFormError(isApiError(error) ? error.message : 'The account could not be requested.');
      if (isApiError(error) && error.fieldErrors) setErrors(error.fieldErrors);
    } finally {
      setPending(false);
    }
  };
  return (
    <AuthSplit title="Create your account" art="Your cohort login, after you confirm the email.">
      {done ? (
        <div>
          <p role="status">{done}</p>
          {devLink ? <p style={{ marginTop: 12 }}><Link to={devLink}>Open the development confirmation link</Link></p> : null}
          <p style={{ marginTop: 16 }}><Link to="/verify-email">Request another link</Link></p>
          <p style={{ marginTop: 8 }}><Link to="/login">Trainee sign in</Link></p>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} noValidate>
          <p className="muted" style={{ marginBottom: 16 }}>Use the email the bootcamp already has for you. If it is not on the cohort list, an administrator reviews the request. The reply is the same either way.</p>
          <ErrorSummary errors={formError ? { form: formError, ...errors } : errors} />
          <Field id="displayName" label="Name" error={errors.displayName} hint="Optional. You can leave this blank.">
            <input className="input" id="displayName" name="displayName" autoComplete="name" aria-invalid={Boolean(errors.displayName)} />
          </Field>
          <Field id="email" label="Email" error={errors.email}>
            <input className="input" id="email" name="email" type="email" autoComplete="username" aria-invalid={Boolean(errors.email)} required />
          </Field>
          <Field id="password" label="Password" error={errors.password} hint="At least 12 characters, with a letter and a number.">
            <input className="input" id="password" name="password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} required />
          </Field>
          <Field id="confirm" label="Confirm password" error={errors.confirm}>
            <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.confirm)} required />
          </Field>
          <label className="check">
            <input type="checkbox" name="acceptTerms" /> I am creating a trainee account for the Maxim Nyansa bootcamp
          </label>
          {errors.acceptTerms ? <div className="error-msg" role="alert">{errors.acceptTerms}</div> : null}
          <div className="sr-only" aria-hidden="true">
            <label htmlFor="company">Company</label>
            <input id="company" name="company" tabIndex={-1} autoComplete="off" />
          </div>
          <button className={`btn btn--dark${pending ? ' is-loading' : ''}`} type="submit" style={{ justifyContent: 'center' }} disabled={pending} aria-busy={pending || undefined}>
            {pending ? <Loader variant="inline" label="Sending" /> : null}
            Create account <span className="arrow"><Icon name="arrow-right" className="i--sm" /></span>
          </button>
          <p style={{ marginTop: 8 }}><Link to="/login">Already confirmed? Trainee sign in</Link></p>
        </form>
      )}
    </AuthSplit>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'expired'>('idle');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [resent, setResent] = useState('');
  usePageMeta('Confirm email');
  useEffect(() => {
    if (!token) return;
    let cancel = false;
    setState('loading');
    verifyOnce(token)
      .then((result) => {
        if (cancel) return;
        setState('done');
        setMessage(result.message);
      })
      .catch((error: unknown) => {
        if (cancel) return;
        setState('expired');
        setMessage(isApiError(error) ? error.message : 'This confirmation link is missing, used, or expired.');
      });
    return () => {
      cancel = true;
    };
  }, [token]);
  const resend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '');
    const fieldErrors = collect({ email: emailAddress(email) });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    setPending(true);
    try {
      const result = await api<{ message: string }>({ method: 'POST', path: '/public/trainee-signup/resend', body: { email } });
      setResent(result.message || ACCEPTED);
    } catch (error) {
      setResent(isApiError(error) ? error.message : 'The link could not be requested.');
    } finally {
      setPending(false);
    }
  };
  const form = (
    <form onSubmit={(event) => void resend(event)} noValidate>
      <Field id="email" label="Email" error={errors.email}>
        <input className="input" id="email" name="email" type="email" autoComplete="username" aria-invalid={Boolean(errors.email)} required />
      </Field>
      <button className={`btn btn--dark${pending ? ' is-loading' : ''}`} type="submit" disabled={pending} aria-busy={pending || undefined}>
        {pending ? <Loader variant="inline" label="Sending" /> : null}
        Request another link
      </button>
      {resent ? <p role="status" style={{ marginTop: 12 }}>{resent}</p> : null}
    </form>
  );
  return (
    <AuthSplit title="Confirm your email" art="The link works once. Ask for another if it has expired.">
      {token && state === 'loading' ? <p role="status"><Loader variant="inline" label="Checking the link" /> Checking the confirmation link.</p> : null}
      {state === 'done' ? (
        <div>
          <p role="status">{message}</p>
          <p style={{ marginTop: 16 }}><Link className="btn btn--dark" to="/login">Trainee sign in</Link></p>
        </div>
      ) : null}
      {state === 'expired' ? (
        <div>
          <p role="alert">{message}</p>
          <p className="muted">Request another link. The reply does not say whether the email is on the cohort list.</p>
          {form}
        </div>
      ) : null}
      {!token ? (
        <div>
          <p className="muted">Paste is not required. Open the link in the email, or request another one here.</p>
          {form}
        </div>
      ) : null}
    </AuthSplit>
  );
}

export function TraineeLoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mock = usesMockApi();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);
  const unverified = formError.toLowerCase().includes('confirm your email');
  usePageMeta('Trainee sign in');
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
      if (result.user && result.expiresAt !== undefined) rememberSignedIn(result.user, result.expiresAt);
      const next = params.get('next');
      if (result.user?.role === 'trainee') {
        navigate(next && next.startsWith('/portal') ? next : '/portal');
        return;
      }
      navigate('/admin');
    } catch (error) {
      setFormError(isApiError(error) ? error.message : 'Sign-in failed.');
      if (isApiError(error) && error.fieldErrors) setErrors(error.fieldErrors);
    } finally {
      setPending(false);
    }
  };
  return (
    <AuthSplit title="Trainee sign in" art="Confirm the email, then sign in to the portal.">
      <form onSubmit={(event) => void submit(event)} noValidate>
        <ErrorSummary errors={formError ? { form: formError, ...errors } : errors} />
        <Field id="email" label="Email" error={errors.email}>
          <input className="input" id="email" name="email" type="email" autoComplete="username" aria-invalid={Boolean(errors.email)} required />
        </Field>
        <Field id="password" label="Password" error={errors.password}>
          <div className="pw-wrap">
            <input className="input" id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" aria-invalid={Boolean(errors.password)} required />
            <button className="icon-btn" type="button" aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((value) => !value)}><Icon name="eye" className="i--sm" /></button>
          </div>
        </Field>
        {mock ? <label className="check"><input type="checkbox" name="developmentAck" /> I understand this development sign-in is not production authentication</label> : null}
        {errors.developmentAck ? <div className="error-msg" role="alert">{errors.developmentAck}</div> : null}
        <button className={`btn btn--dark${pending ? ' is-loading' : ''}`} type="submit" style={{ justifyContent: 'center' }} disabled={pending} aria-busy={pending || undefined}>
          {pending ? <Loader variant="inline" label="Signing in" /> : null}
          Sign in <span className="arrow"><Icon name="arrow-right" className="i--sm" /></span>
        </button>
        {unverified ? <p style={{ marginTop: 12 }}><Link to="/verify-email">Request another confirmation link</Link></p> : null}
        <p style={{ marginTop: 12 }}><Link to="/forgot-password">Forgot password?</Link></p>
        <p style={{ marginTop: 8 }}><Link to="/signup">Create account</Link></p>
      </form>
    </AuthSplit>
  );
}

export function TraineeForgotPage() {
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  usePageMeta('Forgot password');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '');
    const fieldErrors = collect({ email: emailAddress(email) });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    setPending(true);
    try {
      const result = await api<{ message: string }>({ method: 'POST', path: '/auth/password-reset/request', body: { email } });
      setMessage(result.message);
    } catch (error) {
      setMessage(isApiError(error) ? error.message : 'Reset could not be requested.');
    } finally {
      setPending(false);
    }
  };
  return (
    <AuthSplit title="Forgot your password?" art="If an account exists, the reset link opens in the trainee portal.">
      <p className="muted">If an account exists for that address, a reset message will be sent. The reply does not say whether the mailbox is known.</p>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <ErrorSummary errors={errors} />
        <Field id="email" label="Email" error={errors.email}>
          <input className="input" id="email" name="email" type="email" autoComplete="username" aria-invalid={Boolean(errors.email)} required />
        </Field>
        <button className={`btn btn--dark${pending ? ' is-loading' : ''}`} type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <Loader variant="inline" label="Sending" /> : null}
          Request reset
        </button>
      </form>
      {message ? <p role="status" style={{ marginTop: 16 }}>{message}</p> : null}
      <p style={{ marginTop: 16 }}><Link to="/login">Back to trainee sign in</Link></p>
    </AuthSplit>
  );
}

export function TraineeResetPage() {
  const [params] = useSearchParams();
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  usePageMeta('Choose a new password');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    const confirm = String(data.get('confirm') ?? '');
    const fieldErrors = collect({
      password: newPassword(password),
      confirm: password === confirm ? null : 'The two passwords do not match.',
    });
    setErrors(fieldErrors);
    setMessage('');
    if (Object.keys(fieldErrors).length) return;
    setPending(true);
    try {
      const result = await api<{ message: string }>({
        method: 'POST',
        path: '/auth/password-reset/complete',
        body: { token: params.get('token') ?? '', password, confirm },
      });
      setDone(true);
      setMessage(result.message);
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) setErrors(error.fieldErrors);
      setMessage(isApiError(error) ? error.message : 'Reset failed.');
    } finally {
      setPending(false);
    }
  };
  return (
    <AuthSplit title="Set a new password" art="This link works once. Then sign in to the portal.">
      <p className="muted">Use at least 12 characters, with a letter and a number.</p>
      {done ? <p role="status">{message}</p> : (
        <form onSubmit={(event) => void submit(event)} noValidate>
          <ErrorSummary errors={message ? { form: message, ...errors } : errors} />
          <Field id="password" label="New password" error={errors.password}>
            <input className="input" id="password" name="password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} required />
          </Field>
          <Field id="confirm" label="Confirm password" error={errors.confirm}>
            <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.confirm)} required />
          </Field>
          <button className={`btn btn--dark${pending ? ' is-loading' : ''}`} type="submit" disabled={pending} aria-busy={pending || undefined}>
            {pending ? <Loader variant="inline" label="Saving" /> : null}
            Save password
          </button>
        </form>
      )}
      <p style={{ marginTop: 16 }}><Link to="/login">Trainee sign in</Link></p>
    </AuthSplit>
  );
}

interface PortalMe {
  user: SessionUser;
  traineeId: string | null;
}

export function PortalHomePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState<PortalMe | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  usePageMeta('Trainee portal');
  useEffect(() => {
    let cancel = false;
    api<PortalMe>({ method: 'GET', path: '/portal/me' })
      .then((result) => {
        if (!cancel) setMe(result);
      })
      .catch((err: unknown) => {
        if (!cancel) setError(isApiError(err) ? err.message : 'The portal could not be loaded.');
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, []);
  const signOut = async () => {
    await api({ method: 'POST', path: '/auth/logout' });
    clearSession();
    navigate('/login');
  };
  const name = me?.user.displayName || auth.displayName || 'Trainee';
  const verified = me?.user.emailVerified !== false;
  return (
    <div className="portal-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="portal-bar">
        <Link className="portal-brand" to="/portal"><ShellMark /><span><b>Trainee portal</b><small>2026 cohort</small></span></Link>
        <div className="portal-bar__actions">
          <span>{name}</span>
          <button className="btn btn--sm" type="button" onClick={() => void signOut()}>Log out</button>
        </div>
      </header>
      <main id="main" className="section">
        <div className="container">
          {loading ? <p role="status"><Loader variant="inline" label="Loading the portal" /> Loading your portal.</p> : null}
          {error ? <ErrorState title="The portal could not be opened" text={error} /> : null}
          {!loading && !error ? (
            <>
              <p className="eyebrow">Signed in</p>
              <h1>Hello, {name}.</h1>
              <p className="muted">Your email is {verified ? 'confirmed' : 'not confirmed yet'}.{me?.traineeId ? ` Roster id ${me.traineeId}.` : ''}</p>
              <div className="portal-grid">
                <section className="portal-card"><h2>Profile</h2><p>Coming next. You will edit your public profile here.</p></section>
                <section className="portal-card"><h2>Projects</h2><p>Coming next. Labs and case studies will be listed here.</p></section>
                <section className="portal-card"><h2>Labs</h2><p>Coming next. Completed labs will be recorded here.</p></section>
                <section className="portal-card"><h2>CV</h2><p>Coming next. Your CV stays private until you choose otherwise.</p></section>
              </div>
              {!me ? <EmptyState icon="users" title="Nothing to show yet" text="Sign in again if this stays empty." /> : null}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
