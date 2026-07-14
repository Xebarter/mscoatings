import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Phone, Truck } from 'lucide-react';
import { PageLoader } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import {
  getFieldAgentByIdClient,
  listFieldPicksClient,
} from '@/lib/field-sales';
import { formatUgx } from '@/lib/currency';
import type { FieldAgent, FieldPick } from '@/lib/types';

export default function FieldAgentDetailPage() {
  const { id: agentId } = useParams<{ id: string }>();
  const { permissions } = useAuth();
  const canManage = Boolean(permissions?.manageFieldSales);
  const [agent, setAgent] = useState<FieldAgent | null>(null);
  const [picks, setPicks] = useState<FieldPick[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!agentId) return;
    void loadData();
  }, [agentId]);

  const loadData = async () => {
    if (!agentId) return;
    setIsLoading(true);
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
      setAgent(null);
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

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/field-sales"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-violet-600"
        >
          <ArrowLeft size={18} />
          Back to Field Sales
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {agent?.name ?? 'Field agent'}
        </h1>
        <p className="mt-1 text-slate-500">{agent?.phone ?? '—'}</p>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : agent ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Total picks', value: String(agent.totalPicks) },
              { label: 'Total revenue', value: formatUgx(agent.totalRevenue) },
              {
                label: 'Units missing',
                value: String(agent.totalUnitsMissing ?? 0),
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
                <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-semibold text-slate-900">Contact details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Phone size={16} />
                {agent.phone}
              </div>
              {agent.email && <p className="text-slate-600">{agent.email}</p>}
              {agent.notes && <p className="text-slate-500">{agent.notes}</p>}
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
                    to={`/field-sales/picks/${pick.id}`}
                    className="flex items-center justify-between px-5 py-4 transition hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
                        <Truck size={16} className="text-violet-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {(pick.items ?? []).length} products
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
                              (pick.items ?? []).reduce(
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
    </div>
  );
}
