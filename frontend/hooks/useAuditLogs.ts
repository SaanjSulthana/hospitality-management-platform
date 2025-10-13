/**
 * useAuditLogs Hook
 * Custom hook for fetching and managing audit logs
 */

import { useState, useEffect } from 'react';
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

  const fetchLogs = async (customFilters?: AuditLogsFilters) => {
    setIsLoading(true);
    setError(null);

    const activeFilters = { ...filters, ...customFilters };

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

      const data = await response.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch audit logs';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

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

      const data = await response.json();
      
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
      fetchLogs();
    }
  }, []);

  return {
    logs,
    isLoading,
    error,
    pagination,
    fetchLogs,
    exportToCsv,
  };
}

