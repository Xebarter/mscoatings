'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ProductCard from '@/components/product-card';
import SearchBar from '@/components/search-bar';
import Breadcrumbs from '@/components/breadcrumbs';
import { fetchLiveCatalogProducts } from '@/lib/catalog-products';
import { prefetchProductImages } from '@/lib/product-image-cache';
import type { SeoProduct } from '@/lib/seo/json-ld';

interface ProductsPageClientProps {
  products: SeoProduct[];
}

function ProductsPageContent({ products: initialProducts }: ProductsPageClientProps) {
  const searchParams = useSearchParams();
  const highlightProductId = searchParams.get('product');
  const initialQuery = searchParams.get('q') ?? '';
  const hasScrolledRef = useRef(false);

  const [products, setProducts] = useState(initialProducts);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void prefetchProductImages(initialProducts);

    fetchLiveCatalogProducts()
      .then((liveProducts) => {
        if (!cancelled) {
          setProducts(liveProducts);
          void prefetchProductImages(liveProducts);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [initialProducts]);

  useEffect(() => {
    setSearchQuery(initialQuery);
  }, [initialQuery]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return products;

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const highlightedProduct = useMemo(
    () => products.find((product) => product.id === highlightProductId),
    [products, highlightProductId]
  );

  useEffect(() => {
    if (!highlightProductId || !highlightedProduct) return;

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
  }, [highlightProductId, highlightedProduct]);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-light-gray">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
          <Breadcrumbs
            items={[
              { name: 'Home', path: '/' },
              { name: 'Products', path: '/products' },
            ]}
            className="mb-3 sm:mb-4"
          />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
                {searchQuery.trim()
                  ? `Search results for "${searchQuery.trim()}"`
                  : 'Automotive & Industrial Coatings'}
              </h1>
              <p className="mt-1 text-sm text-body">
                {`${filteredProducts.length} coating${filteredProducts.length === 1 ? '' : 's'} available`}
              </p>
            </div>

            {products.length > 0 && (
              <div className="w-full sm:max-w-sm md:max-w-md">
                <SearchBar
                  products={products}
                  initialQuery={searchQuery}
                  onQueryChange={setSearchQuery}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="py-6 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          {highlightProductId && !highlightedProduct && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              The product from this QR code is no longer available. Browse the
              catalog below.
            </div>
          )}

          {filteredProducts.length === 0 ? (
            <div className="card-premium py-14 text-center sm:py-20">
              <p className="text-base text-body sm:text-lg">
                {searchQuery.trim()
                  ? `No products matched "${searchQuery.trim()}".`
                  : 'No products available yet. Check back soon.'}
              </p>
              {searchQuery.trim() && (
                <Link
                  href="/products"
                  className="mt-4 inline-block text-sm font-semibold text-premium-blue hover:text-cyan"
                >
                  View all products
                </Link>
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

export default function ProductsPageClient(props: ProductsPageClientProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-premium-blue" />
        </div>
      }
    >
      <ProductsPageContent {...props} />
    </Suspense>
  );
}
