import Link from 'next/link';
import { Mail, Phone, MapPin } from 'lucide-react';
import Logo from '@/components/logo';
import { FacebookIcon, InstagramIcon, LinkedInIcon } from '@/components/social-icons';
import { getAllProductsServer } from '@/lib/products-server';
import {
  categoryToSlug,
  getUniqueCategoriesFromProducts,
} from '@/lib/seo/categories';
import {
  BUSINESS_INFO,
  getMailtoHref,
} from '@/lib/seo/business';
import PhoneLinks from '@/components/phone-links';

const INSTAGRAM_URL =
  'https://www.instagram.com/mscoatingsug?igsh=czFyNWUya3h5MGtt';

const socialLinks = [
  { href: '#', label: 'Facebook', icon: FacebookIcon },
  { href: INSTAGRAM_URL, label: 'Instagram', icon: InstagramIcon },
  { href: '#', label: 'LinkedIn', icon: LinkedInIcon },
];

export default async function Footer() {
  const currentYear = new Date().getFullYear();
  const products = await getAllProductsServer();
  const categories = getUniqueCategoriesFromProducts(products);

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
              {socialLinks.map(({ href, label, icon: Icon }) => {
                const isExternal = href.startsWith('http');

                return (
                  <a
                    key={label}
                    href={href}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white transition-colors hover:bg-white/10 hover:text-cyan"
                    aria-label={label}
                    {...(isExternal
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    <Icon size={18} />
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="mb-5 text-sm font-bold uppercase tracking-wider text-white">
              Products
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/products" className="transition-colors hover:text-cyan">
                  All Products
                </Link>
              </li>
              {categories.map((category) => (
                <li key={category}>
                  <Link
                    href={`/products/category/${categoryToSlug(category)}`}
                    className="transition-colors hover:text-cyan"
                  >
                    {category}
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
                <PhoneLinks linkClassName="text-white transition-colors hover:text-cyan" />
              </div>
              <div className="flex items-start gap-3">
                <Mail size={18} className="mt-0.5 shrink-0 text-cyan" />
                <a href={getMailtoHref()} className="text-white transition-colors hover:text-cyan">
                  {BUSINESS_INFO.email}
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
