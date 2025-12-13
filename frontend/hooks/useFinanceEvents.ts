import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG } from '../src/config/api';

/**
 * DEPRECATED: Transport handled by RealtimeProviderV2_Fixed.
 * This hook is intentionally a no-op to avoid duplicate transports.
 */
export function useFinanceEvents() {
  useEffect(() => {
    if (import.meta.env?.DEV) {
      console.warn('[useFinanceEvents] Deprecated: Realtime handled by RealtimeProviderV2_Fixed');
    }
  }, []);
}
