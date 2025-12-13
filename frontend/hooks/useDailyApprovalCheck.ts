import { useQuery } from '@tanstack/react-query';
import { API_CONFIG } from '@/src/config/api';

interface DailyApprovalStatus {
  canAddTransactions: boolean;
  requiresApproval: boolean;
  hasApprovalForToday: boolean;
  hasUnapprovedTransactions: boolean;
  lastApprovalDate?: string;
  message?: string;
}

export function useDailyApprovalCheck() {
  return useQuery<DailyApprovalStatus>({
    queryKey: ['daily-approval-check'],
    queryFn: async () => {
      // Primary: legacy path (POST)
      const baseHeaders = {
        'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
        'Content-Type': 'application/json',
      };
      let resp = await fetch(`${API_CONFIG.BASE_URL}/finance/check-daily-approval`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({}),
      });
      if (resp.status === 404) {
        // Fallback to v1 path if legacy is not exposed
        resp = await fetch(`${API_CONFIG.BASE_URL}/v1/finance/check-daily-approval`, {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({}),
        });
      }
      if (!resp.ok) throw new Error(`daily-approval-check ${resp.status}`);
      return await resp.json();
    },
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}


