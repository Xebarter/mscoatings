import type { Timestamp } from 'firebase/firestore';

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

export type SalePaymentMethod =
  | 'cash'
  | 'mobile_money'
  | 'bank_transfer'
  | 'card'
  | 'online'
  | 'credit';

export type SaleStatus = 'completed' | 'refunded' | 'cancelled';

export interface Staff {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole;
  active: boolean;
  createdAt: Timestamp;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantityChange: number;
  resultingStock: number;
  referenceType?: 'sale' | 'order' | 'adjustment' | 'return' | 'field_pick';
  referenceId?: string;
  reason?: string;
  performedBy: string;
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

export type SaleChannel = 'counter' | 'field';

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
  cashierId: string;
  cashierEmail: string;
  status: SaleStatus;
  channel?: SaleChannel;
  fieldAgentId?: string;
  fieldAgentName?: string;
  fieldPickId?: string;
  createdAt: Timestamp;
}

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
}

export type ContactMessageStatus = 'new' | 'read' | 'replied' | 'archived';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: ContactMessageStatus;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
  readBy?: string;
  repliedAt?: string;
  repliedBy?: string;
  archivedAt?: string;
  adminNotes?: string;
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
  createdAt: Timestamp;
  createdBy: string;
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
  notes?: string;
  saleId?: string;
}

export type FieldPickStatus = 'active' | 'closed';

export interface FieldPick {
  id: string;
  agentId: string;
  agentName: string;
  items: FieldPickItem[];
  status: FieldPickStatus;
  pickedAt: Timestamp;
  pickedBy: string;
  closedAt?: Timestamp;
  closedBy?: string;
  report?: FieldPickReport;
}

export const DEFAULT_REORDER_LEVEL = 5;
