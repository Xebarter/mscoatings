'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import ConfirmDialog from '@/components/admin/confirm-dialog';
import Receipt from '@/components/admin/pos/receipt';
import { usePermissions } from '@/hooks/use-permissions';
import {
  getSaleByIdClient,
  refundOrCancelSaleClient,
  voidSaleClient,
} from '@/lib/sales-client';
import { formatUgx } from '@/lib/currency';
import { printSaleReceipt } from '@/lib/print-receipt';
import type { Sale } from '@/lib/erp-types';
import { ArrowLeft, Printer, RotateCcw } from 'lucide-react';

export default function SaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const saleId = params.id as string;
  const { can } = usePermissions();
  const [sale, setSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmKind, setConfirmKind] = useState<'void' | 'refund' | null>(null);

  useEffect(() => {
    void loadSale();
  }, [saleId]);

  const loadSale = async () => {
    try {
      const sale = await getSaleByIdClient(saleId);
      if (!sale) throw new Error('Sale not found');
      setSale(sale);
    } catch {
      toast.error('Failed to load sale');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefund = async () => {
    setIsUpdating(true);
    try {
      await refundOrCancelSaleClient(saleId, 'refunded');
      toast.success('Sale refunded');
      setConfirmKind(null);
      void loadSale();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update sale');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = async () => {
    setIsUpdating(true);
    try {
      await voidSaleClient(saleId, sale ?? undefined);
      toast.success('Sale cancelled');
      setConfirmKind(null);
      router.push('/admin/pos');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel sale');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AdminGuard>
      <AdminLayout
        activeSection="pos"
        title="Sale Details"
        subtitle={sale?.receiptNumber}
      >
        <Link
          href="/admin/pos"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft size={18} />
          Back to POS
        </Link>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          </div>
        ) : sale ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => sale && printSaleReceipt(sale)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
                    className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                  >
                    <RotateCcw size={16} />
                    Refund
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmKind('void')}
                    disabled={isUpdating}
                    className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Cancel Sale
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
                      sale.status === 'completed'
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    }`}
                  >
                    {sale.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Total: </span>
                  <span className="font-semibold">
                    {formatUgx(sale.totalAmount)}
                  </span>
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
          onConfirm={() => void handleCancel()}
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
      </AdminLayout>
    </AdminGuard>
  );
}
