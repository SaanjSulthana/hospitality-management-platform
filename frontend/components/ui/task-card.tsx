import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MoreHorizontal, 
  Calendar, 
  User, 
  Flag,
  Clock,
  AlertCircle,
  CheckCircle,
  Play,
  Edit,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'progress' | 'blocked' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
  dueDate?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  type?: 'maintenance' | 'housekeeping' | 'service';
  estimatedHours?: number;
  referenceImages?: Array<{
    id: string;
    url: string;
  }>;
  propertyId?: number;
  propertyName?: string;
  assigneeStaffId?: number;
}

interface TaskCardProps {
  task: Task;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  onDragEnd?: () => void;
  onClick?: () => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: Task['status']) => void;
  onAssigneeChange?: (taskId: string, assigneeId: string | null) => void;
  showActions?: boolean;
  isDraggable?: boolean;
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
    icon: Flag,
  },
  progress: {
    title: 'In Progress',
    color: 'bg-blue-100 text-blue-800',
    borderColor: 'border-blue-300',
    icon: Play,
  },
  blocked: {
    title: 'Blocked',
    color: 'bg-red-100 text-red-800',
    borderColor: 'border-red-300',
    icon: AlertCircle,
  },
  done: {
    title: 'Done',
    color: 'bg-green-100 text-green-800',
    borderColor: 'border-green-300',
    icon: CheckCircle,
  }
};

const priorityConfig = {
  low: { 
    color: 'bg-gray-100 text-gray-700 border-gray-200', 
    icon: Flag,
    label: 'Low'
  },
  medium: { 
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200', 
    icon: Flag,
    label: 'Medium'
  },
  high: { 
    color: 'bg-orange-100 text-orange-700 border-orange-200', 
    icon: Flag,
    label: 'High'
  },
  urgent: { 
    color: 'bg-red-100 text-red-700 border-red-200', 
    icon: Flag,
    label: 'Urgent'
  }
};

const typeConfig = {
  maintenance: { icon: '🔧', label: 'Maintenance' },
  housekeeping: { icon: '🧹', label: 'Housekeeping' },
  service: { icon: '🛎️', label: 'Service' },
};

// Helper function to convert hex to RGB values
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Helper function to create theme-aware styles
const getThemeStyles = (theme?: TaskCardProps['theme']) => {
  if (!theme) {
    return {
      primaryBg: 'bg-orange-100',
      primaryText: 'text-orange-800',
      primaryBorder: 'border-orange-200',
      primaryLight: 'bg-orange-50',
      primaryMedium: 'bg-orange-200',
    };
  }

  const primaryRgb = hexToRgb(theme.primaryColor);
  const accentRgb = hexToRgb(theme.accentColor);
  
  if (!primaryRgb || !accentRgb) {
    return {
      primaryBg: 'bg-orange-100',
      primaryText: 'text-orange-800',
      primaryBorder: 'border-orange-200',
      primaryLight: 'bg-orange-50',
      primaryMedium: 'bg-orange-200',
    };
  }

  return {
    primaryBg: `bg-[${theme.primaryColor}]`,
    primaryText: `text-[${theme.primaryColor}]`,
    primaryBorder: `border-[${theme.primaryColor}]`,
    primaryLight: `bg-[${theme.primaryColor}20]`, // 20% opacity
    primaryMedium: `bg-[${theme.primaryColor}40]`, // 40% opacity
    accentBg: `bg-[${theme.accentColor}]`,
    accentText: `text-[${theme.accentColor}]`,
    accentBorder: `border-[${theme.accentColor}]`,
    accentLight: `bg-[${theme.accentColor}20]`,
    accentMedium: `bg-[${theme.accentColor}40]`,
  };
};

export function TaskCard({ 
  task, 
  onDragStart, 
  onDragEnd, 
  onClick,
  onEdit,
  onDelete,
  onStatusChange,
  onAssigneeChange,
  showActions = true,
  isDraggable = true,
  className,
  theme
}: TaskCardProps) {
  const themeStyles = getThemeStyles(theme);
  
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

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && task.status !== 'done';
  };

  const getPriorityConfig = (priority: Task['priority']) => {
    return priorityConfig[priority] || priorityConfig.medium;
  };

  const getStatusConfig = (status: Task['status']) => {
    return statusConfig[status] || statusConfig.open;
  };

  const getTypeConfig = (type?: string) => {
    if (!type) return { icon: '📋', label: 'Task' };
    return typeConfig[type as keyof typeof typeConfig] || { icon: '📋', label: 'Task' };
  };

  const priority = getPriorityConfig(task.priority);
  const status = getStatusConfig(task.status);
  const type = getTypeConfig(task.type);

  return (
    <Card
      draggable={isDraggable}
      onDragStart={onDragStart ? (e) => {
        console.log('TaskCard drag start:', task);
        onDragStart(e, task);
      } : undefined}
      onDragEnd={onDragEnd ? () => {
        console.log('TaskCard drag end:', task);
        onDragEnd();
      } : undefined}
      onClick={onClick}
      className={cn(
        "cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group",
        "shadow-md border-0 bg-white/90 backdrop-blur-sm",
        "hover:bg-white hover:shadow-2xl hover:border-gray-200",
        "rounded-xl overflow-hidden",
        task.dueDate && isOverdue(task.dueDate) && task.status !== 'done' ? 'border-red-200 bg-red-50/90' : '',
        className
      )}
    >
      <CardHeader className="pb-4 bg-gradient-to-r from-gray-50/50 to-white/50">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xl font-bold text-gray-900 leading-tight break-words group-hover:text-gray-800 transition-colors duration-200">
                  {task.title}
                </CardTitle>
                <div className={cn("text-sm mt-1 font-medium", themeStyles.primaryText)}>
                  {type.label}
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Priority Badge */}
                <Badge className={cn("text-xs px-3 py-1.5 border-0 shadow-sm font-semibold", priority.color)}>
                  {priority.label}
                </Badge>
                
                {/* Action Buttons */}
                {showActions && (
                  <div className="flex items-center gap-1">
                    {onEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(task);
                        }}
                        className="h-8 w-8 p-0 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 rounded-lg shadow-sm"
                        title="Edit task"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(task);
                        }}
                        className="h-8 w-8 p-0 bg-white border-gray-300 text-red-600 hover:bg-red-50 hover:border-red-400 transition-all duration-200 rounded-lg shadow-sm"
                        title="Delete task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-4">
        {/* Description */}
        {task.description && (
          <div className="space-y-1 -mt-2">
            <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
              {task.description}
            </p>
          </div>
        )}

        {/* Reference Images Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ImageIcon className={cn("h-4 w-4", themeStyles.primaryText)} />
            <span className={cn("text-sm font-semibold", themeStyles.primaryText)}>Reference Images</span>
          </div>
          
          {/* Image Upload Area */}
          <div className={cn("border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 group-hover:border-opacity-60 group-hover:bg-opacity-50", themeStyles.primaryBorder, themeStyles.primaryLight)}>
            <div className="flex flex-col items-center gap-3">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-sm", themeStyles.primaryLight)}>
                <ImageIcon className={cn("h-6 w-6", themeStyles.primaryText)} />
              </div>
              <div className={cn("text-sm font-medium", themeStyles.primaryText)}>
                <span>Click to add images</span>
              </div>
            </div>
          </div>
        </div>

        {/* Task Details - Due Date Only */}
        {task.dueDate && (
          <div className={cn("flex items-center gap-2 text-sm", themeStyles.primaryText)}>
            <Calendar className={cn("h-4 w-4 flex-shrink-0", themeStyles.primaryText)} />
            <span className={cn(
              "break-words min-w-0 font-medium",
              isOverdue(task.dueDate) && task.status !== 'done' ? 'text-red-600' : ''
            )}>
              {formatDate(task.dueDate)}
            </span>
            {isOverdue(task.dueDate) && task.status !== 'done' && (
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            )}
          </div>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className={cn("text-xs px-2 py-1", themeStyles.primaryBorder, themeStyles.primaryText)}>
                {tag}
              </Badge>
            ))}
            {task.tags.length > 3 && (
              <Badge variant="outline" className={cn("text-xs px-2 py-1", themeStyles.primaryBorder, themeStyles.primaryText)}>
                +{task.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Status and Assignee Controls */}
        <div className={cn("space-y-4 pt-4 border-t bg-gradient-to-r from-gray-50/30 to-transparent", themeStyles.primaryBorder)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Status Control */}
            <div className="space-y-2">
              <label className={cn("text-xs font-semibold uppercase tracking-wide", themeStyles.primaryText)}>Status</label>
              <div className="flex items-center gap-2">
                <div className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm", status.color)}>
                  {status.title}
                </div>
                {onStatusChange && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Cycle through statuses
                      const statuses: Task['status'][] = ['open', 'progress', 'blocked', 'done'];
                      const currentIndex = statuses.indexOf(task.status);
                      const nextIndex = (currentIndex + 1) % statuses.length;
                      onStatusChange(task.id, statuses[nextIndex]);
                    }}
                    className="h-6 px-2 text-xs"
                  >
                    Change
                  </Button>
                )}
              </div>
            </div>

            {/* Assignee Control */}
            <div className="space-y-2">
              <label className={cn("text-xs font-semibold uppercase tracking-wide", themeStyles.primaryText)}>Assignee</label>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 ring-2 ring-white shadow-sm">
                  <AvatarImage src={task.assignee?.avatar} />
                  <AvatarFallback className="text-xs font-semibold bg-gray-100">
                    {task.assignee?.name.split(' ').map(n => n[0]).join('') || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-gray-700 truncate">
                  {task.assignee?.name || 'Unassigned'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Estimated Hours */}
        {task.estimatedHours !== undefined && (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50/50 rounded-lg px-3 py-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="font-medium">Est. {task.estimatedHours}h</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to get priority color (exported for use in other components)
export function getPriorityColor(priority: Task['priority']) {
  const config = priorityConfig[priority] || priorityConfig.medium;
  return config.color;
}

// Helper function to format date (exported for use in other components)
export function formatTaskDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}
