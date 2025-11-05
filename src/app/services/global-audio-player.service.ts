import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
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

  private seekLock = false;
  private activeSeekController: AbortController | null = null;

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

  playFromCard(request: PlayRequest): Promise<boolean> {
    return this.playAudioFromAnyPage(request);
  }

  playAudioFromAnyPage(request: PlayRequest): Promise<boolean> {
    return new Promise((resolve) => {
      const requestId = `play_${request.storyId}_${Date.now()}`;
      this.setLoading(true, request.storyId);

      const now = Date.now();
      const throttleDelay = this.isSlowNetwork ? this.slowNetworkThrottleDelay : this.requestThrottleDelay;
      if (now - this.lastRequestTime < throttleDelay || this.isProcessingRequest) {
        this.handleNetworkError(request.storyId, 'Request throttled or in progress.');
        return resolve(false);
      }
      this.lastRequestTime = now;
      this.isProcessingRequest = true;
      this.currentRequestId = requestId;

      this.stopCurrentAudio();
      this.ambientAudioService.onMainAudioSwitch();
      this.updateTrackImmediately(request);

      this.r2AudioService.getAudioUrlWithAutoRefresh(request.r2Path).pipe(
        finalize(() => {
          this.isProcessingRequest = false;
          this.currentRequestId = '';
        })
      ).subscribe({
        next: (audioUrl) => {
          this.currentHowl = new Howl({
            src: [audioUrl],
            html5: true,
            preload: true,
            loop: false,
            volume: 1.0,
            format: ['mp3', 'wav', 'ogg', 'm4a'],
            onload: () => {
              this.consecutiveFailures = 0;
              this.isNetworkError = false;
              this.updateState({ duration: this.currentHowl?.duration() || 0 });
              this.updateMediaSessionMetadata();
              // Persist basic metadata for continue listening
              this.persistLibraryEntry(request);
              if (request.resumePosition && request.resumePosition > 0) {
                this.seekTo(request.resumePosition);
              }
            },
            onloaderror: (id, error) => this.tryFallbackAudioLoading(request, audioUrl),
            onplay: () => {
              this.startProgressTracking();
              this.updateState({ isPlaying: true, isLoading: false, loadingTrackId: '' });
              this.updateMediaSessionMetadata();
              this.updateMediaSessionPlaybackState(true);
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
            onplayerror: (id, error) => this.handleAudioError('play', error),
            onpause: () => {
              this.stopProgressTracking();
              this.updateState({ isPlaying: false });
              this.updateMediaSessionPlaybackState(false);
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
    this.cancelActiveSeek();
    this.activeSeekController = new AbortController();
    const signal = this.activeSeekController.signal;

    try {
      await this.waitForHowlReady(signal);
      if (signal.aborted) return;

      const duration = this.currentHowl.duration();
      if (typeof duration !== 'number' || duration <= 0) {
        return;
      }

      const seekTime = Math.max(0, Math.min(time, duration));
      this.currentHowl.seek(seekTime);

      await new Promise(resolve => setTimeout(resolve, 150));
      if (signal.aborted) return;

      const actualSeek = this.currentHowl.seek() as number;
      this.updateState({
        progress: duration > 0 ? actualSeek / duration : 0,
        currentTime: actualSeek,
      });
      this.updateMediaSessionPositionState();

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error during seek:', error);
      }
    } finally {
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
        signal.removeEventListener('abort', onAbort);
        reject(new Error('Timed out waiting for Howl to be ready.'));
      }, 5000);

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
        preload: true,
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
        this.updateState({ progress: progress, currentTime: seek });
        this.updateMediaSessionPositionState();
        // Persist progress periodically to local storage for continue listening
        const track = this.audioState.getValue().currentTrack;
        if (track?.storyId) {
          this.libraryDataService.updateProgress(track.storyId, progress);
        }
      }
    }, 250);
  }

  private stopProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
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
