'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { createOrder, OrderItem } from '@/lib/firestore';
import toast from 'react-hot-toast';
import Header from '@/components/header';
import Footer from '@/components/footer';
import BrandButton from '@/components/brand-button';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, clearCart, cartTotal } = useCart();
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <Header cartCount={0} />
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
      const orderId = await createOrder({
        items: orderItems,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
        totalPrice: cartTotal,
        status: 'pending',
      });
      toast.success('Order placed successfully');
      clearCart();
      router.push(`/order-confirmation/${orderId}`);
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const total = cartTotal * 1.1;
  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-navy transition-shadow focus:border-premium-blue focus:outline-none focus:ring-2 focus:ring-premium-blue/20';

  return (
    <div className="min-h-screen bg-white">
      <Header cartCount={cart.length} />

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
                    <input type="text" name="customerName" value={formData.customerName} onChange={handleInputChange} placeholder="John Doe" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-navy">Email Address</label>
                    <input type="email" name="customerEmail" value={formData.customerEmail} onChange={handleInputChange} placeholder="john@example.com" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-navy">Phone Number</label>
                    <input type="tel" name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} placeholder="+256 700 000 000" className={inputClass} />
                  </div>
                </div>
              </div>

              <div className="card-premium p-8">
                <h2 className="mb-6 text-xl font-bold text-navy">Payment</h2>
                <div className="mb-6 rounded-xl border border-premium-blue/20 bg-light-gray p-4">
                  <p className="font-semibold text-navy">Demo Mode</p>
                  <p className="text-sm text-body">This is a demo checkout. Use any card details to proceed.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-navy">Card Number</label>
                    <input type="text" placeholder="4242 4242 4242 4242" maxLength={19} className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-navy">Expiry</label>
                      <input type="text" placeholder="MM/YY" className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-navy">CVC</label>
                      <input type="text" placeholder="123" maxLength={4} className={inputClass} />
                    </div>
                  </div>
                </div>
              </div>

              <BrandButton type="submit" variant="primary" size="lg" disabled={isProcessing} className="w-full">
                {isProcessing ? 'Processing...' : 'Complete Purchase'}
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
                      <p className="text-body">{item.quantity} × ${item.price.toFixed(2)}</p>
                    </div>
                    <p className="font-semibold text-navy">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-b border-gray-100 pb-6 text-sm text-body">
                <div className="flex justify-between"><span>Subtotal</span><span>${cartTotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Shipping</span><span className="text-premium-blue">FREE</span></div>
                <div className="flex justify-between"><span>Tax (10%)</span><span>${(cartTotal * 0.1).toFixed(2)}</span></div>
              </div>
              <div className="flex justify-between pt-6">
                <span className="font-bold text-navy">Total</span>
                <span className="text-2xl font-extrabold text-navy">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
