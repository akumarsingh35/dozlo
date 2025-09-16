import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { NavFooterComponent } from '../shared/nav-footer/nav-footer.component';
import { FirebaseDataService, ExploreCategory, FirebaseStory } from '../services/firebase-data.service';
import { R2ImageService } from '../services/r2-image.service';
import { R2AudioService, AudioTrack } from '../services/r2-audio.service';
import { CategoryService } from '../category/category.service';
import { NavController, Platform } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { GlobalAudioPlayerService } from '../services/global-audio-player.service';
import { ScrollManagerService } from '../services/scroll-manager.service';
import { Subject, takeUntil } from 'rxjs';
import { Capacitor } from '@capacitor/core';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  duration?: string;
  type: 'story' | 'category';
  story?: FirebaseStory;
  category?: ExploreCategory;
}

@Component({
  selector: 'app-explore',
  templateUrl: './explore.page.html',
  styleUrls: ['./explore.page.scss'],
  standalone: true,
  imports: [IonicModule, FormsModule, CommonModule, RouterModule]
})

export class ExplorePage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('contentContainer', { static: false }) contentContainer!: ElementRef;
  
  private destroy$ = new Subject<void>();
  
  categoryCards: ExploreCategory[] = [];
  isLoading = true;
  allStories: FirebaseStory[] = [];

  searchQuery: string = '';
  showResults: boolean = false;

  searchSuggestions: string[] = [];
  topResults: SearchResult[] = [];

  constructor(
    private firebaseDataService: FirebaseDataService,
    public r2ImageService: R2ImageService,
    private r2AudioService: R2AudioService,
    private categoryService: CategoryService,
    private navCtrl: NavController,
    private platform: Platform,
    private router: Router,
    public globalAudioPlayer: GlobalAudioPlayerService,
    private scrollManager: ScrollManagerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadExploreCategories();
    this.loadAllStories();
  }

  ngAfterViewInit() {
    // Monitor content height to prevent scrollbars on short content
    if (this.contentContainer?.nativeElement) {
      this.scrollManager.monitorContentHeight('explore', this.contentContainer.nativeElement);
    }
  }

  ngOnDestroy() {
    this.scrollManager.stopMonitoring('explore');
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadExploreCategories() {
    this.isLoading = true;
    
    // Use Firebase integration (same pattern as homepage)
    this.firebaseDataService.getExploreCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          if (categories && categories.length > 0) {
            this.categoryCards = categories;
            this.enrichCategoriesWithR2Urls();
          } else {
            this.loadDefaultCategories();
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('❌ Error loading explore categories:', error);
          this.isLoading = false;
          // Fallback to default categories if Firebase fails
          this.loadDefaultCategories();
        }
      });
  }

  private loadAllStories() {
    this.firebaseDataService.getAllStories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stories) => {
          this.allStories = stories;
          // Enrich stories with R2 URLs
          this.enrichStoriesWithR2Urls();
        },
        error: (error) => {
          console.error('❌ Error loading stories for search:', error);
        }
      });
  }

  private enrichStoriesWithR2Urls() {
    console.log('🔍 Enriching stories with R2 URLs...');
    console.log('🔍 Total stories to enrich:', this.allStories.length);
    
    this.allStories.forEach((story, index) => {
      if (story.imagePath && !story.imageUrl) {
        story.imageUrl = this.r2ImageService.getSecureImageUrl(story.imagePath);
        // Only preload first 5 stories on mobile, first 10 on desktop
        const maxPreload = this.isMobileDevice() ? 5 : 10;
        if (index < maxPreload) {
          this.preloadImage(story.imageUrl, 'low');
        }
      }
      
      // Set r2Path for audio playback (same as homepage)
      if (story.audioPath && !story.r2Path) {
        story.r2Path = story.audioPath;
        console.log('🔍 Set r2Path for story:', story.title, 'r2Path:', story.r2Path);
        
        // Preload audio metadata for first few stories (faster initial playback)
        const maxAudioPreload = this.isMobileDevice() ? 3 : 5;
        if (index < maxAudioPreload) {
          this.preloadAudioMetadata(story.r2Path);
        }
      }
    });
    
    console.log('🔍 Stories enriched successfully');
  }

  /**
   * Preload audio metadata for faster initial playback
   */
  private preloadAudioMetadata(r2Path: string): void {
    // Skip preloading on slow connections
    if (!this.shouldPreload('low')) {
      return;
    }

    // Preload metadata in background
    this.r2AudioService.preloadAudioMetadata(r2Path).subscribe({
      next: (metadata) => {
        console.log('🎵 Audio metadata preloaded for:', r2Path);
      },
      error: (error) => {
        // Silently fail - this is just optimization
        console.debug('⚠️ Could not preload audio metadata:', error);
      }
    });
  }

  private enrichCategoriesWithR2Urls() {
    this.categoryCards.forEach(category => {
      // Convert imagePath to imageUrl using R2 service (same as homepage)
      if (category.imagePath && !category.imageUrl) {
        category.imageUrl = this.r2ImageService.getSecureImageUrl(category.imagePath);
        this.preloadImage(category.imageUrl, 'high'); // High priority for categories
      }
    });
  }

  private preloadImage(imageUrl: string, priority: 'high' | 'low' = 'low'): void {
    // Skip preloading on slow connections or low battery
    if (!this.shouldPreload(priority)) {
      return;
    }

    const img = new Image();
    img.src = imageUrl;
  }

  private shouldPreload(priority: 'high' | 'low'): boolean {
    // Check if running in Capacitor app
    if (Capacitor.isNativePlatform()) {
      // In native app, be more conservative with preloading
      if (priority === 'low') {
        return false; // Only preload high priority in native apps
      }
    }

    // Check network speed
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        return priority === 'high'; // Only preload high priority on slow connections
      }
    }

    // Check if mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // On mobile, only preload high priority images
    if (isMobile && priority === 'low') {
      return false;
    }

    return true;
  }

  private async checkNetworkStatus(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        // Use browser's Network Information API instead
        if ('connection' in navigator) {
          const connection = (navigator as any).connection;
          // Network status available
        }
      } catch (error) {
        // Could not get network status
      }
    }
  }

  private loadDefaultCategories() {
    this.categoryCards = [
      {
        id: 'guided_meditation',
        name: 'Guided Meditation',
        imagePath: 'assets/icon/meditation_image.png',
        description: 'Guided meditation and mindfulness stories',
        color: '#6e57ff'
      },
      {
        id: 'sleep_stories',
        name: 'Sleep Stories',
        imagePath: 'assets/icon/moon_icon.png',
        description: 'Stories to help you fall asleep peacefully',
        color: '#4a90e2'
      },
      {
        id: 'nature_sounds',
        name: 'Nature Sounds',
        imagePath: 'assets/icon/meditation_image.png',
        description: 'Relaxing sounds of nature for a calming experience',
        color: '#50c878'
      },
      {
        id: 'romantic_stories',
        name: 'Romantic Stories',
        imagePath: 'assets/icon/meditation_image.png',
        description: 'Heartwarming and dreamy love stories',
        color: '#ff6f91'
      },
      {
        id: 'short_sweet',
        name: 'Short & Sweet',
        imagePath: 'assets/icon/moon_icon.png',
        description: 'Quick and soothing bedtime stories',
        color: '#f5a623'
      },
      {
        id: 'long_relaxing',
        name: 'Long & Relaxing',
        imagePath: 'assets/icon/meditation_image.png',
        description: 'Extended stories for a deeply relaxing sleep',
        color: '#7f8fa6'
      }
    ];

    // Use the same enrichment pattern as homepage
    this.enrichCategoriesWithR2Urls();
  }

  onSearchChange() {
    const query = this.searchQuery.trim().toLowerCase();
    this.showResults = query.length > 0;
    
    if (this.showResults) {
      this.generateSearchSuggestions(query);
      this.performSearch(query);
    } else {
      this.searchSuggestions = [];
      this.topResults = [];
    }
  }

  private generateSearchSuggestions(query: string) {
    const suggestions = new Set<string>();
    
    // Generate suggestions from stories
    this.allStories.forEach(story => {
      // Check title
      if (story.title?.toLowerCase().includes(query)) {
        const words = story.title.toLowerCase().split(' ');
        words.forEach(word => {
          if (word.startsWith(query) && word.length > query.length) {
            suggestions.add(word);
          }
        });
      }
      
      // Check subtitle
      if (story.subTitle?.toLowerCase().includes(query)) {
        const words = story.subTitle.toLowerCase().split(' ');
        words.forEach(word => {
          if (word.startsWith(query) && word.length > query.length) {
            suggestions.add(word);
          }
        });
      }
      
      // Check narrator
      if (story.narratorName?.toLowerCase().includes(query)) {
        const words = story.narratorName.toLowerCase().split(' ');
        words.forEach(word => {
          if (word.startsWith(query) && word.length > query.length) {
            suggestions.add(word);
          }
        });
      }
      
      // Check category
      if (story.category?.toLowerCase().includes(query)) {
        const words = story.category.toLowerCase().split(' ');
        words.forEach(word => {
          if (word.startsWith(query) && word.length > query.length) {
            suggestions.add(word);
          }
        });
      }
    });
    
    // Generate suggestions from categories
    this.categoryCards.forEach(category => {
      if (category.name?.toLowerCase().includes(query)) {
        const words = category.name.toLowerCase().split(' ');
        words.forEach(word => {
          if (word.startsWith(query) && word.length > query.length) {
            suggestions.add(word);
          }
        });
      }
      
      if (category.description?.toLowerCase().includes(query)) {
        const words = category.description.toLowerCase().split(' ');
        words.forEach(word => {
          if (word.startsWith(query) && word.length > query.length) {
            suggestions.add(word);
          }
        });
      }
    });
    
    // Convert to array and limit to 5 suggestions
    this.searchSuggestions = Array.from(suggestions).slice(0, 5);
  }

  private performSearch(query: string) {
    const results: SearchResult[] = [];
    
    // Search in stories
    this.allStories.forEach(story => {
      const titleMatch = story.title?.toLowerCase().includes(query);
      const subtitleMatch = story.subTitle?.toLowerCase().includes(query);
      const narratorMatch = story.narratorName?.toLowerCase().includes(query);
      const categoryMatch = story.category?.toLowerCase().includes(query);
      
      if (titleMatch || subtitleMatch || narratorMatch || categoryMatch) {
        results.push({
          id: story.id,
          title: story.title,
          subtitle: story.subTitle || story.narratorName || 'Story',
          image: story.imageUrl || '',
          duration: story.duration ? this.formatDuration(story.duration) : '0:00',
          type: 'story',
          story: story
        });
      }
    });
    
    // Search in categories
    this.categoryCards.forEach(category => {
      const nameMatch = category.name?.toLowerCase().includes(query);
      const descriptionMatch = category.description?.toLowerCase().includes(query);
      
      if (nameMatch || descriptionMatch) {
        results.push({
          id: category.id,
          title: category.name,
          subtitle: 'Category',
          image: category.imageUrl || '',
          type: 'category',
          category: category
        });
      }
    });
    
    // Sort results: stories first, then categories
    results.sort((a, b) => {
      if (a.type === 'story' && b.type === 'category') return -1;
      if (a.type === 'category' && b.type === 'story') return 1;
      return 0;
    });
    
    this.topResults = results.slice(0, 10); // Limit to 10 results
  }

  private formatDuration(duration: number): string {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  clearSearch() {
    this.searchQuery = '';
    this.showResults = false;
  }

  onCategoryClick(category: ExploreCategory) {
    // Try multiple filtering strategies
    let categoryStories = this.allStories.filter(story => {
      // Strategy 1: Match by category ID
      const duration = Number(String(story.duration).trim());
      if(category.id=='short_sweet') {
        if(duration<20)
          return true;
      }
       if(category.id=='long_relaxing') {
        if(duration>30)
          return true;
      }
      if (story.category?.toLowerCase() === category.id.toLowerCase()) {
        return true;
      }
      // Strategy 2: Match by category name
      if (story.category?.toLowerCase() === category.name.toLowerCase()) {
        return true;
      }
      // Strategy 3: Check if category name is contained in story category
      if (story.category?.toLowerCase().includes(category.name.toLowerCase())) {
        return true;
      }
      // Strategy 4: Check if story category is contained in category name
      if (category.name.toLowerCase().includes(story.category?.toLowerCase() || '')) {
        return true;
      }
      return false;
    });
    
    console.log('🎯 Filtered stories count:', categoryStories.length);
    console.log('🎯 Category ID:', category.id);
    console.log('🎯 Category name:', category.name);
    
    // Debug: Log first few stories to see their structure
    if (categoryStories.length > 0) {
      console.log('🎯 First 3 filtered stories:');
      categoryStories.slice(0, 3).forEach((story, index) => {
        console.log(`🎯 Story ${index + 1}:`, {
          id: story.id,
          title: story.title,
          category: story.category,
          imageUrl: story.imageUrl,
          imagePath: story.imagePath,
          audioPath: story.audioPath,
          r2Path: story.r2Path
        });
      });
    }
    
    // If no stories found, try to get all stories as fallback
    if (categoryStories.length === 0) {
      console.log('🎯 No stories found for category, using all stories as fallback');
      categoryStories = [...this.allStories];
    }
    
    // Set stories and category in the service
    this.categoryService.setCategoryData(categoryStories, category.name, category.id);
    console.log('✅ Stories set in CategoryService:', categoryStories.length);
    
    // Navigate to the new explore-category page without animation
    console.log('🔧 Navigating to explore-category page with NavController...');
    
    // Use navigateForward without animation for instant transitions
    this.navCtrl.navigateForward(['/explore-category'], { 
      queryParams: { category: category.name },
      animated: false
    });
  }



  onSearchResultClick(result: SearchResult) {
    if (result.type === 'story' && result.story) {
      // Play the story
      this.playStory(result.story);
    } else if (result.type === 'category' && result.category) {
      // Navigate to category page (same as clicking category card)
      this.onCategoryClick(result.category);
    }
  }

  onSuggestionClick(suggestion: string) {
    this.searchQuery = suggestion;
    this.onSearchChange();
  }

  private playStory(story: FirebaseStory) {
    console.log('🎵 Play button clicked for:', story.title);
    
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

  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
}
