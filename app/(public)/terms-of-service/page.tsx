import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { buildPageMetadata } from '@/lib/seo/metadata';
import {
  BUSINESS_INFO,
  getMailtoHref,
  getTelHref,
} from '@/lib/seo/business';

export const metadata: Metadata = buildPageMetadata({
  title: 'Terms of Service',
  description:
    'Read the MS Coatings Terms of Service governing your use of our website, orders, shipping, returns, and product purchases in Uganda.',
  path: '/terms-of-service',
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

export default function TermsOfServicePage() {
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
            <span className="font-medium text-navy">Terms of Service</span>
          </nav>

          <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            Terms of Service
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
              Welcome to MS Coatings! These Terms of Service (&ldquo;Terms&rdquo;)
              govern your access to and use of our website (
              <a
                href="https://www.mscoatings.shop"
                className="font-medium text-premium-blue hover:text-cyan"
              >
                https://www.mscoatings.shop
              </a>
              ), mobile applications (if any), and any related services, features,
              or content (collectively, the &ldquo;Site&rdquo;). MS Coatings
              provides an online platform for the sale of high-quality automotive
              paints, coatings, accessories, and related products.
            </p>
            <p>
              By accessing or using the Site, you agree to be bound by these
              Terms. If you do not agree to these Terms, please do not use the
              Site.
            </p>
          </div>

          <Section title="1. General Information">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-navy">Our Company:</strong> MS Coatings is
                an online retailer specializing in premium car paints, automotive
                coatings, primers, clear coats, tools, and supplies.
              </li>
              <li>
                <strong className="text-navy">Eligibility:</strong> You must be at
                least 18 years old (or the age of majority in your jurisdiction) to
                use the Site. By using the Site, you represent and warrant that you
                meet this requirement.
              </li>
              <li>
                <strong className="text-navy">Account Registration:</strong> To
                access certain features (e.g., placing orders, tracking shipments),
                you may need to create an account. You are responsible for
                maintaining the confidentiality of your account credentials and for
                all activities that occur under your account. Notify us immediately
                of any unauthorized use.
              </li>
            </ul>
          </Section>

          <Section title="2. Orders, Purchases, and Pricing">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-navy">Order Acceptance:</strong> All orders
                are subject to acceptance by MS Coatings. We reserve the right to
                refuse, cancel, or limit any order for any reason, including errors
                in pricing, product availability, or suspected fraud.
              </li>
              <li>
                <strong className="text-navy">Pricing:</strong> Prices are listed in
                the applicable currency and are subject to change without notice.
                Taxes, shipping, and handling fees will be added at checkout.
              </li>
              <li>
                <strong className="text-navy">Payment:</strong> We accept major
                credit/debit cards and other payment methods through secure
                third-party processors. You authorize us (or our processors) to
                charge your payment method for the total amount of your order.
              </li>
              <li>
                <strong className="text-navy">Product Availability:</strong> While we
                strive for accuracy, product availability and descriptions may
                contain errors. We are not responsible for inaccuracies caused by
                manufacturer updates or supply issues.
              </li>
            </ul>
          </Section>

          <Section title="3. Shipping and Delivery">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Shipping times and costs are estimated and may vary based on
                location, carrier, and product weight/volume.
              </li>
              <li>
                Risk of loss and title for purchased items pass to you upon delivery
                to the carrier.
              </li>
              <li>
                International orders may be subject to customs duties, taxes, and
                import fees, which are your responsibility.
              </li>
            </ul>
          </Section>

          <Section id="returns" title="4. Returns, Refunds, and Cancellations">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-navy">Return Policy:</strong> Unopened
                products may be returned within 30 days of delivery for a refund or
                exchange, subject to our Return Policy (available on the Site).
                Opened or used paint products are generally non-returnable due to
                health, safety, and regulatory reasons unless defective.
              </li>
              <li>
                <strong className="text-navy">Defective Products:</strong> If you
                receive defective or damaged goods, contact us promptly with proof
                of purchase and photos. We will evaluate and, at our discretion,
                offer a replacement, repair, or refund.
              </li>
              <li>
                <strong className="text-navy">Cancellations:</strong> Orders may be
                canceled before shipment. Contact customer service as soon as
                possible.
              </li>
            </ul>
            <p>
              Full details are available in this Return &amp; Refund Policy section
              and by contacting{' '}
              <a
                href={getMailtoHref(BUSINESS_INFO.supportEmail)}
                className="font-medium text-premium-blue hover:text-cyan"
              >
                {BUSINESS_INFO.supportEmail}
              </a>
              .
            </p>
          </Section>

          <Section title="5. Product Information and Use">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-navy">Color Accuracy:</strong> Car paint
                colors may vary slightly due to monitor settings, lighting
                conditions, batch differences, or application methods. We recommend
                testing on a small area before full application.
              </li>
              <li>
                <strong className="text-navy">Technical Advice:</strong> Any
                application advice or compatibility information provided on the Site
                is for general guidance only. Proper surface preparation,
                environmental conditions, and safety precautions are your
                responsibility. Always follow manufacturer instructions and
                applicable safety standards.
              </li>
              <li>
                <strong className="text-navy">Warranties:</strong> Products carry
                the limited warranties provided by their respective manufacturers. MS
                Coatings makes no additional warranties beyond those explicitly
                stated. All products are sold &ldquo;as is&rdquo; except as required
                by law.
              </li>
            </ul>
          </Section>

          <Section title="6. Intellectual Property">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                All content on the Site—including text, images, logos, product
                photos, videos, trademarks, and designs—is owned by MS Coatings or
                its licensors and protected by copyright, trademark, and other
                intellectual property laws.
              </li>
              <li>
                You may not reproduce, distribute, modify, or create derivative
                works from Site content without our prior written consent.
              </li>
              <li>
                <strong className="text-navy">Limited License:</strong> We grant you
                a limited, revocable, non-exclusive, non-transferable license to
                access and use the Site for personal, non-commercial shopping
                purposes.
              </li>
            </ul>
          </Section>

          <Section title="7. User-Generated Content">
            <p>
              You may submit reviews, photos, comments, or other content
              (&ldquo;User Content&rdquo;). By submitting User Content, you grant MS
              Coatings a worldwide, royalty-free, perpetual, irrevocable, and
              sublicensable license to use, reproduce, modify, and display it for
              business purposes.
            </p>
            <p>
              You are solely responsible for your User Content and represent that it
              does not infringe any third-party rights and complies with these Terms.
              We reserve the right to remove any User Content at our discretion.
            </p>
          </Section>

          <Section title="8. Prohibited Conduct">
            <p>You agree not to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Use the Site for any unlawful purpose or in violation of any laws.</li>
              <li>
                Engage in fraud, misrepresentation, or deceptive practices (e.g.,
                false reviews).
              </li>
              <li>
                Attempt to gain unauthorized access to any part of the Site or other
                users&rsquo; accounts.
              </li>
              <li>
                Interfere with the Site&rsquo;s operation, including through viruses,
                bots, or scraping.
              </li>
              <li>Use the Site to harass, defame, or harm others.</li>
              <li>
                Resell or commercially exploit products purchased from the Site
                without authorization.
              </li>
            </ul>
          </Section>

          <Section title="9. Termination">
            <p>
              We may suspend or terminate your account or access to the Site at any
              time, with or without notice, for any reason, including violation of
              these Terms. Upon termination, your right to use the Site ceases
              immediately, but certain provisions (e.g., limitations of liability,
              governing law) survive.
            </p>
          </Section>

          <Section title="10. Disclaimers and Limitation of Liability">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-navy">Disclaimer of Warranties:</strong> The
                Site and all products are provided &ldquo;as is&rdquo; and &ldquo;as
                available&rdquo; without warranties of any kind, express or implied,
                including merchantability, fitness for a particular purpose, or
                non-infringement.
              </li>
              <li>
                <strong className="text-navy">Limitation of Liability:</strong> To
                the fullest extent permitted by law, MS Coatings shall not be liable
                for any indirect, incidental, special, consequential, or punitive
                damages arising from your use of the Site or purchase of products.
                Our total liability shall not exceed the amount you paid for the
                specific product giving rise to the claim.
              </li>
              <li>
                <strong className="text-navy">Force Majeure:</strong> We are not
                liable for delays or failures due to events beyond our reasonable
                control (e.g., natural disasters, strikes, supply chain disruptions).
              </li>
            </ul>
          </Section>

          <Section title="11. Indemnification">
            <p>
              You agree to indemnify, defend, and hold harmless MS Coatings, its
              officers, directors, employees, and agents from any claims, losses,
              liabilities, damages, and expenses (including legal fees) arising from
              your use of the Site, violation of these Terms, or infringement of
              any third-party rights.
            </p>
          </Section>

          <Section title="12. Governing Law and Dispute Resolution">
            <p>
              These Terms shall be governed by the laws of the Republic of Uganda,
              without regard to conflict of laws principles. Any disputes shall be
              resolved exclusively in the courts located in Kampala, Uganda.
            </p>
            <p>
              You agree to resolve disputes first through good-faith negotiation. If
              unresolved, disputes may be submitted to binding arbitration where
              permitted by law.
            </p>
          </Section>

          <Section title="13. Changes to These Terms">
            <p>
              We may update these Terms from time to time. We will notify you of
              material changes by posting the revised Terms on the Site and
              updating the effective date. Continued use of the Site after changes
              constitutes your acceptance of the new Terms.
            </p>
          </Section>

          <Section title="14. Miscellaneous">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                These Terms constitute the entire agreement between you and MS
                Coatings regarding the Site.
              </li>
              <li>If any provision is held invalid, the remainder remains in full force.</li>
              <li>Our failure to enforce any right does not waive that right.</li>
              <li>We may assign our rights under these Terms.</li>
            </ul>
          </Section>

          <Section title="15. Contact Us">
            <p>If you have any questions about these Terms, please contact us at:</p>
            <address className="not-italic">
              <p className="font-semibold text-navy">MS Coatings</p>
              <p>Kampala, Uganda</p>
              <p>
                Email:{' '}
                <a
                  href={getMailtoHref(BUSINESS_INFO.supportEmail)}
                  className="font-medium text-premium-blue hover:text-cyan"
                >
                  {BUSINESS_INFO.supportEmail}
                </a>
              </p>
              <p>
                Phone:{' '}
                <a
                  href={getTelHref()}
                  className="font-medium text-premium-blue hover:text-cyan"
                >
                  {BUSINESS_INFO.telephoneDisplay}
                </a>
              </p>
            </address>
            <p>
              Thank you for shopping with MS Coatings. We appreciate your trust and
              are committed to providing exceptional automotive paint products and
              service.
            </p>
          </Section>

          <div className="border-t border-gray-100 pt-8">
            
          </div>
        </div>
      </main>

    </div>
  );
}
