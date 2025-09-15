import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, TrendingUp, AlertCircle, CheckCircle, CheckSquare, Building2, Users, Plus, ArrowRight, FileText } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent } from './card';
import { Badge } from './badge';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';

interface WelcomePopupProps {
  isOpen: boolean;
  onClose: () => void;
  userData?: {
    name: string;
    role: string;
    hasProperties: boolean;
    propertyCount: number;
    isNewUser: boolean;
    accountAge: number;
    completedOnboardingSteps: string[];
  };
  dashboardData?: {
    pendingApprovals: number;
    urgentTasks: number;
    overdueTasks: number;
    financialPending: number;
    activeProperties: number;
    activeTasks: number;
  };
  onboardingSteps?: Array<{
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
  }>;
  markStepCompleted?: (stepId: string) => void;
}

interface ImportantItem {
  id: string;
  title: string;
  description: string;
  count: number;
  priority: 'high' | 'medium' | 'low';
  icon: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function WelcomePopup({ isOpen, onClose, userData, dashboardData, onboardingSteps, markStepCompleted }: WelcomePopupProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when popup is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getImportantItems = (): ImportantItem[] => {
    if (!dashboardData) return [];

    const items: ImportantItem[] = [];

    // Pending Approvals (High Priority)
    if (dashboardData.pendingApprovals > 0) {
      items.push({
        id: 'pending-approvals',
        title: 'Pending Approvals',
        description: 'Items requiring your attention',
        count: dashboardData.pendingApprovals,
        priority: 'high',
        icon: <AlertCircle className="h-4 w-4 text-red-500" />,
        action: {
          label: 'Review Now',
          onClick: () => {
            navigate('/finance');
            onClose();
          }
        }
      });
    }

    // Urgent Tasks (High Priority)
    if (dashboardData.urgentTasks > 0) {
      items.push({
        id: 'urgent-tasks',
        title: 'Urgent Tasks',
        description: 'High priority tasks due soon',
        count: dashboardData.urgentTasks,
        priority: 'high',
        icon: <Clock className="h-4 w-4 text-orange-500" />,
        action: {
          label: 'View Tasks',
          onClick: () => {
            navigate('/tasks');
            onClose();
          }
        }
      });
    }

    // Overdue Tasks (High Priority)
    if (dashboardData.overdueTasks > 0) {
      items.push({
        id: 'overdue-tasks',
        title: 'Overdue Tasks',
        description: 'Tasks past their due date',
        count: dashboardData.overdueTasks,
        priority: 'high',
        icon: <AlertCircle className="h-4 w-4 text-red-500" />,
        action: {
          label: 'View Tasks',
          onClick: () => {
            navigate('/tasks');
            onClose();
          }
        }
      });
    }

    // Financial Pending (Medium Priority)
    if (dashboardData.financialPending > 0) {
      items.push({
        id: 'financial-pending',
        title: 'Financial Pending',
        description: 'Expenses and revenues awaiting approval',
        count: dashboardData.financialPending,
        priority: 'medium',
        icon: <TrendingUp className="h-4 w-4 text-blue-500" />,
        action: {
          label: 'Review Finance',
          onClick: () => {
            navigate('/finance');
            onClose();
          }
        }
      });
    }

    // If no urgent items, show general stats with actions
    if (items.length === 0) {
      items.push({
        id: 'active-tasks',
        title: 'Active Tasks',
        description: 'Tasks in progress',
        count: dashboardData.activeTasks,
        priority: 'low',
        icon: <CheckSquare className="h-4 w-4 text-blue-500" />,
        action: {
          label: 'View All',
          onClick: () => {
            navigate('/tasks');
            onClose();
          }
        }
      });
    }

    return items.slice(0, 3); // Show max 3 items
  };

  const getOnboardingActions = () => {
    if (userData?.hasProperties) return null;

    const actions = [
      {
        id: 'create-property',
        title: 'Add Your First Property',
        description: 'Set up your hotel, hostel, resort, or apartment',
        icon: <Building2 className="h-6 w-6 text-blue-500" />,
        action: () => {
          navigate('/properties');
          onClose();
        }
      },
      {
        id: 'create-task',
        title: 'Create Your First Task',
        description: 'Start managing operations and workflows',
        icon: <Plus className="h-6 w-6 text-green-500" />,
        action: () => {
          navigate('/tasks');
          onClose();
        }
      }
    ];

    // Add team management for admins
    if (userData?.role === 'ADMIN') {
      actions.splice(1, 0, {
        id: 'invite-team',
        title: 'Invite Team Members',
        description: 'Create manager accounts for your team',
        icon: <Users className="h-6 w-6 text-purple-500" />,
        action: () => {
          navigate('/users');
          onClose();
        }
      });
    }

    return actions;
  };

  const importantItems = getImportantItems();
  const onboardingActions = getOnboardingActions();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.1 }}
            className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden ring-1 ring-black ring-opacity-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative p-4 sm:p-6 pb-3 sm:pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                      {(userData?.name || user?.displayName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {getGreeting()}, {userData?.name || user?.displayName}! 👋
                      </h2>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>{currentTime.toLocaleDateString()} • {currentTime.toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    {userData?.role || user?.role}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="px-4 sm:px-6 pb-4 overflow-y-auto max-h-[calc(95vh-180px)] sm:max-h-[calc(90vh-200px)]">
              {/* Welcome Message for New Users */}
              {userData?.isNewUser && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🎉</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        Welcome to Your Hospitality Management Platform!
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Let's get you set up in just a few steps. This will help you manage your properties, staff, and operations efficiently.
                      </p>
                      <div className="flex items-center gap-2 text-xs text-blue-600">
                        <Clock className="h-3 w-3" />
                        <span>Account created {userData.accountAge === 0 ? 'today' : `${userData.accountAge} day${userData.accountAge === 1 ? '' : 's'} ago`}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Onboarding Steps for New Users */}
              {userData?.isNewUser && onboardingSteps && onboardingSteps.length > 0 && (
                <div className="mb-4 sm:mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 sm:mb-3 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" style={{ color: theme.primaryColor }} />
                    Getting Started Checklist
                  </h3>
                  <div className="space-y-2">
                    {onboardingSteps.map((step, index) => (
                      <div 
                        key={step.id} 
                        className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-md ${
                          step.completed 
                            ? 'border-green-200 bg-green-50 hover:bg-green-100' 
                            : step.required
                            ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                            : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                        }`}
                        onClick={() => {
                          navigate(step.action.route);
                          if (markStepCompleted && !step.completed) {
                            markStepCompleted(step.id);
                          }
                          onClose();
                        }}
                      >
                        <div className="flex-shrink-0">
                          {step.completed ? (
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-white" />
                            </div>
                          ) : (
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                              step.required ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'
                            }`}>
                              {index + 1}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{step.icon}</span>
                            <h4 className={`font-medium text-sm ${step.completed ? 'text-green-900' : 'text-gray-900'}`}>
                              {step.title}
                            </h4>
                            {step.required && !step.completed && (
                              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-200">
                                Required
                              </Badge>
                            )}
                          </div>
                          <p className={`text-xs ${step.completed ? 'text-green-700' : 'text-gray-600'}`}>
                            {step.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-medium" style={{ color: theme.primaryColor }}>
                          {step.action.label}
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-3 sm:mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                      <span>Setup Progress</span>
                      <span>{onboardingSteps.filter(s => s.completed).length} of {onboardingSteps.length} completed</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${(onboardingSteps.filter(s => s.completed).length / onboardingSteps.length) * 100}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Important Items for Existing Users */}
              {!userData?.isNewUser && importantItems.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" style={{ color: theme.primaryColor }} />
                    Today's Priorities
                  </h3>
                  <div className="space-y-2">
                    {importantItems.slice(0, 2).map((item) => (
                      <div 
                        key={item.id} 
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer hover:shadow-md transition-all duration-200 ${
                          item.priority === 'high' ? 'border-red-200 bg-red-50 hover:bg-red-100' :
                          item.priority === 'medium' ? 'border-orange-200 bg-orange-50 hover:bg-orange-100' :
                          'border-blue-200 bg-blue-50 hover:bg-blue-100'
                        }`}
                        onClick={item.action?.onClick}
                      >
                        <div className="flex items-center gap-3">
                          {item.icon}
                          <div>
                            <h4 className="font-medium text-sm text-gray-900">{item.title}</h4>
                            <p className="text-xs text-gray-600">{item.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-lg font-bold" style={{ color: theme.primaryColor }}>
                              {item.count}
                            </div>
                          </div>
                          {item.action && (
                            <div className="flex items-center gap-1 text-xs font-medium" style={{ color: theme.primaryColor }}>
                              {item.action.label}
                              <ArrowRight className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Stats - Only show for users with data */}
              {!userData?.isNewUser && (
                <div className="grid grid-cols-3 gap-3">
                  <div 
                    className="text-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 hover:shadow-md transition-all duration-200"
                    onClick={() => {
                      navigate('/tasks');
                      onClose();
                    }}
                  >
                    <div className="text-lg font-bold" style={{ color: theme.primaryColor }}>
                      {dashboardData?.activeTasks || 0}
                    </div>
                    <div className="text-xs text-gray-600">Tasks</div>
                  </div>
                  <div 
                    className="text-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 hover:shadow-md transition-all duration-200"
                    onClick={() => {
                      navigate('/finance');
                      onClose();
                    }}
                  >
                    <div className="text-lg font-bold" style={{ color: theme.primaryColor }}>
                      {dashboardData?.pendingApprovals || 0}
                    </div>
                    <div className="text-xs text-gray-600">Pending</div>
                  </div>
                  <div 
                    className="text-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 hover:shadow-md transition-all duration-200"
                    onClick={() => {
                      navigate('/tasks');
                      onClose();
                    }}
                  >
                    <div className="text-lg font-bold" style={{ color: theme.primaryColor }}>
                      {dashboardData?.urgentTasks || 0}
                    </div>
                    <div className="text-xs text-gray-600">Urgent</div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {userData?.isNewUser 
                    ? "Ready to get started with your hospitality management?" 
                    : "Ready to manage your operations?"
                  }
                </p>
                <Button
                  onClick={() => {
                    if (userData?.isNewUser) {
                      // For new users, navigate to the first incomplete required step
                      const firstIncompleteStep = onboardingSteps?.find(step => step.required && !step.completed);
                      if (firstIncompleteStep) {
                        navigate(firstIncompleteStep.action.route);
                      } else {
                        navigate('/dashboard');
                      }
                    } else {
                      // For existing users, navigate to dashboard or first available section
                      if (dashboardData?.pendingApprovals && dashboardData.pendingApprovals > 0) {
                        navigate('/finance');
                      } else if (dashboardData?.urgentTasks && dashboardData.urgentTasks > 0) {
                        navigate('/tasks');
                      } else {
                        navigate('/dashboard');
                      }
                    }
                    onClose();
                  }}
                  className="h-8 px-4 text-sm font-medium"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  {userData?.isNewUser ? "Start Setup" : "Let's Go!"}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
