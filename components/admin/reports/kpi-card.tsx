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
  highlight?: 'cash';
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
  highlight,
}: KpiCardProps) {
  const theme = useReportsTheme();
  const isDark = theme === 'dark';
  const isCashHighlight = highlight === 'cash';
  const showSpark = useShowDesktopSparkline();
  const sparkData = metric.sparkline.map((value, index) => ({ index, value }));
  const isPositive = (metric.changePercent ?? 0) >= 0;
  const sparkId = `kpi-spark-${label.replace(/\s/g, '')}`;
  const stroke = isCashHighlight ? (isDark ? '#34d399' : '#059669') : isDark ? '#38bdf8' : '#0077c8';
  const display = metric.available ? formatValue(metric.value, format) : '—';
  const hasSpark = showSpark && sparkData.some((d) => d.value > 0);

  const panelClass = isCashHighlight
    ? 'relative rounded-2xl border border-emerald-300/80 bg-gradient-to-br from-emerald-50/95 via-white/85 to-green-100/80 shadow-[0_8px_32px_rgba(16,185,129,0.18)] backdrop-blur-xl transition duration-300 hover:border-emerald-400/70 hover:shadow-[0_12px_44px_rgba(16,185,129,0.28)] dark:border-emerald-400/35 dark:bg-gradient-to-br dark:from-emerald-950/70 dark:via-[rgba(8,24,20,0.88)] dark:to-emerald-900/45 dark:shadow-[0_8px_40px_rgba(16,185,129,0.25),inset_0_1px_0_rgba(52,211,153,0.12)] dark:hover:border-emerald-400/50 dark:hover:shadow-[0_12px_48px_rgba(52,211,153,0.32),inset_0_1px_0_rgba(52,211,153,0.18)]'
    : reportsGlass.panel;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={typeof display === 'string' ? `${label}: ${display}` : label}
      className={`group relative overflow-hidden text-left touch-manipulation ${panelClass} ${
        emphasis || isCashHighlight ? 'p-3.5 sm:p-6' : 'p-3 sm:p-4'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-80 ${
          isCashHighlight
            ? 'via-emerald-400/80 dark:via-emerald-300/70'
            : 'via-premium-blue/50 dark:via-cyan/60'
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl transition ${
          isCashHighlight
            ? 'bg-emerald-400/15 group-hover:bg-emerald-400/25 dark:bg-emerald-400/25 dark:group-hover:bg-emerald-300/35'
            : 'bg-premium-blue/5 group-hover:bg-cyan/10 dark:bg-cyan/15 dark:group-hover:bg-cyan/25'
        }`}
      />

      <div className="relative flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-[10px] font-semibold uppercase tracking-[0.08em] sm:text-[11px] ${
              isCashHighlight
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-slate-500 dark:text-slate-500'
            }`}
          >
            {label}
          </p>
          <p
            className={`mt-1 break-words font-bold leading-snug tracking-tight sm:mt-1.5 ${
              isCashHighlight
                ? 'text-emerald-800 dark:text-emerald-200 dark:drop-shadow-[0_0_20px_rgba(52,211,153,0.35)]'
                : 'text-slate-900 dark:text-white'
            } ${
              emphasis || isCashHighlight
                ? emphasis && !isCashHighlight
                  ? 'text-lg sm:text-3xl dark:drop-shadow-[0_0_20px_rgba(56,189,248,0.15)]'
                  : 'text-lg sm:text-3xl'
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
        <div
          className={`flex shrink-0 rounded-lg p-1.5 shadow-sm ring-1 sm:rounded-xl sm:p-2.5 ${
            isCashHighlight
              ? 'bg-gradient-to-br from-emerald-400/25 to-green-400/20 text-emerald-700 ring-emerald-400/30 dark:from-emerald-400/30 dark:to-green-400/20 dark:text-emerald-300 dark:ring-emerald-400/40 dark:shadow-[0_0_24px_rgba(52,211,153,0.35)]'
              : 'bg-gradient-to-br from-premium-blue/15 to-cyan/15 text-premium-blue ring-premium-blue/10 dark:from-cyan/20 dark:to-premium-blue/20 dark:text-cyan dark:ring-cyan/25 dark:shadow-[0_0_20px_rgba(25,181,254,0.2)]'
          }`}
        >
          <Icon size={emphasis || isCashHighlight ? 16 : 14} className="sm:hidden" />
          <Icon size={emphasis || isCashHighlight ? 20 : 18} className="hidden sm:block" />
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
