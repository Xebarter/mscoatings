'use client';

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';

export type ReportsTheme = 'light' | 'dark';

const ReportsThemeContext = createContext<ReportsTheme>('light');

export function useReportsTheme() {
  return useContext(ReportsThemeContext);
}

/** Shared glassmorphic surfaces for the BI reports hub */
export const reportsGlass = {
  panel:
    'relative rounded-2xl border border-white/60 bg-white/65 shadow-[0_4px_24px_rgba(15,23,42,0.05)] backdrop-blur-xl transition duration-300 hover:border-premium-blue/20 hover:shadow-[0_12px_40px_rgba(0,119,200,0.08)] dark:border-white/[0.08] dark:bg-[rgba(12,20,36,0.72)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:border-cyan/25 dark:hover:shadow-[0_12px_48px_rgba(25,181,254,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]',
  panelStatic:
    'relative rounded-2xl border border-white/60 bg-white/65 shadow-[0_4px_24px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[rgba(12,20,36,0.72)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]',
  filter:
    'sticky top-0 z-30 -mx-4 border-b border-white/40 bg-white/70 px-4 py-3 shadow-[0_8px_32px_rgba(15,23,42,0.04)] backdrop-blur-2xl dark:border-cyan/10 dark:bg-[rgba(6,10,20,0.85)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] sm:py-4 sm:-mx-6 sm:px-6',
  input:
    'rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-premium-blue/40 focus:ring-2 focus:ring-premium-blue/15 dark:border-white/10 dark:bg-[rgba(8,14,28,0.85)] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan/40 dark:focus:ring-cyan/20 dark:focus:shadow-[0_0_0_3px_rgba(25,181,254,0.08)]',
  btnGhost:
    'inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/60 px-2.5 py-2 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm transition hover:border-premium-blue/30 hover:bg-white hover:text-premium-blue sm:px-3 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-cyan/30 dark:hover:bg-cyan/10 dark:hover:text-cyan dark:hover:shadow-[0_0_20px_rgba(25,181,254,0.12)]',
  btnPrimary:
    'inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-premium-blue to-cyan px-2.5 py-2 text-xs font-semibold text-white shadow-[0_4px_16px_rgba(0,119,200,0.35)] transition hover:brightness-110 disabled:opacity-60 sm:px-3.5 dark:shadow-[0_4px_24px_rgba(25,181,254,0.35)] dark:hover:shadow-[0_6px_28px_rgba(25,181,254,0.45)]',
  chip:
    'rounded-xl px-3 py-2 text-xs font-medium transition sm:py-1.5 touch-manipulation',
  chipActive:
    'bg-gradient-to-r from-premium-blue to-cyan text-white shadow-[0_2px_12px_rgba(0,119,200,0.3)] dark:shadow-[0_0_24px_rgba(25,181,254,0.35)]',
  chipIdle:
    'border border-slate-200/80 bg-white/50 text-slate-600 hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-400 dark:hover:border-white/15 dark:hover:bg-white/[0.06] dark:hover:text-slate-200',
  tabActive:
    'bg-white/90 text-premium-blue shadow-[0_2px_12px_rgba(15,23,42,0.08)] ring-1 ring-premium-blue/15 dark:bg-gradient-to-b dark:from-cyan/15 dark:to-premium-blue/10 dark:text-cyan dark:shadow-[0_0_24px_rgba(25,181,254,0.15)] dark:ring-cyan/25',
  tabIdle:
    'text-slate-500 hover:bg-white/50 hover:text-slate-800 dark:text-slate-500 dark:hover:bg-white/[0.05] dark:hover:text-slate-200',
} as const;

export function ReportsThemeProvider({
  theme,
  children,
}: {
  theme: ReportsTheme;
  children: ReactNode;
}) {
  return (
    <ReportsThemeContext.Provider value={theme}>{children}</ReportsThemeContext.Provider>
  );
}

export function ReportsAtmosphere({ children }: { children: ReactNode }) {
  const theme = useReportsTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className={`relative isolate transition-colors duration-500 ${
        isDark
          ? '-mx-4 min-h-[70vh] rounded-none bg-[#050914] px-4 pb-4 pt-1 sm:-mx-6 sm:rounded-3xl sm:px-6 sm:pb-6'
          : ''
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden sm:rounded-3xl"
      >
        {isDark ? (
          <>
            {/* Deep navy base wash */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#07101f] via-[#050914] to-[#03060d]" />
            {/* Ambient brand luminosity */}
            <div className="absolute -left-20 -top-24 h-[28rem] w-[28rem] rounded-full bg-premium-blue/25 blur-[100px]" />
            <div className="absolute -right-16 top-20 h-[22rem] w-[22rem] rounded-full bg-cyan/20 blur-[90px]" />
            <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-premium-blue/10 blur-[80px]" />
            <div className="absolute bottom-1/4 right-1/4 h-40 w-40 rounded-full bg-orange/10 blur-[60px]" />
            {/* Soft vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(3,6,13,0.65)_100%)]" />
            {/* Fine grid */}
            <div
              className="absolute inset-0 opacity-[0.22]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgba(100,180,255,0.22) 1px, transparent 0)',
                backgroundSize: '28px 28px',
              }}
            />
            {/* Top sheen */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
          </>
        ) : (
          <>
            <div className="absolute -left-24 -top-16 h-72 w-72 rounded-full bg-premium-blue/15 blur-3xl" />
            <div className="absolute right-0 top-32 h-80 w-80 rounded-full bg-cyan/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-orange/5 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)',
                backgroundSize: '24px 24px',
              }}
            />
          </>
        )}
      </div>
      {children}
    </div>
  );
}

export function ReportsPageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const theme = useReportsTheme();
  const isDark = theme === 'dark';

  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-1.5 w-1.5 rounded-full ${
            isDark
              ? 'bg-cyan shadow-[0_0_10px_rgba(25,181,254,0.8)]'
              : 'bg-premium-blue'
          }`}
        />
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
            isDark ? 'text-cyan/80' : 'text-premium-blue'
          }`}
        >
          Analytics suite
        </p>
      </div>
      <h1
        className={`mt-1.5 text-xl font-bold tracking-tight sm:mt-2 sm:text-3xl ${
          isDark
            ? 'bg-gradient-to-r from-white via-slate-100 to-cyan/80 bg-clip-text text-transparent'
            : 'text-slate-900'
        }`}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className={`mt-1 line-clamp-2 max-w-2xl text-sm sm:mt-1.5 sm:line-clamp-none sm:text-base ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function GlassPanel({
  children,
  className = '',
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={`${hover ? reportsGlass.panel : reportsGlass.panelStatic} ${className}`}>
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: 'default' | 'positive' | 'negative' | 'brand';
}) {
  const valueTone =
    accent === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400 dark:drop-shadow-[0_0_12px_rgba(52,211,153,0.25)]'
      : accent === 'negative'
        ? 'text-red-600 dark:text-red-400'
        : accent === 'brand'
          ? 'text-premium-blue dark:text-cyan dark:drop-shadow-[0_0_12px_rgba(25,181,254,0.3)]'
          : 'text-slate-900 dark:text-white';

  return (
    <div className={`${reportsGlass.panelStatic} relative overflow-hidden p-3.5 sm:p-5`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-premium-blue/40 to-transparent dark:via-cyan/50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 hidden h-28 w-28 rounded-full bg-cyan/10 blur-2xl dark:block"
      />
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:text-[11px] dark:text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 break-words text-base font-bold leading-snug tracking-tight sm:mt-1.5 sm:text-2xl ${valueTone}`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 line-clamp-2 text-[11px] text-slate-400 sm:text-xs dark:text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SectionChrome({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-1 flex items-start justify-between gap-3 border-b border-slate-200/60 px-4 py-3 dark:border-white/[0.06] sm:px-5 sm:py-4">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-[15px]">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-500 sm:text-sm">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Chart palette that adapts to reports theme */
export function useChartTheme() {
  const theme = useReportsTheme();
  const isDark = theme === 'dark';

  return {
    isDark,
    grid: isDark ? '#1e3a5f' : '#cbd5e1',
    gridOpacity: isDark ? 0.45 : 0.35,
    tick: isDark ? '#7dd3fc' : '#64748b',
    tickMuted: isDark ? '#64748b' : '#64748b',
    tooltip: isDark
      ? {
          backgroundColor: 'rgba(8, 14, 28, 0.92)',
          border: '1px solid rgba(25, 181, 254, 0.25)',
          borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
          backdropFilter: 'blur(16px)',
          fontSize: 12,
          color: '#e2e8f0',
        }
      : {
          backgroundColor: 'rgba(255,255,255,0.92)',
          border: '1px solid rgba(148,163,184,0.25)',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(15,23,42,0.1)',
          backdropFilter: 'blur(12px)',
          fontSize: 12,
        },
    linePrimary: isDark ? '#38bdf8' : '#0077c8',
    lineSecondary: isDark ? '#34d399' : '#10b981',
    barPrimary: isDark ? '#0ea5e9' : '#0077c8',
    colors: isDark
      ? ['#38bdf8', '#22d3ee', '#34d399', '#fb923c', '#f87171', '#fbbf24']
      : ['#0077c8', '#19b5fe', '#10b981', '#f57c00', '#e53935', '#ffc107'],
  };
}
