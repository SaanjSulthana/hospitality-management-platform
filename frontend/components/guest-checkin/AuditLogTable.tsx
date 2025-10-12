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
  Shield
} from 'lucide-react';
import type { AuditLog } from '../../hooks/useAuditLogs';

interface AuditLogTableProps {
  logs: AuditLog[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onExport: () => void;
  onViewDetails?: (log: AuditLog) => void;
  className?: string;
}

export function AuditLogTable({
  logs,
  isLoading,
  error,
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
      view_guest_details: { color: 'bg-gray-100 text-gray-800 border-gray-300', label: 'View' },
      upload_document: { color: 'bg-green-100 text-green-800 border-green-300', label: 'Upload' },
      download_document: { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Download' },
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
    <Card className={`border-l-4 border-l-blue-500 shadow-sm ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Audit Trail
            </CardTitle>
            <CardDescription>Complete history of actions on guest records</CardDescription>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="flex-shrink-0"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="flex-shrink-0"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
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
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b-2 border-gray-200 bg-gray-50">
                <tr>
                  <th className="p-3 text-sm font-semibold text-gray-700">Timestamp</th>
                  <th className="p-3 text-sm font-semibold text-gray-700">User</th>
                  <th className="p-3 text-sm font-semibold text-gray-700">Action</th>
                  <th className="p-3 text-sm font-semibold text-gray-700">Guest</th>
                  <th className="p-3 text-sm font-semibold text-gray-700">Duration</th>
                  <th className="p-3 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr
                    key={log.id}
                    className={`
                      border-b border-gray-200 hover:bg-gray-50 transition-colors
                      ${!log.success ? 'bg-red-50/30' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}
                    `}
                  >
                    <td className="p-3">
                      <div className="text-sm font-medium text-gray-900">
                        {formatTimestamp(log.timestamp)}
                      </div>
                    </td>

                    <td className="p-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate" style={{ maxWidth: '200px' }}>
                          {log.user.email}
                        </p>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {log.user.role}
                        </Badge>
                      </div>
                    </td>

                    <td className="p-3">
                      {getActionBadge(log.action.type, log.success)}
                    </td>

                    <td className="p-3">
                      {log.guest.name ? (
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate" style={{ maxWidth: '150px' }}>
                            {log.guest.name}
                          </p>
                          <p className="text-xs text-gray-500">ID: {log.guest.checkInId}</p>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>

                    <td className="p-3">
                      {log.durationMs ? (
                        <span className="text-sm text-gray-600">{log.durationMs}ms</span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>

                    <td className="p-3">
                      {onViewDetails && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewDetails(log)}
                          className="h-8"
                        >
                          <Eye className="h-4 w-4" />
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

