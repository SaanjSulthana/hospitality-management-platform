import { useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, UseQueryOptions, QueryKey } from '@tanstack/react-query';

/**
 * Returns true when the current route matches any of the provided base paths.
 * A base path matches if pathname equals it or starts with `${base}/`.
 */
export function useRouteActive(activeOnRoutes: string[]): boolean {
  const location = useLocation();
  const [isActive, setIsActive] = useState<boolean>(() =>
    activeOnRoutes.some((base) => location.pathname === base || location.pathname.startsWith(base + '/'))
  );

  useEffect(() => {
    const next = activeOnRoutes.some((base) => location.pathname === base || location.pathname.startsWith(base + '/'));
    setIsActive(next);
  }, [location.pathname, activeOnRoutes]);

  return isActive;
}

/**
 * Small convenience wrapper for queries that should only be active on certain routes.
 * Prefer using `useRouteActive` directly for custom hooks/wrappers.
 */
export function useRouteAwareQuery<TData = unknown, TError = unknown, TQueryFnData = TData>(
  options: UseQueryOptions<TQueryFnData, TError, TData, QueryKey>,
  activeOnRoutes: string[]
) {
  const isActive = useRouteActive(activeOnRoutes);
  return useQuery({
    ...options,
    enabled: (options.enabled ?? true) && isActive,
    // When gated by route, do not refetch on focus
    refetchOnWindowFocus: false,
  } as UseQueryOptions<TQueryFnData, TError, TData, QueryKey>);
}


