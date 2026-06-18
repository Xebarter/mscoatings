'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Ban } from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import BrandButton from '@/components/brand-button';

function PaymentCancelContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  return (
    <div className="text-center">
      <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
        <Ban size={48} className="text-amber-600" />
      </div>

      <h1 className="mb-4 text-3xl font-extrabold text-navy sm:text-4xl">
        Payment Cancelled
      </h1>
      <p className="mb-10 text-lg text-body">
        You cancelled the payment. Your cart items are still available if you
        want to complete checkout later.
      </p>

      {orderId && (
        <p className="mb-8 text-body">
          <strong className="text-navy">Order Reference:</strong>{' '}
          #{orderId.slice(0, 8).toUpperCase()}
        </p>
      )}

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <BrandButton href="/checkout" variant="primary" size="lg">
          Return to Checkout
        </BrandButton>
        <BrandButton href="/products" variant="secondary" size="lg">
          Continue Shopping
        </BrandButton>
      </div>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header cartCount={0} />
      <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
        <Suspense fallback={<div className="py-20 text-center text-body">Loading...</div>}>
          <PaymentCancelContent />
        </Suspense>
      </div>
      <Footer />
    </div>
  );
}
