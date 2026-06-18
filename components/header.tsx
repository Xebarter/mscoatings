'use client';

import Link from 'next/link';
import {
  ChevronRight,
  LayoutGrid,
  LogOut,
  Mail,
  Menu,
  Phone,
  ShoppingBag,
  ShoppingCart,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import BrandButton from '@/components/brand-button';
import Logo from '@/components/logo';
import { useCart } from '@/lib/cart-context';
import { cn } from '@/lib/utils';

interface HeaderProps {
  isAdmin?: boolean;
}

const navLinks = [
  { href: '/#shop', label: 'Shop', icon: ShoppingBag },
  { href: '/products', label: 'Catalog', icon: LayoutGrid },
  { href: '/#contact', label: 'Contact', icon: Mail },
];

export default function Header({ isAdmin = false }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const router = useRouter();
  const { cart } = useCart();
  const cartCount = cart.length;

  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully');
      router.push('/');
    } catch {
      toast.error('Failed to logout');
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ${
          isScrolled ? 'glass-header shadow-lg' : 'bg-navy'
        }`}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
          <Logo />

          <nav className="hidden items-center gap-8 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-white/90 transition-colors hover:text-cyan"
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin/dashboard"
                className="text-sm font-medium text-white/90 transition-colors hover:text-cyan"
              >
                Dashboard
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {!isAdmin && (
              <>
                <BrandButton
                  href="/products"
                  variant="primary"
                  size="md"
                  className="hidden md:inline-flex"
                >
                  Shop Products
                </BrandButton>
                <Link
                  href="/cart"
                  className="relative rounded-xl p-2.5 text-white transition-colors hover:bg-white/10"
                  aria-label="Shopping cart"
                >
                  <ShoppingCart size={22} />
                  {cartCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-performance-red text-xs font-bold text-white">
                      {cartCount}
                    </span>
                  )}
                </Link>
              </>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              className="rounded-xl p-2.5 text-white transition-colors hover:bg-white/10 lg:hidden"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
            >
              {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-out drawer */}
      <div className="lg:hidden" aria-hidden={!isMenuOpen}>
        <button
          type="button"
          onClick={closeMenu}
          className={cn(
            'fixed inset-0 z-[60] bg-navy/60 backdrop-blur-[2px] transition-opacity duration-300',
            isMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          aria-label="Close menu"
          tabIndex={isMenuOpen ? 0 : -1}
        />

        <nav
          id="mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className={cn(
            'fixed inset-y-0 right-0 z-[70] flex w-[min(320px,88vw)] flex-col bg-white shadow-[-8px_0_40px_rgba(15,23,42,0.18)] transition-transform duration-300 ease-out',
            isMenuOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
          )}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div onClick={closeMenu}>
              <Logo href="/" size="sm" textVariant="dark" subtitle="" />
            </div>
            <button
              type="button"
              onClick={closeMenu}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-navy transition-colors hover:bg-light-gray"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5">
            <p className="mb-3 px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
              Menu
            </p>
            <div className="space-y-1">
              {navLinks.map((link, index) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMenu}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-3.5 text-[15px] font-semibold text-navy transition-all hover:bg-light-gray hover:text-premium-blue',
                      isMenuOpen ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
                    )}
                    style={{
                      transitionDelay: isMenuOpen ? `${index * 45 + 80}ms` : '0ms',
                    }}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-light-gray text-premium-blue transition-colors group-hover:bg-premium-blue/10">
                      <Icon size={18} />
                    </span>
                    <span className="flex-1">{link.label}</span>
                    <ChevronRight
                      size={16}
                      className="text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-premium-blue"
                    />
                  </Link>
                );
              })}

              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  onClick={closeMenu}
                  className="group flex items-center gap-3 rounded-xl px-3 py-3.5 text-[15px] font-semibold text-navy transition-all hover:bg-light-gray hover:text-premium-blue"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-light-gray text-premium-blue">
                    <LayoutGrid size={18} />
                  </span>
                  <span className="flex-1">Dashboard</span>
                  <ChevronRight size={16} className="text-gray-300" />
                </Link>
              )}

              {!isAdmin && (
                <Link
                  href="/cart"
                  onClick={closeMenu}
                  className="group flex items-center gap-3 rounded-xl px-3 py-3.5 text-[15px] font-semibold text-navy transition-all hover:bg-light-gray hover:text-premium-blue"
                  style={{
                    transitionDelay: isMenuOpen ? `${navLinks.length * 45 + 80}ms` : '0ms',
                  }}
                >
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-light-gray text-premium-blue">
                    <ShoppingCart size={18} />
                    {cartCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-performance-red text-[10px] font-bold text-white">
                        {cartCount}
                      </span>
                    )}
                  </span>
                  <span className="flex-1">Cart</span>
                  {cartCount > 0 && (
                    <span className="rounded-full bg-navy/5 px-2 py-0.5 text-xs font-semibold text-navy">
                      {cartCount} item{cartCount === 1 ? '' : 's'}
                    </span>
                  )}
                  <ChevronRight size={16} className="text-gray-300" />
                </Link>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 px-5 py-5">
            {!isAdmin ? (
              <>
                <BrandButton
                  href="/products"
                  variant="primary"
                  className="w-full"
                  onClick={closeMenu}
                >
                  Shop Products
                </BrandButton>
                <a
                  href="tel:+256775305294"
                  className="mt-4 flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-body transition-colors hover:text-premium-blue"
                >
                  <Phone size={16} className="shrink-0 text-premium-blue" />
                  <span>+256 775 305 294</span>
                </a>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  handleLogout();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-navy transition-colors hover:bg-light-gray"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            )}
          </div>

          <div className="gradient-accent-bar shrink-0" />
        </nav>
      </div>
    </>
  );
}
