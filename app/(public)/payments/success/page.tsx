'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import BrandButton from '@/components/brand-button';
import { useCart } from '@/lib/cart-context';
import { formatUgx } from '@/lib/currency';

interface OrderStatusResponse {
  id: string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  customerName: string;
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { clearCart } = useCart();
  const [order, setOrder] = useState<OrderStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setIsLoading(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 8;

    async function pollStatus() {
      try {
        const response = await fetch(`/api/orders/status?id=${orderId}`);
        if (!response.ok) throw new Error('Failed to load order');

        const data = (await response.json()) as OrderStatusResponse;
        setOrder(data);

        if (data.paymentStatus === 'paid') {
          clearCart();
          setIsLoading(false);
          return;
        }

        attempts += 1;
        if (attempts < maxAttempts) {
          setTimeout(pollStatus, 2000);
        } else {
          setIsLoading(false);
        }
      } catch {
        setIsLoading(false);
      }
    }

    pollStatus();
  }, [orderId, clearCart]);

  if (!orderId) {
    return (
      <div className="text-center">
        <h1 className="mb-4 text-3xl font-extrabold text-navy">Payment Complete</h1>
        <p className="mb-8 text-body">Thank you. Your payment is being processed.</p>
        <BrandButton href="/products" variant="primary">Continue Shopping</BrandButton>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-light-gray">
        {isLoading ? (
          <Loader2 size={40} className="animate-spin text-premium-blue" />
        ) : (
          <CheckCircle2 size={48} className="text-premium-blue" />
        )}
      </div>

      <h1 className="mb-4 text-3xl font-extrabold text-navy sm:text-4xl">
        {order?.paymentStatus === 'paid' ? 'Payment Successful' : 'Payment Received'}
      </h1>
      <p className="mb-10 text-lg text-body">
        {order?.paymentStatus === 'paid'
          ? 'Your order is confirmed and will be processed shortly.'
          : 'We received your payment request. Confirmation may take a moment.'}
      </p>

      <div className="card-premium mb-8 p-8 text-left">
        <p className="text-body">
          <strong className="text-navy">Order Reference:</strong>{' '}
          #{orderId.slice(0, 8).toUpperCase()}
        </p>
        {order && (
          <p className="mt-2 text-body">
            <strong className="text-navy">Amount:</strong>{' '}
            {formatUgx(order.totalPrice)}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <BrandButton
          href={`/order-confirmation/${orderId}`}
          variant="primary"
          size="lg"
        >
          View Order
        </BrandButton>
        <BrandButton href="/products" variant="secondary" size="lg">
          Continue Shopping
        </BrandButton>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
        <Suspense
          fallback={
            <div className="flex justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-premium-blue" />
            </div>
          }
        >
          <PaymentSuccessContent />
        </Suspense>
      </div>
    </div>
  );
}
