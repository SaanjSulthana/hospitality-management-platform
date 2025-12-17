import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';
import { CreateTaskDialog } from '@/components/ui/create-task-dialog';
import { StatsCard } from '@/components/ui/stats-card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { NoData } from '@/components/ui/no-data';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Building2,
  AlertCircle,
  CheckCircle2,
  Circle,
  PlayCircle,
  XCircle,
  Edit,
  Trash2,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  ListTodo,
  LayoutGrid,
  List,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Image as ImageIcon,
  SlidersHorizontal,
} from 'lucide-react';

// Task type definitions
type TaskType = 'maintenance' | 'housekeeping' | 'service';
type TaskPriority = 'low' | 'med' | 'high';
type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done';

interface TaskInfo {
  id: number;
  propertyId: number;
  propertyName: string;
  type: TaskType;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeStaffId?: number;
  assigneeName?: string;
  dueAt?: Date;
  createdByUserId: number;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  estimatedHours?: number;
  actualHours?: number;
  attachmentCount: number;
  referenceImages?: any[];
}

export default function TasksPage() {
  const { getAuthenticatedBackend, user } = useAuth();
  const { theme } = useTheme();
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set page title
  useEffect(() => {
    setPageTitle('Task Management', 'Manage and track tasks across properties');
  }, [setPageTitle]);

  // State management
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskInfo | null>(null);
  const [deletingTask, setDeletingTask] = useState<TaskInfo | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Filters
  const [filters, setFilters] = useState({
    propertyId: 'all',
    type: 'all',
    priority: 'all',
    assignee: 'all',
    search: '',
  });

  // Edit form
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: 'med' as TaskPriority,
    status: 'open' as TaskStatus,
    assigneeStaffId: 'none' as string | 'none',
    dueAt: '',
  });

  // Responsive handler
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch tasks
  const { data: tasksData, isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks', filters.propertyId, filters.type, filters.priority, filters.assignee],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.tasks.list({
        propertyId: filters.propertyId !== 'all' ? parseInt(filters.propertyId) : undefined,
        type: filters.type !== 'all' ? filters.type as TaskType : undefined,
        priority: filters.priority !== 'all' ? filters.priority as TaskPriority : undefined,
        assignee: filters.assignee === 'me' ? 'me' : filters.assignee !== 'all' ? parseInt(filters.assignee) : undefined,
      });
    },
    staleTime: 25000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Fetch properties
  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.properties.list({});
    },
    staleTime: 300000,
    gcTime: 600000,
  });

  // Fetch staff for assignee filter
  const { data: staff } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.list({});
    },
    staleTime: 300000,
    gcTime: 600000,
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async (data: { id: number; updates: any }) => {
      const backend = getAuthenticatedBackend();
      return backend.tasks.update(data.id, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsEditDialogOpen(false);
      setEditingTask(null);
      toast({
        title: "Task updated",
        description: "The task has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update task",
        description: error.message || "Please try again.",
      });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const backend = getAuthenticatedBackend();
      return backend.tasks.deleteTask(taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsDeleteDialogOpen(false);
      setDeletingTask(null);
      toast({
        title: "Task deleted",
        description: "The task has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to delete task",
        description: error.message || "Please try again.",
      });
    },
  });

  // Update task status (quick action)
  const updateStatusMutation = useMutation({
    mutationFn: async (data: { id: number; status: TaskStatus }) => {
      const backend = getAuthenticatedBackend();
      // The Encore API expects the ID in the path: /tasks/:id/status
      return backend.tasks.updateStatus(data.id, {
        status: data.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: "Status updated",
        description: "Task status has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update status",
        description: error.message || "Please try again.",
      });
    },
  });

  // Filter tasks by search
  const tasks = tasksData?.tasks || [];
  const filteredTasks = tasks.filter((task: TaskInfo) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        task.title.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower) ||
        task.propertyName.toLowerCase().includes(searchLower) ||
        task.assigneeName?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  // Group tasks by status for kanban view
  const tasksByStatus = {
    open: filteredTasks.filter((t: TaskInfo) => t.status === 'open'),
    in_progress: filteredTasks.filter((t: TaskInfo) => t.status === 'in_progress'),
    blocked: filteredTasks.filter((t: TaskInfo) => t.status === 'blocked'),
    done: filteredTasks.filter((t: TaskInfo) => t.status === 'done'),
  };

  // Calculate statistics
  const stats = {
    total: tasks.length,
    open: tasks.filter((t: TaskInfo) => t.status === 'open').length,
    inProgress: tasks.filter((t: TaskInfo) => t.status === 'in_progress').length,
    overdue: tasks.filter((t: TaskInfo) =>
      t.dueAt && new Date(t.dueAt) < new Date() && t.status !== 'done'
    ).length,
    highPriority: tasks.filter((t: TaskInfo) => t.priority === 'high' && t.status !== 'done').length,
  };

  // Helper functions
  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'med': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'open': return <Circle className="h-4 w-4" />;
      case 'in_progress': return <PlayCircle className="h-4 w-4" />;
      case 'blocked': return <XCircle className="h-4 w-4" />;
      case 'done': return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_progress': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'blocked': return 'bg-red-100 text-red-700 border-red-200';
      case 'done': return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const getTypeIcon = (type: TaskType) => {
    switch (type) {
      case 'maintenance': return '🔧';
      case 'housekeeping': return '🧹';
      case 'service': return '🛎️';
    }
  };

  const isOverdue = (task: TaskInfo) => {
    return task.dueAt && new Date(task.dueAt) < new Date() && task.status !== 'done';
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'No due date';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleEditTask = (task: TaskInfo) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      assigneeStaffId: task.assigneeStaffId?.toString() || 'none',
      dueAt: task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : '',
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteTask = (task: TaskInfo) => {
    setDeletingTask(task);
    setIsDeleteDialogOpen(true);
  };

  const handleUpdateTask = () => {
    if (!editingTask) return;

    updateTaskMutation.mutate({
      id: editingTask.id,
      updates: {
        title: editForm.title,
        description: editForm.description || undefined,
        priority: editForm.priority,
        status: editForm.status,
        assigneeStaffId: editForm.assigneeStaffId !== 'none' ? parseInt(editForm.assigneeStaffId) : undefined,
        dueAt: editForm.dueAt || undefined,
      },
    });
  };

  const handleQuickStatusUpdate = (taskId: number, status: TaskStatus) => {
    updateStatusMutation.mutate({ id: taskId, status });
  };

  // Render task card - Optimized for iPhone 6s Premium Feel
  const renderTaskCard = (task: TaskInfo) => (
    <Card
      key={task.id}
      onClick={() => handleEditTask(task)} // Make whole card clickable for better touch
      className={`group relative overflow-hidden transition-all duration-200 
        rounded-2xl border-0 shadow-sm ring-1 ring-gray-100
        active:scale-[0.98] active:shadow-md touch-manipulation
        bg-white
      `}
    >
      {/* Priority Indicator Pill - Modern Apple Style */}
      <div className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
        ${task.priority === 'high' ? 'bg-red-50 text-red-600' :
          task.priority === 'med' ? 'bg-amber-50 text-amber-600' :
            'bg-emerald-50 text-emerald-600'}`}>
        {task.priority}
      </div>

      <CardContent className="p-4 pt-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-2 pr-12"> {/* pr-12 for badge space */}
          <div className="flex items-start gap-3">
            <div className={`
              flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm
              ${task.type === 'maintenance' ? 'bg-blue-50 text-blue-600' :
                task.type === 'housekeeping' ? 'bg-purple-50 text-purple-600' :
                  'bg-orange-50 text-orange-600'}
            `}>
              {getTypeIcon(task.type)}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 leading-tight truncate text-[17px] mb-1">
                {task.title}
              </h3>
              <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <Building2 className="h-3 w-3 text-gray-400" />
                {task.propertyName}
              </p>
            </div>
          </div>
        </div>

        {/* Description - truncated */}
        {task.description && (
          <p className="text-[13px] leading-relaxed text-gray-600 mb-3 line-clamp-2 pl-[52px]">
            {task.description}
          </p>
        )}

        {/* Footer Info */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-2 pl-[52px]">
          <div className="flex items-center gap-3">
            {task.assigneeName ? (
              <div className="flex items-center gap-1.5 p-1 -ml-1 rounded-md bg-gray-50/50">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                  {task.assigneeName.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-gray-600 max-w-[80px] truncate">
                  {task.assigneeName}
                </span>
              </div>
            ) : (
              <span className="text-xs text-gray-400 italic">Unassigned</span>
            )}
          </div>

          <div className={`flex items-center gap-1.5 text-xs font-medium ${isOverdue(task) ? 'text-red-500 bg-red-50 px-2 py-1 rounded-md' : 'text-gray-400'}`}>
            <Clock className="h-3.5 w-3.5" />
            {formatDate(task.dueAt)}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Render kanban column
  const renderKanbanColumn = (status: TaskStatus, title: string, tasks: TaskInfo[]) => (
    <div className="min-w-[85vw] md:min-w-[320px] md:flex-1 flex flex-col snap-center h-full">
      <div className="mb-4 sticky top-0 bg-transparent z-10 px-1">
        <div className="flex items-center justify-between mb-3 bg-white/50 backdrop-blur-sm p-3 rounded-2xl border border-white/20 shadow-sm">
          <h3 className="font-bold text-gray-900 flex items-center gap-2.5">
            {getStatusIcon(status)}
            <span className="text-lg">{title}</span>
          </h3>
          <Badge variant="secondary" className={`${getStatusColor(status)} rounded-lg px-2.5`}>
            {tasks.length}
          </Badge>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mx-1">
          <div
            className={`h-full rounded-full transition-all duration-500 ${status === 'done' ? 'bg-green-500' :
              status === 'in_progress' ? 'bg-purple-500' :
                status === 'blocked' ? 'bg-red-500' :
                  'bg-blue-500'
              }`}
            style={{ width: `${tasks.length > 0 ? Math.min((tasks.length / filteredTasks.length) * 100, 100) : 0}%` }}
          />
        </div>
      </div>
      <div className="space-y-3 overflow-y-auto pr-2 pb-20 md:pb-0 flex-1 px-1">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3">
              <ListTodo className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-gray-400 text-sm font-medium">No tasks in {title}</p>
          </div>
        ) : (
          tasks.map(renderTaskCard)
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:bg-[#F5F7FA]">
        {/* Header - Mobile Optimized */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                  <ListTodo className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </div>
                Tasks
              </h1>
              <p className="text-gray-600 mt-1 hidden md:block">Manage and track tasks across properties</p>
            </div>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 rounded-xl h-11 px-6 active:scale-95 transition-transform"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>

          {/* Stats Cards - Horizontal Scroll on Mobile */}
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 -mx-4 px-4 no-scrollbar md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:px-0 md:pb-0">
            <div className="min-w-[40vw] max-w-[150px] snap-center">
              <StatsCard
                title="Total Tasks"
                value={stats.total.toString()}
                icon={ListTodo}
                iconColor="text-blue-600"
                iconBgColor="bg-blue-100"
                className="bg-white rounded-xl border-gray-100 shadow-sm"
              />
            </div>
            <div className="min-w-[40vw] max-w-[150px] snap-center">
              <StatsCard
                title="Open"
                value={stats.open.toString()}
                icon={Circle}
                iconColor="text-blue-600"
                iconBgColor="bg-blue-100"
                className="bg-blue-50/50 border-blue-100 rounded-xl shadow-sm"
              />
            </div>
            <div className="min-w-[40vw] max-w-[150px] snap-center">
              <StatsCard
                title="In Progress"
                value={stats.inProgress.toString()}
                icon={PlayCircle}
                iconColor="text-purple-600"
                iconBgColor="bg-purple-100"
                className="bg-purple-50/50 border-purple-100 rounded-xl shadow-sm"
              />
            </div>
            <div className="min-w-[40vw] max-w-[150px] snap-center">
              <StatsCard
                title="Overdue"
                value={stats.overdue.toString()}
                icon={AlertTriangle}
                iconColor="text-red-600"
                iconBgColor="bg-red-100"
                className="bg-red-50/50 border-red-100 rounded-xl shadow-sm"
              />
            </div>
            <div className="min-w-[40vw] max-w-[150px] snap-center">
              <StatsCard
                title="High Priority"
                value={stats.highPriority.toString()}
                icon={AlertCircle}
                iconColor="text-yellow-600"
                iconBgColor="bg-yellow-100"
                className="bg-yellow-50/50 border-yellow-100 rounded-xl shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Mobile Filter Chips */}
        <div className="md:hidden flex overflow-x-auto gap-2 pb-4 -mx-4 px-4 no-scrollbar mb-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className={`rounded-full border-dashed flex-shrink-0 ${Object.values(filters).some(v => v !== 'all' && v !== '') ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-300'}`}>
                <SlidersHorizontal className="h-3.5 w-3.5 mr-2" />
                Filters {Object.values(filters).filter(v => v !== 'all' && v !== '').length > 0 && `(${Object.values(filters).filter(v => v !== 'all' && v !== '').length})`}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl">
              <SheetHeader className="mb-6 text-left">
                <SheetTitle>Filter Tasks</SheetTitle>
                <SheetDescription>Narrow down your tasks by property, type, and more.</SheetDescription>
              </SheetHeader>
              <div className="grid gap-6 py-4">
                {/* Reusing filter logic here but in a mobile friendly vertical stack */}
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search tasks..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="pl-10 h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Property</Label>
                  <Select value={filters.propertyId} onValueChange={(value) => setFilters({ ...filters, propertyId: value })}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      {properties?.properties.map((property: any) => (
                        <SelectItem key={property.id} value={property.id.toString()}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={filters.type} onValueChange={(value) => setFilters({ ...filters, type: value })}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="housekeeping">Housekeeping</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={filters.priority} onValueChange={(value) => setFilters({ ...filters, priority: value })}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="med">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Quick Chips for immediate filtering */}
          <Button
            variant={filters.type === 'maintenance' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilters({ ...filters, type: filters.type === 'maintenance' ? 'all' : 'maintenance' })}
            className={`rounded-full whitespace-nowrap flex-shrink-0 ${filters.type === 'maintenance' ? 'bg-blue-600' : 'border-gray-200'}`}
          >
            🔧 Maintenance
          </Button>
          <Button
            variant={filters.type === 'housekeeping' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilters({ ...filters, type: filters.type === 'housekeeping' ? 'all' : 'housekeeping' })}
            className={`rounded-full whitespace-nowrap flex-shrink-0 ${filters.type === 'housekeeping' ? 'bg-purple-600' : 'border-gray-200'}`}
          >
            🧹 Housekeeping
          </Button>
          <Button
            variant={filters.priority === 'high' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilters({ ...filters, priority: filters.priority === 'high' ? 'all' : 'high' })}
            className={`rounded-full whitespace-nowrap flex-shrink-0 ${filters.priority === 'high' ? 'bg-red-600 hover:bg-red-700' : 'border-gray-200 text-red-600 bg-red-50'}`}
          >
            🔥 High Priority
          </Button>
        </div>

        {/* Existing Desktop Filters */}
        <Card className="mb-6 shadow-sm hidden md:block">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Filters</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchTasks()}
                  className="h-8"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                  className="h-8"
                >
                  {isFiltersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search tasks..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>

            {/* Filter dropdowns */}
            {isFiltersOpen && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 mb-1.5 block">Property</Label>
                  <Select value={filters.propertyId} onValueChange={(value) => setFilters({ ...filters, propertyId: value })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      {properties?.properties.map((property: any) => (
                        <SelectItem key={property.id} value={property.id.toString()}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-gray-600 mb-1.5 block">Type</Label>
                  <Select value={filters.type} onValueChange={(value) => setFilters({ ...filters, type: value })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="housekeeping">Housekeeping</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-gray-600 mb-1.5 block">Priority</Label>
                  <Select value={filters.priority} onValueChange={(value) => setFilters({ ...filters, priority: value })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="med">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-gray-600 mb-1.5 block">Assignee</Label>
                  <Select value={filters.assignee} onValueChange={(value) => setFilters({ ...filters, assignee: value })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assignees</SelectItem>
                      <SelectItem value="me">My Tasks</SelectItem>
                      {staff?.staff.map((member: any) => (
                        <SelectItem key={member.id} value={member.id.toString()}>
                          {member.userName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* View mode toggle */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <span className="text-sm text-gray-600 mr-2">View:</span>
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className="h-8"
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Kanban
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8"
              >
                <List className="h-4 w-4 mr-2" />
                List
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {tasksLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : filteredTasks.length === 0 ? (
          <NoData
            icon={<ListTodo className="h-12 w-12" />}
            title="No tasks found"
            description="Create your first task to get started"
            action={
              <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            }
          />
        ) : viewMode === 'kanban' ? (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 h-[calc(100vh-280px)] md:h-auto md:overflow-visible md:px-0 md:mx-0">
            {renderKanbanColumn('open', 'Open', tasksByStatus.open)}
            {renderKanbanColumn('in_progress', 'In Progress', tasksByStatus.in_progress)}
            {renderKanbanColumn('blocked', 'Blocked', tasksByStatus.blocked)}
            {renderKanbanColumn('done', 'Done', tasksByStatus.done)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map(renderTaskCard)}
          </div>
        )}
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onTaskCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }}
      />

      {/* Edit Task Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update task details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="Task title"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Task description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select value={editForm.priority} onValueChange={(value: any) => setEditForm({ ...editForm, priority: value })}>
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
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(value: any) => setEditForm({ ...editForm, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input
                type="datetime-local"
                value={editForm.dueAt}
                onChange={(e) => setEditForm({ ...editForm, dueAt: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateTask}
              disabled={updateTaskMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateTaskMutation.isPending ? 'Updating...' : 'Update Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingTask?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingTask && deleteTaskMutation.mutate(deletingTask.id)}
              disabled={deleteTaskMutation.isPending}
            >
              {deleteTaskMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
