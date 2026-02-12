import { Injectable, NgZone } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { BehaviorSubject, Observable } from 'rxjs';

export interface AudioTrack {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
  duration?: number;
  audioUrl: string;
  r2Path?: string;
}

export interface AudioState {
  isPlaying: boolean;
  currentTrack: AudioTrack | null;
  progress: number;
  duration: number;
  isLoading: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NativeAudioService {
  private audioState = new BehaviorSubject<AudioState>({
    isPlaying: false,
    currentTrack: null,
    progress: 0,
    duration: 0,
    isLoading: false
  });

  private audioElement: HTMLAudioElement | null = null;
  private progressInterval: any = null;
  private isInitialized = false;

  audioState$ = this.audioState.asObservable();

  constructor(private ngZone: NgZone) {
    this.initializeAudio();
  }

  private async initializeAudio() {
    if (this.isInitialized) return;

    try {
      // Enable background mode for Android
      if (Capacitor.isNativePlatform()) {
        // Set up notification controls
        await this.setupNotificationControls();
      }

      this.isInitialized = true;
      console.log('Native audio service initialized');
    } catch (error) {
      console.error('Error initializing native audio service:', error);
    }
  }

  private async setupNotificationControls() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      // Request notification permission
      const permission = await LocalNotifications.requestPermissions();
      if (permission.display !== 'granted') {
        console.warn('Notification permission not granted');
      }
    } catch (error) {
      console.error('Error setting up notification controls:', error);
    }
  }

  async loadTrack(track: AudioTrack): Promise<void> {
    try {
      this.updateState({ isLoading: true, error: undefined });

      // Stop current audio if playing
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement = null;
      }

      // Create new audio element
      this.audioElement = new Audio();
      this.audioElement.preload = 'metadata';

      // Set up audio event listeners
      this.setupAudioEventListeners();

      // Load the audio
      this.audioElement.src = track.audioUrl;
      await this.audioElement.load();

      // Update state with new track
      this.updateState({
        currentTrack: track,
        isLoading: false,
        progress: 0,
        duration: this.audioElement.duration || 0
      });

      console.log('Track loaded successfully:', track.title);
    } catch (error) {
      console.error('Error loading track:', error);
      this.updateState({
        isLoading: false,
        error: 'Failed to load audio track'
      });
    }
  }

  private setupAudioEventListeners() {
    if (!this.audioElement) return;

    this.audioElement.addEventListener('loadedmetadata', () => {
      this.ngZone.run(() => {
        this.updateState({
          duration: this.audioElement?.duration || 0
        });
      });
    });

    this.audioElement.addEventListener('play', () => {
      this.ngZone.run(() => {
        this.updateState({ isPlaying: true });
        this.startProgressTracking();
        
      });
    });

    this.audioElement.addEventListener('pause', () => {
      this.ngZone.run(() => {
        this.updateState({ isPlaying: false });
        this.stopProgressTracking();
        
      });
    });

    this.audioElement.addEventListener('ended', () => {
      this.ngZone.run(() => {
        this.updateState({ isPlaying: false });
        this.stopProgressTracking();
        
      });
    });

    this.audioElement.addEventListener('error', (event) => {
      this.ngZone.run(() => {
        console.error('Audio error:', event);
        this.updateState({
          isPlaying: false,
          error: 'Audio playback error'
        });
        this.stopProgressTracking();
      });
    });

    this.audioElement.addEventListener('timeupdate', () => {
      this.ngZone.run(() => {
        if (this.audioElement) {
          const progress = this.audioElement.duration > 0 
            ? this.audioElement.currentTime / this.audioElement.duration 
            : 0;
          this.updateState({ progress });
        }
      });
    });
  }

  async play(): Promise<void> {
    try {
      if (!this.audioElement) {
        throw new Error('No audio loaded');
      }

      // Request audio focus on Android
      if (Capacitor.isNativePlatform()) {
        await this.requestAudioFocus();
      }

      await this.audioElement.play();

    } catch (error) {
      console.error('Error playing audio:', error);
      this.updateState({
        isPlaying: false,
        error: 'Failed to play audio'
      });
    }
  }

  pause(): void {
    if (this.audioElement) {
      this.audioElement.pause();
    }
  }

  stop(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    this.updateState({
      isPlaying: false,
      currentTrack: null,
      progress: 0,
      duration: 0
    });
    
  }

  seekTo(time: number): void {
    if (this.audioElement && !isNaN(time)) {
      this.audioElement.currentTime = time;
    }
  }

  private async requestAudioFocus(): Promise<void> {
    // This would typically be handled by a native plugin
    // For now, we'll rely on the browser's audio focus management
    console.log('Audio focus requested');
  }

  private startProgressTracking(): void {
    this.stopProgressTracking();
    
    this.progressInterval = setInterval(() => {
      if (this.audioElement && this.audioElement.currentTime > 0) {
        const progress = this.audioElement.duration > 0 
          ? this.audioElement.currentTime / this.audioElement.duration 
          : 0;
        this.updateState({ progress });
      }
    }, 100);
  }

  private stopProgressTracking(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  private updateState(updates: Partial<AudioState>): void {
    const currentState = this.audioState.getValue();
    this.audioState.next({
      ...currentState,
      ...updates
    });
  }

  getCurrentState(): AudioState {
    return this.audioState.getValue();
  }

  // Cleanup method
  destroy(): void {
    this.stop();
    this.stopProgressTracking();
    if (this.audioElement) {
      this.audioElement = null;
    }
  }
} 
