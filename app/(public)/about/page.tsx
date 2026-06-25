import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Globe,
  Mail,
  MapPin,
  Phone,
  Shield,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import Footer from '@/components/footer';
import BrandButton from '@/components/brand-button';
import StructuredData from '@/components/structured-data';
import { BRAND_ASSETS, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import {
  BUSINESS_INFO,
  getMailtoHref,
  getTelHref,
} from '@/lib/seo/business';
import { ABOUT_FAQS } from '@/lib/seo/faqs';
import { buildAboutPageSchema } from '@/lib/seo/json-ld';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_KEYWORDS } from '@/lib/seo/site';

export const metadata: Metadata = buildPageMetadata({
  title: 'About MS Coatings Uganda',
  description:
    'Learn about MS Coatings — Uganda\'s trusted supplier of professional automotive and industrial coating systems since 2019. Primers, clear coats, and nationwide delivery.',
  path: '/about',
  keywords: [
    ...SEO_KEYWORDS,
    'about MS Coatings',
    'paint supplier Uganda',
    'automotive coatings company Kampala',
  ],
});

const VALUES = [
  {
    icon: Award,
    title: 'Professional Quality',
    description:
      'We supply coatings, primers, and clear coats trusted by body shops, fleet operators, and industrial finishers across Uganda.',
  },
  {
    icon: Shield,
    title: 'Reliable Supply',
    description:
      'Consistent stock availability and accurate product information so you can plan jobs with confidence.',
  },
  {
    icon: Users,
    title: 'Customer Support',
    description:
      'Reach our team by phone, email, or WhatsApp for product guidance, order updates, and technical questions.',
  },
  {
    icon: Truck,
    title: 'Nationwide Delivery',
    description:
      'We arrange shipping across Uganda so professional finishers and businesses receive products where they work.',
  },
];

const SOLUTIONS = [
  {
    title: 'Automotive Refinish',
    description:
      'Primers, basecoats, clear coats, and supporting products for collision repair, custom paint work, and vehicle restoration.',
  },
  {
    title: 'Industrial Coatings',
    description:
      'Durable finishing systems for machinery, metal fabrication, structural steel, and commercial equipment.',
  },
  {
    title: 'Protective Finishes',
    description:
      'Coatings designed to resist corrosion, weather exposure, chemicals, and daily wear in demanding environments.',
  },
  {
    title: 'Body Shop & Fleet Supply',
    description:
      'Reliable sourcing for workshops, fleet maintenance teams, and contractors who need repeatable results at scale.',
  },
];

const PROCESS_STEPS = [
  {
    step: '01',
    title: 'Browse the catalog',
    description: 'Explore primers, clear coats, topcoats, and industrial finishes online.',
  },
  {
    step: '02',
    title: 'Add to cart & checkout',
    description: 'Place your order securely with fast online checkout and order confirmation.',
  },
  {
    step: '03',
    title: 'Receive your products',
    description: 'We process and ship your order with updates along the way.',
  },
  {
    step: '04',
    title: 'Get expert support',
    description: 'Contact us anytime for product advice or help with your next project.',
  },
];

export default function AboutPage() {
  return (
    <>
      <StructuredData data={buildAboutPageSchema(ABOUT_FAQS)} />
    <div className="min-h-screen bg-white">
      <header className="relative overflow-hidden border-b border-gray-100 bg-light-gray">
        <div className="absolute inset-0 bg-gradient-to-br from-premium-blue/5 via-transparent to-cyan/5" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
          <nav
            aria-label="Breadcrumb"
            className="mb-6 flex items-center gap-1.5 text-xs text-body sm:gap-2 sm:text-sm"
          >
            <Link
              href="/"
              className="text-premium-blue transition-colors hover:text-cyan"
            >
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400 sm:h-4 sm:w-4" />
            <span className="font-medium text-navy">About Us</span>
          </nav>

          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-premium-blue/15 bg-white px-3.5 py-1.5 text-xs font-semibold text-premium-blue shadow-sm sm:text-sm">
                <Sparkles size={14} />
                <span>Since 2019 · {BRAND_TAGLINE}</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl lg:text-5xl">
                Built for professionals who demand{' '}
                <span className="bg-[linear-gradient(135deg,#0077C8,#19B5FE,#E53935)] bg-clip-text text-transparent">
                  exceptional finishes
                </span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-body sm:text-lg">
                {BRAND_NAME} is a Kampala-based supplier of premium automotive and
                industrial coating systems. From body shops and fleet operators to
                fabricators and contractors, we help professionals across Uganda
                access the products they need — with a modern online store, reliable
                service, and support you can reach when it matters.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <BrandButton href="/products" variant="primary" size="lg">
                  <ShoppingBag size={18} className="mr-2" />
                  Browse Products
                </BrandButton>
                <BrandButton href="/contact" variant="outline" size="lg">
                  Contact Our Team
                </BrandButton>
              </div>
            </div>

            <div className="card-premium p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-4">
                <img
                  src={BRAND_ASSETS.logoLarge}
                  alt={BRAND_NAME}
                  width={72}
                  height={72}
                  className="rounded-2xl ring-1 ring-gray-100"
                />
                <div>
                  <p className="text-lg font-bold text-navy">{BRAND_NAME}</p>
                  <p className="text-sm text-body">Kampala, Uganda</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Established', value: '2019' },
                  { label: 'Focus', value: 'Coatings' },
                  { label: 'Market', value: 'Uganda' },
                  { label: 'Shopping', value: 'Online' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl bg-light-gray px-4 py-3"
                  >
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-sm font-bold text-navy sm:text-base">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-premium-blue">
                Our Story
              </p>
              <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">
                A coatings partner rooted in quality and service
              </h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-body sm:text-base">
              <p>
                MS Coatings was founded to make professional-grade automotive and
                industrial coatings more accessible to businesses and finishers in
                Uganda. What started as a focused supply operation has grown into a
                trusted name for primers, clear coats, topcoats, and specialty
                finishing products.
              </p>
              <p>
                We understand that a coating purchase is never just a product — it
                is part of a repair timeline, a production schedule, or a client
                delivery promise. That is why we combine curated product selection
                with responsive support and a straightforward online ordering
                experience.
              </p>
              <p>
                Today, MS Coatings serves body shops, fleet maintenance teams,
                fabricators, and industrial operators who need dependable materials
                and a supplier that understands the work behind every finish.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-light-gray py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-10 max-w-2xl">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-premium-blue">
                What We Stand For
              </p>
              <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">
                Mission, vision, and values
              </h2>
            </div>

            <div className="mb-10 grid gap-6 lg:grid-cols-2">
              <div className="card-premium p-6 sm:p-8">
                <h3 className="mb-3 text-lg font-bold text-navy">Our Mission</h3>
                <p className="text-sm leading-relaxed text-body sm:text-base">
                  To equip automotive and industrial professionals with high-quality
                  coating systems, reliable availability, and the support they need
                  to deliver durable, beautiful finishes — every time.
                </p>
              </div>
              <div className="card-premium p-6 sm:p-8">
                <h3 className="mb-3 text-lg font-bold text-navy">Our Vision</h3>
                <p className="text-sm leading-relaxed text-body sm:text-base">
                  To become Uganda&apos;s most trusted coatings supplier — known for
                  product quality, technical confidence, and a seamless buying
                  experience from first search to final delivery.
                </p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {VALUES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="card-premium p-6">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-premium-blue/10 text-premium-blue">
                    <Icon size={22} />
                  </div>
                  <h3 className="mb-2 text-base font-bold text-navy">{title}</h3>
                  <p className="text-sm leading-relaxed text-body">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="solutions" className="scroll-mt-28 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-premium-blue">
                  Solutions
                </p>
                <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">
                  Coating systems for every professional need
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-body sm:text-base">
                  Whether you are refinishing a vehicle, protecting industrial
                  equipment, or sourcing materials for a busy workshop, MS Coatings
                  supports a wide range of finishing applications.
                </p>
              </div>
              <BrandButton href="/products" variant="outline">
                View Full Catalog
              </BrandButton>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {SOLUTIONS.map((solution) => (
                <div
                  key={solution.title}
                  className="card-premium flex gap-4 p-6 sm:p-7"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                    <Wrench size={18} />
                  </div>
                  <div>
                    <h3 className="mb-2 text-lg font-bold text-navy">
                      {solution.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-body sm:text-base">
                      {solution.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-gray-100 bg-white py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-10 max-w-2xl">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-premium-blue">
                Product Range
              </p>
              <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">
                What you will find at MS Coatings
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                'Automotive primers & surfacers',
                'Clear coats & topcoats',
                'Industrial finishing systems',
                'Protective & specialty coatings',
                'Refinish consumables & accessories',
                'Products for fleet & workshop supply',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-gray-100 bg-light-gray/60 px-4 py-4"
                >
                  <CheckCircle2
                    size={18}
                    className="mt-0.5 shrink-0 text-premium-blue"
                  />
                  <span className="text-sm font-medium text-navy sm:text-base">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-navy py-12 text-white sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-10 max-w-2xl">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan">
                Why MS Coatings
              </p>
              <h2 className="text-2xl font-extrabold sm:text-3xl">
                The partner professionals choose
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  title: 'Curated for professionals',
                  text: 'Products selected for real-world automotive and industrial finishing — not generic retail inventory.',
                },
                {
                  title: 'Modern online ordering',
                  text: 'Browse, compare, and checkout online with a streamlined experience built for busy teams.',
                },
                {
                  title: 'Local expertise',
                  text: 'Based in Kampala and focused on the needs of Ugandan body shops, fleets, and industrial clients.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
                >
                  <h3 className="mb-2 text-lg font-bold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-300 sm:text-base">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-10 max-w-2xl">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-premium-blue">
                How It Works
              </p>
              <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">
                From browse to delivery in four steps
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PROCESS_STEPS.map((item) => (
                <div key={item.step} className="card-premium p-6">
                  <p className="mb-3 text-2xl font-extrabold text-premium-blue/30">
                    {item.step}
                  </p>
                  <h3 className="mb-2 text-base font-bold text-navy">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-body">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-28 bg-light-gray py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="card-premium grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-premium-blue">
                  Get In Touch
                </p>
                <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">
                  Ready to work with MS Coatings?
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-body sm:text-base">
                  Whether you need help choosing the right product, want to place a
                  bulk order, or have questions about availability, our team is here
                  to help.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <BrandButton href="/products" variant="primary">
                    Shop Products
                  </BrandButton>
                  <BrandButton href="/contact" variant="outline">
                    Contact Us
                  </BrandButton>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl bg-light-gray p-5 sm:p-6">
                <div className="flex items-start gap-3 text-sm sm:text-base">
                  <Phone size={18} className="mt-0.5 shrink-0 text-premium-blue" />
                  <a
                    href={getTelHref()}
                    className="font-medium text-navy hover:text-premium-blue"
                  >
                    {BUSINESS_INFO.telephoneDisplay}
                  </a>
                </div>
                <div className="flex items-start gap-3 text-sm sm:text-base">
                  <Mail size={18} className="mt-0.5 shrink-0 text-premium-blue" />
                  <a
                    href={getMailtoHref()}
                    className="font-medium text-navy hover:text-premium-blue"
                  >
                    {BUSINESS_INFO.email}
                  </a>
                </div>
                <div className="flex items-start gap-3 text-sm sm:text-base">
                  <MapPin size={18} className="mt-0.5 shrink-0 text-premium-blue" />
                  <span className="text-body">Kampala, Uganda</span>
                </div>
                <div className="flex items-start gap-3 text-sm sm:text-base">
                  <Globe size={18} className="mt-0.5 shrink-0 text-premium-blue" />
                  <a
                    href="https://www.mscoatings.shop"
                    className="font-medium text-navy hover:text-premium-blue"
                  >
                    www.mscoatings.shop
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
    </>
  );
}
