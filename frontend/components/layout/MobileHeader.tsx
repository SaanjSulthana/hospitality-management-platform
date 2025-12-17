
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
        <div className="sticky top-0 z-40 w-full h-14 bg-white/80 backdrop-blur-md border-b border-gray-200 lg:hidden safe-area-top">
            <div className="flex h-14 items-center justify-between px-4">
                {/* Left: Brand/Logo or Page Title */}
                <div className="flex items-center gap-2">
                    {theme.logoUrl ? (
                        <img
                            src={theme.logoUrl.startsWith('http') ? theme.logoUrl : `${API_CONFIG.BASE_URL}${theme.logoUrl}`}
                            alt={theme.brandName}
                            className="h-8 w-auto object-contain max-w-[120px]"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                        />
                    ) : null}
                    <span className={`font-bold text-lg truncate ${theme.logoUrl ? 'hidden' : ''}`} style={{ color: theme.primaryColor }}>
                        {theme.brandName}
                    </span>
                </div>

                {/* Center: Page Title (if distinct from brand, optional) */}
                {/* Simplified: Just keep brand on left for now, or maybe title? 
            Let's stick to Brand on left for "App" feel. 
        */}

                {/* Right: Profile Actions */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={logout}
                        className="rounded-full h-8 w-8"
                    >
                        <LogOut className="h-4 w-4" />
                    </Button>

                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                        <span className="text-xs font-medium text-gray-600">
                            {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
