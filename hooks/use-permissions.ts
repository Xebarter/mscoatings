'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { isAdminEmail } from '@/lib/admin-auth';
import { getStaffByEmailClient } from '@/lib/firestore';
import type { Permissions, StaffRole } from '@/lib/erp-types';
import { getPermissionsForRole } from '@/lib/roles';

interface UsePermissionsResult {
  loading: boolean;
  email: string | null;
  role: StaffRole | null;
  permissions: Permissions | null;
  can: (key: keyof Permissions) => boolean;
}

export function usePermissions(): UsePermissionsResult {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user?.email) {
        setEmail(null);
        setRole(null);
        setPermissions(null);
        setLoading(false);
        return;
      }

      setEmail(user.email);

      if (isAdminEmail(user.email)) {
        setRole('admin');
        setPermissions(getPermissionsForRole('admin'));
        setLoading(false);
        return;
      }

      try {
        const staff = await getStaffByEmailClient(user.email);
        if (staff?.active) {
          setRole(staff.role);
          setPermissions(getPermissionsForRole(staff.role));
        } else {
          setRole(null);
          setPermissions(null);
        }
      } catch {
        setRole(null);
        setPermissions(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const can = (key: keyof Permissions): boolean => {
    if (!permissions) return false;
    const value = permissions[key];
    return typeof value === 'boolean' ? value : false;
  };

  return { loading, email, role, permissions, can };
}
