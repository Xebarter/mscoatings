'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import toast from 'react-hot-toast';
import Logo from '@/components/logo';
import {
  BarChart3,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShoppingBag,
  X,
} from 'lucide-react';

export type AdminSection = 'overview' | 'products' | 'orders' | 'analytics';

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
  { id: 'products', label: 'Products', icon: Package, href: '/admin/dashboard?tab=products' },
  { id: 'orders', label: 'Orders', icon: ShoppingBag, href: '/admin/dashboard?tab=orders' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, href: '/admin/dashboard?tab=analytics' },
];

function resolveActiveSection(pathname: string, activeSection?: AdminSection): AdminSection {
  if (activeSection) return activeSection;
  if (pathname.startsWith('/admin/products')) return 'products';
  if (pathname.startsWith('/admin/orders')) return 'orders';
  return 'overview';
}

function NavLinks({
  current,
  onNavigate,
}: {
  current: AdminSection;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = current === item.id;

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
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout({
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
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-800 bg-slate-950 lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
          <Logo href={null} subtitle="Admin Console" />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Menu
          </p>
          <NavLinks current={current} />
        </div>

        <div className="border-t border-slate-800 p-4 space-y-1">
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

      {/* Mobile header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <Logo href={null} size="sm" showText={false} />
              <span className="font-semibold text-slate-900">Admin</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600"
            aria-label="Sign out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
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
              <Logo href={null} subtitle="Admin Console" />
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

      {/* Main content */}
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
