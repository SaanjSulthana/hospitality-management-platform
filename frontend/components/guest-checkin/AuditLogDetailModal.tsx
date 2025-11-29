/**
 * Audit Log Detail Modal Component
 * Shows comprehensive details of an audit log entry with rich context
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import {
  CheckCircle,
  XCircle,
  User,
  Mail,
  Phone,
  Home,
  MapPin,
  Shield,
  Globe,
  Clock,
  FileText,
  Download,
  Eye,
  Trash2,
  Edit,
  LogOut,
  Upload,
  AlertCircle,
} from 'lucide-react';
import type { AuditLog } from '../../hooks/useAuditLogs';
import { useToast } from '../ui/use-toast';

interface AuditLogDetailModalProps {
  open: boolean;
  onClose: () => void;
  log: AuditLog | null;
}

export function AuditLogDetailModal({ open, onClose, log }: AuditLogDetailModalProps) {
  const { toast } = useToast();

  if (!log) return null;

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

  const getActionColor = (actionType: string) => {
    const colorMap: Record<string, string> = {
      create_checkin: 'text-green-600',
      update_checkin: 'text-blue-600',
      delete_checkin: 'text-red-600',
      checkout_guest: 'text-purple-600',
      view_guest_details: 'text-gray-600',
      upload_document: 'text-green-600',
      view_documents: 'text-gray-600',
      generate_c_form: 'text-blue-600',
      download_c_form: 'text-blue-600',
      unauthorized_access_attempt: 'text-red-600',
    };
    return colorMap[actionType] || 'text-gray-600';
  };

  const getActionLabel = (actionType: string) => {
    const labelMap: Record<string, string> = {
      create_checkin: 'Guest Check-in Created',
      update_checkin: 'Guest Check-in Updated',
      delete_checkin: 'Guest Check-in Deleted',
      checkout_guest: 'Guest Checked Out',
      view_guest_details: 'Viewed Guest Details',
      upload_document: 'Document Uploaded',
      view_documents: 'Viewed Documents',
      view_document: 'Viewed Document',
      download_document: 'Document Downloaded',
      delete_document: 'Document Deleted',
      verify_document: 'Document Verified',
      generate_c_form: 'Form C Generated',
      download_c_form: 'Form C Downloaded',
      query_audit_logs: 'Queried Audit Logs',
      export_audit_logs: 'Exported Audit Logs',
      unauthorized_access_attempt: 'Unauthorized Access Attempt',
    };
    return labelMap[actionType] || actionType.replace(/_/g, ' ').toUpperCase();
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(date);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard.`,
      duration: 2000,
    });
  };

  const ActionIcon = getActionIcon(log.action.type);
  const actionColor = getActionColor(log.action.type);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Audit Log Details
          </DialogTitle>
          <DialogDescription>
            Comprehensive details of the audit trail entry
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Action Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              🎯 Action Information
            </h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-white dark:bg-gray-700 ${actionColor}`}>
                    <ActionIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {getActionLabel(log.action.type)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Resource: {log.action.resourceType.replace('_', ' ')} 
                      {log.action.resourceId && ` #${log.action.resourceId}`}
                    </p>
                  </div>
                </div>
                <Badge className={log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                  {log.success ? (
                    <><CheckCircle className="h-3 w-3 mr-1" /> Success</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Failed</>
                  )}
                </Badge>
              </div>
              
              {log.durationMs && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>Duration: {log.durationMs}ms</span>
                </div>
              )}

              {!log.success && log.errorMessage && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">Error Message</p>
                    <p className="text-sm text-red-700 dark:text-red-300">{log.errorMessage}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Guest Information */}
          {log.guest.name && (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  👤 Guest Information
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{log.guest.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(log.guest.name || '', 'Guest name')}
                      className="h-7"
                    >
                      <FileText className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {log.guest.checkInId && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Shield className="h-4 w-4" />
                      <span>Check-in ID: {log.guest.checkInId}</span>
                    </div>
                  )}

                  {log.details?.guestEmail && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="h-4 w-4" />
                        <span>{log.details.guestEmail}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(log.details.guestEmail, 'Email')}
                        className="h-7"
                      >
                        <FileText className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {log.details?.guestPhone && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4" />
                        <span>{log.details.guestPhone}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(log.details.guestPhone, 'Phone')}
                        className="h-7"
                      >
                        <FileText className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {log.details?.propertyName && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Home className="h-4 w-4" />
                      <span>Property: {log.details.propertyName}</span>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* User Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              🔐 Performed By
            </h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{log.user.email}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {log.user.role}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Shield className="h-4 w-4" />
                <span>User ID: {log.user.id}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Context Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              🌍 Context
            </h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>{formatTimestamp(log.timestamp)}</span>
              </div>
              
              {log.context.ipAddress && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Globe className="h-4 w-4" />
                  <span>IP: {log.context.ipAddress}</span>
                </div>
              )}

              {log.context.requestPath && (
                <div className="flex items-center gap-2 text-sm text-gray-600 font-mono text-xs">
                  <FileText className="h-4 w-4" />
                  <span>{log.context.requestMethod} {log.context.requestPath}</span>
                </div>
              )}

              {log.context.userAgent && (
                <div className="text-xs text-gray-500 truncate" title={log.context.userAgent}>
                  User Agent: {log.context.userAgent}
                </div>
              )}
            </div>
          </div>

          {/* Additional Details */}
          {log.details && Object.keys(log.details).length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  📝 Additional Details
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

