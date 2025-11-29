import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { 
  Clock, 
  Calendar, 
  Users,
  TrendingUp,
  Download,
  Filter,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  FileText,
  BarChart3,
  Activity,
  Timer,
  MapPin,
  Smartphone,
  LogIn,
  LogOut
} from 'lucide-react';

interface AttendanceRecord {
  id: number;
  staffId: number;
  staffName: string;
  attendanceDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  totalHours?: number;
  status: 'present' | 'absent' | 'late' | 'half-day';
  isLate: boolean;
  isOvertime: boolean;
  notes?: string;
  location?: string;
  createdAt: string;
}

interface AttendanceStats {
  overview: {
    totalRecords: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    averageHours: number;
    totalHours: number;
  };
  periodAnalysis: {
    currentMonth: {
      totalDays: number;
      presentDays: number;
      absentDays: number;
      lateDays: number;
      averageHours: number;
    };
  };
  trends: {
    weeklyTrend: Array<{
      week: string;
      presentDays: number;
      totalHours: number;
    }>;
  };
}

export default function AttendanceManagement() {
  const { getAuthenticatedBackend, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isCheckOutDialogOpen, setIsCheckOutDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const [checkInForm, setCheckInForm] = useState({
    checkInTime: new Date().toISOString().slice(0, 16),
    notes: '',
    location: '',
  });
  
  const [checkOutForm, setCheckOutForm] = useState({
    checkOutTime: new Date().toISOString().slice(0, 16),
    notes: '',
  });
  
  const [editForm, setEditForm] = useState({
    checkInTime: '',
    checkOutTime: '',
    notes: '',
    status: 'present' as 'present' | 'absent' | 'late' | 'half-day',
  });
  
  const [exportForm, setExportForm] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    format: 'csv' as 'csv' | 'excel' | 'pdf',
    includeDetails: true,
  });
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all',
    staffId: 'all',
    search: '',
  });

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch attendance data
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['attendance', filters],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.listAttendance({
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        staffId: filters.staffId !== 'all' ? parseInt(filters.staffId) : undefined,
        search: filters.search || undefined,
        page: 1,
        limit: 50,
      });
    },
    refetchInterval: 3000,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  // Fetch attendance statistics
  const { data: attendanceStats, isLoading: statsLoading } = useQuery({
    queryKey: ['attendance-statistics'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.attendanceStatistics({});
    },
    refetchInterval: 10000,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  // Fetch staff list for filters
  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.list({});
    },
    refetchInterval: 5000,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      return backend.staff.checkIn(parseInt(data.staffId), {
        staffId: parseInt(data.staffId),
        notes: data.notes,
        location: data.location,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-statistics'] });
      setIsCheckInDialogOpen(false);
      setCheckInForm({
        checkInTime: new Date().toISOString().slice(0, 16),
        notes: '',
        location: '',
      });
      toast({
        title: "Check-in successful",
        description: "You have been checked in successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to check in",
        description: error.message || "Please try again.",
      });
    },
  });

  // Check-out mutation
  const checkOutMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      return backend.staff.checkOut(parseInt(data.staffId), {
        staffId: parseInt(data.staffId),
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-statistics'] });
      setIsCheckOutDialogOpen(false);
      setCheckOutForm({
        checkOutTime: new Date().toISOString().slice(0, 16),
        notes: '',
      });
      toast({
        title: "Check-out successful",
        description: "You have been checked out successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to check out",
        description: error.message || "Please try again.",
      });
    },
  });

  // Update attendance mutation
  const updateAttendanceMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      return backend.staff.updateAttendance({
        attendanceId: selectedRecord?.id,
        checkInTime: data.checkInTime ? new Date(data.checkInTime) : undefined,
        checkOutTime: data.checkOutTime ? new Date(data.checkOutTime) : undefined,
        notes: data.notes,
        status: data.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-statistics'] });
      setIsEditDialogOpen(false);
      setSelectedRecord(null);
      setEditForm({
        checkInTime: '',
        checkOutTime: '',
        notes: '',
        status: 'present',
      });
      toast({
        title: "Attendance updated",
        description: "The attendance record has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update attendance",
        description: error.message || "Please try again.",
      });
    },
  });

  // Export attendance mutation
  const exportAttendanceMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      return backend.staff.exportAttendance({
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        format: data.format,
        includeDetails: data.includeDetails,
      });
    },
    onSuccess: (result) => {
      setIsExportDialogOpen(false);
      setExportForm({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        format: 'csv',
        includeDetails: true,
      });
      toast({
        title: "Export successful",
        description: "Your attendance data has been exported successfully.",
      });
      // In a real app, you would trigger a download here
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to export data",
        description: error.message || "Please try again.",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800';
      case 'absent': return 'bg-red-100 text-red-800';
      case 'late': return 'bg-yellow-100 text-yellow-800';
      case 'half-day': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (time: string) => {
    return new Date(time).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleEditRecord = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setEditForm({
      checkInTime: record.checkInTime || '',
      checkOutTime: record.checkOutTime || '',
      notes: record.notes || '',
      status: record.status,
    });
    setIsEditDialogOpen(true);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['attendance-statistics'] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-gray-600">Track and manage staff attendance</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live updates active</span>
            {(attendanceLoading || statsLoading) && (
              <div className="flex items-center gap-1 text-blue-600">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs">Updating...</span>
              </div>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            className="min-h-[44px]"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Check in/out and manage your attendance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button 
              onClick={() => setIsCheckInDialogOpen(true)}
              className="h-16 text-lg font-semibold bg-green-600 hover:bg-green-700"
              disabled={checkInMutation.isPending}
            >
              <LogIn className="h-6 w-6 mr-3" />
              {checkInMutation.isPending ? 'Checking In...' : 'Check In'}
            </Button>
            <Button 
              onClick={() => setIsCheckOutDialogOpen(true)}
              variant="outline"
              className="h-16 text-lg font-semibold border-red-300 text-red-700 hover:bg-red-50"
              disabled={checkOutMutation.isPending}
            >
              <LogOut className="h-6 w-6 mr-3" />
              {checkOutMutation.isPending ? 'Checking Out...' : 'Check Out'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Overview */}
      {attendanceStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Total Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{attendanceStats.overview.totalRecords}</div>
              <p className="text-sm text-gray-500">This month</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Present
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{attendanceStats.overview.presentCount}</div>
              <p className="text-sm text-gray-500">
                {attendanceStats.overview.totalRecords > 0 
                  ? Math.round((attendanceStats.overview.presentCount / attendanceStats.overview.totalRecords) * 100)
                  : 0}% attendance rate
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Timer className="h-5 w-5 text-blue-600" />
                Average Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {attendanceStats.overview.averageHours.toFixed(1)}
              </div>
              <p className="text-sm text-gray-500">Per day</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                Total Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {attendanceStats.overview.totalHours.toFixed(1)}
              </div>
              <p className="text-sm text-gray-500">This month</p>
            </CardContent>
          </Card>
        </div>
      )}

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
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="half-day">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff">Staff Member</Label>
              <Select value={filters.staffId} onValueChange={(value) => handleFilterChange('staffId', value)}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="All staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {staffData?.staff.map((staff: any) => (
                    <SelectItem key={staff.id} value={staff.id.toString()}>
                      {staff.userName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search records..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10 min-h-[44px]"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance History */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Attendance History</CardTitle>
              <CardDescription>
                View and manage attendance records
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => setIsExportDialogOpen(true)}
                className="min-h-[44px]"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {attendanceLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : attendanceData?.attendance.length === 0 ? (
            <div className="text-center py-8">
              <LogIn className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No attendance records found</h3>
              <p className="text-gray-500 mb-4">Start by checking in for today</p>
              <Button onClick={() => setIsCheckInDialogOpen(true)}>
                <LogIn className="mr-2 h-4 w-4" />
                Check In Now
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {attendanceData?.attendance.map((record: AttendanceRecord) => (
                <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{record.staffName}</h4>
                      <Badge className={getStatusColor(record.status)}>
                        {record.status}
                      </Badge>
                      {record.isLate && (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                          Late
                        </Badge>
                      )}
                      {record.isOvertime && (
                        <Badge variant="outline" className="text-blue-600 border-blue-300">
                          Overtime
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDate(record.attendanceDate)}
                      </span>
                      {record.checkInTime && (
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatTime(record.checkInTime)}
                          {record.checkOutTime && ` - ${formatTime(record.checkOutTime)}`}
                        </span>
                      )}
                      {record.totalHours && (
                        <span className="font-medium">
                          {record.totalHours.toFixed(1)} hours
                        </span>
                      )}
                      {record.location && (
                        <span className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {record.location}
                        </span>
                      )}
                    </div>
                    {record.notes && (
                      <p className="text-sm text-gray-600 mt-1">{record.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditRecord(record)}
                      className="min-h-[44px]"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {user?.role === 'ADMIN' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditRecord(record)}
                        className="min-h-[44px]"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-In Dialog */}
      <Dialog open={isCheckInDialogOpen} onOpenChange={setIsCheckInDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              Check In
            </DialogTitle>
            <DialogDescription>
              Record your check-in time and location
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkInTime">Check-in Time</Label>
              <Input
                id="checkInTime"
                type="datetime-local"
                value={checkInForm.checkInTime}
                onChange={(e) => setCheckInForm(prev => ({ ...prev, checkInTime: e.target.value }))}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Input
                id="location"
                value={checkInForm.location}
                onChange={(e) => setCheckInForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Office, Remote, etc."
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkInNotes">Notes (Optional)</Label>
              <Textarea
                id="checkInNotes"
                value={checkInForm.notes}
                onChange={(e) => setCheckInForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCheckInDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => checkInMutation.mutate(checkInForm)}
              disabled={checkInMutation.isPending || !checkInForm.checkInTime}
              className="min-h-[44px]"
            >
              {checkInMutation.isPending ? 'Checking In...' : 'Check In Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check-Out Dialog */}
      <Dialog open={isCheckOutDialogOpen} onOpenChange={setIsCheckOutDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5" />
              Check Out
            </DialogTitle>
            <DialogDescription>
              Record your check-out time
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkOutTime">Check-out Time</Label>
              <Input
                id="checkOutTime"
                type="datetime-local"
                value={checkOutForm.checkOutTime}
                onChange={(e) => setCheckOutForm(prev => ({ ...prev, checkOutTime: e.target.value }))}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkOutNotes">Notes (Optional)</Label>
              <Textarea
                id="checkOutNotes"
                value={checkOutForm.notes}
                onChange={(e) => setCheckOutForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCheckOutDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => checkOutMutation.mutate(checkOutForm)}
              disabled={checkOutMutation.isPending || !checkOutForm.checkOutTime}
              className="min-h-[44px]"
            >
              {checkOutMutation.isPending ? 'Checking Out...' : 'Check Out Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Attendance Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Attendance Record
            </DialogTitle>
            <DialogDescription>
              Update attendance record details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editCheckInTime">Check-in Time</Label>
              <Input
                id="editCheckInTime"
                type="datetime-local"
                value={editForm.checkInTime}
                onChange={(e) => setEditForm(prev => ({ ...prev, checkInTime: e.target.value }))}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCheckOutTime">Check-out Time</Label>
              <Input
                id="editCheckOutTime"
                type="datetime-local"
                value={editForm.checkOutTime}
                onChange={(e) => setEditForm(prev => ({ ...prev, checkOutTime: e.target.value }))}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editStatus">Status</Label>
              <Select value={editForm.status} onValueChange={(value: 'present' | 'absent' | 'late' | 'half-day') => setEditForm(prev => ({ ...prev, status: value }))}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="half-day">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editNotes">Notes</Label>
              <Textarea
                id="editNotes"
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => updateAttendanceMutation.mutate(editForm)}
              disabled={updateAttendanceMutation.isPending}
              className="min-h-[44px]"
            >
              {updateAttendanceMutation.isPending ? 'Updating...' : 'Update Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Attendance Data
            </DialogTitle>
            <DialogDescription>
              Export attendance data in your preferred format
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exportStartDate">Start Date</Label>
                <Input
                  id="exportStartDate"
                  type="date"
                  value={exportForm.startDate}
                  onChange={(e) => setExportForm(prev => ({ ...prev, startDate: e.target.value }))}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exportEndDate">End Date</Label>
                <Input
                  id="exportEndDate"
                  type="date"
                  value={exportForm.endDate}
                  onChange={(e) => setExportForm(prev => ({ ...prev, endDate: e.target.value }))}
                  className="min-h-[44px]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exportFormat">Format</Label>
              <Select value={exportForm.format} onValueChange={(value: 'csv' | 'excel' | 'pdf') => setExportForm(prev => ({ ...prev, format: value }))}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => exportAttendanceMutation.mutate(exportForm)}
              disabled={exportAttendanceMutation.isPending || !exportForm.startDate || !exportForm.endDate}
              className="min-h-[44px]"
            >
              {exportAttendanceMutation.isPending ? 'Exporting...' : 'Export Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
