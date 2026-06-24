'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import ProductCard from '@/components/product-card';
import Footer from '@/components/footer';
import SearchBar from '@/components/search-bar';
import type { SeoProduct } from '@/lib/seo/json-ld';

interface ProductsPageClientProps {
  products: SeoProduct[];
}

export default function ProductsPageClient({ products }: ProductsPageClientProps) {
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
            <span className="font-medium text-navy">Products</span>
          </nav>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
                Products
              </h1>
              <p className="mt-1 text-sm text-body">
                {`${products.length} coating${products.length === 1 ? '' : 's'} in stock`}
              </p>
            </div>

            {products.length > 0 && (
              <div className="w-full sm:max-w-sm md:max-w-md">
                <SearchBar products={products} />
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="py-6 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          {products.length === 0 ? (
            <div className="card-premium py-14 text-center sm:py-20">
              <p className="text-base text-body sm:text-lg">
                No products available yet. Check back soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
