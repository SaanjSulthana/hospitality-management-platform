import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';
import { LogoutProgress } from '@/components/ui/logout-progress';
import { useWelcomePopup } from '@/hooks/use-welcome-popup';
import { WelcomePopup } from '@/components/ui/welcome-popup';
import { API_CONFIG } from '../src/config/api';
import { 
  LayoutDashboard, 
  Building2, 
  CheckSquare, 
  Users, 
  BarChart3, 
  Settings, 
  Menu,
  LogOut,
  User,
  Shield,
  Receipt,
  UserCheck,
  Kanban,
  ClipboardCheck
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Properties', href: '/properties', icon: Building2, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Guest Check-in', href: '/guest-checkin', icon: ClipboardCheck, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Task Board', href: '/task-management', icon: Kanban, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Finance', href: '/finance', icon: Receipt, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Staff', href: '/staff', icon: UserCheck, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Users', href: '/users', icon: Users, roles: ['ADMIN'] },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['ADMIN'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['ADMIN'] },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'offline'>('good');
  const { user, logout, showLogoutProgress, setShowLogoutProgress } = useAuth();
  const { theme } = useTheme();
  const { title, description } = usePageTitle();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { showWelcomePopup, closeWelcomePopup, resetWelcomePopup, dashboardData, userData, onboardingSteps, markStepCompleted, isLoading: welcomeLoading } = useWelcomePopup();

  // Enhanced prop validation and logging (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && showLogoutProgress) {
      console.log('🏗️ Layout showLogoutProgress changed:', {
        showLogoutProgress,
        isLoggingOut,
        user: !!user,
        timestamp: new Date().toISOString()
      });
    }
  }, [showLogoutProgress, isLoggingOut, user]);
  
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && showLogoutProgress) {
      console.log('🔄 Layout render - props validation:', {
        showLogoutProgress,
        isLoggingOut,
        user: !!user,
        location: location.pathname,
        timestamp: new Date().toISOString()
      });
    }
  }, [showLogoutProgress, isLoggingOut, user, location.pathname]);


  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Monitor internet connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionQuality('good');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionQuality('offline');
    };

    // Check connection quality using navigator.connection if available
    const checkConnectionQuality = () => {
      if (!navigator.onLine) {
        setConnectionQuality('offline');
        return;
      }

      // @ts-ignore - navigator.connection is not in TypeScript types but exists in modern browsers
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      
      if (connection) {
        const { effectiveType, downlink } = connection;
        if (effectiveType === '4g' && downlink > 10) {
          setConnectionQuality('excellent');
        } else if (effectiveType === '4g' || effectiveType === '3g') {
          setConnectionQuality('good');
        } else {
          setConnectionQuality('poor');
        }
      } else {
        // Fallback: assume good connection if we're online
        setConnectionQuality('good');
      }
    };

    // Initial check
    checkConnectionQuality();

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check connection quality periodically
    const connectionTimer = setInterval(checkConnectionQuality, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(connectionTimer);
    };
  }, []);

  // Listen for theme changes to force re-render
  useEffect(() => {
    const handleThemeChange = (event: CustomEvent) => {
      console.log('Theme changed in Layout:', event.detail);
      // Force a re-render by updating a state variable
      setCurrentTime(new Date());
    };

    const handleThemeUpdate = (event: CustomEvent) => {
      console.log('Theme updated in Layout:', event.detail);
      // Force a re-render by updating a state variable
      setCurrentTime(new Date());
    };

    const handleThemeReload = (event: CustomEvent) => {
      console.log('Theme reloaded in Layout:', event.detail);
      // Force a re-render by updating a state variable
      setCurrentTime(new Date());
    };

    const handleLogoLoadFailed = () => {
      console.log('Logo load failed, forcing re-render');
      // Force a re-render to show fallback icon
      setCurrentTime(new Date());
    };

    window.addEventListener('themeChanged', handleThemeChange as EventListener);
    window.addEventListener('themeUpdated', handleThemeUpdate as EventListener);
    window.addEventListener('themeReloaded', handleThemeReload as EventListener);
    window.addEventListener('logoLoadFailed', handleLogoLoadFailed);
    
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange as EventListener);
      window.removeEventListener('themeUpdated', handleThemeUpdate as EventListener);
      window.removeEventListener('themeReloaded', handleThemeReload as EventListener);
      window.removeEventListener('logoLoadFailed', handleLogoLoadFailed);
    };
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut || showLogoutProgress) {
      console.log('🚪 Logout already in progress, ignoring click');
      return;
    }
    
    console.log('🚪 Starting logout process...');
    setIsLoggingOut(true);
    
    try {
      // Start progress dialog immediately (like login does)
      setShowLogoutProgress(true);
      
      // Add a small delay to let the progress dialog appear
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('🚪 Calling logout function...');
      await logout();
      console.log('🚪 Logout function completed');
    } catch (error) {
      console.error('🚪 Logout error:', error);
      setShowLogoutProgress(false);
      setIsLoggingOut(false);
      toast({
        title: "Logout failed",
        description: "There was an error logging out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLogoutComplete = () => {
    console.log('Logout progress completed, closing dialog and redirecting...');
    setShowLogoutProgress(false);
    setIsLoggingOut(false);
    toast({
      title: "Logged out successfully",
      description: "You have been signed out of your account.",
    });
    navigate('/login', { replace: true });
  };

  const handleLogoutCancel = () => {
    setShowLogoutProgress(false);
    setIsLoggingOut(false);
    toast({
      title: "Logout cancelled",
      description: "Logout process was cancelled.",
    });
  };

  // Prop validation for LogoutProgress
  const logoutProgressProps = {
    isOpen: showLogoutProgress,
    onComplete: handleLogoutComplete,
    onCancel: handleLogoutCancel
  };

  useEffect(() => {
    console.log('📋 LogoutProgress props validation:', {
      isOpen: logoutProgressProps.isOpen,
      onComplete: typeof logoutProgressProps.onComplete,
      onCancel: typeof logoutProgressProps.onCancel,
      allPropsValid: typeof logoutProgressProps.onComplete === 'function' && 
                     typeof logoutProgressProps.onCancel === 'function' &&
                     typeof logoutProgressProps.isOpen === 'boolean'
    });
  }, [logoutProgressProps.isOpen]);



  const filteredNavigation = navigation.filter((item: any) => {
    return item.roles.includes(user?.role || '');
  });

  const getRoleDisplayName = (role: string) => {
    // Handle role display names properly
    switch (role) {
      case 'ADMIN':
        return 'Admin';
      case 'MANAGER':
        return 'Manager';
      case 'SUPER_ADMIN':
        return 'Admin'; // Map SUPER_ADMIN to Admin for display
      default:
        return role.charAt(0) + role.slice(1).toLowerCase();
    }
  };

  const getRoleIcon = (role: string) => {
    return (role === 'ADMIN' || role === 'SUPER_ADMIN') ? Shield : User;
  };

  const getDynamicGreeting = () => {
    const hour = new Date().getHours();
    const greetings = {
      morning: [
        "Good morning",
        "Rise and shine",
        "Morning vibes",
        "Hello sunshine",
        "Fresh start",
        "Good day ahead",
        "Morning energy",
        "Bright and early"
      ],
      afternoon: [
        "Good afternoon",
        "Afternoon vibes",
        "Hello there",
        "Midday energy",
        "Afternoon flow",
        "Good day",
        "Hello sunshine",
        "Afternoon boost"
      ],
      evening: [
        "Good evening",
        "Evening vibes",
        "Hello there",
        "Evening flow",
        "Good night ahead",
        "Evening energy",
        "Hello friend",
        "Evening calm"
      ],
      night: [
        "Good evening",
        "Night vibes",
        "Hello night owl",
        "Evening flow",
        "Night energy",
        "Hello there",
        "Evening calm",
        "Night mode"
      ]
    };

    let timeCategory: keyof typeof greetings;
    if (hour >= 5 && hour < 12) {
      timeCategory = 'morning';
    } else if (hour >= 12 && hour < 17) {
      timeCategory = 'afternoon';
    } else if (hour >= 17 && hour < 22) {
      timeCategory = 'evening';
    } else {
      timeCategory = 'night';
    }

    const timeGreetings = greetings[timeCategory];
    const randomIndex = Math.floor(Math.random() * timeGreetings.length);
    return timeGreetings[randomIndex];
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-4 h-20 border-b">
        <Link 
          to="/dashboard" 
          className="flex items-center space-x-3 hover:opacity-80 transition-opacity duration-200"
          onClick={() => mobile && setSidebarOpen(false)}
          title={`Go to Dashboard - ${theme.brandName}`}
        >
          {(() => {
             try {
               // Check if logo has failed to load
               const logoFailed = theme.logoUrl && document.querySelector(`img[data-load-failed="true"][src*="${theme.logoUrl}"]`);
               
               if (theme.logoUrl && theme.logoUrl.trim() !== '' && !logoFailed) {
                 return (
                   <img 
                     src={theme.logoUrl.startsWith('http') ? theme.logoUrl : `${API_CONFIG.BASE_URL}${theme.logoUrl}`} 
                     alt={theme.brandName} 
                     className="h-8 w-8 object-contain" 
                     onError={async (e) => {
                       try {
                         // Check if currentTarget exists before proceeding
                         if (!e.currentTarget) {
                           console.error('Logo error handler: currentTarget is null');
                           return;
                         }
                         
                         // Check if we've already failed to load this logo
                         if (e.currentTarget.getAttribute('data-load-failed') === 'true') {
                           console.log('Logo already failed to load, skipping retry');
                           return;
                         }
                         
                         console.error('Logo failed to load:', theme.logoUrl);
                         
                         // Try to fetch the logo using the serve_logo API
                         if (theme.logoUrl && !theme.logoUrl.startsWith('http')) {
                           console.log('Attempting to fetch logo via API:', theme.logoUrl);
                           
                           // Handle different URL formats
                           let orgId, filename;
                           if (theme.logoUrl.includes('/uploads/logos/')) {
                             const urlParts = theme.logoUrl.split('/uploads/logos/');
                             if (urlParts.length > 1) {
                               const pathParts = urlParts[1].split('/');
                               orgId = pathParts[0];
                               filename = pathParts[1];
                             }
                           } else if (theme.logoUrl.startsWith('/uploads/logos/')) {
                             const urlParts = theme.logoUrl.split('/');
                             orgId = urlParts[3];
                             filename = urlParts[4];
                           }
                           
                           console.log('Parsed logo path:', { orgId, filename, originalUrl: theme.logoUrl });
                           
                           if (orgId && filename) {
                             const response = await fetch(`${API_CONFIG.BASE_URL}/uploads/logos/${orgId}/${filename}`, {
                               headers: {
                                 'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                               },
                             });
                             
                             if (response.ok) {
                               const result = await response.json();
                               const dataUrl = `data:${result.mimeType};base64,${result.fileData}`;
                               // Double-check currentTarget still exists before using it
                               if (e.currentTarget) {
                                 e.currentTarget.src = dataUrl;
                                 console.log('Logo loaded successfully via API in Layout');
                                 return;
                               }
                             } else {
                               console.error('Logo API response not ok:', response.status, response.statusText);
                             }
                           } else {
                             console.error('Could not parse logo URL:', theme.logoUrl);
                           }
                         }
                       } catch (error) {
                         console.error('Failed to fetch logo via API:', error);
                       }
                       
                       // Set a flag to prevent further attempts - double-check currentTarget exists
                       if (e.currentTarget) {
                         e.currentTarget.setAttribute('data-load-failed', 'true');
                         // Force re-render to show fallback icon
                         const event = new CustomEvent('logoLoadFailed');
                         window.dispatchEvent(event);
                       }
                     }}
                     onLoad={() => console.log('Logo loaded successfully in Layout')}
                   />
                 );
               }
               
               // Show fallback icon if no logo or logo failed
               return (
                 <Building2 className="h-8 w-8" style={{ color: theme.primaryColor }} />
               );
             } catch (error) {
               console.error('Error rendering logo:', error);
               // Fallback to building icon on any error
               return (
                 <Building2 className="h-8 w-8" style={{ color: theme.primaryColor }} />
               );
             }
           })()}
          <span className="text-xl font-bold" style={{ color: theme.textColor }}>
            {theme.brandName}
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
                        {filteredNavigation.map((item: any) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => mobile && setSidebarOpen(false)}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors group ${
                isActive
                  ? 'text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              style={isActive ? { backgroundColor: theme.primaryColor } : {}}
              title={item.name}
            >
              <Icon className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t">
        <div className="flex items-center space-x-2 px-3 py-2 mb-2">
          {React.createElement(getRoleIcon(user?.role || ''), { className: "h-4 w-4 text-gray-500 flex-shrink-0" })}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate" title={user?.displayName}>
              {user?.displayName}
            </p>
            <p className="text-xs text-gray-500 truncate" title={getRoleDisplayName(user?.role || '')}>
              {getRoleDisplayName(user?.role || '')}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut || showLogoutProgress}
          className={`w-full justify-start ${
            isLoggingOut || showLogoutProgress 
              ? 'text-gray-400 cursor-not-allowed' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
          title={isLoggingOut || showLogoutProgress ? 'Signing out...' : 'Sign out'}
        >
          <LogOut className="mr-2 h-4 w-4 flex-shrink-0" />
          <span className="truncate">{isLoggingOut || showLogoutProgress ? 'Signing out...' : 'Sign out'}</span>
        </Button>
        
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-60 lg:flex-col">
        <div 
          className="flex flex-col flex-grow bg-white border-r border-gray-200 overflow-y-auto"
          style={{ 
            boxShadow: `2px 0 4px 0 ${theme.primaryColor}20, 1px 0 2px 0 ${theme.primaryColor}10`
          }}
        >
          <Sidebar />
        </div>
      </div>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent 
          side="left" 
          className="p-0 w-60"
          style={{ 
            boxShadow: `2px 0 4px 0 ${theme.primaryColor}20, 1px 0 2px 0 ${theme.primaryColor}10`
          }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Main menu</SheetDescription>
          </SheetHeader>
          <Sidebar mobile />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="lg:pl-60 flex flex-col flex-1">
        {/* Top bar */}
        <div 
          className="sticky top-0 z-10 flex-shrink-0 flex h-20 bg-white border-b border-gray-200"
          style={{ 
            boxShadow: `0 1px 3px 0 ${theme.primaryColor}20, 0 1px 2px 0 ${theme.primaryColor}10`
          }}
        >
          <div className="lg:hidden ml-4 flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>
          
          <div className="flex-1 px-4 flex items-center justify-between relative h-20">
            {/* Left side - Welcome */}
            <div className="flex items-center gap-4 min-w-0 flex-shrink-0 z-10 h-full">
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-600 h-full">
                <span>{getDynamicGreeting()},</span>
                <span className="font-medium" style={{ color: theme.primaryColor }}>
                  {user?.displayName}
                </span>
              </div>
            </div>

            {/* Center - Page Title and Description - Absolutely positioned for stability */}
            <div className="hidden lg:flex absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center px-4 z-20">
              {title && (
                <div className="text-center">
                  <h1 className="text-2xl lg:text-3xl font-bold truncate mb-1 drop-shadow-sm" style={{ color: theme.primaryColor }}>
                    {title}
                  </h1>
                  {description && (
                    <p className="text-xs lg:text-sm text-gray-600 truncate font-medium">
                      {description}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right side - Status and Actions */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-shrink-0 z-10 h-full">
              {/* Live Date and Time */}
              <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 h-full">
                <div className="flex items-center gap-2">
                  <span>{currentTime.toLocaleDateString()}</span>
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span>{currentTime.toLocaleTimeString()}</span>
                </div>
              </div>

              {/* User Info */}
              <div className="flex items-center space-x-3 h-full">
                <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-100 h-8">
                  {React.createElement(getRoleIcon(user?.role || ''), { 
                    className: "h-4 w-4",
                    style: { color: theme.primaryColor }
                  })}
                  <span className="text-sm font-medium text-gray-700">
                    {getRoleDisplayName(user?.role || '')}
                  </span>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  disabled={isLoggingOut || showLogoutProgress}
                  className="text-gray-600 hover:text-gray-900"
                  style={{ 
                    backgroundColor: isLoggingOut || showLogoutProgress ? theme.primaryColor + '20' : undefined,
                    color: isLoggingOut || showLogoutProgress ? theme.primaryColor : undefined
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>


                
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Page Title - Only show on smaller screens */}
        {title && (
          <div 
            className="lg:hidden bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 px-4 py-4 shadow-sm"
            style={{ 
              boxShadow: `0 1px 3px 0 ${theme.primaryColor}20, 0 1px 2px 0 ${theme.primaryColor}10`
            }}
          >
            <div className="text-center">
              <h1 className="text-2xl font-bold truncate mb-1 drop-shadow-sm" style={{ color: theme.primaryColor }}>
                {title}
              </h1>
              {description && (
                <p className="text-xs text-gray-600 truncate font-medium">
                  {description}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1">
          <div className="py-6">
            <div className="w-full px-0 sm:px-4 lg:max-w-7xl lg:mx-auto lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
      
        {/* Logout Progress Dialog */}
        <LogoutProgress
          {...logoutProgressProps}
        />
      
      {/* Welcome Popup - Global */}
      <WelcomePopup
        isOpen={showWelcomePopup}
        onClose={closeWelcomePopup}
        userData={userData}
        dashboardData={dashboardData}
        onboardingSteps={onboardingSteps}
        markStepCompleted={markStepCompleted}
      />
    </div>
  );
}
