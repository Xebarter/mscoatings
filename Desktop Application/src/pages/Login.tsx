import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  CloudOff,
  LogIn,
  LogOut,
  Monitor,
  Send,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/lib/firebase';
import { clearOfflineSession } from '@/lib/admin-auth';
import { requestStaffAccess } from '@/lib/staff';
import { useAuth } from '@/hooks/useAuth';
import { useOnline } from '@/hooks/useOnline';
import Logo from '@/components/Logo';
import LoadingSpinner from '@/components/LoadingSpinner';

function NoAccessPanel({
  email,
  displayName,
}: {
  email: string;
  displayName: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleRequest = async () => {
    setSubmitting(true);
    try {
      await requestStaffAccess(displayName);
      setSubmitted(true);
      toast.success('Request submitted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await clearOfflineSession();
    await signOut(auth);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f172a] px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-[#0077c8]/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 h-[26rem] w-[26rem] rounded-full bg-[#19b5fe]/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative w-full max-w-[380px]"
      >
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-black/40">
          <div className="h-1 w-full bg-gradient-to-r from-[#0077c8] to-[#19b5fe]" />

          <div className="px-8 py-9 text-center sm:px-9">
            <div className="mb-6 flex justify-center">
              <Logo size="lg" textVariant="dark" showText={false} />
            </div>

            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
              <ShieldAlert size={24} className="text-amber-600" strokeWidth={1.75} />
            </div>

            <h1 className="text-xl font-extrabold tracking-tight text-[#0f172a]">
              No access yet
            </h1>
            <p className="mt-2 text-sm text-slate-500">{email}</p>
            <p className="mt-3 text-sm text-slate-500">
              {submitted
                ? 'Waiting for Super Admin approval.'
                : 'Request access from a Super Admin.'}
            </p>

            <div className="mt-7 space-y-2.5">
              {!submitted && (
                <button
                  type="button"
                  onClick={handleRequest}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0077c8] to-[#19b5fe] py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  <Send size={16} />
                  {submitting ? 'Submitting…' : 'Request access'}
                </button>
              )}
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
      </motion.div>
    </div>
  );
}

function getLoginError(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    if (!navigator.onLine) {
      return 'You are offline. Sign-in requires internet the first time.';
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
      return 'Network unavailable. Connect to the internet to sign in.';
    default:
      return 'Failed to login. Please try again.';
  }
}

function getSignupError(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return 'Failed to create account. Please try again.';
  }
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Sign in instead.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    default:
      return getLoginError(error);
  }
}

export default function LoginPage() {
  const { user, hasAccess, accessStatus, loading } = useAuth();
  const online = useOnline();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState('');
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

  if (hasAccess) {
    return <Navigate to="/" replace />;
  }

  if (user && accessStatus === 'pending') {
    return <Navigate to="/pending" replace />;
  }

  if (user && !hasAccess) {
    return (
      <NoAccessPanel
        email={user.email ?? ''}
        displayName={user.displayName || user.email?.split('@')[0] || 'Team member'}
      />
    );
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter email and password');
      return;
    }
    if (!online) {
      toast.error('Connect to the internet to sign in.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Signed in');
    } catch (error) {
      toast.error(getLoginError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (!online) {
      toast.error('Connect to the internet to create an account.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      await requestStaffAccess(displayName.trim());
      toast.success('Account created! Waiting for Super Admin approval.');
    } catch (error) {
      toast.error(getSignupError(error));
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
            <Logo size="lg" textVariant="dark" className="justify-center" />
            <div className="mt-4 flex items-center gap-2 text-slate-500">
              <Monitor size={16} />
              <span className="text-sm font-medium">Desktop Admin Console</span>
            </div>
          </div>

          <div className="mb-6 flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                mode === 'signin'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Create Account
            </button>
          </div>

          <h1 className="mb-2 text-center text-2xl font-extrabold text-[#0f172a]">
            {mode === 'signin' ? 'Welcome back' : 'Request access'}
          </h1>
          <p className="mb-8 text-center text-sm text-slate-500">
            {mode === 'signin'
              ? 'Sign in with your approved account'
              : 'Create an account — a Super Admin must approve before you can access the dashboard'}
          </p>

          {!online && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <CloudOff size={18} className="mt-0.5 shrink-0" />
              <p>You are offline. Connect to the internet to sign in or register.</p>
            </div>
          )}

          <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#0f172a]">
                  Full name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="John Doe"
                  autoComplete="name"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#0f172a] transition focus:border-[#0077c8] focus:outline-none focus:ring-2 focus:ring-[#0077c8]/20"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#0f172a]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mscoatings.shop"
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
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#0f172a] transition focus:border-[#0077c8] focus:outline-none focus:ring-2 focus:ring-[#0077c8]/20"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !online}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0077c8] to-[#19b5fe] py-3 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:shadow-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mode === 'signin' ? <LogIn size={20} /> : <UserPlus size={20} />}
              {isSubmitting
                ? mode === 'signin'
                  ? 'Signing in...'
                  : 'Creating account...'
                : mode === 'signin'
                  ? 'Sign In'
                  : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          MS Coatings ERP · Access granted by Super Admin only
        </p>
      </motion.div>
    </div>
  );
}
