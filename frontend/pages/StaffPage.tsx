import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { getCurrentDateString } from '../lib/date-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { 
  UserCheck, 
  UserPlus,
  Plus, 
  Calendar, 
  Clock,
  Building2,
  Star,
  Users,
  CalendarDays,
  CheckCircle,
  XCircle,
  LogIn,
  DollarSign,
  BarChart3,
  Download,
  Filter,
  Search,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  FileText,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';

export default function StaffPage() {
  const { getAuthenticatedBackend, user } = useAuth();
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set page title and description
  useEffect(() => {
    setPageTitle('Staff Management', 'Manage staff members, schedules, and leave requests');
  }, [setPageTitle]);
  
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false);
  const [isSalaryDialogOpen, setIsSalaryDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('staff');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [staffForm, setStaffForm] = useState({
    userId: '',
    propertyId: 'none',
    department: '',
    hourlyRateCents: '',
    hireDate: '',
    notes: '',
  });
  const [scheduleForm, setScheduleForm] = useState({
    staffId: '',
    propertyId: '',
    shiftDate: '',
    startTime: '',
    endTime: '',
    breakMinutes: '30',
    notes: '',
  });
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'vacation' as 'vacation' | 'sick' | 'personal' | 'emergency',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [attendanceForm, setAttendanceForm] = useState({
    staffId: '',
    checkInTime: '',
    checkOutTime: '',
    notes: '',
  });
  const [salaryForm, setSalaryForm] = useState({
    staffId: '',
    baseSalaryCents: '',
    overtimeRateCents: '',
    bonusCents: '',
    effectiveDate: '',
  });
  const [reportForm, setReportForm] = useState({
    reportType: 'attendance' as 'attendance' | 'salary' | 'leave' | 'schedule',
    startDate: '',
    endDate: '',
    format: 'csv' as 'csv' | 'excel' | 'pdf',
    includeDetails: true,
  });

  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.list({});
    },
    refetchInterval: 3000, // Refresh every 3 seconds for real-time updates
    staleTime: 0, // Always consider data stale for fresh updates
    gcTime: 0, // Don't cache results
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch when component mounts
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.listSchedules({});
    },
    refetchInterval: 3000, // Refresh every 3 seconds for real-time updates
    staleTime: 0, // Always consider data stale for fresh updates
    gcTime: 0, // Don't cache results
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch when component mounts
  });

  const { data: leaveRequests, isLoading: leaveLoading } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.listLeaveRequests({});
    },
    refetchInterval: 3000, // Refresh every 3 seconds for real-time updates
    staleTime: 0, // Always consider data stale for fresh updates
    gcTime: 0, // Don't cache results
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch when component mounts
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.users.list({});
    },
    enabled: user?.role === 'ADMIN',
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
    staleTime: 0, // Always consider data stale for fresh updates
    gcTime: 0, // Don't cache results
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch when component mounts
  });

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.properties.list({});
    },
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
    staleTime: 0, // Always consider data stale for fresh updates
    gcTime: 0, // Don't cache results
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch when component mounts
  });

  // Enhanced API queries for new features
  const { data: attendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ['attendance'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.listAttendance({});
    },
    refetchInterval: 3000,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: salaryComponents, isLoading: salaryLoading } = useQuery({
    queryKey: ['salary-components'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.salaryComponents({});
    },
    refetchInterval: 5000,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: payslips, isLoading: payslipsLoading } = useQuery({
    queryKey: ['payslips'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.payslips({});
    },
    refetchInterval: 5000,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: staffStatistics, isLoading: statsLoading } = useQuery({
    queryKey: ['staff-statistics'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.statistics({});
    },
    refetchInterval: 10000,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const createStaffMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      return backend.staff.create({
        ...data,
        userId: parseInt(data.userId),
        propertyId: data.propertyId === 'none' ? undefined : parseInt(data.propertyId),
        hourlyRateCents: data.hourlyRateCents ? parseInt(data.hourlyRateCents) : 0,
        hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setIsStaffDialogOpen(false);
      setStaffForm({
        userId: '',
        propertyId: 'none',
        department: '',
        hourlyRateCents: '',
        hireDate: '',
        notes: '',
      });
      toast({
        title: "Staff member added",
        description: "The staff member has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to add staff member",
        description: error.message || "Please try again.",
      });
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      return backend.staff.createSchedule({
        ...data,
        staffId: parseInt(data.staffId),
        propertyId: parseInt(data.propertyId),
        shiftDate: new Date(data.shiftDate),
        breakMinutes: parseInt(data.breakMinutes),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setIsScheduleDialogOpen(false);
      setScheduleForm({
        staffId: '',
        propertyId: '',
        shiftDate: '',
        startTime: '',
        endTime: '',
        breakMinutes: '30',
        notes: '',
      });
      toast({
        title: "Schedule created",
        description: "The staff schedule has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to create schedule",
        description: error.message || "Please try again.",
      });
    },
  });

  const requestLeaveMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      return backend.staff.requestLeave({
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      setIsLeaveDialogOpen(false);
      setLeaveForm({
        leaveType: 'vacation',
        startDate: '',
        endDate: '',
        reason: '',
      });
      toast({
        title: "Leave request submitted",
        description: "Your leave request has been submitted for approval.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to submit leave request",
        description: error.message || "Please try again.",
      });
    },
  });

  const approveLeaveMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: number; approved: boolean }) => {
      console.log('=== APPROVE LEAVE MUTATION ===');
      console.log('Leave ID:', id, 'Approved:', approved);
      
      const backend = getAuthenticatedBackend();
      const result = await backend.staff.approveLeave({ id, approved });
      
      console.log('Approve leave result:', result);
      return result;
    },
    onSuccess: () => {
      console.log('Leave approval successful');
      
      // Aggressive cache invalidation for real-time updates
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      
      // Force immediate refetch for all users
      queryClient.refetchQueries({ queryKey: ['leave-requests'] });
      queryClient.refetchQueries({ queryKey: ['pending-approvals'] });
      queryClient.refetchQueries({ queryKey: ['dashboard'] });
      
      toast({
        title: "Leave request updated",
        description: "The leave request has been processed.",
      });
    },
    onError: (error: any) => {
      console.error('Approve leave error:', error);
      toast({
        variant: "destructive",
        title: "Failed to process leave request",
        description: error.message || "Please try again.",
      });
    },
  });

  // Enhanced mutations for new features
  const checkInMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      return backend.staff.checkIn(parseInt(data.staffId), {
        staffId: parseInt(data.staffId),
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setIsAttendanceDialogOpen(false);
      setAttendanceForm({
        staffId: '',
        checkInTime: '',
        checkOutTime: '',
        notes: '',
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
      setIsAttendanceDialogOpen(false);
      setAttendanceForm({
        staffId: '',
        checkInTime: '',
        checkOutTime: '',
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

  const createSalaryComponentMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      return backend.staff.salaryComponents({
        staffId: parseInt(data.staffId),
        componentType: 'base_salary',
        amountCents: parseInt(data.baseSalaryCents),
        effectiveDate: new Date(data.effectiveDate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-components'] });
      setIsSalaryDialogOpen(false);
      setSalaryForm({
        staffId: '',
        baseSalaryCents: '',
        overtimeRateCents: '',
        bonusCents: '',
        effectiveDate: '',
      });
      toast({
        title: "Salary component created",
        description: "The salary component has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to create salary component",
        description: error.message || "Please try again.",
      });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      return backend.staff.exportAttendance({
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        format: data.format,
      });
    },
    onSuccess: (result) => {
      setIsReportDialogOpen(false);
      setReportForm({
        reportType: 'attendance',
        startDate: '',
        endDate: '',
        format: 'csv',
        includeDetails: true,
      });
      toast({
        title: "Report generated",
        description: "Your report has been generated successfully.",
      });
      // In a real app, you would trigger a download here
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to generate report",
        description: error.message || "Please try again.",
      });
    },
  });

  const getDepartmentColor = (department: string) => {
    switch (department) {
      case 'frontdesk': return 'bg-blue-100 text-blue-800';
      case 'housekeeping': return 'bg-green-100 text-green-800';
      case 'maintenance': return 'bg-orange-100 text-orange-800';
      case 'fnb': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLeaveTypeColor = (type: string) => {
    switch (type) {
      case 'vacation': return 'bg-blue-100 text-blue-800';
      case 'sick': return 'bg-red-100 text-red-800';
      case 'personal': return 'bg-purple-100 text-purple-800';
      case 'emergency': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amountCents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amountCents / 100);
  };

  return (
    <div className="min-h-screen bg-gray-50">
    <div className="space-y-6">
        {/* Enhanced Live Status Indicator */}
        <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                  <UserCheck className="h-5 w-5 text-green-600" />
                </div>
        <div>
                  <h3 className="text-lg font-bold text-gray-900">Staff Management</h3>
                  <p className="text-sm text-gray-600">Manage staff members, schedules, and leave requests</p>
        </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Live</span>
            {(staffLoading || schedulesLoading || leaveLoading) && (
              <div className="flex items-center gap-1 text-blue-600">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs">Updating...</span>
                </div>
            )}
              </div>
        </div>
          </CardContent>
        </Card>

        {/* Enhanced Staff Management Tabs */}
        <Tabs defaultValue="staff" className="space-y-0" value={activeTab} onValueChange={setActiveTab}>
          <div className="sticky top-20 z-30 bg-white border-b border-gray-200 -mx-6 px-4 sm:px-6 py-3 shadow-sm">
            <div className="overflow-x-auto">
              <TabsList className="grid w-full grid-cols-5 min-w-max bg-gray-100">
                <TabsTrigger 
                  value="staff" 
                  className="text-xs sm:text-sm px-2 sm:px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"
                >
            <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Staff</span>
          </TabsTrigger>
                <TabsTrigger 
                  value="schedules" 
                  className="text-xs sm:text-sm px-2 sm:px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"
                >
            <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Schedules</span>
          </TabsTrigger>
                <TabsTrigger 
                  value="attendance" 
                  className="text-xs sm:text-sm px-2 sm:px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"
                >
            <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Attendance</span>
          </TabsTrigger>
                <TabsTrigger 
                  value="salary" 
                  className="text-xs sm:text-sm px-2 sm:px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"
                >
            <DollarSign className="h-4 w-4" />
                  <span className="hidden sm:inline">Salary</span>
          </TabsTrigger>
                <TabsTrigger 
                  value="reports" 
                  className="text-xs sm:text-sm px-2 sm:px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"
                >
            <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Reports</span>
          </TabsTrigger>
        </TabsList>
            </div>
          </div>

          {/* Content Container */}
          <div className="px-6 py-6">
            <TabsContent value="staff" className="space-y-6 mt-0">
              <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-gray-900">Staff Members</CardTitle>
                        <CardDescription className="text-sm text-gray-600">Manage your team members and their information</CardDescription>
                      </div>
                    </div>
                    {user?.role === 'ADMIN' && (
                      <Button 
                        onClick={() => setIsStaffDialogOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Add Staff Member</span>
                        <span className="sm:hidden">Add</span>
                      </Button>
                    )}
                  </div>
            </CardHeader>
            <CardContent>
              {staffLoading ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex items-center justify-center p-12">
                        <div className="text-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="h-5 w-5 text-blue-600 animate-pulse" />
                    </div>
                          <p className="text-lg font-medium text-gray-900">Loading staff members...</p>
                          <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your team data</p>
                </div>
                      </CardContent>
                    </Card>
              ) : staff?.staff.length === 0 ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <UserCheck className="h-8 w-8 text-blue-600" />
                        </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No staff members</h3>
                        <p className="text-gray-500 text-center mb-4">Start by adding your first staff member</p>
                  {user?.role === 'ADMIN' && (
                          <Button 
                            onClick={() => setIsStaffDialogOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                      <Plus className="mr-2 h-4 w-4" />
                      Add First Staff Member
                    </Button>
                  )}
                      </CardContent>
                    </Card>
              ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {staff?.staff.map((member: any) => (
                        <Card key={member.id} className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all duration-200">
                          <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                  <UserCheck className="h-6 w-6 text-blue-600" />
                          </div>
                                <div className="flex-1">
                                  <CardTitle className="text-lg font-bold text-gray-900">{member.userName}</CardTitle>
                                  <CardDescription className="text-sm text-gray-600">{member.userEmail}</CardDescription>
                                </div>
                              </div>
                              <Badge className={`${getDepartmentColor(member.department)} flex-shrink-0`}>
                            {member.department}
                          </Badge>
                        </div>
                      </CardHeader>
                          <CardContent className="space-y-3">
                          {member.propertyName && (
                            <div className="flex items-center text-sm">
                                <Building2 className="h-4 w-4 mr-2 text-gray-500 flex-shrink-0" />
                                <span className="truncate">{member.propertyName}</span>
                            </div>
                          )}
                          {member.hourlyRateCents > 0 && (
                            <div className="flex items-center text-sm">
                                <DollarSign className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                              <span className="font-medium">Rate: {formatCurrency(member.hourlyRateCents)}/hr</span>
                            </div>
                          )}
                          {member.performanceRating > 0 && (
                            <div className="flex items-center text-sm">
                                <Star className="h-4 w-4 mr-2 text-yellow-500 flex-shrink-0" />
                              <span>{member.performanceRating.toFixed(1)}/5.0</span>
                            </div>
                          )}
                          {member.hireDate && (
                            <div className="flex items-center text-sm text-gray-500">
                                <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                              <span>Hired {new Date(member.hireDate).toLocaleDateString()}</span>
                            </div>
                          )}
                            <div className="flex items-center justify-between pt-2">
                              <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="border-green-500 text-green-700">
                            {member.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

            <TabsContent value="schedules" className="space-y-6 mt-0">
              <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                        <Calendar className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-gray-900">Staff Schedules</CardTitle>
                        <CardDescription className="text-sm text-gray-600">View and manage staff work schedules</CardDescription>
                      </div>
                    </div>
                    {user?.role === 'ADMIN' && (
                      <Button 
                        onClick={() => setIsScheduleDialogOpen(true)}
                        className="bg-green-600 hover:bg-green-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Create Schedule</span>
                        <span className="sm:hidden">Create</span>
                      </Button>
                    )}
                  </div>
            </CardHeader>
            <CardContent>
              {schedulesLoading ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex items-center justify-center p-12">
                        <div className="text-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Calendar className="h-5 w-5 text-blue-600 animate-pulse" />
                    </div>
                          <p className="text-lg font-medium text-gray-900">Loading schedules...</p>
                          <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your schedule data</p>
                </div>
                      </CardContent>
                    </Card>
              ) : schedules?.schedules.length === 0 ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Calendar className="h-8 w-8 text-blue-600" />
                        </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules</h3>
                        <p className="text-gray-500 text-center mb-4">Start by creating staff schedules</p>
                  {user?.role === 'ADMIN' && (
                          <Button 
                            onClick={() => setIsScheduleDialogOpen(true)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                      <Plus className="mr-2 h-4 w-4" />
                      Create First Schedule
                    </Button>
                  )}
                      </CardContent>
                    </Card>
              ) : (
                <div className="space-y-4">
                  {schedules?.schedules.map((schedule: any) => (
                        <Card key={schedule.id} className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-all duration-200">
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <h4 className="font-medium truncate">{schedule.staffName}</h4>
                                  <Badge className={`${getStatusColor(schedule.status)} flex-shrink-0`}>
                            {schedule.status}
                          </Badge>
                        </div>
                                <p className="text-sm text-gray-600 mb-1 truncate">{schedule.propertyName}</p>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500">
                          <span className="flex items-center">
                                    <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                            {new Date(schedule.shiftDate).toLocaleDateString()}
                          </span>
                          <span className="flex items-center">
                                    <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                            {schedule.startTime} - {schedule.endTime}
                          </span>
                          {schedule.breakMinutes > 0 && (
                            <span>Break: {schedule.breakMinutes}min</span>
                          )}
                        </div>
                        {schedule.notes && (
                                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{schedule.notes}</p>
                        )}
                      </div>
                    </div>
                          </CardContent>
                        </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

            <TabsContent value="leave" className="space-y-6 mt-0">
              <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded-lg shadow-sm">
                        <CalendarDays className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-gray-900">Leave Requests</CardTitle>
                        <CardDescription className="text-sm text-gray-600">Manage staff leave requests and approvals</CardDescription>
                      </div>
                    </div>
                    <Button 
                      onClick={() => setIsLeaveDialogOpen(true)}
                      className="bg-orange-600 hover:bg-orange-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">Request Leave</span>
                      <span className="sm:hidden">Request</span>
                    </Button>
                  </div>
            </CardHeader>
            <CardContent>
              {leaveLoading ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex items-center justify-center p-12">
                        <div className="text-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CalendarDays className="h-5 w-5 text-blue-600 animate-pulse" />
                    </div>
                          <p className="text-lg font-medium text-gray-900">Loading leave requests...</p>
                          <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your leave data</p>
                </div>
                      </CardContent>
                    </Card>
              ) : leaveRequests?.leaveRequests.length === 0 ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CalendarDays className="h-8 w-8 text-blue-600" />
                        </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No leave requests</h3>
                        <p className="text-gray-500 text-center mb-4">No leave requests have been submitted yet</p>
                        <Button 
                          onClick={() => setIsLeaveDialogOpen(true)}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                    <Plus className="mr-2 h-4 w-4" />
                    Request Leave
                  </Button>
                      </CardContent>
                    </Card>
              ) : (
                <div className="space-y-4">
                  {leaveRequests?.leaveRequests.map((request: any) => (
                        <Card key={request.id} className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-all duration-200">
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <h4 className="font-medium truncate">{request.staffName}</h4>
                                  <Badge className={`${getLeaveTypeColor(request.leaveType)} flex-shrink-0`}>
                            {request.leaveType}
                          </Badge>
                                  <Badge className={`${getStatusColor(request.status)} flex-shrink-0`}>
                            {request.status}
                          </Badge>
                        </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500 mb-1">
                          <span className="flex items-center">
                                    <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                            {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                          </span>
                        </div>
                        {request.reason && (
                                  <p className="text-sm text-gray-600 mb-1 line-clamp-2">{request.reason}</p>
                        )}
                        {request.approvedByName && (
                          <p className="text-xs text-gray-500">
                            {request.status} by {request.approvedByName} on {new Date(request.approvedAt!).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {user?.role === 'ADMIN' && request.status === 'pending' && (
                                <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            onClick={() => approveLeaveMutation.mutate({ id: request.id, approved: true })}
                            disabled={approveLeaveMutation.isPending}
                                    className="bg-green-600 hover:bg-green-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">Approve</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveLeaveMutation.mutate({ id: request.id, approved: false })}
                            disabled={approveLeaveMutation.isPending}
                                    className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">Reject</span>
                          </Button>
                        </div>
                      )}
                    </div>
                          </CardContent>
                        </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

            <TabsContent value="attendance" className="space-y-6 mt-0">
              <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg shadow-sm">
                        <LogIn className="h-5 w-5 text-purple-600" />
                      </div>
                <div>
                        <CardTitle className="text-lg font-bold text-gray-900">Attendance Tracking</CardTitle>
                        <CardDescription className="text-sm text-gray-600">Track staff attendance and working hours</CardDescription>
                      </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    onClick={() => setIsAttendanceDialogOpen(true)}
                        className="bg-purple-600 hover:bg-purple-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Check In/Out</span>
                        <span className="sm:hidden">Check In</span>
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => generateReportMutation.mutate({
                      reportType: 'attendance',
                      startDate: new Date().toISOString().split('T')[0],
                      endDate: new Date().toISOString().split('T')[0],
                      format: 'csv'
                    })}
                        className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    <Download className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Export</span>
                        <span className="sm:hidden">Export</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {attendanceLoading ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex items-center justify-center p-12">
                        <div className="text-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <LogIn className="h-5 w-5 text-blue-600 animate-pulse" />
                    </div>
                          <p className="text-lg font-medium text-gray-900">Loading attendance...</p>
                          <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your attendance data</p>
                </div>
                      </CardContent>
                    </Card>
              ) : attendance?.attendance.length === 0 ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <LogIn className="h-8 w-8 text-blue-600" />
                        </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No attendance records</h3>
                        <p className="text-gray-500 text-center mb-4">No attendance records found for the selected period</p>
                        <Button 
                          onClick={() => setIsAttendanceDialogOpen(true)}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                    <LogIn className="mr-2 h-4 w-4" />
                    Check In
                  </Button>
                      </CardContent>
                    </Card>
              ) : (
                <div className="space-y-4">
                  {attendance?.attendance.map((record: any) => (
                        <Card key={record.id} className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-all duration-200">
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <h4 className="font-medium truncate">{record.staffName}</h4>
                                  <Badge className={`${getStatusColor(record.status)} flex-shrink-0`}>
                            {record.status}
                          </Badge>
                        </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500">
                          <span className="flex items-center">
                                    <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                            {new Date(record.attendanceDate).toLocaleDateString()}
                          </span>
                          <span className="flex items-center">
                                    <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                            {record.checkInTime} - {record.checkOutTime || 'Not checked out'}
                          </span>
                          {record.totalHours > 0 && (
                            <span>Hours: {record.totalHours.toFixed(1)}</span>
                          )}
                        </div>
                        {record.notes && (
                                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{record.notes}</p>
                        )}
                      </div>
                    </div>
                          </CardContent>
                        </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

            <TabsContent value="salary" className="space-y-6 mt-0">
              <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                <div>
                        <CardTitle className="text-lg font-bold text-gray-900">Salary Management</CardTitle>
                        <CardDescription className="text-sm text-gray-600">Manage staff salary components and payslips</CardDescription>
                      </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {user?.role === 'ADMIN' && (
                    <Button 
                      onClick={() => setIsSalaryDialogOpen(true)}
                          className="bg-green-600 hover:bg-green-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                    >
                      <DollarSign className="mr-2 h-4 w-4" />
                          <span className="hidden sm:inline">Add Salary Component</span>
                          <span className="sm:hidden">Add Component</span>
                    </Button>
                  )}
                  <Button 
                    variant="outline"
                    onClick={() => generateReportMutation.mutate({
                      reportType: 'salary',
                      startDate: new Date().toISOString().split('T')[0],
                      endDate: new Date().toISOString().split('T')[0],
                      format: 'csv'
                    })}
                        className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    <Download className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Export</span>
                        <span className="sm:hidden">Export</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {salaryLoading ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex items-center justify-center p-12">
                        <div className="text-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <DollarSign className="h-5 w-5 text-blue-600 animate-pulse" />
                    </div>
                          <p className="text-lg font-medium text-gray-900">Loading salary data...</p>
                          <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your salary information</p>
                </div>
                      </CardContent>
                    </Card>
              ) : salaryComponents?.salaryComponents.length === 0 ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <DollarSign className="h-8 w-8 text-blue-600" />
                        </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No salary components</h3>
                        <p className="text-gray-500 text-center mb-4">No salary components have been configured yet</p>
                  {user?.role === 'ADMIN' && (
                          <Button 
                            onClick={() => setIsSalaryDialogOpen(true)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                      <DollarSign className="mr-2 h-4 w-4" />
                      Add First Salary Component
                    </Button>
                  )}
                      </CardContent>
                    </Card>
              ) : (
                <div className="space-y-4">
                  {salaryComponents?.salaryComponents.map((component: any) => (
                        <Card key={component.id} className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-all duration-200">
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <h4 className="font-medium truncate">{component.staffName}</h4>
                                  <Badge className="bg-green-100 text-green-800 flex-shrink-0">
                            {component.componentType}
                          </Badge>
                        </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500">
                          <span className="font-medium">
                            Amount: {formatCurrency(component.amountCents)}
                          </span>
                          <span className="flex items-center">
                                    <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                            Effective: {new Date(component.effectiveDate).toLocaleDateString()}
                          </span>
                        </div>
                        {component.notes && (
                                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{component.notes}</p>
                        )}
                      </div>
                    </div>
                          </CardContent>
                        </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

            <TabsContent value="reports" className="space-y-6 mt-0">
              <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg shadow-sm">
                        <BarChart3 className="h-5 w-5 text-purple-600" />
                      </div>
                <div>
                        <CardTitle className="text-lg font-bold text-gray-900">Reports & Analytics</CardTitle>
                        <CardDescription className="text-sm text-gray-600">Generate reports and view staff analytics</CardDescription>
                      </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    onClick={() => setIsReportDialogOpen(true)}
                        className="bg-purple-600 hover:bg-purple-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Generate Report</span>
                        <span className="sm:hidden">Generate</span>
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => queryClient.refetchQueries({ queryKey: ['staff-statistics'] })}
                        className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Refresh</span>
                        <span className="sm:hidden">Refresh</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex items-center justify-center p-12">
                        <div className="text-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BarChart3 className="h-5 w-5 text-blue-600 animate-pulse" />
                    </div>
                          <p className="text-lg font-medium text-gray-900">Loading analytics...</p>
                          <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your staff statistics</p>
                </div>
                      </CardContent>
                    </Card>
              ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {staffStatistics && (
                    <>
                          <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                            <CardHeader className="pb-4">
                              <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                                  <Users className="h-4 w-4 text-blue-600" />
                                </div>
                            Total Staff
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                              <div className="text-2xl font-bold text-blue-600">{staffStatistics.overview.totalStaff}</div>
                              <p className="text-xs text-gray-600 mt-1">
                            {staffStatistics.overview.activeStaff} active
                          </p>
                        </CardContent>
                      </Card>
                      
                          <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                            <CardHeader className="pb-4">
                              <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                                  <TrendingUp className="h-4 w-4 text-green-600" />
                                </div>
                            Performance
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                              <div className="text-2xl font-bold text-green-600">
                            {staffStatistics.overview.averagePerformance.toFixed(1)}
                          </div>
                              <p className="text-xs text-gray-600 mt-1">Average rating</p>
                        </CardContent>
                      </Card>
                      
                          <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                            <CardHeader className="pb-4">
                              <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <div className="p-2 bg-orange-100 rounded-lg shadow-sm">
                                  <DollarSign className="h-4 w-4 text-orange-600" />
                                </div>
                            Total Payroll
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                              <div className="text-2xl font-bold text-orange-600">
                            {formatCurrency(staffStatistics.overview.totalPayrollCents)}
                          </div>
                              <p className="text-xs text-gray-600 mt-1">This month</p>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
          </div>
      </Tabs>
      </div>

      {/* Create Staff Dialog */}
      <Dialog open={isStaffDialogOpen} onOpenChange={setIsStaffDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                <UserPlus className="h-5 w-5 text-blue-600" />
              </div>
              Add Staff Member
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Add a new staff member to your team
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="userId" className="text-sm font-medium text-gray-700">User</Label>
              <Select value={staffForm.userId} onValueChange={(value) => setStaffForm(prev => ({ ...prev, userId: value }))}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users?.users.filter((u: any) => u.role === 'MANAGER').map((u: any) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.displayName} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="propertyId" className="text-sm font-medium text-gray-700">Property</Label>
              <Select value={staffForm.propertyId} onValueChange={(value) => setStaffForm(prev => ({ ...prev, propertyId: value }))}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No property assigned</SelectItem>
                  {properties?.properties.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="department" className="text-sm font-medium text-gray-700">Department</Label>
              <Select value={staffForm.department} onValueChange={(value) => setStaffForm(prev => ({ ...prev, department: value }))}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="frontdesk">Front Desk</SelectItem>
                  <SelectItem value="housekeeping">Housekeeping</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="fnb">Food & Beverage</SelectItem>
                  <SelectItem value="admin">Administration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="hourlyRateCents" className="text-sm font-medium text-gray-700">Hourly Rate (cents)</Label>
              <Input
                id="hourlyRateCents"
                type="number"
                value={staffForm.hourlyRateCents}
                onChange={(e) => setStaffForm(prev => ({ ...prev, hourlyRateCents: e.target.value }))}
                placeholder="1500 for $15.00"
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
                <Label htmlFor="hireDate" className="text-sm font-medium text-gray-700">Hire Date</Label>
              <Input
                id="hireDate"
                type="date"
                value={staffForm.hireDate}
                onChange={(e) => setStaffForm(prev => ({ ...prev, hireDate: e.target.value }))}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium text-gray-700">Notes</Label>
              <Textarea
                id="notes"
                value={staffForm.notes}
                onChange={(e) => setStaffForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about this staff member"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
          </div>
          <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
            <div className="flex items-center justify-between w-full">
              <Button 
                variant="outline" 
                onClick={() => setIsStaffDialogOpen(false)}
                className="transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
              Cancel
            </Button>
            <Button 
              onClick={() => createStaffMutation.mutate(staffForm)}
              disabled={createStaffMutation.isPending || !staffForm.userId || !staffForm.department}
                className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                {createStaffMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Staff Member
                  </>
                )}
            </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Schedule Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              Create Staff Schedule
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Create a new work schedule for a staff member
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="scheduleStaffId" className="text-sm font-medium text-gray-700">Staff Member</Label>
                <Select value={scheduleForm.staffId} onValueChange={(value) => setScheduleForm(prev => ({ ...prev, staffId: value }))}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff?.staff.map((s: any) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.userName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedulePropertyId" className="text-sm font-medium text-gray-700">Property</Label>
                <Select value={scheduleForm.propertyId} onValueChange={(value) => setScheduleForm(prev => ({ ...prev, propertyId: value }))}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties?.properties.map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shiftDate" className="text-sm font-medium text-gray-700">Shift Date</Label>
                <Input
                  id="shiftDate"
                  type="date"
                  value={scheduleForm.shiftDate}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, shiftDate: e.target.value }))}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime" className="text-sm font-medium text-gray-700">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={scheduleForm.startTime}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime" className="text-sm font-medium text-gray-700">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={scheduleForm.endTime}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="breakMinutes" className="text-sm font-medium text-gray-700">Break Minutes</Label>
                <Input
                  id="breakMinutes"
                  type="number"
                  value={scheduleForm.breakMinutes}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, breakMinutes: e.target.value }))}
                  placeholder="30"
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduleNotes" className="text-sm font-medium text-gray-700">Notes</Label>
                <Textarea
                  id="scheduleNotes"
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about this schedule"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
            <div className="flex items-center justify-between w-full">
              <Button 
                variant="outline" 
                onClick={() => setIsScheduleDialogOpen(false)}
                className="transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => createScheduleMutation.mutate(scheduleForm)}
                disabled={createScheduleMutation.isPending || !scheduleForm.staffId || !scheduleForm.propertyId || !scheduleForm.shiftDate || !scheduleForm.startTime || !scheduleForm.endTime}
                className="bg-green-600 hover:bg-green-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                {createScheduleMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Calendar className="mr-2 h-4 w-4" />
                    Create Schedule
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Leave Dialog */}
      <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg shadow-sm">
                <CalendarDays className="h-5 w-5 text-orange-600" />
              </div>
              Request Leave
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Submit a leave request for approval
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="leaveType" className="text-sm font-medium text-gray-700">Leave Type</Label>
                <Select value={leaveForm.leaveType} onValueChange={(value: 'vacation' | 'sick' | 'personal' | 'emergency') => setLeaveForm(prev => ({ ...prev, leaveType: value }))}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacation">Vacation</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="personal">Personal Leave</SelectItem>
                    <SelectItem value="emergency">Emergency Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-sm font-medium text-gray-700">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className="text-sm font-medium text-gray-700">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaveReason" className="text-sm font-medium text-gray-700">Reason</Label>
                <Textarea
                  id="leaveReason"
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Reason for leave request"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
            <div className="flex items-center justify-between w-full">
              <Button 
                variant="outline" 
                onClick={() => setIsLeaveDialogOpen(false)}
                className="transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => requestLeaveMutation.mutate(leaveForm)}
                disabled={requestLeaveMutation.isPending || !leaveForm.startDate || !leaveForm.endDate}
                className="bg-orange-600 hover:bg-orange-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                {requestLeaveMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Submit Request
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Dialog */}
      <Dialog open={isAttendanceDialogOpen} onOpenChange={setIsAttendanceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg shadow-sm">
                <LogIn className="h-5 w-5 text-purple-600" />
              </div>
              Check In/Out
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Record your attendance for today
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="attendanceStaffId" className="text-sm font-medium text-gray-700">Staff Member</Label>
                <Select value={attendanceForm.staffId} onValueChange={(value) => setAttendanceForm(prev => ({ ...prev, staffId: value }))}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff?.staff.map((s: any) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.userName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="checkInTime" className="text-sm font-medium text-gray-700">Check In Time</Label>
                  <Input
                    id="checkInTime"
                    type="datetime-local"
                    value={attendanceForm.checkInTime}
                    onChange={(e) => setAttendanceForm(prev => ({ ...prev, checkInTime: e.target.value }))}
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkOutTime" className="text-sm font-medium text-gray-700">Check Out Time</Label>
                  <Input
                    id="checkOutTime"
                    type="datetime-local"
                    value={attendanceForm.checkOutTime}
                    onChange={(e) => setAttendanceForm(prev => ({ ...prev, checkOutTime: e.target.value }))}
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendanceNotes" className="text-sm font-medium text-gray-700">Notes</Label>
                <Textarea
                  id="attendanceNotes"
                  value={attendanceForm.notes}
                  onChange={(e) => setAttendanceForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about attendance"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
            <div className="flex items-center justify-between w-full">
              <Button 
                variant="outline" 
                onClick={() => setIsAttendanceDialogOpen(false)}
                className="transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                Cancel
              </Button>
              <div className="flex gap-2">
                <Button 
                  onClick={() => checkInMutation.mutate(attendanceForm)}
                  disabled={checkInMutation.isPending || !attendanceForm.staffId || !attendanceForm.checkInTime}
                  className="bg-green-600 hover:bg-green-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  {checkInMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Checking In...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Check In
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => checkOutMutation.mutate(attendanceForm)}
                  disabled={checkOutMutation.isPending || !attendanceForm.staffId || !attendanceForm.checkOutTime}
                  className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  {checkOutMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Checking Out...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Check Out
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Dialog */}
      <Dialog open={isSalaryDialogOpen} onOpenChange={setIsSalaryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              Add Salary Component
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Add a new salary component for a staff member
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="salaryStaffId" className="text-sm font-medium text-gray-700">Staff Member</Label>
                <Select value={salaryForm.staffId} onValueChange={(value) => setSalaryForm(prev => ({ ...prev, staffId: value }))}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff?.staff.map((s: any) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.userName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseSalaryCents" className="text-sm font-medium text-gray-700">Base Salary (cents)</Label>
                <Input
                  id="baseSalaryCents"
                  type="number"
                  value={salaryForm.baseSalaryCents}
                  onChange={(e) => setSalaryForm(prev => ({ ...prev, baseSalaryCents: e.target.value }))}
                  placeholder="500000 for $5000.00"
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="overtimeRateCents" className="text-sm font-medium text-gray-700">Overtime Rate (cents)</Label>
                <Input
                  id="overtimeRateCents"
                  type="number"
                  value={salaryForm.overtimeRateCents}
                  onChange={(e) => setSalaryForm(prev => ({ ...prev, overtimeRateCents: e.target.value }))}
                  placeholder="2250 for $22.50"
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bonusCents" className="text-sm font-medium text-gray-700">Bonus (cents)</Label>
                <Input
                  id="bonusCents"
                  type="number"
                  value={salaryForm.bonusCents}
                  onChange={(e) => setSalaryForm(prev => ({ ...prev, bonusCents: e.target.value }))}
                  placeholder="10000 for $100.00"
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="effectiveDate" className="text-sm font-medium text-gray-700">Effective Date</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={salaryForm.effectiveDate}
                  onChange={(e) => setSalaryForm(prev => ({ ...prev, effectiveDate: e.target.value }))}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
            <div className="flex items-center justify-between w-full">
              <Button 
                variant="outline" 
                onClick={() => setIsSalaryDialogOpen(false)}
                className="transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => createSalaryComponentMutation.mutate(salaryForm)}
                disabled={createSalaryComponentMutation.isPending || !salaryForm.staffId || !salaryForm.baseSalaryCents}
                className="bg-green-600 hover:bg-green-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                {createSalaryComponentMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Add Salary Component
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg shadow-sm">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              Generate Report
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Generate a report for staff data
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="reportType" className="text-sm font-medium text-gray-700">Report Type</Label>
                <Select value={reportForm.reportType} onValueChange={(value: 'attendance' | 'salary' | 'leave' | 'schedule') => setReportForm(prev => ({ ...prev, reportType: value }))}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attendance">Attendance Report</SelectItem>
                    <SelectItem value="salary">Salary Report</SelectItem>
                    <SelectItem value="leave">Leave Report</SelectItem>
                    <SelectItem value="schedule">Schedule Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reportStartDate" className="text-sm font-medium text-gray-700">Start Date</Label>
                  <Input
                    id="reportStartDate"
                    type="date"
                    value={reportForm.startDate}
                    onChange={(e) => setReportForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reportEndDate" className="text-sm font-medium text-gray-700">End Date</Label>
                  <Input
                    id="reportEndDate"
                    type="date"
                    value={reportForm.endDate}
                    onChange={(e) => setReportForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportFormat" className="text-sm font-medium text-gray-700">Format</Label>
                <Select value={reportForm.format} onValueChange={(value: 'csv' | 'excel' | 'pdf') => setReportForm(prev => ({ ...prev, format: value }))}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
            <div className="flex items-center justify-between w-full">
              <Button 
                variant="outline" 
                onClick={() => setIsReportDialogOpen(false)}
                className="transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => generateReportMutation.mutate(reportForm)}
                disabled={generateReportMutation.isPending || !reportForm.startDate || !reportForm.endDate}
                className="bg-purple-600 hover:bg-purple-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                {generateReportMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
