import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useStandardQuery } from '../../src/utils/api-standardizer';
import { TaskImageUpload } from './task-image-upload';
import { Plus, Loader2 } from 'lucide-react';
import { formatDateTimeForAPI } from '@/lib/date-utils';

interface CreateTaskDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialStatus?: 'open' | 'progress' | 'blocked' | 'done';
  onTaskCreated?: (task: any) => void;
  trigger?: React.ReactNode;
}

export function CreateTaskDialog({ 
  isOpen, 
  onOpenChange, 
  initialStatus = 'open',
  onTaskCreated,
  trigger 
}: CreateTaskDialogProps) {
  const { getAuthenticatedBackend } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
  const [taskImages, setTaskImages] = useState<any[]>([]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
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
      setTaskImages([]);
    }
  }, [isOpen]);

  // Fetch properties
  const { data: properties } = useStandardQuery(
    ['properties'],
    '/properties',
    {
      staleTime: 30000,
      gcTime: 300000,
    }
  );

  // Load staff options for selected property
  const { data: createStaffOptions, isLoading: isCreateStaffLoading } = useStandardQuery(
    ['staff', 'by-property', taskForm.propertyId || 'none'],
    `/staff?propertyId=${taskForm.propertyId}`,
    {
      enabled: !!taskForm.propertyId,
    }
  );

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      console.log('Creating task with data:', taskData);
      
      const backend = getAuthenticatedBackend();
      const newTask = await backend.tasks.create({
        propertyId: parseInt(taskData.propertyId),
        type: taskData.type,
        title: taskData.title,
        description: taskData.description || undefined,
        priority: taskData.priority,
        dueAt: taskData.dueAt ? formatDateTimeForAPI(taskData.dueAt) : undefined,
        estimatedHours: taskData.estimatedHours ? parseFloat(taskData.estimatedHours) : undefined,
        assigneeStaffId: taskData.assigneeStaffId && taskData.assigneeStaffId !== 'none' ? parseInt(taskData.assigneeStaffId) : undefined,
      });
      
      // Upload images if any
      if (taskImages.length > 0) {
        const files = taskImages.map(img => img.file);
        // Note: In a real implementation, you would upload images here
        console.log('Images to upload:', files);
      }
      
      return newTask;
    },
    onSuccess: (data: any) => {
      console.log('Task creation successful:', data);
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onOpenChange(false);
      setTaskImages([]);
      
      // Call the callback if provided
      if (onTaskCreated) {
        onTaskCreated(data);
      }
      
      toast({
        title: "Task created",
        description: "The task has been created successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Task creation failed:', error);
      toast({
        variant: "destructive",
        title: "Failed to create task",
        description: error.message || "Please try again.",
      });
    },
  });

  const handleCreateTask = async () => {
    if (!taskForm.propertyId || !taskForm.title) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in the required fields.",
      });
      return;
    }
    
    const taskData = {
      propertyId: parseInt(taskForm.propertyId),
      type: taskForm.type,
      title: taskForm.title,
      description: taskForm.description || undefined,
      priority: taskForm.priority,
      dueAt: taskForm.dueAt ? formatDateTimeForAPI(taskForm.dueAt) : undefined,
      estimatedHours: taskForm.estimatedHours ? parseFloat(taskForm.estimatedHours) : undefined,
      assigneeStaffId: taskForm.assigneeStaffId && taskForm.assigneeStaffId !== 'none' ? parseInt(taskForm.assigneeStaffId) : undefined,
    };
    
    try {
      await createTaskMutation.mutateAsync(taskData);
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const dialogContent = (
    <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
      <DialogHeader className="pb-4">
        <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
            <Plus className="h-5 w-5 text-blue-600" />
          </div>
          Create New Task
        </DialogTitle>
        <DialogDescription className="text-sm text-gray-600">
          Create a new task for your property operations
        </DialogDescription>
      </DialogHeader>
      <div className="flex-1 overflow-y-auto px-1">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="property" className="text-sm font-medium text-gray-700">Property *</Label>
            <Select value={taskForm.propertyId} onValueChange={(value) => setTaskForm(prev => ({ ...prev, propertyId: value, assigneeStaffId: 'none' }))}>
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

          {/* Assignee */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Assignee</Label>
            <Select
              value={taskForm.assigneeStaffId}
              onValueChange={(value) => setTaskForm(prev => ({ ...prev, assigneeStaffId: value }))}
              disabled={!taskForm.propertyId || isCreateStaffLoading}
            >
              <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type" className="text-sm font-medium text-gray-700">Type</Label>
              <Select value={taskForm.type} onValueChange={(value: any) => setTaskForm(prev => ({ ...prev, type: value }))}>
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
              <Label htmlFor="priority" className="text-sm font-medium text-gray-700">Priority</Label>
              <Select value={taskForm.priority} onValueChange={(value: any) => setTaskForm(prev => ({ ...prev, priority: value }))}>
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
            <Label htmlFor="title" className="text-sm font-medium text-gray-700">Title *</Label>
            <Input
              id="title"
              value={taskForm.title}
              onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter task title"
              className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-gray-700">Description</Label>
            <Textarea
              id="description"
              value={taskForm.description}
              onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter task description"
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueAt" className="text-sm font-medium text-gray-700">Due Date</Label>
              <Input
                id="dueAt"
                type="datetime-local"
                value={taskForm.dueAt}
                onChange={(e) => setTaskForm(prev => ({ ...prev, dueAt: e.target.value }))}
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedHours" className="text-sm font-medium text-gray-700">Estimated Hours</Label>
              <Input
                id="estimatedHours"
                type="number"
                step="0.5"
                value={taskForm.estimatedHours}
                onChange={(e) => setTaskForm(prev => ({ ...prev, estimatedHours: e.target.value }))}
                placeholder="0"
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
          
          {/* Reference Images Upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Reference Images</Label>
            <TaskImageUpload
              taskId={0} // Placeholder for create dialog
              existingImages={[]}
              onImageUpload={async (taskId, files) => {
                // Convert files to ImageFile format for create dialog
                const imageFiles = files.map(file => ({
                  id: Math.random().toString(36).substr(2, 9),
                  file,
                  preview: URL.createObjectURL(file),
                }));
                setTaskImages(imageFiles);
              }}
              onImageDelete={async () => {
                // Not applicable for create dialog
              }}
              maxImages={5}
              maxSize={5}
              disabled={createTaskMutation.isPending}
              className="!space-y-2"
            />
          </div>
        </div>
      </div>
      <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateTask}
            disabled={createTaskMutation.isPending || !taskForm.propertyId || !taskForm.title}
            className="bg-blue-600 hover:bg-blue-700"
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
        </div>
      </DialogFooter>
    </DialogContent>
  );

  if (trigger) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {dialogContent}
    </Dialog>
  );
}
