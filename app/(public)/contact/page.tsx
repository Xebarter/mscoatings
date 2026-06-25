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
import Footer from '@/components/footer';
import BrandButton from '@/components/brand-button';
import ContactForm from '@/components/contact-form';
import StructuredData from '@/components/structured-data';
import { BRAND_NAME } from '@/lib/brand';
import { buildContactPageSchema } from '@/lib/seo/json-ld';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_KEYWORDS } from '@/lib/seo/site';

export const metadata: Metadata = buildPageMetadata({
  title: 'Contact MS Coatings Uganda',
  description:
    'Contact MS Coatings for product inquiries, order support, technical advice, and wholesale orders. Phone +256 775 305 294, email, and WhatsApp available.',
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
    icon: Phone,
    title: 'Phone',
    detail: '+256 775 305 294',
    href: 'tel:+256775305294',
    note: 'Speak with our team during business hours.',
  },
  {
    icon: Mail,
    title: 'Email',
    detail: 'info@mscoatings.shop',
    href: 'mailto:info@mscoatings.shop',
    note: 'For orders, quotes, and general inquiries.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp',
    detail: 'Chat on WhatsApp',
    href: 'https://wa.me/256775305294?text=Hello%20MS%20Coatings%2C%20I%20would%20like%20to%20inquire%20about%20your%20products.',
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
      'WhatsApp and phone inquiries during business hours are typically answered the same day. Email and form messages are usually responded to within one business day.',
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
      <header className="border-b border-gray-100 bg-light-gray">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
          <nav
            aria-label="Breadcrumb"
            className="mb-4 flex items-center gap-1.5 text-xs text-body sm:mb-5 sm:gap-2 sm:text-sm"
          >
            <Link
              href="/"
              className="text-premium-blue transition-colors hover:text-cyan"
            >
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400 sm:h-4 sm:w-4" />
            <span className="font-medium text-navy">Contact</span>
          </nav>

          <div className="max-w-2xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              Contact {BRAND_NAME}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-body sm:text-base">
              Have a question about our coatings, need help with an order, or want
              advice on the right product for your job? Reach out — we&apos;re here
              to help professionals across Uganda.
            </p>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CONTACT_METHODS.map(
              ({ icon: Icon, title, detail, href, note, external }) => (
                <a
                  key={title}
                  href={href}
                  {...(external
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  className="card-premium group p-5 transition-shadow hover:shadow-[var(--shadow-premium-hover)] sm:p-6"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-premium-blue/10 text-premium-blue transition-colors group-hover:bg-premium-blue group-hover:text-white">
                    <Icon size={22} />
                  </div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                    {title}
                  </h2>
                  <p className="mt-1 text-base font-bold text-navy group-hover:text-premium-blue sm:text-lg">
                    {detail}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-body">{note}</p>
                </a>
              )
            )}
          </div>
        </section>

        <section className="bg-light-gray py-10 sm:py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-premium-blue">
                  Send a Message
                </p>
                <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">
                  Get in touch with our team
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-body sm:text-base">
                  Fill out the form and we&apos;ll get back to you as soon as
                  possible. Include as much detail as you can — product names,
                  quantities, or your project type — so we can assist you faster.
                </p>

                <div className="mt-8 space-y-4">
                  {SUPPORT_TOPICS.map(({ icon: Icon, title, description }) => (
                    <div key={title} className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-premium-blue shadow-sm">
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

                <div className="mt-8 flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
                  <Clock size={20} className="mt-0.5 shrink-0 text-premium-blue" />
                  <div>
                    <p className="text-sm font-bold text-navy">Business hours</p>
                    <p className="mt-1 text-sm text-body">
                      Monday – Friday, 9:00 AM – 5:00 PM EAT
                    </p>
                  </div>
                </div>
              </div>

              <div className="card-premium p-6 sm:p-8">
                <ContactForm />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-gray-100 bg-[#25D366]/5 py-8 sm:py-10">
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
              href="https://wa.me/256775305294?text=Hello%20MS%20Coatings%2C%20I%20would%20like%20to%20inquire%20about%20your%20products."
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

            <div className="space-y-4">
              {FAQ_ITEMS.map((item) => (
                <details
                  key={item.question}
                  className="group card-premium overflow-hidden"
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

      <Footer />
    </div>
    </>
  );
}
