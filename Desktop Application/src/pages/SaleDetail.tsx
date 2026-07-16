import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, RotateCcw } from 'lucide-react';
import Receipt from '@/components/pos/Receipt';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PageLoader } from '@/components/LoadingSpinner';
import { usePermissions } from '@/hooks/usePermissions';
import { getSaleById } from '@/lib/firestore';
import { refundSale, voidSale } from '@/lib/sales';
import { printSaleReceipt } from '@/lib/print-receipt';
import { formatUgx } from '@/lib/currency';
import type { Sale } from '@/lib/types';

export default function SaleDetailPage() {
  const { id: saleId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [sale, setSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmKind, setConfirmKind] = useState<'void' | 'refund' | null>(null);

  useEffect(() => {
    if (!saleId) return;
    void loadSale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  const loadSale = async () => {
    if (!saleId) return;
    setIsLoading(true);
    try {
      const data = await getSaleById(saleId);
      if (!data) throw new Error('Sale not found');
      setSale(data);
    } catch {
      toast.error('Failed to load sale');
      setSale(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!saleId) return;
    setIsUpdating(true);
    try {
      await refundSale(saleId);
      toast.success('Sale refunded');
      setConfirmKind(null);
      await loadSale();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refund');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleVoid = async () => {
    if (!saleId) return;
    setIsUpdating(true);
    try {
      await voidSale(saleId, sale ?? undefined);
      toast.success('Sale voided');
      setConfirmKind(null);
      navigate('/pos');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to void sale');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/pos"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft size={18} />
          Back to POS
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sale Details</h1>
        <p className="mt-1 text-slate-500">{sale?.receiptNumber ?? '—'}</p>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : sale ? (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => printSaleReceipt(sale)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Printer size={16} />
              Print Receipt
            </button>

            {sale.status === 'completed' && can('processRefunds') && (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmKind('refund')}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  <RotateCcw size={16} />
                  Refund
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmKind('void')}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Void Sale
                </button>
              </>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-slate-500">Status: </span>
                <span
                  className={`font-medium capitalize ${
                    sale.status === 'completed' ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {sale.status}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Total: </span>
                <span className="font-semibold">{formatUgx(sale.totalAmount)}</span>
              </div>
            </div>
            <Receipt sale={sale} />
          </div>
        </div>
      ) : (
        <p className="text-slate-600">Sale not found.</p>
      )}

      <ConfirmDialog
        open={confirmKind === 'void'}
        variant="danger"
        title="Void this sale?"
        description="This cancels the sale completely. Stock will be restored, the sale record removed, and you will return to POS."
        confirmLabel="Void sale"
        cancelLabel="Keep sale"
        loading={isUpdating}
        details={
          sale
            ? [
                { label: 'Receipt', value: sale.receiptNumber },
                { label: 'Amount', value: formatUgx(sale.totalAmount) },
              ]
            : undefined
        }
        onClose={() => {
          if (!isUpdating) setConfirmKind(null);
        }}
        onConfirm={() => void handleVoid()}
      />

      <ConfirmDialog
        open={confirmKind === 'refund'}
        variant="warning"
        title="Refund this sale?"
        description="Stock will be restored and the sale will be marked as refunded."
        confirmLabel="Refund sale"
        cancelLabel="Keep sale"
        loading={isUpdating}
        details={
          sale
            ? [
                { label: 'Receipt', value: sale.receiptNumber },
                { label: 'Amount', value: formatUgx(sale.totalAmount) },
              ]
            : undefined
        }
        onClose={() => {
          if (!isUpdating) setConfirmKind(null);
        }}
        onConfirm={() => void handleRefund()}
      />
    </div>
  );
}
