import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  BarChart3,
  ExternalLink,
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

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/pos', label: 'Point of Sale', icon: ScanBarcode },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/inventory', label: 'Inventory', icon: Warehouse },
  { to: '/field-sales', label: 'Field Sales', icon: Truck },
  { to: '/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
];

export default function Layout() {
  const location = useLocation();
  const online = useOnline();

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
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                <Icon size={18} className="shrink-0" />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>

        <ConnectionStatus />

        <div className="border-t border-slate-800 p-4 space-y-1">
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
              <Outlet />
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
