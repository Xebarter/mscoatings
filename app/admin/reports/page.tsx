'use client';

import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import ReportsDashboard from '@/components/admin/reports/reports-dashboard';
import { reportsGlass } from '@/components/admin/reports/reports-ui';
import { usePermissions } from '@/hooks/use-permissions';
import { ShieldAlert } from 'lucide-react';

export default function ReportsPage() {
  const { can } = usePermissions();

  if (!can('viewReports')) {
    return (
      <AdminGuard>
        <AdminLayout title="Business Intelligence" activeSection="reports">
          <div className={`${reportsGlass.panelStatic} p-10 text-center`}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100 dark:bg-red-950/40 dark:ring-red-500/20">
              <ShieldAlert size={28} />
            </div>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Access restricted
            </p>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              You do not have permission to view reports. Contact an administrator if you need
              access.
            </p>
          </div>
        </AdminLayout>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <AdminLayout activeSection="reports">
        <ReportsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
