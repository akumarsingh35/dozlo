import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { R2AudioService } from './r2-audio.service';
import { AmbientAudioService } from './ambient-audio.service';
import { LibraryDataService } from './library-data.service';
import { AudioPlayer } from '@mediagrid/capacitor-native-audio';
import { Capacitor } from '@capacitor/core';
import { AnalyticsService } from './analytics.service';

export interface AudioState {
  isPlaying: boolean;
  currentTrack: AudioTrack | null;
  progress: number;
  duration: number;
  isLoading: boolean;
  loadingTrackId: string;
  currentTime: number;
}

export interface AudioTrack {
  audioUrl: string;
  title: string;
  photoUrl: string;
  description: string;
  r2Path?: string;
  storyId?: string;
  duration?: number;
}

export interface PlayRequest {
  storyId: string;
  title: string;
  r2Path: string;
  photoUrl?: string;
  description?: string;
  resumePosition?: number;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class GlobalAudioPlayerService {
  private audioState = new BehaviorSubject<AudioState>({
    isPlaying: false,
    currentTrack: null,
    progress: 0,
    duration: 0,
    isLoading: false,
    loadingTrackId: '',
    currentTime: 0
  });

  audioState$ = this.audioState.asObservable();

  private currentRequestId: string = '';
  private isProcessingRequest = false;
  private lastRequestTime = 0;
  private requestThrottleDelay = 500;
  private consecutiveFailures = 0;
  private isNetworkError = false;
  private isSlowNetwork = false;
  private slowNetworkThrottleDelay = 2000;

  private progressInterval: any = null;
  private stallWatchInterval: any = null;
  private lastProgressAt = 0;
  private stallThresholdMs = 15000;
  private isProgressUpdating = false;

  private seekLock = false;
  private activeSeekController: AbortController | null = null;
  private seekToken = 0;
  private seekDebounceTimer: any = null;
  private pendingSeekTime: number | null = null;

  private currentPlaySub: Subscription | null = null;
  private currentPrefetchSub: Subscription | null = null;
  private playToken = 0;
  private lastPlayStartAt = 0;
  private nativeAudioId = 'primary';
  private nativeCreated = false;
  private nativeReady = false;
  private nativeListenersRegistered = false;
  private lastTrack: AudioTrack | null = null;
  private seekResetTimer: any = null;
  private seekVerifyTimer: any = null;
  private seekInProgress = false;
  private pendingResumeAfterSeek: boolean | null = null;
  private readonly debugAudioSync = false;

  constructor(
    private r2AudioService: R2AudioService,
    private ambientAudioService: AmbientAudioService,
    private libraryDataService: LibraryDataService,
    private analytics: AnalyticsService
  ) {
    this.setupNetworkMonitoring();
    this.setupAndroidAudioSession();
  }

  private setupAndroidAudioSession(): void {}

  playFromCard(request: PlayRequest): Promise<boolean> {
    return this.playAudioFromAnyPage(request);
  }

  playAudioFromAnyPage(request: PlayRequest): Promise<boolean> {
    return new Promise((resolve) => {
      const requestId = `play_${request.storyId}_${Date.now()}`;
      this.setLoading(true, request.storyId);
      this.isProcessingRequest = true;
      this.currentRequestId = requestId;

      // Cancel any inflight URL retrieval and active seeks
      this.currentPlaySub?.unsubscribe();
      this.currentPlaySub = null;
      this.cancelActiveSeek();
      this.seekToken++;
      this.stopCurrentAudio();
      this.ambientAudioService.onMainAudioSwitch();
      this.updateTrackImmediately(request);

      const myPlayToken = ++this.playToken;
      this.currentPlaySub = this.r2AudioService.getAudioUrlWithAutoRefresh(request.r2Path).pipe(
        finalize(() => {
          this.isProcessingRequest = false;
          this.currentRequestId = '';
        })
      ).subscribe({
        next: (audioUrl) => {
          if (myPlayToken !== this.playToken) { resolve(false); return; }
          // Warm initial bytes and metadata for faster start
          if (request.r2Path) {
            this.r2AudioService.prefetchStartChunk(request.r2Path).subscribe();
            this.r2AudioService.preloadAudioMetadata(request.r2Path).subscribe({ next: () => {}, error: () => {} });
          }
          this.lastPlayStartAt = Date.now();
          this.startNativePlayback(audioUrl, request, myPlayToken)
            .then(() => resolve(true))
            .catch(() => resolve(false));
        },
        error: (err) => {
          this.handleNetworkError(request.storyId, err.message);
          this.setLoading(false, request.storyId);
          resolve(false);
        }
      });
    });
  }

  getCurrentState(): Observable<AudioState> {
    return this.audioState$;
  }

  public isTrackLoading(trackId: string): boolean {
    const state = this.audioState.getValue();
    return state.isLoading && state.loadingTrackId === trackId;
  }

  setLoading(isLoading: boolean, trackId: string) {
    this.updateState({ isLoading: isLoading, loadingTrackId: isLoading ? trackId : '' });
  }

  private debugLog(message: string, data?: any): void {
    if (!this.debugAudioSync) return;
    if (typeof data === 'undefined') {
      console.log(`🎯 [AUDIO_SYNC] ${message}`);
      return;
    }
    console.log(`🎯 [AUDIO_SYNC] ${message}`, data);
  }

  play() {
    this.resumeNativePlayback();
  }

  pause() {
    this.pauseNativePlayback();
  }

  stop() {
    this.stopCurrentAudio();
    this.updateState({ isPlaying: false, currentTrack: null, progress: 0, duration: 0 });
    this.r2AudioService.stopRollingRefresh();
    // Log audio_stop event (manual stop)
    const track = this.audioState.getValue().currentTrack;
    if (track) {
      this.analytics.logAudioStop(
        track.storyId || track.audioUrl || '',
        track.title || '',
        this.audioState.getValue().currentTime || 0
      );
    }
  }

  async seekTo(time: number): Promise<void> {
    console.warn(`🎯 [AUDIO_SYNC] seekTo called time=${time} lock=${this.seekLock} inProgress=${this.seekInProgress}`);
    if (typeof time !== 'number') {
      return;
    }

    // Debounce rapid seek calls; only last request is executed
    if (this.seekLock) {
      this.pendingSeekTime = time;
      this.schedulePendingSeek();
      return;
    }
    if (this.seekDebounceTimer) {
      this.pendingSeekTime = time;
      return;
    }
    this.pendingSeekTime = time;
    this.seekDebounceTimer = setTimeout(() => {
      const next = this.pendingSeekTime;
      this.pendingSeekTime = null;
      this.seekDebounceTimer = null;
      console.warn(`🎯 [AUDIO_SYNC] seek debounce fired next=${next}`);
      if (typeof next === 'number') {
        this.performSeek(next);
      }
    }, 120);
  }

  private schedulePendingSeek(): void {
    if (this.seekDebounceTimer) return;
    this.seekDebounceTimer = setTimeout(() => {
      const next = this.pendingSeekTime;
      this.pendingSeekTime = null;
      this.seekDebounceTimer = null;
      if (typeof next === 'number') {
        this.performSeek(next);
      }
    }, 150);
  }

  private async performSeek(time: number): Promise<void> {
    console.warn(`🎯 [AUDIO_SYNC] performSeek start time=${time} lock=${this.seekLock}`);
    if (this.seekLock || typeof time !== 'number') {
      return;
    }

    this.seekLock = true;
    this.seekInProgress = true;
    this.stopProgressTracking();
    const startedTrackId = this.audioState.getValue().currentTrack?.storyId || '';
    if (startedTrackId) { this.setLoading(true, startedTrackId); }
    this.ambientAudioService.onMainAudioSeek();
    this.cancelActiveSeek();
    this.activeSeekController = new AbortController();
    const signal = this.activeSeekController.signal;
    const myToken = ++this.seekToken;

    try {
      if (this.seekResetTimer) { clearTimeout(this.seekResetTimer); this.seekResetTimer = null; }
      this.seekResetTimer = setTimeout(() => {
        if (myToken === this.seekToken) {
          if (startedTrackId) { this.setLoading(false, startedTrackId); }
          this.seekLock = false;
          this.seekInProgress = false;
        }
      }, 9000);

      // Do not block seek for long on nativeReady; long streams can report
      // ready late while still being seekable.
      try {
        await Promise.race([
          this.waitForNativeReady(signal),
          new Promise<void>((resolve) => setTimeout(resolve, 600)),
        ]);
      } catch {}
      if (signal.aborted) return;
      this.debugLog('Seek proceeding after readiness gate', { nativeReady: this.nativeReady });

      let duration = this.audioState.getValue().duration || 0;
      if (!duration) {
        duration = await this.getNativeDuration();
        if (duration) {
          this.updateState({ duration });
        }
      }
      const canClampToDuration = typeof duration === 'number' && duration > 0;
      const seekTime = canClampToDuration
        ? Math.max(0, Math.min(time, duration))
        : Math.max(0, time);
      this.debugLog('Seek requested', {
        requestedTime: time,
        seekTime,
        duration,
        canClampToDuration,
      });
      // Prefetch a small chunk near the seek point to warm caches
      const r2Path = this.audioState.getValue().currentTrack?.r2Path || '';
      this.currentPrefetchSub?.unsubscribe();
      if (r2Path) {
        // Trigger URL refresh to avoid TTL edge during seeks
        this.r2AudioService.triggerImmediateRefresh(r2Path);
        this.currentPrefetchSub = this.r2AudioService.prefetchChunkForSeek(r2Path, duration, seekTime).subscribe();
      }
      const wasPlaying = await this.isNativePlaying();
      if (this.pendingResumeAfterSeek === null) {
        this.pendingResumeAfterSeek = wasPlaying;
      }
      const resumeAfterSeek = !!this.pendingResumeAfterSeek;
      // Do direct seek first while preserving current playback state.
      // On some Media3 session states, pause->seek can make seek command unavailable.
      console.warn(`🎯 [AUDIO_SYNC] native seek call timeInSeconds=${Math.floor(seekTime)} wasPlaying=${wasPlaying}`);
      await AudioPlayer.seek({ audioId: this.nativeAudioId, timeInSeconds: Math.floor(seekTime) });
      this.debugLog('Seek command sent', { seekTime: Math.floor(seekTime), wasPlaying, strategy: 'direct' });
      // Wait for seek to land before any potential resume action.
      const seekStart = Date.now();
      let landed = false;
      while (!signal.aborted && Date.now() - seekStart < 4000) {
        const cur = await this.getNativeCurrentTime();
        if (Math.abs(cur - seekTime) <= 2) {
          landed = true;
          break;
        }
        await new Promise(r => setTimeout(r, 200));
      }
      if (!landed) {
        // Retry via re-initialize path. This helps when controller temporarily
        // rejects seek command for long streams.
        this.debugLog('Seek did not land after direct call, retrying with initialize', { seekTime });
        try {
          await AudioPlayer.initialize({ audioId: this.nativeAudioId });
          await AudioPlayer.seek({ audioId: this.nativeAudioId, timeInSeconds: Math.floor(seekTime) });
          const retryStart = Date.now();
          while (!signal.aborted && Date.now() - retryStart < 2500) {
            const cur = await this.getNativeCurrentTime();
            if (Math.abs(cur - seekTime) <= 2) {
              landed = true;
              break;
            }
            await new Promise(r => setTimeout(r, 200));
          }
        } catch (retryError) {
          this.debugLog('Seek retry failed', { error: String((retryError as any)?.message || retryError) });
        }
      }
      if (resumeAfterSeek) {
        console.warn('🎯 [AUDIO_SYNC] native play after seek');
        await AudioPlayer.play({ audioId: this.nativeAudioId });
        this.updateState({ isPlaying: true });
      } else {
        this.updateState({ isPlaying: false });
      }
      this.pendingResumeAfterSeek = null;

      await new Promise(resolve => setTimeout(resolve, 150));
      if (signal.aborted) return;

      const actualSeek = await this.getNativeCurrentTime();
      this.debugLog('Seek verification', { seekTime, actualSeek, delta: Math.abs(actualSeek - seekTime) });
      if (myToken === this.seekToken) {
        this.updateState({
          progress: duration > 0 ? actualSeek / duration : 0,
          currentTime: actualSeek,
        });
      }

      const startedTrack = this.audioState.getValue().currentTrack?.storyId || '';
      const confirmInterval = setInterval(async () => {
        if (signal.aborted || (this.audioState.getValue().currentTrack?.storyId || '') !== startedTrack) {
          clearInterval(confirmInterval);
          return;
        }
        if (myToken !== this.seekToken) {
          clearInterval(confirmInterval);
          return;
        }
        const cur = await this.getNativeCurrentTime();
        const moved = typeof cur === 'number' && Math.abs(cur - seekTime) <= 2;
        const playbackSettled = !resumeAfterSeek || (await this.isNativePlaying());
        if (moved && playbackSettled) {
          if ((this.audioState.getValue().currentTrack?.storyId || '') === startedTrack) {
            this.setLoading(false, startedTrack);
          }
          clearInterval(confirmInterval);
        }
      }, 200);
      signal.addEventListener('abort', () => clearInterval(confirmInterval), { once: true });

      // If seek doesn't land, retry once after 1s
      if (this.seekVerifyTimer) { clearTimeout(this.seekVerifyTimer); }
      this.seekVerifyTimer = setTimeout(async () => {
        if (signal.aborted || myToken !== this.seekToken) return;
        const cur = await this.getNativeCurrentTime();
        if (Math.abs(cur - seekTime) > 2) {
          try {
            await AudioPlayer.initialize({ audioId: this.nativeAudioId });
            await AudioPlayer.seek({ audioId: this.nativeAudioId, timeInSeconds: Math.floor(seekTime) });
            if (resumeAfterSeek) {
              await AudioPlayer.play({ audioId: this.nativeAudioId });
            }
          } catch {}
        }
      }, 1000);

    } catch (error: any) {
      // Ignore AbortError; if timeout occurred from waitForNativeReady, continue silently
      if (error && error.name !== 'AbortError') {
        const msg = String(error?.message || '').toLowerCase();
        if (!msg.includes('timed out waiting') && !msg.includes('timeout')) {
          console.error('Error during seek:', error);
        }
      }
    } finally {
      // Spinner cleared by confirmation interval when playback resumes
      if (this.seekResetTimer) { clearTimeout(this.seekResetTimer); this.seekResetTimer = null; }
      if (this.seekVerifyTimer) { clearTimeout(this.seekVerifyTimer); this.seekVerifyTimer = null; }
      this.ambientAudioService.onMainAudioSeekComplete();
      this.seekLock = false;
      this.seekInProgress = false;
      this.pendingResumeAfterSeek = null;
      this.activeSeekController = null;
      if (this.audioState.getValue().isPlaying) {
        this.startProgressTracking();
      }
    }
  }

  cancelActiveSeek(): void {
    this.activeSeekController?.abort();
    this.activeSeekController = null;
    this.seekToken++;
    if (this.seekResetTimer) { clearTimeout(this.seekResetTimer); this.seekResetTimer = null; }
    if (this.seekVerifyTimer) { clearTimeout(this.seekVerifyTimer); this.seekVerifyTimer = null; }
  }

  updateProgressUiOnly(progress: number): void {
    const duration = this.audioState.getValue().duration;
    if (duration > 0) {
      const clampedProgress = Math.max(0, Math.min(progress, 1));
      this.updateState({ progress: clampedProgress, currentTime: clampedProgress * duration });
    }
  }

  waitForNativeReady(signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      let checkInterval: any = null;

      const onAbort = () => {
        clearTimeout(timeoutId);
        if (checkInterval) {
          clearInterval(checkInterval);
        }
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });

      if (this.nativeReady) {
        this.debugLog('waitForNativeReady immediate resolve');
        signal.removeEventListener('abort', onAbort);
        return resolve();
      }

      const timeoutId = setTimeout(() => {
        // Resolve after grace timeout to allow fallback seek/play logic to proceed
        this.debugLog('waitForNativeReady timeout resolve');
        if (checkInterval) {
          clearInterval(checkInterval);
        }
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, 15000);

      checkInterval = setInterval(() => {
        if (this.nativeReady) {
          this.debugLog('waitForNativeReady resolved by nativeReady');
          clearInterval(checkInterval);
          signal.removeEventListener('abort', onAbort);
          clearTimeout(timeoutId);
          resolve();
        }
      }, 200);
    });
  }

  private updateState(newState: Partial<AudioState>) {
    this.audioState.next({ ...this.audioState.getValue(), ...newState });
  }

  private stopCurrentAudio() {
    this.cancelActiveSeek();
    this.stopNativePlayback();
    this.stopProgressTracking();
  }

  private startProgressTracking() {
    this.stopProgressTracking();
    this.progressInterval = setInterval(() => {
      this.updateNativeProgress();
    }, 500);
    this.startStallWatch();
  }

  private stopProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    this.stopStallWatch();
  }

  private startStallWatch() {
    this.stopStallWatch();
    this.lastProgressAt = Date.now();
    this.stallWatchInterval = setInterval(() => {
      if (!this.nativeReady) return;
      if (!this.isNativePlayingSync()) {
        this.lastProgressAt = Date.now();
        return;
      }
      const now = Date.now();
      if (now - this.lastProgressAt > this.stallThresholdMs) {
        this.recoverFromStall();
      }
    }, 2000);
  }

  private stopStallWatch() {
    if (this.stallWatchInterval) {
      clearInterval(this.stallWatchInterval);
      this.stallWatchInterval = null;
    }
  }

  private recoverFromStall() {
    if (!this.nativeReady) return;
    const pos = this.audioState.getValue().currentTime || 0;
    const dur = this.audioState.getValue().duration || 0;
    const r2Path = this.audioState.getValue().currentTrack?.r2Path || '';
    try {
      if (r2Path && dur > 0) {
        this.currentPrefetchSub?.unsubscribe();
        this.currentPrefetchSub = this.r2AudioService.prefetchChunkForSeek(r2Path, dur, pos).subscribe();
      }
    } catch {}
    this.pauseNativePlayback();
    setTimeout(() => {
      this.resumeNativePlayback();
      this.lastProgressAt = Date.now();
    }, 200);
  }

  private logStartupLatency(): void {
    if (!this.lastPlayStartAt) return;
    const delta = Date.now() - this.lastPlayStartAt;
    if (delta > 0 && delta < 120000) {
      console.log(`🎵 Startup latency: ${delta}ms`);
    }
    this.lastPlayStartAt = 0;
  }

  private handleNetworkError(trackId: string, message: string) {
    this.consecutiveFailures++;
    this.isNetworkError = true;
    this.updateState({ isPlaying: false, isLoading: false, loadingTrackId: '' });
  }

  private handleAudioError(type: 'load' | 'play', error: any) {
    console.error(`🎵 Audio error (${type}):`, error);
    const currentTrackId = this.audioState.getValue().currentTrack?.storyId;
    this.updateState({ isPlaying: false });
    if (currentTrackId) {
      this.setLoading(false, currentTrackId);
    }
  }

  private updateTrackImmediately(request: PlayRequest) {
    // Firebase story duration is stored in minutes in this app.
    const knownDurationMinutes = Number(request.duration || 0);
    const knownDurationSeconds = Number.isFinite(knownDurationMinutes) && knownDurationMinutes > 0
      ? knownDurationMinutes * 60
      : 0;
    const track: AudioTrack = {
      title: request.title,
      photoUrl: request.photoUrl || '',
      description: request.description || '',
      storyId: request.storyId,
      r2Path: request.r2Path,
      audioUrl: '',
      duration: knownDurationSeconds,
    };
    this.lastTrack = track;
    this.updateState({
      currentTrack: track,
      progress: 0,
      duration: track.duration || 0,
    });
    this.debugLog('Track selected', {
      storyId: request.storyId,
      title: request.title,
      knownDurationSeconds: track.duration || 0,
    });
  }

  private persistLibraryEntry(request: PlayRequest) {
    try {
      this.libraryDataService.addToLibrary({
        id: request.storyId,
        title: request.title,
        subTitle: request.description,
        imageUrl: this.audioState.getValue().currentTrack?.photoUrl || request.photoUrl || '',
        audioUrl: '',
        r2Path: request.r2Path,
        duration: this.audioState.getValue().duration || 0
      });
    } catch (e) {
      // Best effort; avoid crashing playback
      console.error('📚 Error persisting library entry:', e);
    }
  }

  private setupNetworkMonitoring() {}

  private resumeFromNotification() {
    this.play();
  }

  private pauseFromNotification() {
    this.pause();
  }

  private stopFromNotification() {
    this.stop();
  }

  private seekBackwardFromNotification() {
    const currentTime = this.audioState.getValue().currentTime || 0;
    this.seekTo(Math.max(0, currentTime - 15));
  }

  private seekForwardFromNotification() {
    const currentTime = this.audioState.getValue().currentTime || 0;
    const duration = this.audioState.getValue().duration || 0;
    this.seekTo(duration > 0 ? Math.min(duration, currentTime + 15) : currentTime + 15);
  }

  private async startNativePlayback(audioUrl: string, request: PlayRequest, token: number): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('Native playback requires native platform');
    }

    const metadata = {
      audioId: this.nativeAudioId,
      audioSource: audioUrl,
      friendlyTitle: request.title,
      albumTitle: request.description || '',
      artistName: 'Dozlo',
      artworkSource: request.photoUrl || '',
      useForNotification: true,
      showSeekBackward: false,
      showSeekForward: false,
      seekBackwardTime: 0,
      seekForwardTime: 0,
      loop: false,
    };

    if (!this.nativeCreated) {
      await AudioPlayer.create(metadata);
      this.nativeCreated = true;
      await this.ensureNativeListeners();
    } else {
      await AudioPlayer.changeAudioSource({ audioId: this.nativeAudioId, source: audioUrl });
      await AudioPlayer.changeMetadata({
        audioId: this.nativeAudioId,
        friendlyTitle: request.title,
        albumTitle: request.description || '',
        artistName: 'Dozlo',
        artworkSource: request.photoUrl || '',
      });
    }

    this.nativeReady = false;
    await AudioPlayer.initialize({ audioId: this.nativeAudioId });
    await AudioPlayer.play({ audioId: this.nativeAudioId });

    this.ambientAudioService.onMainAudioPlay();
    this.logStartupLatency();

    // Persist basic metadata for continue listening
    this.persistLibraryEntry(request);
    if (request.r2Path) {
      this.r2AudioService.startRollingRefresh(request.r2Path);
    }

    if (request.resumePosition && request.resumePosition > 0) {
      await this.performSeek(request.resumePosition);
    }

    if (token === this.playToken) {
      this.updateState({ isPlaying: true, isLoading: false, loadingTrackId: '', currentTrack: this.lastTrack || this.audioState.getValue().currentTrack });
      this.startProgressTracking();
    }

    const track = this.audioState.getValue().currentTrack;
    if (track) {
      this.analytics.logAudioPlay(
        track.storyId || track.audioUrl || '',
        track.title || '',
        this.audioState.getValue().duration || 0
      );
    }
  }

  private async ensureNativeListeners(): Promise<void> {
    if (this.nativeListenersRegistered) return;
    this.nativeListenersRegistered = true;

    await AudioPlayer.onAudioReady({ audioId: this.nativeAudioId }, async () => {
      this.nativeReady = true;
      this.consecutiveFailures = 0;
      this.isNetworkError = false;
      const duration = await this.getNativeDuration();
      if (duration > 0) {
        this.updateState({ duration });
      }
      this.debugLog('Native audio ready', { duration });
    });

    await AudioPlayer.onAudioEnd({ audioId: this.nativeAudioId }, () => {
      this.stopProgressTracking();
      this.updateState({ isPlaying: false, progress: 0, currentTrack: null });
      const rp = this.audioState.getValue().currentTrack?.r2Path;
      if (rp) { this.r2AudioService.stopRollingRefresh(rp); }
      const track = this.audioState.getValue().currentTrack;
      if (track) {
        this.analytics.logAudioStop(
          track.storyId || track.audioUrl || '',
          track.title || '',
          this.audioState.getValue().duration || 0
        );
      }
    });

    await AudioPlayer.onPlaybackStatusChange({ audioId: this.nativeAudioId }, (result) => {
      if (!result || !result.status) {
        return;
      }
      if (result.status === 'playing') {
        const shouldClearLoading = !this.seekInProgress;
        this.updateState({
          isPlaying: true,
          isLoading: shouldClearLoading ? false : this.audioState.getValue().isLoading,
          loadingTrackId: shouldClearLoading ? '' : this.audioState.getValue().loadingTrackId,
        });
        this.startProgressTracking();
        const rp = this.audioState.getValue().currentTrack?.r2Path;
        if (rp) { this.r2AudioService.startRollingRefresh(rp); }
        this.ambientAudioService.onMainAudioResume();
      } else if (result.status === 'paused') {
        this.updateState({ isPlaying: false });
        this.stopProgressTracking();
        const rp = this.audioState.getValue().currentTrack?.r2Path;
        if (rp) { this.r2AudioService.stopRollingRefresh(rp); }
        this.ambientAudioService.onMainAudioPause();
      } else if (result.status === 'stopped') {
        this.updateState({ isPlaying: false, progress: 0 });
        this.stopProgressTracking();
        const rp = this.audioState.getValue().currentTrack?.r2Path;
        if (rp) { this.r2AudioService.stopRollingRefresh(rp); }
        this.ambientAudioService.onMainAudioPause();
      }
    });
  }

  private async resumeNativePlayback(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    if (this.seekInProgress) {
      this.pendingResumeAfterSeek = true;
      return;
    }
    try {
      await AudioPlayer.play({ audioId: this.nativeAudioId });
      this.updateState({ isPlaying: true, isLoading: false, loadingTrackId: '', currentTrack: this.lastTrack || this.audioState.getValue().currentTrack });
      this.startProgressTracking();
      this.ambientAudioService.onMainAudioResume();
      const track = this.audioState.getValue().currentTrack;
      if (track) {
        this.analytics.logAudioResume(
          track.storyId || track.audioUrl || '',
          this.audioState.getValue().currentTime || 0
        );
      }
    } catch (e) {
      this.handleAudioError('play', e);
    }
  }

  private async pauseNativePlayback(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    if (this.seekInProgress) {
      this.pendingResumeAfterSeek = false;
    }
    try {
      await AudioPlayer.pause({ audioId: this.nativeAudioId });
      this.updateState({ isPlaying: false, currentTrack: this.lastTrack || this.audioState.getValue().currentTrack });
      this.stopProgressTracking();
      this.ambientAudioService.onMainAudioPause();
      const rp = this.audioState.getValue().currentTrack?.r2Path;
      if (rp) { this.r2AudioService.stopRollingRefresh(rp); }
      const track = this.audioState.getValue().currentTrack;
      if (track) {
        this.analytics.logAudioPause(
          track.storyId || track.audioUrl || '',
          this.audioState.getValue().currentTime || 0
        );
      }
    } catch (e) {
      this.handleAudioError('play', e);
    }
  }

  private async stopNativePlayback(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    if (!this.nativeCreated) return;
    try {
      await AudioPlayer.stop({ audioId: this.nativeAudioId });
    } catch {}
  }

  private async getNativeDuration(): Promise<number> {
    if (!this.nativeCreated) {
      return this.audioState.getValue().duration || this.audioState.getValue().currentTrack?.duration || 0;
    }
    try {
      const res = await AudioPlayer.getDuration({ audioId: this.nativeAudioId });
      const normalized = this.normalizeTime(res?.duration);
      if (normalized <= 0) {
        const fallback = this.audioState.getValue().duration || this.audioState.getValue().currentTrack?.duration || 0;
        if (fallback > 0) {
          return fallback;
        }
      }
      return normalized;
    } catch {
      return this.audioState.getValue().duration || this.audioState.getValue().currentTrack?.duration || 0;
    }
  }

  private async getNativeCurrentTime(): Promise<number> {
    if (!this.nativeCreated) {
      return this.audioState.getValue().currentTime || 0;
    }
    try {
      const res = await AudioPlayer.getCurrentTime({ audioId: this.nativeAudioId });
      const raw = res?.currentTime;
      const normalized = this.normalizeTime(raw);
      const durationHint = this.audioState.getValue().duration || this.audioState.getValue().currentTrack?.duration || 0;
      // Some native/plugin versions report currentTime in ms while duration is in seconds.
      if (durationHint > 0 && normalized > durationHint * 1.2 && normalized > 1000) {
        return normalized / 1000;
      }
      return normalized;
    } catch {
      return 0;
    }
  }

  private isNativePlayingSync(): boolean {
    return this.audioState.getValue().isPlaying;
  }

  private async isNativePlaying(): Promise<boolean> {
    if (!this.nativeCreated) {
      return this.audioState.getValue().isPlaying;
    }
    try {
      const res = await AudioPlayer.isPlaying({ audioId: this.nativeAudioId });
      return !!res?.isPlaying;
    } catch {
      return this.audioState.getValue().isPlaying;
    }
  }

  private async updateNativeProgress(): Promise<void> {
    if (this.isProgressUpdating) return;
    if (this.seekInProgress) return;
    this.isProgressUpdating = true;
    try {
      const isPlaying = await this.isNativePlaying();
      if (!isPlaying) return;
      const seek = await this.getNativeCurrentTime();
      const duration = this.audioState.getValue().duration || (await this.getNativeDuration());
      const progress = duration > 0 ? seek / duration : 0;
      const prevTime = this.audioState.getValue().currentTime || 0;
      this.updateState({ progress: progress, currentTime: seek, duration: duration > 0 ? duration : this.audioState.getValue().duration });
      if (typeof seek === 'number' && seek > prevTime + 0.05) {
        this.lastProgressAt = Date.now();
      }
      const track = this.audioState.getValue().currentTrack;
      if (track?.storyId) {
        this.libraryDataService.updateProgress(track.storyId, progress);
      }
    } finally {
      this.isProgressUpdating = false;
    }
  }

  private normalizeTime(value: any): number {
    if (typeof value !== 'number' || !isFinite(value) || value < 0) return 0;
    // If value looks like milliseconds, convert to seconds.
    if (value > 100000) {
      return Math.floor(value / 1000);
    }
    return value;
  }

  // Public helper for fullscreen player to refresh timing if needed
  async refreshTiming(): Promise<void> {
    const duration = await this.getNativeDuration();
    const currentTime = await this.getNativeCurrentTime();
    const progress = duration > 0 ? currentTime / duration : 0;
    this.updateState({ duration: duration > 0 ? duration : this.audioState.getValue().duration, currentTime, progress });
    this.debugLog('Timing refreshed', { duration, currentTime, progress });
  }

  ngOnDestroy() {
    this.stop();
  }
}
