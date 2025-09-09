export type TaskType = 'maintenance' | 'housekeeping' | 'service';
export type TaskPriority = 'low' | 'med' | 'high';
export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done';

export interface Task {
  id: number;
  orgId: number;
  propertyId: number;
  type: TaskType;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeStaffId?: number;
  dueAt?: Date;
  createdByUserId: number;
  createdAt: Date;
  updatedAt: Date;
  referenceImages?: TaskImage[];
}

export interface TaskImage {
  id: number;
  taskId: number;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  isPrimary: boolean;
  createdAt: Date;
}
