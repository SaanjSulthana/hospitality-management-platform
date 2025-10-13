/**
 * Document Upload Zone Component
 * Drag-and-drop file upload with camera capture for guest documents
 */

import React, { useState, useRef } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Camera, Upload, X, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { ConfidenceBadge } from './ConfidenceBadge';
import { smartCompressImage, needsCompression, getCompressionRecommendations } from '../../src/utils/image-compression';
import { toast } from '../ui/use-toast';

export interface ExtractedField {
  value: string;
  confidence: number;
  needsVerification: boolean;
}

export interface DocumentUploadResult {
  documentId: number;
  documentType: string;
  filename: string;
  thumbnailUrl: string;
  extractedData: Record<string, ExtractedField>;
  overallConfidence: number;
  detectedDocumentType?: string;
  documentTypeConfidence?: number;
  success?: boolean;
  error?: string;
}

interface DocumentUploadZoneProps {
  documentType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card' | 'driving_license_front' | 'driving_license_back' | 'election_card_front' | 'election_card_back' | 'passport' | 'visa_front' | 'visa_back' | 'other';
  label: string;
  onUploadComplete: (result: DocumentUploadResult) => void;
  onExtractionComplete?: (extractedData: Record<string, ExtractedField>) => void;
  className?: string;
  maxSize?: number; // in MB (before base64 encoding)
}

export function DocumentUploadZone({
  documentType,
  label,
  onUploadComplete,
  onExtractionComplete,
  className = '',
  maxSize = 100, // 100MB limit to account for ~33% base64 encoding overhead
}: DocumentUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<DocumentUploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'uploading' | 'extracting' | 'complete' | 'error'>('idle');

  const handleFileSelect = async (file: File) => {
    setError(null);
    setExtractionStatus('uploading');

    // Validate file type first
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('File type not supported. Please upload JPEG, PNG, or WEBP images.');
      setExtractionStatus('error');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      let fileToUpload = file;
      let compressionInfo = '';

      // Check if compression is needed - use a lower threshold to catch more files
      const fileSizeMB = file.size / (1024 * 1024);
      console.log(`File size: ${fileSizeMB.toFixed(2)}MB, Max allowed: ${maxSize}MB`);
      
      if (fileSizeMB > 1) { // Compress files larger than 1MB (very aggressive)
        setUploadProgress(20);
        setExtractionStatus('extracting'); // Show compression status
        
        console.log('Compression needed, starting compression...');
        
        try {
          const compressionResult = await smartCompressImage(file, 3); // Target 3MB after compression (very aggressive)
          fileToUpload = compressionResult.compressedFile;
          
          const originalSizeMB = (compressionResult.originalSize / (1024 * 1024)).toFixed(2);
          const compressedSizeMB = (compressionResult.compressedSize / (1024 * 1024)).toFixed(2);
          const ratio = compressionResult.compressionRatio.toFixed(1);
          
          console.log(`Compression successful: ${originalSizeMB}MB -> ${compressedSizeMB}MB (${ratio}% reduction)`);
          
          compressionInfo = ` (compressed from ${originalSizeMB}MB to ${compressedSizeMB}MB, ${ratio}% reduction)`;
          
          toast({
            title: 'Image compressed',
            description: `File size reduced by ${ratio}% for faster upload`,
            duration: 3000,
          });
        } catch (compressionError) {
          console.error('Compression failed, using original file:', compressionError);
          // Continue with original file if compression fails
        }
      } else {
        console.log('File size is acceptable, no compression needed');
      }

      // Final size check after compression
      if (fileToUpload.size > maxSize * 1024 * 1024) {
        const actualSizeMB = (fileToUpload.size / (1024 * 1024)).toFixed(2);
        setError(`File size too large even after compression. Maximum size is ${maxSize}MB (your file is ${actualSizeMB}MB). Please use a smaller image.`);
        setExtractionStatus('error');
        return;
      }

      setUploadProgress(40);
      setExtractionStatus('extracting');

      // Convert to base64
      console.log(`Converting file to base64. Size: ${(fileToUpload.size / (1024 * 1024)).toFixed(2)}MB`);
      
      const arrayBuffer = await fileToUpload.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      
      // Process buffer in chunks to avoid stack overflow
      const chunkSize = 8192; // Process 8KB at a time
      let binaryString = '';
      
      for (let i = 0; i < buffer.length; i += chunkSize) {
        const chunk = buffer.slice(i, i + chunkSize);
        binaryString += String.fromCharCode(...chunk);
      }
      
      const base64String = btoa(binaryString);
      const base64SizeMB = (base64String.length * 0.75) / (1024 * 1024); // Base64 is ~33% larger
      
      console.log(`Base64 conversion complete. Base64 size: ${base64SizeMB.toFixed(2)}MB`);
      
      if (base64SizeMB > 100) {
        console.warn(`Base64 size (${base64SizeMB.toFixed(2)}MB) exceeds 100MB limit`);
      }
      
      setUploadProgress(40);
      setExtractionStatus('extracting');

      // Upload to backend
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/guest-checkin/documents/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          documentType,
          fileData: base64String,
          filename: fileToUpload.name,
          mimeType: fileToUpload.type,
          performExtraction: true,
        }),
      });

      setUploadProgress(80);

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || 'Upload failed';
        } catch (parseError) {
          // If response is not valid JSON, use status text
          errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        throw new Error('Invalid response from server. Please try again.');
      }
      
      setUploadProgress(100);
      setExtractionStatus('complete');

      const docResult: DocumentUploadResult = {
        documentId: result.document.id,
        documentType: result.document.documentType,
        filename: result.document.filename + compressionInfo,
        thumbnailUrl: result.document.thumbnailUrl,
        extractedData: result.extraction.data,
        overallConfidence: result.extraction.overallConfidence,
        detectedDocumentType: result.document.detectedDocumentType,
        documentTypeConfidence: result.document.documentTypeConfidence,
        success: true,
      };

      setUploadedDoc(docResult);
      onUploadComplete(docResult);

      // Trigger auto-fill if extraction succeeded
      if (result.extraction.status === 'completed' && onExtractionComplete) {
        onExtractionComplete(result.extraction.data);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload document');
      setExtractionStatus('error');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      // TODO: Implement camera capture UI
      // For now, just trigger file input
      handleButtonClick();
    } catch (error) {
      console.error('Camera access denied:', error);
      handleButtonClick(); // Fallback to file picker
    }
  };

  const handleClear = () => {
    setUploadedDoc(null);
    setExtractionStatus('idle');
    setError(null);
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />

      {!uploadedDoc ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-lg p-6 transition-all duration-200
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
            ${isUploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400 hover:bg-blue-50/50'}
          `}
        >
          <div className="text-center">
            <div className="mb-4">
              <Upload className="h-12 w-12 text-gray-400 mx-auto" />
            </div>
            
            <h3 className="text-sm font-medium text-gray-900 mb-2">{label}</h3>
            
            {isUploading ? (
              <div className="space-y-3">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                <p className="text-sm text-gray-600">
                  {extractionStatus === 'uploading' && 'Uploading document...'}
                  {extractionStatus === 'extracting' && 'Extracting information...'}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-4">
                  Drag and drop or click to upload
                </p>
                
                <div className="flex gap-3 justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleButtonClick}
                    className="flex-shrink-0"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose File
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCameraCapture}
                    className="flex-shrink-0"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
                  </Button>
                </div>

                <p className="text-xs text-gray-400 mt-3">
                  JPEG, PNG, WEBP • Max {maxSize}MB
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <h4 className="font-medium text-gray-900">{label} Uploaded</h4>
                </div>
                
                <p className="text-sm text-gray-600 mb-2">{uploadedDoc.filename}</p>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Extraction Confidence:</span>
                  <ConfidenceBadge score={uploadedDoc.overallConfidence} />
                </div>

                {Object.keys(uploadedDoc.extractedData).length > 0 && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs text-green-700 font-medium mb-2">Extracted Fields:</p>
                    <div className="space-y-1">
                      {Object.entries(uploadedDoc.extractedData).slice(0, 3).map(([field, data]) => (
                        <div key={field} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700">{field}:</span>
                          <span className="text-gray-900 font-medium truncate ml-2" style={{ maxWidth: '200px' }}>
                            {data.value}
                          </span>
                        </div>
                      ))}
                      {Object.keys(uploadedDoc.extractedData).length > 3 && (
                        <p className="text-xs text-gray-500 italic">
                          +{Object.keys(uploadedDoc.extractedData).length - 3} more fields
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert className="mt-3 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

