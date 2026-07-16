import type { Timestamp } from 'firebase/firestore';

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered';
export type OrderPaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

export type SalePaymentMethod =
  | 'cash'
  | 'mobile_money'
  | 'bank_transfer'
  | 'card'
  | 'online'
  | 'credit';

export type SaleStatus = 'completed' | 'refunded' | 'cancelled';
export type StaffRole = 'admin' | 'manager' | 'sales' | 'inventory';
export type StockMovementType =
  | 'sale'
  | 'return'
  | 'adjustment_add'
  | 'adjustment_remove'
  | 'damaged'
  | 'lost'
  | 'initial'
  | 'field_pickup';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  image: string;
  createdAt: Timestamp;
  barcode?: string;
  sku?: string;
  brand?: string;
  costPrice?: number;
  /** Price used when field agents pick products; defaults to `price`. */
  fieldPickPrice?: number;
  reorderLevel?: number;
  /** When false, hidden from shop/home; still available in admin/POS. Defaults to true. */
  msProduct?: boolean;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalPrice: number;
  status: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  createdAt: Timestamp;
}

export interface SaleItem {
  productId: string;
  name: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  items: SaleItem[];
  subtotal: number;
  discountTotal: number;
  totalAmount: number;
  paymentMethod: SalePaymentMethod;
  amountTendered?: number;
  changeGiven?: number;
  paymentReference?: string;
  customerId?: string;
  customerName?: string;
  cashierId?: string;
  cashierEmail: string;
  status: SaleStatus;
  createdAt: Timestamp;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantityChange: number;
  resultingStock: number;
  referenceType?: 'sale' | 'order' | 'adjustment' | 'return' | 'field_pick' | 'credit_purchase';
  referenceId?: string;
  reason?: string;
  performedBy: string;
  createdAt: Timestamp;
}

export interface FieldAgent {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  active: boolean;
  totalPicks: number;
  totalRevenue: number;
  totalUnitsMissing: number;
  walletBalance?: number;
  createdAt: Timestamp;
  createdBy?: string;
}

export type FieldAgentTransactionType = 'deposit' | 'pick_settlement';

export interface FieldAgentTransaction {
  id: string;
  agentId: string;
  agentName: string;
  type: FieldAgentTransactionType;
  amount: number;
  pickId?: string;
  paymentMethod?: SalePaymentMethod;
  notes?: string;
  walletBalanceAfter: number;
  recordedBy: string;
  createdAt: Timestamp;
}

export const FIELD_AGENT_TRANSACTION_TYPE_LABELS: Record<
  FieldAgentTransactionType,
  string
> = {
  deposit: 'Account deposit',
  pick_settlement: 'Pick settlement',
};

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  totalSpent: number;
  outstandingBalance: number;
  loyaltyPoints: number;
  createdAt: Timestamp;
}

export interface FieldPickItem {
  productId: string;
  productName: string;
  barcode: string;
  quantityPicked: number;
  unitPrice: number;
  costPrice: number;
}

export interface FieldPickReportItem {
  productId: string;
  productName: string;
  quantityPicked: number;
  quantitySold: number;
  quantityReturned: number;
  quantityMissing: number;
  unitPrice: number;
  lineRevenue: number;
}

export interface FieldPickReport {
  items: FieldPickReportItem[];
  totalSold: number;
  totalReturned: number;
  totalMissing: number;
  totalRevenue: number;
  paymentMethod: SalePaymentMethod;
  amountCollected: number;
  pickValue?: number;
  depositAtReport?: number;
  walletApplied?: number;
  walletBalanceAfter?: number;
  notes?: string;
  saleId?: string;
}

export interface FieldPick {
  id: string;
  agentId: string;
  agentName: string;
  items: FieldPickItem[];
  status: 'active' | 'closed';
  pickedAt: Timestamp;
  pickedBy: string;
  closedAt?: Timestamp;
  closedBy?: string;
  report?: FieldPickReport;
  /** Legacy mirrored fields */
  totalItems?: number;
  totalValue?: number;
  createdAt?: Timestamp;
}

export interface Staff {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole;
  isSuperAdmin?: boolean;
  active: boolean;
  createdAt: Timestamp;
}

export interface Permissions {
  applyDiscount: boolean;
  maxDiscountPercent: number;
  processRefunds: boolean;
  adjustStock: boolean;
  changePrices: boolean;
  viewReports: boolean;
  manageCustomers: boolean;
  manageStaff: boolean;
  manageFieldSales: boolean;
  accessPos: boolean;
  viewMessages: boolean;
  manageExpenses: boolean;
  manageCredit: boolean;
}

export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'salaries'
  | 'transport'
  | 'supplies'
  | 'maintenance'
  | 'marketing'
  | 'taxes'
  | 'other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'rent',
  'utilities',
  'salaries',
  'transport',
  'supplies',
  'maintenance',
  'marketing',
  'taxes',
  'other',
];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Rent',
  utilities: 'Utilities',
  salaries: 'Salaries & Wages',
  transport: 'Transport & Fuel',
  supplies: 'Supplies',
  maintenance: 'Maintenance & Repairs',
  marketing: 'Marketing',
  taxes: 'Taxes & Licenses',
  other: 'Other',
};

export interface Expense {
  id: string;
  date: Timestamp;
  category: ExpenseCategory;
  purpose: string;
  amount: number;
  paymentMethod: SalePaymentMethod;
  payee?: string;
  notes?: string;
  recordedBy: string;
  createdAt: Timestamp;
}

export type CreditCustomerStatus = 'active' | 'inactive';

export interface CreditCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  idNumber?: string;
  notes?: string;
  creditLimit?: number;
  walletBalance: number;
  outstandingBalance: number;
  totalPurchased: number;
  totalPaid: number;
  status: CreditCustomerStatus;
  createdAt: Timestamp;
  createdBy: string;
}

export interface CreditPurchaseItem {
  productId: string;
  productName: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  lineTotal: number;
}

export type CreditPurchaseStatus = 'open' | 'completed' | 'written_off';

export interface CreditPurchase {
  id: string;
  customerId: string;
  customerName: string;
  items: CreditPurchaseItem[];
  totalAmount: number;
  amountPaid: number;
  balanceRemaining: number;
  status: CreditPurchaseStatus;
  dueDate?: Timestamp;
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
  closedAt?: Timestamp;
}

export type CreditTransactionType =
  | 'deposit'
  | 'installment'
  | 'purchase'
  | 'wallet_applied';

export interface CreditTransaction {
  id: string;
  customerId: string;
  customerName: string;
  type: CreditTransactionType;
  amount: number;
  purchaseId?: string;
  paymentMethod?: SalePaymentMethod;
  reference?: string;
  notes?: string;
  walletBalanceAfter: number;
  outstandingBalanceAfter: number;
  recordedBy: string;
  createdAt: Timestamp;
}

export const CREDIT_TRANSACTION_TYPE_LABELS: Record<CreditTransactionType, string> = {
  deposit: 'Account deposit',
  installment: 'Installment payment',
  purchase: 'Credit purchase',
  wallet_applied: 'Wallet applied',
};

export const CREDIT_PURCHASE_STATUS_LABELS: Record<CreditPurchaseStatus, string> = {
  open: 'Open',
  completed: 'Completed',
  written_off: 'Written off',
};

export interface ReportSummary {
  totalRevenue: number;
  totalSales: number;
  averageOrderValue: number;
  totalProductsSold: number;
  lowStockCount: number;
  pendingOrders: number;
}
