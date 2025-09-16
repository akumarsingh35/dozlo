import { Injectable } from '@angular/core';
import { Howl, HowlOptions } from 'howler';
import { BehaviorSubject, Observable } from 'rxjs';

export interface AmbientTrack {
  id: string;
  name: string;
  path: string;
  volume: number;
  howl?: Howl;
  isMuted: boolean;
  isPlaying: boolean;
  previousVolume?: number; // Added for unmuting
}

@Injectable({
  providedIn: 'root'
})
export class AmbientAudioService {
  private tracks: AmbientTrack[] = [
    { id: 'rain', name: 'Rain', path: 'assets/audio/calming-rain.mp3', volume: 0, isMuted: false, isPlaying: false },
    { id: 'cricket', name: 'Cricket', path: 'assets/audio/cricket-sound.mp3', volume: 0, isMuted: false, isPlaying: false },
    { id: 'ocean', name: 'Ocean', path: 'assets/audio/ocean-waves.mp3', volume: 0, isMuted: false, isPlaying: false }
  ];

  // Reactive state management
  private tracksSubject = new BehaviorSubject<AmbientTrack[]>(this.tracks);
  public tracks$: Observable<AmbientTrack[]> = this.tracksSubject.asObservable();

  private mainAudioPlaying = false;
  private mainAudioPaused = false;
  private debugEnabled = true;
  
  // CRITICAL FIX: Enhanced track management
  private initializationInProgress = false;
  private failedTracks = new Set<string>();
  private retryAttempts = new Map<string, number>();
  private maxRetryAttempts = 3;
  private retryDelay = 2000; // 2 seconds between retries

  constructor() {
    this.initializeTracks();
  }

  private log(message: string, data?: any) {
    if (this.debugEnabled) {
      console.log(`🌧️ [AmbientAudio] ${message}`, data || '');
    }
  }

  // CRITICAL FIX: Enhanced track initialization with proper error handling
  private initializeTracks() {
    if (this.initializationInProgress) {
      this.log('Initialization already in progress, skipping...');
      return;
    }
    
    this.initializationInProgress = true;
    this.log('Initializing ambient tracks...');
    
    // CRITICAL FIX: Initialize tracks sequentially to prevent conflicts
    this.initializeTrackSequentially(0);
  }

  // CRITICAL FIX: Initialize tracks one by one to prevent audio context conflicts
  private initializeTrackSequentially(index: number) {
    if (index >= this.tracks.length) {
      this.initializationInProgress = false;
      this.log('All tracks initialized');
      return;
    }

    const track = this.tracks[index];
    this.log(`Creating Howl instance for ${track.name} (${index + 1}/${this.tracks.length})`);
    
    try {
      const sound = new Howl({
        src: [track.path],
        loop: true,
        volume: 0, // Start muted
        html5: true,
        preload: true,
        onload: () => {
          this.log(`${track.name} loaded successfully`);
          track.isPlaying = false;
          this.failedTracks.delete(track.id);
          this.retryAttempts.delete(track.id);
          
          // Initialize next track after a small delay
          setTimeout(() => {
            this.initializeTrackSequentially(index + 1);
          }, 100);
        },
        onloaderror: (_, error) => {
          this.log(`❌ Error loading ${track.name}:`, error);
          this.handleTrackLoadError(track, index);
        },
        onplayerror: (_, error) => {
          this.log(`❌ Play error for ${track.name}:`, error);
          this.handleTrackPlayError(track);
        },
        onplay: () => {
          this.log(`${track.name} started playing`);
          track.isPlaying = true;
        },
        onpause: () => {
          this.log(`${track.name} paused`);
          track.isPlaying = false;
        },
        onstop: () => {
          this.log(`${track.name} stopped`);
          track.isPlaying = false;
        },
        onend: () => {
          this.log(`${track.name} reached end, restarting...`);
          // CRITICAL FIX: Enhanced restart logic with better conditions
          this.handleTrackEnd(track);
        }
      });

      track.howl = sound;
      
      // CRITICAL FIX: Add timeout for track loading
      setTimeout(() => {
        if (!track.howl || track.howl.state() === 'unloaded') {
          this.log(`⚠️ ${track.name} failed to load within timeout`);
          this.handleTrackLoadError(track, index);
        }
      }, 10000); // 10 second timeout
      
    } catch (error) {
      this.log(`❌ Exception creating Howl for ${track.name}:`, error);
      this.handleTrackLoadError(track, index);
    }
  }

  // CRITICAL FIX: Handle track load errors with retry logic
  private handleTrackLoadError(track: AmbientTrack, index: number) {
    const currentAttempts = this.retryAttempts.get(track.id) || 0;
    
    if (currentAttempts < this.maxRetryAttempts) {
      this.log(`🔄 Retrying ${track.name} (attempt ${currentAttempts + 1}/${this.maxRetryAttempts})`);
      this.retryAttempts.set(track.id, currentAttempts + 1);
      
      // Retry after delay
      setTimeout(() => {
        this.initializeTrackSequentially(index);
      }, this.retryDelay);
    } else {
      this.log(`❌ ${track.name} failed to load after ${this.maxRetryAttempts} attempts`);
      this.failedTracks.add(track.id);
      
      // Continue with next track
      setTimeout(() => {
        this.initializeTrackSequentially(index + 1);
      }, 100);
    }
  }

  // CRITICAL FIX: Handle track play errors
  private handleTrackPlayError(track: AmbientTrack) {
    if (track.howl) {
      track.howl.once('unlock', () => {
        this.log(`${track.name} unlocked, attempting to play`);
        if (track.howl && track.volume > 0 && !track.isMuted) {
          track.howl.play();
        }
      });
    }
  }

  // CRITICAL FIX: Enhanced track end handling
  private handleTrackEnd(track: AmbientTrack) {
    // FIXED: Simplified restart logic - restart if volume > 0 and not muted, regardless of main audio state
    if (track.howl && track.volume > 0 && !track.isMuted) {
      this.log(`🔄 Restarting ${track.name} from beginning`);
      try {
        track.howl.seek(0);
        track.howl.play();
      } catch (error) {
        this.log(`❌ Error restarting ${track.name}:`, error);
      }
    } else {
      this.log(`${track.name} not restarting - conditions not met:`, {
        volume: track.volume,
        isMuted: track.isMuted,
        howlState: track.howl?.state()
      });
    }
  }

  // CRITICAL FIX: Enhanced retry method with better error handling
  private retryLoadTrack(track: AmbientTrack) {
    this.log(`Retrying load for ${track.name} with different strategy`);
    
    if (track.howl) {
      try {
        track.howl.unload();
      } catch (error) {
        this.log(`⚠️ Error unloading ${track.name}:`, error);
      }
    }

    const retrySound = new Howl({
      src: [track.path],
      loop: true,
      volume: 0,
      html5: true,
      preload: false, // Try without preload for problematic devices
      onload: () => {
        this.log(`${track.name} loaded successfully on retry`);
        track.howl = retrySound;
        track.isPlaying = false;
        this.failedTracks.delete(track.id);
      },
      onloaderror: (_, error) => {
        this.log(`❌ Failed to load ${track.name} even on retry:`, error);
        this.failedTracks.add(track.id);
      }
    });
  }

  getTracks(): AmbientTrack[] {
    this.log('Getting tracks:', this.tracks.map(t => ({
      id: t.id,
      name: t.name,
      volume: t.volume,
      isPlaying: t.isPlaying,
      isMuted: t.isMuted,
      hasHowl: !!t.howl,
      howlState: t.howl?.state()
    })));
    return this.tracks;
  }

  // CRITICAL FIX: Enhanced volume management with comprehensive validation
  setVolume(trackId: string, volume: number) {
    const track = this.tracks.find(t => t.id === trackId);
    
    // CRITICAL FIX: Validate track exists and is not failed
    if (!track) {
      this.log(`❌ Track not found: ${trackId}`);
      return;
    }
    
    if (this.failedTracks.has(trackId)) {
      this.log(`⚠️ Track ${track.name} failed to load, cannot set volume`);
      return;
    }
    
    if (!track.howl) {
      this.log(`⚠️ Track ${track.name} has no Howl instance`);
      return;
    }
    
    // CRITICAL FIX: Validate volume value
    if (typeof volume !== 'number' || isNaN(volume)) {
      this.log(`❌ Invalid volume value for ${track.name}:`, volume);
      return;
    }
    
    const oldVolume = track.volume;
    track.volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
    
    // Update mute state based on volume
    track.isMuted = track.volume === 0;
    
    // Emit state change for reactive updates
    this.tracksSubject.next([...this.tracks]);
    
    this.log(`${track.name} volume change:`, {
      oldVolume,
      newVolume: track.volume,
      isMuted: track.isMuted,
      mainAudioPlaying: this.mainAudioPlaying,
      mainAudioPaused: this.mainAudioPaused,
      howlPlaying: track.howl.playing(),
      howlState: track.howl.state(),
      failedTrack: this.failedTracks.has(trackId)
    });
    
    // CRITICAL FIX: Enhanced condition checking
    const shouldPlay = !track.isMuted && 
                      this.mainAudioPlaying && 
                      !this.mainAudioPaused && 
                      track.volume > 0 &&
                      track.howl.state() === 'loaded';
    
    if (shouldPlay) {
      this.log(`${track.name} updating howler volume to ${track.volume}`);
      
      try {
        if (track.howl.playing()) {
          // Fade to new volume if already playing
          track.howl.fade(track.howl.volume(), track.volume, 200);
        } else {
          // Set volume and start playing
          track.howl.volume(track.volume);
          this.log(`${track.name} starting playback (volume > 0)`);
          track.howl.play();
        }
      } catch (error) {
        this.log(`❌ Error playing ${track.name}:`, error);
      }
    } else if (track.volume === 0 && track.howl.playing()) {
      // Fade out and stop if volume is 0
      this.log(`${track.name} fading out and stopping (volume = 0)`);
      try {
        track.howl.fade(track.howl.volume(), 0, 500);
        setTimeout(() => {
          if (track.howl && track.volume === 0) {
            this.log(`${track.name} stopping after fade`);
            track.howl.stop();
          }
        }, 500);
      } catch (error) {
        this.log(`❌ Error stopping ${track.name}:`, error);
      }
    } else {
      this.log(`${track.name} volume change ignored - conditions not met:`, {
        isMuted: track.isMuted,
        mainAudioPlaying: this.mainAudioPlaying,
        mainAudioPaused: this.mainAudioPaused,
        volume: track.volume,
        howlState: track.howl.state()
      });
    }
  }

  // Method to toggle mute for a specific track
  toggleMute(trackId: string): void {
    const track = this.tracks.find(t => t.id === trackId);
    
    if (!track) {
      this.log(`❌ Track not found: ${trackId}`);
      return;
    }
    
    if (track.isMuted) {
      // Unmute - restore to previous volume or 1
      const newVolume = track.previousVolume || 1;
      this.log(`${track.name} unmuting to volume ${newVolume}`);
      track.isMuted = false;
      this.setVolume(trackId, newVolume);
    } else {
      // Mute - store current volume and set to 0
      track.previousVolume = track.volume;
      this.log(`${track.name} muting (previous volume: ${track.previousVolume})`);
      track.isMuted = true;
      this.setVolume(trackId, 0);
    }
  }

  // CRITICAL FIX: New method to coordinate with seek operations
  onMainAudioSeek() {
    this.log('Main audio seeking - temporarily pausing ambient audio');
    
    // Temporarily pause all ambient tracks during seek
    this.tracks.forEach(track => {
      if (track.howl && track.howl.playing()) {
        this.log(`${track.name} pausing during seek`);
        track.howl.pause();
      }
    });
  }

  // CRITICAL FIX: New method to resume after seek operations
  onMainAudioSeekComplete() {
    this.log('Main audio seek complete - resuming ambient audio');
    
    // Resume ambient tracks if they should be playing
    this.tracks.forEach(track => {
      if (track.howl && track.volume > 0 && !track.isMuted && this.mainAudioPlaying && !this.mainAudioPaused) {
        this.log(`${track.name} resuming after seek`);
        track.howl.volume(track.volume);
        if (!track.howl.playing()) {
          track.howl.play();
        }
      }
    });
  }

  getVolume(trackId: string): number {
    const track = this.tracks.find(t => t.id === trackId);
    return track ? track.volume : 0;
  }

  // Called when main audio starts playing
  onMainAudioPlay() {
    this.log('Main audio started playing');
    this.mainAudioPlaying = true;
    this.mainAudioPaused = false;
    
    this.tracks.forEach(track => {
      if (track.howl && track.volume > 0 && !track.isMuted) {
        this.log(`${track.name} resuming with main audio`);
        track.howl.volume(track.volume);
        if (!track.howl.playing()) {
          track.howl.play();
        }
      } else {
        this.log(`${track.name} not resuming:`, {
          volume: track.volume,
          isMuted: track.isMuted,
          howlExists: !!track.howl
        });
      }
    });
  }

  // Called when main audio is paused
  onMainAudioPause() {
    this.log('Main audio paused');
    this.mainAudioPaused = true;
    
    this.tracks.forEach(track => {
      if (track.howl && track.howl.playing()) {
        this.log(`${track.name} pausing with main audio`);
        track.howl.pause();
      }
    });
  }

  // Called when main audio resumes
  onMainAudioResume() {
    this.log('Main audio resumed');
    this.mainAudioPaused = false;
    
    this.tracks.forEach(track => {
      if (track.howl && track.volume > 0 && !track.isMuted) {
        this.log(`${track.name} resuming with main audio`);
        track.howl.volume(track.volume);
        if (!track.howl.playing()) {
          track.howl.play();
        }
      }
    });
  }

  // Called when switching to a new song (mute all tracks)
  onMainAudioSwitch() {
    this.log('Main audio switching to new song - muting all ambient tracks');
    
    this.tracks.forEach(track => {
      this.log(`${track.name} muting due to audio switch`);
      track.isMuted = true;
      track.volume = 0; // Reset volume to 0
      if (track.howl && track.howl.playing()) {
        this.log(`${track.name} fading out due to audio switch`);
        track.howl.fade(track.howl.volume(), 0, 500);
        setTimeout(() => {
          if (track.howl && track.isMuted) {
            this.log(`${track.name} stopping after fade due to audio switch`);
            track.howl.stop();
          }
        }, 500);
      }
    });
  }

  // NEW: Handle app state changes (background/foreground)
  onAppStateChange(isActive: boolean) {
    this.log(`App state changed: ${isActive ? 'active' : 'inactive'}`);
    
    if (isActive) {
      // App became active - check if main audio is actually playing
      this.checkMainAudioStateOnResume();
    } else {
      // App went to background - pause ambient tracks if main audio is not playing
      if (!this.mainAudioPlaying || this.mainAudioPaused) {
        this.log('App going to background with no main audio - pausing ambient tracks');
        this.pauseAll();
      }
    }
  }

  // NEW: Check main audio state when app resumes
  private checkMainAudioStateOnResume() {
    this.log('Checking main audio state on app resume');
    
    // If main audio is not playing or is paused, ensure ambient tracks are also stopped
    if (!this.mainAudioPlaying || this.mainAudioPaused) {
      this.log('Main audio not playing on resume - stopping ambient tracks');
      this.stopAll();
    } else {
      this.log('Main audio is playing on resume - ambient tracks can continue');
    }
  }

  // NEW: Method to check if main audio is actually playing (for external audio focus handling)
  isMainAudioActuallyPlaying(): boolean {
    return this.mainAudioPlaying && !this.mainAudioPaused;
  }

  // NEW: Method to handle external audio focus loss (when another app plays audio)
  onExternalAudioFocusLoss() {
    this.log('External audio focus lost - pausing ambient tracks');
    this.pauseAll();
  }

  // NEW: Method to handle external audio focus gain (when other app stops playing)
  onExternalAudioFocusGain() {
    this.log('External audio focus gained - checking if ambient tracks should resume');
    if (this.isMainAudioActuallyPlaying()) {
      this.log('Main audio is playing - resuming ambient tracks');
      this.resumeAll();
    } else {
      this.log('Main audio is not playing - keeping ambient tracks paused');
    }
  }

  // NEW: Method to handle audio focus loss from main audio player
  onMainAudioFocusLoss() {
    this.log('Main audio focus lost - pausing ambient tracks');
    this.pauseAll();
  }

  // NEW: Method to handle audio focus gain for main audio player
  onMainAudioFocusGain() {
    this.log('Main audio focus gained - checking if ambient tracks should resume');
    if (this.isMainAudioActuallyPlaying()) {
      this.log('Main audio is playing - resuming ambient tracks');
      this.resumeAll();
    } else {
      this.log('Main audio is not playing - keeping ambient tracks paused');
    }
  }

  // Called when main audio stops completely
  onMainAudioStop() {
    this.log('Main audio stopped completely');
    this.mainAudioPlaying = false;
    this.mainAudioPaused = false;
    
    this.tracks.forEach(track => {
      this.log(`${track.name} stopping with main audio`);
      track.isMuted = false; // Reset mute state
      if (track.howl && track.howl.playing()) {
        track.howl.stop();
      }
    });
  }

  pauseAll() {
    this.log('Pausing all ambient tracks');
    this.tracks.forEach(track => {
      if (track.howl && track.howl.playing()) {
        this.log(`${track.name} pausing`);
        track.howl.pause();
      }
    });
  }

  resumeAll() {
    this.log('Resuming all ambient tracks');
    this.tracks.forEach(track => {
      if (track.howl && track.volume > 0 && !track.isMuted && this.mainAudioPlaying && !this.mainAudioPaused) {
        this.log(`${track.name} resuming`);
        track.howl.volume(track.volume);
        if (!track.howl.playing()) {
          track.howl.play();
        }
      } else {
        this.log(`${track.name} not resuming:`, {
          volume: track.volume,
          isMuted: track.isMuted,
          mainAudioPlaying: this.mainAudioPlaying,
          mainAudioPaused: this.mainAudioPaused
        });
      }
    });
  }

  stopAll() {
    this.log('Stopping all ambient tracks');
    this.tracks.forEach(track => {
      if (track.howl) {
        this.log(`${track.name} stopping`);
        track.howl.stop();
        track.isMuted = false; // Reset mute state
      }
    });
  }

  isAnyPlaying(): boolean {
    const anyPlaying = this.tracks.some(track => track.howl && track.howl.playing());
    this.log(`Checking if any tracks are playing: ${anyPlaying}`);
    return anyPlaying;
  }

  // Force restart all tracks from beginning
  restartAllTracks() {
    this.log('Force restarting all tracks from beginning');
    this.tracks.forEach(track => {
      if (track.howl && track.volume > 0 && !track.isMuted && this.mainAudioPlaying && !this.mainAudioPaused) {
        this.log(`${track.name} force restarting`);
        track.howl.seek(0);
        if (!track.howl.playing()) {
          track.howl.play();
        }
      }
    });
  }

  // CRITICAL FIX: Enhanced debug method with failure tracking
  getDebugState() {
    return {
      mainAudioPlaying: this.mainAudioPlaying,
      mainAudioPaused: this.mainAudioPaused,
      failedTracks: Array.from(this.failedTracks),
      retryAttempts: Object.fromEntries(this.retryAttempts),
      tracks: this.tracks.map(track => ({
        id: track.id,
        name: track.name,
        volume: track.volume,
        isMuted: track.isMuted,
        isPlaying: track.isPlaying,
        howlPlaying: track.howl?.playing() || false,
        howlState: track.howl?.state() || 'null',
        failed: this.failedTracks.has(track.id)
      }))
    };
  }

  // CRITICAL FIX: New method to validate track state
  validateTrackState(trackId: string): boolean {
    const track = this.tracks.find(t => t.id === trackId);
    if (!track) {
      this.log(`❌ Track not found: ${trackId}`);
      return false;
    }
    
    if (this.failedTracks.has(trackId)) {
      this.log(`⚠️ Track ${track.name} failed to load`);
      return false;
    }
    
    if (!track.howl) {
      this.log(`⚠️ Track ${track.name} has no Howl instance`);
      return false;
    }
    
    if (track.howl.state() !== 'loaded') {
      this.log(`⚠️ Track ${track.name} is not loaded, state: ${track.howl.state()}`);
      return false;
    }
    
    return true;
  }

  // CRITICAL FIX: New method to recover failed tracks
  recoverFailedTrack(trackId: string): void {
    if (!this.failedTracks.has(trackId)) {
      this.log(`Track ${trackId} is not marked as failed`);
      return;
    }
    
    this.log(`🔄 Attempting to recover failed track: ${trackId}`);
    this.failedTracks.delete(trackId);
    this.retryAttempts.delete(trackId);
    
    // Find track index and reinitialize
    const trackIndex = this.tracks.findIndex(t => t.id === trackId);
    if (trackIndex !== -1) {
      this.initializeTrackSequentially(trackIndex);
    }
  }

  // CRITICAL FIX: New method to force restart all tracks
  forceRestartAllTracks(): void {
    this.log('🔄 Force restarting all tracks');
    
    this.tracks.forEach(track => {
      if (track.howl && track.howl.state() === 'loaded') {
        try {
          track.howl.stop();
          track.howl.seek(0);
          if (track.volume > 0 && !track.isMuted && this.mainAudioPlaying && !this.mainAudioPaused) {
            track.howl.play();
          }
        } catch (error) {
          this.log(`❌ Error force restarting ${track.name}:`, error);
        }
      }
    });
  }

  // CRITICAL FIX: New method to check if all tracks are working
  areAllTracksWorking(): boolean {
    const workingTracks = this.tracks.filter(track => 
      track.howl && 
      track.howl.state() === 'loaded' && 
      !this.failedTracks.has(track.id)
    );
    
    const allWorking = workingTracks.length === this.tracks.length;
    this.log(`Track status: ${workingTracks.length}/${this.tracks.length} working`);
    
    return allWorking;
  }

  // Volume control methods for fullscreen player
  setWavesVolume(volume: number): void {
    const oceanTrack = this.tracks.find(track => track.id === 'ocean');
    if (oceanTrack && oceanTrack.howl) {
      oceanTrack.volume = volume;
      oceanTrack.howl.volume(volume);
      this.log(`Waves volume set to: ${volume}`);
    }
  }

  setRainVolume(volume: number): void {
    const rainTrack = this.tracks.find(track => track.id === 'rain');
    if (rainTrack && rainTrack.howl) {
      rainTrack.volume = volume;
      rainTrack.howl.volume(volume);
      this.log(`Rain volume set to: ${volume}`);
    }
  }

  setChimesVolume(volume: number): void {
    const cricketTrack = this.tracks.find(track => track.id === 'cricket');
    if (cricketTrack && cricketTrack.howl) {
      cricketTrack.volume = volume;
      cricketTrack.howl.volume(volume);
      this.log(`Chimes volume set to: ${volume}`);
    }
  }
}
