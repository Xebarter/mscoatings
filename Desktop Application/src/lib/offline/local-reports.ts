import { listSales, getProducts } from '../firestore';
import { isOnline } from './connectivity';
import { localGet, localSet } from './local-store';
import type { Sale, Product } from '../types';

export interface LocalReportSummary {
  totalRevenue: number;
  totalSales: number;
  averageOrderValue: number;
  totalProductsSold: number;
  lowStockCount: number;
  pendingOrders: number;
}

export interface LocalReportData {
  summary: LocalReportSummary;
  revenueByDay: Array<{ date: string; revenue: number; sales: number }>;
  topProducts: Array<{ name: string; revenue: number; quantity: number }>;
  source: 'live' | 'offline';
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function presetRange(preset: string): { from: Date; to: Date } {
  const to = new Date();
  const from = startOfDay(new Date());
  switch (preset) {
    case 'today':
      break;
    case 'week':
      from.setDate(from.getDate() - 6);
      break;
    case 'month':
      from.setDate(1);
      break;
    case 'quarter':
      from.setMonth(from.getMonth() - 2);
      from.setDate(1);
      break;
    default:
      from.setDate(from.getDate() - 6);
  }
  return { from, to };
}

function saleTime(sale: Sale): number {
  try {
    return sale.createdAt.toMillis();
  } catch {
    return 0;
  }
}

export async function buildLocalReport(preset: string): Promise<LocalReportData> {
  const cacheKey = `report:${preset}`;
  const cached = await localGet<{ data: LocalReportData; savedAt: number }>('reportCache');

  let sales: Sale[] = [];
  let products: Product[] = [];

  try {
    [sales, products] = await Promise.all([listSales(500), getProducts()]);
  } catch {
    if (cached?.data) return { ...cached.data, source: 'offline' };
    throw new Error('No offline report data available');
  }

  const { from, to } = presetRange(preset);
  const fromMs = from.getTime();
  const toMs = to.getTime();

  const filtered = sales.filter((s) => {
    if (s.status === 'cancelled') return false;
    const t = saleTime(s);
    return t >= fromMs && t <= toMs;
  });

  const totalRevenue = filtered.reduce((sum, s) => sum + (s.totalAmount ?? 0), 0);
  const totalSales = filtered.length;
  const totalProductsSold = filtered.reduce(
    (sum, s) => sum + s.items.reduce((n, i) => n + i.quantity, 0),
    0
  );

  const dayMap = new Map<string, { revenue: number; sales: number }>();
  for (const sale of filtered) {
    const d = new Date(saleTime(sale));
    const key = d.toLocaleDateString('en-UG', { month: 'short', day: 'numeric' });
    const existing = dayMap.get(key) ?? { revenue: 0, sales: 0 };
    existing.revenue += sale.totalAmount ?? 0;
    existing.sales += 1;
    dayMap.set(key, existing);
  }

  const productMap = new Map<string, { name: string; revenue: number; quantity: number }>();
  for (const sale of filtered) {
    for (const item of sale.items) {
      const existing = productMap.get(item.productId) ?? {
        name: item.name,
        revenue: 0,
        quantity: 0,
      };
      existing.revenue += item.lineTotal;
      existing.quantity += item.quantity;
      productMap.set(item.productId, existing);
    }
  }

  const data: LocalReportData = {
    summary: {
      totalRevenue,
      totalSales,
      averageOrderValue: totalSales > 0 ? totalRevenue / totalSales : 0,
      totalProductsSold,
      lowStockCount: products.filter((p) => p.stock <= (p.reorderLevel ?? 5)).length,
      pendingOrders: 0,
    },
    revenueByDay: Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v })),
    topProducts: Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10),
    source: isOnline() ? 'live' : 'offline',
  };

  await localSet('reportCache', { data, savedAt: Date.now(), key: cacheKey });
  return data;
}

export async function buildDaySummary(): Promise<LocalReportSummary> {
  const report = await buildLocalReport('today');
  return report.summary;
}
