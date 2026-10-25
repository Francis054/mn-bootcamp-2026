import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSyncExternalStore } from 'react';
import { api } from '@/api/client';
import { usesMockApi } from '@/config/runtime';
import type { Permission, Role, SessionUser } from '@/domain/types';
import { can } from '@/domain/permissions';
import { clearSession, expireIfNeeded, getSessionSnapshot, rememberSignedIn, subscribeSession } from '@/dev/session';

interface AuthValue {
  ready: boolean;
  signedIn: boolean;
  expired: boolean;
  role: Role | null;
  displayName: string;
  initials: string;
  hue: number;
  email: string;
  userId: string;
  allowed: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthValue>({
  ready: true, signedIn: false, expired: false, role: null, displayName: '', initials: '', hue: 140, email: '', userId: '', allowed: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeSession, getSessionSnapshot);
  const [ready, setReady] = useState(() => usesMockApi());
  useEffect(() => {
    const timer = window.setInterval(() => expireIfNeeded(), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (usesMockApi()) return;
    let cancel = false;
    const slow = window.setTimeout(() => {
      if (!cancel) setReady(true);
    }, 15_000);
    void api<{ authenticated: boolean; user?: SessionUser; expiresAt?: string }>({ method: 'GET', path: '/auth/session' })
      .then((result) => {
        if (cancel) return;
        if (result.authenticated && result.user && result.expiresAt) rememberSignedIn(result.user, result.expiresAt);
        else clearSession();
      })
      .catch(() => {
        if (!cancel) clearSession();
      })
      .finally(() => {
        window.clearTimeout(slow);
        if (!cancel) setReady(true);
      });
    return () => {
      cancel = true;
      window.clearTimeout(slow);
    };
  }, []);
  const user = snapshot.session?.user;
  const value: AuthValue = {
    ready,
    signedIn: Boolean(user),
    expired: snapshot.expired,
    role: user?.role ?? null,
    displayName: user?.displayName ?? '',
    initials: user?.initials ?? '',
    hue: user?.hue ?? 140,
    email: user?.email ?? '',
    userId: user?.id ?? '',
    allowed: (permission) => (user ? can(user.role, permission) : false),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RequireAccess({ permission, children }: { permission: Permission; children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.ready) {
    return <main id="main"><section className="section"><div className="container"><h1>Checking your session…</h1><p>The public site stays available while this finishes.</p></div></section></main>;
  }
  if (!auth.signedIn && auth.expired) return <Navigate to="/admin/session-expired" replace />;
  if (!auth.signedIn) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/admin/login?reason=unauthorized&next=${next}`} replace />;
  }
  if (!auth.allowed(permission)) return <Navigate to="/admin/forbidden" replace />;
  return children;
}
