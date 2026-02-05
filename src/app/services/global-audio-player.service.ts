import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { R2AudioService } from './r2-audio.service';
import { AmbientAudioService } from './ambient-audio.service';
import { LibraryDataService } from './library-data.service';
import { Howl } from 'howler';
import { MediaSession } from '@jofr/capacitor-media-session';
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
}

export interface PlayRequest {
  storyId: string;
  title: string;
  r2Path: string;
  photoUrl?: string;
  description?: string;
  resumePosition?: number;
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

  private currentHowl: Howl | null = null;
  private progressInterval: any = null;
  private stallWatchInterval: any = null;
  private lastProgressAt = 0;
  private stallThresholdMs = 15000;

  private seekLock = false;
  private activeSeekController: AbortController | null = null;
  private seekToken = 0;

  private currentPlaySub: Subscription | null = null;
  private currentPrefetchSub: Subscription | null = null;
  private playToken = 0;

  constructor(
    private r2AudioService: R2AudioService,
    private ambientAudioService: AmbientAudioService,
    private libraryDataService: LibraryDataService,
    private analytics: AnalyticsService
  ) {
    this.setupMediaSession();
    this.setupNetworkMonitoring();
    this.setupAndroidAudioSession();
  }

  private setupMediaSession(): void {
    if (!Capacitor.isNativePlatform() || !MediaSession) return;
    try {
      MediaSession.setActionHandler({ action: 'play' }, () => this.resumeFromNotification());
      MediaSession.setActionHandler({ action: 'pause' }, () => this.pauseFromNotification());
      MediaSession.setActionHandler({ action: 'stop' }, () => this.stopFromNotification());
      MediaSession.setActionHandler({ action: 'seekbackward' }, () => this.seekBackwardFromNotification());
      MediaSession.setActionHandler({ action: 'seekforward' }, () => this.seekForwardFromNotification());
    } catch (error) {
      console.error('🎵 Error setting up MediaSession:', error);
    }
  }

  private setupAndroidAudioSession(): void {}

  private getHtmlAudioElement(): HTMLAudioElement | null {
    try {
      const howlAny: any = this.currentHowl as any;
      const node: HTMLAudioElement | undefined = howlAny?._sounds?.[0]?._node;
      return node || null;
    } catch {
      return null;
    }
  }

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
          this.currentHowl = new Howl({
            src: [audioUrl],
            html5: true,
            preload: false,
            loop: false,
            volume: 1.0,
            format: ['mp3', 'wav', 'ogg', 'm4a', 'aac'],
            onload: () => {
              if (myPlayToken !== this.playToken) return;
              this.consecutiveFailures = 0;
              this.isNetworkError = false;
              this.updateState({ duration: this.currentHowl?.duration() || 0 });
              this.updateMediaSessionMetadata();
              // Persist basic metadata for continue listening
              this.persistLibraryEntry(request);
              // Begin rolling signed-URL refresh while playing
              if (request.r2Path) {
                this.r2AudioService.startRollingRefresh(request.r2Path);
              }
              if (request.resumePosition && request.resumePosition > 0) {
                this.seekTo(request.resumePosition);
              }
            },
            onloaderror: (id, error) => { if (myPlayToken !== this.playToken) return; this.tryFallbackAudioLoading(request, audioUrl); },
            onplay: () => {
              if (myPlayToken !== this.playToken) return;
              this.startProgressTracking();
              if (this.seekLock) {
                this.updateState({ isPlaying: true });
              } else {
                this.updateState({ isPlaying: true, isLoading: false, loadingTrackId: '' });
              }
              this.updateMediaSessionMetadata();
              this.updateMediaSessionPlaybackState(true);
              // Ensure rolling refresh is active on play/resume
              const rp = this.audioState.getValue().currentTrack?.r2Path;
              if (rp) {
                this.r2AudioService.startRollingRefresh(rp);
              }
              // Log audio_play event
              const track = this.audioState.getValue().currentTrack;
              if (track) {
                this.analytics.logAudioPlay(
                  track.storyId || track.audioUrl || '',
                  track.title || '',
                  this.currentHowl?.duration() || 0
                );
              }
            },
            onplayerror: (id, error) => { if (myPlayToken !== this.playToken) return; this.handleAudioError('play', error); },
            onpause: () => {
              if (myPlayToken !== this.playToken) return;
              this.stopProgressTracking();
              this.updateState({ isPlaying: false });
              this.updateMediaSessionPlaybackState(false);
              // Pause rolling refresh to save network
              const rp = this.audioState.getValue().currentTrack?.r2Path;
              if (rp) { this.r2AudioService.stopRollingRefresh(rp); }
              // Log audio_pause event
              const track = this.audioState.getValue().currentTrack;
              if (track) {
                this.analytics.logAudioPause(
                  track.storyId || track.audioUrl || '',
                  this.currentHowl?.seek() as number || 0
                );
              }
            },
            onend: () => {
              if (myPlayToken !== this.playToken) return;
              this.stopProgressTracking();
              this.updateState({ isPlaying: false, progress: 0, currentTrack: null });
              // Update media session state in a safe, staged way to avoid plugin race conditions
              try {
                // First mark as paused to stop progress updates in the notification
                this.updateMediaSessionPlaybackState(false);
              } catch (e) {}
              // Then clear metadata and set state to none after a short delay so the service can settle
              setTimeout(() => {
                try {
                  if (Capacitor.isNativePlatform() && MediaSession) {
                    MediaSession.setPlaybackState({ playbackState: 'none' });
                  }
                } catch (e) {}
                this.clearMediaSessionMetadata();
              }, 200);
              // Stop rolling refresh at end
              if (request.r2Path) { this.r2AudioService.stopRollingRefresh(request.r2Path); }
              // Mark completed in library when playback naturally ends
              if (request.storyId) {
                this.libraryDataService.markCompleted(request.storyId);
              }
              // Log audio_stop event (on end)
              const track = this.audioState.getValue().currentTrack;
              if (track) {
                this.analytics.logAudioStop(
                  track.storyId || track.audioUrl || '',
                  track.title || '',
                  this.currentHowl?.duration() || 0
                );
              }
            },
          });

          this.updateMediaSessionMetadata();
          this.updateMediaSessionPlaybackState(true);
          this.currentHowl.play();
          this.ambientAudioService.onMainAudioPlay();
          resolve(true);
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

  play() {
    if (this.currentHowl && !this.currentHowl.playing()) {
      this.currentHowl.play();
      this.ambientAudioService.onMainAudioResume();
      // Log audio_resume event
      const track = this.audioState.getValue().currentTrack;
      if (track) {
        this.analytics.logAudioResume(
          track.storyId || track.audioUrl || '',
          this.currentHowl?.seek() as number || 0
        );
      }
    }
  }

  pause() {
    if (this.currentHowl?.playing()) {
      this.currentHowl.pause();
      this.ambientAudioService.onMainAudioPause();
      const rp = this.audioState.getValue().currentTrack?.r2Path;
      if (rp) { this.r2AudioService.stopRollingRefresh(rp); }
      // Log audio_pause event (already handled in Howl onpause, but keep for manual pause calls)
      const track = this.audioState.getValue().currentTrack;
      if (track) {
        this.analytics.logAudioPause(
          track.storyId || track.audioUrl || '',
          this.currentHowl?.seek() as number || 0
        );
      }
    }
  }

  stop() {
    this.stopCurrentAudio();
    this.updateState({ isPlaying: false, currentTrack: null, progress: 0, duration: 0 });
    this.clearMediaSessionMetadata();
    this.r2AudioService.stopRollingRefresh();
    // Log audio_stop event (manual stop)
    const track = this.audioState.getValue().currentTrack;
    if (track) {
      this.analytics.logAudioStop(
        track.storyId || track.audioUrl || '',
        track.title || '',
        this.currentHowl?.seek() as number || 0
      );
    }
  }

  async seekTo(time: number): Promise<void> {
    if (this.seekLock || typeof time !== 'number' || !this.currentHowl) {
      return;
    }

    this.seekLock = true;
    const startedTrackId = this.audioState.getValue().currentTrack?.storyId || '';
    if (startedTrackId) { this.setLoading(true, startedTrackId); }
    this.cancelActiveSeek();
    this.activeSeekController = new AbortController();
    const signal = this.activeSeekController.signal;
    const myToken = ++this.seekToken;

    try {
      await this.waitForHowlReady(signal);
      if (signal.aborted) return;

      const duration = this.currentHowl.duration();
      if (typeof duration !== 'number' || duration <= 0) {
        return;
      }

      const seekTime = Math.max(0, Math.min(time, duration));
      // Prefetch a small chunk near the seek point to warm caches
      const r2Path = this.audioState.getValue().currentTrack?.r2Path || '';
      this.currentPrefetchSub?.unsubscribe();
      if (r2Path) {
        // Trigger URL refresh to avoid TTL edge during seeks
        this.r2AudioService.triggerImmediateRefresh(r2Path);
        this.currentPrefetchSub = this.r2AudioService.prefetchChunkForSeek(r2Path, duration, seekTime).subscribe();
      }
      const node = this.getHtmlAudioElement();
      if (node) {
        try {
          const fast: any = (node as any).fastSeek;
          if (typeof fast === 'function') {
            fast.call(node, seekTime);
          } else {
            node.currentTime = seekTime;
          }
        } catch {}
      }
      this.currentHowl.seek(seekTime);

      if (!this.currentHowl.playing()) {
        try { this.currentHowl.play(); } catch {}
      }

      await new Promise(resolve => setTimeout(resolve, 150));
      if (signal.aborted) return;

      const actualSeek = this.currentHowl.seek() as number;
      if (myToken === this.seekToken) {
        this.updateState({
          progress: duration > 0 ? actualSeek / duration : 0,
          currentTime: actualSeek,
        });
        this.updateMediaSessionPositionState();
      }

      const startedHowl = this.currentHowl;
      const startedTrack = this.audioState.getValue().currentTrack?.storyId || '';
      const confirmInterval = setInterval(() => {
        if (signal.aborted || this.currentHowl !== startedHowl || (this.audioState.getValue().currentTrack?.storyId || '') !== startedTrack) {
          clearInterval(confirmInterval);
          return;
        }
        if (myToken !== this.seekToken) {
          clearInterval(confirmInterval);
          return;
        }
        const cur = this.currentHowl?.seek() as number;
        const playing = !!this.currentHowl?.playing();
        const htmlNode = this.getHtmlAudioElement();
        const ready = htmlNode ? (htmlNode.readyState >= 3) : false;
        const moved = typeof cur === 'number' && (cur - seekTime) > 0.15;
        if ((playing && moved) || (ready && moved)) {
          if ((this.audioState.getValue().currentTrack?.storyId || '') === startedTrack) {
            this.setLoading(false, startedTrack);
          }
          clearInterval(confirmInterval);
        }
      }, 200);
      signal.addEventListener('abort', () => clearInterval(confirmInterval), { once: true });

    } catch (error: any) {
      // Ignore AbortError; if timeout occurred from waitForHowlReady, continue silently
      if (error && error.name !== 'AbortError') {
        const msg = String(error?.message || '').toLowerCase();
        if (!msg.includes('timed out waiting') && !msg.includes('timeout')) {
          console.error('Error during seek:', error);
        }
      }
    } finally {
      // Spinner cleared by confirmation interval when playback resumes
      this.seekLock = false;
      this.activeSeekController = null;
    }
  }

  attachHowl(howl: Howl): void {
    this.stopCurrentAudio();
    this.currentHowl = howl;
    this.updateState({ duration: howl.duration() });
  }

  cancelActiveSeek(): void {
    this.activeSeekController?.abort();
    this.activeSeekController = null;
    this.seekToken++;
  }

  updateProgressUiOnly(progress: number): void {
    const duration = this.audioState.getValue().duration;
    if (duration > 0) {
      const clampedProgress = Math.max(0, Math.min(progress, 1));
      this.updateState({ progress: clampedProgress, currentTime: clampedProgress * duration });
    }
  }

  waitForHowlReady(signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));

      const onAbort = () => {
        clearTimeout(timeoutId);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });

      if (this.currentHowl?.state() === 'loaded') {
        signal.removeEventListener('abort', onAbort);
        return resolve();
      }

      const timeoutId = setTimeout(() => {
        // Resolve after grace timeout to allow fallback seek/play logic to proceed
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, 15000);

      this.currentHowl?.once('load', () => {
        signal.removeEventListener('abort', onAbort);
        clearTimeout(timeoutId);
        resolve();
      });
    });
  }

  private updateState(newState: Partial<AudioState>) {
    this.audioState.next({ ...this.audioState.getValue(), ...newState });
  }

  private updateMediaSessionPositionState() {
    if (!Capacitor.isNativePlatform() || !MediaSession || !this.currentHowl) return;
    try {
      const duration = this.currentHowl.duration();
      const position = this.currentHowl.seek();
      MediaSession.setPositionState({ duration: duration, playbackRate: 1, position: typeof position === 'number' ? position : 0 });
    } catch (error) {
      console.error('🎵 Error updating MediaSession position state:', error);
    }
  }

  private async tryFallbackAudioLoading(request: PlayRequest, originalAudioUrl: string): Promise<void> {
    try {
      this.currentHowl = new Howl({
        src: [originalAudioUrl],
        html5: false, // Try with html5 disabled
        preload: false,
        onload: () => {
          this.updateState({ duration: this.currentHowl?.duration() || 0 });
          this.updateMediaSessionMetadata();
          this.currentHowl?.play();
        },
        onloaderror: (id, error) => this.handleAudioError('load', error),
      });
    } catch (fallbackError) {
      this.handleNetworkError(request.storyId, 'All audio loading strategies failed.');
    }
  }

  private stopCurrentAudio() {
    this.cancelActiveSeek();
    if (this.currentHowl) {
      this.currentHowl.stop();
      this.currentHowl.unload();
      this.currentHowl = null;
    }
    this.stopProgressTracking();
  }

  private pauseCurrentAudio() {
    if (this.currentHowl?.playing()) {
      this.currentHowl.pause();
    }
    this.stopProgressTracking();
  }

  private startProgressTracking() {
    this.stopProgressTracking();
    this.progressInterval = setInterval(() => {
      if (this.currentHowl?.playing()) {
        const seek = this.currentHowl.seek() as number;
        const duration = this.currentHowl.duration();
        const progress = duration > 0 ? seek / duration : 0;
        const prevTime = this.audioState.getValue().currentTime || 0;
        this.updateState({ progress: progress, currentTime: seek });
        if (typeof seek === 'number' && seek > prevTime + 0.05) {
          this.lastProgressAt = Date.now();
        }
        this.updateMediaSessionPositionState();
        // Persist progress periodically to local storage for continue listening
        const track = this.audioState.getValue().currentTrack;
        if (track?.storyId) {
          this.libraryDataService.updateProgress(track.storyId, progress);
        }
      }
    }, 250);
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
      const h = this.currentHowl;
      if (!h) return;
      if (!h.playing()) {
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
    const h = this.currentHowl;
    if (!h) return;
    const pos = (h.seek() as number) || 0;
    const dur = h.duration() || 0;
    const r2Path = this.audioState.getValue().currentTrack?.r2Path || '';
    try {
      if (r2Path && dur > 0) {
        this.currentPrefetchSub?.unsubscribe();
        this.currentPrefetchSub = this.r2AudioService.prefetchChunkForSeek(r2Path, dur, pos).subscribe();
      }
    } catch {}
    try { h.pause(); } catch {}
    setTimeout(() => {
      try { h.play(); this.lastProgressAt = Date.now(); } catch {}
    }, 200);
  }

  private updateMediaSessionPlaybackState(isPlaying: boolean) {
    if (!Capacitor.isNativePlatform() || !MediaSession) return;
    try {
      MediaSession.setPlaybackState({ playbackState: isPlaying ? 'playing' : 'paused' });
    } catch (error) {
      console.error('🎵 Error updating MediaSession playback state:', error);
    }
  }

  private updateMediaSessionMetadata() {
    if (!Capacitor.isNativePlatform() || !MediaSession) return;
    const state = this.audioState.getValue();
    if (state.currentTrack) {
      MediaSession.setMetadata({
        title: state.currentTrack.title,
        artist: 'Dozlo',
        album: state.currentTrack.description || '',
        artwork: [{ src: state.currentTrack.photoUrl || '', sizes: '512x512' }]
      });
    }
  }

  private clearMediaSessionMetadata() {
    if (!Capacitor.isNativePlatform() || !MediaSession) return;
    try {
      // Provide safe defaults to avoid plugin NPEs when fields are missing
      MediaSession.setMetadata({ title: '', artist: '', album: '', artwork: [] as any });
      MediaSession.setPositionState({ duration: 0, playbackRate: 1, position: 0 });
      MediaSession.setPlaybackState({ playbackState: 'none' });
    } catch (error) {
      console.error('🎵 Error clearing MediaSession metadata:', error);
    }
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
    const track: AudioTrack = {
      title: request.title,
      photoUrl: request.photoUrl || '',
      description: request.description || '',
      storyId: request.storyId,
      r2Path: request.r2Path,
      audioUrl: ''
    };
    this.updateState({
      currentTrack: track,
      progress: 0,
      duration: 0,
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
    this.seekTo(Math.min(duration, currentTime + 15));
  }

  ngOnDestroy() {
    this.stop();
  }
}
