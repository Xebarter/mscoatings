import { BRAND_ASSETS, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { formatUgx } from '@/lib/currency';
import { DATE_PRESET_LABELS, type DatePreset } from '@/lib/reports/date-range';
import type { EnterpriseReport, KpiMetric } from '@/lib/reports/types';
import { BUSINESS_INFO, BUSINESS_PHONES } from '@/lib/business';
import { API_BASE } from '@/lib/admin-api';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-UG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatKpi(metric: KpiMetric, format: 'currency' | 'number' | 'percent' = 'currency'): string {
  if (!metric.available) return '—';
  if (format === 'percent') return `${metric.value.toFixed(1)}%`;
  if (format === 'number') return metric.value.toLocaleString('en-UG');
  return formatUgx(metric.value);
}

function changeBadge(changePercent?: number): string {
  if (changePercent === undefined) return '';
  const positive = changePercent >= 0;
  const cls = positive ? 'delta-up' : 'delta-down';
  const sign = positive ? '+' : '';
  return `<span class="delta ${cls}">${sign}${changePercent.toFixed(1)}%</span>`;
}

function kpiCard(
  label: string,
  metric: KpiMetric,
  format: 'currency' | 'number' | 'percent' = 'currency',
  accent = 'blue'
): string {
  return `
    <div class="kpi accent-${escapeHtml(accent)}">
      <p class="kpi-label">${escapeHtml(label)}</p>
      <p class="kpi-value">${escapeHtml(formatKpi(metric, format))}</p>
      ${changeBadge(metric.changePercent)}
    </div>
  `;
}

function sectionTitle(title: string, subtitle?: string): string {
  return `
    <div class="section-head">
      <div class="section-bar"></div>
      <div>
        <h2>${escapeHtml(title)}</h2>
        ${subtitle ? `<p class="section-sub">${escapeHtml(subtitle)}</p>` : ''}
      </div>
    </div>
  `;
}

function table(headers: string[], rows: string[][], empty = 'No data for this period'): string {
  if (rows.length === 0) {
    return `<p class="empty">${escapeHtml(empty)}</p>`;
  }
  return `
    <table>
      <thead>
        <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell, i) => `<td class="${i === 0 ? 'cell-primary' : ''}">${escapeHtml(cell)}</td>`)
                .join('')}</tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function insightCard(type: string, title: string, description: string, metric?: string, action?: string): string {
  return `
    <div class="insight insight-${escapeHtml(type)}">
      <div class="insight-top">
        <strong>${escapeHtml(title)}</strong>
        ${metric ? `<span class="insight-metric">${escapeHtml(metric)}</span>` : ''}
      </div>
      <p>${escapeHtml(description)}</p>
      ${action ? `<p class="insight-action">${escapeHtml(action)}</p>` : ''}
    </div>
  `;
}

/** Simple SVG area chart for print (no runtime deps) */
function trendSparkSvg(
  points: Array<{ revenue: number; profit?: number }>,
  width = 520,
  height = 140
): string {
  if (points.length < 2) return '<p class="empty">Insufficient trend data</p>';

  const revenues = points.map((p) => p.revenue);
  const profits = points.map((p) => p.profit ?? 0);
  const max = Math.max(...revenues, ...profits, 1);
  const min = Math.min(...revenues, ...profits, 0);
  const range = max - min || 1;
  const padX = 8;
  const padY = 12;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const toPoints = (values: number[]) =>
    values
      .map((v, i) => {
        const x = padX + (i / (values.length - 1)) * innerW;
        const y = padY + innerH - ((v - min) / range) * innerH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const areaPath = (() => {
    const pts = revenues.map((v, i) => {
      const x = padX + (i / (revenues.length - 1)) * innerW;
      const y = padY + innerH - ((v - min) / range) * innerH;
      return { x, y };
    });
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1]!;
    const first = pts[0]!;
    return `${line} L${last.x.toFixed(1)},${(padY + innerH).toFixed(1)} L${first.x.toFixed(1)},${(padY + innerH).toFixed(1)} Z`;
  })();

  return `
    <svg class="trend-chart" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Revenue trend">
      <defs>
        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0077c8" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#19b5fe" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#revFill)"/>
      <polyline fill="none" stroke="#0077c8" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${toPoints(revenues)}"/>
      ${
        profits.some((p) => p !== 0)
          ? `<polyline fill="none" stroke="#10b981" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round" points="${toPoints(profits)}"/>`
          : ''
      }
    </svg>
    <div class="chart-legend">
      <span><i class="swatch blue"></i> Revenue</span>
      <span><i class="swatch green"></i> Profit</span>
    </div>
  `;
}

function barRow(label: string, value: number, max: number, color = '#0077c8'): string {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="bar-value">${escapeHtml(formatUgx(value))}</div>
    </div>
  `;
}

const PRINT_STYLES = `
  @page {
    size: A4;
    margin: 14mm 12mm 16mm;
  }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    color: #0f172a;
    background: #ffffff;
    font-family: "Segoe UI", "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
    font-size: 11px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  .doc {
    width: 100%;
    max-width: 190mm;
    margin: 0 auto;
  }

  .masthead {
    display: flex;
    align-items: stretch;
    gap: 0;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid #dbe7f3;
    margin-bottom: 18px;
    background: linear-gradient(135deg, #0b1628 0%, #0f2744 48%, #075985 100%);
    color: #fff;
  }

  .masthead-accent {
    width: 7px;
    background: linear-gradient(180deg, #0077c8 0%, #19b5fe 40%, #e53935 72%, #f57c00 100%);
  }

  .masthead-body {
    flex: 1;
    display: flex;
    justify-content: space-between;
    gap: 20px;
    padding: 18px 20px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .brand img {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background: #fff;
    object-fit: contain;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  }

  .brand-name {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .brand-tag {
    margin: 2px 0 0;
    font-size: 10px;
    color: #bae6fd;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .masthead-meta {
    text-align: right;
    min-width: 180px;
  }

  .doc-title {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: #fff;
  }

  .doc-range {
    margin: 4px 0 0;
    font-size: 11px;
    color: #e0f2fe;
  }

  .doc-generated {
    margin: 8px 0 0;
    font-size: 9px;
    color: #94a3b8;
  }

  .badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 16px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    padding: 5px 11px;
    font-size: 10px;
    font-weight: 600;
    border: 1px solid #cfe4f7;
    background: #f0f9ff;
    color: #0369a1;
  }

  .badge strong { font-weight: 700; color: #0f172a; }

  .badge-confidential {
    background: #fff7ed;
    border-color: #fed7aa;
    color: #c2410c;
  }

  .section {
    margin-bottom: 18px;
    page-break-inside: avoid;
  }

  .section-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
  }

  .section-bar {
    width: 4px;
    height: 22px;
    border-radius: 999px;
    background: linear-gradient(180deg, #0077c8, #19b5fe);
  }

  .section-head h2 {
    margin: 0;
    font-size: 13px;
    font-weight: 750;
    letter-spacing: -0.01em;
    color: #0f172a;
  }

  .section-sub {
    margin: 1px 0 0;
    font-size: 10px;
    color: #64748b;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }

  .kpi-grid.dense {
    grid-template-columns: repeat(4, 1fr);
  }

  .kpi {
    position: relative;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 12px 12px 12px 14px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    overflow: hidden;
  }

  .kpi::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
  }

  .accent-blue::before { background: #0077c8; }
  .accent-cyan::before { background: #19b5fe; }
  .accent-green::before { background: #10b981; }
  .accent-orange::before { background: #f57c00; }
  .accent-red::before { background: #e53935; }
  .accent-navy::before { background: #0f172a; }

  .kpi-label {
    margin: 0;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
  }

  .kpi-value {
    margin: 6px 0 0;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #0f172a;
    word-break: break-word;
  }

  .delta {
    display: inline-block;
    margin-top: 6px;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 700;
  }

  .delta-up { background: #ecfdf5; color: #047857; }
  .delta-down { background: #fef2f2; color: #b91c1c; }

  .two-col {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 14px;
  }

  .panel {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 12px;
    background: #fff;
  }

  .panel-title {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 700;
    color: #0f172a;
  }

  .stat-inline {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 10px;
  }

  .stat-box {
    border-radius: 10px;
    padding: 10px 12px;
    border: 1px solid #dbeafe;
    background: linear-gradient(135deg, #eff6ff, #f0f9ff);
  }

  .stat-box.green {
    border-color: #bbf7d0;
    background: linear-gradient(135deg, #ecfdf5, #f0fdf4);
  }

  .stat-box .label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
  }

  .stat-box .value {
    margin-top: 4px;
    font-size: 18px;
    font-weight: 800;
    color: #0369a1;
  }

  .stat-box.green .value { color: #047857; }

  .stat-box .hint {
    margin-top: 2px;
    font-size: 9px;
    color: #94a3b8;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }

  thead th {
    background: linear-gradient(180deg, #0f172a, #1e293b);
    color: #fff;
    text-align: left;
    padding: 8px 9px;
    font-size: 9px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 700;
  }

  thead th:first-child { border-radius: 8px 0 0 0; }
  thead th:last-child { border-radius: 0 8px 0 0; }

  tbody td {
    padding: 7px 9px;
    border-bottom: 1px solid #eef2f7;
    color: #334155;
    vertical-align: top;
  }

  tbody tr:nth-child(even) td { background: #f8fafc; }

  .cell-primary {
    font-weight: 650;
    color: #0f172a;
  }

  .empty {
    margin: 8px 0;
    color: #94a3b8;
    font-style: italic;
  }

  .bar-row {
    display: grid;
    grid-template-columns: 90px 1fr 88px;
    gap: 8px;
    align-items: center;
    margin-bottom: 7px;
  }

  .bar-label {
    font-size: 10px;
    font-weight: 600;
    color: #334155;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar-track {
    height: 9px;
    border-radius: 999px;
    background: #e2e8f0;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 999px;
  }

  .bar-value {
    font-size: 9px;
    font-weight: 700;
    text-align: right;
    color: #0f172a;
  }

  .chart-legend {
    display: flex;
    gap: 14px;
    margin-top: 4px;
    font-size: 9px;
    color: #64748b;
  }

  .chart-legend .swatch {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    margin-right: 5px;
    vertical-align: -1px;
  }

  .swatch.blue { background: #0077c8; }
  .swatch.green { background: #10b981; }

  .insights-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .insight {
    border-radius: 11px;
    padding: 11px 12px;
    border: 1px solid #e2e8f0;
  }

  .insight-success { background: #ecfdf5; border-color: #a7f3d0; }
  .insight-warning { background: #fffbeb; border-color: #fde68a; }
  .insight-danger { background: #fef2f2; border-color: #fecaca; }
  .insight-info { background: #eff6ff; border-color: #bfdbfe; }

  .insight-top {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  .insight-top strong { font-size: 11px; color: #0f172a; }
  .insight-metric {
    font-size: 10px;
    font-weight: 800;
    color: #0369a1;
    white-space: nowrap;
  }

  .insight p {
    margin: 0;
    font-size: 10px;
    color: #475569;
  }

  .insight-action {
    margin-top: 6px !important;
    font-weight: 700 !important;
    color: #0f172a !important;
  }

  .footer {
    margin-top: 22px;
    padding-top: 12px;
    border-top: 2px solid #0f172a;
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-end;
  }

  .footer-brand {
    font-size: 10px;
    color: #64748b;
  }

  .footer-brand strong {
    display: block;
    color: #0f172a;
    font-size: 11px;
    margin-bottom: 2px;
  }

  .footer-contact {
    text-align: right;
    font-size: 9px;
    color: #64748b;
  }

  .footer-mark {
    margin-top: 10px;
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(90deg, #0077c8 0%, #19b5fe 35%, #e53935 70%, #f57c00 100%);
  }

  @media print {
    .section { break-inside: avoid; }
    thead { display: table-header-group; }
  }
`;

export function buildEnterpriseReportPrintDocument(
  report: EnterpriseReport,
  options?: { logoUrl?: string }
): string {
  const { meta, kpis } = report;
  const logoUrl =
    options?.logoUrl ??
    `${API_BASE}${BRAND_ASSETS.logoLarge}`;

  const presetLabel =
    DATE_PRESET_LABELS[meta.preset as DatePreset] ?? meta.preset.replace(/_/g, ' ');

  const channelMax = Math.max(...report.sales.byChannel.map((c) => c.revenue), 1);
  const paymentMax = Math.max(...report.sales.byPaymentMethod.map((p) => p.amount), 1);
  const channelColors = ['#0077c8', '#19b5fe', '#10b981', '#f57c00', '#e53935'];

  const filterChips = [
    meta.filters.category && `Category: ${meta.filters.category}`,
    meta.filters.channel && `Channel: ${meta.filters.channel}`,
    meta.filters.paymentMethod && `Payment: ${meta.filters.paymentMethod.replace(/_/g, ' ')}`,
    meta.filters.employee && `Employee: ${meta.filters.employee}`,
  ].filter(Boolean) as string[];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(BRAND_NAME)} — Business Intelligence Report</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="doc">
    <header class="masthead">
      <div class="masthead-accent"></div>
      <div class="masthead-body">
        <div class="brand">
          <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(BRAND_NAME)}" />
          <div>
            <p class="brand-name">${escapeHtml(BRAND_NAME)}</p>
            <p class="brand-tag">${escapeHtml(BRAND_TAGLINE)}</p>
          </div>
        </div>
        <div class="masthead-meta">
          <p class="doc-title">Business Intelligence Report</p>
          <p class="doc-range">${escapeHtml(formatDate(meta.start))} — ${escapeHtml(formatDate(meta.end))}</p>
          <p class="doc-generated">Generated ${escapeHtml(formatDateTime(meta.generatedAt))}</p>
        </div>
      </div>
    </header>

    <div class="badge-row">
      <span class="badge"><strong>Period</strong> ${escapeHtml(presetLabel)}</span>
      <span class="badge"><strong>Branch</strong> ${escapeHtml(meta.branch || 'All branches')}</span>
      <span class="badge badge-confidential">Confidential — Internal use</span>
      ${filterChips.map((c) => `<span class="badge">${escapeHtml(c)}</span>`).join('')}
    </div>

    <section class="section">
      ${sectionTitle('Executive Snapshot', 'Key performance indicators for the selected period')}
      <div class="kpi-grid">
        ${kpiCard('Total Revenue', kpis.revenue, 'currency', 'blue')}
        ${kpiCard('Gross Profit', kpis.grossProfit, 'currency', 'green')}
        ${kpiCard('Transactions', kpis.transactions, 'number', 'cyan')}
        ${kpiCard('Avg Order Value', kpis.averageOrderValue, 'currency', 'navy')}
      </div>
      <div class="kpi-grid dense" style="margin-top:10px">
        ${kpiCard('Gross Margin', kpis.grossMargin, 'percent', 'green')}
        ${kpiCard('Net Margin', kpis.netMargin, 'percent', 'cyan')}
        ${kpiCard('Active Customers', kpis.activeCustomers, 'number', 'blue')}
        ${kpiCard('Outstanding', kpis.outstandingBalances, 'currency', 'orange')}
      </div>
      <div class="kpi-grid dense" style="margin-top:10px">
        ${kpiCard('Inventory Retail', kpis.inventoryRetailValue, 'currency', 'navy')}
        ${kpiCard('Inventory Cost', kpis.inventoryCostValue, 'currency', 'blue')}
        ${kpiCard('Low Stock', kpis.lowStockItems, 'number', 'orange')}
        ${kpiCard('Refunds', kpis.refundAmount, 'currency', 'red')}
      </div>
    </section>

    <section class="section">
      ${sectionTitle('Sales Performance', 'Revenue trajectory, comparisons, and channel mix')}
      <div class="two-col">
        <div class="panel">
          <p class="panel-title">Revenue & profit trend</p>
          ${trendSparkSvg(report.sales.dailyTrend)}
        </div>
        <div>
          <div class="stat-inline">
            <div class="stat-box">
              <div class="label">vs Previous period</div>
              <div class="value">${report.sales.periodComparison.changePercent >= 0 ? '+' : ''}${report.sales.periodComparison.changePercent.toFixed(1)}%</div>
              <div class="hint">${escapeHtml(formatUgx(report.sales.periodComparison.current))} vs ${escapeHtml(formatUgx(report.sales.periodComparison.previous))}</div>
            </div>
            <div class="stat-box green">
              <div class="label">Year over year</div>
              <div class="value">${report.sales.yoyComparison.changePercent >= 0 ? '+' : ''}${report.sales.yoyComparison.changePercent.toFixed(1)}%</div>
              <div class="hint">${escapeHtml(formatUgx(report.sales.yoyComparison.current))} vs ${escapeHtml(formatUgx(report.sales.yoyComparison.previous))}</div>
            </div>
          </div>
          <div class="panel">
            <p class="panel-title">Sales by channel</p>
            ${report.sales.byChannel
              .map((c, i) =>
                barRow(c.channel, c.revenue, channelMax, channelColors[i % channelColors.length])
              )
              .join('') || '<p class="empty">No channel data</p>'}
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      ${sectionTitle('Top Products', 'Best performers by revenue in this period')}
      ${table(
        ['Product', 'Qty', 'Revenue', 'Profit', 'Margin'],
        report.sales.byProduct.slice(0, 12).map((p) => [
          p.name,
          String(p.quantity),
          formatUgx(p.revenue),
          formatUgx(p.profit),
          `${p.margin.toFixed(1)}%`,
        ])
      )}
    </section>

    <section class="section">
      ${sectionTitle('Payments & Liquidity', 'How customers paid and where cash sits')}
      <div class="two-col">
        <div class="panel">
          <p class="panel-title">Payment methods</p>
          ${report.sales.byPaymentMethod
            .map((p, i) =>
              barRow(
                p.method.replace(/_/g, ' '),
                p.amount,
                paymentMax,
                channelColors[i % channelColors.length]
              )
            )
            .join('') || '<p class="empty">No payment data</p>'}
        </div>
        <div class="kpi-grid" style="grid-template-columns:1fr 1fr; gap:10px">
          ${kpiCard('Cash on Hand', kpis.cashOnHand, 'currency', 'green')}
          ${kpiCard('Mobile Money', kpis.mobileMoneyBalance, 'currency', 'cyan')}
          ${kpiCard('Bank Balances', kpis.bankBalance, 'currency', 'blue')}
          ${kpiCard('Receivables', kpis.accountsReceivable, 'currency', 'orange')}
        </div>
      </div>
    </section>

    <section class="section">
      ${sectionTitle('Inventory & Product Health')}
      <div class="two-col">
        <div>
          <p class="panel-title" style="margin-bottom:8px">Reorder alerts</p>
          ${table(
            ['Product', 'Stock', 'Reorder'],
            report.products.reorderAlerts.slice(0, 8).map((p) => [
              p.name,
              String(p.stock),
              String(p.reorderLevel),
            ]),
            'No reorder alerts'
          )}
        </div>
        <div>
          <p class="panel-title" style="margin-bottom:8px">Slow movers</p>
          ${table(
            ['Product', 'Qty', 'Revenue'],
            report.products.slowMoving.slice(0, 8).map((p) => [
              p.name,
              String(p.quantity),
              formatUgx(p.revenue),
            ]),
            'No slow-moving products'
          )}
          <div class="stat-box" style="margin-top:10px">
            <div class="label">Inventory turnover</div>
            <div class="value">${report.products.turnoverRate.toFixed(2)}x</div>
            <div class="hint">Revenue ÷ inventory cost value</div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      ${sectionTitle('Customers & Team')}
      <div class="two-col">
        <div>
          <p class="panel-title" style="margin-bottom:8px">Top spending customers</p>
          ${table(
            ['Customer', 'Spent', 'Balance'],
            report.customers.topSpenders.slice(0, 8).map((c) => [
              c.name,
              formatUgx(c.totalSpent),
              formatUgx(c.outstandingBalance),
            ]),
            'No customer spend data'
          )}
        </div>
        <div>
          <p class="panel-title" style="margin-bottom:8px">Sales by employee</p>
          ${table(
            ['Employee', 'Revenue', 'Txns'],
            report.employees.salesByEmployee.slice(0, 8).map((e) => [
              e.email,
              formatUgx(e.revenue),
              String(e.transactions),
            ]),
            'No employee sales data'
          )}
        </div>
      </div>
    </section>

    ${
      report.insights.length > 0
        ? `<section class="section">
            ${sectionTitle('Business Insights', 'Actionable signals from this reporting window')}
            <div class="insights-grid">
              ${report.insights
                .slice(0, 6)
                .map((i) => insightCard(i.type, i.title, i.description, i.metric, i.action))
                .join('')}
            </div>
          </section>`
        : ''
    }

    <footer class="footer">
      <div class="footer-brand">
        <strong>${escapeHtml(BRAND_NAME)} ERP</strong>
        Business Intelligence export · ${escapeHtml(presetLabel)} · ${escapeHtml(meta.branch || 'All branches')}
      </div>
      <div class="footer-contact">
        ${escapeHtml(BUSINESS_INFO.address.addressLocality)}, Uganda<br/>
        ${escapeHtml(BUSINESS_PHONES.map((p) => p.display).join(' · '))}<br/>
        ${escapeHtml(BUSINESS_INFO.email)}
      </div>
    </footer>
    <div class="footer-mark"></div>
  </div>
</body>
</html>`;
}
