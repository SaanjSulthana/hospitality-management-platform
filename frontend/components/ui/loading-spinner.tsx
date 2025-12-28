import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center space-y-2', className)}>
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
      {text && (
        <p className="text-sm text-muted-foreground text-center">{text}</p>
      )}
    </div>
  );
}

export function LoadingPage({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

export function LoadingCard({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="p-8 flex items-center justify-center">
      <LoadingSpinner size="md" text={text} />
    </div>
  );
}

// Skeleton card for progressive dashboard loading
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-5 w-5 rounded bg-gray-200" />
        <div className="h-5 w-32 rounded bg-gray-200" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 flex-1 rounded bg-gray-100" />
            <div className="h-4 w-16 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Skeleton for stats overview
export function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border p-4">
          <div className="h-3 w-20 rounded bg-gray-200 mb-2" />
          <div className="h-8 w-16 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

// Skeleton for action cards
export function SkeletonActionCards() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border p-4 h-24">
          <div className="h-4 w-16 rounded bg-gray-200 mb-2" />
          <div className="h-6 w-8 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

// Skeleton for property cards grid
export function SkeletonPropertyGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-3xl overflow-hidden border shadow-sm">
          {/* Image placeholder */}
          <div className="h-40 sm:h-48 bg-gray-200" />
          {/* Content placeholder */}
          <div className="p-5 space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="h-5 w-5 rounded bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-100" />
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="h-4 w-20 rounded bg-gray-100" />
              <div className="h-4 w-12 rounded bg-gray-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Skeleton for task cards in kanban/list view
export function SkeletonTaskGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
            </div>
            <div className="h-5 w-12 rounded-full bg-gray-200" />
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-gray-50 pl-[52px]">
            <div className="h-4 w-20 rounded bg-gray-100" />
            <div className="h-4 w-24 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Skeleton for kanban columns
export function SkeletonKanban() {
  return (
    <div className="flex gap-4 overflow-x-auto animate-pulse pb-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="min-w-[85vw] md:min-w-[320px] flex-1">
          <div className="mb-4 p-3 rounded-2xl bg-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="h-5 w-24 rounded bg-gray-200" />
              <div className="h-5 w-8 rounded bg-gray-200" />
            </div>
            <div className="h-1.5 rounded-full bg-gray-200" />
          </div>
          <SkeletonTaskGrid count={2} />
        </div>
      ))}
    </div>
  );
}

// Skeleton for staff list
export function SkeletonStaffList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-1/3 rounded bg-gray-200" />
              <div className="h-3 w-1/4 rounded bg-gray-100" />
            </div>
            <div className="h-6 w-16 rounded-full bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Skeleton for finance table rows
export function SkeletonFinanceTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm animate-pulse">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-4">
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="h-4 w-20 rounded bg-gray-200" />
        <div className="flex-1" />
        <div className="h-4 w-16 rounded bg-gray-200" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 border-b last:border-0 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gray-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-gray-200" />
            <div className="h-3 w-1/4 rounded bg-gray-100" />
          </div>
          <div className="h-5 w-20 rounded bg-gray-100" />
          <div className="h-6 w-16 rounded-full bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

// Skeleton for charts (analytics)
export function SkeletonChart({ height = 200 }: { height?: number }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 rounded bg-gray-200" />
        <div className="h-4 w-20 rounded bg-gray-100" />
      </div>
      <div className="rounded-lg bg-gray-100" style={{ height }} />
    </div>
  );
}

// Skeleton for generic list page
export function SkeletonListPage({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-gray-200" />
          <div className="h-4 w-32 rounded bg-gray-100" />
        </div>
        <div className="h-11 w-32 rounded-xl bg-gray-200" />
      </div>
      {/* Search/filter skeleton */}
      <div className="h-12 w-full rounded-2xl bg-gray-100" />
      {/* List skeleton */}
      <SkeletonStaffList count={items} />
    </div>
  );
}
