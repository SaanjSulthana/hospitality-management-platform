/**
 * Audit Log Table Component
 * Displays comprehensive audit trail with sorting and filtering
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Eye, 
  Download, 
  RefreshCw, 
  AlertCircle,
  FileText,
  Trash2,
  Upload,
  CheckCircle,
  LogOut,
  Edit,
  Shield,
  Clock,
  User
} from 'lucide-react';
import type { AuditLog } from '../../hooks/useAuditLogs';

interface AuditLogTableProps {
  logs: AuditLog[];
  isLoading: boolean;
  error: string | null;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  onRefresh: () => void;
  onExport: () => void;
  onViewDetails?: (log: AuditLog) => void;
  className?: string;
}

export function AuditLogTable({
  logs,
  isLoading,
  error,
  pagination,
  onRefresh,
  onExport,
  onViewDetails,
  className = '',
}: AuditLogTableProps) {
  const getActionIcon = (actionType: string) => {
    const iconMap: Record<string, any> = {
      create_checkin: CheckCircle,
      update_checkin: Edit,
      delete_checkin: Trash2,
      checkout_guest: LogOut,
      view_guest_details: Eye,
      upload_document: Upload,
      view_documents: Eye,
      view_document: Eye,
      download_document: Download,
      delete_document: Trash2,
      verify_document: CheckCircle,
      generate_c_form: FileText,
      download_c_form: Download,
      query_audit_logs: FileText,
      export_audit_logs: Download,
      unauthorized_access_attempt: Shield,
    };
    return iconMap[actionType] || FileText;
  };

  const getActionBadge = (actionType: string, success: boolean) => {
    if (!success) {
      return <Badge className="bg-red-100 text-red-800 border-red-300 text-xs">Failed</Badge>;
    }

    const badgeMap: Record<string, { color: string; label: string }> = {
      create_checkin: { color: 'bg-green-100 text-green-800 border-green-300', label: 'Create' },
      update_checkin: { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Update' },
      delete_checkin: { color: 'bg-red-100 text-red-800 border-red-300', label: 'Delete' },
      checkout_guest: { color: 'bg-purple-100 text-purple-800 border-purple-300', label: 'Checkout' },
      view_guest_details: { color: 'bg-gray-100 text-gray-800 border-gray-300', label: 'View Details' },
      upload_document: { color: 'bg-green-100 text-green-800 border-green-300', label: 'Upload' },
      view_documents: { color: 'bg-gray-100 text-gray-800 border-gray-300', label: 'View Docs' },
      download_document: { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Download' },
      generate_c_form: { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'C-Form' },
      download_c_form: { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'C-Form DL' },
      unauthorized_access_attempt: { color: 'bg-red-100 text-red-800 border-red-300', label: 'Unauthorized' },
    };

    const config = badgeMap[actionType] || { color: 'bg-gray-100 text-gray-800', label: actionType };
    const ActionIcon = getActionIcon(actionType);

    return (
      <Badge className={`${config.color} text-xs flex items-center gap-1 w-fit`}>
        <ActionIcon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(date);
  };

  return (
    <Card className={`border-l-4 border-l-blue-500 shadow-lg hover:shadow-xl transition-shadow duration-200 ${className}`}>
      <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              Audit Trail
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-medium">
                {pagination?.total || logs.length} {(pagination?.total || logs.length) === 1 ? 'Entry' : 'Entries'}
              </span>
            </CardTitle>
            <CardDescription className="mt-1">
              Complete history of actions on guest records with full context
            </CardDescription>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="flex-shrink-0 hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="flex-shrink-0 hover:bg-green-50 hover:border-green-300 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading audit logs...</p>
              <p className="text-sm text-gray-600 mt-2">Please wait</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900">No audit logs found</p>
              <p className="text-sm text-gray-600 mt-2">Try adjusting your filters</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-left">
              <thead className="border-b-2 border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/50">
                <tr>
                  <th className="p-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Timestamp</th>
                  <th className="p-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">User</th>
                  <th className="p-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Action</th>
                  <th className="p-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Guest</th>
                  <th className="p-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Duration</th>
                  <th className="p-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log, index) => (
                  <tr
                    key={log.id}
                    className={`
                      hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors duration-150
                      ${!log.success ? 'bg-red-50 dark:bg-red-900/10' : index % 2 === 0 ? 'bg-white dark:bg-gray-850' : 'bg-gray-50/50 dark:bg-gray-800/30'}
                    `}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" style={{ maxWidth: '180px' }}>
                            {log.user.email}
                          </p>
                          <Badge variant="outline" className="mt-0.5 text-xs">
                            {log.user.role}
                          </Badge>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      {getActionBadge(log.action.type, log.success)}
                    </td>

                    <td className="p-4">
                      {log.guest.name ? (
                        <div className="flex items-start gap-2">
                          <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" style={{ maxWidth: '140px' }}>
                              {log.guest.name}
                            </p>
                            <p className="text-xs text-gray-500">ID: {log.guest.checkInId}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>

                    <td className="p-4">
                      {log.durationMs ? (
                        <span className="text-sm font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {log.durationMs}ms
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>

                    <td className="p-4">
                      {onViewDetails && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewDetails(log)}
                          className="h-8 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                          title="View detailed audit information"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          <span className="text-xs hidden lg:inline">View</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

