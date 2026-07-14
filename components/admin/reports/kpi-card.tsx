'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { formatUgx } from '@/lib/currency';
import type { KpiMetric } from '@/lib/reports/types';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { reportsGlass, useReportsTheme } from './reports-ui';

interface KpiCardProps {
  label: string;
  metric: KpiMetric;
  icon: LucideIcon;
  format?: 'currency' | 'number' | 'percent';
  onClick?: () => void;
  emphasis?: boolean;
}

function formatValue(value: number, format: 'currency' | 'number' | 'percent') {
  if (format === 'currency') return formatUgx(value);
  if (format === 'percent') return `${value.toFixed(1)}%`;
  return value.toLocaleString();
}

/** Avoid mounting charts inside display:none / zero-size parents (Recharts warning). */
function useShowDesktopSparkline() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const apply = () => setShow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return show;
}

export function KpiCard({
  label,
  metric,
  icon: Icon,
  format = 'currency',
  onClick,
  emphasis = false,
}: KpiCardProps) {
  const theme = useReportsTheme();
  const isDark = theme === 'dark';
  const showSpark = useShowDesktopSparkline();
  const sparkData = metric.sparkline.map((value, index) => ({ index, value }));
  const isPositive = (metric.changePercent ?? 0) >= 0;
  const sparkId = `kpi-spark-${label.replace(/\s/g, '')}`;
  const stroke = isDark ? '#38bdf8' : '#0077c8';
  const display = metric.available ? formatValue(metric.value, format) : '—';
  const hasSpark = showSpark && sparkData.some((d) => d.value > 0);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={typeof display === 'string' ? `${label}: ${display}` : label}
      className={`group relative overflow-hidden text-left touch-manipulation ${reportsGlass.panel} ${
        emphasis ? 'p-3.5 sm:p-6' : 'p-3 sm:p-4'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-premium-blue/50 to-transparent opacity-80 dark:via-cyan/60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-premium-blue/5 blur-2xl transition group-hover:bg-cyan/10 dark:bg-cyan/15 dark:group-hover:bg-cyan/25"
      />

      <div className="relative flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:text-[11px] dark:text-slate-500">
            {label}
          </p>
          <p
            className={`mt-1 break-words font-bold leading-snug tracking-tight text-slate-900 dark:text-white sm:mt-1.5 ${
              emphasis
                ? 'text-lg sm:text-3xl dark:drop-shadow-[0_0_20px_rgba(56,189,248,0.15)]'
                : 'text-sm sm:text-2xl'
            }`}
          >
            {display}
          </p>
          {!metric.available && metric.note && (
            <p className="mt-1 line-clamp-2 text-[10px] text-slate-400 dark:text-slate-500">
              {metric.note}
            </p>
          )}
          {metric.changePercent !== undefined && (
            <div
              className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset sm:mt-2 sm:px-2 sm:text-xs ${
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25 dark:shadow-[0_0_12px_rgba(52,211,153,0.15)]'
                  : 'bg-red-500/10 text-red-700 ring-red-500/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/25'
              }`}
            >
              {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {Math.abs(metric.changePercent).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="flex shrink-0 rounded-lg bg-gradient-to-br from-premium-blue/15 to-cyan/15 p-1.5 text-premium-blue shadow-sm ring-1 ring-premium-blue/10 sm:rounded-xl sm:p-2.5 dark:from-cyan/20 dark:to-premium-blue/20 dark:text-cyan dark:ring-cyan/25 dark:shadow-[0_0_20px_rgba(25,181,254,0.2)]">
          <Icon size={emphasis ? 16 : 14} className="sm:hidden" />
          <Icon size={emphasis ? 20 : 18} className="hidden sm:block" />
        </div>
      </div>

      {hasSpark && (
        <div className="relative mt-3 h-10 w-full min-w-0 opacity-80 dark:opacity-90">
          <ResponsiveContainer width="100%" height={40} minWidth={0}>
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={isDark ? 0.45 : 0.35} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={stroke}
                fill={`url(#${sparkId})`}
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </button>
  );
}

export function KpiSkeleton() {
  return (
    <div className={`${reportsGlass.panelStatic} animate-pulse p-3 sm:p-4`}>
      <div className="h-3 w-20 rounded-full bg-slate-200/80 sm:w-24 dark:bg-white/10" />
      <div className="mt-2.5 h-6 w-24 rounded-lg bg-slate-200/80 sm:mt-3 sm:h-7 sm:w-32 dark:bg-white/10" />
      <div className="mt-3 hidden h-10 rounded-lg bg-slate-100/80 sm:mt-4 sm:block dark:bg-white/[0.05]" />
    </div>
  );
}
