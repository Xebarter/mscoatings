'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Product } from '@/lib/firestore';
import { useCart } from '@/lib/cart-context';
import { getCategoryColor } from '@/lib/brand';
import toast from 'react-hot-toast';
import { ArrowRight, ShoppingCart } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const { addToCart } = useCart();
  const categoryColor = getCategoryColor(product.category);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAdding(true);
    try {
      addToCart({
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: 1,
        image: product.image,
      });
      toast.success('Added to cart');
    } catch {
      toast.error('Failed to add to cart');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <article className="card-premium group flex h-full flex-col overflow-hidden">
      <Link href={`/product/${product.id}`} className="flex h-full flex-col">
        <div className="relative aspect-[4/3] overflow-hidden bg-light-gray">
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div
            className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-md sm:left-4 sm:top-4 sm:px-3 sm:text-xs"
            style={{ backgroundColor: categoryColor }}
          >
            {product.category}
          </div>
          {product.stock <= 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-navy/60">
              <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-navy">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4 sm:p-6">
          <h3 className="mb-2 text-base font-bold text-navy transition-colors group-hover:text-premium-blue sm:text-lg">
            {product.name}
          </h3>
          <p className="mb-4 flex-1 text-sm leading-relaxed text-body line-clamp-2 sm:mb-6">
            {product.description}
          </p>

          <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4 sm:gap-4 sm:pt-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-400">From</p>
              <p className="text-xl font-extrabold text-navy sm:text-2xl">${product.price}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isAdding || product.stock <= 0}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white transition-all hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-11"
                aria-label="Add to cart"
              >
                <ShoppingCart size={18} />
              </button>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-navy transition-colors group-hover:border-premium-blue group-hover:text-premium-blue sm:h-11 sm:w-11">
                <ArrowRight size={18} />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
