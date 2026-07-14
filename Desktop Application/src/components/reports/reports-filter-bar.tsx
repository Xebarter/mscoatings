'use client';

import { useState } from 'react';
import { DATE_PRESET_LABELS, type DatePreset } from '@/lib/reports/date-range';
import type { EnterpriseReport } from '@/lib/reports/types';
import {
  Bookmark,
  Calendar,
  ChevronDown,
  Download,
  Filter,
  Moon,
  Printer,
  RefreshCw,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { downloadCsv } from './export-utils';
import { reportsGlass } from './reports-ui';

export type ReportSection =
  | 'overview'
  | 'sales'
  | 'products'
  | 'inventory'
  | 'customers'
  | 'employees'
  | 'financial'
  | 'insights';

interface ReportsFilterBarProps {
  preset: DatePreset;
  from: string;
  to: string;
  category: string;
  productId: string;
  paymentMethod: string;
  channel: string;
  employee: string;
  search: string;
  darkMode: boolean;
  isLoading: boolean;
  filterOptions: EnterpriseReport['filterOptions'] | null;
  favorites: ReportSection[];
  activeSection: ReportSection;
  onPresetChange: (preset: DatePreset) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onProductChange: (value: string) => void;
  onPaymentMethodChange: (value: string) => void;
  onChannelChange: (value: string) => void;
  onEmployeeChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onDarkModeToggle: () => void;
  onRefresh: () => void;
  onToggleFavorite: (section: ReportSection) => void;
  onExportCsv: () => void;
  onPrint: () => void;
  onClearFilters: () => void;
}

const PRESETS: DatePreset[] = [
  'today',
  'yesterday',
  'last7',
  'last30',
  'thisMonth',
  'lastMonth',
  'quarter',
  'year',
  'custom',
];

function ActionButton({
  onClick,
  disabled,
  className,
  icon: Icon,
  label,
  pressed,
  title,
  spinning,
}: {
  onClick: () => void;
  disabled?: boolean;
  className: string;
  icon: typeof Bookmark;
  label: string;
  pressed?: boolean;
  title?: string;
  spinning?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={title ?? label}
      className={`${className} min-h-10 min-w-10 justify-center touch-manipulation sm:min-h-0 sm:min-w-0 sm:justify-start`}
    >
      <Icon size={14} className={spinning ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export function ReportsFilterBar({
  preset,
  from,
  to,
  category,
  productId,
  paymentMethod,
  channel,
  employee,
  search,
  darkMode,
  isLoading,
  filterOptions,
  favorites,
  activeSection,
  onPresetChange,
  onFromChange,
  onToChange,
  onCategoryChange,
  onProductChange,
  onPaymentMethodChange,
  onChannelChange,
  onEmployeeChange,
  onSearchChange,
  onDarkModeToggle,
  onRefresh,
  onToggleFavorite,
  onExportCsv,
  onPrint,
  onClearFilters,
}: ReportsFilterBarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const hasFilters = Boolean(
    category || productId || paymentMethod || channel || employee || search
  );
  const advancedCount = [category, productId, paymentMethod, channel, employee].filter(
    Boolean
  ).length;

  return (
    <div className={reportsGlass.filter}>
      <div className="flex flex-col gap-3 sm:gap-4">
        {/* Title + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-premium-blue/15 to-cyan/15 text-premium-blue ring-1 ring-premium-blue/10 dark:text-cyan dark:ring-cyan/20">
              <Filter size={15} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                Report Filters
              </p>
              <p className="hidden text-[11px] text-slate-400 dark:text-slate-500 sm:block">
                Refine date range, channel, and products
              </p>
            </div>
            {favorites.includes(activeSection) && (
              <Bookmark size={14} className="ml-0.5 shrink-0 fill-amber-400 text-amber-400" />
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ActionButton
              onClick={() => onToggleFavorite(activeSection)}
              className={reportsGlass.btnGhost}
              icon={Bookmark}
              label="Favorite"
            />
            <ActionButton
              onClick={onExportCsv}
              className={`hidden ${reportsGlass.btnGhost} sm:inline-flex`}
              icon={Download}
              label="CSV"
            />
            <ActionButton
              onClick={onPrint}
              className={`hidden ${reportsGlass.btnGhost} sm:inline-flex`}
              icon={Printer}
              label="Print"
            />
            <ActionButton
              onClick={onDarkModeToggle}
              className={`${reportsGlass.btnGhost} ${
                darkMode
                  ? '!border-cyan/30 !bg-cyan/10 !text-cyan !shadow-[0_0_20px_rgba(25,181,254,0.2)]'
                  : ''
              }`}
              icon={darkMode ? Sun : Moon}
              label={darkMode ? 'Light' : 'Dark'}
              pressed={darkMode}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            />
            <ActionButton
              onClick={onRefresh}
              disabled={isLoading}
              spinning={isLoading}
              className={reportsGlass.btnPrimary}
              icon={RefreshCw}
              label="Refresh"
            />
          </div>
        </div>

        {/* Date presets — horizontal scroll on mobile */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPresetChange(p)}
              className={`${reportsGlass.chip} snap-start whitespace-nowrap ${
                preset === p ? reportsGlass.chipActive : reportsGlass.chipIdle
              }`}
            >
              {DATE_PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <div className="flex items-center gap-2 sm:contents">
              <Calendar size={14} className="hidden shrink-0 text-slate-400 sm:block" />
              <label className="flex flex-1 flex-col gap-1 sm:flex-initial">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:sr-only">
                  From
                </span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => onFromChange(e.target.value)}
                  className={`${reportsGlass.input} w-full min-h-11 sm:min-h-0 sm:w-auto`}
                />
              </label>
              <span className="hidden text-slate-400 sm:inline">to</span>
              <label className="flex flex-1 flex-col gap-1 sm:flex-initial">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:sr-only">
                  To
                </span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => onToChange(e.target.value)}
                  className={`${reportsGlass.input} w-full min-h-11 sm:min-h-0 sm:w-auto`}
                />
              </label>
            </div>
          </div>
        )}

        {/* Search always visible */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search reports…"
            className={`${reportsGlass.input} min-h-11 w-full py-2.5 pl-9 pr-3 sm:min-h-0 sm:py-2`}
          />
        </div>

        {/* Advanced filters — collapsed on mobile */}
        <div className="flex flex-wrap items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            className={`${reportsGlass.btnGhost} min-h-10`}
            aria-expanded={advancedOpen}
          >
            <Filter size={14} />
            More filters
            {advancedCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-premium-blue px-1.5 text-[10px] font-bold text-white dark:bg-cyan dark:text-slate-950">
                {advancedCount}
              </span>
            )}
            <ChevronDown
              size={14}
              className={`transition ${advancedOpen ? 'rotate-180' : ''}`}
            />
          </button>
          <ActionButton
            onClick={onExportCsv}
            className={reportsGlass.btnGhost}
            icon={Download}
            label="CSV"
          />
          <ActionButton
            onClick={onPrint}
            className={reportsGlass.btnGhost}
            icon={Printer}
            label="Print"
          />
          {hasFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-slate-100/80 px-3 text-xs font-medium text-slate-600 dark:bg-slate-800/80 dark:text-slate-300"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>

        <div
          className={`${
            advancedOpen ? 'grid' : 'hidden'
          } grid-cols-1 gap-2.5 sm:gap-3 md:grid md:grid-cols-2 xl:grid-cols-5`}
        >
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className={`${reportsGlass.input} min-h-11 w-full sm:min-h-0`}
          >
            <option value="">All categories</option>
            {filterOptions?.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={productId}
            onChange={(e) => onProductChange(e.target.value)}
            className={`${reportsGlass.input} min-h-11 w-full sm:min-h-0`}
          >
            <option value="">All products</option>
            {filterOptions?.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={paymentMethod}
            onChange={(e) => onPaymentMethodChange(e.target.value)}
            className={`${reportsGlass.input} min-h-11 w-full sm:min-h-0`}
          >
            <option value="">All payment methods</option>
            {filterOptions?.paymentMethods.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select
            value={channel}
            onChange={(e) => onChannelChange(e.target.value)}
            className={`${reportsGlass.input} min-h-11 w-full sm:min-h-0`}
          >
            <option value="">All channels</option>
            <option value="pos">POS / Retail</option>
            <option value="online">Online</option>
            <option value="field">Field Sales</option>
          </select>
          {filterOptions && filterOptions.employees.length > 0 ? (
            <select
              value={employee}
              onChange={(e) => onEmployeeChange(e.target.value)}
              className={`${reportsGlass.input} min-h-11 w-full sm:min-h-0`}
            >
              <option value="">All employees</option>
              {filterOptions.employees.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          ) : (
            <div className="hidden xl:block" />
          )}
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="hidden w-fit items-center gap-1.5 rounded-full bg-slate-100/80 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-200/80 md:inline-flex dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <X size={12} />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

export function exportSalesCsv(report: EnterpriseReport) {
  downloadCsv(
    `ms-coatings-sales-${report.meta.preset}.csv`,
    ['Date', 'Revenue', 'Profit', 'Transactions'],
    report.sales.dailyTrend.map((row) => [
      row.date,
      String(row.revenue),
      String(row.profit),
      String(row.transactions),
    ])
  );
}
