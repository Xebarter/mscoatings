'use client';

import { Toaster } from 'react-hot-toast';
import { CartProvider } from '@/lib/cart-context';

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0F172A',
            color: '#FFFFFF',
            borderRadius: '12px',
          },
        }}
      />
    </CartProvider>
  );
}
