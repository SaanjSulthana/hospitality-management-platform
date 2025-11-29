// Bulkhead Pattern - Phase 3 Advanced Scaling
// Target: Resource isolation for production reliability (1M+ organizations)

// Bulkhead Interfaces
export interface BulkheadConfig {
  maxConcurrent: number;
  queueSize: number;
  timeout: number; // milliseconds
  priority: boolean; // Enable priority queuing
}

export interface BulkheadStats {
  activeTasks: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  averageWaitTime: number;
  throughput: number; // tasks per second
}

export interface Task {
  id: string;
  priority: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

// Bulkhead Class
export class Bulkhead {
  private name: string;
  private config: BulkheadConfig;
  private activeTasks: Set<string> = new Set();
  private taskQueue: Task[] = [];
  private completedTasks: Map<string, Task> = new Map();
  private stats = {
    activeTasks: 0,
    queuedTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageExecutionTime: 0,
    averageWaitTime: 0,
    throughput: 0
  };
  private executionTimes: number[] = [];
  private waitTimes: number[] = [];
  private startTime = Date.now();

  constructor(name: string, config: BulkheadConfig) {
    this.name = name;
    this.config = config;
    console.log(`[Bulkhead:${name}] Initialized with config:`, config);
  }

  // Execute Task
  async execute<T>(fn: () => Promise<T>, priority: number = 0): Promise<T> {
    return new Promise((resolve, reject) => {
      const taskId = this.generateTaskId();
      const task: Task = {
        id: taskId,
        priority,
        createdAt: Date.now(),
        fn,
        resolve,
        reject
      };

      // Check if we can execute immediately
      if (this.activeTasks.size < this.config.maxConcurrent) {
        this.executeTask(task);
      } else {
        // Check if queue has space
        if (this.taskQueue.length >= this.config.queueSize) {
          reject(new Error(`Bulkhead ${this.name} queue is full`));
          return;
        }

        // Add to queue
        this.addToQueue(task);
      }
    });
  }

  // Execute Task
  private async executeTask(task: Task): Promise<void> {
    this.activeTasks.add(task.id);
    this.stats.activeTasks = this.activeTasks.size;
    task.startedAt = Date.now();

    try {
      const result = await this.executeWithTimeout(task.fn, this.config.timeout);
      
      task.completedAt = Date.now();
      this.recordTaskCompletion(task);
      
      task.resolve(result);
    } catch (error) {
      task.completedAt = Date.now();
      this.recordTaskFailure(task);
      
      task.reject(error as Error);
    } finally {
      this.activeTasks.delete(task.id);
      this.stats.activeTasks = this.activeTasks.size;
      
      // Process next task in queue
      this.processQueue();
    }
  }

  // Execute with Timeout
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Bulkhead ${this.name} task timeout after ${timeout}ms`));
      }, timeout);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  // Add to Queue
  private addToQueue(task: Task): void {
    if (this.config.priority) {
      // Insert based on priority (higher priority first)
      const insertIndex = this.taskQueue.findIndex(t => t.priority < task.priority);
      if (insertIndex === -1) {
        this.taskQueue.push(task);
      } else {
        this.taskQueue.splice(insertIndex, 0, task);
      }
    } else {
      this.taskQueue.push(task);
    }

    this.stats.queuedTasks = this.taskQueue.length;
    console.log(`[Bulkhead:${this.name}] Task ${task.id} queued (priority: ${task.priority})`);
  }

  // Process Queue
  private processQueue(): void {
    while (this.activeTasks.size < this.config.maxConcurrent && this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!;
      this.stats.queuedTasks = this.taskQueue.length;
      this.executeTask(task);
    }
  }

  // Record Task Completion
  private recordTaskCompletion(task: Task): void {
    this.stats.completedTasks++;
    this.completedTasks.set(task.id, task);
    
    const executionTime = task.completedAt! - task.startedAt!;
    const waitTime = task.startedAt! - task.createdAt;
    
    this.executionTimes.push(executionTime);
    this.waitTimes.push(waitTime);
    
    // Keep only last 1000 times
    if (this.executionTimes.length > 1000) {
      this.executionTimes.shift();
    }
    if (this.waitTimes.length > 1000) {
      this.waitTimes.shift();
    }
    
    this.updateStats();
    console.log(`[Bulkhead:${this.name}] Task ${task.id} completed in ${executionTime}ms`);
  }

  // Record Task Failure
  private recordTaskFailure(task: Task): void {
    this.stats.failedTasks++;
    this.completedTasks.set(task.id, task);
    
    const executionTime = task.completedAt! - task.startedAt!;
    const waitTime = task.startedAt! - task.createdAt;
    
    this.executionTimes.push(executionTime);
    this.waitTimes.push(waitTime);
    
    this.updateStats();
    console.log(`[Bulkhead:${this.name}] Task ${task.id} failed after ${executionTime}ms`);
  }

  // Update Statistics
  private updateStats(): void {
    if (this.executionTimes.length > 0) {
      this.stats.averageExecutionTime = this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length;
    }
    
    if (this.waitTimes.length > 0) {
      this.stats.averageWaitTime = this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length;
    }
    
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.stats.throughput = this.stats.completedTasks / elapsed;
  }

  // Generate Task ID
  private generateTaskId(): string {
    return `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get Statistics
  getStats(): BulkheadStats {
    return {
      activeTasks: this.stats.activeTasks,
      queuedTasks: this.stats.queuedTasks,
      completedTasks: this.stats.completedTasks,
      failedTasks: this.stats.failedTasks,
      averageExecutionTime: this.stats.averageExecutionTime,
      averageWaitTime: this.stats.averageWaitTime,
      throughput: this.stats.throughput
    };
  }

  // Get Queue Status
  getQueueStatus(): {
    active: number;
    queued: number;
    maxConcurrent: number;
    queueSize: number;
    utilization: number;
  } {
    return {
      active: this.activeTasks.size,
      queued: this.taskQueue.length,
      maxConcurrent: this.config.maxConcurrent,
      queueSize: this.config.queueSize,
      utilization: this.activeTasks.size / this.config.maxConcurrent
    };
  }

  // Get Task by ID
  getTask(taskId: string): Task | undefined {
    return this.completedTasks.get(taskId);
  }

  // Get Active Tasks
  getActiveTasks(): string[] {
    return Array.from(this.activeTasks);
  }

  // Get Queued Tasks
  getQueuedTasks(): Task[] {
    return [...this.taskQueue];
  }

  // Clear Queue
  clearQueue(): void {
    const queuedTasks = this.taskQueue.length;
    this.taskQueue.forEach(task => {
      task.reject(new Error(`Bulkhead ${this.name} queue cleared`));
    });
    this.taskQueue = [];
    this.stats.queuedTasks = 0;
    console.log(`[Bulkhead:${this.name}] Cleared ${queuedTasks} queued tasks`);
  }

  // Reset Statistics
  resetStats(): void {
    this.stats = {
      activeTasks: 0,
      queuedTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageExecutionTime: 0,
      averageWaitTime: 0,
      throughput: 0
    };
    this.executionTimes = [];
    this.waitTimes = [];
    this.completedTasks.clear();
    this.startTime = Date.now();
    console.log(`[Bulkhead:${this.name}] Statistics reset`);
  }

  // Update Configuration
  updateConfig(config: Partial<BulkheadConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`[Bulkhead:${this.name}] Configuration updated:`, this.config);
  }

  // Is Full
  isFull(): boolean {
    return this.activeTasks.size >= this.config.maxConcurrent && this.taskQueue.length >= this.config.queueSize;
  }

  // Is Empty
  isEmpty(): boolean {
    return this.activeTasks.size === 0 && this.taskQueue.length === 0;
  }
}

// Bulkhead Manager
export class BulkheadManager {
  private bulkheads: Map<string, Bulkhead> = new Map();
  private defaultConfig: BulkheadConfig = {
    maxConcurrent: 10,
    queueSize: 100,
    timeout: 30000, // 30 seconds
    priority: false
  };

  // Create Bulkhead
  createBulkhead(name: string, config?: Partial<BulkheadConfig>): Bulkhead {
    const finalConfig = { ...this.defaultConfig, ...config };
    const bulkhead = new Bulkhead(name, finalConfig);
    this.bulkheads.set(name, bulkhead);
    return bulkhead;
  }

  // Get Bulkhead
  getBulkhead(name: string): Bulkhead | undefined {
    return this.bulkheads.get(name);
  }

  // Get All Bulkheads
  getAllBulkheads(): Map<string, Bulkhead> {
    return new Map(this.bulkheads);
  }

  // Get All Statistics
  getAllStats(): { [name: string]: BulkheadStats } {
    const stats: { [name: string]: BulkheadStats } = {};
    for (const [name, bulkhead] of this.bulkheads) {
      stats[name] = bulkhead.getStats();
    }
    return stats;
  }

  // Reset All Statistics
  resetAllStats(): void {
    for (const bulkhead of this.bulkheads.values()) {
      bulkhead.resetStats();
    }
    console.log('[BulkheadManager] All statistics reset');
  }

  // Get Health Status
  getHealthStatus(): {
    healthy: number;
    unhealthy: number;
    total: number;
    details: { [name: string]: { utilization: number; queueSize: number } };
  } {
    let healthy = 0;
    let unhealthy = 0;
    const details: { [name: string]: { utilization: number; queueSize: number } } = {};

    for (const [name, bulkhead] of this.bulkheads) {
      const queueStatus = bulkhead.getQueueStatus();
      details[name] = {
        utilization: queueStatus.utilization,
        queueSize: queueStatus.queued
      };
      
      // Consider unhealthy if utilization > 90% or queue size > 80% of capacity
      if (queueStatus.utilization > 0.9 || queueStatus.queued > queueStatus.queueSize * 0.8) {
        unhealthy++;
      } else {
        healthy++;
      }
    }

    return {
      healthy,
      unhealthy,
      total: this.bulkheads.size,
      details
    };
  }
}

// Global bulkhead manager
export const bulkheadManager = new BulkheadManager();

// Pre-configured bulkheads for common services
export const financeBulkhead = bulkheadManager.createBulkhead('finance', {
  maxConcurrent: 50,
  queueSize: 500,
  timeout: 10000,
  priority: true
});

export const reportsBulkhead = bulkheadManager.createBulkhead('reports', {
  maxConcurrent: 20,
  queueSize: 200,
  timeout: 30000,
  priority: true
});

export const cacheBulkhead = bulkheadManager.createBulkhead('cache', {
  maxConcurrent: 100,
  queueSize: 1000,
  timeout: 5000,
  priority: false
});

export const eventsBulkhead = bulkheadManager.createBulkhead('events', {
  maxConcurrent: 30,
  queueSize: 300,
  timeout: 15000,
  priority: true
});

// Utility function for easy bulkhead execution
export async function withBulkhead<T>(
  fn: () => Promise<T>,
  bulkheadName: string = 'default',
  priority: number = 0,
  config?: Partial<BulkheadConfig>
): Promise<T> {
  let bulkhead = bulkheadManager.getBulkhead(bulkheadName);
  
  if (!bulkhead) {
    bulkhead = bulkheadManager.createBulkhead(bulkheadName, config);
  }
  
  return await bulkhead.execute(fn, priority);
}
