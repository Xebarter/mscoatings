import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import Footer from '@/components/footer';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Privacy Policy',
  description:
    'Learn how MS Coatings collects, uses, and protects your personal information when you use our website and services in Uganda.',
  path: '/privacy-policy',
});

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="mb-4 text-xl font-bold text-navy sm:text-2xl">{title}</h2>
      <div className="space-y-4 text-sm leading-relaxed text-body sm:text-base">
        {children}
      </div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-3 text-base font-semibold text-navy sm:text-lg">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-light-gray">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
          <nav
            aria-label="Breadcrumb"
            className="mb-3 flex items-center gap-1.5 text-xs text-body sm:mb-4 sm:gap-2 sm:text-sm"
          >
            <Link
              href="/"
              className="text-premium-blue transition-colors hover:text-cyan"
            >
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400 sm:h-4 sm:w-4" />
            <span className="font-medium text-navy">Privacy Policy</span>
          </nav>

          <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-body sm:text-base">
            MS Coatings · Effective Date: June 19, 2026
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="card-premium space-y-10 p-6 sm:p-10">
          <div className="space-y-4 border-b border-gray-100 pb-8 text-sm leading-relaxed text-body sm:text-base">
            <p>
              At MS Coatings, we are committed to protecting your privacy and ensuring
              the security of your personal information. This Privacy Policy explains
              how we collect, use, disclose, and safeguard your information when you
              visit our website (
              <a
                href="https://www.mscoatings.com"
                className="font-medium text-premium-blue hover:text-cyan"
              >
                https://www.mscoatings.com
              </a>
              ), make a purchase, or interact with our services (collectively, the
              &ldquo;Site&rdquo;). By accessing or using our Site, you agree to the
              practices described in this Privacy Policy.
            </p>
            <p>
              If you do not agree with this Privacy Policy, please do not use our Site.
            </p>
          </div>

          <Section title="1. Information We Collect">
            <p>
              We collect information that identifies, relates to, describes, or could
              reasonably be linked with you (&ldquo;Personal Information&rdquo;). The
              types of Personal Information we collect include:
            </p>

            <SubSection title="Information You Provide Directly">
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-navy">Account Information:</strong> Name,
                  email address, password, phone number, and billing/shipping addresses
                  when you create an account or place an order.
                </li>
                <li>
                  <strong className="text-navy">Order and Transaction Information:</strong>{' '}
                  Details about products you purchase (e.g., car paint colors,
                  quantities, vehicle make/model information you provide), payment
                  information (processed by third-party providers), order history, and
                  shipping preferences.
                </li>
                <li>
                  <strong className="text-navy">Customer Support Communications:</strong>{' '}
                  Information you provide when contacting us via email, chat, phone, or
                  through our contact forms.
                </li>
                <li>
                  <strong className="text-navy">Product Reviews and Feedback:</strong>{' '}
                  Reviews, ratings, photos, or other content you submit about our car
                  paints or services.
                </li>
                <li>
                  <strong className="text-navy">Other Information:</strong> Any details
                  you voluntarily provide, such as preferences for paint types, vehicle
                  details, or marketing preferences.
                </li>
              </ul>
            </SubSection>

            <SubSection title="Information Collected Automatically">
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-navy">Usage and Device Information:</strong> IP
                  address, browser type, operating system, device identifiers, pages
                  visited, time spent on pages, clickstream data, and referring URLs.
                </li>
                <li>
                  <strong className="text-navy">Location Information:</strong>{' '}
                  Approximate geographic location derived from your IP address or device
                  settings (e.g., country or city level).
                </li>
                <li>
                  <strong className="text-navy">Cookies and Tracking Technologies:</strong>{' '}
                  See the &ldquo;Cookies and Similar Technologies&rdquo; section below.
                </li>
              </ul>
            </SubSection>

            <SubSection title="Information from Third Parties">
              <p>
                We may receive information from business partners, analytics providers,
                advertising networks, and payment processors. For example, we may receive
                confirmation of payment processing from our gateway providers.
              </p>
            </SubSection>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use the collected information for the following purposes:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-navy">To Process Transactions:</strong> Fulfill
                orders, process payments, arrange shipping, and provide order
                confirmations and updates.
              </li>
              <li>
                <strong className="text-navy">To Provide Customer Service:</strong>{' '}
                Respond to inquiries, resolve issues with orders or products (such as
                paint matching or application advice), and manage returns or warranties.
              </li>
              <li>
                <strong className="text-navy">To Personalize Your Experience:</strong>{' '}
                Recommend products based on your past purchases, browsing history, or
                vehicle information.
              </li>
              <li>
                <strong className="text-navy">To Improve Our Site and Services:</strong>{' '}
                Analyze usage trends, conduct market research, and enhance product
                offerings (e.g., new car paint formulations or colors).
              </li>
              <li>
                <strong className="text-navy">Marketing and Communications:</strong> Send
                you promotional emails, newsletters, special offers, or updates about MS
                Coatings products, subject to your preferences. You can opt out at any
                time.
              </li>
              <li>
                <strong className="text-navy">Security and Fraud Prevention:</strong>{' '}
                Detect and prevent fraudulent transactions, unauthorized access, and other
                illegal activities.
              </li>
              <li>
                <strong className="text-navy">Legal Compliance:</strong> Comply with
                applicable laws, regulations, court orders, or governmental requests.
              </li>
              <li>
                <strong className="text-navy">Business Purposes:</strong> Such as
                auditing, data analysis, system maintenance, and corporate transactions
                (e.g., mergers or acquisitions).
              </li>
            </ul>
          </Section>

          <Section title="3. Sharing of Your Information">
            <p>
              We do not sell your Personal Information to third parties. We may share
              your information in the following circumstances:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-navy">Service Providers:</strong> With trusted
                third-party vendors who assist us in operating the Site and providing
                services, such as:
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Payment processors (e.g., Stripe, PayPal)</li>
                  <li>Shipping carriers (e.g., UPS, FedEx, DHL)</li>
                  <li>Email marketing and hosting providers</li>
                  <li>Analytics and advertising partners (e.g., Google Analytics, Meta)</li>
                </ul>
                <p className="mt-2">
                  These providers are contractually obligated to use your information
                  only for the purposes we specify and to maintain its confidentiality.
                </p>
              </li>
              <li>
                <strong className="text-navy">Legal Requirements:</strong> When required
                by law, subpoena, court order, or to protect the rights, property, or
                safety of MS Coatings, our users, or the public.
              </li>
              <li>
                <strong className="text-navy">Business Transfers:</strong> In connection
                with a merger, acquisition, bankruptcy, or sale of assets, your
                information may be transferred as part of that transaction.
              </li>
              <li>
                <strong className="text-navy">With Your Consent:</strong> In other
                situations where you have explicitly consented to the sharing.
              </li>
            </ul>
          </Section>

          <Section id="cookies" title="4. Cookies and Similar Technologies">
            <p>
              We use cookies, web beacons, pixels, and similar tracking technologies to
              enhance your experience, analyze trends, and deliver personalized
              advertising.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-navy">Essential Cookies:</strong> Required for
                site functionality (e.g., shopping cart, account login).
              </li>
              <li>
                <strong className="text-navy">Performance and Analytics Cookies:</strong>{' '}
                Help us understand how visitors use the Site.
              </li>
              <li>
                <strong className="text-navy">Functional Cookies:</strong> Remember your
                preferences (e.g., language or region).
              </li>
              <li>
                <strong className="text-navy">Advertising Cookies:</strong> Deliver
                relevant ads on our Site and third-party sites.
              </li>
            </ul>
            <p>
              You can manage cookie preferences through your browser settings. Note that
              disabling certain cookies may affect Site functionality. For more details,
              please review our{' '}
              <Link
                href="/cookie-policy"
                className="font-medium text-premium-blue hover:text-cyan"
              >
                Cookie Policy
              </Link>{' '}
              or{' '}
              <a
                href="mailto:privacy@mscoatings.com"
                className="font-medium text-premium-blue hover:text-cyan"
              >
                contact us
              </a>
              .
            </p>
          </Section>

          <Section title="5. Data Security">
            <p>
              We implement reasonable administrative, technical, and physical safeguards
              to protect your Personal Information. However, no method of transmission
              over the Internet or electronic storage is 100% secure. We cannot guarantee
              absolute security.
            </p>
            <p>
              If you create an account, you are responsible for keeping your password
              confidential.
            </p>
          </Section>

          <Section title="6. Your Rights and Choices">
            <p>
              Depending on your location, you may have the following rights regarding
              your Personal Information:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Access, correct, or delete your data.</li>
              <li>Opt out of the sale of your Personal Information (we do not sell it).</li>
              <li>Opt out of targeted advertising.</li>
              <li>Withdraw consent where processing is based on consent.</li>
              <li>Object to or restrict certain processing.</li>
              <li>Data portability (receive your data in a structured format).</li>
            </ul>
            <p>
              To exercise these rights, contact us using the details below. We will
              respond within the time required by applicable law (typically 30 days). We
              may need to verify your identity before processing requests.
            </p>
            <p>
              <strong className="text-navy">Opt-Out of Marketing Emails:</strong> Click
              the &ldquo;unsubscribe&rdquo; link in our emails or contact us directly.
            </p>
            <p>
              <strong className="text-navy">Do Not Track:</strong> Our Site does not
              currently respond to &ldquo;Do Not Track&rdquo; signals from browsers.
            </p>
          </Section>

          <Section title="7. Children&apos;s Privacy">
            <p>
              Our Site is not intended for children under the age of 16 (or the applicable
              age of majority in your jurisdiction). We do not knowingly collect Personal
              Information from children. If we learn we have collected such data, we will
              delete it promptly. Parents or guardians should contact us if they believe
              their child has provided information to us.
            </p>
          </Section>

          <Section title="8. International Data Transfers">
            <p>
              MS Coatings is based in Uganda. Your information may be transferred to,
              stored, and processed in countries outside your own, which may have
              different data protection laws. We take appropriate safeguards (such as
              Standard Contractual Clauses) to ensure your data receives adequate
              protection.
            </p>
          </Section>

          <Section title="9. Retention of Information">
            <p>
              We retain your Personal Information for as long as necessary to fulfill the
              purposes outlined in this Policy, comply with legal obligations, resolve
              disputes, and enforce agreements. Typical retention periods include the
              duration of our business relationship plus any applicable statutory periods
              (e.g., for tax or warranty purposes).
            </p>
          </Section>

          <Section title="10. Changes to This Privacy Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of
              material changes by posting the new policy on this page and updating the
              effective date. We encourage you to review this page periodically for the
              latest information on our privacy practices.
            </p>
          </Section>

          <Section title="11. Contact Us">
            <p>
              If you have any questions, concerns, or requests regarding this Privacy
              Policy, please contact us at:
            </p>
            <address className="not-italic">
              <p className="font-semibold text-navy">MS Coatings</p>
              <p>Kampala, Uganda</p>
              <p>
                Email:{' '}
                <a
                  href="mailto:privacy@mscoatings.com"
                  className="font-medium text-premium-blue hover:text-cyan"
                >
                  privacy@mscoatings.com
                </a>
              </p>
              <p>
                Phone:{' '}
                <a
                  href="tel:+256775305294"
                  className="font-medium text-premium-blue hover:text-cyan"
                >
                  +256 775 305 294
                </a>
              </p>
            </address>
            <p>We will make every effort to address your concerns promptly.</p>
          </Section>

          <div className="space-y-4 border-t border-gray-100 pt-8 text-sm leading-relaxed text-body sm:text-base">
            <p>
              Thank you for trusting MS Coatings with your car paint needs. Your privacy
              is important to us, and we are dedicated to maintaining the highest
              standards of data protection.
            </p>
            
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
