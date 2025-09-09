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
  };
  dashboardData?: {
    pendingApprovals: number;
    urgentTasks: number;
    overdueTasks: number;
    financialPending: number;
    activeProperties: number;
    activeTasks: number;
  };
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

export function WelcomePopup({ isOpen, onClose, userData, dashboardData }: WelcomePopupProps) {
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
          className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
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
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 ring-1 ring-black ring-opacity-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative p-6 pb-4">
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
            <div className="px-6 pb-4">
              {/* Important Items for Today */}
              {importantItems.length > 0 && (
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

              {/* Onboarding Actions for New Users */}
              {onboardingActions && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" style={{ color: theme.primaryColor }} />
                    Quick Start
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {onboardingActions.slice(0, 2).map((action) => (
                      <div key={action.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer" onClick={action.action}>
                        <div className="flex-shrink-0">
                          {action.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm text-gray-900">{action.title}</h4>
                          <p className="text-xs text-gray-600">{action.description}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions for Existing Users */}
              {!onboardingActions && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" style={{ color: theme.primaryColor }} />
                    Quick Actions
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div 
                      className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => {
                        navigate('/tasks');
                        onClose();
                      }}
                    >
                      <CheckSquare className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-gray-900">Tasks</span>
                    </div>
                    <div 
                      className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => {
                        navigate('/finance');
                        onClose();
                      }}
                    >
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-gray-900">Finance</span>
                    </div>
                    <div 
                      className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => {
                        navigate('/reports');
                        onClose();
                      }}
                    >
                      <FileText className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium text-gray-900">Reports</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Stats */}
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
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Ready to manage your operations?
                </p>
                <Button
                  onClick={() => {
                    // Navigate to dashboard or first available section
                    if (dashboardData?.pendingApprovals && dashboardData.pendingApprovals > 0) {
                      navigate('/finance');
                    } else if (dashboardData?.urgentTasks && dashboardData.urgentTasks > 0) {
                      navigate('/tasks');
                    } else {
                      navigate('/dashboard');
                    }
                    onClose();
                  }}
                  className="h-8 px-4 text-sm font-medium"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  Let's Go!
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
