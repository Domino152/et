import { Injectable, EventEmitter } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import { DriveService, UploadPayload } from './drive.service';
import { BackendService, ReceiptData } from './backend.service';
import { AuthService } from './auth.service';

export type QueueItemStatus = 'pending' | 'uploading' | 'failed' | 'completed';

export interface QueueItem {
  id: string;
  drivePayload: UploadPayload;
  metaPayload: ReceiptData;

  status: QueueItemStatus;
  retryCount: number;
  lastAttempt?: string;
  errorMessage?: string;
}

@Injectable({ providedIn: 'root' })
export class SyncQueueService {
  private readonly QUEUE_KEY = 'costtrack_sync_queue';
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY_MS = 2000; // 2s base for exponential backoff
  private isProcessing = false;
  public syncCompleted = new EventEmitter<void>();


  constructor(
    private driveService: DriveService,
    private backendService: BackendService,
    private authService: AuthService
  ) {
    this.initNetworkListener();
  }

  private async initNetworkListener(): Promise<void> {
    Network.addListener('networkStatusChange', status => {
      if (status.connected) {
        console.log('[SyncQueue] Network restored, processing queue...');
        this.processQueue();
      }
    });

    const status = await Network.getStatus();
    if (status.connected) {
      this.processQueue();
    }
  }

  // ── Enqueue ──────────────────────────────────────────────────────────────────

  async enqueue(item: Omit<QueueItem, 'status' | 'retryCount'>): Promise<void> {
    const queue = await this.getQueue();
    const newItem: QueueItem = { ...item, status: 'pending', retryCount: 0 };
    queue.push(newItem);
    await this.setQueue(queue);
    this.processQueue();
  }

  // ── Process ──────────────────────────────────────────────────────────────────

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    const networkStatus = await Network.getStatus();
    if (!networkStatus.connected) return;

    this.isProcessing = true;
    try {
      let queue = await this.getQueue();
      const pending = queue.filter(i => i.status === 'pending' || i.status === 'failed');

      for (const item of pending) {
        // Exponential backoff: wait before retrying failed items
        if (item.status === 'failed' && item.retryCount > 0) {
          const delay = this.BASE_DELAY_MS * Math.pow(2, item.retryCount - 1);
          const lastAttempt = item.lastAttempt ? new Date(item.lastAttempt).getTime() : 0;
          const elapsed = Date.now() - lastAttempt;
          if (elapsed < delay) continue; // Not ready yet
        }

        // Mark as uploading
        await this.updateItemStatus(item.id, 'uploading');

        try {
          await this.authService.getAccessToken();

          // 1. Upload to Drive (SKIP if already uploaded during instant phase)
          let finalImageUrl = item.metaPayload.imageUrl;
          
          if (!finalImageUrl) {
            console.log(`[SyncQueue] Uploading ${item.id} to Drive...`);
            const driveRes = await this.driveService.uploadFile(item.drivePayload);
            finalImageUrl = driveRes.webViewLink;
          } else {
            console.log(`[SyncQueue] Using existing Drive URL for ${item.id}`);
          }

          // 2. Save to Backend
          const finalMeta: ReceiptData = {
            ...item.metaPayload,
            imageUrl: finalImageUrl
          };
          await this.backendService.saveReceipt(finalMeta);


          // Mark completed and remove from queue
          await this.removeFromQueue(item.id);
          console.log(`[SyncQueue] Item ${item.id} completed.`);

        } catch (err: any) {
          console.error(`[SyncQueue] Item ${item.id} failed (attempt ${item.retryCount + 1}):`, err);

          const currentQueue = await this.getQueue();
          const idx = currentQueue.findIndex(q => q.id === item.id);
          if (idx !== -1) {
            currentQueue[idx].retryCount += 1;
            currentQueue[idx].lastAttempt = new Date().toISOString();
            currentQueue[idx].errorMessage = err?.message ?? 'Unknown error';
            currentQueue[idx].status = currentQueue[idx].retryCount >= this.MAX_RETRIES
              ? 'failed'
              : 'pending';
            await this.setQueue(currentQueue);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  async getQueue(): Promise<QueueItem[]> {
    const { value } = await Preferences.get({ key: this.QUEUE_KEY });
    if (!value) return [];
    try { return JSON.parse(value); } catch { return []; }
  }

  private async setQueue(queue: QueueItem[]): Promise<void> {
    await Preferences.set({ key: this.QUEUE_KEY, value: JSON.stringify(queue) });
  }

  private async updateItemStatus(id: string, status: QueueItemStatus): Promise<void> {
    const queue = await this.getQueue();
    const idx = queue.findIndex(q => q.id === id);
    if (idx !== -1) {
      queue[idx].status = status;
      await this.setQueue(queue);
    }
  }

  private async removeFromQueue(id: string): Promise<void> {
    const queue = await this.getQueue();
    await this.setQueue(queue.filter(q => q.id !== id));
    this.syncCompleted.emit();
  }


  async getPendingCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.filter(i => i.status === 'pending' || i.status === 'uploading').length;
  }

  async getFailedCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.filter(i => i.status === 'failed').length;
  }

  /** Retry all items that permanently failed (maxed retries) */
  async retryFailed(): Promise<void> {
    const queue = await this.getQueue();
    for (const item of queue) {
      if (item.status === 'failed') {
        item.status = 'pending';
        item.retryCount = 0;
        item.errorMessage = undefined;
      }
    }
    await this.setQueue(queue);
    this.processQueue();
  }
}
