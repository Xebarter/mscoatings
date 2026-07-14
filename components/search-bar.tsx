'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import Link from 'next/link';
import type { SeoProduct } from '@/lib/seo/json-ld';
import ProductImage from '@/components/product-image';
import { formatUgx } from '@/lib/currency';
import { buildProductImageAlt } from '@/lib/seo/images';

interface SearchBarProps {
  products: SeoProduct[];
  initialQuery?: string;
  onQueryChange?: (query: string) => void;
}

export default function SearchBar({
  products,
  initialQuery = '',
  onQueryChange,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const updateQuery = (value: string) => {
    setQuery(value);
    onQueryChange?.(value);
  };

  const filteredProducts = useCallback(() => {
    if (!query.trim()) return [];
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.description.toLowerCase().includes(query.toLowerCase()) ||
        product.category.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, products]);

  const results = filteredProducts();
  const showResults = isOpen && query.trim().length > 0;

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          type="search"
          name="q"
          placeholder="Search coatings, primers, clear coats..."
          value={query}
          onChange={(e) => {
            updateQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          aria-label="Search products"
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 pl-11 pr-11 text-navy shadow-sm transition-shadow focus:border-premium-blue focus:outline-none focus:ring-2 focus:ring-premium-blue/20"
        />
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        {query && (
          <button
            type="button"
            onClick={() => {
              updateQuery('');
              setIsOpen(false);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-navy"
            aria-label="Clear search"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {showResults && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 max-h-96 overflow-y-auto rounded-2xl bg-white shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
          {results.length === 0 ? (
            <div className="p-6 text-center text-body">
              No products found for &quot;{query}&quot;
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {results.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  onClick={() => {
                    updateQuery('');
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-light-gray"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-gray-100">
                    <ProductImage
                      src={product.image}
                      alt={buildProductImageAlt(product)}
                      productId={product.id}
                      variant="inline"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-navy">{product.name}</p>
                    <p className="truncate text-sm text-body">{product.category}</p>
                  </div>
                  <p className="whitespace-nowrap font-bold text-navy">
                    {formatUgx(product.price)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {isOpen && !showResults && query.trim() === '' && (
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40"
          aria-label="Close search"
        />
      )}
    </div>
  );
}
