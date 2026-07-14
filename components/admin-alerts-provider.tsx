'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useAdminAlerts } from '@/hooks/use-admin-alerts';

type AdminAlertsValue = ReturnType<typeof useAdminAlerts>;

const AdminAlertsContext = createContext<AdminAlertsValue | null>(null);

export function AdminAlertsProvider({ children }: { children: ReactNode }) {
  const value = useAdminAlerts(true);
  return (
    <AdminAlertsContext.Provider value={value}>{children}</AdminAlertsContext.Provider>
  );
}

export function useAdminAlertsContext(): AdminAlertsValue {
  const ctx = useContext(AdminAlertsContext);
  if (!ctx) {
    throw new Error('useAdminAlertsContext must be used within AdminAlertsProvider');
  }
  return ctx;
}

/** Safe for pages that may render outside the provider. */
export function useOptionalAdminAlerts(): AdminAlertsValue | null {
  return useContext(AdminAlertsContext);
}
