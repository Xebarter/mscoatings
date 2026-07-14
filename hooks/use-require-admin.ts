'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ADMIN_ACCESS_DENIED_MESSAGE, isAdminEmail } from '@/lib/admin-auth';
import { getStaffByEmailClient } from '@/lib/firestore';
import toast from 'react-hot-toast';

export type AdminAuthStatus = 'loading' | 'authorized' | 'unauthorized';

/** Bootstrap Super Admins, promoted Super Admins, or active Admins may use the web console. */
export function useRequireAdmin() {
  const router = useRouter();
  const [status, setStatus] = useState<AdminAuthStatus>('loading');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user?.email) {
        setStatus('unauthorized');
        router.replace('/admin/login');
        return;
      }

      try {
        if (isAdminEmail(user.email)) {
          setStatus('authorized');
          return;
        }

        const staff = await getStaffByEmailClient(user.email);
        const allowed =
          Boolean(staff?.active) &&
          (staff?.isSuperAdmin === true || staff?.role === 'admin');

        if (!allowed) {
          await signOut(auth);
          toast.error(ADMIN_ACCESS_DENIED_MESSAGE);
          setStatus('unauthorized');
          router.replace('/admin/login');
          return;
        }

        setStatus('authorized');
      } catch (error) {
        console.error('Admin authorization error:', error);
        toast.error('Unable to verify admin access. Please try again.');
        setStatus('unauthorized');
        router.replace('/admin/login');
      }
    });

    return unsubscribe;
  }, [router]);

  return status;
}
