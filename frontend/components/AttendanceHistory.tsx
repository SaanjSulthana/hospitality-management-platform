import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { 
  Calendar, 
  Clock,
  Users,
  Filter,
  Search,
  Download,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  MapPin,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
  TrendingUp,
  BarChart3,
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

interface AttendanceHistoryProps {
  staffId?: number;
  propertyId?: number;
  showFilters?: boolean;
  showExport?: boolean;
  showPagination?: boolean;
  limit?: number;
}

export default function AttendanceHistory({ 
  staffId, 
  propertyId, 
  showFilters = true, 
  showExport = true, 
  showPagination = true,
  limit = 20 
}: AttendanceHistoryProps) {
  const { getAuthenticatedBackend, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all',
    search: '',
    sortBy: 'attendanceDate',
    sortOrder: 'desc' as 'asc' | 'desc',
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
    queryKey: ['attendance-history', filters, currentPage, staffId, propertyId],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.listAttendance({
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        staffId: staffId || (filters.search ? undefined : undefined),
        search: filters.search || undefined,
        page: currentPage,
        limit: limit,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      });
    },
    refetchInterval: 5000,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch staff list for filters
  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.list({});
    },
    refetchInterval: 10000,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
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
      queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
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
        staffId: staffId,
        propertyId: propertyId,
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'absent': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'late': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'half-day': return <Timer className="h-4 w-4 text-blue-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
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

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleSort = (column: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  };

  const handleViewRecord = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setIsViewDialogOpen(true);
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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const renderMobileCard = (record: AttendanceRecord) => (
    <Card key={record.id} className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-medium text-lg">{record.staffName}</h4>
            <p className="text-sm text-gray-500">{formatDate(record.attendanceDate)}</p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(record.status)}
            <Badge className={getStatusColor(record.status)}>
              {record.status}
            </Badge>
          </div>
        </div>
        
        <div className="space-y-2 mb-4">
          {record.checkInTime && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-gray-500" />
              <span>
                {formatTime(record.checkInTime)}
                {record.checkOutTime && ` - ${formatTime(record.checkOutTime)}`}
              </span>
            </div>
          )}
          
          {record.totalHours && (
            <div className="flex items-center gap-2 text-sm">
              <Timer className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{record.totalHours.toFixed(1)} hours</span>
            </div>
          )}
          
          {record.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span>{record.location}</span>
            </div>
          )}
          
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
        
        {record.notes && (
          <p className="text-sm text-gray-600 mb-4 p-2 bg-gray-50 rounded">
            {record.notes}
          </p>
        )}
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleViewRecord(record)}
            className="flex-1 min-h-[44px]"
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
          {user?.role === 'ADMIN' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEditRecord(record)}
              className="flex-1 min-h-[44px]"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderDesktopTable = () => (
    <div className="overflow-x-auto">
      <div className="min-w-full">
        <div className="bg-gray-50 border-b">
          <div className="grid grid-cols-7 gap-4 px-4 py-3 text-sm font-medium text-gray-700">
            <div 
              className="cursor-pointer hover:bg-gray-100 min-h-[44px] flex items-center gap-2"
              onClick={() => handleSort('staffName')}
            >
              Staff Member
              {filters.sortBy === 'staffName' && (
                <span className="text-xs">
                  {filters.sortOrder === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </div>
            <div 
              className="cursor-pointer hover:bg-gray-100 min-h-[44px] flex items-center gap-2"
              onClick={() => handleSort('attendanceDate')}
            >
              Date
              {filters.sortBy === 'attendanceDate' && (
                <span className="text-xs">
                  {filters.sortOrder === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </div>
            <div className="min-h-[44px] flex items-center">Time</div>
            <div className="min-h-[44px] flex items-center">Hours</div>
            <div 
              className="cursor-pointer hover:bg-gray-100 min-h-[44px] flex items-center gap-2"
              onClick={() => handleSort('status')}
            >
              Status
              {filters.sortBy === 'status' && (
                <span className="text-xs">
                  {filters.sortOrder === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </div>
            <div className="min-h-[44px] flex items-center">Location</div>
            <div className="min-h-[44px] flex items-center">Actions</div>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {attendanceData?.attendance.map((record: AttendanceRecord, index: number) => (
            <div key={record.id} className={`grid grid-cols-7 gap-4 px-4 py-4 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}>
              <div className="font-medium">{record.staffName}</div>
              <div>{formatDate(record.attendanceDate)}</div>
              <div>
                {record.checkInTime ? (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-gray-500" />
                    <span className="text-sm">
                      {formatTime(record.checkInTime)}
                      {record.checkOutTime && ` - ${formatTime(record.checkOutTime)}`}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-500">No time recorded</span>
                )}
              </div>
              <div>
                {record.totalHours ? (
                  <div className="flex items-center gap-1">
                    <Timer className="h-3 w-3 text-gray-500" />
                    <span className="font-medium">{record.totalHours.toFixed(1)}h</span>
                  </div>
                ) : (
                  <span className="text-gray-500">-</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(record.status)}
                  <Badge className={getStatusColor(record.status)}>
                    {record.status}
                  </Badge>
                  {record.isLate && (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs">
                      Late
                    </Badge>
                  )}
                  {record.isOvertime && (
                    <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                      OT
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                {record.location ? (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-gray-500" />
                    <span className="text-sm">{record.location}</span>
                  </div>
                ) : (
                  <span className="text-gray-500">-</span>
                )}
              </div>
              <div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewRecord(record)}
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPagination = () => {
    if (!showPagination || !attendanceData?.pagination) return null;
    
    const { page, totalPages } = attendanceData.pagination;
    const pages = [];
    
    // Calculate page range
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-500">
          Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, attendanceData.pagination.total)} of {attendanceData.pagination.total} records
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="min-h-[44px]"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          {pages.map((pageNum) => (
            <Button
              key={pageNum}
              variant={pageNum === page ? "default" : "outline"}
              size="sm"
              onClick={() => handlePageChange(pageNum)}
              className="min-h-[44px] min-w-[44px]"
            >
              {pageNum}
            </Button>
          ))}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="min-h-[44px]"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
      )}

      {/* Attendance History */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Attendance History</CardTitle>
              <CardDescription>
                {attendanceData?.pagination.total || 0} records found
              </CardDescription>
            </div>
            {showExport && (
              <Button 
                variant="outline"
                onClick={() => setIsExportDialogOpen(true)}
                className="min-h-[44px]"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            )}
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
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No attendance records found</h3>
              <p className="text-gray-500">Try adjusting your filters or date range</p>
            </div>
          ) : (
            <>
              {isMobile ? (
                <div className="space-y-4">
                  {attendanceData?.attendance.map(renderMobileCard)}
                </div>
              ) : (
                renderDesktopTable()
              )}
              {renderPagination()}
            </>
          )}
        </CardContent>
      </Card>

      {/* View Record Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Attendance Record
            </DialogTitle>
            <DialogDescription>
              View attendance record details
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Staff Member</Label>
                  <p className="text-lg font-medium">{selectedRecord.staffName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Date</Label>
                  <p className="text-lg">{formatDate(selectedRecord.attendanceDate)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Check-in Time</Label>
                  <p className="text-lg">
                    {selectedRecord.checkInTime ? formatTime(selectedRecord.checkInTime) : 'Not recorded'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Check-out Time</Label>
                  <p className="text-lg">
                    {selectedRecord.checkOutTime ? formatTime(selectedRecord.checkOutTime) : 'Not recorded'}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Total Hours</Label>
                  <p className="text-lg">
                    {selectedRecord.totalHours ? `${selectedRecord.totalHours.toFixed(1)} hours` : 'Not calculated'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedRecord.status)}
                    <Badge className={getStatusColor(selectedRecord.status)}>
                      {selectedRecord.status}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {selectedRecord.location && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Location</Label>
                  <p className="text-lg">{selectedRecord.location}</p>
                </div>
              )}
              
              {selectedRecord.notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Notes</Label>
                  <p className="text-lg p-3 bg-gray-50 rounded">{selectedRecord.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
            {user?.role === 'ADMIN' && (
              <Button onClick={() => {
                setIsViewDialogOpen(false);
                handleEditRecord(selectedRecord!);
              }}>
                Edit Record
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Record Dialog */}
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
                onChange={(e: any) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
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
