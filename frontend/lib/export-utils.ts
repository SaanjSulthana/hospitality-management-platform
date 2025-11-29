/**
 * Export Utilities
 * Helper functions for handling document exports with polling and download
 */

import { API_CONFIG } from './api-config';

export interface ExportResponse {
  exportId: string;
  status: 'queued';
  estimatedSeconds: number;
  statusUrl: string;
  downloadUrl: string;
  recordCount?: number;
}

export interface ExportStatus {
  exportId: string;
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'expired';
  progress?: number;
  downloadUrl?: string;
  fileSizeBytes?: number;
  expiresAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DownloadResponse {
  signedUrl: string;
  expiresIn: number;
  fileSizeBytes: number;
  filename: string;
}

/**
 * Poll export status until ready or failed
 */
export async function pollExportStatus(
  exportId: string,
  onProgress?: (status: ExportStatus) => void,
  maxAttempts: number = 60,
  intervalMs: number = 1000
): Promise<ExportStatus> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/documents/exports/${exportId}/status`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get export status: ${response.statusText}`);
    }

    const status: ExportStatus = await response.json();

    // Call progress callback if provided
    if (onProgress) {
      onProgress(status);
    }

    // Check if export is complete
    if (status.status === 'ready') {
      return status;
    }

    if (status.status === 'failed') {
      throw new Error(status.errorMessage || 'Export generation failed');
    }

    if (status.status === 'expired') {
      throw new Error('Export has expired');
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Export timed out');
}

/**
 * Download export file
 * For files <5MB: downloads directly via fetch
 * For files ≥5MB: gets signed URL and redirects
 */
export async function downloadExport(exportId: string, filename?: string): Promise<void> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  // Get download info (signed URL)
  const response = await fetch(
    `${API_CONFIG.BASE_URL}/documents/exports/${exportId}/download`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download export: ${response.statusText}`);
  }

  const downloadInfo: DownloadResponse = await response.json();

  // Create download link
  const link = document.createElement('a');
  link.href = downloadInfo.signedUrl;
  link.download = filename || downloadInfo.filename;
  link.target = '_blank'; // Open in new tab for signed URLs
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Complete export workflow: create, poll, download
 */
export async function handleExport(
  exportFn: () => Promise<ExportResponse>,
  options?: {
    onProgress?: (status: ExportStatus) => void;
    onComplete?: (status: ExportStatus) => void;
    onError?: (error: Error) => void;
    filename?: string;
  }
): Promise<void> {
  try {
    // Step 1: Create export
    const exportResponse = await exportFn();

    // Step 2: Poll status
    const finalStatus = await pollExportStatus(
      exportResponse.exportId,
      options?.onProgress
    );

    // Step 3: Notify completion
    if (options?.onComplete) {
      options.onComplete(finalStatus);
    }

    // Step 4: Download
    await downloadExport(exportResponse.exportId, options?.filename);
  } catch (error) {
    if (options?.onError) {
      options.onError(error as Error);
    } else {
      throw error;
    }
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format time remaining
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes}m ${remainingSeconds}s`;
}

