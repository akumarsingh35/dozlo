import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { App } from '@capacitor/app';
import { BUILD_NUMBER } from '../version';

interface AndroidForceUpdateConfig {
  minSupportedVersionCode: number;
  latestVersionCode: number;
  latestVersionName: string;
  forceUpdate: boolean;
  title?: string;
  message?: string;
  storeUrl?: string;
}

interface ForceUpdateConfigDocument {
  schemaVersion: number;
  enabled: boolean;
  android?: AndroidForceUpdateConfig;
}

export interface ForceUpdateCheckResult {
  isRequired: boolean;
  title: string;
  message: string;
  storeUrl: string;
  currentVersionCode: number;
  minSupportedVersionCode: number;
  latestVersionCode: number;
  latestVersionName: string;
}

@Injectable({
  providedIn: 'root',
})
export class ForceUpdateService {
  private readonly collectionId = 'app_config';
  private readonly documentId = 'force_update';
  private readonly cacheKey = 'dozlo_force_update_config_v1';
  private readonly defaultStoreUrl = 'https://play.google.com/store/apps/details?id=com.dozlo.app';

  constructor(private readonly firestore: Firestore) {}

  async checkForUpdate(): Promise<ForceUpdateCheckResult> {
    const currentVersionCode = await this.getCurrentVersionCode();
    const config = await this.loadConfigWithFallback();
    const android = config?.android;

    if (!config?.enabled || !android?.forceUpdate) {
      return {
        isRequired: false,
        title: 'Update available',
        message: 'A new version is available.',
        storeUrl: this.defaultStoreUrl,
        currentVersionCode,
        minSupportedVersionCode: 0,
        latestVersionCode: 0,
        latestVersionName: '',
      };
    }

    const minSupportedVersionCode = this.toVersionCode(android.minSupportedVersionCode);
    const latestVersionCode = this.toVersionCode(android.latestVersionCode);
    const latestVersionName = (android.latestVersionName || '').trim();

    return {
      isRequired: currentVersionCode > 0 && currentVersionCode < minSupportedVersionCode,
      title: android.title?.trim() || 'Update required',
      message: android.message?.trim() || 'Please update Dozlo to continue.',
      storeUrl: android.storeUrl?.trim() || this.defaultStoreUrl,
      currentVersionCode,
      minSupportedVersionCode,
      latestVersionCode,
      latestVersionName,
    };
  }

  private async loadConfigWithFallback(): Promise<ForceUpdateConfigDocument | null> {
    try {
      const forceUpdateRef = doc(this.firestore, this.collectionId, this.documentId);
      const snapshot = await getDoc(forceUpdateRef);
      if (!snapshot.exists()) {
        return this.getCachedConfig();
      }

      const parsed = this.parseConfig(snapshot.data());
      if (parsed) {
        this.cacheConfig(parsed);
      }
      return parsed ?? this.getCachedConfig();
    } catch (error) {
      console.error('❌ Failed to fetch force-update config:', error);
      return this.getCachedConfig();
    }
  }

  private parseConfig(raw: any): ForceUpdateConfigDocument | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const androidRaw = raw.android;
    const parsed: ForceUpdateConfigDocument = {
      schemaVersion: Number(raw.schemaVersion) || 1,
      enabled: Boolean(raw.enabled),
    };

    if (androidRaw && typeof androidRaw === 'object') {
      parsed.android = {
        minSupportedVersionCode: this.toVersionCode(androidRaw.minSupportedVersionCode),
        latestVersionCode: this.toVersionCode(androidRaw.latestVersionCode),
        latestVersionName: String(androidRaw.latestVersionName || '').trim(),
        forceUpdate: Boolean(androidRaw.forceUpdate),
        title: typeof androidRaw.title === 'string' ? androidRaw.title : undefined,
        message: typeof androidRaw.message === 'string' ? androidRaw.message : undefined,
        storeUrl: typeof androidRaw.storeUrl === 'string' ? androidRaw.storeUrl : undefined,
      };
    }

    return parsed;
  }

  private cacheConfig(config: ForceUpdateConfigDocument): void {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(config));
    } catch {
      // Ignore localStorage errors.
    }
  }

  private getCachedConfig(): ForceUpdateConfigDocument | null {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      return this.parseConfig(parsed);
    } catch {
      return null;
    }
  }

  private async getCurrentVersionCode(): Promise<number> {
    try {
      const info = await App.getInfo();
      const nativeBuildNumber = this.toVersionCode(info.build);
      if (nativeBuildNumber > 0) {
        return nativeBuildNumber;
      }
    } catch {
      // Fallback to static build number for web and unexpected native errors.
    }

    return this.toVersionCode(BUILD_NUMBER);
  }

  private toVersionCode(value: unknown): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
}
