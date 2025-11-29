import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, FileText, Calendar, DollarSign, Eye, Filter, Search, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface Payslip {
  id: number;
  staffId: number;
  staffName: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  grossPayCents: number;
  deductionsCents: number;
  netPayCents: number;
  status: 'draft' | 'generated' | 'sent' | 'paid';
  generatedAt: string;
  pdfUrl?: string;
  breakdown?: {
    baseSalaryCents: number;
    overtimeCents: number;
    bonusCents: number;
    allowanceCents: number;
    taxCents: number;
    insuranceCents: number;
    otherDeductionsCents: number;
  };
}

interface SalaryHistoryProps {
  staffId?: number;
  showAll?: boolean;
}

const SalaryHistory: React.FC<SalaryHistoryProps> = ({ staffId, showAll = false }) => {
  const { getAuthenticatedBackend, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Check mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // API Query
  const { data: payslips, isLoading, error } = useQuery({
    queryKey: ['payslips', staffId, searchTerm, filterStatus, filterYear, currentPage],
    queryFn: () => getAuthenticatedBackend().staff.payslips({
      staffId: staffId,
      search: searchTerm,
      status: filterStatus === 'all' ? undefined : filterStatus,
      year: parseInt(filterYear),
      page: currentPage,
      limit: itemsPerPage,
    }),
    refetchInterval: false, // Disabled: Use WebSocket/Pub-Sub for real-time updates
    staleTime: 30000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'outline',
      generated: 'default',
      sent: 'secondary',
      paid: 'default',
    };
    const colors: Record<string, string> = {
      draft: 'text-gray-600',
      generated: 'text-blue-600',
      sent: 'text-yellow-600',
      paid: 'text-green-600',
    };
    return (
      <Badge variant={variants[status] || 'default'} className={colors[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const handleDownloadPayslip = (payslip: Payslip) => {
    if (payslip.pdfUrl) {
      window.open(payslip.pdfUrl, '_blank');
    }
  };

  const handleViewBreakdown = (payslip: Payslip) => {
    setSelectedPayslip(payslip);
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i.toString());
    }
    return years;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading salary history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Salary History</h3>
        <p className="text-muted-foreground">
          There was a problem loading the salary history. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Salary History
          </h2>
          <p className="text-muted-foreground">
            View and download payslips and salary records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            <RefreshCw className="h-3 w-3 mr-1" />
            Auto-refresh
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search payslips..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="generated">Generated</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Year</label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {generateYearOptions().map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                  setFilterYear(new Date().getFullYear().toString());
                  setCurrentPage(1);
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payslips List */}
      <Card>
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
          <CardDescription>
            {payslips?.pagination?.total || 0} payslips found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payslips?.payslips?.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No payslips found</h3>
              <p className="text-muted-foreground">
                No payslips match your current filters
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {payslips?.payslips?.map((payslip: Payslip) => (
                <Card key={payslip.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Mobile Layout */}
                    {isMobile ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{payslip.staffName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(payslip.payPeriodStart), 'MMM dd')} - {format(new Date(payslip.payPeriodEnd), 'MMM dd, yyyy')}
                            </p>
                          </div>
                          {getStatusBadge(payslip.status)}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Gross Pay</p>
                            <p className="font-semibold text-green-600">
                              {formatCurrency(payslip.grossPayCents)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Net Pay</p>
                            <p className="font-semibold text-blue-600">
                              {formatCurrency(payslip.netPayCents)}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewBreakdown(payslip)}
                            className="flex-1"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {payslip.pdfUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadPayslip(payslip)}
                              className="flex-1"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Desktop Layout */
                      <>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{payslip.staffName}</h3>
                            {getStatusBadge(payslip.status)}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Pay Period</p>
                              <p className="font-medium">
                                {format(new Date(payslip.payPeriodStart), 'MMM dd')} - {format(new Date(payslip.payPeriodEnd), 'MMM dd, yyyy')}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Gross Pay</p>
                              <p className="font-semibold text-green-600">
                                {formatCurrency(payslip.grossPayCents)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Deductions</p>
                              <p className="font-semibold text-red-600">
                                {formatCurrency(payslip.deductionsCents)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Net Pay</p>
                              <p className="font-semibold text-blue-600 text-lg">
                                {formatCurrency(payslip.netPayCents)}
                              </p>
                            </div>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mt-2">
                            Generated: {format(new Date(payslip.generatedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewBreakdown(payslip)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Breakdown
                          </Button>
                          {payslip.pdfUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadPayslip(payslip)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download PDF
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {payslips?.pagination && payslips.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, payslips.pagination.total)} of {payslips.pagination.total} payslips
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 py-1 text-sm">
                  Page {currentPage} of {payslips.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(payslips.pagination.totalPages, prev + 1))}
                  disabled={currentPage === payslips.pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payslip Breakdown Dialog */}
      <Dialog open={!!selectedPayslip} onOpenChange={() => setSelectedPayslip(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payslip Breakdown
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown for {selectedPayslip?.staffName}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayslip && (
            <div className="space-y-6">
              {/* Pay Period */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Pay Period</h3>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedPayslip.payPeriodStart), 'MMMM dd, yyyy')} - {format(new Date(selectedPayslip.payPeriodEnd), 'MMMM dd, yyyy')}
                </p>
              </div>

              {/* Earnings */}
              <div>
                <h3 className="font-semibold mb-3 text-green-600">Earnings</h3>
                <div className="space-y-2">
                  {selectedPayslip.breakdown?.baseSalaryCents && (
                    <div className="flex justify-between">
                      <span>Base Salary</span>
                      <span className="font-medium">{formatCurrency(selectedPayslip.breakdown.baseSalaryCents)}</span>
                    </div>
                  )}
                  {selectedPayslip.breakdown?.overtimeCents && (
                    <div className="flex justify-between">
                      <span>Overtime</span>
                      <span className="font-medium">{formatCurrency(selectedPayslip.breakdown.overtimeCents)}</span>
                    </div>
                  )}
                  {selectedPayslip.breakdown?.bonusCents && (
                    <div className="flex justify-between">
                      <span>Bonus</span>
                      <span className="font-medium">{formatCurrency(selectedPayslip.breakdown.bonusCents)}</span>
                    </div>
                  )}
                  {selectedPayslip.breakdown?.allowanceCents && (
                    <div className="flex justify-between">
                      <span>Allowance</span>
                      <span className="font-medium">{formatCurrency(selectedPayslip.breakdown.allowanceCents)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-semibold text-green-600">
                    <span>Total Gross Pay</span>
                    <span>{formatCurrency(selectedPayslip.grossPayCents)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <h3 className="font-semibold mb-3 text-red-600">Deductions</h3>
                <div className="space-y-2">
                  {selectedPayslip.breakdown?.taxCents && (
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span className="font-medium">{formatCurrency(selectedPayslip.breakdown.taxCents)}</span>
                    </div>
                  )}
                  {selectedPayslip.breakdown?.insuranceCents && (
                    <div className="flex justify-between">
                      <span>Insurance</span>
                      <span className="font-medium">{formatCurrency(selectedPayslip.breakdown.insuranceCents)}</span>
                    </div>
                  )}
                  {selectedPayslip.breakdown?.otherDeductionsCents && (
                    <div className="flex justify-between">
                      <span>Other Deductions</span>
                      <span className="font-medium">{formatCurrency(selectedPayslip.breakdown.otherDeductionsCents)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-semibold text-red-600">
                    <span>Total Deductions</span>
                    <span>{formatCurrency(selectedPayslip.deductionsCents)}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-blue-600">Net Pay</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {formatCurrency(selectedPayslip.netPayCents)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {selectedPayslip.pdfUrl && (
                  <Button
                    onClick={() => handleDownloadPayslip(selectedPayslip)}
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setSelectedPayslip(null)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalaryHistory;
