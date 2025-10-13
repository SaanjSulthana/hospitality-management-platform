import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TaskCard, Task } from '@/components/ui/task-card';
import { 
  Plus, 
  AlertCircle, 
  CheckCircle, 
  Play,
  Flag
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Task interface is now imported from task-card component

interface KanbanBoardProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onCreateTask: (status: Task['status']) => void;
  onTaskClick?: (task: Task) => void;
  onTaskEdit?: (task: Task) => void;
  onTaskDelete?: (task: Task) => void;
  className?: string;
  theme?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
  };
}

const statusConfig = {
  open: {
    title: 'Open',
    color: 'bg-gray-100 text-gray-800',
    borderColor: 'border-gray-300',
    icon: Plus,
    count: 0
  },
  progress: {
    title: 'In Progress',
    color: 'bg-blue-100 text-blue-800',
    borderColor: 'border-blue-300',
    icon: Play,
    count: 0
  },
  blocked: {
    title: 'Blocked',
    color: 'bg-red-100 text-red-800',
    borderColor: 'border-red-300',
    icon: AlertCircle,
    count: 0
  },
  done: {
    title: 'Done',
    color: 'bg-green-100 text-green-800',
    borderColor: 'border-green-300',
    icon: CheckCircle,
    count: 0
  }
};

const priorityConfig = {
  low: { color: 'bg-gray-100 text-gray-700', icon: Flag },
  medium: { color: 'bg-yellow-100 text-yellow-700', icon: Flag },
  high: { color: 'bg-orange-100 text-orange-700', icon: Flag },
  urgent: { color: 'bg-red-100 text-red-700', icon: Flag }
};

export function KanbanBoard({ 
  tasks, 
  onTaskUpdate, 
  onCreateTask, 
  onTaskClick,
  onTaskEdit,
  onTaskDelete,
  className,
  theme
}: KanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  // Group tasks by status
  const tasksByStatus = tasks.reduce((acc, task) => {
    if (!acc[task.status]) {
      acc[task.status] = [];
    }
    acc[task.status].push(task);
    return acc;
  }, {} as Record<Task['status'], Task[]>);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    console.log('Drag started for task:', task);
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
    e.dataTransfer.setData('application/json', JSON.stringify(task));
  };

  const handleDragOver = (e: React.DragEvent, status: Task['status']) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
    console.log('Drag over status:', status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, newStatus: Task['status']) => {
    e.preventDefault();
    console.log('Drop event triggered for status:', newStatus);
    console.log('Dragged task:', draggedTask);
    
    if (draggedTask && draggedTask.status !== newStatus) {
      console.log('Updating task status from', draggedTask.status, 'to', newStatus);
      onTaskUpdate(draggedTask.id, { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } else {
      console.log('No status change needed or no dragged task');
    }
    
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0) return `In ${diffDays} days`;
    return `${Math.abs(diffDays)} days ago`;
  };

  const getPriorityColor = (priority: Task['priority']) => {
    return priorityConfig[priority]?.color || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className={cn("w-full h-full overflow-x-auto", className)}>
      <div className="flex gap-6 min-w-max p-6">
        {Object.entries(statusConfig).map(([status, config]) => {
          const statusTasks = tasksByStatus[status as Task['status']] || [];
          const Icon = config.icon;
          
          return (
            <div
              key={status}
              className="flex flex-col w-80"
              onDragOver={(e) => handleDragOver(e, status as Task['status'])}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status as Task['status'])}
            >
              {/* Column Header */}
              <div className={cn(
                "flex items-center justify-between p-4 rounded-t-lg border-2 border-b-0",
                config.borderColor,
                dragOverColumn === status && "ring-2 ring-blue-500 ring-opacity-50"
              )}>
                <div className="flex items-center gap-2">
                  <div className={cn("p-2 rounded-lg", config.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{config.title}</h3>
                  <Badge variant="secondary" className="ml-2">
                    {statusTasks.length}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCreateTask(status as Task['status'])}
                  className="h-8 w-8 p-0 hover:bg-gray-200"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Column Content */}
              <div className={cn(
                "flex-1 min-h-[400px] p-4 border-2 border-t-0 rounded-b-lg bg-gray-50",
                config.borderColor,
                dragOverColumn === status && "bg-blue-50"
              )}>
                <div className="space-y-3">
                  {statusTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onClick={() => onTaskClick?.(task)}
                      onEdit={onTaskEdit}
                      onDelete={onTaskDelete}
                      isDraggable={true}
                      showActions={true}
                      theme={theme}
                    />
                  ))}
                  
                  {statusTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                      <Icon className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">No tasks in {config.title.toLowerCase()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// TaskCard is now imported from the separate task-card component
