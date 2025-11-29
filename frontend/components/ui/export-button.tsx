/**
 * Export Button Component
 * Reusable button with progress indicator for document exports
 */

import React, { useState } from 'react';
import { Button } from './button';
import { Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { handleExport, ExportResponse, ExportStatus, formatFileSize } from '../../lib/export-utils';
import { toast } from './use-toast';

interface ExportButtonProps {
  label?: string;
  exportFn: () => Promise<ExportResponse>;
  filename?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  disabled?: boolean;
}

export function ExportButton({
  label = 'Export',
  exportFn,
  filename,
  variant = 'outline',
  size = 'sm',
  className = '',
  disabled = false,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'queued' | 'processing' | 'ready' | 'error'>('idle');

  const handleClick = async () => {
    setIsExporting(true);
    setStatus('queued');
    setProgress(0);

    try {
      await handleExport(exportFn, {
        onProgress: (exportStatus: ExportStatus) => {
          setStatus(exportStatus.status as any);
          setProgress(exportStatus.progress || 0);

          // Optional: could show progress in UI; avoid persistent toasts
        },
        onComplete: (exportStatus: ExportStatus) => {
          setStatus('ready');
          toast({
            title: 'Document ready! Downloading...',
            description: exportStatus.fileSizeBytes 
              ? `File size: ${formatFileSize(exportStatus.fileSizeBytes)}`
              : undefined,
            variant: 'success' as any,
          });
        },
        onError: (error: Error) => {
          setStatus('error');
          toast({
            title: 'Export failed',
            description: error.message,
            variant: 'destructive' as any,
          });
        },
        filename,
      });

      // Reset state after successful download
      setTimeout(() => {
        setStatus('idle');
        setProgress(0);
        setIsExporting(false);
      }, 2000);
    } catch (error) {
      setStatus('error');
      setIsExporting(false);
      console.error('Export error:', error);
    }
  };

  const getButtonContent = () => {
    switch (status) {
      case 'queued':
        return (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Queued...
          </>
        );
      case 'processing':
        return (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {progress > 0 ? `${progress}%` : 'Processing...'}
          </>
        );
      case 'ready':
        return (
          <>
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            Downloaded!
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle className="h-4 w-4 mr-2 text-red-600" />
            Failed
          </>
        );
      default:
        return (
          <>
            <Download className="h-4 w-4 mr-2" />
            {label}
          </>
        );
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={disabled || isExporting}
    >
      {getButtonContent()}
    </Button>
  );
}