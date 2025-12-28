
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Button } from '@/components/ui/button';
import { User, LogOut } from 'lucide-react';
import { API_CONFIG } from '../../src/config/api';

export function MobileHeader() {
    const { user, logout } = useAuth();
    const { theme } = useTheme();
    const { title } = usePageTitle();

    return (
        <div className="sticky top-0 z-40 w-full h-[4.5rem] bg-white/80 backdrop-blur-md border-b border-gray-200 lg:hidden pt-safe transition-all duration-300">
            <div className="flex items-center justify-between px-4 h-full">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={logout}
                        className="rounded-full h-10 w-10 active:scale-95 transition-transform"
                    >
                        <LogOut className="h-5 w-5" />
                    </Button>

                    <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 shadow-sm">
                        <span className="text-sm font-semibold text-gray-700">
                            {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
