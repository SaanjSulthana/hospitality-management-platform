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
import { Calendar, Plus, Clock, CheckCircle, AlertCircle, RefreshCw, Filter, Search, Users, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';

interface Schedule {
  id: number;
  staffId: number;
  staffName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  shiftType: 'day_shift' | 'night_shift' | 'split_shift' | 'overtime';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  isCompleted: boolean;
  actualStartTime?: string;
  actualEndTime?: string;
  notes?: string;
  hasConflict?: boolean;
  conflictReason?: string;
  createdAt: string;
}

interface ScheduleChangeRequest {
  id: number;
  scheduleId: number;
  staffId: number;
  staffName: string;
  requestType: 'time_change' | 'date_change' | 'shift_swap' | 'cancellation';
  currentStartTime: string;
  currentEndTime: string;
  requestedStartTime?: string;
  requestedEndTime?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNotes?: string;
}

interface ScheduleStats {
  overview: {
    totalSchedules: number;
    completedSchedules: number;
    pendingSchedules: number;
    totalChangeRequests: number;
    pendingChangeRequests: number;
  };
  periodAnalysis: {
    currentWeek: {
      totalSchedules: number;
      completedSchedules: number;
      completionRate: number;
    };
  };
  trends: {
    weeklyTrend: Array<{
      week: string;
      totalSchedules: number;
      completionRate: number;
    }>;
  };
}

const ScheduleManagement: React.FC = () => {
  const { getAuthenticatedBackend, user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [isChangeRequestDialogOpen, setIsChangeRequestDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('schedules');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterShiftType, setFilterShiftType] = useState('all');
  const [isMobile, setIsMobile] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  // Form states
  const [scheduleForm, setScheduleForm] = useState({
    staffId: '',
    shiftDate: '',
    startTime: '',
    endTime: '',
    shiftType: 'day_shift' as const,
    notes: '',
  });

  const [completionForm, setCompletionForm] = useState({
    actualStartTime: '',
    actualEndTime: '',
    notes: '',
  });

  const [changeRequestForm, setChangeRequestForm] = useState({
    requestType: 'time_change' as const,
    requestedStartTime: '',
    requestedEndTime: '',
    reason: '',
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
  const { data: schedules, isLoading: loadingSchedules } = useQuery({
    queryKey: ['schedules', searchTerm, filterStatus, filterShiftType],
    queryFn: () => getAuthenticatedBackend().staff.schedules({
      search: searchTerm,
      status: filterStatus === 'all' ? undefined : filterStatus,
      shiftType: filterShiftType === 'all' ? undefined : filterShiftType,
      page: 1,
      limit: 50,
    }),
    refetchInterval: false, // Disabled: Use WebSocket/Pub-Sub for real-time updates
    staleTime: 30000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  const { data: changeRequests, isLoading: loadingChangeRequests } = useQuery({
    queryKey: ['scheduleChangeRequests'],
    queryFn: () => getAuthenticatedBackend().staff.scheduleChangeRequests({
      page: 1,
      limit: 50,
    }),
    refetchInterval: false, // Disabled: Use WebSocket/Pub-Sub for real-time updates
    staleTime: 30000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  const { data: scheduleStats, isLoading: loadingStats } = useQuery({
    queryKey: ['scheduleStats'],
    queryFn: () => getAuthenticatedBackend().staff.scheduleStatistics(),
    refetchInterval: false, // Disabled: Use WebSocket/Pub-Sub for real-time updates
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  // API Mutations
  const createScheduleMutation = useMutation({
    mutationFn: (data: any) => getAuthenticatedBackend().staff.createSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setIsAddDialogOpen(false);
      setScheduleForm({
        staffId: '',
        shiftDate: '',
        startTime: '',
        endTime: '',
        shiftType: 'day_shift',
        notes: '',
      });
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: (data: any) => getAuthenticatedBackend().staff.markScheduleComplete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setIsCompleteDialogOpen(false);
      setCompletionForm({
        actualStartTime: '',
        actualEndTime: '',
        notes: '',
      });
    },
  });

  const createChangeRequestMutation = useMutation({
    mutationFn: (data: any) => getAuthenticatedBackend().staff.createScheduleChangeRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleChangeRequests'] });
      setIsChangeRequestDialogOpen(false);
      setChangeRequestForm({
        requestType: 'time_change',
        requestedStartTime: '',
        requestedEndTime: '',
        reason: '',
      });
    },
  });

  const approveChangeRequestMutation = useMutation({
    mutationFn: (data: any) => getAuthenticatedBackend().staff.approveScheduleChangeRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleChangeRequests'] });
      setIsApproveDialogOpen(false);
    },
  });

  const rejectChangeRequestMutation = useMutation({
    mutationFn: (data: any) => getAuthenticatedBackend().staff.rejectScheduleChangeRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleChangeRequests'] });
    },
  });

  const formatTime = (time: string) => {
    return format(new Date(`2000-01-01T${time}`), 'h:mm a');
  };

  const getShiftTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      day_shift: 'Day Shift',
      night_shift: 'Night Shift',
      split_shift: 'Split Shift',
      overtime: 'Overtime',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      scheduled: 'outline',
      in_progress: 'secondary',
      completed: 'default',
      cancelled: 'destructive',
    };
    const colors: Record<string, string> = {
      scheduled: 'text-blue-600',
      in_progress: 'text-yellow-600',
      completed: 'text-green-600',
      cancelled: 'text-red-600',
    };
    return (
      <Badge variant={variants[status] || 'default'} className={colors[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </Badge>
    );
  };

  const handleCreateSchedule = () => {
    createScheduleMutation.mutate({
      staffId: parseInt(scheduleForm.staffId),
      shiftDate: scheduleForm.shiftDate,
      startTime: scheduleForm.startTime,
      endTime: scheduleForm.endTime,
      shiftType: scheduleForm.shiftType,
      notes: scheduleForm.notes,
    });
  };

  const handleMarkComplete = () => {
    if (!selectedSchedule) return;
    markCompleteMutation.mutate({
      scheduleId: selectedSchedule.id,
      actualStartTime: completionForm.actualStartTime,
      actualEndTime: completionForm.actualEndTime,
      notes: completionForm.notes,
    });
  };

  const handleCreateChangeRequest = () => {
    if (!selectedSchedule) return;
    createChangeRequestMutation.mutate({
      scheduleId: selectedSchedule.id,
      requestType: changeRequestForm.requestType,
      requestedStartTime: changeRequestForm.requestedStartTime,
      requestedEndTime: changeRequestForm.requestedEndTime,
      reason: changeRequestForm.reason,
    });
  };

  const handleApproveChangeRequest = (requestId: number) => {
    approveChangeRequestMutation.mutate({
      requestId,
      adminNotes: 'Approved by admin',
    });
  };

  const handleRejectChangeRequest = (requestId: number) => {
    rejectChangeRequestMutation.mutate({
      requestId,
      adminNotes: 'Rejected by admin',
    });
  };

  if (loadingSchedules || loadingChangeRequests || loadingStats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading schedule data...</p>
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
            Schedule Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage staff schedules and shift assignments
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
      {scheduleStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Schedules</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {scheduleStats.overview.totalSchedules}
              </div>
              <p className="text-xs text-muted-foreground">
                {scheduleStats.overview.pendingSchedules} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {scheduleStats.overview.completedSchedules}
              </div>
              <p className="text-xs text-muted-foreground">
                {scheduleStats.periodAnalysis.currentWeek.completionRate}% this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Change Requests</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {scheduleStats.overview.totalChangeRequests}
              </div>
              <p className="text-xs text-muted-foreground">
                {scheduleStats.overview.pendingChangeRequests} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {scheduleStats.periodAnalysis.currentWeek.totalSchedules}
              </div>
              <p className="text-xs text-muted-foreground">
                schedules scheduled
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <TabsTrigger value="schedules" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Schedules</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Requests</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
        </TabsList>

        {/* Schedules Tab */}
        <TabsContent value="schedules" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Schedules</CardTitle>
                  <CardDescription>
                    Manage staff schedules and shift assignments
                  </CardDescription>
                </div>
                {user?.role === 'ADMIN' && (
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Schedule
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Schedule</DialogTitle>
                        <DialogDescription>
                          Create a new schedule for staff
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="staffId">Staff Member</Label>
                          <Input
                            id="staffId"
                            type="number"
                            value={scheduleForm.staffId}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, staffId: e.target.value })}
                            placeholder="Staff ID"
                          />
                        </div>
                        <div>
                          <Label htmlFor="shiftDate">Shift Date</Label>
                          <Input
                            id="shiftDate"
                            type="date"
                            value={scheduleForm.shiftDate}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, shiftDate: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="startTime">Start Time</Label>
                            <Input
                              id="startTime"
                              type="time"
                              value={scheduleForm.startTime}
                              onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="endTime">End Time</Label>
                            <Input
                              id="endTime"
                              type="time"
                              value={scheduleForm.endTime}
                              onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="shiftType">Shift Type</Label>
                          <Select
                            value={scheduleForm.shiftType}
                            onValueChange={(value: any) => setScheduleForm({ ...scheduleForm, shiftType: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="day_shift">Day Shift</SelectItem>
                              <SelectItem value="night_shift">Night Shift</SelectItem>
                              <SelectItem value="split_shift">Split Shift</SelectItem>
                              <SelectItem value="overtime">Overtime</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="notes">Notes</Label>
                          <Textarea
                            id="notes"
                            value={scheduleForm.notes}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                            placeholder="Optional notes"
                          />
                        </div>
                        <Button
                          onClick={handleCreateSchedule}
                          disabled={createScheduleMutation.isPending}
                          className="w-full"
                        >
                          {createScheduleMutation.isPending ? 'Creating...' : 'Create Schedule'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <Input
                  placeholder="Search schedules..."
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
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterShiftType} onValueChange={setFilterShiftType}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="day_shift">Day Shift</SelectItem>
                    <SelectItem value="night_shift">Night Shift</SelectItem>
                    <SelectItem value="split_shift">Split Shift</SelectItem>
                    <SelectItem value="overtime">Overtime</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Schedules List */}
              {schedules?.schedules?.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No schedules found</h3>
                  <p className="text-muted-foreground">
                    Start by creating your first schedule
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {schedules?.schedules?.map((schedule: Schedule) => (
                    <Card key={schedule.id} className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{schedule.staffName}</h3>
                            {getStatusBadge(schedule.status)}
                            <Badge variant="outline">
                              {getShiftTypeLabel(schedule.shiftType)}
                            </Badge>
                            {schedule.hasConflict && (
                              <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Conflict
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Date</p>
                              <p className="font-medium">
                                {format(new Date(schedule.shiftDate), 'MMM dd, yyyy')}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Time</p>
                              <p className="font-medium">
                                {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Duration</p>
                              <p className="font-medium">
                                {Math.round((new Date(`2000-01-01T${schedule.endTime}`).getTime() - new Date(`2000-01-01T${schedule.startTime}`).getTime()) / (1000 * 60 * 60))}h
                              </p>
                            </div>
                          </div>
                          {schedule.notes && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {schedule.notes}
                            </p>
                          )}
                          {schedule.hasConflict && schedule.conflictReason && (
                            <p className="text-sm text-red-600 mt-2">
                              ⚠️ {schedule.conflictReason}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {!schedule.isCompleted && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSchedule(schedule);
                                setIsCompleteDialogOpen(true);
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Mark Complete
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSchedule(schedule);
                              setIsChangeRequestDialogOpen(true);
                            }}
                          >
                            <AlertCircle className="h-4 w-4 mr-1" />
                            Request Change
                          </Button>
                          {user?.role === 'ADMIN' && (
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Change Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Change Requests</CardTitle>
              <CardDescription>
                Review and manage schedule change requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {changeRequests?.changeRequests?.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No change requests found</h3>
                  <p className="text-muted-foreground">
                    All requests have been processed
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {changeRequests?.changeRequests?.map((request: ScheduleChangeRequest) => (
                    <Card key={request.id} className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{request.staffName}</h3>
                            <Badge variant="outline">
                              {request.requestType.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <Badge variant={request.status === 'pending' ? 'secondary' : request.status === 'approved' ? 'default' : 'destructive'}>
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Current Time</p>
                              <p className="font-medium">
                                {formatTime(request.currentStartTime)} - {formatTime(request.currentEndTime)}
                              </p>
                            </div>
                            {request.requestedStartTime && (
                              <div>
                                <p className="text-muted-foreground">Requested Time</p>
                                <p className="font-medium">
                                  {formatTime(request.requestedStartTime)} - {formatTime(request.requestedEndTime || '')}
                                </p>
                              </div>
                            )}
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
                              onClick={() => handleApproveChangeRequest(request.id)}
                              disabled={approveChangeRequestMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRejectChangeRequest(request.id)}
                              disabled={rejectChangeRequestMutation.isPending}
                            >
                              <AlertCircle className="h-4 w-4 mr-1" />
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

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Trends</CardTitle>
                <CardDescription>Schedule completion trends</CardDescription>
              </CardHeader>
              <CardContent>
                {scheduleStats?.trends?.weeklyTrend?.map((trend: any) => (
                  <div key={trend.week} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <span className="font-medium">{trend.week}</span>
                    <div className="text-right">
                      <p className="font-semibold">{trend.totalSchedules} schedules</p>
                      <p className="text-sm text-muted-foreground">{trend.completionRate}% completion</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common schedule management tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  Generate Weekly Schedule
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Schedule Analytics
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  Staff Availability
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Mark Complete Dialog */}
      <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Schedule Complete</DialogTitle>
            <DialogDescription>
              Record actual start and end times for {selectedSchedule?.staffName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="actualStartTime">Actual Start Time</Label>
                <Input
                  id="actualStartTime"
                  type="time"
                  value={completionForm.actualStartTime}
                  onChange={(e) => setCompletionForm({ ...completionForm, actualStartTime: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="actualEndTime">Actual End Time</Label>
                <Input
                  id="actualEndTime"
                  type="time"
                  value={completionForm.actualEndTime}
                  onChange={(e) => setCompletionForm({ ...completionForm, actualEndTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="completionNotes">Notes</Label>
              <Textarea
                id="completionNotes"
                value={completionForm.notes}
                onChange={(e) => setCompletionForm({ ...completionForm, notes: e.target.value })}
                placeholder="Optional completion notes"
              />
            </div>
            <Button
              onClick={handleMarkComplete}
              disabled={markCompleteMutation.isPending}
              className="w-full"
            >
              {markCompleteMutation.isPending ? 'Marking Complete...' : 'Mark Complete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Request Dialog */}
      <Dialog open={isChangeRequestDialogOpen} onOpenChange={setIsChangeRequestDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Schedule Change</DialogTitle>
            <DialogDescription>
              Request a change to {selectedSchedule?.staffName}'s schedule
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="requestType">Request Type</Label>
              <Select
                value={changeRequestForm.requestType}
                onValueChange={(value: any) => setChangeRequestForm({ ...changeRequestForm, requestType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time_change">Time Change</SelectItem>
                  <SelectItem value="date_change">Date Change</SelectItem>
                  <SelectItem value="shift_swap">Shift Swap</SelectItem>
                  <SelectItem value="cancellation">Cancellation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {changeRequestForm.requestType === 'time_change' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="requestedStartTime">Requested Start Time</Label>
                  <Input
                    id="requestedStartTime"
                    type="time"
                    value={changeRequestForm.requestedStartTime}
                    onChange={(e) => setChangeRequestForm({ ...changeRequestForm, requestedStartTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="requestedEndTime">Requested End Time</Label>
                  <Input
                    id="requestedEndTime"
                    type="time"
                    value={changeRequestForm.requestedEndTime}
                    onChange={(e) => setChangeRequestForm({ ...changeRequestForm, requestedEndTime: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={changeRequestForm.reason}
                onChange={(e) => setChangeRequestForm({ ...changeRequestForm, reason: e.target.value })}
                placeholder="Please explain the reason for this change request"
              />
            </div>
            <Button
              onClick={handleCreateChangeRequest}
              disabled={createChangeRequestMutation.isPending}
              className="w-full"
            >
              {createChangeRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Messages */}
      {createScheduleMutation.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">
                Failed to create schedule
              </p>
            </div>
          </div>
        </div>
      )}

      {markCompleteMutation.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">
                Failed to mark schedule complete
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleManagement;
