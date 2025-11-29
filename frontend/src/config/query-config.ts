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
  SLOW_CHANGING_DATA: {
    staleTime: 300_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: false,
  },
} as const;

export const QUERY_CATEGORIES = {
  properties: QUERY_DEFAULTS.STATIC_DATA,
  users: QUERY_DEFAULTS.SLOW_CHANGING_DATA,
  revenues: QUERY_DEFAULTS.REAL_TIME_DATA,
  expenses: QUERY_DEFAULTS.REAL_TIME_DATA,
  tasks: QUERY_DEFAULTS.REAL_TIME_DATA,
  analytics: QUERY_DEFAULTS.SLOW_CHANGING_DATA,
  'leave-requests': QUERY_DEFAULTS.SLOW_CHANGING_DATA,
  'pending-approvals': QUERY_DEFAULTS.SLOW_CHANGING_DATA,
} as const;


