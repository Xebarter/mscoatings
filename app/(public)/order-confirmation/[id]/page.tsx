'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import BrandButton from '@/components/brand-button';
import { formatUgx } from '@/lib/currency';

interface OrderStatusResponse {
  id: string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  customerName: string;
}

export default function OrderConfirmationPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<OrderStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;

    fetch(`/api/orders/status?id=${orderId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setOrder(data))
      .finally(() => setIsLoading(false));
  }, [orderId]);

  const isPaid = order?.paymentStatus === 'paid';

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
        <div className="text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-light-gray">
            {isLoading ? (
              <Loader2 size={40} className="animate-spin text-premium-blue" />
            ) : isPaid ? (
              <CheckCircle2 size={48} className="text-premium-blue" />
            ) : (
              <Clock size={48} className="text-amber-500" />
            )}
          </div>

          <h1 className="mb-4 text-3xl font-extrabold text-navy sm:text-4xl">
            {isPaid ? 'Order Confirmed' : 'Order Received'}
          </h1>
          <p className="mb-10 text-lg text-body">
            {isPaid
              ? 'Thank you for your order. A confirmation has been sent to your email address.'
              : 'Your order has been created. Payment confirmation is still pending.'}
          </p>

          <div className="card-premium mb-8 p-8 text-left">
            <h2 className="mb-6 text-xl font-bold text-navy">What Happens Next</h2>
            <ol className="space-y-4 text-body">
              {[
                isPaid
                  ? 'We confirm your order and prepare it for dispatch'
                  : 'Complete payment if you have not already done so',
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

          <div className="mb-10 rounded-xl border border-premium-blue/20 bg-light-gray p-6 text-left">
            <p className="text-body">
              <strong className="text-navy">Order Reference:</strong>{' '}
              #{orderId?.slice(0, 8).toUpperCase()}
            </p>
            {order && (
              <>
                <p className="mt-2 text-body">
                  <strong className="text-navy">Payment:</strong>{' '}
                  {order.paymentStatus}
                </p>
                <p className="mt-2 text-body">
                  <strong className="text-navy">Total:</strong>{' '}
                  {formatUgx(order.totalPrice)}
                </p>
              </>
            )}
          </div>

          <BrandButton href="/products" variant="primary" size="lg">
            Continue Shopping
          </BrandButton>
        </div>
      </div>

    </div>
  );
}
