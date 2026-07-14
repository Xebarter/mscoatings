import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { Clock, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '@/lib/firebase';
import { clearOfflineSession } from '@/lib/admin-auth';
import { getStaffByEmail } from '@/lib/firestore';
import { useAuth } from '@/hooks/useAuth';
import Logo from '@/components/Logo';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function PendingApprovalPage() {
  const { user, accessStatus, loading, hasAccess } = useAuth();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!user?.email || hasAccess) return;
    if (!navigator.onLine) return;

    const interval = setInterval(async () => {
      if (!navigator.onLine) return;
      try {
        const staff = await getStaffByEmail(user.email!);
        if (staff?.active) {
          window.location.hash = '#/';
          window.location.reload();
        }
      } catch {
        /* ignore polling errors */
      }
    }, 15_000);

    return () => clearInterval(interval);
  }, [user, hasAccess]);

  const handleRefresh = async () => {
    if (!user?.email) return;
    if (!navigator.onLine) {
      toast.error('Connect to the internet to check approval status');
      return;
    }
    setChecking(true);
    try {
      const staff = await getStaffByEmail(user.email);
      if (staff?.active) {
        toast.success('Access granted! Loading dashboard…');
        window.location.hash = '#/';
        window.location.reload();
        return;
      }
      toast('Still waiting for approval', { icon: '⏳' });
    } catch {
      toast.error('Could not check approval status');
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await clearOfflineSession();
    await signOut(auth);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (hasAccess) {
    return <Navigate to="/" replace />;
  }

  if (accessStatus === 'none') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-8 text-center shadow-2xl sm:p-10">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" textVariant="dark" />
        </div>

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
          <Clock size={28} className="text-amber-600" />
        </div>

        <h1 className="text-xl font-bold text-slate-900">Awaiting approval</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your account <span className="font-medium text-slate-700">{user.email}</span> was
          created successfully. A Super Admin must grant you access from the web admin dashboard
          before you can use the ERP.
        </p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={checking}
            className="w-full rounded-xl bg-gradient-to-r from-[#0077c8] to-[#19b5fe] py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {checking ? 'Checking…' : 'Check approval status'}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
