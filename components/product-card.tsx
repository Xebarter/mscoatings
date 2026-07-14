'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SeoProduct } from '@/lib/seo/json-ld';
import { useCart } from '@/lib/cart-context';
import { getCategoryColor } from '@/lib/brand';
import toast from 'react-hot-toast';
import { ArrowRight, ShoppingCart } from 'lucide-react';
import ProductImage from '@/components/product-image';
import { formatUgx } from '@/lib/currency';
import { buildProductImageAlt } from '@/lib/seo/images';

interface ProductCardProps {
  product: SeoProduct;
  compact?: boolean;
  density?: 'default' | 'compact' | 'adaptive';
  highlighted?: boolean;
}

export default function ProductCard({
  product,
  compact = false,
  density = 'default',
  highlighted = false,
}: ProductCardProps) {
  const isCompact = compact || density === 'compact';
  const isAdaptive = density === 'adaptive';
  const [isAdding, setIsAdding] = useState(false);
  const { addToCart } = useCart();
  const categoryColor = getCategoryColor(product.category);
  const inStock = product.stock > 0;
  const imageAlt = buildProductImageAlt(product);

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
    <article
      id={`product-${product.id}`}
      className={`card-premium group flex h-full scroll-mt-28 flex-col overflow-hidden transition-shadow duration-500 ${
        highlighted
          ? 'ring-2 ring-premium-blue shadow-[0_0_0_4px_rgba(0,119,200,0.15)]'
          : ''
      }`}
    >
      <Link href={`/product/${product.id}`} className="flex h-full flex-col">
        <div className="relative border-b border-gray-100">
          <ProductImage
            src={product.image}
            alt={imageAlt}
            productId={product.id}
            variant="card"
          />
          <div
            className={`absolute max-w-[calc(100%-1.5rem)] truncate rounded-full font-medium text-white shadow-sm ${
              isCompact
                ? 'left-2 top-2 px-2 py-0.5 text-[9px]'
                : isAdaptive
                  ? 'left-2 top-2 px-2 py-0.5 text-[9px] lg:left-4 lg:top-4 lg:px-2.5 lg:py-0.5 lg:text-[10px]'
                  : 'left-3 top-3 px-2 py-0.5 text-[10px] sm:left-4 sm:top-4 sm:px-2.5 sm:py-1 sm:text-[11px]'
            }`}
            style={{ backgroundColor: categoryColor }}
          >
            {product.category}
          </div>
          {inStock && product.stock <= 5 && !isCompact && (
            <span
              className={`absolute rounded-full bg-amber-50 font-medium text-amber-700 ring-1 ring-amber-200 ${
                isAdaptive
                  ? 'right-2 top-2 hidden px-2 py-0.5 text-[9px] lg:right-4 lg:top-4 lg:block lg:px-2.5 lg:py-0.5 lg:text-[10px]'
                  : 'right-3 top-3 px-2 py-0.5 text-[10px] sm:right-4 sm:top-4 sm:px-2.5 sm:py-1 sm:text-[11px]'
              }`}
            >
              Low stock
            </span>
          )}
          {!inStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-navy/50 backdrop-blur-[1px]">
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-md sm:px-4 sm:py-2 sm:text-sm">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        <div
          className={`flex flex-1 flex-col ${
            isCompact
              ? 'p-2.5'
              : isAdaptive
                ? 'p-2.5 lg:p-4'
                : 'p-3 sm:p-4'
          }`}
        >
          <h3
            className={`line-clamp-2 font-semibold leading-snug text-navy transition-colors group-hover:text-premium-blue ${
              isCompact
                ? 'mb-1 text-xs'
                : isAdaptive
                  ? 'mb-1 text-xs lg:mb-1.5 lg:text-sm'
                  : 'mb-1.5 text-sm sm:mb-2 sm:text-base'
            }`}
          >
            {product.name}
          </h3>
          {(isAdaptive || !isCompact) && (
            <p
              className={`flex-1 leading-snug text-body line-clamp-2 ${
                isAdaptive
                  ? 'mb-2 hidden text-xs lg:mb-2.5 lg:block lg:text-sm'
                  : 'mb-2 text-xs sm:mb-2.5 sm:text-sm'
              }`}
            >
              {product.description}
            </p>
          )}

          <div
            className={`mt-auto flex items-end justify-between border-t border-gray-100 ${
              isCompact
                ? 'gap-2 pt-2'
                : isAdaptive
                  ? 'gap-2 pt-2 lg:gap-3 lg:pt-3'
                  : 'gap-2 pt-2.5 sm:gap-3 sm:pt-3'
            }`}
          >
            <div className="min-w-0">
              {!isCompact && !isAdaptive && (
                <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400 sm:text-[10px]">
                  Price
                </p>
              )}
              <p
                className={`font-bold text-navy ${
                  isCompact
                    ? 'text-sm leading-tight'
                    : isAdaptive
                      ? 'text-sm leading-tight lg:text-base'
                      : 'text-base leading-tight sm:text-lg'
                }`}
              >
                {formatUgx(product.price)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isAdding || !inStock}
                className={`flex items-center justify-center rounded-xl bg-navy text-white shadow-sm transition-all hover:bg-charcoal hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${
                  isCompact
                    ? 'h-9 w-9'
                    : isAdaptive
                      ? 'h-9 w-9 lg:h-11 lg:w-11'
                      : 'h-10 w-10 sm:h-11 sm:w-11'
                }`}
                aria-label="Add to cart"
              >
                <ShoppingCart
                  className={
                    isCompact
                      ? 'h-4 w-4'
                      : isAdaptive
                        ? 'h-4 w-4 lg:h-[18px] lg:w-[18px]'
                        : 'h-[18px] w-[18px]'
                  }
                />
              </button>
              {(!isCompact || isAdaptive) && (
                <span
                  className={`items-center justify-center rounded-xl border border-gray-200 bg-white text-navy shadow-sm transition-all group-hover:border-premium-blue group-hover:text-premium-blue ${
                    isAdaptive
                      ? 'hidden h-11 w-11 lg:flex'
                      : 'flex h-10 w-10 sm:h-11 sm:w-11'
                  }`}
                  aria-hidden
                >
                  <ArrowRight size={18} />
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
