import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface ThemeTabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  theme?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
  };
}

interface ThemeTabsListProps {
  children: React.ReactNode;
  className?: string;
  theme?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
  };
}

interface ThemeTabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  theme?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
  };
}

// Helper function to convert hex to RGB values
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Helper function to create theme-aware styles
const getThemeStyles = (theme?: ThemeTabsProps['theme']) => {
  if (!theme) {
    return {
      containerBg: 'bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700',
      containerBorder: 'border-orange-400',
      innerBg: 'bg-white/10',
      innerBorder: 'border-white/20',
      activeBg: 'bg-white',
      activeText: 'text-orange-600',
      activeBorder: 'border-orange-300',
      inactiveText: 'text-white',
      inactiveBg: 'from-orange-500/30 to-orange-600/30',
      inactiveHoverBg: 'from-orange-500/50 to-orange-600/50',
      inactiveBorder: 'border-white/30',
    };
  }

  const primaryRgb = hexToRgb(theme.primaryColor);
  const accentRgb = hexToRgb(theme.accentColor);
  
  if (!primaryRgb || !accentRgb) {
    return {
      containerBg: 'bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700',
      containerBorder: 'border-orange-400',
      innerBg: 'bg-white/10',
      innerBorder: 'border-white/20',
      activeBg: 'bg-white',
      activeText: 'text-orange-600',
      activeBorder: 'border-orange-300',
      inactiveText: 'text-white',
      inactiveBg: 'from-orange-500/30 to-orange-600/30',
      inactiveHoverBg: 'from-orange-500/50 to-orange-600/50',
      inactiveBorder: 'border-white/30',
    };
  }

  return {
    containerBg: `bg-gradient-to-br from-[${theme.primaryColor}] via-[${theme.primaryColor}dd] to-[${theme.primaryColor}bb]`,
    containerBorder: `border-[${theme.primaryColor}]`,
    innerBg: 'bg-white/10',
    innerBorder: 'border-white/20',
    activeBg: theme.backgroundColor || 'bg-white',
    activeText: `text-[${theme.primaryColor}]`,
    activeBorder: `border-[${theme.primaryColor}]`,
    inactiveText: theme.textColor || 'text-white',
    inactiveBg: `from-[${theme.primaryColor}]/30 to-[${theme.primaryColor}]/30`,
    inactiveHoverBg: `from-[${theme.primaryColor}]/50 to-[${theme.primaryColor}]/50`,
    inactiveBorder: 'border-white/30',
  };
};

export function ThemeTabs({ 
  defaultValue, 
  value, 
  onValueChange, 
  children, 
  className,
  theme 
}: ThemeTabsProps) {
  return (
    <Tabs 
      defaultValue={defaultValue} 
      value={value}
      onValueChange={onValueChange}
      className={cn("space-y-0", className)}
    >
      {children}
    </Tabs>
  );
}

export function ThemeTabsList({ 
  children, 
  className,
  theme 
}: ThemeTabsListProps) {
  const themeStyles = getThemeStyles(theme);
  
  return (
    <div className={cn(
      "sticky top-20 z-30 border-b-2 -mx-6 px-4 py-3 shadow-2xl rounded-b-xl",
      themeStyles.containerBg,
      themeStyles.containerBorder
    )}>
      <div className="overflow-x-auto">
        <div className={cn(
          "backdrop-blur-sm rounded-lg p-1 border shadow-inner",
          themeStyles.innerBg,
          themeStyles.innerBorder
        )}>
          <TabsList className={cn(
            "grid w-full min-w-max bg-transparent h-auto p-0 gap-2",
            className
          )}>
            {children}
          </TabsList>
        </div>
      </div>
    </div>
  );
}

export function ThemeTabsTrigger({ 
  value, 
  children, 
  className,
  theme 
}: ThemeTabsTriggerProps) {
  const themeStyles = getThemeStyles(theme);
  
  return (
    <TabsTrigger 
      value={value} 
      className={cn(
        "text-xs sm:text-sm px-4 sm:px-8 py-4",
        "data-[state=active]:shadow-xl data-[state=active]:border-2",
        "data-[state=inactive]:hover:shadow-lg data-[state=inactive]:border",
        "transition-all duration-500 flex items-center gap-2 rounded-xl font-semibold relative overflow-hidden group",
        `data-[state=active]:${themeStyles.activeBg}`,
        `data-[state=active]:${themeStyles.activeText}`,
        `data-[state=active]:${themeStyles.activeBorder}`,
        `data-[state=inactive]:${themeStyles.inactiveText}`,
        `data-[state=inactive]:bg-gradient-to-r`,
        `data-[state=inactive]:${themeStyles.inactiveBg}`,
        `data-[state=inactive]:hover:${themeStyles.inactiveHoverBg}`,
        `data-[state=inactive]:${themeStyles.inactiveBorder}`,
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
      <div className="relative z-10 flex items-center gap-2">
        {children}
      </div>
    </TabsTrigger>
  );
}
