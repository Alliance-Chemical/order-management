/**
 * Offline-capable inspection queue
 * Handles network failures gracefully and queues operations for retry
 */

interface QueuedOperation {
  id: string;
  type: 'inspection_result' | 'qr_scan' | 'activity_log';
  orderId: string;
  data: any;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
}

class InspectionQueue {
  private queue: QueuedOperation[] = [];
  private processing = false;
  private readonly storageKey = 'inspection_queue';
  private readonly maxRetries = 3;
  private retryTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor() {
    this.loadQueue();
    this.startProcessing();
    
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.startProcessing());
      window.addEventListener('offline', () => this.pauseProcessing());
    }
  }

  /**
   * Add operation to queue
   */
  enqueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount' | 'maxRetries'>): void {
    const queuedOp: QueuedOperation = {
      ...operation,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: this.maxRetries
    };

    this.queue.push(queuedOp);
    this.saveQueue();
    
    // Try to process immediately if online
    if (this.isOnline()) {
      this.processQueue();
    }
  }

  /**
   * Process queued operations
   */
  private async processQueue(): Promise<void> {
    if (this.processing || !this.isOnline() || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.isOnline()) {
      const operation = this.queue[0];
      
      try {
        await this.processOperation(operation);
        
        // Success - remove from queue
        this.queue.shift();
        this.saveQueue();
        
        // Clear retry timeout if exists
        const timeout = this.retryTimeouts.get(operation.id);
        if (timeout) {
          clearTimeout(timeout);
          this.retryTimeouts.delete(operation.id);
        }
      } catch (error) {
        console.error('Failed to process operation:', error);
        
        // Increment retry count
        operation.retryCount++;
        
        if (operation.retryCount >= operation.maxRetries) {
          // Max retries reached - move to failed operations
          this.moveToFailed(operation);
          this.queue.shift();
        } else {
          // Schedule retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, operation.retryCount), 30000);
          this.scheduleRetry(operation, delay);
          
          // Move to end of queue
          this.queue.shift();
          this.queue.push(operation);
        }
        
        this.saveQueue();
        
        // Stop processing on error to avoid rapid failures
        break;
      }
    }

    this.processing = false;

    // Continue processing if there are more items
    if (this.queue.length > 0 && this.isOnline()) {
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  /**
   * Process a single operation
   */
  private async processOperation(operation: QueuedOperation): Promise<void> {
    const endpoint = this.getEndpoint(operation);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Offline-Queue': 'true',
        'X-Operation-Id': operation.id
      },
      body: JSON.stringify({
        ...operation.data,
        queuedAt: operation.timestamp,
        processedAt: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to process operation: ${response.status}`);
    }
  }

  /**
   * Get API endpoint for operation type
   */
  private getEndpoint(operation: QueuedOperation): string {
    switch (operation.type) {
      case 'inspection_result':
        return `/api/workspace/${operation.orderId}/inspection`;
      case 'qr_scan':
        return `/api/qr/scan`;
      case 'activity_log':
        return `/api/workspace/${operation.orderId}/activity`;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Schedule retry for failed operation
   */
  private scheduleRetry(operation: QueuedOperation, delay: number): void {
    const timeout = setTimeout(() => {
      this.processQueue();
      this.retryTimeouts.delete(operation.id);
    }, delay);
    
    this.retryTimeouts.set(operation.id, timeout);
  }

  /**
   * Move operation to failed storage
   */
  private moveToFailed(operation: QueuedOperation): void {
    const failedKey = 'inspection_queue_failed';
    const failed = (this.loadFromStorage(failedKey) || []) as any[];
    failed.push({
      ...operation,
      failedAt: new Date().toISOString()
    });
    this.saveToStorage(failedKey, failed);
  }

  /**
   * Start processing queue
   */
  private startProcessing(): void {
    this.processQueue();
  }

  /**
   * Pause processing when offline
   */
  private pauseProcessing(): void {
    this.processing = false;
  }

  /**
   * Check if online
   */
  private isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  /**
   * Load queue from storage
   */
  private loadQueue(): void {
    this.queue = this.loadFromStorage(this.storageKey) || [];
  }

  /**
   * Save queue to storage
   */
  private saveQueue(): void {
    this.saveToStorage(this.storageKey, this.queue);
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(key: string): any {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to load from storage:', error);
      return null;
    }
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(key: string, data: any): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to storage:', error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue status
   */
  getStatus(): {
    online: boolean;
    queueLength: number;
    processing: boolean;
    failedCount: number;
  } {
    const failed = this.loadFromStorage('inspection_queue_failed') || [];
    return {
      online: this.isOnline(),
      queueLength: this.queue.length,
      processing: this.processing,
      failedCount: failed.length
    };
  }

  /**
   * Clear all queued operations
   */
  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
    
    // Clear all retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
  }

  /**
   * Retry failed operations
   */
  retryFailed(): void {
    const failedKey = 'inspection_queue_failed';
    const failed = (this.loadFromStorage(failedKey) || []) as any[];
    
    // Re-queue failed operations
    failed.forEach((op: any) => {
      this.enqueue({
        type: op.type,
        orderId: op.orderId,
        data: op.data
      });
    });
    
    // Clear failed storage
    this.saveToStorage(failedKey, []);
    
    // Start processing
    this.processQueue();
  }
}

// Export singleton instance
export const inspectionQueue = new InspectionQueue();