import {
  getComparisonRange,
  getDateRange,
  getYearOverYearRange,
  type DatePreset,
} from '@/lib/reports/date-range';
import {
  buildEnterpriseReportFromRawData,
  type ReportFilters,
} from '@/lib/reports/build-enterprise-report';
import type { EnterpriseReport } from '@/lib/reports/types';
import { getAdminFirestore, getAdminTimestamp } from '@/lib/firebase-admin';

export type { ReportFilters, EnterpriseRawData } from '@/lib/reports/build-enterprise-report';
export { buildEnterpriseReportFromRawData, generateInsights } from '@/lib/reports/build-enterprise-report';

export async function getEnterpriseReport(
  preset: DatePreset = 'last30',
  customFrom?: string,
  customTo?: string,
  filters: ReportFilters = {}
): Promise<EnterpriseReport> {
  const db = getAdminFirestore();
  const Timestamp = getAdminTimestamp();
  const range = getDateRange(preset, customFrom, customTo);
  const comparisonRange = getComparisonRange(range);
  const yoyRange = getYearOverYearRange(range);

  const fetchStart = new Date(
    Math.min(range.start.getTime(), yoyRange.start.getTime(), comparisonRange.start.getTime())
  );
  fetchStart.setHours(0, 0, 0, 0);
  const startTs = Timestamp.fromDate(fetchStart);
  const endTs = Timestamp.fromDate(range.end);

  const [
    salesSnap,
    ordersSnap,
    productsSnap,
    customersSnap,
    movementsSnap,
    fieldPicksSnap,
    expensesSnap,
  ] = await Promise.all([
    db.collection('sales').where('createdAt', '>=', startTs).where('createdAt', '<=', endTs).get(),
    db.collection('orders').where('createdAt', '>=', startTs).where('createdAt', '<=', endTs).get(),
    db.collection('products').get(),
    db.collection('customers').get(),
    db
      .collection('stockMovements')
      .where('createdAt', '>=', startTs)
      .where('createdAt', '<=', endTs)
      .get(),
    db.collection('fieldPicks').get(),
    db.collection('expenses').where('date', '>=', startTs).where('date', '<=', endTs).get(),
  ]);

  return buildEnterpriseReportFromRawData(preset, customFrom, customTo, filters, {
    sales: salesSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
    orders: ordersSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
    products: productsSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
    customers: customersSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
    movements: movementsSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
    fieldPicks: fieldPicksSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
    expenses: expensesSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
  });
}
