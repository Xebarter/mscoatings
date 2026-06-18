'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getProducts, Product } from '@/lib/firestore';
import { useCart } from '@/lib/cart-context';
import toast from 'react-hot-toast';
import ProductCard from '@/components/product-card';
import Header from '@/components/header';
import Footer from '@/components/footer';
import SearchBar from '@/components/search-bar';
import SectionHeading from '@/components/section-heading';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { cart } = useCart();

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

  return (
    <div className="min-h-screen bg-white">
      <Header cartCount={cart.length} />

      <div className="bg-light-gray border-b border-gray-100">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-4 text-sm sm:px-6">
          <Link href="/" className="text-premium-blue transition-colors hover:text-cyan">
            Home
          </Link>
          <ChevronRight className="h-4 w-4 text-gray-400" />
          <span className="text-body">Products</span>
        </div>
      </div>

      <section className="section-padding bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Product Catalog"
            title="Professional Coating Systems"
            description="Browse our complete range of automotive and industrial coatings, primers, clear coats, and finishing solutions."
            align="left"
            className="mb-10"
          />

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-premium-blue" />
            </div>
          ) : (
            <>
              <div className="mb-12 max-w-xl">
                <SearchBar products={products} />
              </div>

              {products.length === 0 ? (
                <div className="card-premium py-20 text-center">
                  <p className="text-lg text-body">No products available yet. Check back soon.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
