import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Filter, Search, RefreshCw, Eye, Download } from 'lucide-react';
import { format } from 'date-fns';

interface LeaveRequest {
  id: number;
  staffId: number;
  staffName: string;
  leaveType: 'annual_leave' | 'sick_leave' | 'emergency_leave' | 'maternity_leave' | 'paternity_leave' | 'unpaid_leave';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNotes?: string;
  isEmergency: boolean;
}

interface LeaveHistoryProps {
  staffId?: number;
  showAll?: boolean;
}

const LeaveHistory: React.FC<LeaveHistoryProps> = ({ staffId, showAll = false }) => {
  const { getAuthenticatedBackend, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLeaveType, setFilterLeaveType] = useState('all');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
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
  const { data: leaveRequests, isLoading, error } = useQuery({
    queryKey: ['leaveRequests', staffId, searchTerm, filterStatus, filterLeaveType, filterYear, currentPage],
    queryFn: () => getAuthenticatedBackend().staff.leaveRequests({
      staffId: staffId,
      search: searchTerm,
      status: filterStatus === 'all' ? undefined : filterStatus,
      leaveType: filterLeaveType === 'all' ? undefined : filterLeaveType,
      year: parseInt(filterYear),
      page: currentPage,
      limit: itemsPerPage,
    }),
    refetchInterval: 30000, // 30 seconds
  });

  const getLeaveTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      annual_leave: 'Annual Leave',
      sick_leave: 'Sick Leave',
      emergency_leave: 'Emergency Leave',
      maternity_leave: 'Maternity Leave',
      paternity_leave: 'Paternity Leave',
      unpaid_leave: 'Unpaid Leave',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
    };
    const colors: Record<string, string> = {
      pending: 'text-yellow-600',
      approved: 'text-green-600',
      rejected: 'text-red-600',
    };
    return (
      <Badge variant={variants[status] || 'default'} className={colors[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getLeaveTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      annual_leave: 'bg-blue-100 text-blue-800 border-blue-200',
      sick_leave: 'bg-green-100 text-green-800 border-green-200',
      emergency_leave: 'bg-red-100 text-red-800 border-red-200',
      maternity_leave: 'bg-pink-100 text-pink-800 border-pink-200',
      paternity_leave: 'bg-purple-100 text-purple-800 border-purple-200',
      unpaid_leave: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
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
          <p className="text-lg">Loading leave history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <Calendar className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Leave History</h3>
        <p className="text-muted-foreground">
          There was a problem loading the leave history. Please try again.
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
            <Calendar className="h-6 w-6" />
            Leave History
          </h2>
          <p className="text-muted-foreground">
            View and track leave requests and approvals
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search requests..."
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Leave Type</label>
              <Select value={filterLeaveType} onValueChange={setFilterLeaveType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="annual_leave">Annual Leave</SelectItem>
                  <SelectItem value="sick_leave">Sick Leave</SelectItem>
                  <SelectItem value="emergency_leave">Emergency Leave</SelectItem>
                  <SelectItem value="maternity_leave">Maternity Leave</SelectItem>
                  <SelectItem value="paternity_leave">Paternity Leave</SelectItem>
                  <SelectItem value="unpaid_leave">Unpaid Leave</SelectItem>
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
                  setFilterLeaveType('all');
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

      {/* Leave Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
          <CardDescription>
            {leaveRequests?.pagination?.total || 0} requests found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leaveRequests?.leaveRequests?.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No leave requests found</h3>
              <p className="text-muted-foreground">
                No leave requests match your current filters
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {leaveRequests?.leaveRequests?.map((request: LeaveRequest) => (
                <Card key={request.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Mobile Layout */}
                    {isMobile ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{request.staffName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(request.startDate), 'MMM dd')} - {format(new Date(request.endDate), 'MMM dd, yyyy')}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(request.status)}
                            {request.isEmergency && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Emergency
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Badge className={getLeaveTypeColor(request.leaveType)}>
                            {getLeaveTypeLabel(request.leaveType)}
                          </Badge>
                          <span className="font-semibold text-lg">{request.totalDays} days</span>
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {request.reason}
                        </p>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                            className="flex-1"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                          {request.status === 'approved' && (
                            <Button
                              variant="outline"
                              size="sm"
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
                            <h3 className="font-semibold text-lg">{request.staffName}</h3>
                            {getStatusBadge(request.status)}
                            <Badge className={getLeaveTypeColor(request.leaveType)}>
                              {getLeaveTypeLabel(request.leaveType)}
                            </Badge>
                            {request.isEmergency && (
                              <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Emergency
                              </Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Start Date</p>
                              <p className="font-medium">
                                {format(new Date(request.startDate), 'MMM dd, yyyy')}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">End Date</p>
                              <p className="font-medium">
                                {format(new Date(request.endDate), 'MMM dd, yyyy')}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total Days</p>
                              <p className="font-semibold text-lg">
                                {request.totalDays} days
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Requested</p>
                              <p className="font-medium">
                                {format(new Date(request.requestedAt), 'MMM dd, yyyy')}
                              </p>
                            </div>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            <strong>Reason:</strong> {request.reason}
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                          {request.status === 'approved' && (
                            <Button
                              variant="outline"
                              size="sm"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download
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
          {leaveRequests?.pagination && leaveRequests.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, leaveRequests.pagination.total)} of {leaveRequests.pagination.total} requests
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
                  Page {currentPage} of {leaveRequests.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(leaveRequests.pagination.totalPages, prev + 1))}
                  disabled={currentPage === leaveRequests.pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leave Request Details Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Leave Request Details
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.staffName} - {getLeaveTypeLabel(selectedRequest?.leaveType || '')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-6">
              {/* Status and Type */}
              <div className="flex items-center gap-3">
                {getStatusBadge(selectedRequest.status)}
                <Badge className={getLeaveTypeColor(selectedRequest.leaveType)}>
                  {getLeaveTypeLabel(selectedRequest.leaveType)}
                </Badge>
                {selectedRequest.isEmergency && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Emergency Request
                  </Badge>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Start Date</h3>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedRequest.startDate), 'EEEE, MMMM dd, yyyy')}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">End Date</h3>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedRequest.endDate), 'EEEE, MMMM dd, yyyy')}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 text-blue-600">Total Days</h3>
                  <p className="text-2xl font-bold text-blue-600">
                    {selectedRequest.totalDays} days
                  </p>
                </div>
              </div>

              {/* Reason */}
              <div>
                <h3 className="font-semibold mb-2">Reason</h3>
                <p className="text-sm bg-gray-50 p-3 rounded-lg">
                  {selectedRequest.reason}
                </p>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="font-semibold mb-3">Timeline</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div>
                      <p className="font-medium">Request Submitted</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(selectedRequest.requestedAt), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  {selectedRequest.reviewedAt && (
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${selectedRequest.status === 'approved' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div>
                        <p className="font-medium">
                          {selectedRequest.status === 'approved' ? 'Request Approved' : 'Request Rejected'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(selectedRequest.reviewedAt), 'MMM dd, yyyy HH:mm')}
                          {selectedRequest.reviewedBy && ` by ${selectedRequest.reviewedBy}`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Notes */}
              {selectedRequest.adminNotes && (
                <div>
                  <h3 className="font-semibold mb-2">Admin Notes</h3>
                  <p className="text-sm bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    {selectedRequest.adminNotes}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {selectedRequest.status === 'approved' && (
                  <Button className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download Approval
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setSelectedRequest(null)}
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

export default LeaveHistory;
