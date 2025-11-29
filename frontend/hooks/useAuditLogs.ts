/**
 * useAuditLogs Hook
 * Custom hook for fetching and managing audit logs
 */

import { useState, useEffect, useCallback } from 'react';
import { API_CONFIG } from '../src/config/api';

export interface AuditLog {
  id: number;
  timestamp: string;
  user: {
    id: number;
    email: string;
    role: string;
  };
  action: {
    type: string;
    resourceType: string;
    resourceId: number | null;
  };
  guest: {
    checkInId: number | null;
    name: string | null;
  };
  context: {
    ipAddress: string;
    userAgent: string;
    requestMethod: string;
    requestPath: string;
  };
  details: Record<string, any>;
  success: boolean;
  errorMessage: string | null;
  durationMs: number | null;
}

export interface AuditLogsFilters {
  startDate?: string;
  endDate?: string;
  userId?: number;
  guestCheckInId?: number;
  actionType?: string;
  resourceType?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

type FetchOptions = {
  silent?: boolean;
  replace?: boolean;
};

export function useAuditLogs(filters: AuditLogsFilters = {}, autoFetch = true) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  });

  const fetchLogs = useCallback(async (customFilters: AuditLogsFilters = {}, options: FetchOptions = {}) => {
    if (!options.silent) {
      setIsLoading(true);
    }
    setError(null);

    const baseFilters = options.replace ? {} : filters;
    const activeFilters = { ...baseFilters, ...customFilters };

    try {
      const params = new URLSearchParams();
      if (activeFilters.startDate) params.append('startDate', activeFilters.startDate);
      if (activeFilters.endDate) params.append('endDate', activeFilters.endDate);
      if (activeFilters.userId) params.append('userId', activeFilters.userId.toString());
      if (activeFilters.guestCheckInId) params.append('guestCheckInId', activeFilters.guestCheckInId.toString());
      if (activeFilters.actionType) params.append('actionType', activeFilters.actionType);
      if (activeFilters.resourceType) params.append('resourceType', activeFilters.resourceType);
      if (activeFilters.success !== undefined) params.append('success', activeFilters.success.toString());
      if (activeFilters.limit) params.append('limit', activeFilters.limit.toString());
      if (activeFilters.offset) params.append('offset', activeFilters.offset.toString());

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/guest-checkin/audit-logs?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      // Safe JSON parsing
      let data: { logs: AuditLog[]; pagination: typeof pagination };
      try {
        const text = await response.text();
        if (!text) {
          data = { logs: [], pagination: { total: 0, limit: 50, offset: 0, hasMore: false } };
        } else {
          data = JSON.parse(text);
        }
      } catch (parseError) {
        console.error('Failed to parse audit logs response:', parseError);
        data = { logs: [], pagination: { total: 0, limit: 50, offset: 0, hasMore: false } };
      }
      console.log('✅ Audit logs fetched successfully:', {
        count: data.logs?.length || 0,
        total: data.pagination?.total || 0
      });
      setLogs(data.logs || []);
      setPagination(data.pagination || { total: 0, limit: 50, offset: 0, hasMore: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch audit logs';
      console.error('❌ Failed to fetch audit logs:', errorMessage);
      setError(errorMessage);
    } finally {
      if (!options.silent) {
        setIsLoading(false);
      }
    }
  }, [filters]);

  const exportToCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.userId) params.append('userId', filters.userId.toString());
      if (filters.guestCheckInId) params.append('guestCheckInId', filters.guestCheckInId.toString());
      if (filters.actionType) params.append('actionType', filters.actionType);
      if (filters.resourceType) params.append('resourceType', filters.resourceType);

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/guest-checkin/audit-logs/export?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Export failed');

      // Safe JSON parsing
      let data: { csv: string; filename: string };
      try {
        const text = await response.text();
        if (!text) throw new Error('Empty response');
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse export response:', parseError);
        throw new Error('Failed to parse export response');
      }
      
      // Trigger download
      const blob = new Blob([data.csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export audit logs');
    }
  };

  useEffect(() => {
    if (autoFetch) {
      fetchLogs(undefined, { replace: true });
    }
  }, [autoFetch, fetchLogs]);

  return {
    logs,
    isLoading,
    error,
    pagination,
    fetchLogs,
    exportToCsv,
  };
}

