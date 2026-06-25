import Link from 'next/link';
import { Mail, Phone, MapPin, Share2, Globe, AtSign } from 'lucide-react';
import Logo from '@/components/logo';
import { MARKETING_CATEGORIES } from '@/lib/seo/categories';

const socialLinks = [
  { href: '#', label: 'Facebook', icon: Share2 },
  { href: '#', label: 'Instagram', icon: AtSign },
  { href: '#', label: 'LinkedIn', icon: Globe },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="contact" className="bg-navy text-[#D1D5DB]">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16 md:py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-5">
              <Logo href="/" subtitle="Since 2019" />
            </div>
            <p className="mb-6 leading-relaxed text-[#D1D5DB]">
              Premium automotive and industrial coating systems engineered for
              durability, performance, and exceptional finishes.
            </p>
            <div className="flex gap-3">
              {socialLinks.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white transition-colors hover:bg-white/10 hover:text-cyan"
                  aria-label={label}
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-5 text-sm font-bold uppercase tracking-wider text-white">
              Products
            </h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/products" className="transition-colors hover:text-cyan">All Products</Link></li>
              {MARKETING_CATEGORIES.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/products/category/${category.slug}`}
                    className="transition-colors hover:text-cyan"
                  >
                    {category.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-5 text-sm font-bold uppercase tracking-wider text-white">
              Company
            </h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/about" className="transition-colors hover:text-cyan">About Us</Link></li>
              <li><Link href="/contact" className="transition-colors hover:text-cyan">Contact Us</Link></li>
              <li><Link href="/about#solutions" className="transition-colors hover:text-cyan">Solutions</Link></li>
              <li><Link href="/contact#support" className="transition-colors hover:text-cyan">Technical Support</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-5 text-sm font-bold uppercase tracking-wider text-white">
              Contact
            </h4>
            <div className="space-y-4 text-sm">
              <Link
                href="/contact"
                className="inline-block font-semibold text-white transition-colors hover:text-cyan"
              >
                Get in Touch
              </Link>
              <div className="flex items-start gap-3">
                <Phone size={18} className="mt-0.5 shrink-0 text-cyan" />
                <a href="tel:+256775305294" className="text-white transition-colors hover:text-cyan">
                  +256 775 305 294
                </a>
              </div>
              <div className="flex items-start gap-3">
                <Mail size={18} className="mt-0.5 shrink-0 text-cyan" />
                <a href="mailto:info@mscoatings.shop" className="text-white transition-colors hover:text-cyan">
                  info@mscoatings.shop
                </a>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={18} className="mt-0.5 shrink-0 text-cyan" />
                <span className="text-white">Kampala, Uganda</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm md:flex-row">
          <p>&copy; {currentYear} MS Coatings. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:justify-end">
            <Link href="/privacy-policy" className="transition-colors hover:text-cyan">
              Privacy Policy
            </Link>
            <Link href="/terms-of-service" className="transition-colors hover:text-cyan">
              Terms of Service
            </Link>
            <Link href="/cookie-policy" className="transition-colors hover:text-cyan">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
