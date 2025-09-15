import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal } from './dialog';
import { Button } from './button';
import { Badge } from './badge';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { Download, FileText, Image, X, Calendar, Building2, User, Receipt, Check } from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { formatTransactionDateTime } from '../../lib/datetime';
import { useTheme } from '../../contexts/ThemeContext';
import { API_CONFIG } from '../../src/config/api';

interface ReceiptViewerProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: {
    id: number;
    type: 'expense' | 'revenue';
    category?: string;
    source?: string;
    propertyName: string;
    amountCents: number;
    description?: string;
    receiptUrl?: string;
    receiptFileId?: number;
    date: Date;
    createdAt?: Date;
    createdByName: string;
    status?: string;
    paymentMode?: string;
    bankReference?: string;
    approvedByName?: string;
    approvedAt?: Date;
  } | null;
}

export function ReceiptViewer({ isOpen, onClose, transaction }: ReceiptViewerProps) {
  const { getAuthenticatedBackend } = useAuth();
  const { theme } = useTheme();
  const [imageError, setImageError] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Debug logging
  useEffect(() => {
    if (transaction) {
      console.log('ReceiptViewer transaction data:', {
        id: transaction.id,
        type: transaction.type,
        status: transaction.status,
        date: transaction.date,
        createdAt: transaction.createdAt,
        approvedByName: transaction.approvedByName,
        approvedAt: transaction.approvedAt,
        createdByName: transaction.createdByName,
        amountCents: transaction.amountCents
      });
    }
  }, [transaction]);

  // Zoom control functions
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 25, 50));
  };

  const handleZoomReset = () => {
    setZoomLevel(100);
  };

  // Fetch file info if we have a receipt file ID
  const { data: fileInfo, isLoading: fileInfoLoading } = useQuery({
    queryKey: ['file-info', transaction?.receiptFileId],
    queryFn: async () => {
      if (!transaction?.receiptFileId) return null;
      
      // Direct API call since uploads service isn't in generated client yet
      const response = await fetch(`${API_CONFIG.BASE_URL}/uploads/${transaction.receiptFileId}/info`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file info: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: !!transaction?.receiptFileId && isOpen,
  });

  // Fetch file data for viewing
  const { data: fileData, isLoading: fileDataLoading } = useQuery({
    queryKey: ['file-data', transaction?.receiptFileId],
    queryFn: async () => {
      if (!transaction?.receiptFileId) return null;
      
      // Direct API call since uploads service isn't in generated client yet
      const response = await fetch(`${API_CONFIG.BASE_URL}/uploads/${transaction.receiptFileId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: !!transaction?.receiptFileId && isOpen,
  });

  const downloadReceipt = () => {
    if (fileData) {
      const byteCharacters = atob(fileData.fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: fileData.mimeType });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileData.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else if (transaction?.receiptUrl) {
      // Check if it's a local file URL and handle it appropriately
      if (transaction.receiptUrl.startsWith('file://')) {
        // For local files, show a message to the user
        alert('This receipt is stored locally on your computer. Please open it directly from your file system.');
        return;
      }
      
      // For external URLs, open in new tab
      window.open(transaction.receiptUrl, '_blank');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'room': return 'bg-blue-100 text-blue-800';
      case 'addon': return 'bg-purple-100 text-purple-800';
      case 'other': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isImage = (mimeType?: string) => {
    return mimeType?.startsWith('image/') || false;
  };

  const isPdf = (mimeType?: string) => {
    return mimeType === 'application/pdf';
  };

  // Don't render if no transaction
  if (!transaction) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        <DialogContent 
          className="max-w-6xl max-h-[98vh] w-[95vw] border-0 shadow-2xl bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col rounded-3xl overflow-hidden"
          showCloseButton={false}
        >
        {/* Enhanced Sticky Header */}
        <div className="sticky top-0 z-[60] bg-gradient-to-r from-white via-blue-50 to-indigo-50 border-b border-blue-200/50 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className={`p-3 rounded-2xl shadow-lg ${transaction.type === 'expense' ? 'bg-gradient-to-br from-red-100 to-red-200' : 'bg-gradient-to-br from-green-100 to-green-200'}`}>
                <div className="text-2xl">
                  {transaction.type === 'expense' ? '💰' : '📈'}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent truncate">
                  {transaction.type === 'expense' ? 'Expense' : 'Revenue'} Receipt
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  {transaction.status && (
                    <Badge className={`${getStatusColor(transaction.status)} text-xs sm:text-sm font-bold px-3 py-1 shadow-md rounded-full`}>
                      {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                    </Badge>
                  )}
                  <div className="text-xs sm:text-sm text-gray-600 bg-white/50 px-2 py-1 rounded-full">
                    {formatCurrency(transaction.amountCents)}
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
        
        <div className="flex-1 overflow-auto px-6 pb-6">
          <div className="space-y-6 p-2">
          {/* Transaction Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border-2 border-blue-100 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="p-2 rounded-full bg-blue-100">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <span className="text-sm text-gray-600 block">Property</span>
                  <span className="font-semibold text-gray-800">{transaction.propertyName}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="p-2 rounded-full bg-purple-100">
                  <Calendar className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1">
                  <span className="text-sm text-gray-600 block">
                    {transaction.type === 'expense' ? 'Expense Date' : 'Revenue Date'}
                  </span>
                  <span className="font-semibold text-gray-800">{formatTransactionDateTime(transaction.date)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="p-2 rounded-full bg-orange-100">
                  <User className="h-4 w-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <span className="text-sm text-gray-600 block">Created By</span>
                  <span className="font-semibold text-gray-800">{transaction.createdByName}</span>
                </div>
              </div>

              {transaction.createdAt && (
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="p-2 rounded-full bg-indigo-100">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm text-gray-600 block">Created At</span>
                    <span className="font-semibold text-gray-800">{formatTransactionDateTime(transaction.createdAt)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {transaction.category && (
                <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                  <span className="text-sm text-gray-600 block mb-1">Category</span>
                  <Badge variant="outline" className="bg-gray-50 text-gray-800 font-semibold px-3 py-1">
                    {transaction.category}
                  </Badge>
                </div>
              )}

              {transaction.source && (
                <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                  <span className="text-sm text-gray-600 block mb-1">Source</span>
                  <Badge className={`${getSourceColor(transaction.source)} font-semibold px-3 py-1 shadow-sm`}>
                    {transaction.source}
                  </Badge>
                </div>
              )}

              {transaction.paymentMode && (
                <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                  <span className="text-sm text-gray-600 block mb-1">Payment Mode</span>
                  <Badge className={`${transaction.paymentMode === 'cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'} font-semibold px-3 py-1 shadow-sm`}>
                    {transaction.paymentMode === 'cash' ? 'Cash' : 'Bank/UPI/Online'}
                  </Badge>
                </div>
              )}

              {transaction.bankReference && (
                <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                  <span className="text-sm text-gray-600 block mb-1">Bank Reference</span>
                  <p className="font-semibold text-gray-800 text-sm">{transaction.bankReference}</p>
                </div>
              )}

              {transaction.description && (
                <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                  <span className="text-sm text-gray-600 block mb-2">Description</span>
                  <p className="text-gray-800 font-medium">{transaction.description}</p>
                </div>
              )}

              {(transaction.status === 'approved' || transaction.status === 'rejected') && (
                <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                  <span className="text-sm text-gray-600 block mb-1">
                    {transaction.status === 'approved' ? 'Approved By' : 'Rejected By'}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded-full ${
                      transaction.status === 'approved' 
                        ? 'bg-green-100' 
                        : 'bg-red-100'
                    }`}>
                      <Check className={`h-3 w-3 ${
                        transaction.status === 'approved' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">
                        {transaction.approvedByName || 'System Action'}
                      </p>
                      {transaction.approvedAt ? (
                        <p className="text-xs text-gray-500">
                          {new Date(transaction.approvedAt).toLocaleDateString()} at {new Date(transaction.approvedAt).toLocaleTimeString()}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">Auto-{transaction.status}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {transaction.status === 'pending' && (
                <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                  <span className="text-sm text-gray-600 block mb-1">Status</span>
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-full bg-yellow-100">
                      <div className="h-3 w-3 rounded-full bg-yellow-500 animate-pulse"></div>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">Pending Approval</p>
                      <p className="text-xs text-gray-500">Awaiting admin review</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Receipt Display */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-lg border-2 border-indigo-200">
              <h3 className="text-xl font-bold text-indigo-800 flex items-center gap-2">
                📄 Receipt Document
              </h3>
              <div className="flex items-center gap-2">
                {(fileData || transaction.receiptUrl) && (
                  <>
                    <div className="flex items-center gap-1 bg-white rounded-lg px-3 py-1 border border-indigo-200">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleZoomOut}
                        disabled={zoomLevel <= 50}
                        className="h-8 w-8 p-0 hover:bg-indigo-100"
                      >
                        −
                      </Button>
                      <span className="text-sm font-medium text-indigo-700 min-w-[3rem] text-center">
                        {zoomLevel}%
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleZoomIn}
                        disabled={zoomLevel >= 300}
                        className="h-8 w-8 p-0 hover:bg-indigo-100"
                      >
                        +
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleZoomReset}
                        className="h-8 px-2 text-xs hover:bg-indigo-100"
                      >
                        Reset
                      </Button>
                    </div>
                    <Button 
                      onClick={downloadReceipt} 
                      size="sm"
                      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold px-3 py-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                      title="Download Receipt"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {!transaction.receiptFileId && !transaction.receiptUrl ? (
              <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-400 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200">
                <div className="text-center">
                  <div className="p-4 bg-gray-200 rounded-full inline-block mb-4">
                    <FileText className="h-12 w-12 text-gray-500" />
                  </div>
                  <p className="text-gray-700 font-semibold text-lg">📝 No Receipt Available</p>
                  <p className="text-gray-600 text-sm">No receipt was uploaded for this transaction</p>
                </div>
              </div>
            ) : fileInfoLoading || fileDataLoading ? (
              <div className="flex items-center justify-center h-64 border-2 border-dashed border-blue-300 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-blue-700 font-semibold">Loading receipt...</p>
                  <p className="text-blue-600 text-sm">Please wait while we fetch your document</p>
                </div>
              </div>
            ) : fileData && fileInfo ? (
              <div className="space-y-4">
                {/* Receipt Preview Section - Preview First */}
                <div className="border-2 border-gray-200 rounded-xl p-6 bg-white shadow-lg">
                  {/* Preview First */}
                  {isImage(fileInfo.mimeType) && !imageError ? (
                    <div className="flex justify-center p-4 bg-gray-50 rounded-lg border-2 border-gray-200 overflow-auto mb-6">
                      <img
                        src={`data:${fileInfo.mimeType};base64,${fileData.fileData}`}
                        alt="Receipt"
                        className="rounded-lg shadow-lg border border-gray-300 hover:shadow-xl transition-shadow duration-300"
                        style={{ 
                          width: `${zoomLevel}%`, 
                          height: 'auto',
                          maxWidth: '100%',
                          objectFit: 'contain'
                        }}
                        onError={() => setImageError(true)}
                      />
                    </div>
                  ) : isPdf(fileInfo.mimeType) ? (
                    <div className="flex items-center justify-center h-64 border-2 border-dashed border-blue-300 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 mb-6">
                      <div className="text-center">
                        <div className="p-4 bg-blue-100 rounded-full inline-block mb-4">
                          <FileText className="h-12 w-12 text-blue-600" />
                        </div>
                        <p className="text-blue-800 font-bold text-lg mb-2">📄 PDF Document</p>
                        <p className="text-blue-600 text-sm mb-4">This is a PDF file. Click the download button to view.</p>
                        <div className="bg-white/50 rounded-lg px-4 py-2 inline-block">
                          <span className="text-blue-700 font-medium">{fileInfo?.originalName}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 border-2 border-dashed border-amber-300 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 mb-6">
                      <div className="text-center">
                        <div className="p-4 bg-amber-100 rounded-full inline-block mb-4">
                          <FileText className="h-12 w-12 text-amber-600" />
                        </div>
                        <p className="text-amber-800 font-bold text-lg mb-2">📋 Document File</p>
                        <p className="text-amber-600 text-sm mb-4">This file type is not previewable. Click download to view.</p>
                        <div className="bg-white/50 rounded-lg px-4 py-2 inline-block">
                          <span className="text-amber-700 font-medium">{fileInfo?.originalName}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* File Info Below Preview */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="text-xs text-gray-500 block mb-1">Filename</span>
                      <p className="font-semibold text-gray-800">{fileInfo.originalName}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="text-xs text-gray-500 block mb-1">Size</span>
                      <p className="font-semibold text-gray-800">{(fileInfo.fileSize / 1024).toFixed(2)} KB</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="text-xs text-gray-500 block mb-1">Type</span>
                      <p className="font-semibold text-gray-800">{fileInfo.mimeType}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="text-xs text-gray-500 block mb-1">Uploaded</span>
                      <p className="font-semibold text-gray-800">{new Date(fileInfo.uploadedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

              </div>
            ) : transaction.receiptUrl ? (
              <div className="flex items-center justify-center h-64 border-2 border-dashed border-blue-300 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50">
                <div className="text-center">
                  <div className="p-4 bg-blue-100 rounded-full inline-block mb-4">
                    <Image className="h-12 w-12 text-blue-600" />
                  </div>
                  {transaction.receiptUrl.startsWith('file://') ? (
                    <>
                      <p className="text-orange-700 font-semibold text-lg">📁 Local File Receipt</p>
                      <p className="text-orange-600 text-sm mb-4">This receipt is stored locally on your computer</p>
                      <p className="text-gray-600 text-xs mb-4">File path: {transaction.receiptUrl.replace('file:///', '')}</p>
                      <Button 
                        onClick={() => alert('Please open this file directly from your file system: ' + (transaction.receiptUrl || '').replace('file:///', ''))} 
                        className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold px-6 py-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                      >
                        📂 Open Local File
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-blue-700 font-semibold text-lg">🔗 External Receipt</p>
                      <p className="text-blue-600 text-sm mb-4">Receipt is stored at an external location</p>
                      <Button 
                        onClick={() => window.open(transaction.receiptUrl, '_blank')} 
                        className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold px-6 py-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                      >
                        🌐 View External Receipt
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          </div> {/* Close scrollable content */}
        </div> {/* Close content wrapper */}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
