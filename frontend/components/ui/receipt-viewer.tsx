import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal } from './dialog';
import { Button } from './button';
import { Badge } from './badge';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { Download, FileText, Image, X, Calendar, Building2, User, Receipt } from 'lucide-react';
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
    createdByName: string;
    status?: string;
  } | null;
}

export function ReceiptViewer({ isOpen, onClose, transaction }: ReceiptViewerProps) {
  const { getAuthenticatedBackend } = useAuth();
  const { theme } = useTheme();
  const [imageError, setImageError] = useState(false);



  // Fetch file info if we have a receipt file ID
  const { data: fileInfo, isLoading: fileInfoLoading } = useQuery({
    queryKey: ['file-info', transaction?.receiptFileId],
    queryFn: async () => {
      if (!transaction?.receiptFileId) return null;
      
      // Direct API call since uploads service isn't in generated client yet
      const response = await fetch(`${API_CONFIG.BASE_URL}/uploads/file/${transaction.receiptFileId}/info`, {
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
      const response = await fetch(`${API_CONFIG.BASE_URL}/uploads/file/${transaction.receiptFileId}`, {
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
          className="max-w-5xl max-h-[95vh] overflow-auto border-2 border-blue-200 shadow-2xl bg-gradient-to-br from-white to-blue-50"
          showCloseButton={false}
        >
        {/* Fixed Close Button - positioned with sticky to stay in place during scroll */}
        <div className="sticky top-0 right-0 z-[60] flex justify-end p-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="px-6 pb-6">
        <DialogHeader className="pb-6 border-b border-blue-100">
          
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold">
              <div className={`p-2 rounded-full ${transaction.type === 'expense' ? 'bg-red-100' : 'bg-green-100'}`}>
                {transaction.type === 'expense' ? '💰' : '📈'}
              </div>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {transaction.type === 'expense' ? 'Expense' : 'Revenue'} Receipt
              </span>
              {transaction.status && (
                <Badge className={`${getStatusColor(transaction.status)} text-sm font-semibold px-3 py-1 shadow-sm`}>
                  {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                </Badge>
              )}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6 p-2">
          {/* Transaction Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border-2 border-blue-100 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className={`p-2 rounded-full ${transaction.type === 'expense' ? 'bg-red-100' : 'bg-green-100'}`}>
                  <Receipt className={`h-4 w-4 ${transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'}`} />
                </div>
                <div className="flex-1">
                  <span className="text-sm text-gray-600 block">Amount</span>
                  <span className={`font-bold text-lg ${transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(transaction.amountCents, theme.currency)}
                  </span>
                </div>
              </div>
              
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
                  <span className="text-sm text-gray-600 block">Date & Time</span>
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

              {transaction.description && (
                <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                  <span className="text-sm text-gray-600 block mb-2">Description</span>
                  <p className="text-gray-800 font-medium">{transaction.description}</p>
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
              {(fileData || transaction.receiptUrl) && (
                <Button 
                  onClick={downloadReceipt} 
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold px-6 py-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Receipt
                </Button>
              )}
            </div>

            {fileInfoLoading || fileDataLoading ? (
              <div className="flex items-center justify-center h-64 border-2 border-dashed border-blue-300 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-blue-700 font-semibold">Loading receipt...</p>
                  <p className="text-blue-600 text-sm">Please wait while we fetch your document</p>
                </div>
              </div>
            ) : fileData && fileInfo ? (
              <div className="border-2 border-gray-200 rounded-xl p-6 bg-white shadow-lg">
                <div className="mb-6 grid grid-cols-2 gap-4">
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

                {isImage(fileInfo.mimeType) && !imageError ? (
                  <div className="flex justify-center p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                    <img
                      src={`data:${fileInfo.mimeType};base64,${fileData.fileData}`}
                      alt="Receipt"
                      className="max-w-full max-h-96 object-contain rounded-lg shadow-lg border border-gray-300 hover:shadow-xl transition-shadow duration-300"
                      onError={() => setImageError(true)}
                    />
                  </div>
                ) : isPdf(fileInfo.mimeType) ? (
                  <div className="flex items-center justify-center h-64 border-2 border-dashed border-red-300 rounded-xl bg-gradient-to-br from-red-50 to-pink-50">
                    <div className="text-center">
                      <div className="p-4 bg-red-100 rounded-full inline-block mb-4">
                        <FileText className="h-12 w-12 text-red-600" />
                      </div>
                      <p className="text-red-700 font-semibold text-lg">📄 PDF Receipt</p>
                      <p className="text-red-600 text-sm mt-1">Click the download button above to view this PDF</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 border-2 border-dashed border-yellow-300 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50">
                    <div className="text-center">
                      <div className="p-4 bg-yellow-100 rounded-full inline-block mb-4">
                        <FileText className="h-12 w-12 text-yellow-600" />
                      </div>
                      <p className="text-yellow-700 font-semibold text-lg">📋 Receipt File</p>
                      <p className="text-yellow-600 text-sm mt-1">Click the download button above to view this file</p>
                    </div>
                  </div>
                )}
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
            ) : (
              <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-400 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200">
                <div className="text-center">
                  <div className="p-4 bg-gray-200 rounded-full inline-block mb-4">
                    <FileText className="h-12 w-12 text-gray-500" />
                  </div>
                  <p className="text-gray-700 font-semibold text-lg">📝 No Receipt Available</p>
                  <p className="text-gray-600 text-sm">No receipt was uploaded for this transaction</p>
                </div>
              </div>
            )}
          </div>
        </div>
        </div> {/* Close content wrapper */}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
