'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import BrandButton from '@/components/brand-button';

export default function OrderConfirmationPage() {
  const params = useParams();
  const orderId = params.id as string;

  return (
    <div className="min-h-screen bg-white">
      <Header cartCount={0} />

      <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
        <div className="text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-light-gray">
            <CheckCircle2 size={48} className="text-premium-blue" />
          </div>

          <h1 className="mb-4 text-3xl font-extrabold text-navy sm:text-4xl">Order Confirmed</h1>
          <p className="mb-10 text-lg text-body">
            Thank you for your order. A confirmation has been sent to your email address.
          </p>

          <div className="card-premium mb-8 p-8 text-left">
            <h2 className="mb-6 text-xl font-bold text-navy">What Happens Next</h2>
            <ol className="space-y-4 text-body">
              {[
                'We confirm your order and prepare it for dispatch',
                'You receive a tracking number via email',
                'Your order arrives within 5–7 business days',
              ].map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-1">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="mb-10 rounded-xl border border-premium-blue/20 bg-light-gray p-6">
            <p className="text-body">
              <strong className="text-navy">Order Reference:</strong>{' '}
              #{orderId?.slice(0, 8).toUpperCase()}
            </p>
          </div>

          <BrandButton href="/products" variant="primary" size="lg">
            Continue Shopping
          </BrandButton>
        </div>
      </div>

      <Footer />
    </div>
  );
}
