import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FinanceTabs, FinanceTabsList, FinanceTabsTrigger } from '@/components/ui/finance-tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { LoadingCard, LoadingPage } from '@/components/ui/loading-spinner';
import { NoDataCard } from '@/components/ui/no-data';
import { useApiError } from '@/hooks/use-api-error';
import { useTasksRealtime } from '@/hooks/use-realtime';
import { useFormValidation, commonValidationRules } from '@/hooks/use-form-validation';
import { CheckSquare, Clock, AlertCircle, Plus, Search, User, Calendar, Loader2, RefreshCw, Image, X, Eye, Edit, Trash2 } from 'lucide-react';
import { TaskImageUpload } from '@/components/ui/task-image-upload';
import { formatDueDateTimeTime } from '../lib/datetime';
import { formatDateTimeForAPI, getCurrentDateTimeString } from '../lib/date-utils';
import { TaskImage } from '../lib/api/task-images';
import { useTaskImageManagement } from '../hooks/use-task-image-management';
import { ERROR_MESSAGES } from '../src/config/api';
import { useStandardQuery, useStandardMutation, QUERY_KEYS, STANDARD_QUERY_CONFIGS } from '../src/utils/api-standardizer';
import { getFlagBool } from '../lib/feature-flags';
import { CreateTaskDialog } from '@/components/ui/create-task-dialog';

export default function TasksPage() {
  const { getAuthenticatedBackend, user } = useAuth();
  const { theme } = useTheme();
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { refreshNow, isPolling } = useTasksRealtime();

  // Set page title and description
  useEffect(() => {
    setPageTitle('Task Management', 'Create, assign, and track tasks across your properties');
  }, [setPageTitle]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    propertyId: '',
    type: 'maintenance' as 'maintenance' | 'housekeeping' | 'service',
    title: '',
    description: '',
    priority: 'med' as 'low' | 'med' | 'high',
    dueAt: '',
    estimatedHours: '',
    assigneeStaffId: 'none' as string | 'none',
  });


  const { data: tasks, isLoading, error: tasksError } = useStandardQuery(
    QUERY_KEYS.TASKS,
    '/tasks',
    {
      staleTime: 25000,
      gcTime: 300000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    }
  );

  const { data: properties } = useStandardQuery(
    QUERY_KEYS.PROPERTIES,
    '/properties',
    {
      staleTime: 30000,
      gcTime: 300000,
    }
  );



  const updateTaskStatusMutation = useStandardMutation(
    '/tasks/:id/status',
    'PATCH',
    {
      invalidateQueries: [QUERY_KEYS.TASKS],
      successMessage: "Task status updated successfully",
      errorMessage: "Failed to update task status. Please try again.",
    }
  );

  // Assignment mutation
  const assignMutation = useStandardMutation(
    '/tasks/:id/assign',
    'PATCH',
    {
      invalidateQueries: [QUERY_KEYS.TASKS],
      successMessage: "Task assignment updated successfully",
      errorMessage: "Failed to update task assignment. Please try again.",
    }
  );

  // Update task mutation
  const updateTaskMutation = useStandardMutation(
    '/tasks/:id',
    'PATCH',
    {
      invalidateQueries: [QUERY_KEYS.TASKS, QUERY_KEYS.DASHBOARD, QUERY_KEYS.ANALYTICS],
      refetchQueries: [QUERY_KEYS.TASKS],
      successMessage: "Task updated successfully",
      errorMessage: "Failed to update task. Please try again.",
      onSuccess: () => {
        // Force immediate refresh of tasks data
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
        queryClient.refetchQueries({ queryKey: [QUERY_KEYS.TASKS] });
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

  const filteredTasks = tasks?.tasks.filter((task: any) => {
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
    return formatDueDateTimeTime(dateString);
  };

  const isOverdue = (dueAt: string) => {
    return new Date(dueAt) < new Date();
  };

  const groupedTasks = {
    open: filteredTasks.filter((task: any) => task.status === 'open'),
    in_progress: filteredTasks.filter((task: any) => task.status === 'in_progress'),
    blocked: filteredTasks.filter((task: any) => task.status === 'blocked'),
    done: filteredTasks.filter((task: any) => task.status === 'done'),
  };

  // Realtime: Tasks events listener (row-level cache patching + minimal refetch)
  useEffect(() => {
    // Expose optional property filter (not used here)
    try { (window as any).__tasksSelectedPropertyId = 'all'; } catch {}

    const enabled = getFlagBool('TASKS_REALTIME_V1', true);
    if (!enabled) return;

    const onEvents = (e: any) => {
      const events = e?.detail?.events || [];
      if (!Array.isArray(events) || events.length === 0) return;

      let needsTasksRefetch = false;

      for (const ev of events) {
        const { eventType, entityId, metadata } = ev || {};
        if (!eventType || !entityId) continue;

        // For complex changes (create/delete/attachments), do a single refetch
        if (
          eventType === 'task_created' ||
          eventType === 'task_deleted' ||
          eventType === 'task_attachment_added' ||
          eventType === 'task_hours_updated' ||
          eventType === 'task_assigned' ||
          eventType === 'task_assignment_cleared'
        ) {
          needsTasksRefetch = true;
          continue;
        }

        // Row-level status update
        if (eventType === 'task_status_updated') {
          const newStatus = metadata?.newStatus || metadata?.status;
          if (!newStatus) {
            needsTasksRefetch = true;
            continue;
          }
          queryClient.setQueryData(QUERY_KEYS.TASKS, (old: any) => {
            if (!old?.tasks) return old;
            return {
              ...old,
              tasks: old.tasks.map((task: any) =>
                task.id === entityId ? { ...task, status: newStatus } : task
              ),
            };
          });
          continue;
        }

        // Generic task_updated patch (title/priority/dueAt/description, if provided)
        if (eventType === 'task_updated') {
          queryClient.setQueryData(QUERY_KEYS.TASKS, (old: any) => {
            if (!old?.tasks) return old;
            return {
              ...old,
              tasks: old.tasks.map((task: any) =>
                task.id === entityId
                  ? {
                      ...task,
                      title: metadata?.title ?? task.title,
                      priority: metadata?.priority ?? task.priority,
                      dueAt: metadata?.dueAt ?? task.dueAt,
                      description: metadata?.description ?? task.description,
                    }
                  : task
              ),
            };
          });
          continue;
        }
      }

      if (needsTasksRefetch) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
      }
    };

    window.addEventListener('tasks-stream-events', onEvents);
    return () => {
      window.removeEventListener('tasks-stream-events', onEvents);
    };
  }, [queryClient]);

  const handleStatusChange = (taskId: number, newStatus: string) => {
    updateTaskStatusMutation.mutate({ 
      id: taskId, 
      status: newStatus as 'open' | 'in_progress' | 'blocked' | 'done' 
    });
  };

  const handleEditTask = (task: any) => {
    setSelectedTask(task);
    setEditForm({
      propertyId: task.propertyId.toString(),
      type: task.type,
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      dueAt: task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : '',
      estimatedHours: task.estimatedHours?.toString() || '',
      assigneeStaffId: task.assigneeStaffId?.toString() || 'none',
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateTask = async () => {
    if (!selectedTask) return;

    try {
      const updateData = {
        id: selectedTask.id,
        propertyId: parseInt(editForm.propertyId),
        type: editForm.type,
        title: editForm.title,
        description: editForm.description || undefined,
        priority: editForm.priority,
        assigneeStaffId: editForm.assigneeStaffId === 'none' ? undefined : parseInt(editForm.assigneeStaffId),
        dueAt: editForm.dueAt || undefined,
        estimatedHours: editForm.estimatedHours ? parseInt(editForm.estimatedHours) : undefined,
      };

      await updateTaskMutation.mutateAsync(updateData);
      setIsEditDialogOpen(false);
      setSelectedTask(null);
    } catch (error) {
      handleError(error);
    }
  };

  const handleDeleteTask = (task: any) => {
    setSelectedTask(task);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteTask = async () => {
    if (!selectedTask) return;

    try {
      await deleteTaskMutation.mutateAsync({ id: selectedTask.id });
      setIsDeleteDialogOpen(false);
      setSelectedTask(null);
    } catch (error) {
      handleError(error);
    }
  };

  // Cache staff lists per property to avoid many queries
  const staffQueries: Record<number, { staff: any[]; isLoading: boolean }> = {};
  const StaffSelect = ({ propertyId, value, onChange, disabled }: { propertyId: number; value?: number | null; onChange: (v: number | null) => void; disabled?: boolean }) => {
    const { data, isLoading: loadingStaff } = useStandardQuery(
      ['staff', 'by-property', propertyId.toString()],
      `/staff?propertyId=${propertyId}`,
      {}
    );
    const staff = data?.staff || [];
    return (
      <Select
        value={value ? String(value) : 'none'}
        onValueChange={(v) => onChange(v === 'none' ? null : parseInt(v))}
        disabled={disabled || loadingStaff}
      >
        <SelectTrigger className="w-full h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-w-0">
          <SelectValue placeholder={loadingStaff ? 'Loading staff...' : 'Assign staff'} className="truncate" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Unassigned</SelectItem>
          {staff.map((s: any) => (
            <SelectItem key={s.id} value={String(s.id)} className="truncate">
              <span className="truncate">{s.userName} {s.department ? `· ${s.department}` : ''}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const TaskCard = React.memo(({ task }: { task: any }) => {
    const [localAssigning, setLocalAssigning] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<{ id: number; url: string } | null>(null);
    
    // Use the new image management hook
    const {
      getImageUrl,
      isImageLoading,
      hasImageError,
      retryImage,
      uploadImages,
      deleteImage,
      isUploading,
      loadedCount,
      totalCount
    } = useTaskImageManagement({
      taskId: task.id,
      existingImages: task.referenceImages || []
    });
    
    const onAssign = async (staffId: number | null) => {
      setLocalAssigning(true);
      try {
        await assignMutation.mutateAsync({ id: task.id, staffId: staffId ?? undefined });
      } finally {
        setLocalAssigning(false);
      }
    };

    const handleImageClick = (imageId: number, imageUrl: string) => {
      console.log('TasksPage handleImageClick:', imageId, imageUrl);
      if (imageUrl) {
        setSelectedImage({ id: imageId, url: imageUrl });
        setShowImageModal(true);
      }
    };

    const handleImageUpload = async (taskId: number, files: File[]) => {
      try {
        await uploadImages(files);
      } catch (error) {
        console.error('Image upload failed:', error);
        // Error handling is done in the hook
      }
    };

    const handleImageDelete = async (taskId: number, imageId: number) => {
      await deleteImage(imageId);
    };

    // Use real reference images from task data
    const referenceImages = task.referenceImages || [];

    return (
      <>
        <Card className={`shadow-sm hover:shadow-md transition-all duration-200 ${
          task.dueAt && isOverdue(task.dueAt) && task.status !== 'done' ? 'border-red-200 bg-red-50' : ''
        }`}>
          <CardHeader className="pb-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-orange-100 rounded-lg shadow-sm flex-shrink-0">
                <span className="text-lg">{getTypeIcon(task.type)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                  <CardTitle className="text-lg font-bold text-gray-900 leading-tight flex-1 min-w-0 break-words">
                    {task.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={`${getPriorityColor(task.priority)} text-xs px-2 py-1`}>
                      {task.priority}
                    </Badge>
                    {/* Admin Action Buttons */}
                    {user?.role === 'ADMIN' && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTask(task)}
                          className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600 transition-all duration-200"
                          title="Edit task"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(task)}
                          className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 transition-all duration-200"
                          title="Delete task"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <CardDescription className="text-sm text-gray-600 break-words">
                  {task.propertyName}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0 space-y-4">
            {/* Reference Images Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Reference Images</span>
                </div>
                <div className="text-xs text-gray-500">
                  {referenceImages.length}/5
                </div>
              </div>
              
              {/* Compact Image Upload Area */}
              <TaskImageUpload
                taskId={task.id}
                existingImages={referenceImages}
                onImageUpload={handleImageUpload}
                onImageDelete={handleImageDelete}
                onImageClick={handleImageClick}
                maxImages={5}
                maxSize={5}
                disabled={referenceImages.length >= 5}
                className="!space-y-2"
                compact={true}
              />
              
            </div>

            {task.description && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Description</p>
                <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">{task.description}</p>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-gray-500">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <User className="h-4 w-4 flex-shrink-0" />
                <span className="break-words min-w-0 font-medium">{task.assigneeName || 'Unassigned'}</span>
              </div>
              {task.dueAt && (
                <div className={`flex items-center gap-2 min-w-0 flex-1 ${
                  isOverdue(task.dueAt) && task.status !== 'done' ? 'text-red-600' : ''
                }`}>
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span className="break-words min-w-0 font-medium">{formatDate(task.dueAt)}</span>
                  {isOverdue(task.dueAt) && task.status !== 'done' && (
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-3 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">Status</Label>
                  <Select value={task.status} onValueChange={(value) => handleStatusChange(task.id, value)}>
                    <SelectTrigger className="w-full h-9 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
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
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">Assignee</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <StaffSelect
                        propertyId={task.propertyId}
                        value={task.assigneeStaffId ?? null}
                        onChange={onAssign}
                        disabled={localAssigning || assignMutation.isPending}
                      />
                    </div>
                    {localAssigning || assignMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Image Modal */}
        {showImageModal && selectedImage && (
          <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
            <DialogContent className="max-w-4xl max-h-[90vh] p-0">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white hover:bg-opacity-70"
                  onClick={() => setShowImageModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <img 
                  src={selectedImage.url} 
                  alt="Task reference"
                  className="w-full h-auto max-h-[80vh] object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/placeholder-image.png'; // Fallback image
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }, (prevProps, nextProps) => {
    // Only re-render if task data actually changes
    return (
      prevProps.task.id === nextProps.task.id &&
      prevProps.task.status === nextProps.task.status &&
      prevProps.task.assigneeStaffId === nextProps.task.assigneeStaffId &&
      JSON.stringify(prevProps.task.referenceImages) === JSON.stringify(nextProps.task.referenceImages)
    );
  });

  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-gray-50">
        <div className="space-y-6">
          {/* Loading Search Section */}
          <Card className="">
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900">Loading tasks...</p>
                <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your task data</p>
              </div>
            </CardContent>
          </Card>
          
          {/* Loading Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className=" animate-pulse">
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-12"></div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Image placeholders */}
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                    <div className="h-16 bg-gray-200 rounded-lg"></div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-16 bg-gray-200 rounded-lg"></div>
                      <div className="h-16 bg-gray-200 rounded-lg"></div>
                      <div className="h-16 bg-gray-200 rounded-lg"></div>
                    </div>
                  </div>
                  {/* Description placeholder */}
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-16"></div>
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                  {/* Details placeholder */}
                  <div className="flex gap-3">
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                    <div className="h-4 bg-gray-200 rounded w-28"></div>
                  </div>
                  {/* Actions placeholder */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-9 bg-gray-200 rounded"></div>
                      <div className="h-9 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show error state if data failed to load
  if (tasksError) {
    return (
      <div className="w-full min-h-screen bg-gray-50">
        <div className="space-y-6">
          <Card className="">
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <p className="text-lg font-medium text-red-900 mb-2">Error loading tasks</p>
                <p className="text-sm text-gray-600 mb-4">{tasksError.message || 'There was an error loading your tasks'}</p>
                <Button 
                  onClick={refreshNow}
                  variant="outline" 
                  className="bg-white border-rose-200 text-red-700 hover:bg-rose-50 hover:border-rose-300 font-semibold"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="space-y-6">
        {/* Enhanced Search and Filter Section */}
        <Card className=" shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              Task Management
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Live</span>
            </CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Search, filter, and manage your tasks efficiently
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search-tasks" className="text-sm font-medium text-gray-700">Search Tasks</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="search-tasks"
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status-filter" className="text-sm font-medium text-gray-700">Status Filter</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority-filter" className="text-sm font-medium text-gray-700">Priority Filter</Label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
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
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="text-sm text-gray-600">
                Showing {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
              </div>
              <CreateTaskDialog
                isOpen={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                trigger={
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Task
                  </Button>
                }
              />

              {/* Edit Task Dialog */}
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
                  <DialogHeader className="pb-4">
                    <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                        <Edit className="h-5 w-5 text-blue-600" />
                      </div>
                      Edit Task
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-600">
                      Update task details and assignment
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto px-1">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-property" className="text-sm font-medium text-gray-700">Property *</Label>
                        <Select value={editForm.propertyId} onValueChange={(value) => setEditForm(prev => ({ ...prev, propertyId: value, assigneeStaffId: 'none' }))}>
                          <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                            <SelectValue placeholder="Select property" />
                          </SelectTrigger>
                          <SelectContent>
                            {properties?.properties.map((property: any) => (
                              <SelectItem key={property.id} value={property.id.toString()}>
                                {property.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

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

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-type" className="text-sm font-medium text-gray-700">Type *</Label>
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
                        <div className="space-y-2">
                          <Label htmlFor="edit-priority" className="text-sm font-medium text-gray-700">Priority *</Label>
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

                      <div className="space-y-2">
                        <Label htmlFor="edit-due" className="text-sm font-medium text-gray-700">Due Date & Time</Label>
                        <Input
                          id="edit-due"
                          type="datetime-local"
                          value={editForm.dueAt}
                          onChange={(e) => setEditForm(prev => ({ ...prev, dueAt: e.target.value }))}
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-hours" className="text-sm font-medium text-gray-700">Estimated Hours</Label>
                        <Input
                          id="edit-hours"
                          type="number"
                          value={editForm.estimatedHours}
                          onChange={(e) => setEditForm(prev => ({ ...prev, estimatedHours: e.target.value }))}
                          placeholder="Enter estimated hours (optional)"
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>

                      {/* Assignee */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Assignee</Label>
                        <Select
                          value={editForm.assigneeStaffId}
                          onValueChange={(value) => setEditForm(prev => ({ ...prev, assigneeStaffId: value }))}
                          disabled={!editForm.propertyId}
                        >
                          <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                            <SelectValue placeholder="Select assignee (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {properties?.properties
                              .find((p: any) => p.id.toString() === editForm.propertyId)
                              ?.staff?.map((staff: any) => (
                                <SelectItem key={staff.id} value={staff.id.toString()}>
                                  {staff.userName}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
                    <div className="flex items-center justify-between w-full">
                      <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleUpdateTask}
                        disabled={updateTaskMutation.isPending || !editForm.propertyId || !editForm.title}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {updateTaskMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          'Update Task'
                        )}
                      </Button>
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Delete Confirmation Dialog */}
              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader className="pb-4">
                    <DialogTitle className="text-xl font-bold text-red-900 flex items-center gap-2">
                      <div className="p-2 bg-red-100 rounded-lg shadow-sm">
                        <Trash2 className="h-5 w-5 text-red-600" />
                      </div>
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
                  <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
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
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Delete Task'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Sticky Tabs */}
        <FinanceTabs defaultValue="all" theme={theme}>
          <FinanceTabsList className="grid-cols-5" theme={theme}>
            <FinanceTabsTrigger value="all" theme={theme}>
              <CheckSquare className="h-4 w-4 mr-2" />
              All ({filteredTasks.length})
            </FinanceTabsTrigger>
            <FinanceTabsTrigger value="open" theme={theme}>
              <Clock className="h-4 w-4 mr-2" />
              Open ({groupedTasks.open.length})
            </FinanceTabsTrigger>
            <FinanceTabsTrigger value="in_progress" theme={theme}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Progress ({groupedTasks.in_progress.length})
            </FinanceTabsTrigger>
            <FinanceTabsTrigger value="blocked" theme={theme}>
              <AlertCircle className="h-4 w-4 mr-2" />
              Blocked ({groupedTasks.blocked.length})
            </FinanceTabsTrigger>
            <FinanceTabsTrigger value="done" theme={theme}>
              <CheckSquare className="h-4 w-4 mr-2" />
              Done ({groupedTasks.done.length})
            </FinanceTabsTrigger>
          </FinanceTabsList>

          {/* Content Container */}
          <div className="px-6 py-6">

            <TabsContent value="all" className="pt-4">
              {filteredTasks.length === 0 ? (
                <Card className="">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckSquare className="h-8 w-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
                    <p className="text-gray-500 text-center mb-4">
                      {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                        ? 'Try adjusting your search or filters'
                        : 'Get started by creating your first task'
                      }
                    </p>
                    <Button 
                      onClick={() => setIsCreateDialogOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Task
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                  {filteredTasks.map((task: any) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              )}
            </TabsContent>

            {Object.entries(groupedTasks).map(([status, statusTasks]) => (
              <TabsContent key={status} value={status} className="pt-4">
                {statusTasks.length === 0 ? (
                  <Card className="">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckSquare className="h-8 w-8 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No {status.replace('_', ' ')} tasks
                      </h3>
                      <p className="text-gray-500 text-center">
                        No tasks with {status.replace('_', ' ')} status found
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                    {statusTasks.map((task: any) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </div>
        </FinanceTabs>
      </div>
    </div>
  );
}
