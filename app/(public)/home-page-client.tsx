'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import ProductCard from '@/components/product-card';
import HeroProductShowcase from '@/components/hero-product-showcase';
import ProductImage from '@/components/product-image';
import BrandButton from '@/components/brand-button';
import SearchBar from '@/components/search-bar';
import { BRAND_ASSETS } from '@/lib/brand';
import { formatUgx } from '@/lib/currency';
import { buildProductImageAlt } from '@/lib/seo/images';
import { fetchLiveCatalogProducts } from '@/lib/catalog-products';
import { prefetchProductImages } from '@/lib/product-image-cache';
import { HOME_FAQS } from '@/lib/seo/faqs';
import type { SeoProduct } from '@/lib/seo/json-ld';

const TRUST_ITEMS = ['Fast checkout', 'In stock items', 'WhatsApp support'];

interface HomePageClientProps {
  products: SeoProduct[];
}

export default function HomePageClient({ products: initialProducts }: HomePageClientProps) {
  const [products, setProducts] = useState(initialProducts);
  const [activeCategory, setActiveCategory] = useState('All');

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

  const featuredProduct = products.find(
    (product) => product.image?.trim() && product.stock > 0
  );

  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(products.map((product) => product.category.trim()).filter(Boolean))
    ).sort();
    return ['All', ...unique];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'All') return products;
    return products.filter((product) => product.category === activeCategory);
  }, [products, activeCategory]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <section className="relative overflow-hidden bg-light-gray">
        <div className="absolute inset-0">
          {featuredProduct ? (
            <img
              src={featuredProduct.image}
              alt=""
              className="h-full w-full object-cover opacity-10 blur-sm lg:opacity-15"
              aria-hidden
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white/98 to-light-gray lg:bg-gradient-to-r lg:from-white lg:via-white/95 lg:to-white/80" />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-16 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-24">
          <div className="text-center lg:text-left">
            <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-premium-blue/15 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-premium-blue shadow-sm backdrop-blur-sm sm:mb-6 sm:gap-3 sm:px-4 sm:py-2 sm:text-sm lg:mb-5">
              <img
                src={BRAND_ASSETS.logo}
                alt=""
                width={20}
                height={20}
                className="shrink-0 rounded-full sm:h-6 sm:w-6"
                aria-hidden
              />
              <span className="leading-snug">MS Coatings Shop</span>
            </div>

            <h1 className="mb-4 text-[1.75rem] font-extrabold leading-[1.12] tracking-tight text-navy sm:mb-5 sm:text-4xl sm:leading-tight lg:text-5xl">
              Professional coatings,{' '}
              <span className="bg-[linear-gradient(135deg,#0077C8,#19B5FE,#E53935)] bg-clip-text text-transparent">
                ready to order.
              </span>
            </h1>

            <p className="mx-auto mb-7 max-w-md text-[0.9375rem] leading-relaxed text-body sm:mb-8 sm:max-w-lg sm:text-lg lg:mx-0">
              Browse primers, clear coats, and industrial finishes. Add to cart and checkout in minutes.
            </p>

            <BrandButton
              href="#shop"
              variant="primary"
              size="lg"
              className="w-full shadow-lg sm:w-auto"
            >
              Shop Now
            </BrandButton>

            <div className="mt-7 grid grid-cols-3 gap-2 sm:mt-8 sm:flex sm:flex-wrap sm:justify-center sm:gap-5 lg:justify-start">
              {TRUST_ITEMS.map((item) => (
                <div
                  key={item}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-white/80 px-2 py-3 text-center shadow-sm ring-1 ring-gray-100/80 sm:flex-row sm:rounded-none sm:bg-transparent sm:px-0 sm:py-0 sm:text-left sm:shadow-none sm:ring-0"
                >
                  <CheckCircle2
                    size={14}
                    className="shrink-0 text-premium-blue sm:size-[15px]"
                  />
                  <span className="text-[11px] font-medium leading-tight text-body sm:text-sm">
                    {item}
                  </span>
                </div>
              ))}
            </div>

            {featuredProduct && (
              <Link
                href={`/product/${featuredProduct.id}`}
                className="group mt-8 block lg:hidden"
              >
                <div className="card-premium overflow-hidden p-3 text-left transition-shadow hover:shadow-[var(--shadow-premium-hover)]">
                  <div className="flex items-center gap-3.5">
                    <div className="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl ring-1 ring-gray-100">
                      <ProductImage
                        src={featuredProduct.image}
                        alt={buildProductImageAlt(featuredProduct)}
                        productId={featuredProduct.id}
                        variant="thumb"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-premium-blue">
                        Featured
                      </p>
                      <p className="truncate text-sm font-bold text-navy transition-colors group-hover:text-premium-blue">
                        {featuredProduct.name}
                      </p>
                      <p className="mt-0.5 text-base font-extrabold text-navy">
                        {formatUgx(featuredProduct.price)}
                      </p>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy/5 text-navy transition-colors group-hover:bg-premium-blue group-hover:text-white">
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              </Link>
            )}
          </div>

          <div className="hidden lg:block">
            <HeroProductShowcase products={products} />
          </div>
        </div>

        <div className="gradient-accent-bar mx-auto mb-1 w-12 lg:hidden" />
      </section>

      <section id="shop" className="border-t border-gray-100 bg-white py-8 sm:py-14">
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="mb-5 sm:mb-8">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-premium-blue sm:text-xs">
              Our Collection
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
                  All Products
                </h2>
                <p className="mt-1 text-sm text-body sm:text-base">
                  {`${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'} available`}
                </p>
              </div>
              <div className="hidden w-full sm:max-w-md md:block">
                <SearchBar products={products} />
              </div>
            </div>
          </div>

          <div className="sticky top-20 z-30 -mx-5 mb-5 space-y-3 border-b border-gray-100 bg-white/95 px-5 py-3 backdrop-blur-md sm:-mx-6 sm:mb-6 sm:px-6 md:hidden">
            <SearchBar products={products} />
            {categories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                      activeCategory === category
                        ? 'bg-navy text-white shadow-md'
                        : 'bg-white text-body ring-1 ring-gray-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
          </div>

          {categories.length > 1 && (
            <div className="mb-6 hidden gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:mb-8 md:flex [&::-webkit-scrollbar]:hidden">
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

          {filteredProducts.length === 0 ? (
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
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-gray-100 bg-light-gray py-10 sm:py-14">
        <div className="mx-auto max-w-3xl px-5 sm:px-6">
          <h2 className="mb-6 text-center text-2xl font-extrabold text-navy sm:text-3xl">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {HOME_FAQS.map((faq) => (
              <details
                key={faq.question}
                className="card-premium group p-4 sm:p-5"
              >
                <summary className="cursor-pointer list-none font-semibold text-navy marker:content-none [&::-webkit-details-marker]:hidden">
                  {faq.question}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-body sm:text-base">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
