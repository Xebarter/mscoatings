import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { isAdminEmail, saveOfflineSession } from '@/lib/admin-auth';
import { getStaffByEmail } from '@/lib/firestore';
import type { Permissions, StaffRole } from '@/lib/types';
import { getPermissionsForRole } from '@/lib/roles';

export type AccessStatus = 'loading' | 'none' | 'super_admin' | 'staff' | 'pending';

export interface AuthState {
  user: User | null;
  accessStatus: AccessStatus;
  role: StaffRole | null;
  permissions: Permissions | null;
  loading: boolean;
  hasAccess: boolean;
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
        await saveOfflineSession(user);
        setState({
          user,
          accessStatus: 'super_admin',
          role: 'admin',
          permissions: getPermissionsForRole('admin'),
          loading: false,
          hasAccess: true,
        });
        return;
      }

      try {
        const staff = await getStaffByEmail(user.email);
        if (staff?.active) {
          await saveOfflineSession(user);
          const isSuper = Boolean(staff.isSuperAdmin);
          setState({
            user,
            accessStatus: isSuper ? 'super_admin' : 'staff',
            role: staff.role,
            permissions: getPermissionsForRole(staff.role),
            loading: false,
            hasAccess: true,
          });
          return;
        }

        if (staff && !staff.active) {
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

        setState({
          user,
          accessStatus: 'none',
          role: null,
          permissions: null,
          loading: false,
          hasAccess: false,
        });
      } catch {
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
