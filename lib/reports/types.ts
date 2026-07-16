export interface KpiMetric {
  value: number;
  previousValue?: number;
  changePercent?: number;
  sparkline: number[];
  available: boolean;
  note?: string;
}

export interface BusinessInsight {
  id: string;
  type: 'success' | 'warning' | 'info' | 'danger';
  title: string;
  description: string;
  action?: string;
  metric?: string;
}

export interface EnterpriseReportFilters {
  preset: string;
  category?: string;
  productId?: string;
  paymentMethod?: string;
  channel?: string;
  employee?: string;
}

export interface EnterpriseReport {
  meta: {
    preset: string;
    start: string;
    end: string;
    generatedAt: string;
    branch: string;
    filters: EnterpriseReportFilters;
  };
  kpis: {
    revenue: KpiMetric;
    revenueToday: KpiMetric;
    revenueWeek: KpiMetric;
    revenueMonth: KpiMetric;
    revenueYear: KpiMetric;
    grossProfit: KpiMetric;
    netProfit: KpiMetric;
    transactions: KpiMetric;
    averageOrderValue: KpiMetric;
    totalCustomers: KpiMetric;
    activeCustomers: KpiMetric;
    outstandingBalances: KpiMetric;
    inventoryRetailValue: KpiMetric;
    inventoryCostValue: KpiMetric;
    totalProducts: KpiMetric;
    lowStockItems: KpiMetric;
    outOfStockItems: KpiMetric;
    expiringProducts: KpiMetric;
    purchaseValue: KpiMetric;
    accountsReceivable: KpiMetric;
    accountsPayable: KpiMetric;
    cashOnHand: KpiMetric;
    mobileMoneyBalance: KpiMetric;
    bankBalance: KpiMetric;
    grossMargin: KpiMetric;
    netMargin: KpiMetric;
    refundAmount: KpiMetric;
    refundCount: KpiMetric;
    totalExpenses: KpiMetric;
  };
  sales: {
    dailyTrend: Array<{
      date: string;
      revenue: number;
      profit: number;
      transactions: number;
    }>;
    hourly: Array<{ hour: string; revenue: number; count: number }>;
    weekday: Array<{ day: string; revenue: number; count: number }>;
    byCategory: Array<{ category: string; revenue: number; quantity: number; profit: number }>;
    byProduct: Array<{
      productId: string;
      name: string;
      category: string;
      quantity: number;
      revenue: number;
      profit: number;
      margin: number;
    }>;
    byBranch: Array<{ branch: string; revenue: number; transactions: number }>;
    byChannel: Array<{ channel: string; revenue: number; transactions: number }>;
    byPaymentMethod: Array<{ method: string; amount: number; count: number }>;
    yoyComparison: { current: number; previous: number; changePercent: number };
    periodComparison: { current: number; previous: number; changePercent: number };
  };
  products: {
    bestSelling: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
    slowMoving: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
    nonMoving: Array<{ productId: string; name: string; stock: number }>;
    highestProfit: Array<{ productId: string; name: string; profit: number; margin: number }>;
    lowestMargin: Array<{ productId: string; name: string; margin: number; revenue: number }>;
    reorderAlerts: Array<{
      productId: string;
      name: string;
      stock: number;
      reorderLevel: number;
    }>;
    turnoverRate: number;
  };
  inventory: {
    adjustments: Array<{ type: string; count: number; quantity: number }>;
    inflow: number;
    outflow: number;
    deadStock: Array<{ productId: string; name: string; stock: number; value: number }>;
    fastMoving: Array<{ productId: string; name: string; quantity: number }>;
    movementHistory: Array<{
      date: string;
      type: string;
      productName: string;
      quantityChange: number;
    }>;
  };
  customers: {
    newCustomers: Array<{ date: string; count: number }>;
    returningRate: number;
    topSpenders: Array<{ id: string; name: string; totalSpent: number; outstandingBalance: number }>;
    withBalances: Array<{ id: string; name: string; outstandingBalance: number }>;
    purchaseFrequency: { oneTime: number; repeat: number; loyal: number };
  };
  employees: {
    salesByEmployee: Array<{
      email: string;
      revenue: number;
      transactions: number;
      avgSale: number;
    }>;
    fieldAgents: Array<{
      agentId: string;
      name: string;
      revenue: number;
      unitsSold: number;
      unitsReturned: number;
      unitsMissing: number;
    }>;
  };
  financial: {
    revenueVsExpenses: Array<{ date: string; revenue: number; expenses: number; profit: number }>;
    profitTrend: Array<{ date: string; profit: number }>;
    paymentDistribution: Array<{ method: string; amount: number; percentage: number }>;
    expensesByCategory: Array<{ category: string; amount: number }>;
    receivables: number;
    payables: number;
  };
  insights: BusinessInsight[];
  filterOptions: {
    categories: string[];
    products: Array<{ id: string; name: string }>;
    paymentMethods: string[];
    channels: string[];
    employees: string[];
  };
}
