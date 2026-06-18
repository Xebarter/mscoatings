'use client';

import Link from 'next/link';
import { Trash2, ArrowLeft, ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import Header from '@/components/header';
import Footer from '@/components/footer';
import BrandButton from '@/components/brand-button';

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, clearCart, cartTotal } = useCart();
  const total = cartTotal * 1.1;

  return (
    <div className="min-h-screen bg-white">
      <Header cartCount={cart.length} />

      <div className="bg-light-gray border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm font-medium text-premium-blue transition-colors hover:text-cyan"
          >
            <ArrowLeft size={18} />
            Continue Shopping
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h1 className="mb-12 text-3xl font-extrabold text-navy sm:text-4xl">Shopping Cart</h1>

        {cart.length === 0 ? (
          <div className="card-premium py-20 text-center">
            <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <p className="mb-6 text-lg text-body">Your cart is empty</p>
            <BrandButton href="/products" variant="primary" size="lg">
              Browse Products
            </BrandButton>
          </div>
        ) : (
          <div className="grid gap-12 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item) => (
                <div key={item.productId} className="card-premium flex gap-6 p-6">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-light-gray">
                    <img src={item.image} alt={item.productName} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="font-bold text-navy">{item.productName}</h3>
                      <p className="text-sm text-body">${item.price} each</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center rounded-xl border border-gray-200">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="px-3 py-2 text-navy hover:bg-light-gray"
                        >
                          −
                        </button>
                        <span className="min-w-[40px] px-3 py-2 text-center font-semibold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="px-3 py-2 text-navy hover:bg-light-gray"
                        >
                          +
                        </button>
                      </div>
                      <p className="min-w-[80px] text-right font-bold text-navy">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.productId)}
                        className="text-gray-400 transition-colors hover:text-performance-red"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="card-premium sticky top-28 p-8">
                <h2 className="mb-6 text-xl font-bold text-navy">Order Summary</h2>
                <div className="space-y-3 border-b border-gray-100 pb-6 text-sm text-body">
                  <div className="flex justify-between"><span>Subtotal</span><span>${cartTotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Shipping</span><span className="text-premium-blue font-medium">FREE</span></div>
                  <div className="flex justify-between"><span>Tax (10%)</span><span>${(cartTotal * 0.1).toFixed(2)}</span></div>
                </div>
                <div className="flex justify-between py-6">
                  <span className="font-bold text-navy">Total</span>
                  <span className="text-2xl font-extrabold text-navy">${total.toFixed(2)}</span>
                </div>
                <BrandButton href="/checkout" variant="primary" className="mb-3 w-full">
                  Proceed to Checkout
                </BrandButton>
                <button
                  type="button"
                  onClick={clearCart}
                  className="w-full rounded-xl py-3 text-sm font-semibold text-body transition-colors hover:text-performance-red"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
