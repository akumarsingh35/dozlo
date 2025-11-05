import { Component, AfterViewInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, IonRouterOutlet, Platform } from '@ionic/angular';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { StatusBar, Style } from '@capacitor/status-bar';
import { addIcons } from 'ionicons';
import { homeOutline, bookOutline, searchOutline, personOutline } from 'ionicons/icons';
import { GlobalAudioPlayerComponent } from './global-audio-player/global-audio-player.component';
import { NavFooterComponent } from './shared/nav-footer/nav-footer.component';
import { GlobalAudioPlayerService, AudioState } from './services/global-audio-player.service';
import { AuthService } from './core/auth.service';
import { BackButtonService } from './services/back-button.service';
import { HttpClientModule } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { MediaSession } from '@jofr/capacitor-media-session';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, HttpClientModule, NavFooterComponent, GlobalAudioPlayerComponent],
})

export class AppComponent implements AfterViewInit, OnDestroy {
  audioState: AudioState = { isPlaying: false, currentTrack: null, progress: 0, duration: 0, isLoading: false, loadingTrackId: '', currentTime: 0 };
  private audioSub: Subscription;
  showFooterAndAudio = true;
  private currentUrl = '/home';
  @ViewChild(IonRouterOutlet, { static: false }) routerOutlet!: IonRouterOutlet;

  constructor(
    private platform: Platform, 
    private globalAudioPlayer: GlobalAudioPlayerService,
    private authService: AuthService,
    private router: Router,
    private backButton: BackButtonService
  ) {
    addIcons({ homeOutline, bookOutline, searchOutline, personOutline });
    
    this.initializeApp();
    this.setupAppStateHandling();
    this.audioSub = this.globalAudioPlayer.audioState$.subscribe(state => {
      this.audioState = state;
      // Update CSS custom properties for dynamic padding
      this.updateContentPadding();
    });
    
    // Listen to route changes to hide footer and audio on sign-in page
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentUrl = event.urlAfterRedirects || event.url;
      // Hide footer/audio on auth and legal pages
      const pathOnly = this.currentUrl.split('?')[0];
      const hideOn = new Set<string>(['/sign-in', '/privacy-policy', '/terms-of-use']);
      this.showFooterAndAudio = !hideOn.has(pathOnly);
      // Update CSS custom properties when footer visibility changes
      this.updateContentPadding();
    });
  }

  /**
   * Setup app state change handling for notification cleanup
   */
  private setupAppStateHandling(): void {
    // Listen for app state changes to clean up notifications when app is closed
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('📱 App state changed:', isActive ? 'active' : 'inactive');
      
      if (!isActive) {
        // App is going to background - check if we need to clean up notifications
        this.checkNotificationCleanupOnBackground();
      }
    });

    // Listen for app resume to ensure clean state
    App.addListener('resume', () => {
      this.ensureCleanNotificationState();
    });
  }

  /**
   * Check if notifications should be cleaned up when app goes to background
   */
  private checkNotificationCleanupOnBackground(): void {
    // CRITICAL FIX: Do NOT clean up notifications when app goes to background
    // Only clean up when app is completely closed
    // This allows notifications to persist for background playback
    // Do nothing - keep notifications for background playback
  }

  /**
   * Force cleanup of all notifications - more aggressive approach
   */
  private forceCleanupNotifications(): void {
    if (Capacitor.isNativePlatform() && MediaSession) {
      
      try {
        // Set playback state to none
        MediaSession.setPlaybackState({ playbackState: 'none' });
        
        // Clear all metadata to ensure notification is completely removed
        MediaSession.setMetadata({
          title: '',
          artist: '',
          album: '',
          artwork: []
        });
        
        // Additional cleanup with multiple attempts to ensure removal
        setTimeout(() => {
          try {
            MediaSession.setPlaybackState({ playbackState: 'none' });
            MediaSession.setMetadata({
              title: '',
              artist: '',
              album: '',
              artwork: []
            });
          } catch (error) {
            console.warn('⚠️ Error during delayed notification cleanup:', error);
          }
        }, 50);
        
        setTimeout(() => {
          try {
            MediaSession.setPlaybackState({ playbackState: 'none' });
            MediaSession.setMetadata({
              title: '',
              artist: '',
              album: '',
              artwork: []
            });
          } catch (error) {
            console.warn('⚠️ Error during final notification cleanup:', error);
          }
        }, 200);
        
      } catch (error) {
        console.warn('⚠️ Error during force notification cleanup:', error);
      }
    }
  }

  /**
   * Ensure notification state is clean when app resumes
   */
  private ensureCleanNotificationState(): void {
    // Only clean up notifications if no audio is playing and app was completely closed
    // Do not clean up just because app resumed from background
    // Let the audio player component handle its own notification state
  }

  ngOnDestroy() {
    if (this.audioSub) {
      this.audioSub.unsubscribe();
    }
    
    // Clean up MediaSession notification when app is destroyed
    this.cleanupMediaSessionOnDestroy();
  }

  /**
   * Clean up MediaSession notification when app is destroyed
   */
  private cleanupMediaSessionOnDestroy(): void {
    if (Capacitor.isNativePlatform() && MediaSession) {
      
      try {
        // Set playback state to none
        MediaSession.setPlaybackState({ playbackState: 'none' });
        
        // Clear metadata to ensure notification is completely removed
        MediaSession.setMetadata({
          title: '',
          artist: '',
          album: '',
          artwork: []
        });
        
      } catch (error) {
        console.warn('⚠️ Error cleaning up MediaSession notification:', error);
      }
    }
  }

  initializeApp() {
    this.platform.ready().then(async () => {
      console.log('🚀 Platform ready in app component');
      
      // This is the crucial setting. 
      // `overlay: false` tells the app's webview to stay within the safe areas.
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#120f29' });
      
      // Initialize content padding
      this.updateContentPadding();

      // Native Firebase Analytics initialization (only on native platforms)
      try {
        if (Capacitor.isNativePlatform()) {
          // Ensure analytics collection enabled at runtime
          await FirebaseAnalytics.setEnabled({ enabled: true });

          // Log a lightweight test event to verify DebugView immediately
          await FirebaseAnalytics.logEvent({
            name: 'app_open',
            params: { platform: Capacitor.getPlatform() }
          });

          console.log('📈 Firebase Analytics (native) initialized and app_open logged');
        } else {
          console.log('📈 Skipping native Firebase Analytics initialization on web');
        }
      } catch (err) {
        console.warn('⚠️ Error initializing native Firebase Analytics:', err);
      }
      
      // Status bar configured above; back handler initialized after view init
      
      // Google Auth initialization is now handled in AuthService
    });
  }

  ngAfterViewInit(): void {
    // Ensure service is initialized even if platform becomes ready earlier
    if (this.routerOutlet) {
      this.backButton.init(this.routerOutlet);
    }
  }

  private updateContentPadding(): void {
    const footerHeight = 44; // Footer height in pixels
    const audioPlayerHeight = 56; // Audio player height in pixels
    const safeAreaBottom = this.getSafeAreaBottom();
    
    let paddingBottom: number;
    
    if (!this.showFooterAndAudio) {
      // No footer or audio player
      paddingBottom = safeAreaBottom;
    } else if (this.audioState.currentTrack) {
      // Footer + audio player
      paddingBottom = footerHeight + audioPlayerHeight + safeAreaBottom;
    } else {
      // Footer only
      paddingBottom = footerHeight + safeAreaBottom;
    }
    
    // Update CSS custom property
    document.documentElement.style.setProperty('--content-padding-bottom', `${paddingBottom}px`);
  }

  private getSafeAreaBottom(): number {
    // Get safe area bottom from CSS environment variable
    const safeArea = getComputedStyle(document.documentElement).getPropertyValue('--ion-safe-area-bottom');
    if (safeArea && safeArea !== 'env(safe-area-inset-bottom)') {
      return parseInt(safeArea) || 0;
    }
    return 0;
  }
}
