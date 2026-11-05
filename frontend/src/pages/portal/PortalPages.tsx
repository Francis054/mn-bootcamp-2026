import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
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
import { CONSENT_WORDING, githubProblem, linkedinProblem, type PortalProfile, type ProfileFields } from '@/domain/portalProfile';
import { collect, emailAddress, minLength, newPassword, required } from '@/domain/validate';
import { clearSession, rememberSignedIn } from '@/dev/session';
import { CvEditor } from '@/pages/portal/CvEditor';
import { PortfolioEditor } from '@/pages/portal/PortfolioEditor';
import { ProgressEditor } from '@/pages/portal/ProgressEditor';

const verifyJobs = new Map<string, Promise<{ verified: boolean; message: string }>>();

function AccountNotice({ title, text }: { title: string; text: string }) {
  return (
    <div className="account-wait" role="status">
      <p className="eyebrow">Trainee account</p>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState('');
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
      const result = await api<{ message: string }>({
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
    } catch (error) {
      setFormError(isApiError(error) ? error.message : 'The account could not be requested.');
      if (isApiError(error) && error.fieldErrors) setErrors(error.fieldErrors);
    } finally {
      setPending(false);
    }
  };
  return (
    <AuthSplit title="Create your account" art="An administrator approves the account. Then you can sign in.">
      {done ? (
        <div>
          <AccountNotice title="Registration received" text={done} />
          <p style={{ marginTop: 16 }}><Link className="btn btn--dark" to="/login">Trainee sign in</Link></p>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} noValidate>
          <p className="muted" style={{ marginBottom: 16 }}>Use the email the bootcamp already has for you. An administrator approves the account before you can sign in. The reply is the same either way.</p>
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
          <p style={{ marginTop: 8 }}><Link to="/login">Already approved? Trainee sign in</Link></p>
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
  usePageMeta('Trainee account');
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
  return (
    <AuthSplit title="Trainee account" art="An administrator approves the account. Then you can sign in.">
      {token && state === 'loading' ? <p role="status"><Loader variant="inline" label="Checking the link" /> Checking the link.</p> : null}
      {state === 'done' ? (
        <div>
          <p role="status">{message}</p>
          <p style={{ marginTop: 16 }}><Link className="btn btn--dark" to="/login">Trainee sign in</Link></p>
        </div>
      ) : null}
      {state === 'expired' ? (
        <div>
          <AccountNotice title="Waiting for approval" text="This link is missing, used, or expired. Your account becomes active once an administrator approves it. You can sign in after that." />
          <p style={{ marginTop: 16 }}><Link className="btn btn--dark" to="/login">Trainee sign in</Link></p>
        </div>
      ) : null}
      {!token ? (
        <div>
          <AccountNotice title="Waiting for approval" text="Your registration was received. The account is waiting for an administrator to approve it. You can sign in once it is approved." />
          <p style={{ marginTop: 16 }}><Link className="btn btn--dark" to="/login">Trainee sign in</Link></p>
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
  const [notice, setNotice] = useState<{ title: string; text: string } | null>(null);
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
    setNotice(null);
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
      if (result.user?.role === 'trainer') {
        navigate('/trainer');
        return;
      }
      navigate('/admin');
    } catch (error) {
      if (isApiError(error) && error.code === 'TRAINEE_PENDING_APPROVAL') {
        setNotice({ title: 'Waiting for approval', text: error.message });
      } else if (isApiError(error) && error.code === 'TRAINEE_REGISTRATION_REJECTED') {
        setNotice({ title: 'Registration was not approved', text: error.message });
      } else if (isApiError(error) && error.code === 'TRAINEE_ACCOUNT_DEACTIVATED') {
        setNotice({ title: 'Account deactivated', text: error.message });
      } else {
        setFormError(isApiError(error) ? error.message : 'Sign-in failed.');
        if (isApiError(error) && error.fieldErrors) setErrors(error.fieldErrors);
      }
    } finally {
      setPending(false);
    }
  };
  return (
    <AuthSplit title="Trainee sign in" art="Sign in after an administrator approves the account.">
      {notice ? <AccountNotice title={notice.title} text={notice.text} /> : null}
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
        <p style={{ marginTop: 12 }}><Link to="/forgot-password">Forgot password?</Link></p>
        <p style={{ marginTop: 8 }}><Link to="/signup">Sign up</Link></p>
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

export function PortalFrame({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState<PortalMe | null>(null);
  const [error, setError] = useState('');
  const name = me?.user.displayName || auth.displayName || 'Trainee';
  useEffect(() => {
    let cancel = false;
    api<PortalMe>({ method: 'GET', path: '/portal/me' })
      .then((result) => {
        if (!cancel) setMe(result);
      })
      .catch((err: unknown) => {
        if (!cancel) setError(isApiError(err) ? err.message : 'The portal could not be loaded.');
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
          <nav className="portal-nav" aria-label="Portal sections">
            <NavLink to="/portal" end>Profile</NavLink>
            <NavLink to="/portal/journey">Journey</NavLink>
          </nav>
          {error ? <ErrorState title="The portal could not be opened" text={error} /> : children}
        </div>
      </main>
    </div>
  );
}

export function PortalHomePage() {
  const auth = useAuth();
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
  const name = me?.user.displayName || auth.displayName || 'Trainee';
  const verified = me?.user.emailVerified !== false;
  return (
    <PortalFrame>
      {loading ? <p role="status"><Loader variant="inline" label="Loading the portal" /> Loading your portal.</p> : null}
      {error ? <ErrorState title="The portal could not be opened" text={error} /> : null}
      {!loading && !error ? (
        <>
          <p className="eyebrow">Signed in</p>
          <h1>Hello, {name}.</h1>
          <p className="muted">{verified ? 'Your account is active.' : 'Waiting for an administrator to approve this account.'}{me?.traineeId ? ` Roster id ${me.traineeId}.` : ''}</p>
          <ProfileEditor />
          <PasswordCard />
          <PortfolioEditor />
          <ProgressEditor />
          <CvEditor />
          {!me ? <EmptyState icon="users" title="Nothing to show yet" text="Sign in again if this stays empty." /> : null}
        </>
      ) : null}
    </PortalFrame>
  );
}

const STATUS_LABEL: Record<PortalProfile['status'], string> = {
  draft: 'Draft',
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
};

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    setError('');
    setPending(true);
    try {
      const result = await api<{ message: string }>({
        method: 'POST',
        path: '/account/password',
        body: { current, next, confirm },
      });
      setNotice(result.message);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (caught) {
      setError(isApiError(caught) ? caught.message : 'The password could not be changed.');
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="portal-card" aria-labelledby="password-title">
      <h2 id="password-title">Password</h2>
      <p className="muted">Use at least 12 characters, with a letter and a number.</p>
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <form className="portal-form" onSubmit={(event) => void save(event)}>
        <Field id="password-current" label="Current password">
          <input className="input" id="password-current" type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} />
        </Field>
        <Field id="password-next" label="New password">
          <input className="input" id="password-next" type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} />
        </Field>
        <Field id="password-confirm" label="Confirm new password">
          <input className="input" id="password-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </Field>
        <button className="btn btn--dark" type="submit" disabled={pending}>Change password</button>
      </form>
    </section>
  );
}

function ProfileEditor() {
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [fields, setFields] = useState<ProfileFields | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let cancel = false;
    api<PortalProfile>({ method: 'GET', path: '/portal/profile' })
      .then((result) => {
        if (cancel) return;
        setProfile(result);
        setFields(result.draft);
      })
      .catch((error: unknown) => {
        if (!cancel) setFormError(isApiError(error) ? error.message : 'Your profile could not be loaded.');
      });
    return () => {
      cancel = true;
    };
  }, []);
  if (formError && !profile) return <ErrorState title="Your profile could not be opened" text={formError} />;
  if (!profile || !fields) return <p role="status"><Loader variant="inline" label="Loading your profile" /> Loading your profile.</p>;
  const set = (key: keyof ProfileFields, value: string) => {
    setFields({ ...fields, [key]: value });
  };
  const save = async () => {
    const fieldErrors = profileErrors(fields);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return false;
    setPending(true);
    setFormError('');
    try {
      const saved = await api<PortalProfile>({
        method: 'PATCH',
        path: '/portal/profile',
        body: {
          displayName: fields.displayName,
          headline: fields.headline,
          bio: fields.bio,
          location: fields.location,
          linkedin: fields.linkedin,
          githubUrl: fields.githubUrl,
          portfolio: fields.portfolio,
        },
      });
      setProfile(saved);
      setFields(saved.draft);
      setNotice('Saved. Submit it when you want an administrator to review the public version.');
      return true;
    } catch (error) {
      setFormError(isApiError(error) ? error.message : 'The profile could not be saved.');
      if (isApiError(error) && error.fieldErrors) setErrors(error.fieldErrors);
      return false;
    } finally {
      setPending(false);
    }
  };
  const submit = async () => {
    const saved = await save();
    if (!saved) return;
    setPending(true);
    try {
      const result = await api<PortalProfile>({ method: 'POST', path: '/portal/profile/submit' });
      setProfile(result);
      setFields(result.draft);
      setNotice('Submitted. The last approved version stays public until this one is approved.');
    } catch (error) {
      setFormError(isApiError(error) ? error.message : 'The profile could not be submitted.');
    } finally {
      setPending(false);
    }
  };
  const consent = async (key: 'publicProfile' | 'publicPhoto' | 'contactRelay', granted: boolean) => {
    setPending(true);
    setFormError('');
    try {
      const result = await api<PortalProfile>({ method: 'PUT', path: '/portal/consents', body: { [key]: granted } });
      setProfile(result);
      setNotice('Consent saved.');
    } catch (error) {
      setFormError(isApiError(error) ? error.message : 'Consent could not be saved.');
    } finally {
      setPending(false);
    }
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const payload = new FormData();
    payload.set('file', file);
    setPending(true);
    setFormError('');
    try {
      const result = await api<PortalProfile>({ method: 'POST', path: '/portal/profile/photo', body: payload });
      setProfile(result);
      setFields(result.draft);
      setNotice('Photo saved on your draft. It is not public until it is approved and you allow the photo.');
    } catch (error) {
      setFormError(isApiError(error) ? error.message : 'The photo could not be uploaded.');
      if (isApiError(error) && error.fieldErrors) setErrors(error.fieldErrors);
    } finally {
      setPending(false);
    }
  };
  const removePhoto = async () => {
    setPending(true);
    try {
      const result = await api<PortalProfile>({ method: 'DELETE', path: '/portal/profile/photo' });
      setProfile(result);
      setFields(result.draft);
    } catch (error) {
      setFormError(isApiError(error) ? error.message : 'The photo could not be removed.');
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="portal-card portal-profile" aria-labelledby="profile-title">
      <h2 id="profile-title">Your profile</h2>
      <p className="portal-status" role="status">
        <span className="tag">{STATUS_LABEL[profile.status]}</span>
        {profile.status === 'pending' ? ' An administrator still has to approve this version. The last approved version stays on the public site.' : null}
        {profile.status === 'approved' ? ' This version can appear on the public site when your consent allows it.' : null}
        {profile.status === 'draft' ? ' This draft is not the public version yet.' : null}
      </p>
      {profile.status === 'rejected' ? <p role="alert">Rejected: {profile.rejectionReason}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      <ErrorSummary errors={formError ? { form: formError, ...errors } : errors} />
      <div className="portal-form">
        <Field id="profile-name" label="Display name" error={errors.displayName}>
          <input className="input" id="profile-name" value={fields.displayName} onChange={(event) => set('displayName', event.target.value)} autoComplete="name" />
        </Field>
        <Field id="profile-headline" label="Headline" error={errors.headline} hint="A short line, such as the role you are aiming for.">
          <input className="input" id="profile-headline" value={fields.headline} onChange={(event) => set('headline', event.target.value)} />
        </Field>
        <Field id="profile-bio" label="Short bio" error={errors.bio}>
          <textarea className="textarea" id="profile-bio" value={fields.bio} onChange={(event) => set('bio', event.target.value)} rows={5} />
        </Field>
        <Field id="profile-location" label="Location" error={errors.location} hint="City or country only.">
          <input className="input" id="profile-location" value={fields.location} onChange={(event) => set('location', event.target.value)} autoComplete="address-level2" />
        </Field>
        <Field id="profile-linkedin" label="LinkedIn" error={errors.linkedin} hint="A https://www.linkedin.com link, or leave this blank.">
          <input className="input" id="profile-linkedin" value={fields.linkedin ?? ''} onChange={(event) => set('linkedin', event.target.value)} inputMode="url" />
        </Field>
        <Field id="profile-github" label="GitHub" error={errors.githubUrl} hint="A https://github.com link, or leave this blank.">
          <input className="input" id="profile-github" value={fields.githubUrl ?? ''} onChange={(event) => set('githubUrl', event.target.value)} inputMode="url" />
        </Field>
        <Field id="profile-portfolio" label="Portfolio" error={errors.portfolio} hint="Another https link, or leave this blank.">
          <input className="input" id="profile-portfolio" value={fields.portfolio ?? ''} onChange={(event) => set('portfolio', event.target.value)} inputMode="url" />
        </Field>
        <Field id="profile-photo" label="Profile photo" error={errors.photoUrl} hint="JPEG, PNG, or WebP. SVG files are not accepted. Location data is removed.">
          {fields.photoUrl ? <img className="portal-photo" src={fields.photoUrl} alt="" /> : <p className="muted">No photo on this draft.</p>}
          <input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event.target.files?.[0])} />
          {fields.photoUrl ? <button className="btn btn--sm" type="button" onClick={() => void removePhoto()} disabled={pending}>Remove photo</button> : null}
        </Field>
      </div>
      <fieldset className="portal-consent">
        <legend>Consent</legend>
        <p className="muted">Wording version {profile.policyVersion}. You can change these at any time.</p>
        <label className="check"><input type="checkbox" checked={profile.consents.publicProfile} onChange={(event) => void consent('publicProfile', event.target.checked)} /> {CONSENT_WORDING.publicProfile}</label>
        <label className="check"><input type="checkbox" checked={profile.consents.publicPhoto} onChange={(event) => void consent('publicPhoto', event.target.checked)} /> {CONSENT_WORDING.publicPhoto}</label>
        <label className="check"><input type="checkbox" checked={profile.consents.contactRelay} onChange={(event) => void consent('contactRelay', event.target.checked)} /> {CONSENT_WORDING.contactRelay}</label>
      </fieldset>
      <div className="portal-actions">
        <button className="btn btn--dark" type="button" onClick={() => void save()} disabled={pending}>Save profile</button>
        <button className="btn" type="button" onClick={() => void submit()} disabled={pending || profile.status === 'pending'}>Submit for review</button>
      </div>
    </section>
  );
}

function profileErrors(fields: ProfileFields): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!fields.displayName.trim()) errors.displayName = 'Enter a display name.';
  else if (fields.displayName.trim().length > 120) errors.displayName = 'Use at most 120 characters.';
  if (fields.headline.trim().length > 160) errors.headline = 'Use at most 160 characters.';
  if (fields.bio.length > 5000) errors.bio = 'Use at most 5000 characters.';
  if (fields.location.trim().length > 120) errors.location = 'Use at most 120 characters.';
  const linkedin = linkedinProblem(fields.linkedin ?? '');
  const github = githubProblem(fields.githubUrl ?? '');
  if (linkedin) errors.linkedin = linkedin;
  if (github) errors.githubUrl = github;
  const portfolio = (fields.portfolio ?? '').trim();
  if (portfolio && !portfolio.startsWith('https://')) errors.portfolio = 'Enter a full link starting with https://.';
  return errors;
}
