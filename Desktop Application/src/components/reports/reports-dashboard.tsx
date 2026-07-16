'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DatePreset } from '@/lib/reports/date-range';
import type { EnterpriseReport } from '@/lib/reports/types';
import { formatUgx } from '@/lib/currency';
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '@/lib/types';
import {
  Banknote,
  BarChart3,
  Boxes,
  CreditCard,
  DollarSign,
  Package,
  Percent,
  RefreshCcw,
  ShoppingCart,
  Smartphone,
  Star,
  TrendingUp,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react';
import { KpiCard, KpiSkeleton } from './kpi-card';
import {
  BarChartPanel,
  ChartPanel,
  DataTable,
  DonutChartPanel,
  RevenueLineChart,
} from './report-charts';
import { BusinessInsightsPanel, InsightsHero } from './business-insights';
import {
  exportSalesCsv,
  ReportsFilterBar,
  type ReportSection,
} from './reports-filter-bar';
import { useEnterpriseReport } from './use-enterprise-report';
import { printEnterpriseReport, setPrintPreviewHandler } from './export-utils';
import { PrintPreviewModal } from './print-preview-modal';
import { ReportsAtmosphere, ReportsPageHeader, ReportsThemeProvider, reportsGlass, StatTile } from './reports-ui';

const SECTIONS: { id: ReportSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sales', label: 'Sales' },
  { id: 'products', label: 'Products' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'customers', label: 'Customers' },
  { id: 'employees', label: 'Employees' },
  { id: 'financial', label: 'Financial' },
  { id: 'insights', label: 'Insights' },
];

function filterTableRows(rows: string[][], search: string): string[][] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => row.some((cell) => cell.toLowerCase().includes(q)));
}

function OverviewSection({ report, search }: { report: EnterpriseReport; search: string }) {
  const { kpis } = report;
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Total Revenue" metric={kpis.revenue} icon={TrendingUp} emphasis />
        <KpiCard label="Gross Profit" metric={kpis.grossProfit} icon={DollarSign} emphasis />
        <KpiCard
          label="Transactions"
          metric={kpis.transactions}
          icon={ShoppingCart}
          format="number"
          emphasis
        />
        <KpiCard label="Avg Order Value" metric={kpis.averageOrderValue} icon={BarChart3} emphasis />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Revenue Today" metric={kpis.revenueToday} icon={TrendingUp} />
        <KpiCard label="Revenue This Week" metric={kpis.revenueWeek} icon={TrendingUp} />
        <KpiCard label="Revenue This Month" metric={kpis.revenueMonth} icon={TrendingUp} />
        <KpiCard label="Revenue This Year" metric={kpis.revenueYear} icon={TrendingUp} />
        <KpiCard label="Gross Margin" metric={kpis.grossMargin} icon={Percent} format="percent" />
        <KpiCard label="Net Margin" metric={kpis.netMargin} icon={Percent} format="percent" />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total Customers" metric={kpis.totalCustomers} icon={Users} format="number" />
        <KpiCard
          label="Active Customers"
          metric={kpis.activeCustomers}
          icon={Users}
          format="number"
        />
        <KpiCard label="Outstanding Balances" metric={kpis.outstandingBalances} icon={CreditCard} />
        <KpiCard label="Inventory Value (Retail)" metric={kpis.inventoryRetailValue} icon={Warehouse} />
        <KpiCard label="Inventory Cost" metric={kpis.inventoryCostValue} icon={Boxes} />
        <KpiCard label="Total Products" metric={kpis.totalProducts} icon={Package} format="number" />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Low Stock" metric={kpis.lowStockItems} icon={Package} format="number" />
        <KpiCard label="Out of Stock" metric={kpis.outOfStockItems} icon={Package} format="number" />
        <KpiCard
          label="Expiring Products"
          metric={kpis.expiringProducts}
          icon={Package}
          format="number"
        />
        <KpiCard label="Accounts Receivable" metric={kpis.accountsReceivable} icon={Wallet} />
        <KpiCard label="Accounts Payable" metric={kpis.accountsPayable} icon={Wallet} />
        <KpiCard label="Purchase Value" metric={kpis.purchaseValue} icon={ShoppingCart} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
        <KpiCard label="Cash on Hand" metric={kpis.cashOnHand} icon={Banknote} />
        <KpiCard label="Mobile Money" metric={kpis.mobileMoneyBalance} icon={Smartphone} />
        <KpiCard label="Bank Balances" metric={kpis.bankBalance} icon={Banknote} />
        <KpiCard label="Refunds" metric={kpis.refundAmount} icon={RefreshCcw} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
        <ChartPanel title="Revenue Trend" subtitle="Daily performance in selected period">
          <RevenueLineChart data={report.sales.dailyTrend} showProfit />
        </ChartPanel>
        <ChartPanel title="Sales by Channel" subtitle="POS, online, and field sales">
          <DonutChartPanel
            data={report.sales.byChannel.map((c) => ({
              name: c.channel,
              value: c.revenue,
            }))}
          />
        </ChartPanel>
      </div>

      <ChartPanel title="Top Products" subtitle="Best performers in selected period">
        <DataTable
          headers={['Product', 'Qty', 'Revenue', 'Profit', 'Margin']}
          rows={filterTableRows(
            report.sales.byProduct.slice(0, 10).map((p) => [
              p.name,
              String(p.quantity),
              formatUgx(p.revenue),
              formatUgx(p.profit),
              `${p.margin.toFixed(1)}%`,
            ]),
            search
          )}
        />
      </ChartPanel>
    </div>
  );
}

function SalesSection({ report }: { report: EnterpriseReport }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
        <ChartPanel title="Daily Sales Trend">
          <RevenueLineChart data={report.sales.dailyTrend} />
        </ChartPanel>
        <ChartPanel title="Sales by Hour" subtitle="Peak trading hours">
          <BarChartPanel data={report.sales.hourly} dataKey="revenue" nameKey="hour" color="#0077c8" />
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
        <ChartPanel title="Sales by Weekday">
          <BarChartPanel data={report.sales.weekday} dataKey="revenue" nameKey="day" color="#19b5fe" />
        </ChartPanel>
        <ChartPanel title="Sales by Category">
          <BarChartPanel
            data={report.sales.byCategory.map((c) => ({
              category: c.category,
              revenue: c.revenue,
            }))}
            dataKey="revenue"
            nameKey="category"
            color="#10b981"
          />
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
        <ChartPanel title="Payment Methods">
          <DonutChartPanel
            data={report.sales.byPaymentMethod.map((p) => ({
              name: p.method,
              value: p.amount,
            }))}
          />
        </ChartPanel>
        <ChartPanel title="Sales by Branch" subtitle="Multi-branch ready">
          <DataTable
            headers={['Branch', 'Revenue', 'Transactions']}
            rows={report.sales.byBranch.map((b) => [
              b.branch,
              formatUgx(b.revenue),
              String(b.transactions),
            ])}
          />
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4">
        <StatTile
          label="Period vs Previous"
          value={`${report.sales.periodComparison.changePercent >= 0 ? '+' : ''}${report.sales.periodComparison.changePercent.toFixed(1)}%`}
          hint={`${formatUgx(report.sales.periodComparison.current)} vs ${formatUgx(report.sales.periodComparison.previous)}`}
          accent={report.sales.periodComparison.changePercent >= 0 ? 'positive' : 'negative'}
        />
        <StatTile
          label="Year over Year"
          value={`${report.sales.yoyComparison.changePercent >= 0 ? '+' : ''}${report.sales.yoyComparison.changePercent.toFixed(1)}%`}
          hint={`${formatUgx(report.sales.yoyComparison.current)} vs ${formatUgx(report.sales.yoyComparison.previous)}`}
          accent={report.sales.yoyComparison.changePercent >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <ChartPanel title="Returns & Refunds">
        <DataTable
          headers={['Metric', 'Value']}
          rows={[
            ['Refund count', String(report.kpis.refundCount.value)],
            ['Refund amount', formatUgx(report.kpis.refundAmount.value)],
          ]}
        />
      </ChartPanel>
    </div>
  );
}

function ProductsSection({ report, search }: { report: EnterpriseReport; search: string }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <ChartPanel title="Best Selling Products">
          <DataTable
            headers={['Product', 'Qty', 'Revenue']}
            rows={filterTableRows(
              report.products.bestSelling.map((p) => [
                p.name,
                String(p.quantity),
                formatUgx(p.revenue),
              ]),
              search
            )}
          />
        </ChartPanel>
        <ChartPanel title="Slow Moving Products">
          <DataTable
            headers={['Product', 'Qty', 'Revenue']}
            rows={filterTableRows(
              report.products.slowMoving.map((p) => [
                p.name,
                String(p.quantity),
                formatUgx(p.revenue),
              ]),
              search
            )}
          />
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <ChartPanel title="Highest Profit Products">
          <DataTable
            headers={['Product', 'Profit', 'Margin']}
            rows={report.products.highestProfit.map((p) => [
              p.name,
              formatUgx(p.profit),
              `${p.margin.toFixed(1)}%`,
            ])}
          />
        </ChartPanel>
        <ChartPanel title="Lowest Margin Products">
          <DataTable
            headers={['Product', 'Margin', 'Revenue']}
            rows={report.products.lowestMargin.map((p) => [
              p.name,
              `${p.margin.toFixed(1)}%`,
              formatUgx(p.revenue),
            ])}
          />
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <ChartPanel title="Non-Moving Inventory">
          <DataTable
            headers={['Product', 'Stock']}
            rows={report.products.nonMoving.map((p) => [p.name, String(p.stock)])}
          />
        </ChartPanel>
        <ChartPanel title="Reorder Alerts">
          <DataTable
            headers={['Product', 'Stock', 'Reorder Level']}
            rows={report.products.reorderAlerts.map((p) => [
              p.name,
              String(p.stock),
              String(p.reorderLevel),
            ])}
          />
        </ChartPanel>
      </div>

      <StatTile
        label="Inventory Turnover Rate"
        value={`${report.products.turnoverRate.toFixed(2)}x`}
        hint="Revenue ÷ inventory cost value"
        accent="brand"
      />
    </div>
  );
}

function InventorySection({ report }: { report: EnterpriseReport }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
        <StatTile label="Stock Inflow" value={`${report.inventory.inflow} units`} />
        <StatTile label="Stock Outflow" value={`${report.inventory.outflow} units`} />
        <StatTile
          label="Retail Value"
          value={formatUgx(report.kpis.inventoryRetailValue.value)}
          accent="brand"
        />
        <StatTile label="Cost Value" value={formatUgx(report.kpis.inventoryCostValue.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <ChartPanel title="Stock Adjustments">
          <DataTable
            headers={['Type', 'Count', 'Quantity']}
            rows={report.inventory.adjustments.map((a) => [
              a.type.replace(/_/g, ' '),
              String(a.count),
              String(a.quantity),
            ])}
          />
        </ChartPanel>
        <ChartPanel title="Dead Stock Analysis">
          <DataTable
            headers={['Product', 'Stock', 'Value']}
            rows={report.inventory.deadStock.map((p) => [
              p.name,
              String(p.stock),
              formatUgx(p.value),
            ])}
          />
        </ChartPanel>
      </div>

      <ChartPanel title="Fast Moving Inventory">
        <DataTable
          headers={['Product', 'Units Sold']}
          rows={report.inventory.fastMoving.map((p) => [p.name, String(p.quantity)])}
        />
      </ChartPanel>

      <ChartPanel title="Product Movement History" subtitle="Recent stock movements">
        <DataTable
          headers={['Date', 'Type', 'Product', 'Change']}
          rows={report.inventory.movementHistory.map((m) => [
            new Date(m.date).toLocaleString('en-UG', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            m.type.replace(/_/g, ' '),
            m.productName,
            m.quantityChange > 0 ? `+${m.quantityChange}` : String(m.quantityChange),
          ])}
        />
      </ChartPanel>
    </div>
  );
}

function CustomersSection({ report }: { report: EnterpriseReport }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
        <StatTile
          label="Returning Rate"
          value={`${report.customers.returningRate.toFixed(1)}%`}
          accent="brand"
        />
        <StatTile label="One-time Buyers" value={report.customers.purchaseFrequency.oneTime} />
        <StatTile label="Repeat Buyers" value={report.customers.purchaseFrequency.repeat} />
        <StatTile
          label="Loyal Customers"
          value={report.customers.purchaseFrequency.loyal}
          accent="positive"
        />
      </div>

      <ChartPanel title="New Customers Over Time">
        <RevenueLineChart
          data={report.customers.newCustomers.map((d) => ({
            date: d.date,
            revenue: d.count,
          }))}
        />
      </ChartPanel>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <ChartPanel title="Top Spending Customers">
          <DataTable
            headers={['Customer', 'Total Spent', 'Balance']}
            rows={report.customers.topSpenders.map((c) => [
              c.name,
              formatUgx(c.totalSpent),
              formatUgx(c.outstandingBalance),
            ])}
          />
        </ChartPanel>
        <ChartPanel title="Outstanding Balances">
          <DataTable
            headers={['Customer', 'Balance']}
            rows={report.customers.withBalances.map((c) => [
              c.name,
              formatUgx(c.outstandingBalance),
            ])}
          />
        </ChartPanel>
      </div>
    </div>
  );
}

function EmployeesSection({ report }: { report: EnterpriseReport }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <ChartPanel title="Sales per Employee" subtitle="POS cashier performance">
        <DataTable
          headers={['Employee', 'Revenue', 'Transactions', 'Avg Sale']}
          rows={report.employees.salesByEmployee.map((e) => [
            e.email,
            formatUgx(e.revenue),
            String(e.transactions),
            formatUgx(e.avgSale),
          ])}
        />
      </ChartPanel>

      <ChartPanel title="Field Sales Agents" subtitle="Products issued vs returned">
        <DataTable
          headers={['Agent', 'Revenue', 'Sold', 'Returned', 'Missing']}
          rows={report.employees.fieldAgents.map((a) => [
            a.name,
            formatUgx(a.revenue),
            String(a.unitsSold),
            String(a.unitsReturned),
            String(a.unitsMissing),
          ])}
        />
      </ChartPanel>
    </div>
  );
}

function FinancialSection({ report }: { report: EnterpriseReport }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-5">
        <StatTile
          label="Gross Margin"
          value={`${report.kpis.grossMargin.value.toFixed(1)}%`}
          accent="brand"
        />
        <StatTile label="Receivables" value={formatUgx(report.financial.receivables)} />
        <StatTile
          label="Payables"
          value={
            report.kpis.accountsPayable.available
              ? formatUgx(report.financial.payables)
              : '—'
          }
        />
        <StatTile
          label="Total Expenses"
          value={formatUgx(report.kpis.totalExpenses.value)}
          accent="negative"
        />
        <StatTile
          label="Net Profit"
          value={formatUgx(report.kpis.netProfit.value)}
          accent="positive"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
        <ChartPanel title="Revenue vs Expenses" subtitle="Revenue, profit, and expenses in selected period">
          <RevenueLineChart
            data={report.financial.revenueVsExpenses.map((d) => ({
              date: d.date,
              revenue: d.revenue,
              profit: d.profit,
              expenses: d.expenses,
            }))}
            showProfit
            showExpenses
          />
        </ChartPanel>
        <ChartPanel title="Profit Trend">
          <RevenueLineChart
            data={report.financial.profitTrend.map((d) => ({
              date: d.date,
              revenue: d.profit,
            }))}
          />
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
        <ChartPanel title="Payment Method Distribution">
          <DataTable
            headers={['Method', 'Amount', 'Share']}
            rows={report.financial.paymentDistribution.map((p) => [
              p.method,
              formatUgx(p.amount),
              `${p.percentage.toFixed(1)}%`,
            ])}
          />
        </ChartPanel>
        <ChartPanel title="Expenses by Category" subtitle="Selected period breakdown">
          <DataTable
            headers={['Category', 'Amount']}
            rows={report.financial.expensesByCategory.map((e) => [
              EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category,
              formatUgx(e.amount),
            ])}
          />
        </ChartPanel>
      </div>
    </div>
  );
}

function ReportMetaBanner({
  report,
  dataSource,
}: {
  report: EnterpriseReport;
  dataSource: 'api' | 'client';
}) {
  const rangeLabel = `${new Date(report.meta.start).toLocaleDateString('en-UG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} – ${new Date(report.meta.end).toLocaleDateString('en-UG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  return (
    <div className={`${reportsGlass.panelStatic} relative overflow-hidden px-4 py-3 sm:px-6 sm:py-4`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-premium-blue/10 via-cyan/5 to-transparent dark:from-cyan/20 dark:via-premium-blue/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 hidden h-px bg-gradient-to-r from-transparent via-cyan/50 to-transparent dark:block"
      />
      <div className="relative flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-premium-blue sm:text-[11px] dark:text-cyan dark:drop-shadow-[0_0_8px_rgba(25,181,254,0.4)]">
            Business Intelligence
          </p>
          <p className="mt-0.5 text-xs font-medium text-slate-700 sm:text-sm dark:text-slate-200">
            Showing {rangeLabel}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[11px] text-slate-400 sm:text-xs dark:text-slate-500">
            Generated{' '}
            {new Date(report.meta.generatedAt).toLocaleString('en-UG', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Source · {dataSource === 'api' ? 'Live API' : 'Local builder'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ReportsDashboard() {
  const [preset, setPreset] = useState<DatePreset>('last30');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState('');
  const [productId, setProductId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [channel, setChannel] = useState('');
  const [employee, setEmployee] = useState('');
  const [search, setSearch] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [activeSection, setActiveSection] = useState<ReportSection>('overview');
  const [favorites, setFavorites] = useState<ReportSection[]>(['overview', 'sales']);
  const [printHtml, setPrintHtml] = useState<string | null>(null);

  useEffect(() => {
    setPrintPreviewHandler((html) => setPrintHtml(html));
    return () => setPrintPreviewHandler(null);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ms-reports-dark');
      if (saved === '1') setDarkMode(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((d) => {
      const next = !d;
      try {
        localStorage.setItem('ms-reports-dark', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const filters = useMemo(
    () => ({
      preset,
      from: preset === 'custom' ? from : undefined,
      to: preset === 'custom' ? to : undefined,
      category: category || undefined,
      productId: productId || undefined,
      paymentMethod: paymentMethod || undefined,
      channel: channel || undefined,
      employee: employee || undefined,
    }),
    [preset, from, to, category, productId, paymentMethod, channel, employee]
  );

  const { report, isLoading, refresh, dataSource } = useEnterpriseReport(filters);

  const toggleFavorite = (section: ReportSection) => {
    setFavorites((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const clearFilters = () => {
    setCategory('');
    setProductId('');
    setPaymentMethod('');
    setChannel('');
    setEmployee('');
    setSearch('');
  };

  const sortedSections = useMemo(() => {
    const favs = SECTIONS.filter((s) => favorites.includes(s.id));
    const rest = SECTIONS.filter((s) => !favorites.includes(s.id));
    return [...favs, ...rest];
  }, [favorites]);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <PrintPreviewModal
        open={Boolean(printHtml)}
        html={printHtml ?? ''}
        onClose={() => setPrintHtml(null)}
      />
      <ReportsThemeProvider theme={darkMode ? 'dark' : 'light'}>
        <ReportsAtmosphere>
          <div className="dark:text-slate-100">
            <ReportsPageHeader
              title="Business Intelligence"
              subtitle={
                dataSource === 'client'
                  ? 'Enterprise reporting with offline-capable local builder — sales, inventory, finance, and operations.'
                  : 'Enterprise reporting hub for sales, inventory, finance, and operations.'
              }
            />

            <ReportsFilterBar
              preset={preset}
              from={from}
              to={to}
              category={category}
              productId={productId}
              paymentMethod={paymentMethod}
              channel={channel}
              employee={employee}
              search={search}
              darkMode={darkMode}
              isLoading={isLoading}
              filterOptions={report?.filterOptions ?? null}
              favorites={favorites}
              activeSection={activeSection}
              onPresetChange={setPreset}
              onFromChange={setFrom}
              onToChange={setTo}
              onCategoryChange={setCategory}
              onProductChange={setProductId}
              onPaymentMethodChange={setPaymentMethod}
              onChannelChange={setChannel}
              onEmployeeChange={setEmployee}
              onSearchChange={setSearch}
              onDarkModeToggle={toggleDarkMode}
              onRefresh={refresh}
              onToggleFavorite={toggleFavorite}
              onExportCsv={() => report && exportSalesCsv(report)}
              onPrint={() => report && printEnterpriseReport(report)}
              onClearFilters={clearFilters}
            />

            <div id="reports-print-area" className="mt-4 space-y-4 pb-24 sm:mt-6 sm:space-y-6 sm:pb-10">
              {report && !isLoading && (
                <ReportMetaBanner report={report} dataSource={dataSource} />
              )}

              <div className={`${reportsGlass.panelStatic} p-1`}>
                <div className="-mx-0.5 flex gap-1 overflow-x-auto px-0.5 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory touch-pan-x [&::-webkit-scrollbar]:hidden">
                  {sortedSections.map(({ id, label }) => {
                    const isActive = activeSection === id;
                    const isFav = favorites.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveSection(id)}
                        className={`inline-flex shrink-0 snap-start items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium touch-manipulation transition sm:px-4 ${
                          isActive ? reportsGlass.tabActive : reportsGlass.tabIdle
                        }`}
                      >
                        {label}
                        {isFav && (
                          <Star
                            size={12}
                            className={
                              isActive
                                ? 'fill-amber-400 text-amber-400'
                                : 'fill-amber-300/80 text-amber-300'
                            }
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <KpiSkeleton key={i} />
                  ))}
                </div>
              ) : !report ? (
                <div
                  className={`${reportsGlass.panelStatic} border-dashed px-4 py-16 text-center sm:py-20`}
                >
                  <p className="text-slate-500">Unable to load report data.</p>
                  <button
                    type="button"
                    onClick={refresh}
                    className={`${reportsGlass.btnPrimary} mt-4`}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  {activeSection === 'overview' && (
                    <OverviewSection report={report} search={search} />
                  )}
                  {activeSection === 'sales' && <SalesSection report={report} />}
                  {activeSection === 'products' && (
                    <ProductsSection report={report} search={search} />
                  )}
                  {activeSection === 'inventory' && <InventorySection report={report} />}
                  {activeSection === 'customers' && <CustomersSection report={report} />}
                  {activeSection === 'employees' && <EmployeesSection report={report} />}
                  {activeSection === 'financial' && <FinancialSection report={report} />}
                  {activeSection === 'insights' && (
                    <div className="space-y-3 sm:space-y-4">
                      <InsightsHero />
                      <BusinessInsightsPanel insights={report.insights} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </ReportsAtmosphere>
      </ReportsThemeProvider>
    </div>
  );
}
