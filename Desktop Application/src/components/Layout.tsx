import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  BarChart3,
  Bell,
  BellOff,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  LogOut,
  Package,
  ScanBarcode,
  ShoppingBag,
  Truck,
  Warehouse,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { clearOfflineSession } from '@/lib/admin-auth';
import { API_BASE } from '@/lib/admin-api';
import Logo from '@/components/Logo';
import ConnectionStatus from '@/components/ConnectionStatus';
import { cn } from '@/lib/utils';
import { useOnline } from '@/hooks/useOnline';
import { useAdminAlerts } from '@/hooks/useAdminAlerts';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permissions } from '@/lib/types';

const navItems: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  badge?: null | 'orders' | 'messages';
  permission?: keyof Permissions;
}[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/pos', label: 'Point of Sale', icon: ScanBarcode, permission: 'accessPos' },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/inventory', label: 'Inventory', icon: Warehouse, permission: 'adjustStock' },
  { to: '/field-sales', label: 'Field Sales', icon: Truck, permission: 'manageFieldSales' },
  { to: '/orders', label: 'Orders', icon: ShoppingBag, badge: 'orders' },
  { to: '/messages', label: 'Messages', icon: Inbox, badge: 'messages', permission: 'viewMessages' },
  { to: '/reports', label: 'Reports', icon: BarChart3, permission: 'viewReports' },
];

function AlertBadge({ count, active }: { count: number; active: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums',
        active ? 'bg-white text-blue-700' : 'bg-red-500 text-white'
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function Layout() {
  const location = useLocation();
  const online = useOnline();
  const { can } = usePermissions();
  const { alerts, muted, toggleMute } = useAdminAlerts(online);

  const visibleNav = navItems.filter(
    (item) => !item.permission || can(item.permission)
  );

  const handleLogout = async () => {
    try {
      await clearOfflineSession();
      await signOut(auth);
      toast.success('Signed out successfully');
    } catch {
      toast.error('Failed to sign out');
    }
  };

  const openStore = () => {
    if (!online) {
      toast.error('Connect to the internet to open the store');
      return;
    }
    window.open(API_BASE, '_blank');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
        <div className="flex h-16 items-center border-b border-slate-800 px-5">
          <Logo subtitle="ERP Console" />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Menu
          </p>
          <div className="flex flex-col gap-1">
            {visibleNav.map(({ to, label, icon: Icon, end, badge }) => {
              const count =
                badge === 'orders'
                  ? alerts.pendingOrders
                  : badge === 'messages'
                    ? alerts.newMessages
                    : 0;
              const nestedActive =
                to === '/field-sales' &&
                location.pathname.startsWith('/field-sales');

              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      isActive || nestedActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={18} className="shrink-0" />
                      <span className="flex-1">{label}</span>
                      <AlertBadge count={count} active={isActive} />
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        <ConnectionStatus />

        <div className="border-t border-slate-800 p-4 space-y-1">
          <button
            type="button"
            onClick={toggleMute}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            title={muted ? 'Unmute alert sounds' : 'Mute alert sounds'}
          >
            {muted ? <BellOff size={18} /> : <Bell size={18} />}
            {muted ? 'Alerts muted' : 'Alert sounds on'}
          </button>
          <button
            type="button"
            onClick={openStore}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ExternalLink size={18} />
            View Store
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex-1 overflow-y-auto"
          >
            <div className="mx-auto max-w-7xl px-6 py-8">
              {(alerts.pendingOrders > 0 || alerts.newMessages > 0) &&
                location.pathname === '/' && (
                  <div className="mb-6 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1 text-sm text-amber-950">
                      {alerts.pendingOrders > 0 && (
                        <p className="font-medium">
                          {alerts.pendingOrders} pending order
                          {alerts.pendingOrders === 1 ? '' : 's'}
                        </p>
                      )}
                      {alerts.newMessages > 0 && (
                        <p className="font-medium">
                          {alerts.newMessages} new message
                          {alerts.newMessages === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {alerts.pendingOrders > 0 && (
                        <Link
                          to="/orders"
                          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                        >
                          View orders
                        </Link>
                      )}
                      {alerts.newMessages > 0 && (
                        <Link
                          to="/messages"
                          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100"
                        >
                          Open inbox
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              <Outlet />
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
