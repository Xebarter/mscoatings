'use client';

import { useRequireAdmin } from '@/hooks/use-require-admin';

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const status = useRequireAdmin();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  if (status !== 'authorized') {
    return null;
  }

  return <>{children}</>;
}
