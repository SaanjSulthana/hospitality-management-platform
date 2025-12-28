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
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 pb-safe lg:hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <nav className="flex items-center justify-around h-20 px-2 w-full">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.name}
                            onClick={() => navigate(item.href)}
                            className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-all duration-200 active:scale-95 ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-blue-50 shadow-sm' : 'bg-transparent'
                                }`}>
                                <Icon
                                    className={`h-7 w-7 transition-all duration-200 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'
                                        }`}
                                />
                            </div>
                            <span className={`text-sm font-medium tracking-wide ${isActive ? 'font-semibold' : ''
                                }`}>
                                {item.name}
                            </span>
                        </button>
                    );
                })}

                <button
                    onClick={onMenuClick}
                    className="flex flex-col items-center justify-center w-full h-full space-y-1.5 text-gray-500 hover:text-gray-900"
                >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full">
                        <Menu className="h-6 w-6" strokeWidth={2} />
                    </div>
                    <span className="text-xs font-medium tracking-tight leading-none">Menu</span>
                </button>
            </nav>
        </div>
    );
}
