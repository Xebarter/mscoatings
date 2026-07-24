import type { Sale } from '@/lib/erp-types';

export interface PosCustomerContact {
  /** Stable key for React lists / selection */
  id: string;
  name: string;
  phone: string;
  visitCount: number;
  totalSpent: number;
  lastSaleAt: Date;
  lastSaleId: string;
  lastReceiptNumber: string;
  saleIds: string[];
}

function saleDate(sale: Sale): Date {
  const value = sale.createdAt;
  if (!value) return new Date(0);
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'object' && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return new Date(String(value));
}

/** Digits-only phone for matching; empty if unusable. */
export function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return '';
  // Uganda-style: 2567xxxxxxxx → 07xxxxxxxx for grouping
  if (digits.startsWith('256') && digits.length >= 12) {
    return `0${digits.slice(3)}`;
  }
  return digits;
}

function contactKey(name: string, phone: string): string | null {
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) return `phone:${normalizedPhone}`;
  const trimmedName = name.trim().toLowerCase();
  if (trimmedName) return `name:${trimmedName}`;
  return null;
}

/**
 * Build a POS walk-in phonebook from sales that recorded customerName and/or customerPhone.
 * Prefer phone as the identity; fall back to name when phone is missing.
 */
export function buildPosCustomerContacts(
  sales: Sale[],
  options?: { maxSalesPerContact?: number }
): PosCustomerContact[] {
  const maxSales = options?.maxSalesPerContact ?? 20;
  const map = new Map<
    string,
    {
      name: string;
      phone: string;
      visitCount: number;
      totalSpent: number;
      lastSaleAt: Date;
      lastSaleId: string;
      lastReceiptNumber: string;
      saleIds: string[];
    }
  >();

  // Sales are typically newest-first; still sort defensively.
  const ordered = [...sales].sort(
    (a, b) => saleDate(b).getTime() - saleDate(a).getTime()
  );

  for (const sale of ordered) {
    if (sale.status === 'voided') continue;

    const name = (sale.customerName ?? '').trim();
    const phone = (sale.customerPhone ?? '').trim();
    const key = contactKey(name, phone);
    if (!key) continue;

    const at = saleDate(sale);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        name: name || 'Unknown',
        phone,
        visitCount: 1,
        totalSpent: sale.totalAmount ?? 0,
        lastSaleAt: at,
        lastSaleId: sale.id,
        lastReceiptNumber: sale.receiptNumber,
        saleIds: [sale.id],
      });
      continue;
    }

    existing.visitCount += 1;
    existing.totalSpent += sale.totalAmount ?? 0;
    if (existing.saleIds.length < maxSales) {
      existing.saleIds.push(sale.id);
    }
    if (at > existing.lastSaleAt) {
      existing.lastSaleAt = at;
      existing.lastSaleId = sale.id;
      existing.lastReceiptNumber = sale.receiptNumber;
      if (name) existing.name = name;
      if (phone) existing.phone = phone;
    } else {
      if (!existing.name || existing.name === 'Unknown') {
        if (name) existing.name = name;
      }
      if (!existing.phone && phone) existing.phone = phone;
    }
  }

  return [...map.entries()]
    .map(([id, row]) => ({ id, ...row }))
    .sort((a, b) => b.lastSaleAt.getTime() - a.lastSaleAt.getTime());
}
