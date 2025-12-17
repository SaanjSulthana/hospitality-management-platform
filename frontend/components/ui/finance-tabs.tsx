import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// Finance-specific tabs component with enhanced UI
interface Theme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
}

// Helper function to convert hex to RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Helper function to create theme-aware styles
const getThemeStyles = (theme?: Theme) => {
  if (!theme) {
    return {
      containerBg: 'bg-gray-100',
      containerBorder: 'border-gray-200',
      activeBg: 'bg-white',
      activeText: 'text-blue-600',
      activeBorder: 'border-blue-600',
      activeShadow: 'shadow-sm',
      inactiveText: 'text-gray-600',
      inactiveHoverText: 'text-gray-800',
      inactiveHoverBg: 'bg-gray-50',
      primaryColor: '#3b82f6', // Default blue
    };
  }

  const primaryRgb = hexToRgb(theme.primaryColor);

  return {
    containerBg: 'bg-gray-100',
    containerBorder: 'border-gray-200',
    activeBg: 'bg-white',
    activeText: `text-[${theme.primaryColor}]`,
    activeBorder: `border-[${theme.primaryColor}]`,
    activeShadow: 'shadow-sm',
    inactiveText: 'text-gray-600',
    inactiveHoverText: 'text-gray-800',
    inactiveHoverBg: 'bg-gray-50',
    primaryColor: theme.primaryColor,
    primaryRgb: primaryRgb,
  };
};

export function FinanceTabs({
  children,
  className,
  theme,
  ...props
}: React.ComponentProps<typeof Tabs> & { theme?: Theme }) {
  return (
    <Tabs
      className={cn("space-y-0", className)}
      {...props}
    >
      {children}
    </Tabs>
  );
}

export function FinanceTabsList({
  children,
  className,
  theme,
  /** Optional className applied to the outer container to control visibility/layout (e.g., hide wrapper on mobile) */
  containerClassName,
  ...props
}: React.ComponentProps<typeof TabsList> & { theme?: Theme; containerClassName?: string }) {
  const themeStyles = getThemeStyles(theme);
  return (
    <div className={cn("mb-0", containerClassName)}>
      <div className="bg-gray-100/80 backdrop-blur-sm rounded-full p-1.5">
        <TabsList
          className={cn("w-full bg-transparent h-auto p-0 gap-0 flex", className)}
          {...props}
        >
          {children}
        </TabsList>
      </div>
    </div>
  );
}

export function FinanceTabsTrigger({
  children,
  className,
  theme,
  ...props
}: React.ComponentProps<typeof TabsTrigger> & { theme?: Theme }) {
  // Create inline styles for theme colors
  const themeStyles_inline = theme?.primaryColor ? {
    '--theme-primary': theme.primaryColor,
    '--theme-primary-10': `${theme.primaryColor}1a`, // 10% opacity
    '--theme-primary-20': `${theme.primaryColor}33`, // 20% opacity
  } as React.CSSProperties : {};

  return (
    <TabsTrigger
      style={themeStyles_inline}
      className={cn(
        "theme-tabs-trigger flex-1 px-6 py-2.5 text-sm font-medium transition-all duration-300 rounded-full relative",
        // Segmented Control Styles
        "data-[state=active]:text-gray-900 data-[state=active]:bg-white data-[state=active]:shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
        "data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-gray-700 data-[state=inactive]:hover:bg-white/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      {children}
    </TabsTrigger>
  );
}
