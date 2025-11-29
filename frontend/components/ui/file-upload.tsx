import React, { useRef, useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FileUploadProps {
  onFileUpload: (file: File) => Promise<{ fileId: number; filename: string; url: string }>;
  accept?: string;
  maxSize?: number; // in bytes
  className?: string;
  label?: string;
  description?: string;
  value?: { fileId: number; filename: string } | null;
  onClear?: () => void;
}

export function FileUpload({
  onFileUpload,
  accept = "image/*,.pdf",
  maxSize = 100 * 1024 * 1024, // 100MB default
  className,
  label = "Upload File",
  description = "Upload images (JPG, PNG, GIF, WebP) or PDF files. Max size: 100MB",
  value,
  onClear,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setError(null);
    
    // Validate file size
    if (file.size > maxSize) {
      setError(`File size too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB`);
      return;
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      setError('File type not supported. Please upload images or PDF files.');
      return;
    }

    setIsUploading(true);
    try {
      await onFileUpload(file);
    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleClear = () => {
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClear?.();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      
      {/* File upload area */}
      {!value && (
        <div
          className={cn(
            "border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-colors",
            isDragging && "border-blue-500 bg-blue-50",
            !isDragging && "hover:border-gray-400"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleInputChange}
            className="hidden"
          />
          
          {isUploading ? (
            <div className="space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
              <p className="text-sm text-gray-600">Uploading...</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 text-gray-400 mx-auto" />
              <div>
                <p className="text-sm text-gray-600">
                  Drag and drop your file here, or{" "}
                  <button
                    type="button"
                    onClick={handleButtonClick}
                    className="text-blue-500 hover:text-blue-600 underline"
                  >
                    browse
                  </button>
                </p>
                {description && (
                  <p className="text-xs text-gray-500 mt-1">{description}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Uploaded file display */}
      {value && (
        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">{value.filename}</p>
              <p className="text-xs text-gray-500">File uploaded successfully</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-gray-400 hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center space-x-2 p-3 border border-red-200 rounded-lg bg-red-50">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
