import React, { useMemo, useState } from 'react';
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
import { CheckSquare, Clock, AlertCircle, Plus, Search, User, Calendar, Loader2 } from 'lucide-react';

export default function TasksPage() {
  const { getAuthenticatedBackend } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    propertyId: '',
    type: 'maintenance' as 'maintenance' | 'housekeeping' | 'service',
    title: '',
    description: '',
    priority: 'med' as 'low' | 'med' | 'high',
    dueAt: '',
    estimatedHours: '',
    assigneeStaffId: 'none' as string | 'none',
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.tasks.list();
    },
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.properties.list();
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  // Load staff options for selected property in the create dialog
  const { data: createStaffOptions, isLoading: isCreateStaffLoading } = useQuery({
    queryKey: ['staff', 'by-property', taskForm.propertyId || 'none'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      if (!taskForm.propertyId) return { staff: [] as any[] };
      return backend.staff.list({ propertyId: parseInt(taskForm.propertyId) });
    },
    enabled: !!taskForm.propertyId,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      return backend.tasks.create({
        propertyId: parseInt(data.propertyId),
        type: data.type,
        title: data.title,
        description: data.description || undefined,
        priority: data.priority,
        dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
        estimatedHours: data.estimatedHours ? parseFloat(data.estimatedHours) : undefined,
        assigneeStaffId: data.assigneeStaffId && data.assigneeStaffId !== 'none' ? parseInt(data.assigneeStaffId) : undefined,
      });
    },
    onSuccess: (newTask) => {
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      // Update the cache immediately with the new task
      queryClient.setQueryData(['tasks'], (old: any) => {
        if (!old) return { tasks: [newTask] };
        
        // Check if task already exists to avoid duplicates
        const exists = old.tasks.some((t: any) => t.id === newTask.id);
        if (exists) return old;
        
        return {
          tasks: [newTask, ...old.tasks]
        };
      });

      setIsCreateDialogOpen(false);
      setTaskForm({
        propertyId: '',
        type: 'maintenance',
        title: '',
        description: '',
        priority: 'med',
        dueAt: '',
        estimatedHours: '',
        assigneeStaffId: 'none',
      });
      toast({
        title: "Task created",
        description: "The task has been created successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Create task error:', error);
      toast({
        variant: "destructive",
        title: "Failed to create task",
        description: error.message || "Please try again.",
      });
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const backend = getAuthenticatedBackend();
      return backend.tasks.updateStatus({ id, status });
    },
    onSuccess: (result, variables) => {
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      // Update the specific task in cache
      queryClient.setQueryData(['tasks'], (old: any) => {
        if (!old) return old;
        
        return {
          tasks: old.tasks.map((task: any) =>
            task.id === variables.id
              ? {
                  ...task,
                  status: variables.status,
                  completedAt: variables.status === 'done' ? new Date().toISOString() : task.completedAt,
                  updatedAt: new Date().toISOString(),
                }
              : task
          )
        };
      });

      toast({
        title: "Task updated",
        description: "The task status has been updated.",
      });
    },
    onError: (error: any) => {
      console.error('Update task status error:', error);
      toast({
        variant: "destructive",
        title: "Failed to update task",
        description: error.message || "Please try again.",
      });
    },
  });

  // Assignment mutation
  const assignMutation = useMutation({
    mutationFn: async ({ id, staffId }: { id: number; staffId?: number }) => {
      const backend = getAuthenticatedBackend();
      return backend.tasks.assign({ id, staffId });
    },
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.setQueryData(['tasks'], (old: any) => {
        if (!old) return old;
        return {
          tasks: old.tasks.map((t: any) =>
            t.id === variables.id
              ? {
                  ...t,
                  assigneeStaffId: variables.staffId,
                  assigneeName: undefined, // will be refreshed via invalidate
                }
              : t
          ),
        };
      });
      toast({
        title: variables.staffId ? "Task assigned" : "Task unassigned",
        description: variables.staffId ? "The task has been assigned successfully." : "The task has been unassigned.",
      });
    },
    onError: (error: any) => {
      console.error('Assign task error:', error);
      toast({
        variant: "destructive",
        title: "Failed to update assignment",
        description: error.message || "Please try again.",
      });
    },
  });

  const filteredTasks = tasks?.tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.propertyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  }) || [];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'med': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      case 'blocked': return 'bg-red-100 text-red-800';
      case 'done': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'maintenance': return '🔧';
      case 'housekeeping': return '🧹';
      case 'service': return '🛎️';
      default: return '📋';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOverdue = (dueAt: string) => {
    return new Date(dueAt) < new Date();
  };

  const groupedTasks = {
    open: filteredTasks.filter(task => task.status === 'open'),
    in_progress: filteredTasks.filter(task => task.status === 'in_progress'),
    blocked: filteredTasks.filter(task => task.status === 'blocked'),
    done: filteredTasks.filter(task => task.status === 'done'),
  };

  const handleCreateTask = () => {
    if (!taskForm.propertyId || !taskForm.title) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in the required fields.",
      });
      return;
    }
    createTaskMutation.mutate(taskForm);
  };

  const handleStatusChange = (taskId: number, newStatus: string) => {
    updateTaskStatusMutation.mutate({ id: taskId, status: newStatus });
  };

  // Cache staff lists per property to avoid many queries
  const staffQueries: Record<number, { staff: any[]; isLoading: boolean }> = {};
  const StaffSelect = ({ propertyId, value, onChange, disabled }: { propertyId: number; value?: number | null; onChange: (v: number | null) => void; disabled?: boolean }) => {
    const { data, isLoading: loadingStaff } = useQuery({
      queryKey: ['staff', 'by-property', propertyId],
      queryFn: async () => {
        const backend = getAuthenticatedBackend();
        return backend.staff.list({ propertyId });
      },
    });
    const staff = data?.staff || [];
    return (
      <Select
        value={value ? String(value) : 'none'}
        onValueChange={(v) => onChange(v === 'none' ? null : parseInt(v))}
        disabled={disabled || loadingStaff}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder={loadingStaff ? 'Loading staff...' : 'Assign staff'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Unassigned</SelectItem>
          {staff.map((s: any) => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.userName} {s.department ? `· ${s.department}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const TaskCard = ({ task }: { task: any }) => {
    const [localAssigning, setLocalAssigning] = useState(false);
    const onAssign = async (staffId: number | null) => {
      setLocalAssigning(true);
      try {
        await assignMutation.mutateAsync({ id: task.id, staffId: staffId ?? undefined });
      } finally {
        setLocalAssigning(false);
      }
    };

    return (
      <Card className={`hover:shadow-md transition-shadow ${
        task.dueAt && isOverdue(task.dueAt) && task.status !== 'done' ? 'border-red-200 bg-red-50' : ''
      }`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2 flex-1">
              <span className="text-lg">{getTypeIcon(task.type)}</span>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base leading-tight">{task.title}</CardTitle>
                <CardDescription className="text-sm mt-1">
                  {task.propertyName}
                </CardDescription>
              </div>
            </div>
            <Badge className={getPriorityColor(task.priority)}>
              {task.priority}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {task.description && (
              <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
            )}
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <User className="h-3 w-3 mr-1" />
                  <span>{task.assigneeName || 'Unassigned'}</span>
                </div>
                {task.dueAt && (
                  <div className={`flex items-center ${
                    isOverdue(task.dueAt) && task.status !== 'done' ? 'text-red-600' : ''
                  }`}>
                    <Calendar className="h-3 w-3 mr-1" />
                    <span>{formatDate(task.dueAt)}</span>
                    {isOverdue(task.dueAt) && task.status !== 'done' && (
                      <AlertCircle className="h-3 w-3 ml-1 text-red-500" />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Select value={task.status} onValueChange={(value) => handleStatusChange(task.id, value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <StaffSelect
                  propertyId={task.propertyId}
                  value={task.assigneeStaffId ?? null}
                  onChange={onAssign}
                  disabled={localAssigning || assignMutation.isPending}
                />
                {localAssigning || assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Tasks</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600">Manage and track operational tasks</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>
                Create a new task for your property operations
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="property">Property *</Label>
                <Select value={taskForm.propertyId} onValueChange={(value) => setTaskForm(prev => ({ ...prev, propertyId: value, assigneeStaffId: 'none' }))}>
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

              {/* Assignee */}
              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select
                  value={taskForm.assigneeStaffId}
                  onValueChange={(value) => setTaskForm(prev => ({ ...prev, assigneeStaffId: value }))}
                  disabled={!taskForm.propertyId || isCreateStaffLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isCreateStaffLoading ? 'Loading staff...' : 'Select assignee (optional)'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {(createStaffOptions?.staff || []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.userName} {s.department ? `· ${s.department}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={taskForm.type} onValueChange={(value: any) => setTaskForm(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="housekeeping">Housekeeping</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={taskForm.priority} onValueChange={(value: any) => setTaskForm(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="med">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter task title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter task description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueAt">Due Date</Label>
                  <Input
                    id="dueAt"
                    type="datetime-local"
                    value={taskForm.dueAt}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, dueAt: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimatedHours">Estimated Hours</Label>
                  <Input
                    id="estimatedHours"
                    type="number"
                    step="0.5"
                    value={taskForm.estimatedHours}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, estimatedHours: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateTask}
                disabled={createTaskMutation.isPending || !taskForm.propertyId || !taskForm.title}
              >
                {createTaskMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Task'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="med">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tasks Content */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Tasks ({filteredTasks.length})</TabsTrigger>
          <TabsTrigger value="open">Open ({groupedTasks.open.length})</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({groupedTasks.in_progress.length})</TabsTrigger>
          <TabsTrigger value="blocked">Blocked ({groupedTasks.blocked.length})</TabsTrigger>
          <TabsTrigger value="done">Done ({groupedTasks.done.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckSquare className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
                <p className="text-gray-500 text-center mb-4">
                  {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Get started by creating your first task'
                  }
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Task
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </TabsContent>

        {Object.entries(groupedTasks).map(([status, statusTasks]) => (
          <TabsContent key={status} value={status}>
            {statusTasks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckSquare className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No {status.replace('_', ' ')} tasks
                  </h3>
                  <p className="text-gray-500 text-center">
                    No tasks with {status.replace('_', ' ')} status found
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {statusTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
