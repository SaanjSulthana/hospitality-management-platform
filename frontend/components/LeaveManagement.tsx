import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Plus, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, Filter, Search, Users, BarChart3, FileText } from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';

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

interface LeaveBalance {
  staffId: number;
  staffName: string;
  annualLeaveDays: number;
  usedAnnualLeaveDays: number;
  remainingAnnualLeaveDays: number;
  sickLeaveDays: number;
  usedSickLeaveDays: number;
  remainingSickLeaveDays: number;
  emergencyLeaveDays: number;
  usedEmergencyLeaveDays: number;
  remainingEmergencyLeaveDays: number;
  lastUpdated: string;
}

interface LeaveStats {
  overview: {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    totalLeaveDays: number;
  };
  periodAnalysis: {
    currentMonth: {
      totalRequests: number;
      approvedRequests: number;
      rejectedRequests: number;
      pendingRequests: number;
    };
  };
  trends: {
    monthlyTrend: Array<{
      month: string;
      totalRequests: number;
      approvedRequests: number;
      rejectedRequests: number;
    }>;
  };
}

const LeaveManagement: React.FC = () => {
  const { getAuthenticatedBackend, user } = useAuth();
  const queryClient = useQueryClient();
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('requests');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLeaveType, setFilterLeaveType] = useState('all');
  const [isMobile, setIsMobile] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);

  // Form states
  const [leaveRequestForm, setLeaveRequestForm] = useState({
    leaveType: 'annual_leave' as const,
    startDate: '',
    endDate: '',
    reason: '',
    isEmergency: false,
  });

  const [approvalForm, setApprovalForm] = useState({
    adminNotes: '',
  });

  const [rejectionForm, setRejectionForm] = useState({
    adminNotes: '',
  });

  // Check mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // API Queries
  const { data: leaveRequests, isLoading: loadingRequests } = useQuery({
    queryKey: ['leaveRequests', searchTerm, filterStatus, filterLeaveType],
    queryFn: () => getAuthenticatedBackend().staff.leaveRequests({
      search: searchTerm,
      status: filterStatus === 'all' ? undefined : filterStatus,
      leaveType: filterLeaveType === 'all' ? undefined : filterLeaveType,
      page: 1,
      limit: 50,
    }),
    refetchInterval: false, // Disabled: Use WebSocket/Pub-Sub for real-time updates
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false, // Avoid focus storms
  });

  const { data: leaveBalance, isLoading: loadingBalance } = useQuery({
    queryKey: ['leaveBalance'],
    queryFn: () => getAuthenticatedBackend().staff.leaveBalance(),
    refetchInterval: false, // Disabled: Use WebSocket/Pub-Sub for real-time updates
    staleTime: 60000, // 1 minute
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  const { data: leaveStats, isLoading: loadingStats } = useQuery({
    queryKey: ['leaveStats'],
    queryFn: () => getAuthenticatedBackend().staff.leaveStatistics(),
    refetchInterval: false, // Disabled: Use WebSocket/Pub-Sub for real-time updates
    staleTime: 60000, // 1 minute
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  // API Mutations
  const createLeaveRequestMutation = useMutation({
    mutationFn: (data: any) => getAuthenticatedBackend().staff.createLeaveRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalance'] });
      setIsRequestDialogOpen(false);
      setLeaveRequestForm({
        leaveType: 'annual_leave',
        startDate: '',
        endDate: '',
        reason: '',
        isEmergency: false,
      });
    },
  });

  const approveLeaveRequestMutation = useMutation({
    mutationFn: (data: any) => getAuthenticatedBackend().staff.approveLeaveRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalance'] });
      setIsApproveDialogOpen(false);
      setApprovalForm({ adminNotes: '' });
    },
  });

  const rejectLeaveRequestMutation = useMutation({
    mutationFn: (data: any) => getAuthenticatedBackend().staff.rejectLeaveRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
      setIsRejectDialogOpen(false);
      setRejectionForm({ adminNotes: '' });
    },
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

  const calculateTotalDays = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;
    return differenceInDays(new Date(endDate), new Date(startDate)) + 1;
  };

  const handleCreateLeaveRequest = () => {
    const totalDays = calculateTotalDays(leaveRequestForm.startDate, leaveRequestForm.endDate);
    createLeaveRequestMutation.mutate({
      leaveType: leaveRequestForm.leaveType,
      startDate: leaveRequestForm.startDate,
      endDate: leaveRequestForm.endDate,
      totalDays,
      reason: leaveRequestForm.reason,
      isEmergency: leaveRequestForm.isEmergency,
    });
  };

  const handleApproveLeaveRequest = () => {
    if (!selectedRequest) return;
    approveLeaveRequestMutation.mutate({
      requestId: selectedRequest.id,
      adminNotes: approvalForm.adminNotes,
    });
  };

  const handleRejectLeaveRequest = () => {
    if (!selectedRequest) return;
    rejectLeaveRequestMutation.mutate({
      requestId: selectedRequest.id,
      adminNotes: rejectionForm.adminNotes,
    });
  };

  if (loadingRequests || loadingBalance || loadingStats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading leave data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            Leave Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage staff leave requests and balances
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Badge variant="outline" className="w-fit">
            <RefreshCw className="h-3 w-3 mr-1" />
            Live updates active
          </Badge>
        </div>
      </div>

      {/* Statistics Cards */}
      {leaveStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {leaveStats.overview.totalRequests}
              </div>
              <p className="text-xs text-muted-foreground">
                {leaveStats.overview.totalLeaveDays} total days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {leaveStats.overview.pendingRequests}
              </div>
              <p className="text-xs text-muted-foreground">
                awaiting review
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {leaveStats.overview.approvedRequests}
              </div>
              <p className="text-xs text-muted-foreground">
                this period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {leaveStats.overview.rejectedRequests}
              </div>
              <p className="text-xs text-muted-foreground">
                this period
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Requests</span>
          </TabsTrigger>
          <TabsTrigger value="balance" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Balance</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
        </TabsList>

        {/* Leave Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Leave Requests</CardTitle>
                  <CardDescription>
                    Manage staff leave requests and approvals
                  </CardDescription>
                </div>
                <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto">
                      <Plus className="h-4 w-4 mr-2" />
                      Request Leave
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Request Leave</DialogTitle>
                      <DialogDescription>
                        Submit a new leave request
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="leaveType">Leave Type</Label>
                        <Select
                          value={leaveRequestForm.leaveType}
                          onValueChange={(value: any) => setLeaveRequestForm({ ...leaveRequestForm, leaveType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="annual_leave">Annual Leave</SelectItem>
                            <SelectItem value="sick_leave">Sick Leave</SelectItem>
                            <SelectItem value="emergency_leave">Emergency Leave</SelectItem>
                            <SelectItem value="maternity_leave">Maternity Leave</SelectItem>
                            <SelectItem value="paternity_leave">Paternity Leave</SelectItem>
                            <SelectItem value="unpaid_leave">Unpaid Leave</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="startDate">Start Date</Label>
                          <Input
                            id="startDate"
                            type="date"
                            value={leaveRequestForm.startDate}
                            onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, startDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="endDate">End Date</Label>
                          <Input
                            id="endDate"
                            type="date"
                            value={leaveRequestForm.endDate}
                            onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, endDate: e.target.value })}
                          />
                        </div>
                      </div>
                      {leaveRequestForm.startDate && leaveRequestForm.endDate && (
                        <div className="bg-blue-50 p-3 rounded-md">
                          <p className="text-sm text-blue-800">
                            <strong>Total Days:</strong> {calculateTotalDays(leaveRequestForm.startDate, leaveRequestForm.endDate)} days
                          </p>
                        </div>
                      )}
                      <div>
                        <Label htmlFor="reason">Reason</Label>
                        <Textarea
                          id="reason"
                          value={leaveRequestForm.reason}
                          onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, reason: e.target.value })}
                          placeholder="Please provide a reason for your leave request"
                          rows={3}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="isEmergency"
                          checked={leaveRequestForm.isEmergency}
                          onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, isEmergency: e.target.checked })}
                          className="rounded"
                        />
                        <Label htmlFor="isEmergency" className="text-sm">
                          Emergency leave request
                        </Label>
                      </div>
                      <Button
                        onClick={handleCreateLeaveRequest}
                        disabled={createLeaveRequestMutation.isPending}
                        className="w-full"
                      >
                        {createLeaveRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <Input
                  placeholder="Search leave requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterLeaveType} onValueChange={setFilterLeaveType}>
                  <SelectTrigger className="w-full sm:w-48">
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

              {/* Leave Requests List */}
              {leaveRequests?.leaveRequests?.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No leave requests found</h3>
                  <p className="text-muted-foreground">
                    Start by creating your first leave request
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaveRequests?.leaveRequests?.map((request: LeaveRequest) => (
                    <Card key={request.id} className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{request.staffName}</h3>
                            {getStatusBadge(request.status)}
                            <Badge variant="outline">
                              {getLeaveTypeLabel(request.leaveType)}
                            </Badge>
                            {request.isEmergency && (
                              <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Emergency
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
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
                              <p className="font-medium">
                                {request.totalDays} days
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            <strong>Reason:</strong> {request.reason}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Requested: {format(new Date(request.requestedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                        {user?.role === 'ADMIN' && request.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setIsApproveDialogOpen(true);
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setIsRejectDialogOpen(true);
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Balance Tab */}
        <TabsContent value="balance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Leave Balance</CardTitle>
              <CardDescription>
                Current leave balance and usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaveBalance ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Annual Leave</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Days</span>
                        <span className="font-medium">{leaveBalance.annualLeaveDays}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Used</span>
                        <span className="font-medium text-red-600">{leaveBalance.usedAnnualLeaveDays}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Remaining</span>
                        <span className="font-medium text-green-600">{leaveBalance.remainingAnnualLeaveDays}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(leaveBalance.usedAnnualLeaveDays / leaveBalance.annualLeaveDays) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Sick Leave</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Days</span>
                        <span className="font-medium">{leaveBalance.sickLeaveDays}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Used</span>
                        <span className="font-medium text-red-600">{leaveBalance.usedSickLeaveDays}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Remaining</span>
                        <span className="font-medium text-green-600">{leaveBalance.remainingSickLeaveDays}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${(leaveBalance.usedSickLeaveDays / leaveBalance.sickLeaveDays) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Emergency Leave</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Days</span>
                        <span className="font-medium">{leaveBalance.emergencyLeaveDays}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Used</span>
                        <span className="font-medium text-red-600">{leaveBalance.usedEmergencyLeaveDays}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Remaining</span>
                        <span className="font-medium text-green-600">{leaveBalance.remainingEmergencyLeaveDays}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-orange-600 h-2 rounded-full"
                          style={{ width: `${(leaveBalance.usedEmergencyLeaveDays / leaveBalance.emergencyLeaveDays) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No leave balance data</h3>
                  <p className="text-muted-foreground">
                    Leave balance information is not available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Trends</CardTitle>
                <CardDescription>Leave request trends over time</CardDescription>
              </CardHeader>
              <CardContent>
                {leaveStats?.trends?.monthlyTrend?.map((trend: any) => (
                  <div key={trend.month} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <span className="font-medium">{trend.month}</span>
                    <div className="text-right">
                      <p className="font-semibold">{trend.totalRequests} requests</p>
                      <p className="text-sm text-muted-foreground">
                        {trend.approvedRequests} approved, {trend.rejectedRequests} rejected
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common leave management tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Export Leave Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Generate Analytics
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  Leave Policy
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Leave Request</DialogTitle>
            <DialogDescription>
              Approve leave request for {selectedRequest?.staffName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="approvalNotes">Admin Notes (Optional)</Label>
              <Textarea
                id="approvalNotes"
                value={approvalForm.adminNotes}
                onChange={(e) => setApprovalForm({ ...approvalForm, adminNotes: e.target.value })}
                placeholder="Add any notes for the approval"
                rows={3}
              />
            </div>
            <Button
              onClick={handleApproveLeaveRequest}
              disabled={approveLeaveRequestMutation.isPending}
              className="w-full"
            >
              {approveLeaveRequestMutation.isPending ? 'Approving...' : 'Approve Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>
              Reject leave request for {selectedRequest?.staffName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejectionNotes">Reason for Rejection</Label>
              <Textarea
                id="rejectionNotes"
                value={rejectionForm.adminNotes}
                onChange={(e) => setRejectionForm({ ...rejectionForm, adminNotes: e.target.value })}
                placeholder="Please provide a reason for rejection"
                rows={3}
                required
              />
            </div>
            <Button
              onClick={handleRejectLeaveRequest}
              disabled={rejectLeaveRequestMutation.isPending}
              className="w-full"
            >
              {rejectLeaveRequestMutation.isPending ? 'Rejecting...' : 'Reject Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Messages */}
      {createLeaveRequestMutation.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">
                Failed to create leave request
              </p>
            </div>
          </div>
        </div>
      )}

      {approveLeaveRequestMutation.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">
                Failed to approve leave request
              </p>
            </div>
          </div>
        </div>
      )}

      {rejectLeaveRequestMutation.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">
                Failed to reject leave request
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveManagement;
