import {
  getCustomers,
  getOrders,
  getProducts,
  getStockMovementsClient,
  listSalesClient,
} from '@/lib/firestore';
import { listFieldPicksClient } from '@/lib/field-sales-client';
import type { DatePreset } from '@/lib/reports/date-range';
import type { EnterpriseReport } from '@/lib/reports/types';
import {
  buildEnterpriseReportFromRawData,
  type ReportFilters,
} from '@/lib/reports/build-enterprise-report';

export async function getEnterpriseReportClient(
  preset: DatePreset = 'last30',
  customFrom?: string,
  customTo?: string,
  filters: ReportFilters = {}
): Promise<EnterpriseReport> {
  const [products, orders, customers, sales, movements, fieldPicks] = await Promise.all([
    getProducts(),
    getOrders(),
    getCustomers(),
    listSalesClient(1000),
    getStockMovementsClient({ limit: 500 }),
    listFieldPicksClient({ limit: 200 }),
  ]);

  return buildEnterpriseReportFromRawData(preset, customFrom, customTo, filters, {
    products: products.map((p) => ({ id: p.id, data: p as unknown as Record<string, unknown> })),
    orders: orders.map((o) => ({ id: o.id, data: o as unknown as Record<string, unknown> })),
    customers: customers.map((c) => ({ id: c.id, data: c as unknown as Record<string, unknown> })),
    sales: sales.map((s) => ({ id: s.id, data: s as unknown as Record<string, unknown> })),
    movements: movements.map((m) => ({ id: m.id, data: m as unknown as Record<string, unknown> })),
    fieldPicks: fieldPicks.map((p) => ({ id: p.id, data: p as unknown as Record<string, unknown> })),
  });
}
