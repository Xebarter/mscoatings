import ReportsDashboard from '@/components/reports/reports-dashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { PageLoader } from '@/components/LoadingSpinner';
import { ShieldAlert } from 'lucide-react';
import { reportsGlass } from '@/components/reports/reports-ui';

export default function ReportsPage() {
  const { can, loading } = usePermissions();

  if (loading) return <PageLoader />;

  if (!can('viewReports')) {
    return (
      <div className={`${reportsGlass.panelStatic} px-6 py-16 text-center`}>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <ShieldAlert size={22} />
        </div>
        <p className="font-semibold text-slate-800">Access restricted</p>
        <p className="mt-1 text-sm text-slate-500">
          You do not have permission to view business reports.
        </p>
      </div>
    );
  }

  return <ReportsDashboard />;
}
