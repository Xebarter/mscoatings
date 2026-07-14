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
  reorderLevel?: number;
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
  reason?: string;
  performedBy: string;
  createdAt: Timestamp;
}

export interface FieldAgent {
  id: string;
  name: string;
  phone: string;
  email?: string;
  active: boolean;
  totalPicks: number;
  totalRevenue: number;
  createdAt: Timestamp;
}

export interface FieldPick {
  id: string;
  agentId: string;
  agentName: string;
  status: 'active' | 'closed';
  totalItems: number;
  totalValue: number;
  createdAt: Timestamp;
}

export interface ReportSummary {
  totalRevenue: number;
  totalSales: number;
  averageOrderValue: number;
  totalProductsSold: number;
  lowStockCount: number;
  pendingOrders: number;
}
