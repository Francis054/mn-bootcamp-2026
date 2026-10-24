import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSyncExternalStore } from 'react';
import { api } from '@/api/client';
import { usesMockApi } from '@/config/runtime';
import type { Permission, Role, SessionUser } from '@/domain/types';
import { can } from '@/domain/permissions';
import { clearSession, expireIfNeeded, getSessionSnapshot, rememberSignedIn, subscribeSession } from '@/dev/session';

interface AuthValue {
  signedIn: boolean;
  expired: boolean;
  role: Role | null;
  displayName: string;
  initials: string;
  hue: number;
  email: string;
  allowed: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthValue>({
  signedIn: false, expired: false, role: null, displayName: '', initials: '', hue: 140, email: '', allowed: () => false,
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
        if (!cancel) setReady(true);
      });
    return () => { cancel = true; };
  }, []);
  if (!ready) return null;
  const user = snapshot.session?.user;
  const value: AuthValue = {
    signedIn: Boolean(user),
    expired: snapshot.expired,
    role: user?.role ?? null,
    displayName: user?.displayName ?? '',
    initials: user?.initials ?? '',
    hue: user?.hue ?? 140,
    email: user?.email ?? '',
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
  if (!auth.signedIn && auth.expired) return <Navigate to="/admin/session-expired" replace />;
  if (!auth.signedIn) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/admin/login?reason=unauthorized&next=${next}`} replace />;
  }
  if (!auth.allowed(permission)) return <Navigate to="/admin/forbidden" replace />;
  return children;
}
