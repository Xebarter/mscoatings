import {
  getFieldPicks,
  getOrders,
  getProducts,
  getStockMovements,
  listSales,
  getCustomers,
} from '@/lib/firestore';
import type { DatePreset } from '@/lib/reports/date-range';
import type { EnterpriseReport } from '@/lib/reports/types';
import {
  buildEnterpriseReportFromRawData,
  type ReportFilters,
} from '@/lib/reports/build-enterprise-report';

function asRaw<T extends { id: string }>(items: T[]) {
  return items.map((item) => ({
    id: item.id,
    data: item as unknown as Record<string, unknown>,
  }));
}

/** Build the full enterprise report from cached / live Firestore client data. */
export async function getEnterpriseReportClient(
  preset: DatePreset = 'last30',
  customFrom?: string,
  customTo?: string,
  filters: ReportFilters = {}
): Promise<EnterpriseReport> {
  const [products, orders, customers, sales, movements, fieldPicks] = await Promise.all([
    getProducts(),
    getOrders().catch(() => []),
    getCustomers().catch(() => []),
    listSales(1000).catch(() => []),
    getStockMovements(500).catch(() => []),
    getFieldPicks().catch(() => []),
  ]);

  return buildEnterpriseReportFromRawData(preset, customFrom, customTo, filters, {
    products: asRaw(products),
    orders: asRaw(orders),
    customers: asRaw(customers),
    sales: asRaw(sales),
    movements: asRaw(movements),
    fieldPicks: asRaw(fieldPicks),
  });
}
