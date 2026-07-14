import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ChevronRight,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingBag,
  Truck,
  Wrench,
} from 'lucide-react';
import BrandButton from '@/components/brand-button';
import ContactForm from '@/components/contact-form';
import StructuredData from '@/components/structured-data';
import { BRAND_NAME } from '@/lib/brand';
import {
  BUSINESS_INFO,
  formatPhoneListForText,
  getMailtoHref,
} from '@/lib/seo/business';
import PhoneLinks from '@/components/phone-links';
import { buildContactPageSchema } from '@/lib/seo/json-ld';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_KEYWORDS } from '@/lib/seo/site';

export const metadata: Metadata = buildPageMetadata({
  title: 'Contact MS Coatings Uganda',
  description: `Contact MS Coatings for product inquiries, order support, technical advice, and wholesale orders. Phone ${formatPhoneListForText()}, email, and WhatsApp available.`,
  path: '/contact',
  keywords: [
    ...SEO_KEYWORDS,
    'contact MS Coatings',
    'paint supplier contact Uganda',
    'automotive coatings support Kampala',
  ],
});

const CONTACT_METHODS = [
  {
    icon: Mail,
    title: 'Email',
    detail: BUSINESS_INFO.email,
    href: getMailtoHref(),
    note: 'For orders, quotes, and general inquiries.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp',
    detail: 'Chat on WhatsApp',
    href: BUSINESS_INFO.whatsappUrl,
    note: 'Fast responses for product and order questions.',
    external: true,
  },
  {
    icon: MapPin,
    title: 'Location',
    detail: 'Kampala, Uganda',
    href: 'https://maps.google.com/?q=Kampala,+Uganda',
    note: 'Serving customers across Uganda.',
    external: true,
  },
];

const SUPPORT_TOPICS = [
  {
    icon: ShoppingBag,
    title: 'Product guidance',
    description:
      'Help choosing primers, clear coats, topcoats, and industrial finishes for your project.',
  },
  {
    icon: Truck,
    title: 'Orders & delivery',
    description:
      'Questions about order status, shipping timelines, and delivery across Uganda.',
  },
  {
    icon: Wrench,
    title: 'Technical support',
    description:
      'Application advice, compatibility questions, and troubleshooting for coating systems.',
  },
];

const FAQ_ITEMS = [
  {
    question: 'What are your business hours?',
    answer:
      'Our team is available Monday to Friday, 9:00 AM – 5:00 PM East Africa Time (EAT). Messages received outside these hours are answered on the next business day.',
  },
  {
    question: 'How quickly will I get a response?',
    answer:
      'WhatsApp and phone inquiries during business hours are typically answered the same day. Website form messages reach our team instantly and are usually answered within one business day.',
  },
  {
    question: 'Can I place bulk or wholesale orders?',
    answer:
      'Yes. Contact us with your product list and quantities for pricing, availability, and delivery options tailored to workshops, fleets, and distributors.',
  },
  {
    question: 'Do you offer technical advice on products?',
    answer:
      'We provide general product guidance and can help you identify suitable coatings for automotive refinish and industrial applications. Always follow manufacturer instructions for application and safety.',
  },
];

export default function ContactPage() {
  return (
    <>
      <StructuredData data={buildContactPageSchema()} />
      <div className="min-h-screen bg-white">
        <header className="relative overflow-hidden border-b border-slate-200/60 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0a4a7a] text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 left-10 h-64 w-64 rounded-full bg-premium-blue/25 blur-3xl"
          />
          <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
            <nav
              aria-label="Breadcrumb"
              className="mb-5 flex items-center gap-1.5 text-xs text-slate-300 sm:mb-6 sm:gap-2 sm:text-sm"
            >
              <Link href="/" className="transition-colors hover:text-cyan">
                Home
              </Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500 sm:h-4 sm:w-4" />
              <span className="font-medium text-white">Contact</span>
            </nav>

            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/90">
              {BRAND_NAME} · Uganda
            </p>
            <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Let&apos;s talk coatings
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Product questions, order support, or technical advice — reach the{' '}
              {BRAND_NAME} team by phone, WhatsApp, or the form below. We support
              professionals across Uganda.
            </p>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-premium-blue via-cyan to-orange" />
        </header>

        <main>
          <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-premium-blue/10 text-premium-blue">
                  <Phone size={22} />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                  Phone
                </h2>
                <PhoneLinks
                  className="mt-1"
                  linkClassName="block text-base font-bold text-navy transition-colors hover:text-premium-blue sm:text-lg"
                />
                <p className="mt-2 text-sm leading-relaxed text-body">
                  Speak with our team during business hours.
                </p>
              </div>
              {CONTACT_METHODS.map(
                ({ icon: Icon, title, detail, href, note, external }) => (
                  <a
                    key={title}
                    href={href}
                    {...(external
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-premium-blue/30 hover:shadow-[0_16px_40px_rgba(0,119,200,0.1)] sm:p-6"
                  >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-premium-blue/10 text-premium-blue transition-colors group-hover:bg-premium-blue group-hover:text-white">
                      <Icon size={22} />
                    </div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                      {title}
                    </h2>
                    <p className="mt-1 break-all text-base font-bold text-navy group-hover:text-premium-blue sm:text-lg">
                      {detail}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-body">{note}</p>
                  </a>
                )
              )}
            </div>
          </section>

          <section className="relative overflow-hidden bg-slate-50 py-12 sm:py-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)',
                backgroundSize: '24px 24px',
              }}
            />
            <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
              <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-premium-blue">
                    Send a Message
                  </p>
                  <h2 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
                    Get in touch with our team
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-body sm:text-base">
                    Fill out the form and it arrives directly in our admin inbox.
                    Include product names, quantities, or your project type so we can
                    assist you faster.
                  </p>

                  <div className="mt-8 space-y-4">
                    {SUPPORT_TOPICS.map(({ icon: Icon, title, description }) => (
                      <div key={title} className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-premium-blue shadow-sm ring-1 ring-slate-200/70">
                          <Icon size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-navy sm:text-base">
                            {title}
                          </h3>
                          <p className="mt-1 text-sm leading-relaxed text-body">
                            {description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <Clock size={20} className="mt-0.5 shrink-0 text-premium-blue" />
                    <div>
                      <p className="text-sm font-bold text-navy">Business hours</p>
                      <p className="mt-1 text-sm text-body">
                        Monday – Friday, 9:00 AM – 5:00 PM EAT
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/60 bg-white/90 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-8">
                  <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-premium-blue to-cyan text-white shadow-md shadow-premium-blue/25">
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-navy">Contact form</p>
                      <p className="text-xs text-body">Secure · Delivered to our team</p>
                    </div>
                  </div>
                  <ContactForm />
                </div>
              </div>
            </div>
          </section>

          <section className="border-y border-emerald-100 bg-[#25D366]/[0.06] py-8 sm:py-10">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
              <div className="text-center sm:text-left">
                <h2 className="text-xl font-extrabold text-navy sm:text-2xl">
                  Need a quick answer?
                </h2>
                <p className="mt-2 text-sm text-body sm:text-base">
                  Chat with us on WhatsApp — available Monday to Friday, 9am – 5pm EAT.
                </p>
              </div>
              <BrandButton
                href={BUSINESS_INFO.whatsappUrl}
                variant="primary"
                size="lg"
                className="bg-[#25D366] hover:bg-[#1fb855]"
              >
                <MessageCircle size={18} className="mr-2" />
                Start WhatsApp Chat
              </BrandButton>
            </div>
          </section>

          <section id="support" className="scroll-mt-28 py-10 sm:py-14">
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <div className="mb-8 text-center">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-premium-blue">
                  FAQ
                </p>
                <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">
                  Frequently asked questions
                </h2>
              </div>

              <div className="space-y-3">
                {FAQ_ITEMS.map((item) => (
                  <details
                    key={item.question}
                    className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
                  >
                    <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-navy marker:content-none sm:px-6 sm:text-base [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center justify-between gap-4">
                        {item.question}
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-90" />
                      </span>
                    </summary>
                    <div className="border-t border-gray-100 px-5 py-4 text-sm leading-relaxed text-body sm:px-6 sm:text-base">
                      {item.answer}
                    </div>
                  </details>
                ))}
              </div>

              <div className="mt-10 text-center">
                <p className="mb-4 text-sm text-body sm:text-base">
                  Prefer to browse on your own?
                </p>
                <BrandButton href="/products" variant="outline">
                  View Product Catalog
                </BrandButton>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
