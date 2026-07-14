'use client';

import { useEffect, useState } from 'react';
import ProductCard from '@/components/product-card';
import Breadcrumbs from '@/components/breadcrumbs';
import { fetchLiveCatalogProducts } from '@/lib/catalog-products';
import { prefetchProductImages } from '@/lib/product-image-cache';
import {
  getMarketingCategoryLabel,
  productMatchesMarketingCategory,
  slugToCategory,
} from '@/lib/seo/categories';
import type { SeoProduct } from '@/lib/seo/json-ld';

interface CategoryPageClientProps {
  products: SeoProduct[];
  title: string;
  slug: string;
}

export default function CategoryPageClient({
  products: initialProducts,
  title,
  slug,
}: CategoryPageClientProps) {
  const [products, setProducts] = useState(initialProducts);

  useEffect(() => {
    let cancelled = false;

    void prefetchProductImages(initialProducts);

    fetchLiveCatalogProducts()
      .then((liveProducts) => {
        if (cancelled) return;

        void prefetchProductImages(liveProducts);

        const dbCategory = slugToCategory(
          slug,
          Array.from(new Set(liveProducts.map((product) => product.category)))
        );

        if (dbCategory) {
          setProducts(
            liveProducts.filter((product) => product.category === dbCategory)
          );
          return;
        }

        if (getMarketingCategoryLabel(slug)) {
          setProducts(
            liveProducts.filter((product) =>
              productMatchesMarketingCategory(product, slug)
            )
          );
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [initialProducts, slug]);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-light-gray">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
          <Breadcrumbs
            items={[
              { name: 'Home', path: '/' },
              { name: 'Products', path: '/products' },
              { name: title, path: `/products/category/${slug}` },
            ]}
            className="mb-3 sm:mb-4"
          />

          <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-body sm:text-base">
            Shop professional {title.toLowerCase()} from MS Coatings in Uganda.
            Fast online ordering, reliable stock, and nationwide delivery for
            body shops and industrial finishers.
          </p>
          <p className="mt-2 text-sm text-body">
            {`${products.length} product${products.length === 1 ? '' : 's'} in this category`}
          </p>
        </div>
      </header>

      <section className="py-6 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          {products.length === 0 ? (
            <div className="card-premium py-14 text-center sm:py-20">
              <p className="text-base text-body sm:text-lg">
                No products in this category right now.
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

    </div>
  );
}
