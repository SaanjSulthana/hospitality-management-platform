import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
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
  Plus, 
  Calendar, 
  Clock,
  Building2,
  Star,
  Users,
  CalendarDays,
  CheckCircle,
  XCircle
} from 'lucide-react';

export default function StaffPage() {
  const { getAuthenticatedBackend, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({
    userId: '',
    propertyId: '',
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

  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.list();
    },
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.listSchedules();
    },
  });

  const { data: leaveRequests, isLoading: leaveLoading } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.listLeaveRequests();
    },
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.users.list();
    },
    enabled: user?.role === 'ADMIN',
  });

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.properties.list();
    },
  });

  const createStaffMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      return backend.staff.create({
        ...data,
        userId: parseInt(data.userId),
        propertyId: data.propertyId ? parseInt(data.propertyId) : undefined,
        hourlyRateCents: data.hourlyRateCents ? parseInt(data.hourlyRateCents) : 0,
        hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setIsStaffDialogOpen(false);
      setStaffForm({
        userId: '',
        propertyId: '',
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
      const backend = getAuthenticatedBackend();
      return backend.staff.approveLeave({ id, approved });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      toast({
        title: "Leave request updated",
        description: "The leave request has been processed.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to process leave request",
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-600">Manage staff, schedules, and leave requests</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <CalendarDays className="mr-2 h-4 w-4" />
                Request Leave
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Leave</DialogTitle>
                <DialogDescription>
                  Submit a leave request for approval
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Leave Type</Label>
                  <Select value={leaveForm.leaveType} onValueChange={(value: any) => setLeaveForm(prev => ({ ...prev, leaveType: value }))}>
                    <SelectTrigger>
                      <SelectValue />
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
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={leaveForm.startDate}
                      onChange={(e) => setLeaveForm(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={leaveForm.endDate}
                      onChange={(e) => setLeaveForm(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Reason for leave request"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsLeaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => requestLeaveMutation.mutate(leaveForm)}
                  disabled={requestLeaveMutation.isPending || !leaveForm.startDate || !leaveForm.endDate}
                >
                  {requestLeaveMutation.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {user?.role === 'ADMIN' && (
            <>
              <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Calendar className="mr-2 h-4 w-4" />
                    Create Schedule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Schedule</DialogTitle>
                    <DialogDescription>
                      Schedule a staff member for a shift
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Staff Member</Label>
                      <Select value={scheduleForm.staffId} onValueChange={(value) => setScheduleForm(prev => ({ ...prev, staffId: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select staff member" />
                        </SelectTrigger>
                        <SelectContent>
                          {staff?.staff.map((member) => (
                            <SelectItem key={member.id} value={member.id.toString()}>
                              {member.userName} - {member.department}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Property</Label>
                      <Select value={scheduleForm.propertyId} onValueChange={(value) => setScheduleForm(prev => ({ ...prev, propertyId: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select property" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties?.properties.map((property) => (
                            <SelectItem key={property.id} value={property.id.toString()}>
                              {property.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Shift Date</Label>
                      <Input
                        type="date"
                        value={scheduleForm.shiftDate}
                        onChange={(e) => setScheduleForm(prev => ({ ...prev, shiftDate: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={scheduleForm.startTime}
                          onChange={(e) => setScheduleForm(prev => ({ ...prev, startTime: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={scheduleForm.endTime}
                          onChange={(e) => setScheduleForm(prev => ({ ...prev, endTime: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Break Minutes</Label>
                      <Input
                        type="number"
                        value={scheduleForm.breakMinutes}
                        onChange={(e) => setScheduleForm(prev => ({ ...prev, breakMinutes: e.target.value }))}
                        placeholder="30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={scheduleForm.notes}
                        onChange={(e) => setScheduleForm(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Schedule notes"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => createScheduleMutation.mutate(scheduleForm)}
                      disabled={createScheduleMutation.isPending || !scheduleForm.staffId || !scheduleForm.propertyId}
                    >
                      {createScheduleMutation.isPending ? 'Creating...' : 'Create Schedule'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isStaffDialogOpen} onOpenChange={setIsStaffDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Staff
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Staff Member</DialogTitle>
                    <DialogDescription>
                      Create a new staff record for a user
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>User</Label>
                      <Select value={staffForm.userId} onValueChange={(value) => setStaffForm(prev => ({ ...prev, userId: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {users?.users.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.displayName} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Property (Optional)</Label>
                      <Select value={staffForm.propertyId} onValueChange={(value) => setStaffForm(prev => ({ ...prev, propertyId: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select property" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No specific property</SelectItem>
                          {properties?.properties.map((property) => (
                            <SelectItem key={property.id} value={property.id.toString()}>
                              {property.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Select value={staffForm.department} onValueChange={(value) => setStaffForm(prev => ({ ...prev, department: value }))}>
                        <SelectTrigger>
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
                      <Label>Hourly Rate</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={staffForm.hourlyRateCents ? (parseInt(staffForm.hourlyRateCents) / 100).toString() : ''}
                        onChange={(e) => setStaffForm(prev => ({ ...prev, hourlyRateCents: (parseFloat(e.target.value) * 100).toString() }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hire Date</Label>
                      <Input
                        type="date"
                        value={staffForm.hireDate}
                        onChange={(e) => setStaffForm(prev => ({ ...prev, hireDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={staffForm.notes}
                        onChange={(e) => setStaffForm(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Additional notes"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsStaffDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => createStaffMutation.mutate(staffForm)}
                      disabled={createStaffMutation.isPending || !staffForm.userId || !staffForm.department}
                    >
                      {createStaffMutation.isPending ? 'Adding...' : 'Add Staff'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Staff Management Tabs */}
      <Tabs defaultValue="staff" className="space-y-4">
        <TabsList>
          <TabsTrigger value="staff">Staff Members</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="leave">Leave Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <CardTitle>Staff Members</CardTitle>
              <CardDescription>
                Manage your team members and their information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {staffLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : staff?.staff.length === 0 ? (
                <div className="text-center py-8">
                  <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No staff members</h3>
                  <p className="text-gray-500 mb-4">Start by adding your first staff member</p>
                  {user?.role === 'ADMIN' && (
                    <Button onClick={() => setIsStaffDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add First Staff Member
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {staff?.staff.map((member) => (
                    <Card key={member.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{member.userName}</CardTitle>
                            <CardDescription>{member.userEmail}</CardDescription>
                          </div>
                          <Badge className={getDepartmentColor(member.department)}>
                            {member.department}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {member.propertyName && (
                            <div className="flex items-center text-sm">
                              <Building2 className="h-4 w-4 mr-2 text-gray-500" />
                              <span>{member.propertyName}</span>
                            </div>
                          )}
                          {member.hourlyRateCents > 0 && (
                            <div className="flex items-center text-sm">
                              <span className="font-medium">Rate: {formatCurrency(member.hourlyRateCents)}/hr</span>
                            </div>
                          )}
                          {member.performanceRating > 0 && (
                            <div className="flex items-center text-sm">
                              <Star className="h-4 w-4 mr-2 text-yellow-500" />
                              <span>{member.performanceRating.toFixed(1)}/5.0</span>
                            </div>
                          )}
                          {member.hireDate && (
                            <div className="flex items-center text-sm text-gray-500">
                              <Calendar className="h-4 w-4 mr-2" />
                              <span>Hired {new Date(member.hireDate).toLocaleDateString()}</span>
                            </div>
                          )}
                          <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
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

        <TabsContent value="schedules">
          <Card>
            <CardHeader>
              <CardTitle>Staff Schedules</CardTitle>
              <CardDescription>
                View and manage staff work schedules
              </CardDescription>
            </CardHeader>
            <CardContent>
              {schedulesLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : schedules?.schedules.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules</h3>
                  <p className="text-gray-500 mb-4">Start by creating staff schedules</p>
                  {user?.role === 'ADMIN' && (
                    <Button onClick={() => setIsScheduleDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create First Schedule
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {schedules?.schedules.map((schedule) => (
                    <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{schedule.staffName}</h4>
                          <Badge className={getStatusColor(schedule.status)}>
                            {schedule.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{schedule.propertyName}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(schedule.shiftDate).toLocaleDateString()}
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {schedule.startTime} - {schedule.endTime}
                          </span>
                          {schedule.breakMinutes > 0 && (
                            <span>Break: {schedule.breakMinutes}min</span>
                          )}
                        </div>
                        {schedule.notes && (
                          <p className="text-sm text-gray-500 mt-1">{schedule.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave">
          <Card>
            <CardHeader>
              <CardTitle>Leave Requests</CardTitle>
              <CardDescription>
                Manage staff leave requests and approvals
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaveLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : leaveRequests?.leaveRequests.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarDays className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No leave requests</h3>
                  <p className="text-gray-500 mb-4">No leave requests have been submitted yet</p>
                  <Button onClick={() => setIsLeaveDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Request Leave
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaveRequests?.leaveRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{request.staffName}</h4>
                          <Badge className={getLeaveTypeColor(request.leaveType)}>
                            {request.leaveType}
                          </Badge>
                          <Badge className={getStatusColor(request.status)}>
                            {request.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-1">
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                          </span>
                        </div>
                        {request.reason && (
                          <p className="text-sm text-gray-600 mb-1">{request.reason}</p>
                        )}
                        {request.approvedByName && (
                          <p className="text-xs text-gray-500">
                            {request.status} by {request.approvedByName} on {new Date(request.approvedAt!).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {user?.role === 'ADMIN' && request.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveLeaveMutation.mutate({ id: request.id, approved: true })}
                            disabled={approveLeaveMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveLeaveMutation.mutate({ id: request.id, approved: false })}
                            disabled={approveLeaveMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
