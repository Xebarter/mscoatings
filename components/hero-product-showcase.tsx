'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ShoppingBag, ShoppingCart } from 'lucide-react';
import { Product } from '@/lib/firestore';
import { useCart } from '@/lib/cart-context';
import { getCategoryColor } from '@/lib/brand';
import BrandButton from '@/components/brand-button';
import toast from 'react-hot-toast';

interface HeroProductShowcaseProps {
  products: Product[];
  loading: boolean;
}

function formatPrice(price: number) {
  return `$${price.toFixed(2)}`;
}

export default function HeroProductShowcase({
  products,
  loading,
}: HeroProductShowcaseProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);

  const featuredProducts = useMemo(
    () => products.filter((product) => product.image?.trim() && product.stock > 0).slice(0, 6),
    [products]
  );

  const activeProduct = featuredProducts[activeIndex];

  useEffect(() => {
    setActiveIndex(0);
  }, [featuredProducts.length]);

  useEffect(() => {
    if (featuredProducts.length <= 1) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % featuredProducts.length);
    }, 6000);

    return () => window.clearInterval(interval);
  }, [featuredProducts.length]);

  const goToPrevious = () => {
    if (!featuredProducts.length) return;
    setActiveIndex(
      (current) => (current - 1 + featuredProducts.length) % featuredProducts.length
    );
  };

  const goToNext = () => {
    if (!featuredProducts.length) return;
    setActiveIndex((current) => (current + 1) % featuredProducts.length);
  };

  const addProductToCart = (redirectToCheckout = false) => {
    if (!activeProduct) return;

    addToCart({
      productId: activeProduct.id,
      productName: activeProduct.name,
      price: activeProduct.price,
      quantity: 1,
      image: activeProduct.image,
    });

    toast.success(
      redirectToCheckout ? 'Added — proceeding to checkout' : 'Added to cart'
    );

    if (redirectToCheckout) {
      router.push('/checkout');
    }
  };

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      addProductToCart(false);
    } catch {
      toast.error('Failed to add to cart');
    } finally {
      setIsAdding(false);
    }
  };

  const handleBuyNow = () => {
    setIsAdding(true);
    try {
      addProductToCart(true);
    } catch {
      toast.error('Failed to start checkout');
    } finally {
      setIsAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="relative lg:pb-16">
        <div className="card-premium animate-pulse overflow-hidden p-2">
          <div className="h-[220px] rounded-xl bg-gray-200 sm:h-[300px] lg:h-[380px]" />
        </div>
        <div className="card-premium mt-4 animate-pulse p-4 sm:p-5 lg:absolute lg:-bottom-6 lg:-left-6 lg:mt-0 lg:max-w-xs">
          <div className="mb-2 h-8 w-24 rounded bg-gray-200" />
          <div className="h-4 w-40 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!activeProduct) {
    return (
      <div className="card-premium flex min-h-[240px] flex-col items-center justify-center p-6 text-center sm:min-h-[320px] sm:p-8 lg:min-h-[420px]">
        <p className="mb-2 text-lg font-bold text-navy">Featured products coming soon</p>
        <p className="mb-6 max-w-sm text-sm text-body">
          Browse our catalog while we update the showcase with the latest coating systems.
        </p>
        <BrandButton href="/products" variant="primary">
          Explore Products
        </BrandButton>
      </div>
    );
  }

  const categoryColor = getCategoryColor(activeProduct.category);

  return (
    <div className="relative lg:pb-16">
      <div className="card-premium overflow-hidden p-1.5 sm:p-2">
        <div className="relative overflow-hidden rounded-xl bg-light-gray">
          <img
            key={activeProduct.id}
            src={activeProduct.image}
            alt={activeProduct.name}
            className="h-[220px] w-full object-cover transition-opacity duration-500 sm:h-[300px] lg:h-[380px]"
          />

          {featuredProducts.length > 1 && (
            <>
              <button
                type="button"
                onClick={goToPrevious}
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy shadow-md transition hover:bg-white sm:left-3 sm:h-10 sm:w-10"
                aria-label="Previous product"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={goToNext}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy shadow-md transition hover:bg-white sm:right-3 sm:h-10 sm:w-10"
                aria-label="Next product"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          <div
            className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-md sm:left-4 sm:top-4 sm:px-3 sm:text-xs"
            style={{ backgroundColor: categoryColor }}
          >
            {activeProduct.category}
          </div>
        </div>

        {featuredProducts.length > 1 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-3 [&::-webkit-scrollbar]:hidden">
            {featuredProducts.map((product, index) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition sm:h-16 sm:w-16 ${
                  index === activeIndex
                    ? 'border-premium-blue ring-2 ring-premium-blue/20'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
                aria-label={`View ${product.name}`}
                aria-current={index === activeIndex}
              >
                <img
                  src={product.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card-premium mt-4 p-4 sm:mt-5 sm:p-5 lg:absolute lg:-bottom-6 lg:-left-6 lg:mt-0 lg:max-w-xs">
        <Link
          href={`/product/${activeProduct.id}`}
          className="group mb-3 block"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-premium-blue">
            Featured Product
          </p>
          <h3 className="text-lg font-bold text-navy transition-colors group-hover:text-premium-blue">
            {activeProduct.name}
          </h3>
        </Link>

        <p className="mb-4 line-clamp-2 text-sm text-body">
          {activeProduct.description}
        </p>

        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400">From</p>
            <p className="text-2xl font-extrabold text-navy">
              {formatPrice(activeProduct.price)}
            </p>
          </div>
          <p className="text-xs font-medium text-emerald-600">
            {activeProduct.stock} in stock
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isAdding}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy transition hover:border-premium-blue hover:text-premium-blue disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingCart size={16} />
            Add to Cart
          </button>
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={isAdding}
            className="btn-primary inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingBag size={16} />
            Buy Now
          </button>
        </div>
      </div>

      <div className="gradient-accent-bar absolute -right-4 top-8 hidden w-24 lg:block" />
    </div>
  );
}
