import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Truck, Users, Package } from 'lucide-react';
import { getFieldAgents, getFieldPicks } from '@/lib/firestore';
import { formatUgx, formatDate } from '@/lib/currency';
import type { FieldAgent, FieldPick } from '@/lib/types';
import StatCard from '@/components/StatCard';
import Panel from '@/components/Panel';
import { PageLoader } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

export default function FieldSalesPage() {
  const [agents, setAgents] = useState<FieldAgent[]>([]);
  const [picks, setPicks] = useState<FieldPick[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([getFieldAgents(), getFieldPicks()])
      .then(([agentsData, picksData]) => {
        setAgents(agentsData);
        setPicks(picksData);
      })
      .catch(() => toast.error('Failed to load field sales data'))
      .finally(() => setLoading(false));
  }, []);

  const activePicks = picks.filter((p) => p.status === 'active');
  const totalRevenue = agents.reduce((sum, a) => sum + (a.totalRevenue ?? 0), 0);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Field Sales</h1>
        <p className="mt-1 text-slate-500">Manage field agents and stock picks</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Field Agents" value={String(agents.length)} icon={Users} />
        <StatCard
          label="Active Picks"
          value={String(activePicks.length)}
          icon={Package}
          tone={activePicks.length > 0 ? 'info' : 'default'}
        />
        <StatCard
          label="Total Revenue"
          value={formatUgx(totalRevenue)}
          icon={Truck}
          tone="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Field Agents" subtitle={`${agents.length} registered agents`}>
          {agents.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No field agents yet</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-900">{agent.name}</p>
                    <p className="text-xs text-slate-500">{agent.phone}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        agent.active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {agent.active ? 'Active' : 'Inactive'}
                    </span>
                    <p className="mt-1 text-xs text-slate-400">
                      {agent.totalPicks} picks · {formatUgx(agent.totalRevenue ?? 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Recent Picks" subtitle="Stock picked for field sales">
          {picks.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No picks yet</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {picks.slice(0, 10).map((pick) => (
                <div key={pick.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-900">{pick.agentName}</p>
                    <p className="text-xs text-slate-500">{formatDate(pick.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
                        pick.status === 'active'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                      )}
                    >
                      {pick.status}
                    </span>
                    <p className="mt-1 text-xs font-semibold text-slate-700">
                      {pick.totalItems} items · {formatUgx(pick.totalValue ?? 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
