/**
 * Document Card Component
 * Displays uploaded document thumbnail with metadata
 */

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Eye, Download, Trash2, CheckCircle, FileText } from 'lucide-react';
import { ConfidenceBadge } from './ConfidenceBadge';

interface DocumentCardProps {
  document: {
    id: number;
    documentType: string;
    filename: string;
    thumbnailUrl: string;
    fileSize: number;
    overallConfidence: number | null;
    extractionStatus: string;
    isVerified: boolean;
    createdAt: string;
  };
  onView?: (documentId: number) => void;
  onDownload?: (documentId: number) => void;
  onDelete?: (documentId: number) => void;
  className?: string;
}

export function DocumentCard({
  document,
  onView,
  onDownload,
  onDelete,
  className = '',
}: DocumentCardProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDocumentType = (type: string): string => {
    const typeMap: Record<string, string> = {
      aadhaar_front: 'Aadhaar (Front)',
      aadhaar_back: 'Aadhaar (Back)',
      pan_card: 'PAN Card',
      passport: 'Passport',
      visa_front: 'Visa (Front)',
      visa_back: 'Visa (Back)',
    };
    return typeMap[type] || type;
  };

  const getExtractionStatusBadge = () => {
    switch (document.extractionStatus) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">Extracted</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs">Processing...</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-300 text-xs">Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300 text-xs">Pending</Badge>;
    }
  };

  return (
    <Card className={`border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Thumbnail */}
          <div className="flex-shrink-0">
            <div className="w-20 h-20 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
              {document.thumbnailUrl ? (
                <img 
                  src={`http://localhost:4000${document.thumbnailUrl}`}
                  alt={document.documentType}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '';
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <FileText className="h-8 w-8 text-gray-400" />
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 text-sm truncate">
                  {formatDocumentType(document.documentType)}
                </h4>
                <p className="text-xs text-gray-500 truncate">{document.filename}</p>
              </div>
              {document.isVerified && (
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              {getExtractionStatusBadge()}
              {document.overallConfidence !== null && document.overallConfidence > 0 && (
                <ConfidenceBadge score={document.overallConfidence} showIcon={false} size="sm" />
              )}
              <span className="text-xs text-gray-500">{formatFileSize(document.fileSize)}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {onView && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onView(document.id)}
                  className="flex-shrink-0 h-8 text-xs"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
              )}
              
              {onDownload && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDownload(document.id)}
                  className="flex-shrink-0 h-8 text-xs"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
              )}
              
              {onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(document.id)}
                  className="flex-shrink-0 h-8 text-xs text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

