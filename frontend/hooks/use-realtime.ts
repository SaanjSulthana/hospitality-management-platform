import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useDashboardRealtime() {
  const [isPolling, setIsPolling] = useState(false);
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const refreshNow = async () => {
    setIsPolling(true);
    try {
      // Invalidate non-finance queries for immediate refresh
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        // Check if property update is in progress before invalidating
        ...(window as any).__propertyUpdateInProgress ? [] : [queryClient.invalidateQueries({ queryKey: ['properties'] })],
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        queryClient.invalidateQueries({ queryKey: ['staff'] }),
        queryClient.invalidateQueries({ queryKey: ['schedules'] }),
        queryClient.invalidateQueries({ queryKey: ['leave-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);

      // Force immediate refetch of critical non-finance queries
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['analytics'] }),
        queryClient.refetchQueries({ queryKey: ['dashboard'] }),
      ]);

      console.log('Real-time refresh completed');
    } catch (error) {
      console.error('Real-time refresh error:', error);
    } finally {
      setIsPolling(false);
    }
  };

  // Enhanced real-time synchronization for cross-user updates
  const startRealTimeSync = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // More aggressive polling for real-time updates
    intervalRef.current = setInterval(() => {
      console.log('Real-time sync: Refreshing data...');
      refreshNow();
    }, 5000); // Refresh every 5 seconds for cross-user synchronization
  };

  const stopRealTimeSync = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

  // Start real-time sync when component mounts
  useEffect(() => {
    startRealTimeSync();

    // Cleanup on unmount
    return () => {
      stopRealTimeSync();
    };
  }, []);

  // Enhanced cache invalidation for cross-user updates
  const invalidateAllFinanceData = async () => {
    console.log('Invalidating all finance data for cross-user sync...');
    
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['expenses'] }),
      queryClient.invalidateQueries({ queryKey: ['revenues'] }),
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] }),
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] }),
      queryClient.invalidateQueries({ queryKey: ['daily-approval-check'] }),
      queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);

    // Force immediate refetch
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['expenses'] }),
      queryClient.refetchQueries({ queryKey: ['revenues'] }),
      queryClient.refetchQueries({ queryKey: ['profit-loss'] }),
      queryClient.refetchQueries({ queryKey: ['pending-approvals'] }),
      queryClient.refetchQueries({ queryKey: ['daily-approval-check'] }),
    ]);
  };

  // Enhanced cache invalidation for all staff data
  const invalidateAllStaffData = async () => {
    console.log('Invalidating all staff data for cross-user sync...');
    
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['staff'] }),
      queryClient.invalidateQueries({ queryKey: ['schedules'] }),
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);

    // Force immediate refetch
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['staff'] }),
      queryClient.refetchQueries({ queryKey: ['schedules'] }),
      queryClient.refetchQueries({ queryKey: ['leave-requests'] }),
    ]);
  };

  // Enhanced cache invalidation for all task data
  const invalidateAllTaskData = async () => {
    console.log('Invalidating all task data for cross-user sync...');
    
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['staff'] }),
      queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);

    // Force immediate refetch
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['tasks'] }),
      queryClient.refetchQueries({ queryKey: ['dashboard'] }),
    ]);
  };

  // Enhanced cache invalidation for all property data
  const invalidateAllPropertyData = async () => {
    console.log('Invalidating all property data for cross-user sync...');
    
    await Promise.all([
      // Check if property update is in progress before invalidating
      ...(window as any).__propertyUpdateInProgress ? [] : [queryClient.invalidateQueries({ queryKey: ['properties'] })],
      queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);

    // Force immediate refetch
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['properties'] }),
    ]);
  };

  // Enhanced cache invalidation for all user data
  const invalidateAllUserData = async () => {
    console.log('Invalidating all user data for cross-user sync...');
    
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);

    // Force immediate refetch
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['users'] }),
    ]);
  };

  // Universal cache invalidation for any data type
  const invalidateDataByType = async (dataType: string) => {
    console.log(`Invalidating ${dataType} data for cross-user sync...`);
    
    const queryKeys = {
      'finance': ['expenses', 'revenues', 'profit-loss', 'pending-approvals', 'daily-approval-check'],
      'staff': ['staff', 'schedules', 'leave-requests'],
      'tasks': ['tasks'],
      'properties': ['properties'],
      'users': ['users'],
      'analytics': ['analytics'],
      'dashboard': ['dashboard'],
      'all': ['expenses', 'revenues', 'profit-loss', 'pending-approvals', 'daily-approval-check', 'analytics', 'dashboard', 'properties', 'tasks', 'users', 'staff', 'schedules', 'leave-requests']
    };

    const keysToInvalidate = queryKeys[dataType as keyof typeof queryKeys] || queryKeys.all;
    
    await Promise.all(
      keysToInvalidate.map(key => 
        queryClient.invalidateQueries({ queryKey: [key] })
      )
    );

    // Force immediate refetch for critical queries
    const criticalKeys = ['dashboard', 'analytics'];
    await Promise.all(
      criticalKeys.map(key => 
        queryClient.refetchQueries({ queryKey: [key] })
      )
    );
  };

  return {
    refreshNow,
    isPolling,
    startRealTimeSync,
    stopRealTimeSync,
    invalidateAllFinanceData,
    invalidateAllStaffData,
    invalidateAllTaskData,
    invalidateAllPropertyData,
    invalidateAllUserData,
    invalidateDataByType,
  };
}

// Specialized hooks for common use cases
export function useTasksRealtime() {
  return useDashboardRealtime();
}

export function useStaffRealtime() {
  return useDashboardRealtime();
}

export function useFinanceRealtime() {
  return useDashboardRealtime();
}
