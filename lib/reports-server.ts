import type { SalePaymentMethod } from '@/lib/erp-types';
import { getAdminFirestore, getAdminTimestamp } from '@/lib/firebase-admin';

export interface ReportSummary {
  period: { start: string; end: string };
  totalRevenue: number;
  totalProfit: number;
  transactionCount: number;
  averageTransaction: number;
  stockValuation: number;
  lowStockCount: number;
  outstandingBalances: number;
  paymentMethodBreakdown: Record<string, number>;
  salesByStaff: Array<{ email: string; total: number; count: number }>;
  bestSellingProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  dailyRevenue: Array<{ date: string; revenue: number; profit: number }>;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getPeriodRange(period: 'day' | 'week' | 'month'): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  if (period === 'week') {
    start.setDate(start.getDate() - 6);
  } else if (period === 'month') {
    start.setDate(start.getDate() - 29);
  }

  return { start, end };
}

export async function getReportSummary(
  period: 'day' | 'week' | 'month' = 'month'
): Promise<ReportSummary> {
  const db = getAdminFirestore();
  const Timestamp = getAdminTimestamp();
  const { start, end } = getPeriodRange(period);
  const startTs = Timestamp.fromDate(start);
  const endTs = Timestamp.fromDate(end);

  const [salesSnap, ordersSnap, productsSnap, customersSnap] = await Promise.all([
    db
      .collection('sales')
      .where('createdAt', '>=', startTs)
      .where('createdAt', '<=', endTs)
      .get(),
    db
      .collection('orders')
      .where('createdAt', '>=', startTs)
      .where('createdAt', '<=', endTs)
      .get(),
    db.collection('products').get(),
    db.collection('customers').get(),
  ]);

  const completedSales = salesSnap.docs
    .map((doc) => doc.data())
    .filter((sale) => sale.status === 'completed');

  const paidOrders = ordersSnap.docs
    .map((doc) => doc.data())
    .filter((order) => order.paymentStatus === 'paid');

  let totalRevenue = 0;
  let totalProfit = 0;
  const paymentMethodBreakdown: Record<string, number> = {};
  const staffMap = new Map<string, { total: number; count: number }>();
  const productMap = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >();
  const dailyMap = new Map<string, { revenue: number; profit: number }>();

  const processTransaction = (
    items: Array<{
      productId?: string;
      productName?: string;
      name?: string;
      quantity: number;
      price?: number;
      unitPrice?: number;
      costPrice?: number;
      lineTotal?: number;
    }>,
    amount: number,
    paymentMethod: string,
    staffEmail?: string,
    createdAt?: FirebaseFirestore.Timestamp
  ) => {
    totalRevenue += amount;

    if (createdAt) {
      const dateKey = toDateKey(createdAt.toDate());
      const existing = dailyMap.get(dateKey) ?? { revenue: 0, profit: 0 };
      existing.revenue += amount;
      dailyMap.set(dateKey, existing);
    }

    paymentMethodBreakdown[paymentMethod] =
      (paymentMethodBreakdown[paymentMethod] ?? 0) + amount;

    if (staffEmail) {
      const staff = staffMap.get(staffEmail) ?? { total: 0, count: 0 };
      staff.total += amount;
      staff.count += 1;
      staffMap.set(staffEmail, staff);
    }

    for (const item of items) {
      const productId = item.productId ?? 'unknown';
      const name = item.name ?? item.productName ?? 'Unknown';
      const qty = item.quantity;
      const unitPrice = item.unitPrice ?? item.price ?? 0;
      const costPrice = item.costPrice ?? 0;
      const revenue = item.lineTotal ?? unitPrice * qty;
      const profit = (unitPrice - costPrice) * qty;

      totalProfit += profit;

      if (createdAt) {
        const dateKey = toDateKey(createdAt.toDate());
        const existing = dailyMap.get(dateKey) ?? { revenue: 0, profit: 0 };
        existing.profit += profit;
        dailyMap.set(dateKey, existing);
      }

      const existing = productMap.get(productId) ?? {
        name,
        quantity: 0,
        revenue: 0,
      };
      existing.quantity += qty;
      existing.revenue += revenue;
      productMap.set(productId, existing);
    }
  };

  for (const sale of completedSales) {
    processTransaction(
      sale.items ?? [],
      sale.totalAmount ?? 0,
      sale.paymentMethod ?? 'cash',
      sale.cashierEmail,
      sale.createdAt
    );
  }

  for (const order of paidOrders) {
    processTransaction(
      order.items ?? [],
      order.totalPrice ?? 0,
      order.paymentMethod ?? 'online',
      undefined,
      order.createdAt
    );
  }

  let stockValuation = 0;
  let lowStockCount = 0;

  productsSnap.docs.forEach((doc) => {
    const product = doc.data();
    const stock = product.stock ?? 0;
    const costPrice = product.costPrice ?? 0;
    const reorderLevel = product.reorderLevel ?? 5;
    stockValuation += stock * costPrice;
    if (stock <= reorderLevel) {
      lowStockCount += 1;
    }
  });

  let outstandingBalances = 0;
  customersSnap.docs.forEach((doc) => {
    outstandingBalances += doc.data().outstandingBalance ?? 0;
  });

  const transactionCount = completedSales.length + paidOrders.length;

  const dailyRevenue = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const bestSellingProducts = Array.from(productMap.entries())
    .map(([productId, data]) => ({ productId, ...data }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const salesByStaff = Array.from(staffMap.entries())
    .map(([email, data]) => ({ email, ...data }))
    .sort((a, b) => b.total - a.total);

  return {
    period: { start: start.toISOString(), end: end.toISOString() },
    totalRevenue,
    totalProfit,
    transactionCount,
    averageTransaction:
      transactionCount > 0 ? totalRevenue / transactionCount : 0,
    stockValuation,
    lowStockCount,
    outstandingBalances,
    paymentMethodBreakdown,
    salesByStaff,
    bestSellingProducts,
    dailyRevenue,
  };
}

export async function getTodayOverview() {
  return getReportSummary('day');
}
