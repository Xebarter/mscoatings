'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { getCategoryColor } from '@/lib/brand';
import toast from 'react-hot-toast';
import Footer from '@/components/footer';
import BrandButton from '@/components/brand-button';
import ProductImage from '@/components/product-image';
import { formatUgx } from '@/lib/currency';
import { buildProductImageAlt } from '@/lib/seo/images';
import type { SeoProduct } from '@/lib/seo/json-ld';

interface ProductDetailClientProps {
  product: SeoProduct;
}

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const { addToCart } = useCart();
  const categoryColor = getCategoryColor(product.category);
  const imageAlt = buildProductImageAlt(product);

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      addToCart({
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity,
        image: product.image,
      });
      toast.success(`${quantity} item(s) added to cart`);
      setQuantity(1);
    } catch {
      toast.error('Failed to add to cart');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-100 bg-light-gray">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm font-medium text-premium-blue transition-colors hover:text-cyan"
          >
            <ArrowLeft size={18} />
            Back to Products
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="card-premium overflow-hidden p-3 sm:p-4">
            <ProductImage
              src={product.image}
              alt={imageAlt}
              variant="detail"
              priority
            />
          </div>

          <div>
            <span
              className="mb-4 inline-block rounded-full px-4 py-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: categoryColor }}
            >
              {product.category}
            </span>
            <h1 className="mb-4 text-3xl font-extrabold text-navy sm:text-4xl">
              {product.name}
            </h1>
            <p className="mb-8 text-lg leading-relaxed text-body">
              {product.description}
            </p>

            <div className="mb-8 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-light-gray p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">
                  Availability
                </p>
                <p
                  className={`mt-1 font-bold ${product.stock > 0 ? 'text-premium-blue' : 'text-performance-red'}`}
                >
                  {product.stock > 0
                    ? `${product.stock} units in stock`
                    : 'Out of Stock'}
                </p>
              </div>
              <div className="rounded-xl bg-light-gray p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">
                  Category
                </p>
                <p className="mt-1 font-bold text-navy">{product.category}</p>
              </div>
            </div>

            <div className="mb-8 border-y border-gray-100 py-8">
              <p className="text-sm uppercase tracking-wider text-gray-400">
                Price
              </p>
              <p className="text-5xl font-extrabold text-navy">
                {formatUgx(product.price)}
              </p>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-4">
              <div className="flex items-center rounded-xl border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1 || product.stock <= 0}
                  className="px-4 py-3 text-navy transition-colors hover:bg-light-gray disabled:opacity-50"
                >
                  −
                </button>
                <span className="min-w-[48px] px-4 py-3 text-center font-bold text-navy">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={quantity >= product.stock || product.stock <= 0}
                  className="px-4 py-3 text-navy transition-colors hover:bg-light-gray disabled:opacity-50"
                >
                  +
                </button>
              </div>
              <BrandButton
                onClick={handleAddToCart}
                disabled={isAdding || product.stock <= 0}
                variant="primary"
                size="lg"
                className="min-w-[200px] flex-1"
              >
                <ShoppingCart size={18} className="mr-2 inline" />
                {isAdding ? 'Adding...' : 'Add to Cart'}
              </BrandButton>
            </div>

            <div className="space-y-3 text-sm text-body">
              {[
                'Professional-grade formulation',
                'Technical support available',
                'Fast nationwide delivery',
              ].map((item) => (
                <p key={item} className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-premium-blue" />
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
