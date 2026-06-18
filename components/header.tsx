'use client';

import Link from 'next/link';
import { ShoppingCart, Menu, X, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import BrandButton from '@/components/brand-button';
import Logo from '@/components/logo';

interface HeaderProps {
  cartCount?: number;
  isAdmin?: boolean;
}

const navLinks = [
  { href: '/#shop', label: 'Shop' },
  { href: '/products', label: 'Catalog' },
  { href: '/#contact', label: 'Contact' },
];

export default function Header({ cartCount = 0, isAdmin = false }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
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
              <BrandButton href="/products" variant="primary" size="md" className="hidden md:inline-flex">
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
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="rounded-xl p-2.5 text-white transition-colors hover:bg-white/10 lg:hidden"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <nav className="border-t border-white/10 bg-navy px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-cyan"
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin/dashboard"
                onClick={() => setIsMenuOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-cyan"
              >
                Dashboard
              </Link>
            )}
            {!isAdmin && (
              <BrandButton
                href="/products"
                variant="primary"
                className="mt-3 w-full"
                onClick={() => setIsMenuOpen(false)}
              >
                Shop Products
              </BrandButton>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
