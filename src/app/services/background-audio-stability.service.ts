import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, interval, fromEvent, merge, Subject } from 'rxjs';
import { map, filter, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { R2AudioService } from './r2-audio.service';

export interface BackgroundAudioState {
  isAppActive: boolean;
  isNetworkConnected: boolean;
  networkType: string;
  hasAudioFocus: boolean;
  lastUrlRefresh: number;
  urlExpiryTime: number;
  playbackErrors: number;
  consecutiveErrors: number;
}

@Injectable({
  providedIn: 'root'
})
export class BackgroundAudioStabilityService {
  private audioState = new BehaviorSubject<BackgroundAudioState>({
    isAppActive: true,
    isNetworkConnected: true,
    networkType: 'unknown',
    hasAudioFocus: true,
    lastUrlRefresh: 0,
    urlExpiryTime: 0,
    playbackErrors: 0,
    consecutiveErrors: 0
  });

  private destroy$ = new Subject<void>();
  private appStateListener: any;
  private stabilityCheckInterval: any;

  audioState$ = this.audioState.asObservable();

  constructor(
    private ngZone: NgZone,
    private r2AudioService: R2AudioService
  ) {
    this.initializeBackgroundMonitoring();
  }

  /**
   * Initialize background monitoring for audio stability
   */
  private async initializeBackgroundMonitoring(): Promise<void> {
    console.log('🔧 Initializing background audio stability monitoring...');

    // Monitor app state changes
    this.appStateListener = App.addListener('appStateChange', ({ isActive }) => {
      this.ngZone.run(() => {
        const currentState = this.audioState.getValue();
        this.audioState.next({
          ...currentState,
          isAppActive: isActive
        });
        console.log('📱 App state changed:', isActive ? 'active' : 'background');
      });
    });

    // Network monitoring is disabled due to dependency conflicts
    // Audio will work without network monitoring
    console.log('ℹ️ Network monitoring disabled - audio will work normally');
    
    // Set default network state to connected
    const currentState = this.audioState.getValue();
    this.audioState.next({
      ...currentState,
      isNetworkConnected: true,
      networkType: 'unknown'
    });

    // Start stability monitoring
    this.startStabilityMonitoring();
  }

  /**
   * Start monitoring audio stability
   */
  private startStabilityMonitoring(): void {
    // Check stability every 30 seconds
    this.stabilityCheckInterval = setInterval(() => {
      this.checkAudioStability();
    }, 30000);

    console.log('✅ Background audio stability monitoring started');
  }

  /**
   * Check audio stability and take corrective actions
   */
  private checkAudioStability(): void {
    const currentState = this.audioState.getValue();
    
    // Check if we're in a problematic state
    const isProblematic = !currentState.isNetworkConnected || 
                         currentState.consecutiveErrors > 3 ||
                         (currentState.urlExpiryTime > 0 && 
                          Date.now() > currentState.urlExpiryTime - (2 * 60 * 1000)); // 2 minutes before expiry

    if (isProblematic) {
      console.warn('⚠️ Audio stability issues detected:', currentState);
      this.handleStabilityIssues();
    }
  }

  /**
   * Handle detected stability issues
   */
  private handleStabilityIssues(): void {
    const currentState = this.audioState.getValue();
    
    if (!currentState.isNetworkConnected) {
      console.log('🌐 Network disconnected, waiting for reconnection...');
      // Network will be handled by the network listener
    }
    
    if (currentState.consecutiveErrors > 3) {
      console.log('❌ Too many consecutive errors, resetting error count...');
      this.resetErrorCount();
    }
    
    if (currentState.urlExpiryTime > 0 && 
        Date.now() > currentState.urlExpiryTime - (2 * 60 * 1000)) {
      console.log('🔄 URL expiring soon, triggering refresh...');
      this.triggerUrlRefresh();
    }
  }

  /**
   * Update URL information (no expiration)
   */
  updateUrlExpiryInfo(audioUrl: string): void {
    if (!audioUrl) return;

    const urlInfo = this.r2AudioService.getUrlInfo(audioUrl);
    
    const currentState = this.audioState.getValue();
    this.audioState.next({
      ...currentState,
      lastUrlRefresh: Date.now(),
      urlExpiryTime: 0 // No expiration
    });

    console.log('🕐 URL info updated:', {
      urlAge: urlInfo.minutesOld + ' minutes',
      isValid: urlInfo.isValid
    });
  }

  /**
   * Record a playback error
   */
  recordPlaybackError(): void {
    const currentState = this.audioState.getValue();
    this.audioState.next({
      ...currentState,
      playbackErrors: currentState.playbackErrors + 1,
      consecutiveErrors: currentState.consecutiveErrors + 1
    });

    console.log('❌ Playback error recorded:', {
      totalErrors: currentState.playbackErrors + 1,
      consecutiveErrors: currentState.consecutiveErrors + 1
    });
  }

  /**
   * Record successful playback
   */
  recordSuccessfulPlayback(): void {
    const currentState = this.audioState.getValue();
    this.audioState.next({
      ...currentState,
      consecutiveErrors: 0
    });

    if (currentState.consecutiveErrors > 0) {
      console.log('✅ Successful playback, resetting consecutive error count');
    }
  }

  /**
   * Reset error count
   */
  private resetErrorCount(): void {
    const currentState = this.audioState.getValue();
    this.audioState.next({
      ...currentState,
      consecutiveErrors: 0
    });
  }

  /**
   * Trigger URL refresh
   */
  private triggerUrlRefresh(): void {
    // This will be handled by the global audio player component
    console.log('🔄 URL refresh triggered by stability service');
  }

  /**
   * Check if audio should be paused due to stability issues
   */
  shouldPauseAudio(): boolean {
    const currentState = this.audioState.getValue();
    
    // Pause if network is disconnected or too many consecutive errors
    return !currentState.isNetworkConnected || currentState.consecutiveErrors > 5;
  }

  /**
   * Check if URL refresh is needed
   */
  isUrlRefreshNeeded(): boolean {
    // URLs don't expire, so refresh is never needed
    return false;
  }

  /**
   * Get current stability status
   */
  getStabilityStatus(): BackgroundAudioState {
    return this.audioState.getValue();
  }

  /**
   * Check if background playback is stable
   */
  isBackgroundPlaybackStable(): boolean {
    const currentState = this.audioState.getValue();
    
    return currentState.isNetworkConnected && 
           currentState.consecutiveErrors <= 2 &&
           (!currentState.urlExpiryTime || 
            Date.now() < currentState.urlExpiryTime - (5 * 60 * 1000)); // 5 minutes before expiry
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    if (this.appStateListener) {
      this.appStateListener.remove();
    }
    
    if (this.stabilityCheckInterval) {
      clearInterval(this.stabilityCheckInterval);
    }
    
    console.log('🧹 Background audio stability service destroyed');
  }
}
