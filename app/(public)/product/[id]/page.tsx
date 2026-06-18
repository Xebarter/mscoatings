'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { Product, getProducts } from '@/lib/firestore';
import { useCart } from '@/lib/cart-context';
import { getCategoryColor } from '@/lib/brand';
import toast from 'react-hot-toast';
import Header from '@/components/header';
import Footer from '@/components/footer';
import BrandButton from '@/components/brand-button';

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const { addToCart, cart } = useCart();

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const products = await getProducts();
        const found = products.find((p) => p.id === productId);
        if (found) setProduct(found);
        else toast.error('Product not found');
      } catch (error) {
        console.error('Error loading product:', error);
        toast.error('Failed to load product');
      } finally {
        setLoading(false);
      }
    };
    if (productId) loadProduct();
  }, [productId]);

  const handleAddToCart = async () => {
    if (!product) return;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header cartCount={cart.length} />
        <div className="flex justify-center py-32">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-premium-blue" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white">
        <Header cartCount={cart.length} />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
          <p className="mb-6 text-lg text-body">Product not found</p>
          <BrandButton href="/products" variant="primary">Back to Products</BrandButton>
        </div>
        <Footer />
      </div>
    );
  }

  const categoryColor = getCategoryColor(product.category);

  return (
    <div className="min-h-screen bg-white">
      <Header cartCount={cart.length} />

      <div className="bg-light-gray border-b border-gray-100">
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
          <div className="card-premium overflow-hidden p-3">
            <img
              src={product.image}
              alt={product.name}
              className="h-[420px] w-full rounded-xl object-cover lg:h-[500px]"
            />
          </div>

          <div>
            <span
              className="mb-4 inline-block rounded-full px-4 py-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: categoryColor }}
            >
              {product.category}
            </span>
            <h1 className="mb-4 text-3xl font-extrabold text-navy sm:text-4xl">{product.name}</h1>
            <p className="mb-8 text-lg leading-relaxed text-body">{product.description}</p>

            <div className="mb-8 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-light-gray p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">Availability</p>
                <p className={`mt-1 font-bold ${product.stock > 0 ? 'text-premium-blue' : 'text-performance-red'}`}>
                  {product.stock > 0 ? `${product.stock} units in stock` : 'Out of Stock'}
                </p>
              </div>
              <div className="rounded-xl bg-light-gray p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">Category</p>
                <p className="mt-1 font-bold text-navy">{product.category}</p>
              </div>
            </div>

            <div className="mb-8 border-y border-gray-100 py-8">
              <p className="text-sm uppercase tracking-wider text-gray-400">Price</p>
              <p className="text-5xl font-extrabold text-navy">${product.price}</p>
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
                <span className="min-w-[48px] px-4 py-3 text-center font-bold text-navy">{quantity}</span>
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
                className="flex-1 min-w-[200px]"
              >
                <ShoppingCart size={18} className="mr-2 inline" />
                {isAdding ? 'Adding...' : 'Add to Cart'}
              </BrandButton>
            </div>

            <div className="space-y-3 text-sm text-body">
              {['Professional-grade formulation', 'Technical support available', 'Fast nationwide delivery'].map((item) => (
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
