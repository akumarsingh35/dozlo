import { Component, CUSTOM_ELEMENTS_SCHEMA, QueryList, ElementRef, ViewChildren, OnInit, OnDestroy } from '@angular/core';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NavFooterComponent } from '../shared/nav-footer/nav-footer.component';
import { FirebaseDataService, FirebaseStory } from '../services/firebase-data.service';
import { R2AudioService } from '../services/r2-audio.service';
import { R2ImageService } from '../services/r2-image.service';
import { GlobalAudioPlayerService } from '../services/global-audio-player.service';
import { Subject, takeUntil } from 'rxjs';
import { FavoritesService } from '../services/favorites.service';
import { LibraryDataService, LibraryStory } from '../services/library-data.service';
import { OfflineDownloadManagerService } from '../services/offline-download-manager.service';
import { OfflineDownloadRecord, OfflineDownloadStatus } from '../services/offline-download-storage.service';
import { ConnectivityService } from '../services/connectivity.service';

interface LibraryDownloadStory extends FirebaseStory {
  downloadId: string;
  downloadStatus: OfflineDownloadStatus;
  downloadProgress: number;
}

@Component({
  selector: 'app-library',
  templateUrl: 'library.page.html',
  styleUrls: ['library.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, HttpClientModule, NavFooterComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // Add this to allow swiper elements
})
export class LibraryPage implements OnInit, OnDestroy {
  @ViewChildren('storySlider') set storySliderRefs(refs: QueryList<ElementRef>) {
    if (refs) {
      setTimeout(() => {
        refs.forEach((slider: ElementRef) => {
          if (slider.nativeElement.swiper) {
            slider.nativeElement.swiper.update();
          }
        });
      }, 150);
    }
  }

  continueListening: (FirebaseStory & { progress?: number })[] = [];
  recentlyPlayed: (FirebaseStory & { progress?: number })[] = [];
  yourFavorites: FirebaseStory[] = [];
  downloadStories: LibraryDownloadStory[] = [];
  isLoading = true;
  isOnline = true;
  downloadedOfflineCount = 0;

  private destroy$ = new Subject<void>();
  private allStoriesCache: FirebaseStory[] = [];
  private downloadRecordsCache: OfflineDownloadRecord[] = [];

  constructor(
    private firebaseDataService: FirebaseDataService,
    private r2AudioService: R2AudioService,
    private r2ImageService: R2ImageService,
    public globalAudioPlayer: GlobalAudioPlayerService,
    private favoritesService: FavoritesService,
    private libraryDataService: LibraryDataService,
    private offlineDownloadManager: OfflineDownloadManagerService,
    private connectivity: ConnectivityService,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    console.log('📚 LibraryPage ngOnInit - Loading global data...');
    this.loadGlobalData();
    this.loadFavorites();
    void this.offlineDownloadManager.initializeMaintenance();
    this.loadOfflineDownloads();
    this.connectivity.isOnline$
      .pipe(takeUntil(this.destroy$))
      .subscribe((online) => {
        this.isOnline = online;
      });
    
    // Fallback timeout to ensure content is displayed
    setTimeout(() => {
      if (this.isLoading) {
        console.log('📚 Library page - Loading timeout reached, showing content');
        this.isLoading = false;
      }
    }, 5000); // 5 second timeout
  }

  private loadGlobalData() {
    console.log('📚 Loading global data for library...');
    
    // Subscribe to data loaded state
    this.firebaseDataService.dataLoaded$.pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (loaded) => {
        if (loaded) {
          console.log('📚 Global data is loaded, getting stories...');
          this.getStoriesFromGlobalData();
        }
      }
    });
  }

  private getStoriesFromGlobalData() {
    // Get all stories from global service
    this.firebaseDataService.getAllStories().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        console.log('📚 Global stories received for library:', data.length);
        this.handleFirebaseData(data);
      },
      error: (error) => {
        console.error('📚 Error getting global stories for library:', error);
        // Set loading to false even if there's an error
        this.isLoading = false;
      }
    });
  }

  private handleFirebaseData(data: FirebaseStory[]) {
    console.log('📚 Processing Firebase data for library...');
    
    if (!data || !Array.isArray(data)) {
      console.warn('📚 No stories found in Firebase data');
      this.isLoading = false;
      return;
    }

    this.allStoriesCache = data;

    // Merge with local library data for continue listening and recently played
    const continueLib = this.libraryDataService.getContinueListening(20);
    const recentLib = this.libraryDataService.getRecentlyPlayed(20);

    // Map library stories to FirebaseStory shape where possible
    const mapLibToFirebase = (libStories: LibraryStory[]) => libStories.map(ls => {
      const fromFirebase = data.find(d => d.id === ls.id || d.title === ls.title);
      const merged: any = fromFirebase ? { ...fromFirebase } : { id: ls.id, title: ls.title };
      merged.subTitle = merged.subTitle || '';
      merged.imageUrl = merged.imageUrl || ls.imageUrl || '';
      merged.audioUrl = merged.audioUrl || ls.audioUrl || '';
      merged.r2Path = merged.r2Path || ls.r2Path || '';
      merged.progress = typeof ls.progress === 'number' ? Math.round(ls.progress * 100) : 0;
      return merged as FirebaseStory & { progress?: number };
    });

    this.continueListening = mapLibToFirebase(continueLib).slice(0, 10);
    this.recentlyPlayed = mapLibToFirebase(recentLib).slice(0, 20);

    console.log('📚 Continue listening stories:', this.continueListening.length);
    console.log('📚 Recently played stories:', this.recentlyPlayed.length);

    // Enrich stories with R2 URLs
    this.enrichStoriesWithR2Urls();
    this.buildDownloadStories();
    
    // Set loading to false after processing
    this.isLoading = false;
  }

  private enrichStoriesWithR2Urls() {
    console.log('📚 Enriching library stories with R2 URLs...');
    
    const allStories = [...this.continueListening, ...this.recentlyPlayed];
    console.log('📚 Total stories to enrich:', allStories.length);

    if (allStories.length === 0) {
      return;
    }

    // Enrich stories with R2 image URLs (synchronous since getSecureImageUrl returns string)
    allStories.forEach(story => {
      // Convert imagePath to imageUrl using R2 service
      if (story.imagePath && !story.imageUrl) {
        story.imageUrl = this.r2ImageService.getSecureImageUrl(story.imagePath);
      }
      
      // Convert audioPath to audioUrl using R2 service
      if (story.audioPath && !story.audioUrl) {
        story.audioUrl = this.r2AudioService.getAudioUrl(story.audioPath);
      }
      
      // Set r2Path for audio playback
      if (story.audioPath && !story.r2Path) {
        story.r2Path = story.audioPath;
      }
    });

    console.log('📚 Library stories enriched successfully');
  }

  private loadOfflineDownloads() {
    this.offlineDownloadManager.downloads$
      .pipe(takeUntil(this.destroy$))
      .subscribe((records) => {
        this.downloadRecordsCache = records;
        this.downloadedOfflineCount = records.filter((record) => record.status === 'downloaded').length;
        this.buildDownloadStories();
      });
  }

  private buildDownloadStories() {
    const relevantRecords = this.downloadRecordsCache
      .filter((record) => record.status !== 'cancelled')
      .sort((a, b) => b.updatedAt - a.updatedAt);

    this.downloadStories = relevantRecords.map((record) => {
      const fromFirebase = this.findMatchingStory(record);
      const fallbackDurationMinutes = this.getDurationMinutesFromRecord(record);
      const baseStory: FirebaseStory = fromFirebase
        ? { ...fromFirebase }
        : {
            id: record.storyId,
            title: record.title,
            subTitle: '',
            imageUrl: record.photoUrl || '',
            audioUrl: '',
            r2Path: record.r2Path,
            category: '',
            duration: fallbackDurationMinutes,
          };

      if (!baseStory.imageUrl && record.photoUrl) {
        baseStory.imageUrl = record.photoUrl;
      }

      if (!baseStory.r2Path && record.r2Path) {
        baseStory.r2Path = record.r2Path;
      }

      if ((!baseStory.duration || Number(baseStory.duration) <= 0) && fallbackDurationMinutes > 0) {
        baseStory.duration = fallbackDurationMinutes;
      }

      this.ensureStoryUrls(baseStory);

      return {
        ...baseStory,
        downloadId: record.id,
        downloadStatus: record.status,
        downloadProgress: Math.max(0, Math.min(100, Math.round(record.progress || 0))),
      };
    });
  }

  private findMatchingStory(record: OfflineDownloadRecord): FirebaseStory | undefined {
    const recordId = this.normalizeKey(record.storyId);
    const recordTitle = this.normalizeKey(record.title);

    return this.allStoriesCache.find((story) => {
      const storyId = this.normalizeKey(story.id);
      const storyTitle = this.normalizeKey(story.title);
      return storyId === recordId || storyTitle === recordTitle;
    });
  }

  private normalizeKey(value: string | undefined): string {
    return (value || '').trim().toLowerCase().replace(/\s+/g, '_');
  }

  private ensureStoryUrls(story: FirebaseStory) {
    if (story.imagePath && !story.imageUrl) {
      story.imageUrl = this.r2ImageService.getSecureImageUrl(story.imagePath);
    }

    if (story.audioPath && !story.audioUrl) {
      story.audioUrl = this.r2AudioService.getAudioUrl(story.audioPath);
    }

    if (story.audioPath && !story.r2Path) {
      story.r2Path = story.audioPath;
    }
  }

  private getDurationMinutesFromRecord(record: OfflineDownloadRecord): number {
    const seconds = Number(record.durationSeconds || 0);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return 0;
    }

    return Number((seconds / 60).toFixed(2));
  }

  private resolvePlaybackDurationMinutes(story: FirebaseStory): number {
    const storyDuration = Number(story.duration || 0);
    if (Number.isFinite(storyDuration) && storyDuration > 0) {
      return storyDuration;
    }

    const storyId = this.normalizeKey(story.id);
    const title = this.normalizeKey(story.title);
    const matchingRecord = this.downloadRecordsCache.find((record) => {
      return this.normalizeKey(record.storyId) === storyId || this.normalizeKey(record.title) === title;
    });

    return matchingRecord ? this.getDurationMinutesFromRecord(matchingRecord) : 0;
  }

  onDownloadCardClick(story: LibraryDownloadStory) {
    if (story.downloadStatus !== 'downloaded') {
      return;
    }

    this.onPlay(story);
  }

  async onDeleteDownloadedStory(story: LibraryDownloadStory, event: Event): Promise<void> {
    event.stopPropagation();

    if (!story.downloadId) {
      return;
    }

    const isInProgress = story.downloadStatus === 'queued' || story.downloadStatus === 'downloading';

    const alert = await this.alertController.create({
      header: isInProgress ? 'Cancel download?' : 'Delete offline download?',
      message: isInProgress
        ? `Stop downloading "${story.title}" and remove it from Downloads?`
        : `Remove "${story.title}" from offline downloads?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          role: 'destructive',
        },
      ],
    });

    await alert.present();
    const result = await alert.onDidDismiss();
    if (result.role !== 'destructive') {
      return;
    }

    await this.offlineDownloadManager.deleteDownload(story.downloadId);
    const toast = await this.toastController.create({
      message: isInProgress ? 'Download cancelled and removed.' : 'Removed from offline downloads.',
      duration: 1800,
      position: 'bottom',
    });
    await toast.present();
  }

  getDownloadRingProgress(story: LibraryDownloadStory): number {
    if (story.downloadStatus === 'queued') {
      return 5;
    }

    return Math.max(0, Math.min(100, story.downloadProgress || 0));
  }

  getDownloadProgressLabel(story: LibraryDownloadStory): string {
    if (story.downloadStatus === 'queued') {
      return 'Q';
    }
    return `${this.getDownloadRingProgress(story)}%`;
  }

  getDownloadStatusLabel(story: LibraryDownloadStory): string {
    if (story.downloadStatus === 'queued') {
      return 'Queued';
    }
    if (story.downloadStatus === 'downloading') {
      return 'Downloading';
    }
    if (story.downloadStatus === 'failed') {
      return 'Download failed';
    }
    return 'Downloaded';
  }

  trackByStoryId(index: number, story: FirebaseStory): string {
    const id = (story?.id || '').toString().trim();
    if (id) {
      return id;
    }

    const title = (story?.title || '').toString().trim().toLowerCase();
    if (title) {
      return title;
    }

    return `${index}`;
  }

  private loadFavorites() {
    console.log('📚 Loading favorites...');
    this.favoritesService.getFavorites().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (favorites) => {
        console.log('📚 Favorites loaded:', favorites.length);
        this.yourFavorites = favorites.map(fav => ({
          id: fav.id,
          title: fav.title,
          subTitle: fav.subTitle || '',
          imageUrl: fav.imageUrl || '',
          audioUrl: fav.audioUrl || '',
          r2Path: fav.r2Path || '',
          category: '',
          duration: 0,
          playCount: 0
        } as FirebaseStory));
        console.log('📚 Your favorites updated:', this.yourFavorites.length);
      },
      error: (error) => {
        console.error('📚 Error loading favorites:', error);
        this.yourFavorites = [];
      }
    });
  }

  onPlay(story: FirebaseStory) {
    console.log('📚 Play button clicked for:', story.title);
    const playbackDurationMinutes = this.resolvePlaybackDurationMinutes(story);
    
    // CRITICAL FIX: Use centralized audio service instead of duplicating logic
    const playRequest = {
      storyId: story.id || '',
      title: story.title || '',
      r2Path: story.r2Path || story.audioPath || '',
      photoUrl: story.imageUrl || '',
      description: story.subTitle || '',
      resumePosition: 0, // You can add resume position logic here if needed
      duration: playbackDurationMinutes,
    };

    // Use the centralized method that handles all the fixes
    this.globalAudioPlayer.playAudioFromAnyPage(playRequest).then(success => {
      if (success) {
        console.log('✅ Audio started successfully for:', story.title);
      } else {
        console.log('❌ Failed to start audio for:', story.title);
      }
    }).catch(error => {
      console.error('❌ Error starting audio:', error);
    });
  }

  isPlayedStory(story: FirebaseStory): boolean {
    // Check if story has been played (has playCount > 0)
    return ((story as any).playCount || 0) > 0;
  }

  getPlayCount(story: FirebaseStory): number {
    // Get play count safely
    return (story as any).playCount || 0;
  }

  // Smoothly reveal images once they have painted, leaving the element's background as a placeholder until then
  onImgLoad(event: Event): void {
    const img = event && (event.target as HTMLImageElement | null);
    if (img) {
      img.style.opacity = '1';
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
