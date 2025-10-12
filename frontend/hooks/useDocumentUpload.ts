/**
 * useDocumentUpload Hook
 * Custom hook for handling document uploads with LLM extraction
 */

import { useState } from 'react';
import { API_CONFIG } from '../src/config/api';
import { smartCompressImage, needsCompression } from '../src/utils/image-compression';

export interface ExtractedField {
  value: string;
  confidence: number;
  needsVerification: boolean;
}

export interface UploadResult {
  documentId: number;
  documentType: string;
  filename: string;
  thumbnailUrl: string;
  extractedData: Record<string, ExtractedField>;
  overallConfidence: number;
}

export function useDocumentUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadDocument = async (
    file: File,
    documentType: string,
    guestCheckInId?: number
  ): Promise<UploadResult> => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Validate file type first
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload JPEG, PNG, or WEBP images.');
      }

      setUploadProgress(10);

      let fileToUpload = file;

      // Check if compression is needed - very aggressive approach
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > 1) { // Compress files larger than 1MB
        setUploadProgress(20);
        
        try {
          const compressionResult = await smartCompressImage(file, 3); // Target 3MB after compression
          fileToUpload = compressionResult.compressedFile;
          
          console.log(`File compressed: ${compressionResult.compressionRatio.toFixed(1)}% size reduction`);
        } catch (compressionError) {
          console.warn('Compression failed, using original file:', compressionError);
          // Continue with original file if compression fails
        }
      }

      // Final size check after compression
      if (fileToUpload.size > 100 * 1024 * 1024) {
        throw new Error('File size exceeds 100MB limit even after compression');
      }

      setUploadProgress(30);

      // Convert file to base64 for upload
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

      // Upload to API using base64
      const response = await fetch(`${API_CONFIG.BASE_URL}/guest-checkin/documents/upload`, {
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
          ...(guestCheckInId && { guestCheckInId }),
        }),
      });

      setUploadProgress(80);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();
      setUploadProgress(100);

      return {
        documentId: result.document.id,
        documentType: result.document.documentType,
        filename: result.document.filename,
        thumbnailUrl: result.document.thumbnailUrl,
        extractedData: result.extraction.data,
        overallConfidence: result.extraction.overallConfidence,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload document';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const resetUpload = () => {
    setError(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  return {
    uploadDocument,
    isUploading,
    uploadProgress,
    error,
    resetUpload,
  };
}

