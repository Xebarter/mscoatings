'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import NewPickModal from '@/components/admin/field-sales/new-pick-modal';
import SubmitReportModal from '@/components/admin/field-sales/submit-report-modal';
import { usePermissions } from '@/hooks/use-permissions';
import {
  createFieldAgentClient,
  getFieldPickByIdClient,
  listFieldAgentsClient,
  listFieldPicksClient,
  updateFieldAgentClient,
} from '@/lib/field-sales-client';
import { formatUgx } from '@/lib/currency';
import type { FieldAgent, FieldPick } from '@/lib/erp-types';
import {
  ClipboardCheck,
  ExternalLink,
  History,
  Package,
  Plus,
  RefreshCw,
  Truck,
  Users,
} from 'lucide-react';

type Tab = 'active' | 'history' | 'agents';

function getPickDate(pick: FieldPick): Date {
  const ts = pick.pickedAt;
  if (ts && typeof ts === 'object' && 'toDate' in ts) {
    return ts.toDate();
  }
  if (ts && typeof ts === 'object' && 'seconds' in ts) {
    return new Date((ts as { seconds: number }).seconds * 1000);
  }
  return new Date();
}

function getPickValue(pick: FieldPick): number {
  return pick.items.reduce(
    (sum, item) => sum + item.quantityPicked * item.unitPrice,
    0
  );
}

export default function FieldSalesPage() {
  const { can } = usePermissions();
  const [tab, setTab] = useState<Tab>('active');
  const [agents, setAgents] = useState<FieldAgent[]>([]);
  const [activePicks, setActivePicks] = useState<FieldPick[]>([]);
  const [closedPicks, setClosedPicks] = useState<FieldPick[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newPickOpen, setNewPickOpen] = useState(false);
  const [reportPick, setReportPick] = useState<FieldPick | null>(null);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [agentForm, setAgentForm] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
  });
  const [isSavingAgent, setIsSavingAgent] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  const handlePickCreated = async (pickId: string) => {
    try {
      const pick = await getFieldPickByIdClient(pickId);
      if (pick) {
        setActivePicks((prev) => [pick, ...prev.filter((p) => p.id !== pickId)]);
        setTab('active');
      }
    } catch {
      // Fall back to full reload below
    }
    void loadData(true);
  };

  const loadData = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    try {
      const [agentsData, activeData, closedData] = await Promise.all([
        listFieldAgentsClient(),
        listFieldPicksClient({ status: 'active' }),
        listFieldPicksClient({ status: 'closed', limit: 50 }),
      ]);
      setAgents(agentsData);
      setActivePicks(activeData);
      setClosedPicks(closedData);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load field sales data';
      toast.error(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const stats = useMemo(() => {
    const stockOutValue = activePicks.reduce(
      (sum, pick) => sum + getPickValue(pick),
      0
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRevenue = closedPicks
      .filter((pick) => {
        const closed = pick.closedAt;
        if (!closed) return false;
        const date =
          typeof closed === 'object' && 'toDate' in closed
            ? closed.toDate()
            : new Date((closed as { seconds: number }).seconds * 1000);
        return date >= today;
      })
      .reduce((sum, pick) => sum + (pick.report?.totalRevenue ?? 0), 0);

    return {
      activeCount: activePicks.length,
      stockOutValue,
      todayRevenue,
      agentCount: agents.filter((a) => a.active).length,
    };
  }, [activePicks, closedPicks, agents]);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAgent(true);
    try {
      await createFieldAgentClient(agentForm);
      toast.success('Field agent registered');
      setShowAgentForm(false);
      setAgentForm({ name: '', phone: '', email: '', notes: '' });
      void loadData(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create agent');
    } finally {
      setIsSavingAgent(false);
    }
  };

  const handleToggleAgent = async (agent: FieldAgent) => {
    try {
      await updateFieldAgentClient(agent.id, { active: !agent.active });
      void loadData(true);
    } catch {
      toast.error('Failed to update agent');
    }
  };

  if (!can('manageFieldSales')) {
    return (
      <AdminGuard>
        <AdminLayout activeSection="fieldSales" title="Field Sales">
          <p className="text-slate-600">
            You do not have permission to manage field sales.
          </p>
        </AdminLayout>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <AdminLayout
        activeSection="fieldSales"
        title="Field Sales"
        subtitle="Register agents, issue product picks, and reconcile end-of-day field sales."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={isRefreshing ? 'animate-spin' : undefined}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setNewPickOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <Plus size={16} />
              New pick
            </button>
          </div>
        }
      >
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: 'Active picks',
              value: String(stats.activeCount),
              icon: Truck,
              tone: 'text-violet-600 bg-violet-50',
            },
            {
              label: 'Stock in field',
              value: formatUgx(stats.stockOutValue),
              icon: Package,
              tone: 'text-blue-600 bg-blue-50',
            },
            {
              label: "Today's field revenue",
              value: formatUgx(stats.todayRevenue),
              icon: ClipboardCheck,
              tone: 'text-emerald-600 bg-emerald-50',
            },
            {
              label: 'Active agents',
              value: String(stats.agentCount),
              icon: Users,
              tone: 'text-violet-600 bg-violet-50',
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {isLoading ? '—' : stat.value}
                    </p>
                  </div>
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.tone}`}
                  >
                    <Icon size={18} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              { id: 'active', label: 'Active picks', icon: Truck },
              { id: 'history', label: 'History', icon: History },
              { id: 'agents', label: 'Agents', icon: Users },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === id
                  ? 'bg-violet-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600" />
          </div>
        ) : tab === 'active' ? (
          <div className="space-y-3">
            {activePicks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                <Truck className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="font-medium text-slate-700">No active picks</p>
                <p className="mt-1 text-sm text-slate-500">
                  Create a new pick to send products out with a field agent.
                </p>
              </div>
            ) : (
              activePicks.map((pick) => (
                <div
                  key={pick.id}
                  className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {pick.agentName}
                      </p>
                      <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                        Active
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {pick.items.length} products · {formatUgx(getPickValue(pick))}{' '}
                      value · Picked{' '}
                      {getPickDate(pick).toLocaleString('en-UG', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/field-sales/picks/${pick.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <ExternalLink size={14} />
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => setReportPick(pick)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      <ClipboardCheck size={14} />
                      Submit report
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : tab === 'history' ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Agent</th>
                  <th className="px-4 py-3 font-semibold">Closed</th>
                  <th className="px-4 py-3 text-right font-semibold">Sold</th>
                  <th className="px-4 py-3 text-right font-semibold">Returned</th>
                  <th className="px-4 py-3 text-right font-semibold">Pick value</th>
                  <th className="px-5 py-3 text-right font-semibold">Revenue</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {closedPicks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                      No closed picks yet
                    </td>
                  </tr>
                ) : (
                  closedPicks.map((pick) => (
                    <tr key={pick.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {pick.agentName}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">
                        {pick.closedAt &&
                          (typeof pick.closedAt === 'object' &&
                          'toDate' in pick.closedAt
                            ? pick.closedAt.toDate()
                            : new Date(
                                (pick.closedAt as { seconds: number }).seconds *
                                  1000
                              )
                          ).toLocaleString('en-UG', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {pick.report?.totalSold ?? 0}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {pick.report?.totalReturned ?? 0}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-slate-700">
                        {formatUgx(
                          pick.report?.pickValue ??
                            pick.items.reduce(
                              (sum, item) =>
                                sum + item.quantityPicked * item.unitPrice,
                              0
                            )
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold">
                        {formatUgx(pick.report?.totalRevenue ?? 0)}
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/admin/field-sales/picks/${pick.id}`}
                          className="text-sm font-medium text-violet-600 hover:text-violet-700"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowAgentForm(!showAgentForm)}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
              >
                <Plus size={16} />
                Register agent
              </button>
            </div>

            {showAgentForm && (
              <form
                onSubmit={handleCreateAgent}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h3 className="mb-4 font-semibold text-slate-900">
                  New field agent
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Full name *"
                    value={agentForm.name}
                    onChange={(e) =>
                      setAgentForm({ ...agentForm, name: e.target.value })
                    }
                    required
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <input
                    type="tel"
                    placeholder="Phone *"
                    value={agentForm.phone}
                    onChange={(e) =>
                      setAgentForm({ ...agentForm, phone: e.target.value })
                    }
                    required
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={agentForm.email}
                    onChange={(e) =>
                      setAgentForm({ ...agentForm, email: e.target.value })
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Notes"
                    value={agentForm.notes}
                    onChange={(e) =>
                      setAgentForm({ ...agentForm, notes: e.target.value })
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingAgent}
                  className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {isSavingAgent ? 'Saving…' : 'Save agent'}
                </button>
              </form>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Agent</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 text-right font-semibold">Picks</th>
                    <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                    <th className="px-4 py-3 text-right font-semibold">Wallet</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agents.length === 0 ? (
                    <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                        No field agents registered
                      </td>
                    </tr>
                  ) : (
                    agents.map((agent) => (
                      <tr key={agent.id} className="hover:bg-slate-50/80">
                        <td className="px-5 py-3.5 font-medium text-slate-900">
                          {agent.name}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{agent.phone}</td>
                        <td className="px-4 py-3.5 text-right">{agent.totalPicks}</td>
                        <td className="px-4 py-3.5 text-right font-medium">
                          {formatUgx(agent.totalRevenue)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-violet-700">
                          {formatUgx(agent.walletBalance ?? 0)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleAgent(agent)}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              agent.active
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {agent.active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/admin/field-sales/agents/${agent.id}`}
                            className="text-sm font-medium text-violet-600 hover:text-violet-700"
                          >
                            Profile
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <NewPickModal
          open={newPickOpen}
          onClose={() => setNewPickOpen(false)}
          onSuccess={handlePickCreated}
        />

        <SubmitReportModal
          pick={reportPick}
          open={!!reportPick}
          onClose={() => setReportPick(null)}
          onSuccess={() => void loadData(true)}
        />
      </AdminLayout>
    </AdminGuard>
  );
}
