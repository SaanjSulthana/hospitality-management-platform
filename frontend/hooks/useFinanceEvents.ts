import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG } from '../src/config/api';

export function useFinanceEvents() {
  const { getAuthenticatedBackend } = useAuth();
  const queryClient = useQueryClient();
  const lastEventIdRef = useRef<string>('');
  const isSubscribingRef = useRef(false);

  useEffect(() => {
    let isActive = true;

    const subscribe = async () => {
      if (isSubscribingRef.current || !isActive) return;
      isSubscribingRef.current = true;

      try {
        const response = await fetch(
          `${API_CONFIG.BASE_URL}/finance/events/subscribe?lastEventId=${lastEventIdRef.current}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            },
          }
        );

        if (!response.ok) throw new Error('Subscription failed');

        // Safe JSON parsing
        let data: { events?: any[]; lastEventId?: string };
        try {
          const text = await response.text();
          data = text ? JSON.parse(text) : { events: [], lastEventId: new Date().toISOString() };
        } catch {
          data = { events: [], lastEventId: new Date().toISOString() };
        }
        
        if (data.events && data.events.length > 0) {
          console.log('Received finance events:', data.events);
          
          // Invalidate relevant queries based on event type
          data.events.forEach((event: any) => {
            if (event.eventType.includes('expense')) {
              queryClient.invalidateQueries({ queryKey: ['expenses'] });
              queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
            }
            if (event.eventType.includes('revenue')) {
              queryClient.invalidateQueries({ queryKey: ['revenues'] });
              queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
            }
            if (event.eventType === 'transaction_approved' || event.eventType === 'daily_approval_granted') {
              queryClient.invalidateQueries({ queryKey: ['daily-approval-check'] });
              queryClient.invalidateQueries({ queryKey: ['today-pending-transactions'] });
            }
          });

          lastEventIdRef.current = data.lastEventId ?? new Date().toISOString();
        }
      } catch (error) {
        console.error('Event subscription error:', error);
      } finally {
        isSubscribingRef.current = false;
        
        // Reconnect after a short delay
        if (isActive) {
          setTimeout(() => subscribe(), 1000);
        }
      }
    };

    subscribe();

    return () => {
      isActive = false;
    };
  }, [queryClient]);
}
