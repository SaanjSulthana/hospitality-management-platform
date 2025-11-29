/**
 * Guest Check-In Realtime Integration Helper
 * 
 * Integrates realtime updates with existing state management
 * Works with pages that use useState instead of React Query
 */

import { useCallback, useRef, useEffect } from 'react';
import { useGuestCheckInRealtimeV3 } from './useGuestCheckInRealtimeV3';

interface GuestCheckInEvent {
  eventType: string;
  timestamp: string;
  entityId: number;
  entityType: string;
  metadata?: Record<string, unknown>;
}

interface IntegrationOptions {
  propertyId?: number;
  enabled?: boolean;
  onGuestCreated?: () => void;
  onGuestUpdated?: (guestId: number) => void;
  onGuestDeleted?: (guestId: number) => void;
  onGuestCheckedOut?: (guestId: number) => void;
  onAnyChange?: () => void;  // Fallback: refresh everything
}

/**
 * Integration hook for realtime updates
 * Debounces rapid updates to prevent UI thrashing
 */
export function useGuestCheckInRealtimeIntegration(options: IntegrationOptions = {}) {
  const {
    propertyId,
    enabled = true,
    onGuestCreated,
    onGuestUpdated,
    onGuestDeleted,
    onGuestCheckedOut,
    onAnyChange,
  } = options;
  
  const processedEventIds = useRef(new Set<string>());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRefreshRef = useRef<boolean>(false);
  
  // Debounced refresh handler
  const triggerRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    pendingRefreshRef.current = true;
    
    debounceTimerRef.current = setTimeout(() => {
      if (pendingRefreshRef.current && onAnyChange) {
        onAnyChange();
        pendingRefreshRef.current = false;
      }
    }, 500); // 500ms debounce
  }, [onAnyChange]);
  
  // Event handler
  const handleRealtimeEvents = useCallback((events: GuestCheckInEvent[]) => {
    console.log('[GuestCheckInRealtimeIntegration] Received events:', events);
    
    let hasChanges = false;
    
    events.forEach(event => {
      const eventKey = `${event.entityId}-${event.timestamp}`;
      
      // Deduplicate
      if (processedEventIds.current.has(eventKey)) {
        return;
      }
      processedEventIds.current.add(eventKey);
      
      // Cleanup old IDs (keep last 1000)
      if (processedEventIds.current.size > 1000) {
        const oldIds = Array.from(processedEventIds.current).slice(0, 100);
        oldIds.forEach(id => processedEventIds.current.delete(id));
      }
      
      // Handle event types
      switch (event.eventType) {
        case 'guest_created':
          console.log('[GuestCheckInRealtimeIntegration] Guest created:', event.entityId);
          if (onGuestCreated) {
            onGuestCreated();
          } else {
            hasChanges = true;
          }
          break;
          
        case 'guest_updated':
          console.log('[GuestCheckInRealtimeIntegration] Guest updated:', event.entityId);
          if (onGuestUpdated) {
            onGuestUpdated(event.entityId);
          } else {
            hasChanges = true;
          }
          break;
          
        case 'guest_deleted':
          console.log('[GuestCheckInRealtimeIntegration] Guest deleted:', event.entityId);
          if (onGuestDeleted) {
            onGuestDeleted(event.entityId);
          } else {
            hasChanges = true;
          }
          break;
          
        case 'guest_checked_out':
          console.log('[GuestCheckInRealtimeIntegration] Guest checked out:', event.entityId);
          if (onGuestCheckedOut) {
            onGuestCheckedOut(event.entityId);
          } else {
            hasChanges = true;
          }
          break;
          
        case 'guest_document_uploaded':
        case 'guest_document_extracted':
          console.log('[GuestCheckInRealtimeIntegration] Document event:', event.eventType);
          // Document events don't require full refresh
          break;
          
        default:
          console.log('[GuestCheckInRealtimeIntegration] Unknown event type:', event.eventType);
          hasChanges = true;
      }
    });
    
    // Trigger debounced refresh if any changes detected
    if (hasChanges && onAnyChange) {
      triggerRefresh();
    }
  }, [onGuestCreated, onGuestUpdated, onGuestDeleted, onGuestCheckedOut, onAnyChange, triggerRefresh]);
  
  // Use realtime hook
  const { isLeader, isConnected, lastEventTime } = useGuestCheckInRealtimeV3({
    propertyId,
    enabled,
    onEvents: handleRealtimeEvents,
  });
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
  
  return {
    isLeader,
    isConnected,
    lastEventTime,
  };
}

