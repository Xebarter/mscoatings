'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Smartphone } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import type { OrderItem } from '@/lib/firestore';
import toast from 'react-hot-toast';
import Footer from '@/components/footer';
import BrandButton from '@/components/brand-button';
import { formatUgx } from '@/lib/currency';

export default function CheckoutPage() {
  const { cart, cartTotal } = useCart();
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
          <p className="mb-6 text-lg text-body">Your cart is empty</p>
          <BrandButton href="/products" variant="primary">Continue Shopping</BrandButton>
        </div>
        <Footer />
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) { toast.error('Please enter your name'); return; }
    if (!formData.customerEmail.trim()) { toast.error('Please enter your email'); return; }
    if (!formData.customerPhone.trim()) { toast.error('Please enter your phone number'); return; }

    setIsProcessing(true);
    try {
      const orderItems: OrderItem[] = cart.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
      }));

      const totalPrice = Math.round(cartTotal * 1.1);

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: orderItems,
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone,
          totalPrice,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to start payment');
      }

      toast.success('Redirecting to Paytota...');
      window.location.href = data.checkoutUrl;
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to start payment. Please try again.'
      );
      setIsProcessing(false);
    }
  };

  const total = Math.round(cartTotal * 1.1);
  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-navy transition-shadow focus:border-premium-blue focus:outline-none focus:ring-2 focus:ring-premium-blue/20';

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-light-gray border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <Link href="/cart" className="inline-flex items-center gap-2 text-sm font-medium text-premium-blue hover:text-cyan">
            <ArrowLeft size={18} /> Back to Cart
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h1 className="mb-12 text-3xl font-extrabold text-navy sm:text-4xl">Checkout</h1>

        <div className="grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="card-premium p-8">
                <h2 className="mb-6 text-xl font-bold text-navy">Shipping Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-navy">Full Name</label>
                    <input type="text" name="customerName" value={formData.customerName} onChange={handleInputChange} placeholder="John Doe" className={inputClass} required />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-navy">Email Address</label>
                    <input type="email" name="customerEmail" value={formData.customerEmail} onChange={handleInputChange} placeholder="john@example.com" className={inputClass} required />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-navy">Phone Number (Mobile Money)</label>
                    <input type="tel" name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} placeholder="256770123456" className={inputClass} required />
                    <p className="mt-2 text-sm text-body">Use your MTN or Airtel number in international format.</p>
                  </div>
                </div>
              </div>

              <div className="card-premium p-8">
                <h2 className="mb-6 text-xl font-bold text-navy">Payment</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 rounded-xl border border-premium-blue/20 bg-light-gray p-4">
                    <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-premium-blue" />
                    <div>
                      <p className="font-semibold text-navy">Paytota — Mobile Money & Cards</p>
                      <p className="text-sm text-body">
                        You will be redirected to Paytota to complete payment via MTN Mobile Money, Airtel Money, or card.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 rounded-xl border border-gray-200 p-4">
                    <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-navy" />
                    <div>
                      <p className="font-semibold text-navy">Secure checkout</p>
                      <p className="text-sm text-body">
                        Payments are processed securely by Paytota. Your card details are never stored on our servers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <BrandButton type="submit" variant="primary" size="lg" disabled={isProcessing} className="w-full">
                {isProcessing ? 'Starting payment...' : `Pay ${formatUgx(total)}`}
              </BrandButton>
            </form>
          </div>

          <div>
            <div className="card-premium sticky top-28 p-8">
              <h2 className="mb-6 text-xl font-bold text-navy">Order Summary</h2>
              <div className="mb-6 max-h-64 space-y-4 overflow-y-auto border-b border-gray-100 pb-6">
                {cart.map((item) => (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <div>
                      <p className="font-semibold text-navy">{item.productName}</p>
                      <p className="text-body">{item.quantity} × {formatUgx(item.price)}</p>
                    </div>
                    <p className="font-semibold text-navy">{formatUgx(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-b border-gray-100 pb-6 text-sm text-body">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatUgx(cartTotal)}</span></div>
                <div className="flex justify-between"><span>Shipping</span><span className="text-premium-blue">FREE</span></div>
                <div className="flex justify-between"><span>Tax (10%)</span><span>{formatUgx(cartTotal * 0.1)}</span></div>
              </div>
              <div className="flex justify-between pt-6">
                <span className="font-bold text-navy">Total</span>
                <span className="text-2xl font-extrabold text-navy">{formatUgx(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
