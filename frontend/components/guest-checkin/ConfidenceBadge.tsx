/**
 * Confidence Badge Component
 * Displays extraction confidence score with color-coded badge
 */

import React from 'react';
import { Badge } from '../ui/badge';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface ConfidenceBadgeProps {
  score: number;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ConfidenceBadge({ score, showIcon = true, size = 'sm' }: ConfidenceBadgeProps) {
  const getConfidenceLevel = () => {
    if (score >= 90) return {
      label: 'High Confidence',
      color: 'bg-green-100 text-green-800 border-green-300',
      icon: CheckCircle,
    };
    if (score >= 70) return {
      label: 'Please Verify',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      icon: AlertTriangle,
    };
    return {
      label: 'Manual Entry Recommended',
      color: 'bg-red-100 text-red-800 border-red-300',
      icon: XCircle,
    };
  };

  const level = getConfidenceLevel();
  const Icon = level.icon;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };

  return (
    <Badge 
      variant="outline"
      className={`${level.color} ${sizeClasses[size]} font-medium flex items-center gap-1.5 flex-shrink-0`}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      <span>{score}%</span>
      {size !== 'sm' && <span className="hidden sm:inline">• {level.label}</span>}
    </Badge>
  );
}

