import { Component, OnInit, OnDestroy, ViewChildren, QueryList, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { GlobalAudioPlayerComponent } from '../global-audio-player/global-audio-player.component';
import { AudioService } from '../core/audio.service';
import { Observable, Subject, takeUntil, of, forkJoin, combineLatest } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../core/auth.service';
import { User } from '@angular/fire/auth';
import { NavController, Platform } from '@ionic/angular';
import { SeeAllService } from '../see-all/see-all.service';
import { CategoryService } from '../category/category.service';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NavFooterComponent } from '../shared/nav-footer/nav-footer.component';
import { GlobalAudioPlayerService } from '../services/global-audio-player.service';
import { R2AudioService, AudioTrack } from '../services/r2-audio.service';
import { R2ImageService } from '../services/r2-image.service';
import { FirebaseDataService, FirebaseCategory, FirebaseSection, FirebaseStory } from '../services/firebase-data.service';
import { ScrollManagerService } from '../services/scroll-manager.service';
import { ConnectivityService } from '../services/connectivity.service';
import { OfflineDownloadManagerService } from '../services/offline-download-manager.service';
import { environment } from 'src/environments/environment';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, HttpClientModule, RouterModule, NavFooterComponent],
})
export class HomePage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('contentContainer', { static: false }) contentContainer!: ElementRef;
  
  showAudioPlayer = false;
  currentAudio: any = null;
  imagesLoaded = false;
  networkError = false;
  isRetrying = false;
  private wasOnline = true;
  isInitialDataLoading = true;
  offlineDownloadedCount = 0;

  categories: FirebaseCategory[] = [];
  selectedCategory: FirebaseCategory | null = null;
  currentSections: FirebaseSection[] = [];

  // Custom slider properties - now unique per section
  sliderStates = new Map<string, { currentSlideIndex: number; maxSlideIndex: number; isDragging: boolean; dragOffset: number; startX: number; currentX: number }>();
  slideWidth = 296; // 280px content + 16px gap
  
  // Custom slider card properties
  sliderCardStates = new Map<string, { translateX: number; isDragging: boolean; startX: number; currentX: number; maxTranslateX: number }>();
  sliderCardWidth = 160; // Base width for better mobile fit
  sliderCardGap = 12; // Base gap for better mobile fit
  
  // Cache for story groups to prevent re-computation
  private storyGroupsCache = new Map<string, FirebaseStory[][]>();

  showLoginBanner = true;
  isCategoryLoading = false;
  isNavigatingToSignIn = false;
  private categoryLoadingCheckInterval: any;
  private categoryLoadingTimeout: any;

  constructor(
    private navCtrl: NavController,
    private router: Router,
    private platform: Platform,
    private seeAllService: SeeAllService,
    private authService: AuthService,
    private audioService: AudioService,
    public globalAudioPlayer: GlobalAudioPlayerService,
    private r2AudioService: R2AudioService,
    private r2ImageService: R2ImageService,
    private firebaseDataService: FirebaseDataService,
    private categoryService: CategoryService,
    private scrollManager: ScrollManagerService,
    private connectivity: ConnectivityService,
    private offlineDownloadManager: OfflineDownloadManagerService
  ) {
    this.audios$ = this.audioService.getAllAudioStories().pipe(
      catchError(error => {
        console.error('Error fetching audio stories:', error);
        return of([]);
      })
    );
  }

  /**
   * Maintain loading state until sections have stories or timeout
   */
  private startCategoryLoadingWatch(): void {
    this.clearCategoryLoadingWatch();
    const checkFn = () => {
      const hasStories = this.currentSections?.some(s => Array.isArray(s.stories) && s.stories.length > 0);
      if (hasStories) {
        this.isCategoryLoading = false;
        this.clearCategoryLoadingWatch();
      }
    };
    // Poll briefly to catch async population
    this.categoryLoadingCheckInterval = setInterval(checkFn, 150);
    // Safety timeout to prevent indefinite skeletons
    this.categoryLoadingTimeout = setTimeout(() => {
      this.isCategoryLoading = false;
      this.clearCategoryLoadingWatch();
    }, 2000);
  }

  private clearCategoryLoadingWatch(): void {
    if (this.categoryLoadingCheckInterval) {
      clearInterval(this.categoryLoadingCheckInterval);
      this.categoryLoadingCheckInterval = null;
    }
    if (this.categoryLoadingTimeout) {
      clearTimeout(this.categoryLoadingTimeout);
      this.categoryLoadingTimeout = null;
    }
  }

  ngAfterViewInit() {
    // Monitor content height to prevent scrollbars on short content
    if (this.contentContainer?.nativeElement) {
      this.scrollManager.monitorContentHeight('home', this.contentContainer.nativeElement);
    }
  }


  onPlay(story: FirebaseStory) {
    console.log('🎵 [DEBUG] Home page - Play button clicked for:', story.title);
    console.log('🎵 [DEBUG] Story details:', {
      id: story.id,
      title: story.title,
      r2Path: story.r2Path,
      audioPath: story.audioPath,
      imageUrl: story.imageUrl,
      subTitle: story.subTitle
    });
    
    // CRITICAL FIX: Use centralized audio service instead of duplicating logic
    const playRequest = {
      storyId: story.id || '',
      title: story.title || '',
      r2Path: story.r2Path || story.audioPath || '',
      photoUrl: story.imageUrl || '',
      description: story.subTitle || '',
      resumePosition: 0, // You can add resume position logic here if needed
      duration: Number(story.duration || 0),
    };

    console.log('🎵 [DEBUG] Home page - Play request created:', playRequest);

    // Use the centralized method that handles all the fixes
    this.globalAudioPlayer.playFromCard(playRequest).then(success => {
      console.log('🎵 [DEBUG] Home page - playFromCard result:', success);
      if (success) {
        console.log('✅ [DEBUG] Home page - Audio started successfully for:', story.title);
      } else {
        console.log('❌ [DEBUG] Home page - Failed to start audio for:', story.title);
      }
    }).catch(error => {
      console.error('❌ [DEBUG] Home page - Error starting audio:', error);
    });
  }

  onSeeAll(section: FirebaseSection) {
    console.log('🎯 SEE ALL CLICKED! Section:', section.title);
    console.log('🎯 Section stories count:', section.stories?.length || 0);
    console.log('🎯 Section object:', section);
    
    // Check if section has stories
    if (!section.stories || section.stories.length === 0) {
      console.error('❌ No stories found in section:', section.title);
      console.log('🎯 Section object:', section);
      return;
    }
    
    // Debug: Log first few stories to see their structure
    console.log('🎯 First 3 stories in section:');
    section.stories.slice(0, 3).forEach((story, index) => {
      console.log(`🎯 Story ${index + 1}:`, {
        id: story.id,
        title: story.title,
        imageUrl: story.imageUrl,
        imagePath: story.imagePath,
        audioPath: story.audioPath,
        r2Path: story.r2Path
      });
    });
    
    // Clear CategoryService data to prevent conflicts with explore page data
    this.categoryService.clearData();
    
    // Set stories in SeeAllService
    this.seeAllService.setStories(section.stories, section.title);
    console.log('✅ Stories set in SeeAllService:', section.stories.length);
    
    // Use consistent navigation method with NavFooter
    console.log('🔧 Navigating to See All with NavController...');
    this.navCtrl.navigateForward(['/see-all'], {
      queryParams: { category: section.title || 'all' },
      animated: false,
    });
  }

  async onSignIn() {
    if (this.isNavigatingToSignIn) {
      return;
    }

    if (!this.connectivity.isOnline) {
      this.connectivity.notifyOfflineAction();
      return;
    }

    this.isNavigatingToSignIn = true;
    try {
      // Use root navigation to avoid stacked auth routes and unstable back-stack state.
      await this.navCtrl.navigateRoot(['/sign-in'], { animated: false });
    } finally {
      // Keep a tiny cooldown so repeated taps do not queue duplicate navigations.
      setTimeout(() => {
        this.isNavigatingToSignIn = false;
      }, 250);
    }
  }

  onCategoryChange(event: any) {
    console.log('🏠 Category change event:', event);
    const categoryId = event.detail.value;
    const category = this.categories.find(cat => cat.id === categoryId);
    if (category) {
      this.selectCategory(category);
    }
  }

  selectCategory(category: FirebaseCategory) {
    // Prevent rapid switching
    if (this.isCategoryLoading) {
      console.log('🔄 Category switching in progress, ignoring rapid click');
      return;
    }

    console.log('🎯 Selecting category:', category.name);
    this.selectedCategory = category;
    this.isCategoryLoading = true;
    this.clearCategoryLoadingWatch();
    
    this.firebaseDataService.getSectionsForCategory(category.name).pipe(takeUntil(this.destroy$)).subscribe({
      next: (sections) => {
        console.log('📚 Sections loaded for category:', category.name, sections.length);
        console.log('📚 Sections details:', sections);
        this.currentSections = sections;
        this.imagesLoaded = true; // Set this to true to ensure content is displayed
        this.enrichStoriesWithR2Urls();
        this.updateSliderState(); // Update slider state when sections change
        this.storyGroupsCache.clear(); // Clear cache for fresh data
        
        // Preload audio for visible stories
        this.preloadVisibleAudio();
        // Keep skeleton visible until stories appear or timeout to avoid empty sections
        this.startCategoryLoadingWatch();
        
      },
      error: (error) => {
        this.isCategoryLoading = false;
        this.imagesLoaded = true; // Set to true even on error to show fallback content
      }
    });
  }

  /**
   * TrackBy functions to optimize loops and prevent re-rendering
   */
  trackByStoryGroup(index: number, storyGroup: FirebaseStory[]): string {
    return storyGroup.map(story => story.id).join('-');
  }

  trackByStory(index: number, story: FirebaseStory): string {
    return story.id;
  }

  trackByCategory(index: number, category: FirebaseCategory): string {
    return category.id;
  }

  trackBySection(index: number, section: FirebaseSection): string {
    return section.id;
  }

  /**
   * Utility: fixed-length array for skeleton placeholders
   */
  getSkeletonArray(count: number): number[] {
    return Array.from({ length: count }, (_, i) => i);
  }

  /**
   * trackBy for skeleton placeholder loops
   */
  trackByIndex(index: number): number {
    return index;
  }

  /**
   * Group stories into sets of specified size for stacks layout
   */
  getStoryGroups(stories: FirebaseStory[], groupSize: number): FirebaseStory[][] {
    const cacheKey = `${stories.length}-${groupSize}`;
    if (this.storyGroupsCache.has(cacheKey)) {
      return this.storyGroupsCache.get(cacheKey)!;
    }

    const groups: FirebaseStory[][] = [];
    for (let i = 0; i < stories.length; i += groupSize) {
      groups.push(stories.slice(i, i + groupSize));
    }
    this.storyGroupsCache.set(cacheKey, groups);
    return groups;
  }

  /**
   * Get slider state for a specific section
   */
  getSliderState(sectionId: string) {
    if (!this.sliderStates.has(sectionId)) {
      this.sliderStates.set(sectionId, {
        currentSlideIndex: 0,
        maxSlideIndex: 0,
        isDragging: false,
        dragOffset: 0,
        startX: 0,
        currentX: 0
      });
    }
    return this.sliderStates.get(sectionId)!;
  }

  /**
   * Get slider card state for a specific section
   */
  getSliderCardState(sectionId: string) {
    if (!this.sliderCardStates.has(sectionId)) {
      this.sliderCardStates.set(sectionId, {
        translateX: 0,
        isDragging: false,
        startX: 0,
        currentX: 0,
        maxTranslateX: 0
      });
    }
    return this.sliderCardStates.get(sectionId)!;
  }

  /**
   * Get responsive card dimensions based on screen size
   * Ensures exactly 2 cards fit in the container
   */
  getResponsiveCardDimensions() {
    const screenWidth = window.innerWidth;
    const containerPadding = screenWidth <= 360 ? 16 : screenWidth <= 480 ? 24 : 32;
    const availableWidth = screenWidth - containerPadding;
    
    // Calculate card width to fit exactly 2 cards with a reasonable gap
    const gap = screenWidth <= 360 ? 12 : screenWidth <= 480 ? 16 : 20;
    const cardWidth = Math.floor((availableWidth - gap) / 2); // Exactly 2 cards
    
    return { width: cardWidth, gap: gap };
  }

  /**
   * Touch/Drag functionality for mobile-like sliding
   */
  onPointerDown(event: PointerEvent, sectionId: string): void {
    // Check if the pointer target is a play button or its child
    const target = event.target as HTMLElement;
    if (target.closest('.play-icon-wrapper')) {
      return; // Don't start drag if clicking on play button
    }
    
    // Only start drag for left mouse button or touch
    if (event.button === 0 || event.pointerType === 'touch') {
      this.startDrag(event.clientX, sectionId);
    }
  }

  onPointerMove(event: PointerEvent, sectionId: string): void {
    const state = this.getSliderState(sectionId);
    if (state.isDragging) {
      event.preventDefault();
      this.updateDrag(event.clientX, sectionId);
    }
  }

  onPointerUp(event: PointerEvent, sectionId: string): void {
    this.endDrag(sectionId);
  }

  onPointerLeave(event: PointerEvent, sectionId: string): void {
    const state = this.getSliderState(sectionId);
    if (state.isDragging) {
      this.endDrag(sectionId);
    }
  }

  /**
   * Custom slider card pointer events
   */
  onSliderPointerDown(event: PointerEvent, sectionId: string): void {
    // Check if the pointer target is a play button or its child
    const target = event.target as HTMLElement;
    if (target.closest('.play-icon-wrapper')) {
      return; // Don't start drag if clicking on play button
    }
    
    // Only start drag for left mouse button or touch
    if (event.button === 0 || event.pointerType === 'touch') {
      this.startSliderCardDrag(event.clientX, sectionId);
    }
  }

  onSliderPointerMove(event: PointerEvent, sectionId: string): void {
    const state = this.getSliderCardState(sectionId);
    if (state.isDragging) {
      event.preventDefault();
      this.updateSliderCardDrag(event.clientX, sectionId);
    }
  }

  onSliderPointerUp(event: PointerEvent, sectionId: string): void {
    this.endSliderCardDrag(sectionId);
  }

  onSliderPointerLeave(event: PointerEvent, sectionId: string): void {
    const state = this.getSliderCardState(sectionId);
    if (state.isDragging) {
      this.endSliderCardDrag(sectionId);
    }
  }

  private startSliderCardDrag(clientX: number, sectionId: string): void {
    const state = this.getSliderCardState(sectionId);
    // Only start drag if not already dragging
    if (!state.isDragging) {
      state.isDragging = true;
      state.startX = clientX;
      state.currentX = clientX;
    }
  }

  private updateSliderCardDrag(clientX: number, sectionId: string): void {
    const state = this.getSliderCardState(sectionId);
    if (!state.isDragging) return;
    
    state.currentX = clientX;
    const dragDistance = state.currentX - state.startX;
    const newTranslateX = state.translateX + dragDistance;
    
    // Apply bounds checking
    if (newTranslateX > 0) {
      state.translateX = 0;
    } else if (newTranslateX < state.maxTranslateX) {
      state.translateX = state.maxTranslateX;
    } else {
      state.translateX = newTranslateX;
    }
    
    // Update start position for smooth dragging
    state.startX = state.currentX;
  }

  private endSliderCardDrag(sectionId: string): void {
    const state = this.getSliderCardState(sectionId);
    if (!state.isDragging) return;
    
    state.isDragging = false;
    
    // Snap to nearest position if needed
    const dimensions = this.getResponsiveCardDimensions();
    const cardWidth = dimensions.width + dimensions.gap;
    const snapPosition = Math.round(state.translateX / cardWidth) * cardWidth;
    
    if (snapPosition > 0) {
      state.translateX = 0;
    } else if (snapPosition < state.maxTranslateX) {
      state.translateX = state.maxTranslateX;
    } else {
      state.translateX = snapPosition;
    }
  }



  private startDrag(clientX: number, sectionId: string): void {
    const state = this.getSliderState(sectionId);
    // Only start drag if not already dragging
    if (!state.isDragging) {
      state.isDragging = true;
      state.startX = clientX;
      state.currentX = clientX;
      state.dragOffset = 0;
    }
  }

  private updateDrag(clientX: number, sectionId: string): void {
    const state = this.getSliderState(sectionId);
    if (!state.isDragging) return;
    
    state.currentX = clientX;
    state.dragOffset = state.currentX - state.startX;
  }

  private endDrag(sectionId: string): void {
    const state = this.getSliderState(sectionId);
    if (!state.isDragging) return;
    
    state.isDragging = false;
    const dragDistance = state.currentX - state.startX;
    const threshold = this.slideWidth * 0.3; // 30% of slide width
    
    if (Math.abs(dragDistance) > threshold) {
      if (dragDistance > 0 && state.currentSlideIndex > 0) {
        // Swipe right - go to previous slide
        state.currentSlideIndex--;
      } else if (dragDistance < 0 && state.currentSlideIndex < state.maxSlideIndex) {
        // Swipe left - go to next slide
        state.currentSlideIndex++;
      }
    }
    
    state.dragOffset = 0;
  }

  /**
   * Update max slide index when sections change
   */
  private updateSliderState(): void {
    if (this.currentSections.length > 0) {
      // Find the stacks section and calculate max slides
      const stacksSections = this.currentSections.filter(section => section.sectionType === 'stacks');
      stacksSections.forEach(section => {
        if (section.stories) {
          const groups = this.getStoryGroups(section.stories, 3);
          const state = this.getSliderState(section.id);
          state.maxSlideIndex = Math.max(0, groups.length - 1);
          state.currentSlideIndex = 0; // Reset to first slide
        }
      });

      // Find the slider cards sections and calculate max translate X
      const sliderCardSections = this.currentSections.filter(section => section.sectionType === 'sliderCards');
      sliderCardSections.forEach(section => {
        if (section.stories) {
          const state = this.getSliderCardState(section.id);
          const dimensions = this.getResponsiveCardDimensions();
          
          const totalWidth = section.stories.length * (dimensions.width + dimensions.gap) - dimensions.gap;
          
          // Force exactly 2 cards to be visible
          const visibleCards = 2;
          const containerWidth = visibleCards * (dimensions.width + dimensions.gap) - dimensions.gap;
          state.maxTranslateX = Math.min(0, -(totalWidth - containerWidth));
          state.translateX = 0; // Reset to first position
        }
      });
    }
  }

  /**
   * Image loading optimization
   */
  onImageLoad(story: FirebaseStory): void {
    story.imageLoaded = true;
  }

  onImageError(event: any) {
    console.log('🏠 Image error:', event);
    // Set a fallback image or hide the image
    if (event.target) {
      event.target.style.display = 'none';
    }
  }

  /**
   * Play functionality for list items
   */
  onPlayListItem(story: FirebaseStory): void {
    this.onPlay(story);
  }

  /**
   * Preload audio for stories that are visible
   */
  preloadVisibleAudio(): void {
    // Preload audio metadata for first few stories in each section (streaming-optimized)
    this.currentSections.forEach(section => {
      const storiesToPreload = section.stories.slice(0, 3); // Preload first 3 stories
      storiesToPreload.forEach(story => {
        if (story.audioPath && !story.isPreloaded) {
          story.isPreloaded = true;
          // Only preload metadata for streaming, not full audio
          this.r2AudioService.preloadAudioMetadata(story.audioPath).subscribe({
            next: () => {
              console.log('🎵 Preloaded metadata for:', story.title);
            },
            error: (error) => {
              console.warn('🎵 Failed to preload metadata for:', story.title, error);
            }
          });
        }
      });
    });
  }

  /**
   * Preload audio metadata when story comes into view (streaming-optimized)
   */
  onStoryVisible(story: FirebaseStory): void {
    if (story.audioPath && !story.isPreloaded) {
      story.isPreloaded = true;
      // Only preload metadata for streaming, not full audio
      this.r2AudioService.preloadAudioMetadata(story.audioPath).subscribe({
        next: () => {
          console.log('🎵 Preloaded metadata for visible story:', story.title);
        },
        error: (error) => {
          console.warn('🎵 Failed to preload metadata for visible story:', story.title, error);
        }
      });
    }
  }

  private destroy$ = new Subject<void>();
  audios$: Observable<any[]>;

  ngOnInit() {
    console.log('🏠 HomePage ngOnInit - Starting global data integration...');
    this.setDefaultState();
    this.loadGlobalData();
    this.offlineDownloadManager.downloads$
      .pipe(takeUntil(this.destroy$))
      .subscribe((records) => {
        this.offlineDownloadedCount = records.filter((record) => record.status === 'downloaded').length;
      });

    this.connectivity.isOnline$.pipe(takeUntil(this.destroy$)).subscribe((online) => {
      this.networkError = !online;
      if (!online && this.isInitialDataLoading && this.categories.length === 0) {
        // Exit skeleton state quickly when offline and we have no remote data to render.
        this.isInitialDataLoading = false;
      }
      if (!this.wasOnline && online) {
        const hasNoData = (this.categories?.length || 0) === 0 && (this.currentSections?.length || 0) === 0;
        if (hasNoData && !this.isRetrying) {
          this.retryLoad();
        }
      }
      this.wasOnline = online;
    });

    // Subscribe to auth state and update login banner
    this.authService.user$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(user => {
      this.showLoginBanner = !user;
      console.log('🏠 Auth state changed, showLoginBanner:', this.showLoginBanner);
    });

    // Listen for window resize to update slider calculations
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private setDefaultState() {
    console.log('🏠 Setting default state...');
    this.categories = [];
    this.selectedCategory = null;
    this.currentSections = [];
    this.isInitialDataLoading = true;

    // Safety timeout so users do not see endless loading on very poor networks.
    setTimeout(() => {
      if (this.isInitialDataLoading) {
        console.log('🏠 Initial data loading timeout reached.');
        this.isInitialDataLoading = false;
      }
    }, 10000);
    
    console.log('🏠 Default state set');

  //   console.log("AUDIO_FINAL =", environment.getAudioWorkerUrl());
  // console.log("IMAGE_FINAL =", environment.getImageWorkerUrl());
  // console.log("SECRET_FINAL =", environment.getR2AppSecret());
  }

  private loadGlobalData() {
    console.log('🏠 Loading global data...');
    
    // Subscribe to data loaded state
    this.firebaseDataService.dataLoaded$.pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (loaded) => {
        console.log('🏠 Data loaded state changed:', loaded);
        if (loaded) {
          console.log('🏠 Global data is loaded, setting up categories...');
          this.setupCategories();
        }
      },
      error: (error) => {
        console.error('🏠 Error in data loaded subscription:', error);
        this.isInitialDataLoading = false;
      }
    });
  }

  async retryLoad() {
    if (this.isRetrying) return;
    this.isRetrying = true;
    const online = await this.connectivity.refreshStatus();
    this.networkError = !online;
    if (!online) {
      this.isRetrying = false;
      return;
    }
    this.firebaseDataService.refreshGlobalData().subscribe({
      next: (ok) => {
        this.isRetrying = false;
        if (ok) {
          this.setupCategories();
        }
      },
      error: () => {
        this.isRetrying = false;
      }
    });
  }

  formatDuration(duration: number | undefined | null): string {
    const d = Number(duration || 0);
    const totalMinutes = Math.max(0, Math.round(d));
    if (totalMinutes >= 60) {
      const hours = totalMinutes / 60;
      const rounded = Math.round(hours * 10) / 10;
      return `${rounded}h`;
    }
    return `${totalMinutes}m`;
  }

  private setupCategories() {
    console.log('🏠 Setting up categories...');
    
    // Get categories from global service
    this.firebaseDataService.getCategories().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (categories) => {
        console.log('🏠 Categories received:', categories.length);
        this.isInitialDataLoading = false;
        this.categories = categories;
        
        // Select the first category (Latest) by default
        if (categories.length > 0) {
          console.log('🏠 Selecting first category:', categories[0].name);
          this.selectCategory(categories[0]);
        } else {
          console.log('🏠 No categories available');
          this.isCategoryLoading = false;
          this.imagesLoaded = true;
        }
      },
      error: (error) => {
        console.error('🏠 Error getting categories:', error);
        this.isInitialDataLoading = false;
        this.isCategoryLoading = false;
      }
    });
  }

  shouldShowEmptyState(): boolean {
    return !this.isInitialDataLoading && !this.isCategoryLoading && this.currentSections.length === 0;
  }

  getEmptyStateTitle(): string {
    if (this.networkError) {
      return 'You are offline';
    }
    return 'Content is not available right now';
  }

  getEmptyStatePrimaryMessage(): string {
    if (this.networkError) {
      return this.offlineDownloadedCount > 0
        ? `You can still play ${this.offlineDownloadedCount} downloaded audio${this.offlineDownloadedCount > 1 ? 's' : ''} from Library.`
        : 'No offline downloads are available on this device right now.';
    }
    return 'We could not load stories for the selected category yet.';
  }

  getEmptyStateSecondaryMessage(): string {
    if (this.networkError) {
      return this.offlineDownloadedCount > 0
        ? 'Open Library > Downloads to listen without internet.'
        : 'Connect to the internet, then download stories for offline listening.';
    }
    return 'Please retry in a moment or switch category.';
  }

  async openLibraryDownloads(): Promise<void> {
    await this.navCtrl.navigateRoot(['/library'], { animated: false });
  }

  private enrichStoriesWithR2Urls() {
    console.log('🏠 Enriching stories with R2 URLs...');
    
    const allStories: FirebaseStory[] = [];
    this.currentSections.forEach(section => {
      if (section.stories && Array.isArray(section.stories)) {
        section.stories.forEach(story => {
          allStories.push(story);
        });
      }
    });

    console.log('🏠 Total stories to enrich:', allStories.length);

    if (allStories.length === 0) {
               this.imagesLoaded = true;
               return;
             }

    // Enrich stories with R2 image URLs (synchronous since getSecureImageUrl returns string)
    this.currentSections.forEach(section => {
      if (section.stories && Array.isArray(section.stories)) {
        section.stories.forEach(story => {
          // Reset image loaded state for fresh render so placeholder backgrounds show
          story.imageLoaded = false;
          // Convert imagePath to imageUrl using R2 service
          if (story.imagePath && !story.imageUrl) {
            story.imageUrl = this.r2ImageService.getSecureImageUrl(story.imagePath);
          }
          
          // Note: We don't set audioUrl here as it requires authentication
          // audioUrl will be generated by prepareAudioTrack() with proper auth
          
          // Set r2Path for audio playback
          if (story.audioPath && !story.r2Path) {
            story.r2Path = story.audioPath;
                 }
               });
             }
           });

    // Mark as loaded
    this.imagesLoaded = true;
    
    console.log('🏠 Stories enriched successfully');
    console.log('🏠 Current sections count:', this.currentSections.length);
    this.currentSections.forEach(section => {
      console.log('🏠 Section:', section.sectionName, 'Stories:', section.stories?.length || 0);
    });
  }

  private handleAudioData(data: any[]) {
    if (!data || !Array.isArray(data)) {
      console.warn('Invalid data received:', data);
      return;
    }

    // Map the Firestore data to match the stories format
    const firestoreStories = data.map(item => ({
      id: item.id,
      image: item.photoUrl ? this.r2ImageService.getSecureImageUrl(item.photoUrl) : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e',
      title: item.title || 'Untitled',
      subtitle: item.subtitle || 'Audio Story',
      duration: item.duration || '0:00',
      audioUrl: item.audioUrl || '',
      r2Path: item.r2Path || ''
    }));


  }



  ngOnDestroy() {
    this.scrollManager.stopMonitoring('home');
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    this.clearCategoryLoadingWatch();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private onWindowResize(): void {
    // Debounce the resize event to avoid excessive calculations
    clearTimeout((this as any).resizeTimeout);
    (this as any).resizeTimeout = setTimeout(() => {
      // Force recalculation of responsive dimensions
      this.updateSliderState();
      // Trigger change detection to update the view
      setTimeout(() => {
        this.updateSliderState();
      }, 50);
    }, 250);
  }
}
