'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { getProducts, Product } from '@/lib/firestore';
import toast from 'react-hot-toast';
import ProductCard from '@/components/product-card';
import HeroProductShowcase from '@/components/hero-product-showcase';
import Footer from '@/components/footer';
import BrandButton from '@/components/brand-button';
import SearchBar from '@/components/search-bar';
import { BRAND_ASSETS } from '@/lib/brand';

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');

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
      {/* Hero */}
      <section className="relative overflow-hidden bg-light-gray">
        <div className="absolute inset-0">
          {featuredProduct ? (
            <img
              src={featuredProduct.image}
              alt=""
              className="h-full w-full object-cover opacity-15 blur-sm"
              aria-hidden
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/80" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:gap-10 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-12 lg:py-24">
          <div>
            <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-premium-blue/20 bg-white px-3 py-1.5 text-xs font-medium text-premium-blue shadow-sm sm:mb-5 sm:gap-3 sm:px-4 sm:py-2 sm:text-sm">
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
            <h1 className="mb-4 text-3xl font-extrabold leading-[1.15] text-navy sm:mb-5 sm:text-4xl sm:leading-tight lg:text-5xl">
              Professional coatings,{' '}
              <span className="bg-[linear-gradient(135deg,#0077C8,#19B5FE,#E53935)] bg-clip-text text-transparent">
                ready to order.
              </span>
            </h1>
            <p className="mb-6 max-w-lg text-base text-body sm:text-lg">
              Browse primers, clear coats, and industrial finishes. Add to cart and checkout in minutes.
            </p>
            <BrandButton href="#shop" variant="primary" size="lg" className="w-full sm:w-auto">
              Shop Now
            </BrandButton>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-body sm:mt-8 sm:gap-5">
              {['Fast checkout', 'In stock items', 'WhatsApp support'].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0 text-premium-blue" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div>
            <HeroProductShowcase products={products} loading={loading} />
          </div>
        </div>
      </section>

      {/* Shop */}
      <section id="shop" className="border-t border-gray-100 bg-white py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">All Products</h2>
              <p className="mt-1 text-sm text-body sm:text-base">
                {loading
                  ? 'Loading catalog...'
                  : `${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'} available`}
              </p>
            </div>
            <div className="w-full sm:max-w-md">
              <SearchBar products={products} />
            </div>
          </div>

          {!loading && categories.length > 1 && (
            <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mb-8 [&::-webkit-scrollbar]:hidden">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeCategory === category
                      ? 'bg-navy text-white'
                      : 'bg-light-gray text-body hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-premium-blue sm:h-12 sm:w-12" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="card-premium py-16 text-center">
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
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
