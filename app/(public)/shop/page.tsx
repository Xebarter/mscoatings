'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { getProducts, Product } from '@/lib/firestore';
import toast from 'react-hot-toast';
import ProductCard from '@/components/product-card';
import SearchBar from '@/components/search-bar';

function ProductGridSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="card-premium overflow-hidden">
          <div className="aspect-[5/4] bg-gray-200" />
          <div className="space-y-2 p-3 sm:p-4">
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="hidden h-3 w-full rounded bg-gray-100 sm:block" />
            <div className="h-6 w-1/2 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ShopContent() {
  const searchParams = useSearchParams();
  const highlightProductId = searchParams.get('product');
  const hasScrolledRef = useRef(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const fetchedProducts = await getProducts();
        setProducts(fetchedProducts);
      } catch (error) {
        console.error('Error loading products:', error);
        toast.error('Failed to load products');
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(products.map((product) => product.category.trim()).filter(Boolean))
    ).sort();
    return ['All', ...unique];
  }, [products]);

  const highlightedProduct = useMemo(
    () => products.find((product) => product.id === highlightProductId),
    [products, highlightProductId]
  );

  useEffect(() => {
    if (!highlightProductId || loading || !highlightedProduct) return;

    setActiveCategory('All');
    setHighlightedId(highlightProductId);

    if (hasScrolledRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(`product-${highlightProductId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hasScrolledRef.current = true;
    });

    const timeout = window.setTimeout(() => setHighlightedId(null), 5000);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [highlightProductId, highlightedProduct, loading]);

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'All') return products;
    return products.filter((product) => product.category === activeCategory);
  }, [products, activeCategory]);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-light-gray">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
          <nav
            aria-label="Breadcrumb"
            className="mb-3 flex items-center gap-1.5 text-xs text-body sm:mb-4 sm:gap-2 sm:text-sm"
          >
            <Link href="/" className="text-premium-blue transition-colors hover:text-cyan">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400 sm:h-4 sm:w-4" />
            <span className="font-medium text-navy">Shop</span>
          </nav>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
                Shop
              </h1>
              <p className="mt-1 text-sm text-body">
                {loading
                  ? 'Loading catalog...'
                  : `${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'} available`}
              </p>
            </div>

            {!loading && (
              <div className="w-full sm:max-w-sm md:max-w-md">
                <SearchBar products={products} />
              </div>
            )}
          </div>
        </div>
      </header>

      <section id="shop" className="py-6 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          {!loading && categories.length > 1 && (
            <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mb-8 [&::-webkit-scrollbar]:hidden">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeCategory === category
                      ? 'bg-navy text-white shadow-sm'
                      : 'bg-light-gray text-body hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          )}

          {!loading && highlightProductId && !highlightedProduct && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              The product from this QR code is no longer available. Browse the catalog below.
            </div>
          )}

          {loading ? (
            <ProductGridSkeleton />
          ) : filteredProducts.length === 0 ? (
            <div className="card-premium py-14 text-center sm:py-16">
              <p className="text-base text-body sm:text-lg">
                {activeCategory === 'All'
                  ? 'No products available yet. Check back soon.'
                  : `No products in "${activeCategory}".`}
              </p>
              {activeCategory !== 'All' && (
                <button
                  type="button"
                  onClick={() => setActiveCategory('All')}
                  className="mt-4 text-sm font-semibold text-premium-blue hover:text-cyan"
                >
                  View all products
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  highlighted={highlightedId === product.id}
                />
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-premium-blue" />
        </div>
      }
    >
      <ShopContent />
    </Suspense>
  );
}
