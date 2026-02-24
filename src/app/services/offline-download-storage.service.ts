import { Injectable } from '@angular/core';

export type OfflineDownloadStatus =
  | 'queued'
  | 'downloading'
  | 'downloaded'
  | 'failed'
  | 'cancelled';

export interface OfflineDownloadRecord {
  id: string;
  storyId: string;
  title: string;
  r2Path: string;
  photoUrl?: string;
  durationSeconds?: number;
  totalBytes: number;
  downloadedBytes: number;
  progress: number;
  chunkSizeBytes: number;
  chunkCount: number;
  status: OfflineDownloadStatus;
  createdAt: number;
  updatedAt: number;
  downloadedAt?: number;
  expiresAt?: number;
  errorMessage?: string;
}

interface OfflineChunkRecord {
  key: string;
  downloadId: string;
  chunkIndex: number;
  bytes: number;
  blob: Blob;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineDownloadStorageService {
  private readonly dbName = 'dozlo_offline_downloads';
  private readonly dbVersion = 1;
  private readonly downloadsStore = 'downloads';
  private readonly chunksStore = 'chunks';
  private dbPromise: Promise<IDBDatabase> | null = null;

  async listDownloads(): Promise<OfflineDownloadRecord[]> {
    const db = await this.openDb();
    const tx = db.transaction(this.downloadsStore, 'readonly');
    const store = tx.objectStore(this.downloadsStore);
    const request = store.getAll();
    const result = await this.waitForRequest<OfflineDownloadRecord[]>(request);
    return (result ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getDownload(id: string): Promise<OfflineDownloadRecord | null> {
    const db = await this.openDb();
    const tx = db.transaction(this.downloadsStore, 'readonly');
    const store = tx.objectStore(this.downloadsStore);
    const request = store.get(id);
    const result = await this.waitForRequest<OfflineDownloadRecord | undefined>(request);
    return result ?? null;
  }

  async upsertDownload(record: OfflineDownloadRecord): Promise<void> {
    const db = await this.openDb();
    const tx = db.transaction(this.downloadsStore, 'readwrite');
    const store = tx.objectStore(this.downloadsStore);
    store.put(record);
    await this.waitForTransaction(tx);
  }

  async deleteDownload(downloadId: string): Promise<void> {
    const db = await this.openDb();
    const tx = db.transaction([this.downloadsStore, this.chunksStore], 'readwrite');
    tx.objectStore(this.downloadsStore).delete(downloadId);

    const chunksStore = tx.objectStore(this.chunksStore);
    const index = chunksStore.index('downloadId');
    const cursorRequest = index.openCursor(IDBKeyRange.only(downloadId));
    await this.deleteMatchingChunks(cursorRequest);

    await this.waitForTransaction(tx);
  }

  async clearChunks(downloadId: string): Promise<void> {
    const db = await this.openDb();
    const tx = db.transaction(this.chunksStore, 'readwrite');
    const chunksStore = tx.objectStore(this.chunksStore);
    const index = chunksStore.index('downloadId');
    const cursorRequest = index.openCursor(IDBKeyRange.only(downloadId));
    await this.deleteMatchingChunks(cursorRequest);
    await this.waitForTransaction(tx);
  }

  async putChunk(downloadId: string, chunkIndex: number, blob: Blob): Promise<void> {
    const db = await this.openDb();
    const tx = db.transaction(this.chunksStore, 'readwrite');
    const store = tx.objectStore(this.chunksStore);

    const record: OfflineChunkRecord = {
      key: this.getChunkKey(downloadId, chunkIndex),
      downloadId,
      chunkIndex,
      bytes: blob.size,
      blob,
    };

    store.put(record);
    await this.waitForTransaction(tx);
  }

  async getDownloadBlob(downloadId: string, preferredContentType?: string): Promise<Blob | null> {
    const db = await this.openDb();
    const tx = db.transaction(this.chunksStore, 'readonly');
    const chunksStore = tx.objectStore(this.chunksStore);
    const index = chunksStore.index('downloadId');
    const request = index.getAll(IDBKeyRange.only(downloadId));
    const chunks = await this.waitForRequest<OfflineChunkRecord[]>(request);

    if (!chunks || chunks.length === 0) {
      return null;
    }

    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
    const blobs = chunks
      .map((item) => item.blob)
      .filter((item): item is Blob => item instanceof Blob && item.size > 0);

    if (blobs.length === 0) {
      return null;
    }

    const inferredType = blobs.find((item) => item.type && item.type.trim().length > 0)?.type;
    const contentType = preferredContentType || inferredType || 'audio/mpeg';
    return new Blob(blobs, { type: contentType });
  }

  async getTotalOfflineBytes(): Promise<number> {
    const downloads = await this.listDownloads();
    return downloads
      .filter((item) => item.status === 'downloaded' || item.status === 'downloading' || item.status === 'queued')
      .reduce((sum, item) => sum + Math.max(0, item.downloadedBytes), 0);
  }

  async getDownloadedCount(): Promise<number> {
    const downloads = await this.listDownloads();
    return downloads.filter((item) => item.status === 'downloaded').length;
  }

  private async openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(request.error ?? new Error('Failed to open offline download DB'));
      };

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(this.downloadsStore)) {
          db.createObjectStore(this.downloadsStore, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(this.chunksStore)) {
          const chunksStore = db.createObjectStore(this.chunksStore, { keyPath: 'key' });
          chunksStore.createIndex('downloadId', 'downloadId', { unique: false });
          chunksStore.createIndex('downloadId_chunkIndex', ['downloadId', 'chunkIndex'], {
            unique: true,
          });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });

    return this.dbPromise;
  }

  private getChunkKey(downloadId: string, chunkIndex: number): string {
    return `${downloadId}:${chunkIndex}`;
  }

  private async deleteMatchingChunks(
    cursorRequest: IDBRequest<IDBCursorWithValue | null>
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      cursorRequest.onerror = () => {
        reject(cursorRequest.error ?? new Error('Failed to iterate chunk records'));
      };

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve();
          return;
        }

        cursor.delete();
        cursor.continue();
      };
    });
  }

  private waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
  }

  private waitForTransaction(tx: IDBTransaction): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  }
}
