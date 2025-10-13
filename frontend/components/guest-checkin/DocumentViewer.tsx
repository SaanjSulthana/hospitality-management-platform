/**
 * Document Viewer Modal Component
 * Modal for viewing guest documents with zoom, rotate, and download controls
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  X, 
  FileText,
  CheckCircle,
  AlertCircle,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { ConfidenceBadge } from './ConfidenceBadge';
import { API_CONFIG } from '../../src/config/api';

interface ExtractedField {
  value: string;
  confidence: number;
  needsVerification: boolean;
}

interface Document {
  id: number;
  documentType: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  thumbnailUrl: string;
  extractedData: Record<string, ExtractedField> | null;
  overallConfidence: number | null;
  extractionStatus: string;
  isVerified: boolean;
  createdAt: string;
}

interface DocumentViewerProps {
  open: boolean;
  onClose: () => void;
  guestCheckInId: number;
  guestName: string;
  documents: Document[];
}

export function DocumentViewer({
  open,
  onClose,
  guestCheckInId,
  guestName,
  documents,
}: DocumentViewerProps) {
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (documents.length > 0 && !selectedDocId) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId]);

  const selectedDoc = documents.find(d => d.id === selectedDocId);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleResetView = () => {
    setZoom(100);
    setRotation(0);
  };

  const handleDownload = async (documentId: number) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/guest-checkin/documents/${documentId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) throw new Error('Download failed');

      const data = await response.json();
      // Trigger download
      const link = document.createElement('a');
      link.href = data.url || data.filePath;
      link.download = data.filename;
      link.click();
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const formatDocumentType = (type: string): string => {
    const typeMap: Record<string, string> = {
      aadhaar_front: 'Aadhaar Card (Front)',
      aadhaar_back: 'Aadhaar Card (Back)',
      pan_card: 'PAN Card',
      passport: 'Passport',
      visa_front: 'Visa (Front)',
      visa_back: 'Visa (Back)',
    };
    return typeMap[type] || type;
  };

  const formatFieldName = (field: string): string => {
    return field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900">Guest Documents</DialogTitle>
              <p className="text-sm text-gray-600 mt-1">{guestName}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {documents.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900">No documents uploaded</p>
              <p className="text-sm text-gray-600 mt-2">Upload documents during check-in to view them here</p>
            </div>
          </div>
        ) : (
          <Tabs value={selectedDocId?.toString()} onValueChange={(val) => setSelectedDocId(parseInt(val))} className="flex-1 flex flex-col overflow-hidden">
            {/* Document Tabs */}
            <div className="border-b border-gray-200">
              <TabsList className="w-full justify-start overflow-x-auto bg-gray-50 rounded-none h-auto p-2">
                {documents.map((doc) => (
                  <TabsTrigger
                    key={doc.id}
                    value={doc.id.toString()}
                    className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      {formatDocumentType(doc.documentType)}
                      {doc.isVerified && (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      )}
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Document Content */}
            {documents.map((doc) => (
              <TabsContent 
                key={doc.id}
                value={doc.id.toString()}
                className="flex-1 overflow-y-auto mt-0 pt-4"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Image Viewer */}
                  <div className="lg:col-span-2">
                    <Card className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{formatDocumentType(doc.documentType)}</CardTitle>
                          
                          {/* View Controls */}
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleZoomOut}>
                              <ZoomOut className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleZoomIn}>
                              <ZoomIn className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleRotate}>
                              <RotateCw className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleResetView}>
                              Reset
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
                              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </Button>
                            <Button 
                              className="bg-blue-600 hover:bg-blue-700" 
                              size="sm"
                              onClick={() => handleDownload(doc.id)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className={`bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center ${isFullscreen ? 'h-[70vh]' : 'h-96'}`}>
                          <div
                            style={{
                              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                              transition: 'transform 0.3s ease',
                            }}
                          >
                            {/* Placeholder for document image */}
                            <div className="bg-white p-8 shadow-lg rounded-lg text-center">
                              <FileText className="h-32 w-32 text-gray-300 mx-auto mb-4" />
                              <p className="text-sm text-gray-500">Document: {doc.filename}</p>
                              <p className="text-xs text-gray-400 mt-2">Image display coming soon</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                          <span>Zoom: {zoom}%</span>
                          <span>Rotation: {rotation}°</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Extracted Information */}
                  <div className="space-y-4">
                    {/* Extraction Status */}
                    <Card className="border-l-4 border-l-green-500 shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-md flex items-center gap-2">
                          <FileText className="h-4 w-4 text-green-600" />
                          Extraction Status
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">Status:</span>
                          <Badge className={
                            doc.extractionStatus === 'completed' ? 'bg-green-100 text-green-800' :
                            doc.extractionStatus === 'processing' ? 'bg-blue-100 text-blue-800' :
                            doc.extractionStatus === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {doc.extractionStatus}
                          </Badge>
                        </div>

                        {doc.overallConfidence !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Confidence:</span>
                            <ConfidenceBadge score={doc.overallConfidence} size="md" />
                          </div>
                        )}

                        {doc.isVerified && (
                          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center gap-2 text-green-700">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm font-medium">Verified by Staff</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Extracted Fields */}
                    {doc.extractedData && Object.keys(doc.extractedData).length > 0 && (
                      <Card className="border-l-4 border-l-purple-500 shadow-sm">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-md">Extracted Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {Object.entries(doc.extractedData).map(([field, data]) => (
                              <div key={field} className="p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-start justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-700">
                                    {formatFieldName(field)}
                                  </span>
                                  {data.needsVerification && (
                                    <AlertCircle className="h-3 w-3 text-orange-600" />
                                  )}
                                </div>
                                <p className="text-sm text-gray-900 font-medium break-words">
                                  {data.value}
                                </p>
                                <div className="mt-2">
                                  <ConfidenceBadge score={data.confidence} showIcon={false} size="sm" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Document Metadata */}
                    <Card className="border-l-4 border-l-gray-500 shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-md">Document Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">File Size:</span>
                          <span className="font-medium text-gray-900">
                            {(doc.fileSize / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Uploaded:</span>
                          <span className="font-medium text-gray-900">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Original Name:</span>
                          <span className="font-medium text-gray-900 truncate ml-2">
                            {doc.originalFilename}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

