'use client';

import type { BusinessInsight } from '@/lib/reports/types';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { reportsGlass } from './reports-ui';

const insightStyles = {
  success: {
    icon: CheckCircle2,
    border: 'border-emerald-200/60 dark:border-emerald-400/20',
    bg: 'bg-emerald-50/70 dark:bg-emerald-500/[0.08]',
    glow: 'from-emerald-400/20 dark:from-emerald-400/30',
    text: 'text-emerald-800 dark:text-emerald-300',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-200/60 dark:border-amber-400/20',
    bg: 'bg-amber-50/70 dark:bg-amber-500/[0.08]',
    glow: 'from-amber-400/20 dark:from-amber-400/30',
    text: 'text-amber-800 dark:text-amber-300',
  },
  danger: {
    icon: AlertTriangle,
    border: 'border-red-200/60 dark:border-red-400/20',
    bg: 'bg-red-50/70 dark:bg-red-500/[0.08]',
    glow: 'from-red-400/20 dark:from-red-400/30',
    text: 'text-red-800 dark:text-red-300',
  },
  info: {
    icon: Info,
    border: 'border-premium-blue/20 dark:border-cyan/25',
    bg: 'bg-premium-blue/5 dark:bg-cyan/[0.08]',
    glow: 'from-premium-blue/20 dark:from-cyan/30',
    text: 'text-premium-blue dark:text-cyan',
  },
};

export function BusinessInsightsPanel({ insights }: { insights: BusinessInsight[] }) {
  if (insights.length === 0) {
    return (
      <div className={`${reportsGlass.panelStatic} p-10 text-center`}>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100/80 text-slate-300 dark:bg-slate-800">
          <Lightbulb size={24} />
        </div>
        <p className="text-sm text-slate-500">No insights for the current period yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {insights.map((insight) => {
        const style = insightStyles[insight.type];
        const Icon = style.icon;
        return (
          <div
            key={insight.id}
            className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm backdrop-blur-xl ${style.border} ${style.bg}`}
          >
            <div
              aria-hidden
              className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${style.glow} to-transparent blur-2xl`}
            />
            <div className="relative flex items-start gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/60 ring-1 ring-black/5 dark:bg-black/20 ${style.text}`}
              >
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`font-semibold ${style.text}`}>{insight.title}</p>
                  {insight.metric && (
                    <span
                      className={`shrink-0 rounded-full bg-white/50 px-2 py-0.5 text-xs font-bold ring-1 ring-black/5 dark:bg-black/20 ${style.text}`}
                    >
                      {insight.metric}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {insight.description}
                </p>
                {insight.action && (
                  <p
                    className={`mt-2.5 inline-flex items-center gap-1 text-xs font-semibold ${style.text}`}
                  >
                    {insight.action}
                    <ArrowRight size={12} />
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function InsightsHero() {
  return (
    <div className={`${reportsGlass.panelStatic} mb-3 flex items-center gap-3 p-4 sm:mb-4 sm:gap-4 sm:p-5`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-premium-blue/20 to-cyan/20 text-premium-blue ring-1 ring-premium-blue/15 sm:h-12 sm:w-12 sm:rounded-2xl dark:text-cyan dark:ring-cyan/20">
        <Sparkles size={20} className="sm:hidden" />
        <Sparkles size={22} className="hidden sm:block" />
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold tracking-tight text-slate-900 dark:text-white">
          Business Insights
        </h3>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
          Actionable recommendations from sales, inventory, and customer signals
        </p>
      </div>
    </div>
  );
}
