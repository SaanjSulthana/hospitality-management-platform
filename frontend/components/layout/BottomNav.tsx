import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import {
    House,
    Building,
    IndianRupee,
    CircleCheck,
    Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavProps {
    onMenuClick: () => void;
}

export function BottomNav({ onMenuClick }: BottomNavProps) {
    const { theme } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();

    const navItems = [
        { name: 'Home', href: '/dashboard', icon: House },
        { name: 'Properties', href: '/properties', icon: Building },
        { name: 'Finance', href: '/finance', icon: IndianRupee },
        { name: 'Tasks', href: '/tasks', icon: CircleCheck },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 safe-area-bottom lg:hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="flex justify-around items-center h-16 px-2">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.name}
                            onClick={() => navigate(item.href)}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1.5",
                                isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-900"
                            )}
                        >
                            <div className={cn(
                                "flex items-center justify-center w-6 h-6 rounded-full border-2",
                                isActive ? "bg-blue-600 border-blue-600 text-white" : "border-current bg-transparent"
                            )}>
                                <Icon className="h-3.5 w-3.5" />
                            </div>
                            <span className={cn(
                                "text-[11px] font-bold uppercase tracking-tight leading-none",
                                isActive ? "font-bold" : "font-medium"
                            )}>{item.name}</span>
                        </button>
                    );
                })}

                <button
                    onClick={onMenuClick}
                    className="flex flex-col items-center justify-center w-full h-full space-y-1.5 text-gray-500 hover:text-gray-900"
                >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-current bg-transparent">
                        <Menu className="h-3.5 w-3.5" strokeWidth={2} />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-tight leading-none">Menu</span>
                </button>
            </div>
        </div>
    );
}
