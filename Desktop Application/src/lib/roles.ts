import type { Permissions, StaffRole } from '@/lib/types';

const ROLE_PERMISSIONS: Record<StaffRole, Permissions> = {
  admin: {
    applyDiscount: true,
    maxDiscountPercent: 100,
    processRefunds: true,
    adjustStock: true,
    changePrices: true,
    viewReports: true,
    manageCustomers: true,
    manageStaff: true,
    manageFieldSales: true,
    accessPos: true,
    viewMessages: true,
    manageExpenses: true,
    manageCredit: true,
  },
  manager: {
    applyDiscount: true,
    maxDiscountPercent: 25,
    processRefunds: true,
    adjustStock: true,
    changePrices: true,
    viewReports: true,
    manageCustomers: true,
    manageStaff: false,
    manageFieldSales: true,
    accessPos: true,
    viewMessages: true,
    manageExpenses: true,
    manageCredit: true,
  },
  sales: {
    applyDiscount: true,
    maxDiscountPercent: 10,
    processRefunds: false,
    adjustStock: false,
    changePrices: false,
    viewReports: false,
    manageCustomers: true,
    manageStaff: false,
    manageFieldSales: false,
    accessPos: true,
    viewMessages: true,
    manageExpenses: false,
    manageCredit: true,
  },
  inventory: {
    applyDiscount: false,
    maxDiscountPercent: 0,
    processRefunds: false,
    adjustStock: true,
    changePrices: false,
    viewReports: true,
    manageCustomers: false,
    manageStaff: false,
    manageFieldSales: false,
    accessPos: false,
    viewMessages: false,
    manageExpenses: false,
    manageCredit: false,
  },
};

export function getPermissionsForRole(role: StaffRole): Permissions {
  return ROLE_PERMISSIONS[role];
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  sales: 'Sales Staff',
  inventory: 'Inventory Staff',
};

