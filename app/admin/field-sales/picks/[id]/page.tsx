'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import Receipt from '@/components/admin/pos/receipt';
import SubmitReportModal from '@/components/admin/field-sales/submit-report-modal';
import { usePermissions } from '@/hooks/use-permissions';
import { getFieldPickByIdClient } from '@/lib/field-sales-client';
import { getSaleByIdClient } from '@/lib/sales-client';
import { printSaleReceipt } from '@/lib/print-receipt';
import { formatUgx } from '@/lib/currency';
import type { FieldPick, Sale } from '@/lib/erp-types';
import {
  ArrowLeft,
  ClipboardCheck,
  ExternalLink,
  Printer,
} from 'lucide-react';

export default function FieldPickDetailPage() {
  const params = useParams();
  const pickId = params.id as string;
  const { can } = usePermissions();
  const [pick, setPick] = useState<FieldPick | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    void loadPick();
  }, [pickId]);

  const loadPick = async () => {
    try {
      const pickData = await getFieldPickByIdClient(pickId);
      if (!pickData) throw new Error('Pick not found');
      setPick(pickData);

      if (pickData.report?.saleId) {
        const saleData = await getSaleByIdClient(pickData.report.saleId);
        setSale(saleData);
      }
    } catch {
      toast.error('Failed to load pick');
    } finally {
      setIsLoading(false);
    }
  };

  if (!can('manageFieldSales')) {
    return (
      <AdminGuard>
        <AdminLayout activeSection="fieldSales" title="Pick Details">
          <p className="text-slate-600">You do not have permission.</p>
        </AdminLayout>
      </AdminGuard>
    );
  }

  const pickedValue =
    pick?.items.reduce(
      (sum, item) => sum + item.quantityPicked * item.unitPrice,
      0
    ) ?? 0;

  return (
    <AdminGuard>
      <AdminLayout
        activeSection="fieldSales"
        title="Pick Details"
        subtitle={pick?.agentName}
        actions={
          pick?.status === 'active' ? (
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <ClipboardCheck size={16} />
              Submit report
            </button>
          ) : undefined
        }
      >
        <Link
          href="/admin/field-sales"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-violet-600"
        >
          <ArrowLeft size={18} />
          Back to Field Sales
        </Link>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600" />
          </div>
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
                  {pick.report
                    ? formatUgx(pick.report.totalRevenue)
                    : '—'}
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
                <h3 className="mb-4 font-semibold text-slate-900">
                  Report summary
                </h3>
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

            {sale && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-900">
                    Generated sale receipt
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => printSaleReceipt(sale)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Printer size={16} />
                      Print
                    </button>
                    <Link
                      href={`/admin/sales/${sale.id}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <ExternalLink size={16} />
                      View sale
                    </Link>
                  </div>
                </div>
                <Receipt sale={sale} />
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
          onSuccess={() => {
            setReportOpen(false);
            void loadPick();
          }}
        />
      </AdminLayout>
    </AdminGuard>
  );
}
