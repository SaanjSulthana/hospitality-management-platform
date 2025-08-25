import React, { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';
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
  DollarSign,
  UserCheck
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Properties', href: '/properties', icon: Building2, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Finance', href: '/finance', icon: DollarSign, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Staff', href: '/staff', icon: UserCheck, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Users', href: '/users', icon: Users, roles: ['ADMIN'] },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['ADMIN'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['ADMIN'] },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    try {
      await logout();
      toast({
        title: "Logged out successfully",
        description: "You have been signed out of your account.",
      });
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: "There was an error signing you out. Please try again.",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const filteredNavigation = navigation.filter(item => {
    return item.roles.includes(user?.role || '');
  });

  const getRoleDisplayName = (role: string) => {
    return role.charAt(0) + role.slice(1).toLowerCase();
  };

  const getRoleIcon = (role: string) => {
    return role === 'ADMIN' ? Shield : User;
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-6 py-4 border-b">
        <div className="flex items-center space-x-3">
          {theme.logoUrl ? (
            <img src={theme.logoUrl} alt={theme.brandName} className="h-8 w-8" />
          ) : (
            <Building2 className="h-8 w-8" style={{ color: theme.primaryColor }} />
          )}
          <span className="text-xl font-bold" style={{ color: theme.textColor }}>
            {theme.brandName}
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {filteredNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => mobile && setSidebarOpen(false)}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              style={isActive ? { backgroundColor: theme.primaryColor } : {}}
            >
              <Icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t">
        <div className="flex items-center space-x-3 px-3 py-2 mb-2">
          {React.createElement(getRoleIcon(user?.role || ''), { className: "h-5 w-5 text-gray-500" })}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.displayName}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {getRoleDisplayName(user?.role || '')}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full justify-start text-gray-600 hover:text-gray-900"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isLoggingOut ? 'Signing out...' : 'Sign out'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 overflow-y-auto">
          <Sidebar />
        </div>
      </div>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Main menu</SheetDescription>
          </SheetHeader>
          <Sidebar mobile />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white border-b border-gray-200">
          <div className="lg:hidden ml-4 flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>
          
          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex-1" />
            <div className="ml-4 flex items-center md:ml-6">
              <span className="text-sm text-gray-500 flex items-center gap-2">
                {React.createElement(getRoleIcon(user?.role || ''), { className: "h-4 w-4" })}
                Welcome back, {user?.displayName}
              </span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
