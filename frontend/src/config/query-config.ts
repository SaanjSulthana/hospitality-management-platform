export const QUERY_DEFAULTS = {
  STATIC_DATA: {
    staleTime: 600_000, // 10 minutes
    gcTime: 3_600_000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  },
  REAL_TIME_DATA: {
    staleTime: 25_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: false,
  },
  // For data maintained live via WebSocket patching.
  // Never auto-refetch due to invalidation; fetch on mount only.
  REALTIME_CONNECTED: {
    staleTime: Infinity as number,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: false,
  },
  SLOW_CHANGING_DATA: {
    staleTime: 300_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: false,
  },
  // Optimized for dashboard - keeps previous data on navigation to prevent reload flicker
  DASHBOARD_OPTIMIZED: {
    staleTime: 300_000, // 5 minutes - prevents refetch on route change
    gcTime: 600_000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Use cached data when navigating back
    refetchInterval: false,
    placeholderData: (previousData: unknown) => previousData, // Keep previous data while fetching
  },
} as const;

export const QUERY_CATEGORIES = {
  properties: QUERY_DEFAULTS.DASHBOARD_OPTIMIZED, // Optimized to prevent reload on navigation
  users: QUERY_DEFAULTS.DASHBOARD_OPTIMIZED, // Optimized to prevent reload on navigation
  staff: QUERY_DEFAULTS.DASHBOARD_OPTIMIZED, // Optimized to prevent reload on navigation
  revenues: QUERY_DEFAULTS.REAL_TIME_DATA,
  expenses: QUERY_DEFAULTS.REAL_TIME_DATA,
  tasks: QUERY_DEFAULTS.DASHBOARD_OPTIMIZED, // Use dashboard optimized to prevent reload on navigation
  analytics: QUERY_DEFAULTS.DASHBOARD_OPTIMIZED, // Prevent dashboard stats from reloading
  'leave-requests': QUERY_DEFAULTS.DASHBOARD_OPTIMIZED, // Optimized for staff page
  'pending-approvals': QUERY_DEFAULTS.SLOW_CHANGING_DATA,
  'realtime-connected': QUERY_DEFAULTS.REALTIME_CONNECTED,
  dashboard: QUERY_DEFAULTS.DASHBOARD_OPTIMIZED, // New category for dashboard-specific queries
} as const;


