import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardData {
  pendingApprovals: number;
  urgentTasks: number;
  overdueTasks: number;
  financialPending: number;
  activeProperties: number;
  activeTasks: number;
}

interface UserData {
  name: string;
  role: string;
  hasProperties: boolean;
  propertyCount: number;
}

export function useWelcomePopup() {
  const { user, getAuthenticatedBackend } = useAuth();
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);

  // Fetch dashboard data for popup
  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.properties.list({});
    },
    enabled: !!user,
  });

  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.tasks.list({});
    },
    enabled: !!user,
  });

  const { data: expenses } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      return backend.finance.listExpenses({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
    },
    enabled: !!user && user.role === 'ADMIN',
  });

  const { data: revenues } = useQuery({
    queryKey: ['revenues'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      return backend.finance.listRevenues({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
    },
    enabled: !!user && user.role === 'ADMIN',
  });

  const { data: leaveRequests } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.listLeaveRequests({});
    },
    enabled: !!user,
  });

  // Process dashboard data with fallbacks
  const dashboardData: DashboardData = {
    pendingApprovals: (() => {
      const pendingExpenses = expenses?.expenses?.filter((expense: any) => 
        expense.status === 'pending'
      ) || [];
      
      const pendingRevenues = revenues?.revenues?.filter((revenue: any) => 
        (revenue as any).status === 'pending'
      ) || [];
      
      const pendingLeaveRequests = leaveRequests?.leaveRequests?.filter((leave: any) => 
        leave.status === 'pending'
      ) || [];
      
      return pendingExpenses.length + pendingRevenues.length + pendingLeaveRequests.length;
    })(),
    urgentTasks: tasks?.tasks?.filter((task: any) => 
      task.priority === 'high' && task.status !== 'done'
    ).length || 0,
    overdueTasks: tasks?.tasks?.filter((task: any) => 
      task.dueAt && new Date(task.dueAt) < new Date() && task.status !== 'done'
    ).length || 0,
    financialPending: (() => {
      const pendingExpenses = expenses?.expenses?.filter((expense: any) => 
        expense.status === 'pending'
      ) || [];
      
      const pendingRevenues = revenues?.revenues?.filter((revenue: any) => 
        (revenue as any).status === 'pending'
      ) || [];
      
      return pendingExpenses.length + pendingRevenues.length;
    })(),
    activeProperties: properties?.properties?.length || 0,
    activeTasks: tasks?.tasks?.filter((task: any) => task.status !== 'done').length || 0,
  };

  // Process user data
  const userData: UserData = {
    name: user?.displayName || 'User',
    role: user?.role || 'USER',
    hasProperties: (properties?.properties.length || 0) > 0,
    propertyCount: properties?.properties.length || 0,
  };

  // Show welcome popup after successful login
  useEffect(() => {
    console.log('Welcome popup effect:', { user: !!user, hasShownWelcome, showWelcomePopup });
    
    if (user && !hasShownWelcome) {
      console.log('Showing welcome popup...');
      // Show popup on every login for better UX
      const timer = setTimeout(() => {
        console.log('Setting welcome popup to true');
        setShowWelcomePopup(true);
        setHasShownWelcome(true);
      }, 100); // 100ms delay for smooth transition

      return () => clearTimeout(timer);
    }
  }, [user, hasShownWelcome]);

  // Reset welcome popup state when user logs out
  useEffect(() => {
    if (!user) {
      setShowWelcomePopup(false);
      setHasShownWelcome(false);
    }
  }, [user]);

  const closeWelcomePopup = useCallback(() => {
    setShowWelcomePopup(false);
  }, []);

  const resetWelcomePopup = useCallback(() => {
    setHasShownWelcome(false);
    setShowWelcomePopup(false);
    // Trigger the popup to show again
    setTimeout(() => {
      setShowWelcomePopup(true);
      setHasShownWelcome(true);
    }, 100);
  }, []);

  return {
    showWelcomePopup,
    closeWelcomePopup,
    resetWelcomePopup,
    dashboardData,
    userData,
    isLoading: false, // Don't block popup on data loading
  };
}
