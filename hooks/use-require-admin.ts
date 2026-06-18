'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ADMIN_ACCESS_DENIED_MESSAGE, userHasAdminRole } from '@/lib/admin-auth';
import toast from 'react-hot-toast';

export type AdminAuthStatus = 'loading' | 'authorized' | 'unauthorized';

export function useRequireAdmin() {
  const router = useRouter();
  const [status, setStatus] = useState<AdminAuthStatus>('loading');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus('unauthorized');
        router.replace('/admin/login');
        return;
      }

      try {
        const isAdmin = userHasAdminRole(user);
        if (!isAdmin) {
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
