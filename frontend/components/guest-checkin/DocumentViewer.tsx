/**
 * Document Viewer Modal Component
 * Modal for viewing guest documents with zoom, rotate, and download controls
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useQuery } from '@tanstack/react-query';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  FileText,
  Maximize2,
  Minimize2,
  X,
  CheckCircle,
  Calendar,
  Shield,
  Eye
} from 'lucide-react';
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
  const [imageError, setImageError] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (documents.length > 0 && !selectedDocId) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId]);

  // Suspend realtime while the heavy documents modal is open
  useEffect(() => {
    if (open) {
      try { window.dispatchEvent(new CustomEvent('realtime:suspend')); } catch {}
      return () => {
        try { window.dispatchEvent(new CustomEvent('realtime:resume')); } catch {}
      };
    }
    return;
  }, [open]);

  // Fetch document data for the selected document
  const { data: documentData, isLoading: documentLoading } = useQuery({
    queryKey: ['document-data', selectedDocId],
    queryFn: async () => {
      if (!selectedDocId) return null;
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/guest-checkin/documents/${selectedDocId}/view`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }
      
      return response.json() as Promise<{ filename: string; mimeType: string; fileData: string }>;
    },
    enabled: !!selectedDocId && open,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

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

      const data = await response.json() as { filename: string; mimeType: string; fileData: string };
      
      // Convert base64 to blob and trigger download
      const byteCharacters = atob(data.fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
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

  const selectedDoc = documents.find(doc => doc.id === selectedDocId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogPortal>
        <DialogContent 
          className="max-w-6xl max-h-[98vh] w-[95vw] border-0 shadow-2xl bg-gradient-to-br from-slate-50 via-white to-green-50 flex flex-col rounded-3xl overflow-hidden"
          showCloseButton={false}
        >
          {/* Enhanced Sticky Header */}
          <div className="sticky top-0 z-[60] bg-gradient-to-r from-white via-green-50 to-emerald-50 border-b border-green-200/50 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="p-3 rounded-2xl shadow-lg bg-gradient-to-br from-green-100 to-emerald-200">
                  <div className="text-2xl">
                    📄
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent truncate">
                    Guest Documents
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-green-100 text-green-800 text-xs sm:text-sm font-bold px-3 py-1 shadow-md rounded-full">
                      <Shield className="h-3 w-3 mr-1" />
                      {guestName}
                    </Badge>
                    <div className="text-xs sm:text-sm text-gray-600 bg-white/50 px-2 py-1 rounded-full">
                      {documents.length} {documents.length === 1 ? 'Document' : 'Documents'}
                    </div>
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClose}
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 flex-shrink-0"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-400 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 m-6">
              <div className="text-center">
                <div className="p-4 bg-gray-200 rounded-full inline-block mb-4">
                  <FileText className="h-12 w-12 text-gray-500" />
                </div>
                <p className="text-gray-700 font-semibold text-lg">📝 No Documents Available</p>
                <p className="text-gray-600 text-sm">Upload documents during check-in to view them here</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto px-6 pb-6">
              <div className="space-y-6 p-2">
                <Tabs value={selectedDocId?.toString()} onValueChange={(val) => setSelectedDocId(parseInt(val))} className="space-y-6">
                  <div className="overflow-x-auto">
                    <TabsList className="w-full justify-start bg-gradient-to-r from-gray-100 to-green-100 rounded-lg p-2 border border-green-200">
                      {documents.map((doc) => (
                        <TabsTrigger
                          key={doc.id}
                          value={doc.id.toString()}
                          className="text-xs sm:text-sm px-4 py-3 data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-green-700 font-semibold rounded-lg transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
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
                      className="space-y-6 mt-0"
                    >
                      {/* Document Preview */}
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 p-4 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-lg border-2 border-indigo-200">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <div className="flex items-center gap-1 bg-white rounded-lg px-3 py-1 border border-indigo-200">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleZoomOut}
                                disabled={zoom <= 50}
                                className="h-8 w-8 p-0 hover:bg-indigo-100"
                              >
                                −
                              </Button>
                              <span className="text-sm font-medium text-indigo-700 min-w-[3rem] text-center">
                                {zoom}%
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleZoomIn}
                                disabled={zoom >= 200}
                                className="h-8 w-8 p-0 hover:bg-indigo-100"
                              >
                                +
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleResetView}
                                className="h-8 px-2 text-xs hover:bg-indigo-100"
                              >
                                Reset
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleRotate}
                              className="h-8 w-8 p-0 bg-white border border-indigo-200 hover:bg-indigo-100"
                            >
                              <RotateCw className="h-4 w-4 text-indigo-700" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setIsFullscreen(!isFullscreen)}
                              className="h-8 w-8 p-0 bg-white border border-indigo-200 hover:bg-indigo-100"
                            >
                              {isFullscreen ? <Minimize2 className="h-4 w-4 text-indigo-700" /> : <Maximize2 className="h-4 w-4 text-indigo-700" />}
                            </Button>
                            <Button 
                              onClick={() => handleDownload(doc.id)} 
                              size="sm"
                              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold px-3 py-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                              title="Download Document"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="border-2 border-gray-200 rounded-xl p-6 bg-white shadow-lg">
                          {documentLoading ? (
                            <div className="flex items-center justify-center h-64 border-2 border-dashed border-blue-300 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50">
                              <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
                                <p className="mt-4 text-blue-700 font-semibold">Loading document...</p>
                                <p className="text-blue-600 text-sm">Please wait while we fetch your document</p>
                              </div>
                            </div>
                          ) : !documentData ? (
                            <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-400 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200">
                              <div className="text-center">
                                <div className="p-4 bg-gray-200 rounded-full inline-block mb-4">
                                  <FileText className="h-12 w-12 text-gray-500" />
                                </div>
                                <p className="text-gray-700 font-semibold text-lg">📝 No Document Data</p>
                                <p className="text-gray-600 text-sm">Unable to load document preview</p>
                              </div>
                            </div>
                          ) : (
                          <div className={`flex justify-center p-4 bg-gray-50 rounded-lg border-2 border-gray-200 overflow-auto ${isFullscreen ? 'h-[70vh]' : 'h-96'}`}>
                              {!imageError[doc.id] ? (
                                <img
                                  src={`data:${documentData.mimeType};base64,${documentData.fileData}`}
                                  alt={formatDocumentType(doc.documentType)}
                                  className="rounded-lg shadow-lg border border-gray-300 hover:shadow-xl transition-shadow duration-300"
                                  style={{ 
                                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                                    transition: 'transform 0.3s ease',
                                    maxWidth: '100%',
                                    height: 'auto',
                                    objectFit: 'contain'
                                  }}
                                  onError={() => setImageError(prev => ({ ...prev, [doc.id]: true }))}
                                />
                              ) : (
                                <div className="bg-white p-8 shadow-lg rounded-lg text-center">
                                <FileText className="h-32 w-32 text-gray-300 mx-auto mb-4" />
                                <p className="text-sm text-gray-500">Document: {doc.filename}</p>
                                  <p className="text-xs text-gray-400 mt-2">Preview failed to load</p>
                              </div>
                              )}
                            </div>
                          )}

                          {/* File Info Below Preview */}
                          <div className="grid grid-cols-2 gap-4 mt-6">
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <span className="text-xs text-gray-500 block mb-1">Filename</span>
                              <p className="font-semibold text-gray-800 text-sm truncate">
                                {documentData?.filename || doc.originalFilename}
                              </p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <span className="text-xs text-gray-500 block mb-1">Size</span>
                              <p className="font-semibold text-gray-800">{(doc.fileSize / 1024).toFixed(2)} KB</p>
                            </div>
                            {documentData && (
                              <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                                <span className="text-xs text-gray-500 block mb-1">Type</span>
                                <p className="font-semibold text-gray-800">{documentData.mimeType}</p>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </div>
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

