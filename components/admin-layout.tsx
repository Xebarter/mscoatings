'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import toast from 'react-hot-toast';
import Logo from '@/components/logo';
import {
  AdminAlertsProvider,
  useAdminAlertsContext,
} from '@/components/admin-alerts-provider';
import {
  BarChart3,
  Bell,
  BellOff,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  ScanBarcode,
  ShoppingBag,
  Warehouse,
  Truck,
  X,
  Users,
  Wallet,
} from 'lucide-react';

export type AdminSection =
  | 'overview'
  | 'products'
  | 'orders'
  | 'analytics'
  | 'pos'
  | 'inventory'
  | 'fieldSales'
  | 'expenses'
  | 'credit'
  | 'reports'
  | 'messages'
  | 'staff';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeSection?: AdminSection;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const navItems: {
  id: AdminSection;
  label: string;
  icon: typeof Package;
  href: string;
}[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, href: '/admin/dashboard?tab=overview' },
  { id: 'pos', label: 'Point of Sale', icon: ScanBarcode, href: '/admin/pos' },
  { id: 'products', label: 'Products', icon: Package, href: '/admin/dashboard?tab=products' },
  { id: 'inventory', label: 'Inventory', icon: Warehouse, href: '/admin/inventory' },
  { id: 'fieldSales', label: 'Field Sales', icon: Truck, href: '/admin/field-sales' },
  { id: 'orders', label: 'Orders', icon: ShoppingBag, href: '/admin/dashboard?tab=orders' },
  { id: 'expenses', label: 'Expenses', icon: Receipt, href: '/admin/expenses' },
  { id: 'credit', label: 'Credit', icon: Wallet, href: '/admin/credit' },
  { id: 'messages', label: 'Messages', icon: Inbox, href: '/admin/messages' },
  { id: 'reports', label: 'Reports', icon: BarChart3, href: '/admin/reports' },
  { id: 'staff', label: 'Staff Access', icon: Users, href: '/admin/staff' },
];

function resolveActiveSection(pathname: string, activeSection?: AdminSection): AdminSection {
  if (activeSection) return activeSection;
  if (pathname.startsWith('/admin/pos') || pathname.startsWith('/admin/sales')) return 'pos';
  if (pathname.startsWith('/admin/inventory')) return 'inventory';
  if (pathname.startsWith('/admin/field-sales')) return 'fieldSales';
  if (pathname.startsWith('/admin/expenses')) return 'expenses';
  if (pathname.startsWith('/admin/credit')) return 'credit';
  if (pathname.startsWith('/admin/reports')) return 'reports';
  if (pathname.startsWith('/admin/staff')) return 'staff';
  if (pathname.startsWith('/admin/messages')) return 'messages';
  if (pathname.startsWith('/admin/products')) return 'products';
  if (pathname.startsWith('/admin/orders')) return 'orders';
  if (pathname.includes('tab=analytics')) return 'analytics';
  return 'overview';
}

function AlertBadge({ count, active }: { count: number; active: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={`ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums ${
        active ? 'bg-white text-blue-700' : 'bg-red-500 text-white'
      }`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function NavLinks({
  current,
  onNavigate,
}: {
  current: AdminSection;
  onNavigate?: () => void;
}) {
  const { alerts } = useAdminAlertsContext();

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = current === item.id;
        const badge =
          item.id === 'orders'
            ? alerts.pendingOrders
            : item.id === 'messages'
              ? alerts.newMessages
              : 0;

        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Icon size={18} className="shrink-0" />
            {item.label}
            <AlertBadge count={badge} active={isActive} />
          </Link>
        );
      })}
    </nav>
  );
}

function AdminLayoutShell({
  children,
  activeSection,
  title,
  subtitle,
  actions,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const current = resolveActiveSection(pathname, activeSection);
  const { alerts, muted, toggleMute, requestBrowserPermission } = useAdminAlertsContext();
  const totalAlerts = alerts.pendingOrders + alerts.newMessages;

  useEffect(() => {
    void requestBrowserPermission();
  }, [requestBrowserPermission]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully');
      router.push('/');
    } catch {
      toast.error('Failed to logout');
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-800 bg-slate-950 lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
          <Logo href={null} subtitle="ERP Console" />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Menu
          </p>
          <NavLinks current={current} />
        </div>

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
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ExternalLink size={18} />
            View Store
          </Link>
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

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu size={22} />
              {totalAlerts > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
              )}
            </button>
            <div className="flex items-center gap-2">
              <Logo href={null} size="sm" showText={false} />
              <span className="font-semibold text-slate-900">ERP</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label={muted ? 'Unmute alerts' : 'Mute alerts'}
            >
              {muted ? <BellOff size={20} /> : <Bell size={20} />}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600"
              aria-label="Sign out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50"
            onClick={closeMobileMenu}
            aria-label="Close menu overlay"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-slate-950 shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
              <Logo href={null} subtitle="ERP Console" />
              <button
                type="button"
                onClick={closeMobileMenu}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-5">
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Menu
              </p>
              <NavLinks current={current} onNavigate={closeMobileMenu} />
            </div>

            <div className="border-t border-slate-800 p-4 space-y-1">
              <Link
                href="/"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <ExternalLink size={18} />
                View Store
              </Link>
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  handleLogout();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          {(title || actions) && (
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                {title && (
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="mt-1 text-sm text-slate-500 sm:text-base">{subtitle}</p>
                )}
              </div>
              {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout(props: AdminLayoutProps) {
  return (
    <AdminAlertsProvider>
      <AdminLayoutShell {...props} />
    </AdminAlertsProvider>
  );
}
