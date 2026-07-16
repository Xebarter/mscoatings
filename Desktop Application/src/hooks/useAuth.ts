import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  getOfflineSession,
  isAdminEmail,
  saveOfflineSession,
  touchOfflineSession,
} from '@/lib/admin-auth';
import { getStaffByEmail, warmOfflineCache } from '@/lib/firestore';
import type { Permissions, StaffRole } from '@/lib/types';
import { getPermissionsForRole } from '@/lib/roles';
import { isOnline } from '@/lib/offline/connectivity';

export type AccessStatus = 'loading' | 'none' | 'super_admin' | 'staff' | 'pending';

export interface AuthState {
  user: User | null;
  /** Email from Firebase user or trusted offline session */
  email: string | null;
  accessStatus: AccessStatus;
  role: StaffRole | null;
  permissions: Permissions | null;
  loading: boolean;
  hasAccess: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

function accessFromSession(session: Awaited<ReturnType<typeof getOfflineSession>>): {
  accessStatus: AccessStatus;
  role: StaffRole | null;
  permissions: Permissions | null;
  hasAccess: boolean;
} | null {
  if (!session?.accessStatus) return null;
  if (session.accessStatus === 'pending') {
    return {
      accessStatus: 'pending',
      role: null,
      permissions: null,
      hasAccess: false,
    };
  }
  if (session.accessStatus === 'super_admin' || session.accessStatus === 'staff') {
    const role = session.role ?? 'sales';
    return {
      accessStatus: session.accessStatus,
      role,
      permissions: getPermissionsForRole(role),
      hasAccess: true,
    };
  }
  return null;
}

async function restoreTrustedOfflineSession(): Promise<AuthState | null> {
  const session = await getOfflineSession();
  const restored = accessFromSession(session);
  if (!session || !restored?.hasAccess) return null;

  await touchOfflineSession();
  return {
    user: null,
    email: session.email,
    ...restored,
    loading: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    email: null,
    accessStatus: 'loading',
    role: null,
    permissions: null,
    loading: true,
    hasAccess: false,
  });

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user?.email) {
        // Firebase Auth briefly null on startup / token refresh — keep desktop session
        // until the user explicitly signs out (which clears the offline session).
        const trusted = await restoreTrustedOfflineSession();
        if (cancelled) return;
        if (trusted) {
          setState(trusted);
          return;
        }
        setState({
          user: null,
          email: null,
          accessStatus: 'none',
          role: null,
          permissions: null,
          loading: false,
          hasAccess: false,
        });
        return;
      }

      if (isAdminEmail(user.email)) {
        await saveOfflineSession(user, {
          accessStatus: 'super_admin',
          role: 'admin',
          isSuperAdmin: true,
          active: true,
        });
        if (cancelled) return;
        setState({
          user,
          email: user.email.toLowerCase(),
          accessStatus: 'super_admin',
          role: 'admin',
          permissions: getPermissionsForRole('admin'),
          loading: false,
          hasAccess: true,
        });
        if (isOnline()) {
          void warmOfflineCache().catch(() => undefined);
        }
        return;
      }

      try {
        const staff = await getStaffByEmail(user.email);
        if (cancelled) return;

        if (staff?.active) {
          const isSuper = Boolean(staff.isSuperAdmin);
          const accessStatus = isSuper ? 'super_admin' : 'staff';
          await saveOfflineSession(user, {
            accessStatus,
            role: staff.role,
            isSuperAdmin: isSuper,
            active: true,
          });
          if (cancelled) return;
          setState({
            user,
            email: user.email.toLowerCase(),
            accessStatus,
            role: staff.role,
            permissions: getPermissionsForRole(staff.role),
            loading: false,
            hasAccess: true,
          });
          if (isOnline()) {
            void warmOfflineCache().catch(() => undefined);
          }
          return;
        }

        if (staff && !staff.active) {
          await saveOfflineSession(user, {
            accessStatus: 'pending',
            active: false,
          });
          if (cancelled) return;
          setState({
            user,
            email: user.email.toLowerCase(),
            accessStatus: 'pending',
            role: null,
            permissions: null,
            loading: false,
            hasAccess: false,
          });
          return;
        }

        // Staff doc missing — keep prior approved offline session (do not kick out).
        const session = await getOfflineSession();
        if (session?.uid === user.uid) {
          const restored = accessFromSession(session);
          if (restored?.hasAccess) {
            await touchOfflineSession();
            if (cancelled) return;
            setState({
              user,
              email: user.email.toLowerCase(),
              ...restored,
              loading: false,
            });
            return;
          }
          if (restored?.accessStatus === 'pending') {
            if (cancelled) return;
            setState({
              user,
              email: user.email.toLowerCase(),
              accessStatus: 'pending',
              role: null,
              permissions: null,
              loading: false,
              hasAccess: false,
            });
            return;
          }
        }

        if (cancelled) return;
        setState({
          user,
          email: user.email.toLowerCase(),
          accessStatus: 'none',
          role: null,
          permissions: null,
          loading: false,
          hasAccess: false,
        });
      } catch {
        // Network/cache errors must not sign the user out of the desktop app.
        const session = await getOfflineSession();
        if (session?.uid === user.uid) {
          const restored = accessFromSession(session);
          if (restored) {
            await touchOfflineSession();
            if (cancelled) return;
            setState({
              user,
              email: user.email.toLowerCase(),
              ...restored,
              loading: false,
            });
            return;
          }
        }

        const trusted = await restoreTrustedOfflineSession();
        if (cancelled) return;
        if (trusted) {
          setState({ ...trusted, user });
          return;
        }

        setState({
          user,
          email: user.email.toLowerCase(),
          accessStatus: 'none',
          role: null,
          permissions: null,
          loading: false,
          hasAccess: false,
        });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => state, [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
