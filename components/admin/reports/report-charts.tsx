'use client';

import { useEffect, useState } from 'react';
import { formatUgx } from '@/lib/currency';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { reportsGlass, SectionChrome, useChartTheme } from './reports-ui';

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

function useChartLayout() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const apply = () => setCompact(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return {
    height: compact ? 220 : 280,
    yWidth: compact ? 44 : 72,
    tickSize: compact ? 9 : 11,
    margin: compact
      ? { top: 4, right: 4, left: 0, bottom: 0 }
      : { top: 8, right: 8, left: 0, bottom: 0 },
  };
}

export function ChartPanel({
  title,
  subtitle,
  children,
  className = '',
}: ChartPanelProps) {
  return (
    <section className={`${reportsGlass.panel} overflow-hidden ${className}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-premium-blue/40 to-transparent dark:via-cyan/50"
      />
      <SectionChrome title={title} subtitle={subtitle} />
      <div className="p-3 sm:p-5">{children}</div>
    </section>
  );
}

export function RevenueLineChart({
  data,
  showProfit = false,
}: {
  data: Array<{ date: string; revenue: number; profit?: number }>;
  showProfit?: boolean;
}) {
  const chart = useChartTheme();
  const layout = useChartLayout();

  if (data.length === 0) {
    return <EmptyChart height={layout.height} />;
  }

  return (
    <div className="-mx-1 overflow-x-auto sm:mx-0">
      <div className="min-w-0 sm:min-w-0" style={{ minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={layout.height}>
          <LineChart data={data} margin={layout.margin}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={chart.grid}
              strokeOpacity={chart.gridOpacity}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: layout.tickSize, fill: chart.tickMuted }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
              tickFormatter={(v) =>
                new Date(v).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })
              }
            />
            <YAxis
              tick={{ fontSize: layout.tickSize, fill: chart.tickMuted }}
              width={layout.yWidth}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                Math.abs(Number(v)) >= 1_000_000
                  ? `${(Number(v) / 1_000_000).toFixed(1)}M`
                  : Math.abs(Number(v)) >= 1_000
                    ? `${(Number(v) / 1_000).toFixed(0)}k`
                    : String(v)
              }
            />
            <Tooltip
              contentStyle={chart.tooltip}
              formatter={(value) => formatUgx(Number(value ?? 0))}
            />
            <Legend wrapperStyle={{ color: chart.tickMuted, fontSize: layout.tickSize }} />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={chart.linePrimary}
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: chart.linePrimary }}
            />
            {showProfit && (
              <Line
                type="monotone"
                dataKey="profit"
                name="Profit"
                stroke={chart.lineSecondary}
                strokeWidth={2}
                dot={false}
                strokeDasharray="4 4"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function BarChartPanel({
  data,
  dataKey,
  nameKey,
  color,
}: {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  nameKey: string;
  color?: string;
}) {
  const chart = useChartTheme();
  const layout = useChartLayout();
  if (data.length === 0) return <EmptyChart height={layout.height} />;

  return (
    <ResponsiveContainer width="100%" height={layout.height}>
      <BarChart data={data} margin={layout.margin}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={chart.grid}
          strokeOpacity={chart.gridOpacity}
        />
        <XAxis
          dataKey={nameKey}
          tick={{ fontSize: layout.tickSize, fill: chart.tickMuted }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          angle={layout.height < 250 ? -25 : 0}
          textAnchor={layout.height < 250 ? 'end' : 'middle'}
          height={layout.height < 250 ? 48 : 30}
        />
        <YAxis
          tick={{ fontSize: layout.tickSize, fill: chart.tickMuted }}
          width={layout.yWidth}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) =>
            Math.abs(Number(v)) >= 1_000_000
              ? `${(Number(v) / 1_000_000).toFixed(1)}M`
              : Math.abs(Number(v)) >= 1_000
                ? `${(Number(v) / 1_000).toFixed(0)}k`
                : String(v)
          }
        />
        <Tooltip
          contentStyle={chart.tooltip}
          formatter={(value) => formatUgx(Number(value ?? 0))}
        />
        <Bar dataKey={dataKey} fill={color ?? chart.barPrimary} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChartPanel({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  const chart = useChartTheme();
  const layout = useChartLayout();
  if (data.length === 0) return <EmptyChart height={layout.height} />;

  const inner = layout.height < 250 ? 48 : 64;
  const outer = layout.height < 250 ? 78 : 100;

  return (
    <ResponsiveContainer width="100%" height={layout.height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={inner}
          outerRadius={outer}
          paddingAngle={3}
          stroke="none"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={chart.colors[index % chart.colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={chart.tooltip}
          formatter={(value) => formatUgx(Number(value ?? 0))}
        />
        <Legend wrapperStyle={{ color: chart.tickMuted, fontSize: layout.tickSize }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400 sm:py-10 dark:text-slate-500">
        No data available
      </p>
    );
  }

  return (
    <div className="relative">
      <div className="overflow-x-auto overscroll-x-contain rounded-xl ring-1 ring-slate-200/60 [-webkit-overflow-scrolling:touch] dark:ring-white/[0.06] dark:bg-black/20">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-white/[0.03]">
              {headers.map((h, hi) => (
                <th
                  key={h}
                  className={`px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 sm:px-3 sm:py-2.5 sm:text-[11px] dark:text-slate-500 ${
                    hi === 0 ? 'sticky left-0 z-10 bg-slate-50/95 dark:bg-[#0c1424]/95' : ''
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80 dark:divide-white/[0.04]">
            {rows.map((row, i) => (
              <tr
                key={i}
                className="transition hover:bg-premium-blue/[0.03] dark:hover:bg-cyan/[0.06]"
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`max-w-[160px] truncate px-2.5 py-2 sm:max-w-none sm:px-3 sm:py-2.5 ${
                      j === 0
                        ? 'sticky left-0 z-10 bg-white/95 font-medium text-slate-800 dark:bg-[#0c1424]/95 dark:text-slate-200'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                    title={cell}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-slate-400 sm:hidden">
        Swipe sideways to see more columns
      </p>
    </div>
  );
}

function EmptyChart({ height = 280 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed border-slate-200/80 bg-slate-50/40 dark:border-cyan/15 dark:bg-black/25"
      style={{ height }}
    >
      <p className="text-sm text-slate-400 dark:text-slate-500">No data for selected period</p>
    </div>
  );
}
