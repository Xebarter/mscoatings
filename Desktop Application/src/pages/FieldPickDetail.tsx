import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ClipboardCheck, Printer } from 'lucide-react';
import SubmitReportModal from '@/components/field-sales/SubmitReportModal';
import { PageLoader } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { getFieldPickByIdClient } from '@/lib/field-sales';
import { getSaleById } from '@/lib/firestore';
import { printSaleReceipt } from '@/lib/print-receipt';
import { formatUgx } from '@/lib/currency';
import type { FieldPick, Sale } from '@/lib/types';

export default function FieldPickDetailPage() {
  const { id: pickId } = useParams<{ id: string }>();
  const { permissions } = useAuth();
  const canManage = Boolean(permissions?.manageFieldSales);
  const [pick, setPick] = useState<FieldPick | null>(null);
  const [linkedSale, setLinkedSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!pickId) return;
    void loadPick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickId]);

  const loadPick = async () => {
    if (!pickId) return;
    setIsLoading(true);
    try {
      const pickData = await getFieldPickByIdClient(pickId);
      if (!pickData) throw new Error('Pick not found');
      setPick(pickData);

      const saleId = pickData.report?.saleId;
      if (saleId) {
        try {
          const sale = await getSaleById(saleId);
          setLinkedSale(sale);
        } catch {
          setLinkedSale(null);
        }
      } else {
        setLinkedSale(null);
      }
    } catch {
      toast.error('Failed to load pick');
      setPick(null);
      setLinkedSale(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">You do not have permission.</p>
      </div>
    );
  }

  const pickedValue =
    pick?.items.reduce(
      (sum, item) => sum + item.quantityPicked * item.unitPrice,
      0
    ) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to="/field-sales"
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-violet-600"
          >
            <ArrowLeft size={18} />
            Back to Field Sales
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Pick details
          </h1>
          <p className="mt-1 text-slate-500">{pick?.agentName ?? '—'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {linkedSale && (
            <button
              type="button"
              onClick={() => printSaleReceipt(linkedSale)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Printer size={16} />
              Print receipt
            </button>
          )}
          {pick?.status === 'active' && (
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <ClipboardCheck size={16} />
              Submit report
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : pick ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Status</p>
              <p
                className={`mt-1 text-lg font-bold capitalize ${
                  pick.status === 'active' ? 'text-violet-600' : 'text-emerald-600'
                }`}
              >
                {pick.status}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Products picked</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {pick.items.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Pick value</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {formatUgx(pickedValue)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Revenue</p>
              <p className="mt-1 text-lg font-bold text-emerald-700">
                {pick.report ? formatUgx(pick.report.totalRevenue) : '—'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Picked items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 text-center font-semibold">Picked</th>
                    {pick.report && (
                      <>
                        <th className="px-4 py-3 text-center font-semibold">Sold</th>
                        <th className="px-4 py-3 text-center font-semibold">
                          Returned
                        </th>
                      </>
                    )}
                    <th className="px-5 py-3 text-right font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pick.items.map((item) => {
                    const reportItem = pick.report?.items.find(
                      (r) => r.productId === item.productId
                    );
                    return (
                      <tr key={item.productId}>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-slate-900">
                            {item.productName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.barcode || 'No barcode'}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold">
                          {item.quantityPicked}
                        </td>
                        {pick.report && (
                          <>
                            <td className="px-4 py-3.5 text-center">
                              {reportItem?.quantitySold ?? 0}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              {reportItem?.quantityReturned ?? 0}
                            </td>
                          </>
                        )}
                        <td className="px-5 py-3.5 text-right font-medium">
                          {formatUgx(item.quantityPicked * item.unitPrice)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {pick.report && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-900">Report summary</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Sold</p>
                  <p className="font-bold">{pick.report.totalSold}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Returned</p>
                  <p className="font-bold">{pick.report.totalReturned}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Pick value</p>
                  <p className="font-bold">
                    {formatUgx(
                      pick.report.pickValue ??
                        pick.items.reduce(
                          (sum, item) =>
                            sum + item.quantityPicked * item.unitPrice,
                          0
                        )
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Deposit at report</p>
                  <p className="font-bold">
                    {formatUgx(pick.report.depositAtReport ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Wallet applied</p>
                  <p className="font-bold">
                    {formatUgx(
                      pick.report.walletApplied ??
                        pick.report.pickValue ??
                        pickedValue
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Wallet after</p>
                  <p className="font-bold">
                    {formatUgx(pick.report.walletBalanceAfter ?? 0)}
                  </p>
                </div>
              </div>
              {pick.report.notes && (
                <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {pick.report.notes}
                </p>
              )}
            </div>
          )}

          {linkedSale && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-900">Linked sale</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Receipt</p>
                  <p className="font-bold">{linkedSale.receiptNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="font-bold">{formatUgx(linkedSale.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="font-bold capitalize">{linkedSale.status}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Items</p>
                  <p className="font-bold">{linkedSale.items.length}</p>
                </div>
              </div>
              <Link
                to={`/sales/${linkedSale.id}`}
                className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View sale details →
              </Link>
            </div>
          )}
        </div>
      ) : (
        <p className="text-slate-600">Pick not found.</p>
      )}

      <SubmitReportModal
        pick={pick}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSuccess={async () => {
          setReportOpen(false);
          await loadPick();
        }}
      />
    </div>
  );
}
