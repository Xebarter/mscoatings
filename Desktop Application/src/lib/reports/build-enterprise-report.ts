import type { BusinessInsight, EnterpriseReport, KpiMetric } from '@/lib/reports/types';
import {
  getComparisonRange,
  getDateRange,
  getYearOverYearRange,
  type DatePreset,
  type DateRange,
} from '@/lib/reports/date-range';

export interface ReportFilters {
  category?: string;
  productId?: string;
  paymentMethod?: string;
  channel?: string;
  employee?: string;
}

export interface EnterpriseRawData {
  sales: Array<{ id: string; data: Record<string, unknown> }>;
  orders: Array<{ id: string; data: Record<string, unknown> }>;
  products: Array<{ id: string; data: Record<string, unknown> }>;
  customers: Array<{ id: string; data: Record<string, unknown> }>;
  movements: Array<{ id: string; data: Record<string, unknown> }>;
  fieldPicks: Array<{ id: string; data: Record<string, unknown> }>;
  expenses: Array<{ id: string; data: Record<string, unknown> }>;
}

interface TransactionItem {
  productId?: string;
  productName?: string;
  name?: string;
  quantity: number;
  price?: number;
  unitPrice?: number;
  costPrice?: number;
  lineTotal?: number;
  category?: string;
}

interface NormalizedExpense {
  id: string;
  amount: number;
  category: string;
  paymentMethod: string;
  date: Date;
}

interface ExpenseAggregate {
  total: number;
  cash: number;
  mobileMoney: number;
  bank: number;
  byCategory: Map<string, number>;
  byDate: Map<string, number>;
}

interface NormalizedTransaction {
  id: string;
  source: 'pos' | 'online' | 'field';
  amount: number;
  profit: number;
  paymentMethod: string;
  employee?: string;
  agentId?: string;
  agentName?: string;
  status: 'completed' | 'refunded' | 'cancelled';
  createdAt: Date;
  items: TransactionItem[];
  customerId?: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pctChange(current: number, previous: number): number | undefined {
  if (previous === 0) return current > 0 ? 100 : undefined;
  return ((current - previous) / previous) * 100;
}

function kpi(
  value: number,
  sparkline: number[] = [],
  options: Partial<KpiMetric> = {}
): KpiMetric {
  return {
    value,
    sparkline,
    available: true,
    ...options,
  };
}

function unavailableKpi(note: string): KpiMetric {
  return { value: 0, sparkline: [], available: false, note };
}

function inRange(date: Date, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

function tsToDate(ts: unknown): Date | null {
  if (!ts || typeof ts !== 'object') return null;
  if ('toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate();
  }
  if ('seconds' in ts && typeof (ts as { seconds: number }).seconds === 'number') {
    return new Date((ts as { seconds: number }).seconds * 1000);
  }
  return null;
}

function normalizePaymentMethod(method: string): string {
  return method.replace(/_/g, ' ');
}

function buildSparkline(
  transactions: NormalizedTransaction[],
  range: DateRange
): number[] {
  const map = new Map<string, number>();
  const cursor = new Date(range.start);
  while (cursor <= range.end) {
    map.set(toDateKey(cursor), 0);
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const tx of transactions) {
    if (tx.status !== 'completed') continue;
    const key = toDateKey(tx.createdAt);
    map.set(key, (map.get(key) ?? 0) + tx.amount);
  }
  return Array.from(map.values());
}

function aggregateTransactions(
  transactions: NormalizedTransaction[],
  range: DateRange
): {
  revenue: number;
  profit: number;
  count: number;
  refunds: { count: number; amount: number };
} {
  let revenue = 0;
  let profit = 0;
  let count = 0;
  let refundCount = 0;
  let refundAmount = 0;

  for (const tx of transactions) {
    if (!inRange(tx.createdAt, range)) continue;
    if (tx.status === 'refunded') {
      refundCount += 1;
      refundAmount += tx.amount;
      continue;
    }
    if (tx.status !== 'completed') continue;
    revenue += tx.amount;
    profit += tx.profit;
    count += 1;
  }

  return { revenue, profit, count, refunds: { count: refundCount, amount: refundAmount } };
}

function aggregateExpenses(
  expenses: NormalizedExpense[],
  range: DateRange
): ExpenseAggregate {
  let total = 0;
  let cash = 0;
  let mobileMoney = 0;
  let bank = 0;
  const byCategory = new Map<string, number>();
  const byDate = new Map<string, number>();

  for (const expense of expenses) {
    if (!inRange(expense.date, range)) continue;
    total += expense.amount;
    if (expense.paymentMethod === 'cash') cash += expense.amount;
    else if (expense.paymentMethod === 'mobile_money') mobileMoney += expense.amount;
    else if (expense.paymentMethod === 'bank_transfer' || expense.paymentMethod === 'card')
      bank += expense.amount;

    byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + expense.amount);
    const key = toDateKey(expense.date);
    byDate.set(key, (byDate.get(key) ?? 0) + expense.amount);
  }

  return { total, cash, mobileMoney, bank, byCategory, byDate };
}

export function generateInsights(report: Omit<EnterpriseReport, 'insights'>): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  const revenueChange = report.sales.periodComparison.changePercent;
  if (revenueChange !== undefined) {
    if (revenueChange >= 10) {
      insights.push({
        id: 'revenue-up',
        type: 'success',
        title: 'Revenue is trending up',
        description: `Revenue increased ${revenueChange.toFixed(1)}% compared to the previous period.`,
        metric: `+${revenueChange.toFixed(1)}%`,
      });
    } else if (revenueChange <= -10) {
      insights.push({
        id: 'revenue-down',
        type: 'warning',
        title: 'Revenue decline detected',
        description: `Revenue dropped ${Math.abs(revenueChange).toFixed(1)}% vs the previous period. Review pricing, promotions, and field sales activity.`,
        metric: `${revenueChange.toFixed(1)}%`,
        action: 'Review sales channels',
      });
    }
  }

  if (report.kpis.lowStockItems.value > 0) {
    insights.push({
      id: 'low-stock',
      type: 'warning',
      title: `${report.kpis.lowStockItems.value} products need reordering`,
      description: 'Several items are at or below reorder level. Restock fast-moving automotive paints to avoid lost sales.',
      action: 'View inventory',
    });
  }

  if (report.kpis.outOfStockItems.value > 0) {
    insights.push({
      id: 'out-of-stock',
      type: 'danger',
      title: `${report.kpis.outOfStockItems.value} products are out of stock`,
      description: 'Out-of-stock items can directly impact body shop and retail customers. Prioritize replenishment.',
      action: 'Reorder now',
    });
  }

  if (report.kpis.outstandingBalances.value > 0) {
    insights.push({
      id: 'ar-balance',
      type: 'info',
      title: 'Outstanding customer balances',
      description: `${report.customers.withBalances.length} customers owe a combined balance. Follow up on credit accounts to improve cash flow.`,
      metric: `${report.customers.withBalances.length} accounts`,
    });
  }

  if (report.products.bestSelling.length > 0) {
    const top = report.products.bestSelling[0];
    insights.push({
      id: 'top-product',
      type: 'success',
      title: `Top seller: ${top.name}`,
      description: `${top.quantity} units sold in this period. Ensure adequate stock and consider bundle promotions.`,
    });
  }

  if (report.products.nonMoving.length > 0) {
    insights.push({
      id: 'dead-stock',
      type: 'warning',
      title: `${report.products.nonMoving.length} products had zero sales`,
      description: 'Non-moving inventory ties up capital. Consider discounts, repackaging, or transferring slow SKUs.',
      action: 'Review dead stock',
    });
  }

  if (report.sales.byChannel.length >= 2) {
    const sorted = [...report.sales.byChannel].sort((a, b) => b.revenue - a.revenue);
    insights.push({
      id: 'channel-leader',
      type: 'info',
      title: `${sorted[0].channel} leads sales`,
      description: `${sorted[0].channel} generated the most revenue this period. Balance field, POS, and online channels for growth.`,
    });
  }

  if (report.kpis.grossMargin.value > 0 && report.kpis.grossMargin.value < 15) {
    insights.push({
      id: 'low-margin',
      type: 'warning',
      title: 'Gross margin below 15%',
      description: 'Review cost prices and discount policies on wholesale accounts to protect profitability.',
      metric: `${report.kpis.grossMargin.value.toFixed(1)}%`,
    });
  }

  if (report.customers.returningRate > 40) {
    insights.push({
      id: 'loyal-customers',
      type: 'success',
      title: 'Strong customer retention',
      description: `${report.customers.returningRate.toFixed(0)}% of customers are repeat buyers — a healthy sign for a paint supply business.`,
    });
  }

  return insights.slice(0, 8);
}

export function buildEnterpriseReportFromRawData(
  preset: DatePreset = 'last30',
  customFrom?: string,
  customTo?: string,
  filters: ReportFilters = {},
  raw: EnterpriseRawData
): EnterpriseReport {
  const range = getDateRange(preset, customFrom, customTo);
  const comparisonRange = getComparisonRange(range);
  const yoyRange = getYearOverYearRange(range);

  const productMap = new Map<
    string,
    {
      name: string;
      category: string;
      stock: number;
      costPrice: number;
      price: number;
      reorderLevel: number;
    }
  >();

  raw.products.forEach(({ id, data: p }) => {
    productMap.set(id, {
      name: (p.name as string) ?? 'Unknown',
      category: (p.category as string) ?? 'Uncategorized',
      stock: (p.stock as number) ?? 0,
      costPrice: (p.costPrice as number) ?? 0,
      price: (p.price as number) ?? 0,
      reorderLevel: (p.reorderLevel as number) ?? 5,
    });
  });

  const transactions: NormalizedTransaction[] = [];

  for (const { id, data: sale } of raw.sales) {
    const createdAt = tsToDate(sale.createdAt);
    if (!createdAt) continue;

    const items: TransactionItem[] = ((sale.items as TransactionItem[]) ?? []).map((item) => ({
      ...item,
      category: productMap.get(item.productId ?? '')?.category ?? 'Uncategorized',
    }));

    let profit = 0;
    for (const item of items) {
      const unitPrice = item.unitPrice ?? item.price ?? 0;
      const costPrice = item.costPrice ?? productMap.get(item.productId ?? '')?.costPrice ?? 0;
      const qty = item.quantity ?? 0;
      profit += (unitPrice - costPrice) * qty;
    }

    const source = sale.channel === 'field' ? 'field' : ('pos' as const);

    transactions.push({
      id,
      source,
      amount: (sale.totalAmount as number) ?? 0,
      profit,
      paymentMethod: (sale.paymentMethod as string) ?? 'cash',
      employee: sale.cashierEmail as string | undefined,
      agentId: sale.fieldAgentId as string | undefined,
      agentName: sale.fieldAgentName as string | undefined,
      status:
        sale.status === 'refunded'
          ? 'refunded'
          : sale.status === 'cancelled'
            ? 'cancelled'
            : 'completed',
      createdAt,
      items,
      customerId: sale.customerId as string | undefined,
    });
  }

  for (const { id, data: order } of raw.orders) {
    const createdAt = tsToDate(order.createdAt);
    if (!createdAt) continue;
    if (order.paymentStatus !== 'paid') continue;

    const items: TransactionItem[] = (
      (order.items as Array<{
        productId: string;
        productName: string;
        quantity: number;
        price: number;
      }>) ?? []
    ).map((item) => ({
      productId: item.productId,
      name: item.productName,
      quantity: item.quantity,
      unitPrice: item.price,
      costPrice: productMap.get(item.productId)?.costPrice ?? 0,
      lineTotal: item.price * item.quantity,
      category: productMap.get(item.productId)?.category ?? 'Uncategorized',
    }));

    let profit = 0;
    for (const item of items) {
      profit += ((item.unitPrice ?? 0) - (item.costPrice ?? 0)) * item.quantity;
    }

    transactions.push({
      id,
      source: 'online',
      amount: (order.totalPrice as number) ?? 0,
      profit,
      paymentMethod: (order.paymentMethod as string) ?? 'online',
      status: 'completed',
      createdAt,
      items,
      customerId: order.customerId as string | undefined,
    });
  }

  const normalizedExpenses: NormalizedExpense[] = [];
  for (const { id, data: expense } of raw.expenses) {
    const date = tsToDate(expense.date) ?? tsToDate(expense.createdAt);
    if (!date) continue;
    normalizedExpenses.push({
      id,
      amount: (expense.amount as number) ?? 0,
      category: (expense.category as string) ?? 'other',
      paymentMethod: (expense.paymentMethod as string) ?? 'cash',
      date,
    });
  }

  const applyFilters = (tx: NormalizedTransaction): boolean => {
    if (filters.paymentMethod && tx.paymentMethod !== filters.paymentMethod) return false;
    if (filters.channel && tx.source !== filters.channel) return false;
    if (filters.employee && tx.employee !== filters.employee) return false;
    if (filters.category || filters.productId) {
      const items = tx.items;
      if (filters.productId && !items.some((i) => i.productId === filters.productId)) return false;
      if (filters.category && !items.some((i) => i.category === filters.category)) return false;
    }
    return true;
  };

  const filtered = transactions.filter(applyFilters);
  const periodAgg = aggregateTransactions(filtered, range);
  const comparisonAgg = aggregateTransactions(filtered, comparisonRange);
  const yoyAgg = aggregateTransactions(filtered, yoyRange);
  const sparkline = buildSparkline(filtered, range);

  const expensePeriodAgg = aggregateExpenses(normalizedExpenses, range);
  const expenseComparisonAgg = aggregateExpenses(normalizedExpenses, comparisonRange);

  const todayRange = getDateRange('today');
  const weekRange = getDateRange('last7');
  const monthRange = getDateRange('thisMonth');
  const yearRange = getDateRange('year');

  const revenueToday = aggregateTransactions(filtered, todayRange).revenue;
  const revenueWeek = aggregateTransactions(filtered, weekRange).revenue;
  const revenueMonth = aggregateTransactions(filtered, monthRange).revenue;
  const revenueYear = aggregateTransactions(filtered, yearRange).revenue;

  let inventoryRetailValue = 0;
  let inventoryCostValue = 0;
  let lowStockItems = 0;
  let outOfStockItems = 0;
  const categories = new Set<string>();
  const productOptions: Array<{ id: string; name: string }> = [];

  productMap.forEach((product, id) => {
    inventoryRetailValue += product.stock * product.price;
    inventoryCostValue += product.stock * product.costPrice;
    categories.add(product.category);
    productOptions.push({ id, name: product.name });
    if (product.stock <= 0) outOfStockItems += 1;
    else if (product.stock <= product.reorderLevel) lowStockItems += 1;
  });

  let outstandingBalances = 0;
  const customerPurchaseCounts = new Map<string, number>();
  let newCustomersInPeriod = 0;
  const topSpenders: EnterpriseReport['customers']['topSpenders'] = [];
  const withBalances: EnterpriseReport['customers']['withBalances'] = [];

  raw.customers.forEach(({ id, data: c }) => {
    const balance = (c.outstandingBalance as number) ?? 0;
    outstandingBalances += balance;
    topSpenders.push({
      id,
      name: (c.name as string) ?? 'Unknown',
      totalSpent: (c.totalSpent as number) ?? 0,
      outstandingBalance: balance,
    });
    if (balance > 0) {
      withBalances.push({ id, name: (c.name as string) ?? 'Unknown', outstandingBalance: balance });
    }
    const created = tsToDate(c.createdAt);
    if (created && inRange(created, range)) newCustomersInPeriod += 1;
  });

  topSpenders.sort((a, b) => b.totalSpent - a.totalSpent);
  withBalances.sort((a, b) => b.outstandingBalance - a.outstandingBalance);

  for (const tx of filtered) {
    if (tx.status !== 'completed' || !tx.customerId) continue;
    customerPurchaseCounts.set(
      tx.customerId,
      (customerPurchaseCounts.get(tx.customerId) ?? 0) + 1
    );
  }

  const activeCustomers = customerPurchaseCounts.size;
  let oneTime = 0;
  let repeat = 0;
  let loyal = 0;
  customerPurchaseCounts.forEach((count) => {
    if (count === 1) oneTime += 1;
    else if (count <= 3) repeat += 1;
    else loyal += 1;
  });
  const returningRate =
    activeCustomers > 0 ? ((repeat + loyal) / activeCustomers) * 100 : 0;

  const dailyMap = new Map<string, { revenue: number; profit: number; transactions: number }>();
  const hourlyMap = new Map<number, { revenue: number; count: number }>();
  const weekdayMap = new Map<number, { revenue: number; count: number }>();
  const categoryMap = new Map<string, { revenue: number; quantity: number; profit: number }>();
  const productSalesMap = new Map<
    string,
    { name: string; category: string; quantity: number; revenue: number; profit: number }
  >();
  const channelMap = new Map<string, { revenue: number; transactions: number }>();
  const paymentMap = new Map<string, { amount: number; count: number }>();
  const employeeMap = new Map<string, { revenue: number; transactions: number }>();

  for (const tx of filtered) {
    if (tx.status !== 'completed' || !inRange(tx.createdAt, range)) continue;

    const dateKey = toDateKey(tx.createdAt);
    const daily = dailyMap.get(dateKey) ?? { revenue: 0, profit: 0, transactions: 0 };
    daily.revenue += tx.amount;
    daily.profit += tx.profit;
    daily.transactions += 1;
    dailyMap.set(dateKey, daily);

    const hour = tx.createdAt.getHours();
    const hourData = hourlyMap.get(hour) ?? { revenue: 0, count: 0 };
    hourData.revenue += tx.amount;
    hourData.count += 1;
    hourlyMap.set(hour, hourData);

    const weekday = tx.createdAt.getDay();
    const weekdayData = weekdayMap.get(weekday) ?? { revenue: 0, count: 0 };
    weekdayData.revenue += tx.amount;
    weekdayData.count += 1;
    weekdayMap.set(weekday, weekdayData);

    const channelLabel =
      tx.source === 'online' ? 'Online' : tx.source === 'field' ? 'Field Sales' : 'POS / Retail';
    const ch = channelMap.get(channelLabel) ?? { revenue: 0, transactions: 0 };
    ch.revenue += tx.amount;
    ch.transactions += 1;
    channelMap.set(channelLabel, ch);

    const pm = paymentMap.get(tx.paymentMethod) ?? { amount: 0, count: 0 };
    pm.amount += tx.amount;
    pm.count += 1;
    paymentMap.set(tx.paymentMethod, pm);

    if (tx.employee) {
      const emp = employeeMap.get(tx.employee) ?? { revenue: 0, transactions: 0 };
      emp.revenue += tx.amount;
      emp.transactions += 1;
      employeeMap.set(tx.employee, emp);
    }

    for (const item of tx.items) {
      const productId = item.productId ?? 'unknown';
      const meta = productMap.get(productId);
      const category = item.category ?? meta?.category ?? 'Uncategorized';
      const qty = item.quantity ?? 0;
      const unitPrice = item.unitPrice ?? item.price ?? 0;
      const costPrice = item.costPrice ?? meta?.costPrice ?? 0;
      const revenue = item.lineTotal ?? unitPrice * qty;
      const profit = (unitPrice - costPrice) * qty;

      const cat = categoryMap.get(category) ?? { revenue: 0, quantity: 0, profit: 0 };
      cat.revenue += revenue;
      cat.quantity += qty;
      cat.profit += profit;
      categoryMap.set(category, cat);

      const ps = productSalesMap.get(productId) ?? {
        name: item.name ?? item.productName ?? meta?.name ?? 'Unknown',
        category,
        quantity: 0,
        revenue: 0,
        profit: 0,
      };
      ps.quantity += qty;
      ps.revenue += revenue;
      ps.profit += profit;
      productSalesMap.set(productId, ps);
    }
  }

  const soldProductIds = new Set(productSalesMap.keys());
  const nonMoving = Array.from(productMap.entries())
    .filter(([id]) => !soldProductIds.has(id) && productMap.get(id)!.stock > 0)
    .map(([productId, p]) => ({ productId, name: p.name, stock: p.stock }))
    .slice(0, 20);

  const byProduct = Array.from(productSalesMap.entries())
    .map(([productId, data]) => ({
      productId,
      ...data,
      margin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const bestSelling = byProduct
    .slice(0, 10)
    .map((p) => ({
      productId: p.productId,
      name: p.name,
      quantity: p.quantity,
      revenue: p.revenue,
    }));

  const slowMoving = [...byProduct]
    .filter((p) => p.quantity > 0)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 10)
    .map((p) => ({
      productId: p.productId,
      name: p.name,
      quantity: p.quantity,
      revenue: p.revenue,
    }));

  const highestProfit = [...byProduct]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10)
    .map((p) => ({
      productId: p.productId,
      name: p.name,
      profit: p.profit,
      margin: p.margin,
    }));

  const lowestMargin = [...byProduct]
    .filter((p) => p.revenue > 0)
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 10)
    .map((p) => ({
      productId: p.productId,
      name: p.name,
      margin: p.margin,
      revenue: p.revenue,
    }));

  const reorderAlerts = Array.from(productMap.entries())
    .filter(([, p]) => p.stock <= p.reorderLevel)
    .map(([productId, p]) => ({
      productId,
      name: p.name,
      stock: p.stock,
      reorderLevel: p.reorderLevel,
    }))
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 15);

  const turnoverRate =
    inventoryCostValue > 0 ? periodAgg.revenue / inventoryCostValue : 0;

  let inflow = 0;
  let outflow = 0;
  const adjustmentMap = new Map<string, { count: number; quantity: number }>();
  const movementHistory: EnterpriseReport['inventory']['movementHistory'] = [];

  raw.movements.forEach(({ data: m }) => {
    const created = tsToDate(m.createdAt);
    if (!created || !inRange(created, range)) return;
    const qty = (m.quantityChange as number) ?? 0;
    if (qty > 0) inflow += qty;
    else outflow += Math.abs(qty);

    const type = m.type ?? 'unknown';
    const adj = adjustmentMap.get(type) ?? { count: 0, quantity: 0 };
    adj.count += 1;
    adj.quantity += Math.abs(qty);
    adjustmentMap.set(type, adj);

    movementHistory.push({
      date: created.toISOString(),
      type,
      productName: (m.productName as string) ?? 'Unknown',
      quantityChange: qty,
    });
  });

  movementHistory.sort((a, b) => b.date.localeCompare(a.date));

  const deadStock = Array.from(productMap.entries())
    .filter(([id]) => !soldProductIds.has(id))
    .map(([productId, p]) => ({
      productId,
      name: p.name,
      stock: p.stock,
      value: p.stock * p.costPrice,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const fastMoving = bestSelling.slice(0, 8).map((p) => ({
    productId: p.productId,
    name: p.name,
    quantity: p.quantity,
  }));

  const agentMap = new Map<
    string,
    { name: string; revenue: number; sold: number; returned: number; missing: number }
  >();

  raw.fieldPicks.forEach(({ data: pick }) => {
    if (pick.status !== 'closed' || !pick.report) return;
    const closed = tsToDate(pick.closedAt ?? pick.pickedAt);
    if (!closed || !inRange(closed, range)) return;

    const report = pick.report as {
      totalRevenue?: number;
      totalSold?: number;
      totalReturned?: number;
      totalMissing?: number;
    };

    const agent = agentMap.get(pick.agentId as string) ?? {
      name: (pick.agentName as string) ?? 'Unknown',
      revenue: 0,
      sold: 0,
      returned: 0,
      missing: 0,
    };
    agent.revenue += report.totalRevenue ?? 0;
    agent.sold += report.totalSold ?? 0;
    agent.returned += report.totalReturned ?? 0;
    agent.missing += report.totalMissing ?? 0;
    agentMap.set(pick.agentId as string, agent);
  });

  const cashSales = paymentMap.get('cash')?.amount ?? 0;
  const mobileMoneySales = paymentMap.get('mobile_money')?.amount ?? 0;
  const bankCardSales =
    (paymentMap.get('bank_transfer')?.amount ?? 0) + (paymentMap.get('card')?.amount ?? 0);

  const cashOnHand = cashSales - expensePeriodAgg.cash;
  const mobileMoneyBalance = mobileMoneySales - expensePeriodAgg.mobileMoney;
  const bankBalance = bankCardSales - expensePeriodAgg.bank;

  const netProfit = periodAgg.profit - expensePeriodAgg.total;
  const grossMargin =
    periodAgg.revenue > 0 ? (periodAgg.profit / periodAgg.revenue) * 100 : 0;
  const netMargin = periodAgg.revenue > 0 ? (netProfit / periodAgg.revenue) * 100 : 0;

  const paymentDistribution = Array.from(paymentMap.entries())
    .map(([method, data]) => ({
      method: normalizePaymentMethod(method),
      amount: data.amount,
      percentage: periodAgg.revenue > 0 ? (data.amount / periodAgg.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const newCustomersTrend: Array<{ date: string; count: number }> = [];
  const newCustMap = new Map<string, number>();
  raw.customers.forEach(({ data: c }) => {
    const created = tsToDate(c.createdAt);
    if (!created || !inRange(created, range)) return;
    const key = toDateKey(created);
    newCustMap.set(key, (newCustMap.get(key) ?? 0) + 1);
  });
  const ncCursor = new Date(range.start);
  while (ncCursor <= range.end) {
    const key = toDateKey(ncCursor);
    newCustomersTrend.push({ date: key, count: newCustMap.get(key) ?? 0 });
    ncCursor.setDate(ncCursor.getDate() + 1);
  }

  const employees = Array.from(new Set(filtered.map((t) => t.employee).filter(Boolean))) as string[];
  const paymentMethods = Array.from(new Set(filtered.map((t) => t.paymentMethod)));
  const channels = ['pos', 'online', 'field'];

  const reportBase: Omit<EnterpriseReport, 'insights'> = {
    meta: {
      preset,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      generatedAt: new Date().toISOString(),
      branch: 'Main Branch',
      filters: { preset, ...filters },
    },
    kpis: {
      revenue: kpi(periodAgg.revenue, sparkline, {
        previousValue: comparisonAgg.revenue,
        changePercent: pctChange(periodAgg.revenue, comparisonAgg.revenue),
      }),
      revenueToday: kpi(revenueToday),
      revenueWeek: kpi(revenueWeek),
      revenueMonth: kpi(revenueMonth),
      revenueYear: kpi(revenueYear),
      grossProfit: kpi(periodAgg.profit, sparkline, {
        previousValue: comparisonAgg.profit,
        changePercent: pctChange(periodAgg.profit, comparisonAgg.profit),
      }),
      netProfit: kpi(netProfit, sparkline, {
        note: 'Gross profit minus expenses recorded in the selected period',
      }),
      transactions: kpi(periodAgg.count, [], {
        previousValue: comparisonAgg.count,
        changePercent: pctChange(periodAgg.count, comparisonAgg.count),
      }),
      averageOrderValue: kpi(
        periodAgg.count > 0 ? periodAgg.revenue / periodAgg.count : 0
      ),
      totalCustomers: kpi(raw.customers.length),
      activeCustomers: kpi(activeCustomers),
      outstandingBalances: kpi(outstandingBalances),
      inventoryRetailValue: kpi(inventoryRetailValue),
      inventoryCostValue: kpi(inventoryCostValue),
      totalProducts: kpi(productMap.size),
      lowStockItems: kpi(lowStockItems),
      outOfStockItems: kpi(outOfStockItems),
      expiringProducts: unavailableKpi('Expiry tracking not enabled'),
      purchaseValue: unavailableKpi('Purchase orders module coming soon'),
      accountsReceivable: kpi(outstandingBalances),
      accountsPayable: unavailableKpi('Accounts payable module coming soon'),
      cashOnHand: kpi(cashOnHand, [], {
        note: 'Cash sales minus cash expenses in selected period',
      }),
      mobileMoneyBalance: kpi(mobileMoneyBalance, [], {
        note: 'Mobile money collections minus mobile money expenses in selected period',
      }),
      bankBalance: kpi(bankBalance, [], {
        note: 'Bank & card collections minus bank/card expenses in selected period',
      }),
      grossMargin: kpi(grossMargin),
      netMargin: kpi(netMargin, [], {
        note: 'Net profit as a percentage of revenue in selected period',
      }),
      refundAmount: kpi(periodAgg.refunds.amount),
      refundCount: kpi(periodAgg.refunds.count),
      totalExpenses: kpi(expensePeriodAgg.total, [], {
        previousValue: expenseComparisonAgg.total,
        changePercent: pctChange(expensePeriodAgg.total, expenseComparisonAgg.total),
      }),
    },
    sales: {
      dailyTrend: Array.from(dailyMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      hourly: Array.from({ length: 24 }, (_, hour) => {
        const data = hourlyMap.get(hour) ?? { revenue: 0, count: 0 };
        return {
          hour: `${hour.toString().padStart(2, '0')}:00`,
          revenue: data.revenue,
          count: data.count,
        };
      }),
      weekday: WEEKDAYS.map((day, index) => {
        const data = weekdayMap.get(index) ?? { revenue: 0, count: 0 };
        return { day, revenue: data.revenue, count: data.count };
      }),
      byCategory: Array.from(categoryMap.entries())
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.revenue - a.revenue),
      byProduct: byProduct.slice(0, 25),
      byBranch: [{ branch: 'Main Branch', revenue: periodAgg.revenue, transactions: periodAgg.count }],
      byChannel: Array.from(channelMap.entries())
        .map(([channel, data]) => ({ channel, ...data }))
        .sort((a, b) => b.revenue - a.revenue),
      byPaymentMethod: Array.from(paymentMap.entries())
        .map(([method, data]) => ({
          method: normalizePaymentMethod(method),
          amount: data.amount,
          count: data.count,
        }))
        .sort((a, b) => b.amount - a.amount),
      yoyComparison: {
        current: periodAgg.revenue,
        previous: yoyAgg.revenue,
        changePercent: pctChange(periodAgg.revenue, yoyAgg.revenue) ?? 0,
      },
      periodComparison: {
        current: periodAgg.revenue,
        previous: comparisonAgg.revenue,
        changePercent: pctChange(periodAgg.revenue, comparisonAgg.revenue) ?? 0,
      },
    },
    products: {
      bestSelling,
      slowMoving,
      nonMoving,
      highestProfit,
      lowestMargin,
      reorderAlerts,
      turnoverRate,
    },
    inventory: {
      adjustments: Array.from(adjustmentMap.entries()).map(([type, data]) => ({
        type,
        ...data,
      })),
      inflow,
      outflow,
      deadStock,
      fastMoving,
      movementHistory: movementHistory.slice(0, 20),
    },
    customers: {
      newCustomers: newCustomersTrend,
      returningRate,
      topSpenders: topSpenders.slice(0, 10),
      withBalances: withBalances.slice(0, 10),
      purchaseFrequency: { oneTime, repeat, loyal },
    },
    employees: {
      salesByEmployee: Array.from(employeeMap.entries())
        .map(([email, data]) => ({
          email,
          revenue: data.revenue,
          transactions: data.transactions,
          avgSale: data.transactions > 0 ? data.revenue / data.transactions : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue),
      fieldAgents: Array.from(agentMap.entries())
        .map(([agentId, data]) => ({
          agentId,
          name: data.name,
          revenue: data.revenue,
          unitsSold: data.sold,
          unitsReturned: data.returned,
          unitsMissing: data.missing,
        }))
        .sort((a, b) => b.revenue - a.revenue),
    },
    financial: {
      revenueVsExpenses: (() => {
        const dates = new Set([...dailyMap.keys(), ...expensePeriodAgg.byDate.keys()]);
        const rvCursor = new Date(range.start);
        while (rvCursor <= range.end) {
          dates.add(toDateKey(rvCursor));
          rvCursor.setDate(rvCursor.getDate() + 1);
        }
        return Array.from(dates)
          .map((date) => {
            const daily = dailyMap.get(date);
            return {
              date,
              revenue: daily?.revenue ?? 0,
              expenses: expensePeriodAgg.byDate.get(date) ?? 0,
              profit: daily?.profit ?? 0,
            };
          })
          .sort((a, b) => a.date.localeCompare(b.date));
      })(),
      profitTrend: Array.from(dailyMap.entries())
        .map(([date, data]) => ({ date, profit: data.profit }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      paymentDistribution,
      expensesByCategory: Array.from(expensePeriodAgg.byCategory.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      receivables: outstandingBalances,
      payables: 0,
    },
    filterOptions: {
      categories: Array.from(categories).sort(),
      products: productOptions.sort((a, b) => a.name.localeCompare(b.name)),
      paymentMethods,
      channels,
      employees,
    },
  };

  return {
    ...reportBase,
    insights: generateInsights(reportBase),
  };
}

