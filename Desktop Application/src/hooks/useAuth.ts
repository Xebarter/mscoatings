import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  getOfflineSession,
  isAdminEmail,
  saveOfflineSession,
} from '@/lib/admin-auth';
import { getStaffByEmail, warmOfflineCache } from '@/lib/firestore';
import type { Permissions, StaffRole } from '@/lib/types';
import { getPermissionsForRole } from '@/lib/roles';
import { isOnline } from '@/lib/offline/connectivity';

export type AccessStatus = 'loading' | 'none' | 'super_admin' | 'staff' | 'pending';

export interface AuthState {
  user: User | null;
  accessStatus: AccessStatus;
  role: StaffRole | null;
  permissions: Permissions | null;
  loading: boolean;
  hasAccess: boolean;
}

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

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessStatus: 'loading',
    role: null,
    permissions: null,
    loading: true,
    hasAccess: false,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user?.email) {
        setState({
          user: null,
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
        setState({
          user,
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
        if (staff?.active) {
          const isSuper = Boolean(staff.isSuperAdmin);
          const accessStatus = isSuper ? 'super_admin' : 'staff';
          await saveOfflineSession(user, {
            accessStatus,
            role: staff.role,
            isSuperAdmin: isSuper,
            active: true,
          });
          setState({
            user,
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
          setState({
            user,
            accessStatus: 'pending',
            role: null,
            permissions: null,
            loading: false,
            hasAccess: false,
          });
          return;
        }

        // Staff doc missing — only demote if we have no prior approved offline session.
        const session = await getOfflineSession();
        if (session?.uid === user.uid) {
          const restored = accessFromSession(session);
          if (restored?.hasAccess) {
            setState({
              user,
              ...restored,
              loading: false,
            });
            return;
          }
          if (restored?.accessStatus === 'pending') {
            setState({
              user,
              accessStatus: 'pending',
              role: null,
              permissions: null,
              loading: false,
              hasAccess: false,
            });
            return;
          }
        }

        setState({
          user,
          accessStatus: 'none',
          role: null,
          permissions: null,
          loading: false,
          hasAccess: false,
        });
      } catch {
        // Offline / cache miss: keep previously approved sessions usable.
        const session = await getOfflineSession();
        if (session?.uid === user.uid) {
          const restored = accessFromSession(session);
          if (restored) {
            setState({
              user,
              ...restored,
              loading: false,
            });
            return;
          }
        }

        setState({
          user,
          accessStatus: 'none',
          role: null,
          permissions: null,
          loading: false,
          hasAccess: false,
        });
      }
    });

    return unsubscribe;
  }, []);

  return state;
}
