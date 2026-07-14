import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CloudOff, LogIn, Monitor } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/lib/firebase';
import {
  ADMIN_ACCESS_DENIED_MESSAGE,
  saveOfflineSession,
  userHasAdminRole,
} from '@/lib/admin-auth';
import { useAuth } from '@/hooks/useAuth';
import { useOnline } from '@/hooks/useOnline';
import Logo from '@/components/Logo';
import LoadingSpinner from '@/components/LoadingSpinner';

function getLoginError(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    if (!navigator.onLine) {
      return 'You are offline. Sign-in requires internet the first time. If you signed in before, wait for your session to restore.';
    }
    return 'Failed to login. Please try again.';
  }
  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network unavailable. Connect to the internet to sign in for the first time.';
    default:
      return 'Failed to login. Please try again.';
  }
}

export default function LoginPage() {
  const { user, isAdmin, loading } = useAuth();
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (user && isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter email and password');
      return;
    }

    if (!online) {
      toast.error('Connect to the internet to sign in. After that, the app works offline.');
      return;
    }

    setIsSubmitting(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (!userHasAdminRole(credential.user)) {
        await signOut(auth);
        toast.error(ADMIN_ACCESS_DENIED_MESSAGE);
        return;
      }
      await saveOfflineSession(credential.user);
      toast.success('Welcome back!');
    } catch (error) {
      toast.error(getLoginError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f172a] px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/40 sm:p-10">
          <div className="mb-8 flex flex-col items-center">
            <Logo size="lg" showText={false} />
            <div className="mt-4 flex items-center gap-2 text-slate-500">
              <Monitor size={16} />
              <span className="text-sm font-medium">Desktop Admin Console</span>
            </div>
          </div>

          <h1 className="mb-2 text-center text-2xl font-extrabold text-[#0f172a]">
            Sign In
          </h1>
          <p className="mb-8 text-center text-sm text-slate-500">
            Access your MS Coatings ERP dashboard
          </p>

          {!online && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <CloudOff size={18} className="mt-0.5 shrink-0" />
              <p>
                You are offline. First-time sign-in needs internet. If you signed in before on
                this device, your session should restore automatically — wait a moment or reopen
                the app.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#0f172a]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mscoatings.shop"
                autoComplete="email"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#0f172a] transition focus:border-[#0077c8] focus:outline-none focus:ring-2 focus:ring-[#0077c8]/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#0f172a]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#0f172a] transition focus:border-[#0077c8] focus:outline-none focus:ring-2 focus:ring-[#0077c8]/20"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !online}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0077c8] to-[#19b5fe] py-3 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:shadow-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogIn size={20} />
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          MS Coatings ERP · Works offline after first sign-in
        </p>
      </motion.div>
    </div>
  );
}
