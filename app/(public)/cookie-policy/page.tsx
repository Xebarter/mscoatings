import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { BUSINESS_INFO, getMailtoHref } from '@/lib/seo/business';

export const metadata: Metadata = buildPageMetadata({
  title: 'Cookie Policy',
  description:
    'Learn how MS Coatings uses cookies and similar technologies on our website, and how you can manage your preferences.',
  path: '/cookie-policy',
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

export default function CookiePolicyPage() {
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
            <span className="font-medium text-navy">Cookie Policy</span>
          </nav>

          <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            Cookie Policy
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
              At MS Coatings, we use cookies and similar tracking technologies to
              enhance your shopping experience, improve our website (
              <a
                href="https://www.mscoatings.shop"
                className="font-medium text-premium-blue hover:text-cyan"
              >
                https://www.mscoatings.shop
              </a>
              ), and deliver relevant content and advertisements (collectively, the
              &ldquo;Site&rdquo;). This Cookie Policy explains what cookies are, the
              types we use, why we use them, and how you can manage your cookie
              preferences.
            </p>
            <p>
              This policy should be read alongside our{' '}
              <Link
                href="/privacy-policy"
                className="font-medium text-premium-blue hover:text-cyan"
              >
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link
                href="/terms-of-service"
                className="font-medium text-premium-blue hover:text-cyan"
              >
                Terms of Service
              </Link>
              .
            </p>
          </div>

          <Section title="1. What Are Cookies?">
            <p>
              Cookies are small text files that are stored on your device (computer,
              tablet, or mobile) when you visit a website. They allow the website to
              recognize your device and remember certain information about your visit,
              such as your preferences and settings.
            </p>
            <p>
              We also use similar technologies such as web beacons, pixels, and local
              storage for the same purposes.
            </p>
          </Section>

          <Section title="2. Why We Use Cookies">
            <p>We use cookies to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Enable essential Site functionality (e.g., shopping cart and secure
                checkout)
              </li>
              <li>
                Personalize your experience (e.g., remembering your vehicle details or
                preferred paint colors)
              </li>
              <li>Analyze how visitors use our Site to improve performance</li>
              <li>Deliver relevant marketing and advertisements</li>
              <li>Ensure security and prevent fraud</li>
            </ul>
          </Section>

          <Section title="3. Types of Cookies We Use">
            <p>We categorize the cookies we use as follows:</p>

            <SubSection title="Essential Cookies (Strictly Necessary)">
              <p>
                These cookies are required for the Site to function properly and
                cannot be disabled.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Shopping cart and checkout process</li>
                <li>Account login and authentication</li>
                <li>Security features (fraud detection)</li>
                <li>Remembering your cookie consent preferences</li>
              </ul>
            </SubSection>

            <SubSection title="Performance and Analytics Cookies">
              <p>
                These help us understand how visitors interact with the Site so we can
                improve it.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Google Analytics (or similar) to track page views, bounce rates, and
                  popular products
                </li>
                <li>
                  Site usage statistics (e.g., which car paint categories are most
                  viewed)
                </li>
                <li>Error tracking and performance monitoring</li>
              </ul>
            </SubSection>

            <SubSection title="Functional Cookies">
              <p>
                These allow the Site to remember your choices and provide enhanced
                features.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Language or region preferences</li>
                <li>Previously viewed products or saved paint color matches</li>
                <li>Wishlist or favorite items</li>
              </ul>
            </SubSection>

            <SubSection title="Targeting / Advertising Cookies">
              <p>
                These cookies help us and our advertising partners deliver more
                relevant ads on our Site and across the internet.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Tracking products you&rsquo;ve viewed (e.g., specific car paints or
                  coatings)
                </li>
                <li>
                  Retargeting advertisements on platforms like Google, Meta
                  (Facebook/Instagram), and others
                </li>
                <li>Measuring the effectiveness of our marketing campaigns</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="4. Third-Party Cookies">
            <p>Some cookies on our Site are placed by third-party service providers. These include:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Payment processors (e.g., Stripe, PayPal)</li>
              <li>Shipping carriers</li>
              <li>Analytics providers (Google Analytics)</li>
              <li>Advertising networks (Google Ads, Meta Pixel, etc.)</li>
              <li>Social media plugins (for sharing products)</li>
            </ul>
            <p>
              These third parties may collect information about your online activity
              over time and across different websites. We do not control these
              third-party cookies.
            </p>
          </Section>

          <Section title="5. How Long Cookies Stay on Your Device">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-navy">Session Cookies:</strong> Temporary and
                deleted when you close your browser.
              </li>
              <li>
                <strong className="text-navy">Persistent Cookies:</strong> Remain on
                your device for a set period (from a few days to several years) or
                until you delete them.
              </li>
            </ul>
          </Section>

          <Section title="6. Managing Your Cookie Preferences">
            <p>You have several options to control cookies:</p>

            <SubSection title="Browser Settings">
              <p>Most web browsers allow you to:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Block all or specific cookies</li>
                <li>Delete existing cookies</li>
                <li>Receive notifications when a cookie is set</li>
              </ul>
              <p>
                Please note that disabling essential cookies may prevent you from using
                certain features of the Site, such as adding items to your cart or
                completing a purchase.
              </p>
            </SubSection>

            <SubSection title="Cookie Consent Manager">
              <p>
                When you first visit our Site, you may see a cookie consent banner
                that allows you to accept or customize your preferences.
              </p>
            </SubSection>

            <SubSection title="Opting Out of Targeted Advertising">
              <p>
                You can opt out of interest-based advertising through industry
                initiatives such as:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <a
                    href="https://youradchoices.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-premium-blue hover:text-cyan"
                  >
                    YourAdChoices
                  </a>{' '}
                  (US)
                </li>
                <li>
                  <a
                    href="https://www.youronlinechoices.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-premium-blue hover:text-cyan"
                  >
                    European Interactive Digital Advertising Alliance (EDAA)
                  </a>
                </li>
              </ul>
            </SubSection>

            <SubSection title="Mobile Devices">
              <p>
                You can manage tracking permissions through your device settings (iOS
                or Android).
              </p>
            </SubSection>
          </Section>

          <Section title="7. Do Not Track Signals">
            <p>
              Our Site does not currently respond to &ldquo;Do Not Track&rdquo; (DNT)
              signals sent by your browser. However, you can still manage your
              preferences through the methods described above.
            </p>
          </Section>

          <Section title="8. Updates to This Cookie Policy">
            <p>
              We may update this Cookie Policy from time to time to reflect changes
              in our practices or applicable laws. We will post the revised policy on
              this page with an updated effective date. We encourage you to review it
              periodically.
            </p>
          </Section>

          <Section title="9. Contact Us">
            <p>
              If you have any questions about this Cookie Policy or our use of cookies,
              please contact us at:
            </p>
            <address className="not-italic">
              <p className="font-semibold text-navy">MS Coatings</p>
              <p>Kampala, Uganda</p>
              <p>
                Email:{' '}
                <a
                  href={getMailtoHref(BUSINESS_INFO.privacyEmail)}
                  className="font-medium text-premium-blue hover:text-cyan"
                >
                  {BUSINESS_INFO.privacyEmail}
                </a>
              </p>
            </address>
          </Section>

          <div className="space-y-4 border-t border-gray-100 pt-8 text-sm leading-relaxed text-body sm:text-base">
            <p>
              Thank you for shopping with MS Coatings. We value your privacy and are
              committed to providing a transparent and secure online experience while
              you browse and purchase premium car paints and automotive coatings.
            </p>
          
          </div>
        </div>
      </main>

    </div>
  );
}
