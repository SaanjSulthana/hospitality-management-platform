/**
 * Audit Log Filters Component
 * Filtering interface for audit logs
 */

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Filter, X } from 'lucide-react';

export interface AuditFilters {
  startDate?: string;
  endDate?: string;
  userId?: number;
  actionType?: string;
  resourceType?: string;
  success?: boolean;
}

interface AuditLogFiltersProps {
  filters: AuditFilters;
  onFiltersChange: (filters: AuditFilters) => void;
  onClear: () => void;
  className?: string;
}

const ACTION_TYPES = [
  { value: 'create_checkin', label: 'Create Check-in' },
  { value: 'update_checkin', label: 'Update Check-in' },
  { value: 'delete_checkin', label: 'Delete Check-in' },
  { value: 'checkout_guest', label: 'Checkout Guest' },
  { value: 'view_guest_details', label: 'View Guest Details' },
  { value: 'upload_document', label: 'Upload Document' },
  { value: 'view_documents', label: 'View Documents' },
  { value: 'download_document', label: 'Download Document' },
  { value: 'delete_document', label: 'Delete Document' },
  { value: 'verify_document', label: 'Verify Document' },
];

const RESOURCE_TYPES = [
  { value: 'guest_checkin', label: 'Guest Check-in' },
  { value: 'guest_document', label: 'Guest Document' },
  { value: 'audit_log', label: 'Audit Log' },
];

export function AuditLogFilters({
  filters,
  onFiltersChange,
  onClear,
  className = '',
}: AuditLogFiltersProps) {
  const handleChange = (key: keyof AuditFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== '');

  return (
    <Card className={`border-l-4 border-l-purple-500 shadow-sm ${className}`}>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Range */}
          <div className="space-y-2">
            <Label htmlFor="start-date" className="text-sm font-medium text-gray-700">
              Start Date
            </Label>
            <Input
              id="start-date"
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleChange('startDate', e.target.value)}
              className="h-11 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-date" className="text-sm font-medium text-gray-700">
              End Date
            </Label>
            <Input
              id="end-date"
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleChange('endDate', e.target.value)}
              className="h-11 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
            />
          </div>

          {/* Action Type */}
          <div className="space-y-2">
            <Label htmlFor="action-type" className="text-sm font-medium text-gray-700">
              Action Type
            </Label>
            <Select
              value={filters.actionType || 'all'}
              onValueChange={(value) => handleChange('actionType', value === 'all' ? '' : value)}
            >
              <SelectTrigger className="h-11 border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {ACTION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resource Type */}
          <div className="space-y-2">
            <Label htmlFor="resource-type" className="text-sm font-medium text-gray-700">
              Resource Type
            </Label>
            <Select
              value={filters.resourceType || 'all'}
              onValueChange={(value) => handleChange('resourceType', value === 'all' ? '' : value)}
            >
              <SelectTrigger className="h-11 border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                <SelectValue placeholder="All Resources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                {RESOURCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        {hasActiveFilters && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
              className="text-xs"
            >
              <X className="h-3 w-3 mr-2" />
              Clear Filters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

