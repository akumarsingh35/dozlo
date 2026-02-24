import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { R2AudioService } from './r2-audio.service';
import { ConnectivityService } from './connectivity.service';
import {
  OfflineDownloadEvaluation,
  OfflineDownloadPolicyService,
  OfflineStorageSnapshot,
} from './offline-download-policy.service';
import {
  OfflineDownloadRecord,
  OfflineDownloadStorageService,
} from './offline-download-storage.service';

export interface QueueOfflineDownloadRequest {
  storyId: string;
  title: string;
  r2Path: string;
  photoUrl?: string;
  durationSeconds?: number;
}

export interface QueueOfflineDownloadResult {
  accepted: boolean;
  message: string;
  warnings?: string[];
  downloadId?: string;
}

export interface OfflinePlaybackSource {
  record: OfflineDownloadRecord;
  blob: Blob;
}

class DownloadCancelledError extends Error {
  constructor() {
    super('Download cancelled');
  }
}

@Injectable({
  providedIn: 'root'
})
export class OfflineDownloadManagerService {
  private readonly downloadsSubject = new BehaviorSubject<OfflineDownloadRecord[]>([]);
  readonly downloads$ = this.downloadsSubject.asObservable();

  private readonly queue: string[] = [];
  private readonly cancelledIds = new Set<string>();
  private readonly deletedIds = new Set<string>();
  private isQueueRunning = false;
  private readonly cleanupIntervalMs = 15 * 60 * 1000;
  private readonly reconnectRetryDelayMs = 2000;
  private readonly maxChunkRetries = 3;
  private readonly maxReconnectWaitMs = 60000;
  private cleanupTimer: any = null;
  private maintenanceInitialized = false;
  private networkRecoveryInitialized = false;

  constructor(
    private readonly r2AudioService: R2AudioService,
    private readonly policyService: OfflineDownloadPolicyService,
    private readonly storageService: OfflineDownloadStorageService,
    private readonly connectivityService: ConnectivityService
  ) {
    void this.initializeMaintenance();
  }

  async initializeMaintenance(): Promise<void> {
    if (this.maintenanceInitialized) {
      return;
    }

    this.maintenanceInitialized = true;
    this.initializeNetworkRecovery();
    await this.recoverInterruptedDownloads();
    await this.backfillMissingDurationMetadata();
    await this.runAutoCleanup();
    await this.refreshDownloads();

    if (!this.cleanupTimer) {
      this.cleanupTimer = setInterval(() => {
        void this.runAutoCleanup();
      }, this.cleanupIntervalMs);
    }
  }

  async queueDownload(request: QueueOfflineDownloadRequest): Promise<QueueOfflineDownloadResult> {
    await this.initializeMaintenance();
    await this.runAutoCleanup();

    const normalizedStoryId = this.normalizeStoryId(request.storyId || request.title);
    if (!normalizedStoryId || !request.title || !request.r2Path) {
      return {
        accepted: false,
        message: 'Missing audio details for download.',
      };
    }

    const downloadId = normalizedStoryId;
    this.deletedIds.delete(downloadId);
    const existing = await this.storageService.getDownload(downloadId);
    if (existing && (existing.status === 'queued' || existing.status === 'downloading')) {
      return {
        accepted: true,
        message: 'Download already in progress.',
        downloadId,
      };
    }

    if (existing && existing.status === 'downloaded') {
      return {
        accepted: true,
        message: 'Audio already downloaded.',
        downloadId,
      };
    }

    const storage = await this.policyService.getStorageSnapshot();
    const fileSizeBytes = await this.resolveFileSizeBytes(request);
    if (fileSizeBytes <= 0) {
      return {
        accepted: false,
        message: 'Could not determine file size for download.',
      };
    }

    const currentOfflineBytes = await this.storageService.getTotalOfflineBytes();
    const currentDownloadCount = await this.storageService.getDownloadedCount();
    const evaluation = this.policyService.evaluateDownload({
      fileSizeBytes,
      currentOfflineBytes,
      currentDownloadCount,
      storage,
    });

    if (!evaluation.allowed) {
      return {
        accepted: false,
        message: evaluation.reason || 'Download blocked by device storage policy.',
        warnings: evaluation.warnings,
      };
    }

    const now = Date.now();
    const expiryMs = this.policyService.getExpiryMs();
    const chunkSizeBytes = evaluation.effectiveLimits.chunkSizeBytes;
    const chunkCount = Math.max(1, Math.ceil(fileSizeBytes / chunkSizeBytes));
    const resolvedDurationSeconds = this.resolveDurationSeconds(request.durationSeconds, fileSizeBytes);

    const record: OfflineDownloadRecord = {
      id: downloadId,
      storyId: normalizedStoryId,
      title: request.title,
      r2Path: request.r2Path,
      photoUrl: request.photoUrl,
      durationSeconds: resolvedDurationSeconds > 0 ? resolvedDurationSeconds : undefined,
      totalBytes: fileSizeBytes,
      downloadedBytes: 0,
      progress: 0,
      chunkSizeBytes,
      chunkCount,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      expiresAt: now + expiryMs,
      errorMessage: undefined,
    };

    await this.storageService.upsertDownload(record);
    await this.refreshDownloads();
    this.enqueue(downloadId);

    return {
      accepted: true,
      message: 'Download added to queue.',
      warnings: evaluation.warnings,
      downloadId,
    };
  }

  async cancelDownload(downloadId: string): Promise<void> {
    this.cancelledIds.add(downloadId);
    const queueIndex = this.queue.indexOf(downloadId);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
    }

    const record = await this.storageService.getDownload(downloadId);
    if (!record) {
      return;
    }

    if (record.status === 'queued' || record.status === 'downloading') {
      await this.storageService.clearChunks(downloadId);
      await this.storageService.upsertDownload({
        ...record,
        status: 'cancelled',
        downloadedBytes: 0,
        progress: 0,
        updatedAt: Date.now(),
        errorMessage: 'Cancelled by user',
      });
      await this.refreshDownloads();
    }
  }

  async deleteDownload(downloadId: string): Promise<void> {
    this.deletedIds.add(downloadId);
    await this.cancelDownload(downloadId);
    await this.storageService.deleteDownload(downloadId);
    await this.refreshDownloads();
  }

  async runAutoCleanup(): Promise<number> {
    const now = Date.now();
    const expiryMs = this.policyService.getExpiryMs();
    const records = await this.storageService.listDownloads();
    let deleted = 0;
    let updated = false;

    for (const record of records) {
      if (record.status !== 'downloaded') {
        continue;
      }

      const downloadedAt = record.downloadedAt && record.downloadedAt > 0 ? record.downloadedAt : record.updatedAt;
      const expectedExpiry = downloadedAt + expiryMs;
      const normalizedExpiresAt = record.expiresAt && record.expiresAt > 0 ? record.expiresAt : expectedExpiry;

      if (!record.expiresAt || record.expiresAt <= 0) {
        await this.storageService.upsertDownload({
          ...record,
          downloadedAt,
          expiresAt: normalizedExpiresAt,
          updatedAt: now,
        });
        updated = true;
      }

      if (normalizedExpiresAt <= now) {
        await this.storageService.deleteDownload(record.id);
        this.cancelledIds.delete(record.id);
        const queueIndex = this.queue.indexOf(record.id);
        if (queueIndex >= 0) {
          this.queue.splice(queueIndex, 1);
        }
        deleted += 1;
      }
    }

    if (deleted > 0 || updated) {
      await this.refreshDownloads();
    }

    if (deleted > 0) {
      console.log(`🧹 Offline cleanup removed ${deleted} expired download(s).`);
    }

    return deleted;
  }

  getDownloadByStoryId(storyId: string): OfflineDownloadRecord | null {
    const normalized = this.normalizeStoryId(storyId);
    if (!normalized) {
      return null;
    }
    return this.downloadsSubject.getValue().find((item) => item.storyId === normalized) || null;
  }

  async getOfflinePlaybackSource(storyId: string, title?: string): Promise<OfflinePlaybackSource | null> {
    await this.initializeMaintenance();

    const record = this.findDownloadedRecord(storyId, title);
    if (!record) {
      return null;
    }

    const blob = await this.storageService.getDownloadBlob(record.id, this.getAudioContentType(record.r2Path));
    if (!blob) {
      return null;
    }

    return { record, blob };
  }

  async refreshDownloads(): Promise<void> {
    const all = await this.storageService.listDownloads();
    this.downloadsSubject.next(all);
  }

  private enqueue(downloadId: string): void {
    if (!this.queue.includes(downloadId)) {
      this.queue.push(downloadId);
    }
    void this.runQueue();
  }

  private async runQueue(): Promise<void> {
    if (this.isQueueRunning) {
      return;
    }

    this.isQueueRunning = true;
    try {
      while (this.queue.length > 0) {
        const nextId = this.queue.shift();
        if (!nextId) {
          continue;
        }

        const record = await this.storageService.getDownload(nextId);
        if (!record || record.status !== 'queued') {
          continue;
        }

        await this.executeDownload(record);
      }
    } finally {
      this.isQueueRunning = false;
      await this.refreshDownloads();
    }
  }

  private async executeDownload(record: OfflineDownloadRecord): Promise<void> {
    if (this.deletedIds.has(record.id)) {
      return;
    }

    const startedAt = Date.now();
    let downloadedBytes = 0;

    try {
      await this.storageService.clearChunks(record.id);
      await this.upsertIfNotDeleted({
        ...record,
        status: 'downloading',
        downloadedBytes: 0,
        progress: 0,
        updatedAt: Date.now(),
        errorMessage: undefined,
      });
      await this.refreshDownloads();

      if (this.cancelledIds.has(record.id)) {
        throw new DownloadCancelledError();
      }

      // Main path: fixed-size range chunks for predictable memory usage.
      for (let chunkIndex = 0; chunkIndex < record.chunkCount; chunkIndex += 1) {
        if (this.cancelledIds.has(record.id)) {
          throw new DownloadCancelledError();
        }

        const start = chunkIndex * record.chunkSizeBytes;
        const end = Math.min(record.totalBytes - 1, start + record.chunkSizeBytes - 1);
        const blob = await this.downloadChunkWithRetry(record, start, end, chunkIndex);

        await this.storageService.putChunk(record.id, chunkIndex, blob);
        downloadedBytes += blob.size;

        const progress = Math.min(100, Math.floor((downloadedBytes / record.totalBytes) * 100));
        await this.upsertIfNotDeleted({
          ...record,
          status: 'downloading',
          downloadedBytes,
          progress,
          updatedAt: Date.now(),
          errorMessage: undefined,
        });
        await this.refreshDownloads();
      }

      if (this.cancelledIds.has(record.id)) {
        throw new DownloadCancelledError();
      }

      const now = Date.now();
      const expiryMs = this.policyService.getExpiryMs();
      await this.upsertIfNotDeleted({
        ...record,
        status: 'downloaded',
        downloadedBytes,
        progress: 100,
        updatedAt: now,
        downloadedAt: now,
        expiresAt: now + expiryMs,
        errorMessage: undefined,
      });
    } catch (error) {
      const isCancelled = error instanceof DownloadCancelledError;
      await this.storageService.clearChunks(record.id);
      if (!this.deletedIds.has(record.id)) {
        await this.storageService.upsertDownload({
          ...record,
          status: isCancelled ? 'cancelled' : 'failed',
          downloadedBytes: 0,
          progress: 0,
          updatedAt: Date.now(),
          errorMessage: isCancelled
            ? 'Cancelled by user'
            : this.getSafeErrorMessage(error),
        });
      }
    } finally {
      this.cancelledIds.delete(record.id);
      this.deletedIds.delete(record.id);
      const elapsedMs = Date.now() - startedAt;
      console.log(`📥 Offline download finished for ${record.title} in ${elapsedMs}ms`);
    }
  }

  private async downloadChunkWithRetry(
    record: OfflineDownloadRecord,
    start: number,
    end: number,
    chunkIndex: number
  ): Promise<Blob> {
    let attempt = 0;

    while (attempt < this.maxChunkRetries) {
      if (this.cancelledIds.has(record.id) || this.deletedIds.has(record.id)) {
        throw new DownloadCancelledError();
      }

      attempt += 1;
      try {
        return await firstValueFrom(this.r2AudioService.getAudioChunkBlob(record.r2Path, start, end));
      } catch (error) {
        if (this.cancelledIds.has(record.id) || this.deletedIds.has(record.id)) {
          throw new DownloadCancelledError();
        }

        const isOnline = await this.connectivityService.refreshStatus();
        const hasMoreRetries = attempt < this.maxChunkRetries;

        if (!isOnline) {
          const reconnected = await this.waitUntilOnline(this.maxReconnectWaitMs);
          if (!reconnected) {
            throw new Error('Download interrupted due to no internet connection.');
          }
        } else if (hasMoreRetries) {
          await this.delay(this.reconnectRetryDelayMs * attempt);
        }

        if (!hasMoreRetries) {
          throw error;
        }

        console.warn(
          `⚠️ Retrying chunk ${chunkIndex + 1}/${record.chunkCount} for "${record.title}" (attempt ${attempt + 1}/${this.maxChunkRetries})`
        );
      }
    }

    throw new Error('Failed to download audio chunk');
  }

  private async resolveFileSizeBytes(request: QueueOfflineDownloadRequest): Promise<number> {
    const remoteSize = await firstValueFrom(this.r2AudioService.getAudioFileSize(request.r2Path));
    if (remoteSize && remoteSize > 0) {
      return remoteSize;
    }

    return this.policyService.estimateAudioSizeBytes(request.durationSeconds ?? 0);
  }

  private normalizeStoryId(raw: string): string {
    const normalized = (raw || '').trim().toLowerCase().replace(/\s+/g, '_');
    return normalized;
  }

  private findDownloadedRecord(storyId: string, title?: string): OfflineDownloadRecord | null {
    const normalizedStoryId = this.normalizeStoryId(storyId);
    const normalizedTitle = this.normalizeStoryId(title || '');
    const records = this.downloadsSubject.getValue();

    const byStoryId = normalizedStoryId
      ? records.find((item) => item.storyId === normalizedStoryId && item.status === 'downloaded')
      : null;
    if (byStoryId) {
      return byStoryId;
    }

    if (!normalizedTitle) {
      return null;
    }

    return (
      records.find(
        (item) =>
          this.normalizeStoryId(item.title) === normalizedTitle &&
          item.status === 'downloaded'
      ) || null
    );
  }

  private getAudioContentType(r2Path: string): string {
    const lower = (r2Path || '').toLowerCase();
    if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
    if (lower.endsWith('.aac')) return 'audio/aac';
    if (lower.endsWith('.ogg') || lower.endsWith('.oga')) return 'audio/ogg';
    if (lower.endsWith('.opus')) return 'audio/opus';
    if (lower.endsWith('.wav')) return 'audio/wav';
    if (lower.endsWith('.flac')) return 'audio/flac';
    if (lower.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
    return 'audio/mpeg';
  }

  private async backfillMissingDurationMetadata(): Promise<void> {
    const records = await this.storageService.listDownloads();
    let updated = false;

    for (const record of records) {
      if (record.durationSeconds && record.durationSeconds > 0) {
        continue;
      }

      const estimatedDuration = this.policyService.estimateDurationSeconds(record.totalBytes);
      if (!(estimatedDuration > 0)) {
        continue;
      }

      await this.storageService.upsertDownload({
        ...record,
        durationSeconds: estimatedDuration,
      });
      updated = true;
    }

    if (updated) {
      await this.refreshDownloads();
    }
  }

  private resolveDurationSeconds(durationSeconds: number | undefined, fileSizeBytes: number): number {
    const provided = Number(durationSeconds || 0);
    if (Number.isFinite(provided) && provided > 0) {
      return Math.floor(provided);
    }

    return this.policyService.estimateDurationSeconds(fileSizeBytes);
  }

  private getSafeErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }
    return 'Download failed due to a network or storage error.';
  }

  private async upsertIfNotDeleted(record: OfflineDownloadRecord): Promise<void> {
    if (this.deletedIds.has(record.id)) {
      return;
    }
    await this.storageService.upsertDownload(record);
  }

  private initializeNetworkRecovery(): void {
    if (this.networkRecoveryInitialized) {
      return;
    }

    this.networkRecoveryInitialized = true;
    this.connectivityService.isOnline$.subscribe((online) => {
      if (!online) {
        return;
      }

      void this.retryFailedDownloadsAfterReconnect();
      void this.resumeQueuedDownloads();
    });
  }

  private async recoverInterruptedDownloads(): Promise<void> {
    const records = await this.storageService.listDownloads();
    let updated = false;

    for (const record of records) {
      if (record.status !== 'downloading') {
        continue;
      }

      await this.storageService.clearChunks(record.id);
      await this.storageService.upsertDownload({
        ...record,
        status: 'queued',
        downloadedBytes: 0,
        progress: 0,
        updatedAt: Date.now(),
        errorMessage: 'Resuming interrupted download',
      });
      updated = true;
    }

    if (updated) {
      await this.refreshDownloads();
      await this.resumeQueuedDownloads();
    }
  }

  private async retryFailedDownloadsAfterReconnect(): Promise<void> {
    const records = await this.storageService.listDownloads();
    const failedDownloads = records.filter((record) => record.status === 'failed');
    if (failedDownloads.length === 0) {
      return;
    }

    for (const record of failedDownloads) {
      await this.storageService.upsertDownload({
        ...record,
        status: 'queued',
        downloadedBytes: 0,
        progress: 0,
        updatedAt: Date.now(),
        errorMessage: undefined,
      });
      this.enqueue(record.id);
    }

    await this.refreshDownloads();
  }

  private async resumeQueuedDownloads(): Promise<void> {
    const records = await this.storageService.listDownloads();
    for (const record of records) {
      if (record.status === 'queued') {
        this.enqueue(record.id);
      }
    }
  }

  private waitUntilOnline(maxWaitMs: number): Promise<boolean> {
    if (this.connectivityService.isOnline) {
      return Promise.resolve(true);
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const timeoutHandle = setTimeout(() => {
        if (!settled) {
          settled = true;
          sub.unsubscribe();
          resolve(false);
        }
      }, maxWaitMs);

      const sub = this.connectivityService.isOnline$.subscribe((online) => {
        if (!online || settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutHandle);
        sub.unsubscribe();
        resolve(true);
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  // Exposed for diagnostics and future settings screen.
  async getPolicySnapshot(): Promise<{
    storage: OfflineStorageSnapshot;
    evaluation: OfflineDownloadEvaluation;
  }> {
    const storage = await this.policyService.getStorageSnapshot();
    const currentOfflineBytes = await this.storageService.getTotalOfflineBytes();
    const currentDownloadCount = await this.storageService.getDownloadedCount();
    const evaluation = this.policyService.evaluateDownload({
      fileSizeBytes: 1,
      currentOfflineBytes,
      currentDownloadCount,
      storage,
    });

    return { storage, evaluation };
  }
}
