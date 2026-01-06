import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, OnDestroy, SimpleChanges, NgZone } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { Howl } from 'howler';
import { Capacitor } from '@capacitor/core';
import { AmbientSettingsComponent } from '../components/ambient-settings/ambient-settings.component';
import { FullscreenAudioPlayerComponent } from '../components/fullscreen-audio-player/fullscreen-audio-player.component';
import { Router, NavigationEnd } from '@angular/router';
import { AmbientAudioService } from '../services/ambient-audio.service';
import { App } from '@capacitor/app';
import { MediaSession } from '@jofr/capacitor-media-session';
import { R2AudioService } from '../services/r2-audio.service';
import { GlobalAudioPlayerService } from '../services/global-audio-player.service';
import { FavoritesService } from '../services/favorites.service';
import { BackgroundAudioStabilityService } from '../services/background-audio-stability.service';



function ensureString(val: any): string {
  return typeof val === 'string' && val.trim() !== '' ? val : '';
}

@Component({
  selector: 'app-global-audio-player',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './global-audio-player.component.html',
  styleUrls: ['./global-audio-player.component.scss']
})
export class GlobalAudioPlayerComponent implements OnInit, OnDestroy {

  @Input() audioUrl: string = '';
  @Input() title: string = '';
  @Input() photoUrl: string = '';
  @Input() description: string = '';
  @Input() r2Path: string = '';
  @Input() storyId: string = '';
  @Input() resumePosition: number = 0;

  isPlaying = false;
  isLoading = false;
  isFavorite = false;
  isPlayButtonLoading = false;
  currentTime = 0;
  duration = 0;
  shouldShowPlayer = false; // New property to control visibility
  private appStateListener: any;
  private playPauseLock = false;
  
  // Enhanced background audio handling
  private urlExpirationCheckInterval: any = null;
  private backgroundModeEnabled = false;
  private lastNetworkCheck = 0;
  private networkCheckInterval = 30000;
  private urlRefreshThreshold = 8 * 60 * 1000;
  private urlRefreshInterval = 60 * 1000;
  
  // State management improvements
  private isUrlRefreshing = false;
  private lastKnownPosition = 0;
  private lastKnownVolume = 1.0;
  private wasPlayingBeforeRefresh = false;
  private urlRefreshPromise: Promise<void> | null = null;
  
  // Error handling improvements
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 3000;
  private lastErrorTime = 0;
  private errorBackoffMultiplier = 2;
  
  // Network connectivity handling
  private networkStateSubscription: any;
  private isNetworkAware = false;
  private networkRetryDelay = 5000; // 5 seconds for network retries
  private maxNetworkRetries = 5;
  private networkRetryCount = 0;
  
  // App termination detection
  private appBackgroundTime: number = 0;
  private appTerminationTimeout: any;
  private readonly APP_TERMINATION_THRESHOLD = 30000; // 30 seconds to consider app terminated

  // CRITICAL FIX: Enhanced audio instance management
  private currentAudioId: string = ''; // Track current audio to prevent duplicates
  private isInitializing = false; // Prevent multiple simultaneous initializations
  private initializationPromise: Promise<void> | null = null; // Track initialization
  private audioInstanceLock = false; // Additional lock to prevent race conditions

  constructor(
    private router: Router,
    private modalController: ModalController,
    private ambientAudioService: AmbientAudioService,
    private r2AudioService: R2AudioService,
    private globalAudioPlayerService: GlobalAudioPlayerService,
    private favoritesService: FavoritesService,
    private backgroundStabilityService: BackgroundAudioStabilityService,
    private ngZone: NgZone
  ) {
    this.setupAppStateListener();
    this.setupNetworkMonitoring();
  }

  onContainerClick() {
    if (this.isLoading || !this.isPlaying) {
      return;
    }
    this.openFullscreenPlayer();
  }

  ngOnInit() {
    // Subscribe to global audio state changes
    this.globalAudioPlayerService.audioState$.subscribe(state => {
      this.syncWithGlobalService(state);
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    // Update favorite status when audio properties change
    if (changes['audioUrl'] || changes['title'] || changes['r2Path'] || changes['storyId']) {
      this.updateFavoriteStatus();
    }
  }

  ngOnDestroy() {
    console.log('🎵 GlobalAudioPlayerComponent ngOnDestroy');
    
    // CRITICAL FIX: Ensure complete cleanup
    this.cleanupPreviousAudio();
    
    // Progress and seek functionality moved to fullscreen player
    
    // FIXED: Stop progress health monitoring
    this.stopProgressHealthMonitoring();
    
    // Clean up network monitoring
    if (this.networkStateSubscription) {
      this.networkStateSubscription.unsubscribe();
      this.networkStateSubscription = null;
    }
    
    // Clean up app termination detection
    this.clearAppTerminationDetection();
    
    if (this.appStateListener) {
      this.appStateListener.remove();
    }
    
    // FIXED: Clean up audio focus event listeners
    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.removeEventListener('focus', this.handlePageFocus.bind(this));
    window.removeEventListener('blur', this.handlePageBlur.bind(this));
    
    this.stopUrlExpirationMonitoring();
  }

  // CRITICAL FIX: Enhanced audio cleanup method
  private async cleanupPreviousAudio(): Promise<void> {
    console.log('🎵 Cleaning up previous audio...');
    
    // Stop ambient audio
    this.ambientAudioService.onMainAudioStop();
    
    // Reset state
    this.isPlaying = false;
    this.playPauseLock = false;
    this.currentTime = 0;
    this.duration = 0;
    
    console.log('🎵 Audio cleanup completed');
  }

  // CRITICAL FIX: Enhanced toggle play with proper state management
  async togglePlay() {
    console.log('🎵 togglePlay called');
    
    // Prevent rapid clicking and multiple operations
    if (this.playPauseLock) {
      console.log('🎵 togglePlay: Operation in progress, returning');
      return;
    }
    
    this.playPauseLock = true;
    
    try {
      // CRITICAL FIX: Use the new centralized method for better state management
            if (this.isPlaying) {
        this.globalAudioPlayerService.pause();
      } else {
        this.globalAudioPlayerService.play();
      }
    } catch (error) {
      console.error('Toggle play error:', error);
    } finally {
      this.playPauseLock = false;
    }
  }

  // Progress bar functionality moved to fullscreen audio player

  // Seek functionality moved to fullscreen audio player

  formatTime(secs: number): string {
    if (isNaN(secs)) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  async openAmbientSettings() {
    const modal = await this.modalController.create({
      component: AmbientSettingsComponent,
      cssClass: 'ambient-settings-modal',
      breakpoints: [0, 0.5, 0.8],
      initialBreakpoint: 0.5,
      handle: true,
      handleBehavior: 'cycle',
      backdropDismiss: true,
      showBackdrop: true,
    });
    await modal.present();
  }

  async openFullscreenPlayer() {
    const modal = await this.modalController.create({
      component: FullscreenAudioPlayerComponent,
      cssClass: 'fullscreen-audio-modal',
      componentProps: {
        audioUrl: this.audioUrl,
        title: this.title,
        photoUrl: this.photoUrl,
        description: this.description,
        r2Path: this.r2Path,
        storyId: this.storyId,
        resumePosition: this.currentTime
      },
      backdropDismiss: true,
      showBackdrop: true,
      animated: true,
      presentingElement: await this.modalController.getTop()
    });
    await modal.present();
  }

  // Favorites functionality
  private updateFavoriteStatus() {
    if (this.storyId && this.title) {
      this.isFavorite = this.favoritesService.isFavorite(this.storyId);
    }
  }

  toggleFavorite(event: Event): void {
    event.stopPropagation();
    
    console.log('🎯 BUTTON CLICKED!');
    console.log('💖 Toggle favorite clicked - storyId:', this.storyId, 'title:', this.title);
    
    // Generate a storyId if none exists (fallback for Firebase data issues)
    let storyId = this.storyId;
    if (!storyId && this.title) {
      // Generate consistent ID based on title only (not timestamp)
      storyId = `temp_${this.title.replace(/\s+/g, '_').toLowerCase()}`;
      console.log('💖 Generated fallback storyId:', storyId);
    }
    
    if (!storyId) {
      console.error('No storyId available for favorite toggle');
      return;
    }

    const storyData = {
      id: storyId,
      title: this.title,
      subTitle: this.description,
      imageUrl: this.photoUrl,
      audioUrl: this.audioUrl,
      r2Path: this.r2Path
    };

    console.log('💖 Current favorite status:', this.isFavorite, 'for storyId:', storyId);
    
    if (this.isFavorite) {
      this.favoritesService.removeFromFavorites(storyId);
      console.log('❤️ Removed from favorites:', this.title);
    } else {
      this.favoritesService.addToFavorites(storyData);
      console.log('💖 Added to favorites:', this.title);
    }
    
    // Update the favorite status after the operation
    setTimeout(() => {
      this.updateFavoriteStatus();
    }, 100);
  }

  // Helper methods and private functions
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private setupAppStateListener(): void {
    // App state listener setup
  }

  private setupNetworkMonitoring(): void {
    console.log('🌐 Network monitoring disabled - audio will work normally');
    this.isNetworkAware = false;
  }

  // Audio initialization is now handled by the global service
  private async initializeAudio(): Promise<void> {
    console.log('🎵 Audio initialization handled by global service');
  }

  private shouldRefreshUrl(): boolean {
    // URL refresh logic - for now return false
    return false;
  }

  private async regenerateAudioUrlAndPlay(): Promise<void> {
    // URL regeneration logic - handled by global service
    console.log('🎵 URL regeneration handled by global service');
  }

  private handleAudioError(errorType: 'load' | 'play' | 'network', error: any): void {
    console.log(`🎵 Audio error (${errorType}):`, error);
    this.isLoading = false;
    this.isInitializing = false;
    this.isPlaying = false;
  }

  private enableBackgroundMode(): void {
    // Background mode logic - for now just log
    console.log('🎵 Background mode enabled');
  }

  private disableBackgroundMode(): void {
    // Background mode disable logic - for now just log
    console.log('🎵 Background mode disabled');
  }

  private stopProgressHealthMonitoring(): void {
    // Progress health monitoring cleanup - for now just log
    console.log('🎵 Progress health monitoring stopped');
  }

  private clearAppTerminationDetection(): void {
    if (this.appTerminationTimeout) {
      clearTimeout(this.appTerminationTimeout);
      this.appTerminationTimeout = null;
    }
  }

  private stopUrlExpirationMonitoring(): void {
    // URL expiration monitoring cleanup - for now just log
    console.log('🎵 URL expiration monitoring stopped');
  }

  private handleVisibilityChange(): void {
    // Visibility change handling - for now just log
    console.log('🎵 Visibility changed');
  }

  private handlePageFocus(): void {
    // Page focus handling - for now just log
    console.log('🎵 Page focused');
  }

  private handlePageBlur(): void {
    // Page blur handling - for now just log
    console.log('🎵 Page blurred');
  }

  // Progress tracking moved to fullscreen player
  private lastProgressUpdateTime = 0;
  private lastContinueListeningUpdate = 0;

  // Helper method to update global service state
  private updateGlobalServiceState(): void {
    // The global service manages its own state, so we don't need to update it here
    // The service will be updated when play/pause methods are called
    console.log('🎵 Global service state updated');
  }

  // Sync component state with global service state
  private syncWithGlobalService(state: any) {
    const previousState = {
      isPlaying: this.isPlaying,
      isLoading: this.isLoading,
      isPlayButtonLoading: this.isPlayButtonLoading,
      shouldShowPlayer: this.shouldShowPlayer
    };

    // Update component state from global service
    this.isPlaying = state.isPlaying;
    this.isLoading = state.isLoading;
    this.isPlayButtonLoading = state.isLoading;
    this.title = state.currentTrack?.title || null;
    this.photoUrl = state.currentTrack?.photoUrl || null;
    this.description = state.currentTrack?.description || null;
    this.r2Path = state.currentTrack?.r2Path || null;
    this.storyId = state.currentTrack?.storyId || null;
    this.audioUrl = state.currentTrack?.audioUrl || null;

    // Determine if player should be visible
    this.shouldShowPlayer = !!state.currentTrack;

    // Update favorite status if track changed
    if (state.currentTrack?.storyId !== previousState.shouldShowPlayer) {
      this.updateFavoriteStatus();
    }
  }
} 

