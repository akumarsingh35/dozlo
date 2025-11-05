import { Component, CUSTOM_ELEMENTS_SCHEMA, QueryList, ElementRef, ViewChildren, OnInit, OnDestroy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NavFooterComponent } from '../shared/nav-footer/nav-footer.component';
import { FirebaseDataService, FirebaseStory } from '../services/firebase-data.service';
import { R2AudioService } from '../services/r2-audio.service';
import { R2ImageService } from '../services/r2-image.service';
import { GlobalAudioPlayerService } from '../services/global-audio-player.service';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FavoritesService } from '../services/favorites.service';
import { LibraryDataService, LibraryStory } from '../services/library-data.service';

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
  isLoading = true;

  private destroy$ = new Subject<void>();

  constructor(
    private firebaseDataService: FirebaseDataService,
    private r2AudioService: R2AudioService,
    private r2ImageService: R2ImageService,
    public globalAudioPlayer: GlobalAudioPlayerService,
    private favoritesService: FavoritesService,
    private libraryDataService: LibraryDataService
  ) {}

  ngOnInit() {
    console.log('📚 LibraryPage ngOnInit - Loading global data...');
    this.loadGlobalData();
    this.loadFavorites();
    
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
    
    // CRITICAL FIX: Use centralized audio service instead of duplicating logic
    const playRequest = {
      storyId: story.id || '',
      title: story.title || '',
      r2Path: story.r2Path || story.audioPath || '',
      photoUrl: story.imageUrl || '',
      description: story.subTitle || '',
      resumePosition: 0 // You can add resume position logic here if needed
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
