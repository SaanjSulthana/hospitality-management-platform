import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { KanbanBoard } from '@/components/ui/kanban-board';
import { Task } from '@/components/ui/task-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { CreateTaskDialog } from '@/components/ui/create-task-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStandardMutation, QUERY_KEYS } from '../src/utils/api-standardizer';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar,
  User,
  Flag,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  RefreshCw,
  X,
  Edit,
  Trash2,
  Loader2
} from 'lucide-react';

export default function TaskManagementPage() {
  const { getAuthenticatedBackend, user } = useAuth();
  const { theme } = useTheme();
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set page title
  useEffect(() => {
    setPageTitle('Task Management', 'Create, assign, and track tasks across your properties');
  }, [setPageTitle]);

  // State for filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  // State for create task dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createTaskStatus, setCreateTaskStatus] = useState<Task['status']>('open');

  // State for edit and delete dialogs
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [kanbanKey, setKanbanKey] = useState(0);
  const [editForm, setEditForm] = useState({
    propertyId: '',
    type: 'maintenance' as 'maintenance' | 'housekeeping' | 'service',
    title: '',
    description: '',
    priority: 'med' as 'low' | 'med' | 'high',
    status: 'open' as 'open' | 'progress' | 'blocked' | 'done',
    dueAt: '',
    estimatedHours: '',
    assigneeStaffId: 'none',
  });

  // Fetch tasks
  const { data: tasksData, isLoading: tasksLoading, error: tasksError, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      console.log('Fetching tasks from API...');
      const backend = getAuthenticatedBackend();
      const result = await backend.tasks.list({});
      console.log('Tasks data received:', result);
      return result;
    },
  });

  // Fetch staff for assignee dropdown
  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.staff.list({});
    },
  });

  // Fetch properties for edit form
  const { data: propertiesData } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.properties.list({});
    },
  });

  // Note: localTasks removed - tasks are now saved directly to database

  // Debug: Track editForm changes
  useEffect(() => {
    console.log('Edit form updated:', editForm);
  }, [editForm]);

  // Convert API tasks to Kanban format
  const tasks: Task[] = React.useMemo(() => {
    console.log('=== TASKS USEMEMO TRIGGERED ===');
    console.log('Raw tasks data:', tasksData);
    console.log('Tasks data timestamp:', new Date().toISOString());

    let apiTasks: Task[] = [];
    
    if (tasksData?.tasks) {
      apiTasks = tasksData.tasks.map((task: any) => {
        const mappedTask = {
          id: task.id.toString(),
          title: task.title || 'Untitled Task',
          description: task.description || '',
          status: mapStatusToKanban(task.status),
          priority: mapPriorityToKanban(task.priority),
          assignee: task.assigneeId ? {
            id: task.assigneeId.toString(),
            name: task.assigneeName || 'Unknown',
            avatar: task.assigneeAvatar
          } : undefined,
          dueDate: task.dueAt,
          tags: task.tags ? task.tags.split(',').map((tag: string) => tag.trim()) : [],
          createdAt: task.createdAt || new Date().toISOString(),
          updatedAt: task.updatedAt || new Date().toISOString(),
          propertyId: task.propertyId,
          propertyName: task.propertyName,
          type: task.type,
          estimatedHours: task.estimatedHours,
          assigneeStaffId: task.assigneeStaffId
        };
        console.log(`Task ${task.id} mapped:`, {
          originalStatus: task.status,
          mappedStatus: mappedTask.status,
          title: mappedTask.title
        });
        return mappedTask;
      });
    }
    
        // Return only API tasks (local tasks are now saved to database)
        console.log('Converted API tasks:', apiTasks);
        console.log('Tasks by status:', {
          open: apiTasks.filter(t => t.status === 'open').length,
          progress: apiTasks.filter(t => t.status === 'progress').length,
          blocked: apiTasks.filter(t => t.status === 'blocked').length,
          done: apiTasks.filter(t => t.status === 'done').length
        });
        
        // Log each task's key properties for verification
        apiTasks.forEach((task, index) => {
          console.log(`Task ${index + 1} (ID: ${task.id}):`, {
            title: task.title,
            type: task.type,
            priority: task.priority,
            status: task.status,
            description: task.description ? (task.description.length > 50 ? task.description.substring(0, 50) + '...' : task.description) : '',
            dueDate: task.dueDate,
            estimatedHours: task.estimatedHours,
            assignee: task.assignee?.name || 'Unassigned'
          });
        });
        
        return apiTasks;
  }, [tasksData, tasksData?.tasks]);

  // Filter tasks based on search and filters
  const filteredTasks = React.useMemo(() => {
    console.log('=== FILTERED TASKS USEMEMO TRIGGERED ===');
    console.log('Input tasks:', tasks);
    console.log('Filters:', { searchTerm, statusFilter, priorityFilter, assigneeFilter });
    
    const filtered = tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           task.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      const matchesAssignee = assigneeFilter === 'all' || task.assignee?.id === assigneeFilter;
      
      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
    });
    
    console.log('Filtered tasks:', filtered);
    console.log('Filtered tasks by status:', {
      open: filtered.filter(t => t.status === 'open').length,
      progress: filtered.filter(t => t.status === 'progress').length,
      blocked: filtered.filter(t => t.status === 'blocked').length,
      done: filtered.filter(t => t.status === 'done').length
    });
    return filtered;
  }, [tasks, searchTerm, statusFilter, priorityFilter, assigneeFilter]);


  // Update task mutation (for drag and drop) - using status-specific endpoint
  const updateTaskMutation = useStandardMutation(
    '/tasks/:id/status',
    'PATCH',
    {
      invalidateQueries: [QUERY_KEYS.TASKS, QUERY_KEYS.DASHBOARD, QUERY_KEYS.ANALYTICS],
      refetchQueries: [QUERY_KEYS.TASKS],
      successMessage: "Task status updated successfully",
      errorMessage: "Failed to update task status. Please try again.",
      onSuccess: () => {
        console.log('Drag and drop update successful');
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
        queryClient.refetchQueries({ queryKey: [QUERY_KEYS.TASKS] });
        // Force kanban board re-render
        setKanbanKey(prev => prev + 1);
      },
      onError: (error: any) => {
        console.error('Drag and drop update failed:', error);
        console.error('Error details:', {
          message: error?.message,
          response: error?.response,
          status: error?.status,
          data: error?.data,
          stack: error?.stack
        });
      }
    }
  );

  // Update task mutation (for edit form)
  const updateTaskFormMutation = useStandardMutation(
    '/tasks/:id',
    'PATCH',
    {
      invalidateQueries: [QUERY_KEYS.TASKS, QUERY_KEYS.DASHBOARD, QUERY_KEYS.ANALYTICS],
      refetchQueries: [QUERY_KEYS.TASKS],
      successMessage: "Task updated successfully",
      errorMessage: "Failed to update task. Please try again.",
      onSuccess: (data) => {
        console.log('=== TASK UPDATE SUCCESS ===');
        console.log('API response data:', data);
        console.log('Invalidating queries with key:', QUERY_KEYS.TASKS);
        
        // Invalidate and refetch tasks
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
        queryClient.refetchQueries({ queryKey: QUERY_KEYS.TASKS });
        
        // Also manually refetch the tasks query
        refetchTasks();
        
        // Force a complete cache clear for tasks
        queryClient.removeQueries({ queryKey: QUERY_KEYS.TASKS });
        
        console.log('Queries invalidated, refetched, and cleared');
        console.log('Current tasks data after update:', tasksData);
        
        // Force kanban board re-render by updating the key
        setKanbanKey(prev => prev + 1);
        
        setTimeout(() => {
          console.log('=== VERIFICATION: Updated task should now be visible in the UI ===');
          console.log('Check the task card to verify all changes are reflected correctly');
          console.log('If status was changed, the task should move to the correct column');
        }, 1000);
      }
    }
  );

  // Delete task mutation
  const deleteTaskMutation = useStandardMutation(
    '/tasks/:id',
    'DELETE',
    {
      invalidateQueries: [QUERY_KEYS.TASKS],
      successMessage: "Task deleted successfully",
      errorMessage: "Failed to delete task. Please try again.",
    }
  );

  // Handle task updates (drag and drop)
  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
    console.log('=== HANDLING TASK UPDATE ===');
    console.log('Task ID:', taskId, 'Type:', typeof taskId);
    console.log('Updates:', updates);
    
    // For drag and drop, we only update status using the status-specific endpoint
    if (updates.status !== undefined) {
      const mappedStatus = mapKanbanToStatus(updates.status);
      const updatePayload = {
        id: parseInt(taskId),
        status: mappedStatus
      };
      console.log('Status mapping:', updates.status, '->', mappedStatus);
      console.log('Status update payload:', updatePayload);
      console.log('Current user:', user);
      console.log('Access token exists:', !!localStorage.getItem('accessToken'));
      updateTaskMutation.mutate(updatePayload);
    } else {
      console.log('No status update needed for drag and drop');
    }
  };

  // Handle create task
  const handleCreateTask = (status: Task['status']) => {
    console.log('Creating task for status:', status);
    setCreateTaskStatus(status);
    setIsCreateDialogOpen(true);
    console.log('Dialog should be open now');
  };

  // Handle task click
  const handleTaskClick = (task: Task) => {
    // You can implement task detail view here
    console.log('Task clicked:', task);
  };

  // Handle task edit
  const handleTaskEdit = (task: Task) => {
    console.log('=== EDIT TASK CLICKED ===');
    console.log('Task to edit:', task);
    console.log('Task assigneeStaffId:', task.assigneeStaffId);
    console.log('Task assignee:', task.assignee);
    
    const assigneeId = task.assigneeStaffId?.toString() || task.assignee?.id || 'none';
    console.log('Mapped assigneeId:', assigneeId);
    
    setSelectedTask(task);
    const formData = {
      propertyId: task.propertyId?.toString() || '',
      type: task.type || 'maintenance',
      title: task.title,
      description: task.description || '',
      priority: mapPriorityToEditForm(task.priority),
      status: mapStatusToEditForm(task.status),
      dueAt: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '',
      estimatedHours: task.estimatedHours?.toString() || '',
      assigneeStaffId: assigneeId,
    };
    
    console.log('Setting edit form data:', formData);
    setEditForm(formData);
    setIsEditDialogOpen(true);
    
    console.log('Edit dialog should now be open');
    
    // Debug: Log the form state after setting
    setTimeout(() => {
      console.log('Edit form state after setting:', editForm);
    }, 100);
  };

  // Handle task update from edit form
  const handleUpdateTask = async () => {
    if (!selectedTask) {
      console.log('No selected task to update');
      return;
    }

    console.log('=== UPDATE TASK BUTTON CLICKED ===');
    console.log('Selected task:', selectedTask);
    console.log('Edit form data:', editForm);

    try {
      const updateData = {
        id: parseInt(selectedTask.id),
        propertyId: parseInt(editForm.propertyId),
        type: editForm.type,
        title: editForm.title,
        description: editForm.description || undefined,
        priority: editForm.priority,
        status: mapKanbanToStatus(editForm.status),
        assigneeStaffId: editForm.assigneeStaffId === 'none' ? undefined : parseInt(editForm.assigneeStaffId),
        dueAt: editForm.dueAt || undefined,
        estimatedHours: editForm.estimatedHours ? parseInt(editForm.estimatedHours) : undefined,
      };

      console.log('=== TASK UPDATE TEST ===');
      console.log('Selected task before update:', selectedTask);
      console.log('Edit form data:', editForm);
      console.log('Update payload:', updateData);
      console.log('Field changes detected:');
      console.log('- Title:', selectedTask.title, '->', editForm.title);
      console.log('- Description:', selectedTask.description, '->', editForm.description);
      console.log('- Type:', selectedTask.type, '->', editForm.type);
      console.log('- Priority:', selectedTask.priority, '->', editForm.priority);
      console.log('- Status:', selectedTask.status, '->', editForm.status);
      console.log('- Due Date:', selectedTask.dueDate, '->', editForm.dueAt);
      console.log('- Estimated Hours:', selectedTask.estimatedHours, '->', editForm.estimatedHours);
      console.log('- Assignee:', selectedTask.assignee?.name, '->', editForm.assigneeStaffId);
      
      // Check if status is changing
      if (selectedTask.status !== editForm.status) {
        console.log('🚀 STATUS CHANGE DETECTED! Task should move to new column after update');
        console.log('From:', selectedTask.status, 'To:', editForm.status);
      }

      console.log('Calling updateTaskFormMutation.mutateAsync...');
      await updateTaskFormMutation.mutateAsync(updateData);
      
      console.log('Update successful, closing dialog');
      setIsEditDialogOpen(false);
      setSelectedTask(null);
    } catch (error: any) {
      console.error('=== UPDATE TASK ERROR ===');
      console.error('Error updating task:', error);
      console.error('Error details:', {
        message: error?.message,
        response: error?.response,
        status: error?.status,
        data: error?.data,
        stack: error?.stack
      });
      
      // Extract more detailed error information
      let errorMessage = 'Unknown error occurred';
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.data?.message) {
        errorMessage = error.data.message;
      }
      
      toast({
        variant: "destructive",
        title: "Failed to update task",
        description: `Error: ${errorMessage}`,
      });
    }
  };

  // Handle task delete
  const handleTaskDelete = (task: Task) => {
    console.log('Delete task:', task);
    setSelectedTask(task);
    setIsDeleteDialogOpen(true);
  };

  // Confirm delete task
  const confirmDeleteTask = async () => {
    if (!selectedTask) return;

    try {
      await deleteTaskMutation.mutateAsync({ id: parseInt(selectedTask.id) });
      setIsDeleteDialogOpen(false);
      setSelectedTask(null);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };


  // Status mapping functions
  function mapStatusToKanban(apiStatus: string): Task['status'] {
    switch (apiStatus?.toLowerCase()) {
      case 'open': return 'open';
      case 'in_progress': return 'progress';
      case 'blocked': return 'blocked';
      case 'done': return 'done';
      default: return 'open';
    }
  }

  function mapKanbanToStatus(kanbanStatus: Task['status']): string {
    switch (kanbanStatus) {
      case 'open': return 'open';
      case 'progress': return 'in_progress';
      case 'blocked': return 'blocked';
      case 'done': return 'done';
      default: return 'open';
    }
  }

  function mapPriorityToKanban(apiPriority: string): Task['priority'] {
    switch (apiPriority?.toLowerCase()) {
      case 'low': return 'low';
      case 'med': return 'medium';
      case 'high': return 'high';
      case 'urgent': return 'urgent';
      default: return 'medium';
    }
  }

  function mapKanbanToPriority(kanbanPriority: Task['priority']): string {
    switch (kanbanPriority) {
      case 'low': return 'low';
      case 'medium': return 'med';
      case 'high': return 'high';
      case 'urgent': return 'urgent';
      default: return 'med';
    }
  }

  function mapPriorityToEditForm(kanbanPriority: Task['priority']): 'low' | 'med' | 'high' {
    switch (kanbanPriority) {
      case 'low': return 'low';
      case 'medium': return 'med';
      case 'high': return 'high';
      case 'urgent': return 'high'; // Map urgent to high for edit form
      default: return 'med';
    }
  }

  function mapStatusToEditForm(kanbanStatus: Task['status']): 'open' | 'progress' | 'blocked' | 'done' {
    switch (kanbanStatus) {
      case 'open': return 'open';
      case 'progress': return 'progress';
      case 'blocked': return 'blocked';
      case 'done': return 'done';
      default: return 'open';
    }
  }

  if (tasksLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-lg font-medium text-gray-900">Loading tasks...</p>
              <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your tasks</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tasksError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <p className="text-lg font-medium text-red-900 mb-2">Error loading tasks</p>
              <p className="text-sm text-gray-600 mb-4">{tasksError.message || 'Please try again'}</p>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="bg-white border-rose-200 text-red-700 hover:bg-rose-50 hover:border-rose-300 font-semibold"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  console.log('Rendering TaskManagementPage with:', {
    tasksLoading,
    tasksError,
    tasksCount: tasks.length,
    filteredTasksCount: filteredTasks.length,
    tasksData: !!tasksData,
    isCreateDialogOpen,
    createTaskStatus
  });

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
              <p className="text-gray-600">Create, assign, and track tasks across your properties</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {user?.role}
              </Badge>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="px-6">
          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                Search & Filters
              </CardTitle>
              <CardDescription className="text-sm text-gray-600">
                Find and filter tasks by various criteria
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label htmlFor="search" className="text-sm font-medium text-gray-700">Search Tasks</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="search"
                      placeholder="Search tasks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label htmlFor="status-filter" className="text-sm font-medium text-gray-700">Status Filter</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="progress">In Progress</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority Filter */}
                <div className="space-y-2">
                  <Label htmlFor="priority-filter" className="text-sm font-medium text-gray-700">Priority Filter</Label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="All Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Assignee Filter */}
                <div className="space-y-2">
                  <Label htmlFor="assignee-filter" className="text-sm font-medium text-gray-700">Assignee Filter</Label>
                  <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                    <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="All Assignees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assignees</SelectItem>
                      {staffData?.staff?.map((staff: any) => (
                        <SelectItem key={staff.id} value={staff.id.toString()}>
                          {staff.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
                </p>
                <Button
                  onClick={() => handleCreateTask('open')}
                  className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kanban Board */}
        <div className="px-6">
          <KanbanBoard
            key={`kanban-${kanbanKey}-${tasksData?.tasks?.length || 0}-${tasksData?.tasks?.map((t: any) => `${t.id}-${t.status}`).join(',') || ''}`}
            tasks={filteredTasks}
            onTaskUpdate={handleTaskUpdate}
            onCreateTask={handleCreateTask}
            onTaskClick={handleTaskClick}
            onTaskEdit={handleTaskEdit}
            onTaskDelete={handleTaskDelete}
            className="min-h-[600px]"
            theme={theme}
          />
        </div>

        {/* Create Task Dialog */}
        <CreateTaskDialog
          isOpen={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          initialStatus={createTaskStatus}
          onTaskCreated={(newTask) => {
            // Task is now saved to database, no need to add to local state
            // The query will automatically refresh and show the new task
            console.log('Task created successfully:', newTask);
          }}
        />

        {/* Edit Task Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" />
                Edit Task
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Update the task details below
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Property Selection */}
                <div className="space-y-2">
                  <Label htmlFor="edit-property" className="text-sm font-medium text-gray-700">Property *</Label>
                  <Select value={editForm.propertyId} onValueChange={(value) => {
                    console.log('Property changed to:', value);
                    setEditForm(prev => ({ ...prev, propertyId: value, assigneeStaffId: 'none' }));
                  }}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                    <SelectContent>
                      {propertiesData?.properties?.map((property: any) => (
                        <SelectItem key={property.id} value={property.id.toString()}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Task Title */}
                <div className="space-y-2">
                  <Label htmlFor="edit-title" className="text-sm font-medium text-gray-700">Task Title *</Label>
                  <Input
                    id="edit-title"
                    value={editForm.title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter task title"
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="edit-description" className="text-sm font-medium text-gray-700">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter task description (optional)"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Task Type */}
                <div className="space-y-2">
                  <Label htmlFor="edit-type" className="text-sm font-medium text-gray-700">Task Type</Label>
                  <Select value={editForm.type} onValueChange={(value: 'maintenance' | 'housekeeping' | 'service') => setEditForm(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="housekeeping">Housekeeping</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <Label htmlFor="edit-priority" className="text-sm font-medium text-gray-700">Priority</Label>
                  <Select value={editForm.priority} onValueChange={(value: 'low' | 'med' | 'high') => setEditForm(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Status */}
                <div className="space-y-2">
                  <Label htmlFor="edit-status" className="text-sm font-medium text-gray-700">Status</Label>
                  <Select value={editForm.status} onValueChange={(value: 'open' | 'progress' | 'blocked' | 'done') => setEditForm(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="progress">In Progress</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Due Date */}
                <div className="space-y-2">
                  <Label htmlFor="edit-due-date" className="text-sm font-medium text-gray-700">Due Date</Label>
                  <Input
                    id="edit-due-date"
                    type="datetime-local"
                    value={editForm.dueAt}
                    onChange={(e) => setEditForm(prev => ({ ...prev, dueAt: e.target.value }))}
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Estimated Hours */}
                <div className="space-y-2">
                  <Label htmlFor="edit-estimated-hours" className="text-sm font-medium text-gray-700">Estimated Hours</Label>
                  <Input
                    id="edit-estimated-hours"
                    type="number"
                    min="0"
                    step="0.5"
                    value={editForm.estimatedHours}
                    onChange={(e) => setEditForm(prev => ({ ...prev, estimatedHours: e.target.value }))}
                    placeholder="Enter estimated hours (optional)"
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Assignee */}
              <div className="space-y-2">
                <Label htmlFor="edit-assignee" className="text-sm font-medium text-gray-700">Assignee</Label>
                <Select
                  value={editForm.assigneeStaffId}
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, assigneeStaffId: value }))}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select assignee (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No assignee</SelectItem>
                    {staffData?.staff?.map((staff: any) => {
                      console.log('Staff item:', staff);
                      return (
                        <SelectItem key={staff.id} value={staff.id.toString()}>
                          {staff.name || staff.userName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                className="mr-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateTask}
                disabled={updateTaskFormMutation.isPending || !editForm.propertyId || !editForm.title}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updateTaskFormMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Update Task
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Task Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold text-red-900 flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                Delete Task
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Are you sure you want to delete this task? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            
            {selectedTask && (
              <div className="py-4">
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <h4 className="font-medium text-gray-900">{selectedTask.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{selectedTask.propertyName}</p>
                  <p className="text-xs text-gray-500 mt-2">Priority: {selectedTask.priority}</p>
                </div>
              </div>
            )}

            <DialogFooter className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                className="mr-2"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteTask}
                disabled={deleteTaskMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteTaskMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Task
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Status configuration for display
const statusConfig = {
  open: { title: 'Open' },
  progress: { title: 'In Progress' },
  blocked: { title: 'Blocked' },
  done: { title: 'Done' }
};
