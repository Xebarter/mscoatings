'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminFetch } from '@/lib/admin-api';
import type { DatePreset } from '@/lib/reports/date-range';
import { getEnterpriseReportClient } from '@/lib/reports/enterprise-client';
import type { EnterpriseReport } from '@/lib/reports/types';

export interface ReportFilters {
  preset: DatePreset;
  from?: string;
  to?: string;
  category?: string;
  productId?: string;
  paymentMethod?: string;
  channel?: string;
  employee?: string;
}

export function useEnterpriseReport(filters: ReportFilters) {
  const [report, setReport] = useState<EnterpriseReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'api' | 'client'>('api');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ preset: filters.preset });
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.category) params.set('category', filters.category);
      if (filters.productId) params.set('productId', filters.productId);
      if (filters.paymentMethod) params.set('paymentMethod', filters.paymentMethod);
      if (filters.channel) params.set('channel', filters.channel);
      if (filters.employee) params.set('employee', filters.employee);

      const response = await adminFetch(`/api/reports/enterprise?${params}`);
      const data = await response.json();

      if (response.ok) {
        setReport(data.report);
        setDataSource('api');
        return;
      }

      throw new Error(data.error ?? 'Failed to load report');
    } catch (apiError) {
      try {
        const clientReport = await getEnterpriseReportClient(
          filters.preset,
          filters.from,
          filters.to,
          {
            category: filters.category,
            productId: filters.productId,
            paymentMethod: filters.paymentMethod,
            channel: filters.channel,
            employee: filters.employee,
          }
        );
        setReport(clientReport);
        setDataSource('client');
        const apiMessage =
          apiError instanceof Error ? apiError.message : 'Server report unavailable';
        if (apiMessage.includes('Firebase Admin')) {
          toast('Loaded reports from Firestore (server API unavailable)', { icon: 'ℹ️' });
        }
      } catch (clientError) {
        const message =
          clientError instanceof Error ? clientError.message : 'Failed to load report';
        setError(message);
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  return { report, isLoading, error, refresh: load, dataSource };
}
