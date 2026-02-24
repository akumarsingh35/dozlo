import { Injectable } from '@angular/core';

export interface OfflineStorageSnapshot {
  quotaBytes: number | null;
  usageBytes: number | null;
  availableBytes: number | null;
  source: 'navigator.storage' | 'fallback';
}

export interface OfflineDownloadLimits {
  expiryHours: number;
  chunkSizeBytes: number;
  maxConcurrentDownloads: number;
  maxDownloadCount: number;
  maxSingleFileBytes: number;
  maxOfflineLibraryBytes: number;
  minFreeSpaceAfterDownloadBytes: number;
}

export interface OfflineDownloadEvaluationInput {
  fileSizeBytes: number;
  currentOfflineBytes: number;
  currentDownloadCount: number;
  storage: OfflineStorageSnapshot;
}

export interface OfflineDownloadEvaluation {
  allowed: boolean;
  reason?: string;
  warnings: string[];
  effectiveLimits: OfflineDownloadLimits;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineDownloadPolicyService {
  // UX limits tuned for MVP: safe on low-end devices, still friendly for long audio.
  private readonly baseLimits: OfflineDownloadLimits = {
    // TEST MODE: 2 hours expiry. Change to 240 for 10 days at release time.
    expiryHours: 2,
    chunkSizeBytes: 4 * 1024 * 1024, // 4MB chunks: avoids memory spikes on old devices
    maxConcurrentDownloads: 1, // predictable on low-RAM phones
    maxDownloadCount: 120,
    maxSingleFileBytes: 600 * 1024 * 1024, // supports very long audio
    maxOfflineLibraryBytes: 2 * 1024 * 1024 * 1024, // 2GB total cap
    minFreeSpaceAfterDownloadBytes: 700 * 1024 * 1024, // keep headroom for system + app stability
  };

  private readonly defaultAudioBitrateKbps = 96;

  getBaseLimits(): OfflineDownloadLimits {
    return { ...this.baseLimits };
  }

  getExpiryMs(): number {
    const hours = Math.max(1, this.baseLimits.expiryHours);
    return hours * 60 * 60 * 1000;
  }

  async getStorageSnapshot(): Promise<OfflineStorageSnapshot> {
    try {
      if (!navigator.storage?.estimate) {
        return {
          quotaBytes: null,
          usageBytes: null,
          availableBytes: null,
          source: 'fallback',
        };
      }

      const estimate = await navigator.storage.estimate();
      const quotaBytes = typeof estimate.quota === 'number' ? Math.max(0, estimate.quota) : null;
      const usageBytes = typeof estimate.usage === 'number' ? Math.max(0, estimate.usage) : null;
      const availableBytes =
        quotaBytes !== null && usageBytes !== null ? Math.max(0, quotaBytes - usageBytes) : null;

      return {
        quotaBytes,
        usageBytes,
        availableBytes,
        source: 'navigator.storage',
      };
    } catch {
      return {
        quotaBytes: null,
        usageBytes: null,
        availableBytes: null,
        source: 'fallback',
      };
    }
  }

  estimateAudioSizeBytes(durationSeconds: number, bitrateKbps = this.defaultAudioBitrateKbps): number {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      // Conservative fallback for unknown duration.
      return 40 * 1024 * 1024;
    }

    const safeBitrate = Math.min(192, Math.max(48, Math.floor(bitrateKbps)));
    const bytes = (durationSeconds * safeBitrate * 1000) / 8;
    return Math.max(1, Math.floor(bytes));
  }

  estimateDurationSeconds(fileSizeBytes: number, bitrateKbps = this.defaultAudioBitrateKbps): number {
    if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
      return 0;
    }

    const safeBitrate = Math.min(192, Math.max(48, Math.floor(bitrateKbps)));
    const seconds = (fileSizeBytes * 8) / (safeBitrate * 1000);
    return Math.max(1, Math.floor(seconds));
  }

  evaluateDownload(input: OfflineDownloadEvaluationInput): OfflineDownloadEvaluation {
    const warnings: string[] = [];
    const effectiveLimits = this.getEffectiveLimits(input.storage);
    const fileSize = Math.max(0, Math.floor(input.fileSizeBytes));
    const currentOfflineBytes = Math.max(0, Math.floor(input.currentOfflineBytes));
    const currentDownloadCount = Math.max(0, Math.floor(input.currentDownloadCount));

    if (fileSize <= 0) {
      return {
        allowed: false,
        reason: 'Could not determine audio file size.',
        warnings,
        effectiveLimits,
      };
    }

    if (fileSize > effectiveLimits.maxSingleFileBytes) {
      return {
        allowed: false,
        reason: `File is too large (${this.formatBytes(fileSize)}). Maximum allowed is ${this.formatBytes(
          effectiveLimits.maxSingleFileBytes
        )}.`,
        warnings,
        effectiveLimits,
      };
    }

    if (currentDownloadCount >= effectiveLimits.maxDownloadCount) {
      return {
        allowed: false,
        reason: `Offline library limit reached (${effectiveLimits.maxDownloadCount} downloads).`,
        warnings,
        effectiveLimits,
      };
    }

    if (currentOfflineBytes + fileSize > effectiveLimits.maxOfflineLibraryBytes) {
      return {
        allowed: false,
        reason: `Offline storage cap reached (${this.formatBytes(effectiveLimits.maxOfflineLibraryBytes)}).`,
        warnings,
        effectiveLimits,
      };
    }

    if (input.storage.availableBytes !== null) {
      const remainingAfterDownload = input.storage.availableBytes - fileSize;
      if (remainingAfterDownload < effectiveLimits.minFreeSpaceAfterDownloadBytes) {
        return {
          allowed: false,
          reason: `Not enough free space. Keep at least ${this.formatBytes(
            effectiveLimits.minFreeSpaceAfterDownloadBytes
          )} free after download.`,
          warnings,
          effectiveLimits,
        };
      }

      if (remainingAfterDownload < effectiveLimits.minFreeSpaceAfterDownloadBytes * 1.5) {
        warnings.push('Storage is getting low. Older downloads may be auto-cleaned soon.');
      }
    } else {
      warnings.push('Device free-space estimate unavailable. Using safe fallback limits.');
    }

    if (fileSize >= 250 * 1024 * 1024) {
      warnings.push('Large download detected. Keep the app open until it completes.');
    }

    return {
      allowed: true,
      warnings,
      effectiveLimits,
    };
  }

  formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let index = 0;

    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }

    const precision = value >= 100 || index === 0 ? 0 : 1;
    return `${value.toFixed(precision)} ${units[index]}`;
  }

  private getEffectiveLimits(storage: OfflineStorageSnapshot): OfflineDownloadLimits {
    const limits = { ...this.baseLimits };

    if (storage.availableBytes !== null) {
      // Dynamic cap: allow up to 40% of currently available space, clamped to safe bounds.
      const dynamicLibraryCap = Math.floor(storage.availableBytes * 0.4);
      const minCap = 400 * 1024 * 1024;
      const maxCap = this.baseLimits.maxOfflineLibraryBytes;
      limits.maxOfflineLibraryBytes = Math.max(minCap, Math.min(maxCap, dynamicLibraryCap));
    }

    if (storage.quotaBytes !== null) {
      // Keep at least 8% of quota free to avoid OS-level storage pressure.
      const quotaReserve = Math.floor(storage.quotaBytes * 0.08);
      limits.minFreeSpaceAfterDownloadBytes = Math.max(
        this.baseLimits.minFreeSpaceAfterDownloadBytes,
        quotaReserve
      );
    }

    return limits;
  }
}
