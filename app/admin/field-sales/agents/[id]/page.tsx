'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import { usePermissions } from '@/hooks/use-permissions';
import {
  getFieldAgentByIdClient,
  listFieldPicksClient,
} from '@/lib/field-sales-client';
import { formatUgx } from '@/lib/currency';
import type { FieldAgent, FieldPick } from '@/lib/erp-types';
import { ArrowLeft, Phone, Truck } from 'lucide-react';

export default function FieldAgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;
  const { can } = usePermissions();
  const [agent, setAgent] = useState<FieldAgent | null>(null);
  const [picks, setPicks] = useState<FieldPick[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadData();
  }, [agentId]);

  const loadData = async () => {
    try {
      const [agentData, picksData] = await Promise.all([
        getFieldAgentByIdClient(agentId),
        listFieldPicksClient({ agentId, limit: 50 }),
      ]);
      if (!agentData) throw new Error('Agent not found');
      setAgent(agentData);
      setPicks(picksData);
    } catch {
      toast.error('Failed to load agent');
    } finally {
      setIsLoading(false);
    }
  };

  if (!can('manageFieldSales')) {
    return (
      <AdminGuard>
        <AdminLayout activeSection="fieldSales" title="Field Agent">
          <p className="text-slate-600">You do not have permission.</p>
        </AdminLayout>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <AdminLayout
        activeSection="fieldSales"
        title={agent?.name ?? 'Field Agent'}
        subtitle={agent?.phone}
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
        ) : agent ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Total picks', value: String(agent.totalPicks) },
                { label: 'Total revenue', value: formatUgx(agent.totalRevenue) },
                {
                  label: 'Units missing',
                  value: String(agent.totalUnitsMissing),
                },
                {
                  label: 'Status',
                  value: agent.active ? 'Active' : 'Inactive',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-xs font-medium text-slate-500">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-900">
                Contact details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone size={16} />
                  {agent.phone}
                </div>
                {agent.email && (
                  <p className="text-slate-600">{agent.email}</p>
                )}
                {agent.notes && (
                  <p className="text-slate-500">{agent.notes}</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="font-semibold text-slate-900">Pick history</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {picks.length === 0 ? (
                  <p className="px-5 py-12 text-center text-sm text-slate-400">
                    No picks yet
                  </p>
                ) : (
                  picks.map((pick) => (
                    <Link
                      key={pick.id}
                      href={`/admin/field-sales/picks/${pick.id}`}
                      className="flex items-center justify-between px-5 py-4 transition hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
                          <Truck size={16} className="text-violet-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {pick.items.length} products
                          </p>
                          <p className="text-xs text-slate-500">
                            {pick.status === 'active' ? 'Active' : 'Closed'} ·{' '}
                            {(
                              pick.pickedAt &&
                              typeof pick.pickedAt === 'object' &&
                              'toDate' in pick.pickedAt
                                ? pick.pickedAt.toDate()
                                : new Date()
                            ).toLocaleString('en-UG', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {pick.status === 'closed'
                            ? formatUgx(pick.report?.totalRevenue ?? 0)
                            : formatUgx(
                                pick.items.reduce(
                                  (s, i) => s + i.quantityPicked * i.unitPrice,
                                  0
                                )
                              )}
                        </p>
                        <p className="text-xs text-violet-600">View details</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-600">Agent not found.</p>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
