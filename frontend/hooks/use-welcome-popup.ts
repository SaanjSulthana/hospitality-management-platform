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
  isNewUser: boolean;
  accountAge: number; // in days
  completedOnboardingSteps: string[];
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  required: boolean;
  action: {
    label: string;
    route: string;
  };
  icon: string;
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

  // Get completed onboarding steps from localStorage
  const getCompletedSteps = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem('completedOnboardingSteps') || '[]');
    } catch {
      return [];
    }
  };

  const completedSteps = getCompletedSteps();

  // Calculate account age and determine if user is new
  const accountAge = user?.createdAt ? 
    Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  // User is considered "new" if they haven't completed essential onboarding steps
  // For ADMIN: must have set up organization AND added at least one property
  // For MANAGER: must have completed profile AND viewed assigned properties
  const hasCompletedEssentialSteps = (() => {
    if (user?.role === 'ADMIN') {
      // Admin needs: organization setup + at least one property
      const hasOrgSetup = completedSteps.includes('setup-organization');
      const hasProperties = (properties?.properties.length || 0) > 0;
      return hasOrgSetup && hasProperties;
    } else {
      // Manager needs: profile completion + property viewing
      const hasProfileComplete = completedSteps.includes('complete-profile');
      const hasViewedProperties = completedSteps.includes('view-assigned-properties');
      return hasProfileComplete && hasViewedProperties;
    }
  })();
  
  const isNewUser = accountAge <= 7 && !hasCompletedEssentialSteps;

  // Process user data
  const userData: UserData = {
    name: user?.displayName || 'User',
    role: user?.role || 'USER',
    hasProperties: (properties?.properties.length || 0) > 0,
    propertyCount: properties?.properties.length || 0,
    isNewUser,
    accountAge,
    completedOnboardingSteps: completedSteps,
  };

  // Show welcome popup after successful login
  useEffect(() => {
    console.log('Welcome popup effect:', { user: !!user, hasShownWelcome, showWelcomePopup, isNewUser });
    
    if (user && !hasShownWelcome && isNewUser) {
      console.log('Showing welcome popup for new user...');
      // Only show popup for new users who haven't completed essential steps
      const timer = setTimeout(() => {
        console.log('Setting welcome popup to true');
        setShowWelcomePopup(true);
        setHasShownWelcome(true);
      }, 100); // 100ms delay for smooth transition

      return () => clearTimeout(timer);
    }
  }, [user, hasShownWelcome, isNewUser]);

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

  // Mark onboarding step as completed
  const markStepCompleted = useCallback((stepId: string) => {
    const currentSteps = getCompletedSteps();
    if (!currentSteps.includes(stepId)) {
      const updatedSteps = [...currentSteps, stepId];
      localStorage.setItem('completedOnboardingSteps', JSON.stringify(updatedSteps));
    }
  }, []);

  // Get onboarding steps based on user role and progress
  const getOnboardingSteps = useCallback((): OnboardingStep[] => {
    const steps: OnboardingStep[] = [];

    if (user?.role === 'ADMIN') {
      steps.push(
        {
          id: 'setup-organization',
          title: 'Set Up Your Organization',
          description: 'Configure your organization settings and branding',
          completed: completedSteps.includes('setup-organization'),
          required: true,
          action: { label: 'Configure', route: '/settings' },
          icon: '🏢'
        },
        {
          id: 'add-properties',
          title: 'Add Your First Property',
          description: 'Create your hotel, hostel, or resort listing',
          completed: userData.hasProperties,
          required: true,
          action: { label: 'Add Property', route: '/properties' },
          icon: '🏨'
        },
        {
          id: 'invite-team',
          title: 'Invite Team Members',
          description: 'Create manager accounts for your team',
          completed: completedSteps.includes('invite-team'),
          required: false,
          action: { label: 'Invite Team', route: '/users' },
          icon: '👥'
        },
        {
          id: 'create-first-task',
          title: 'Create Your First Task',
          description: 'Set up operational tasks and workflows',
          completed: completedSteps.includes('create-first-task'),
          required: false,
          action: { label: 'Create Task', route: '/tasks' },
          icon: '✅'
        }
      );
    } else {
      // Manager-specific steps
      steps.push(
        {
          id: 'complete-profile',
          title: 'Complete Your Profile',
          description: 'Update your personal information and preferences',
          completed: completedSteps.includes('complete-profile'),
          required: true,
          action: { label: 'Update Profile', route: '/settings' },
          icon: '👤'
        },
        {
          id: 'view-assigned-properties',
          title: 'View Assigned Properties',
          description: 'Check out the properties you can manage',
          completed: completedSteps.includes('view-assigned-properties'),
          required: true,
          action: { label: 'View Properties', route: '/properties' },
          icon: '🏨'
        },
        {
          id: 'create-first-task',
          title: 'Create Your First Task',
          description: 'Set up operational tasks for your properties',
          completed: completedSteps.includes('create-first-task'),
          required: false,
          action: { label: 'Create Task', route: '/tasks' },
          icon: '✅'
        }
      );
    }

    return steps;
  }, [user?.role, userData.hasProperties, completedSteps]);

  // Auto-mark steps as completed when conditions are met
  useEffect(() => {
    if (!user || !markStepCompleted) return;

    // Auto-complete steps based on actual data
    if (user.role === 'ADMIN') {
      // Auto-complete property step if user has properties
      if (userData.hasProperties && !completedSteps.includes('add-properties')) {
        markStepCompleted('add-properties');
      }
    } else {
      // Auto-complete property viewing step if user has viewed properties
      // This could be triggered when user visits /properties page
      if (completedSteps.includes('view-assigned-properties') && !completedSteps.includes('view-assigned-properties')) {
        markStepCompleted('view-assigned-properties');
      }
    }
  }, [user, userData.hasProperties, completedSteps, markStepCompleted]);

  // Function to mark essential steps as completed (can be called from other components)
  const markEssentialStepCompleted = useCallback((stepId: string) => {
    if (markStepCompleted) {
      markStepCompleted(stepId);
    }
  }, [markStepCompleted]);

  return {
    showWelcomePopup,
    closeWelcomePopup,
    resetWelcomePopup,
    dashboardData,
    userData,
    isLoading: false, // Don't block popup on data loading
    onboardingSteps: getOnboardingSteps(),
    markStepCompleted,
    markEssentialStepCompleted, // Export this for use in other components
  };
}
