import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Search, Package, Pencil } from 'lucide-react';
import { getProducts } from '@/lib/firestore';
import { formatUgx } from '@/lib/currency';
import type { Product } from '@/lib/types';
import { PageLoader, EmptyState } from '@/components/LoadingSpinner';
import ProductThumb from '@/components/ProductThumb';
import { cn } from '@/lib/utils';

function stockStatus(product: Product): 'ok' | 'low' | 'out' {
  if (product.stock <= 0) return 'out';
  if (product.stock <= (product.reorderLevel ?? 5)) return 'low';
  return 'ok';
}

const statusStyles = {
  ok: 'bg-emerald-50 text-emerald-700',
  low: 'bg-amber-50 text-amber-700',
  out: 'bg-red-50 text-red-700',
};

export default function ProductsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (location.pathname !== '/products') return;
    setLoading(true);
    void getProducts()
      .then(setProducts)
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  }, [location.pathname]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
    );
  }, [products, search]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Products</h1>
          <p className="mt-1 text-slate-500">{products.length} products in catalog</p>
        </div>
        <Link
          to="/products/new"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus size={18} />
          Add Product
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Package} title="No products found" description="Try a different search term" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-5 py-3 font-semibold text-slate-600">Product</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Category</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Barcode</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Price</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Stock</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((product) => {
                const status = stockStatus(product);
                return (
                  <tr
                    key={product.id}
                    className="cursor-pointer transition hover:bg-slate-50/80"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                          <ProductThumb
                            productId={product.id}
                            src={product.image}
                            alt={product.name}
                            className="h-full w-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{product.name}</p>
                          {product.brand && (
                            <p className="text-xs text-slate-500">{product.brand}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{product.category}</td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">
                      {product.barcode ?? '—'}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {formatUgx(product.price)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-semibold',
                          statusStyles[status]
                        )}
                      >
                        {product.stock}{' '}
                        {status === 'low' ? '(Low)' : status === 'out' ? '(Out)' : ''}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        to={`/products/${product.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil size={14} />
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
