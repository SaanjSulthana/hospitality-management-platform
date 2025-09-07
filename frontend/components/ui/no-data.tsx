import React from 'react';
import { cn } from '@/lib/utils';

interface NoDataProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function NoData({ 
  icon, 
  title = 'No data available', 
  description = 'There are no items to display at the moment.',
  action,
  className 
}: NoDataProps) {
  return (
    <div className={cn('text-center py-12', className)}>
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-4">{description}</p>
      {action && (
        <div className="flex justify-center">
          {action}
        </div>
      )}
    </div>
  );
}

export function NoDataCard({ 
  icon, 
  title, 
  description, 
  action, 
  className 
}: NoDataProps) {
  return (
    <div className={cn('rounded-lg border border-dashed border-gray-300 p-8', className)}>
      <NoData 
        icon={icon} 
        title={title} 
        description={description} 
        action={action} 
      />
    </div>
  );
}
