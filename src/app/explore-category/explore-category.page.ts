import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../category/category.service';
import { GlobalAudioPlayerService } from '../services/global-audio-player.service';
import { AudioService } from '../core/audio.service';
import { R2AudioService } from '../services/r2-audio.service';
import { R2ImageService } from '../services/r2-image.service';
import { FirebaseDataService } from '../services/firebase-data.service';

import { Subject } from 'rxjs';

@Component({
  selector: 'app-explore-category',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, RouterModule],
  templateUrl: './explore-category.page.html',
  styleUrls: ['./explore-category.page.scss']
})
export class ExploreCategoryPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private categoryService = inject(CategoryService);
  private navCtrl = inject(NavController);
  private audioService = inject(AudioService);
  private r2AudioService = inject(R2AudioService);
  private r2ImageService = inject(R2ImageService);
  private firebaseDataService = inject(FirebaseDataService);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();

  stories: any[] = [];
  category: string = '';
  categoryType: 'same' | 'mixed' = 'same';
  isLoading = true;
  searchTerm = '';
  filteredStories: any[] = [];

  // Make globalAudioPlayer public for template access
  public globalAudioPlayer = inject(GlobalAudioPlayerService);

  ngOnInit() {
    console.log('🎯 ExploreCategoryPage ngOnInit');
    
    // Get category from query params
    this.route.queryParamMap.subscribe(params => {
      const categoryParam = params.get('category');
      const categoryTypeParam = params.get('categoryType');
      this.category = categoryParam || 'Category';
      this.categoryType = categoryTypeParam === 'mixed' ? 'mixed' : 'same';
      console.log('🎯 Category from params:', this.category);
      console.log('🎯 CategoryType from params:', this.categoryType);
      
      this.loadStories();
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

  private loadStories() {
    console.log('🎯 Loading stories for explore-category page');
    console.log('🎯 Category:', this.category);
    
    // Get stories from CategoryService (explore page sets this)
    let stories = this.categoryService.getStories();
    
    console.log('🎯 Stories from CategoryService:', stories);
    console.log('🎯 Stories count from service:', stories?.length || 0);
    
    if (stories && stories.length > 0) {
      console.log('🎯 Stories loaded from CategoryService:', stories.length);
      
      // Debug: Log first few stories to see their structure
      console.log('🎯 First 3 stories from service:');
      stories.slice(0, 3).forEach((story, index) => {
        console.log(`🎯 Story ${index + 1}:`, {
          id: story.id,
          title: story.title,
          imageUrl: story.imageUrl,
          imagePath: story.imagePath,
          audioPath: story.audioPath,
          r2Path: story.r2Path,
          category: story.category
        });
      });
      
      this.stories = stories;
      this.filteredStories = [...stories];
    } else {
      console.log('🎯 No stories in CategoryService, loading from Firebase');
      this.loadStoriesFromFirebase();
    }
    
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  private async loadStoriesFromFirebase() {
    try {
      console.log('🎯 Loading stories from Firebase for category:', this.category);
      
      // Try to get stories by category first
      let stories: any[] = [];
      
      // Get all stories and filter by category
      const allStories = await this.firebaseDataService.getAllStories().toPromise();
      
      if (allStories && allStories.length > 0) {
        console.log('🎯 All stories from Firebase:', allStories.length);
        
        // Try to filter by category name
        stories = allStories.filter(story => {
          // Strategy 1: Exact match
          if (story.category?.toLowerCase() === this.category.toLowerCase()) {
            return true;
          }
          // Strategy 2: Contains match
          if (story.category?.toLowerCase().includes(this.category.toLowerCase())) {
            return true;
          }
          // Strategy 3: Category contains story category
          if (this.category.toLowerCase().includes(story.category?.toLowerCase() || '')) {
            return true;
          }
          return false;
        });
        
        console.log('🎯 Filtered stories by category:', stories.length);
        
        // If no stories found for category, use all stories
        if (stories.length === 0) {
          console.log('🎯 No stories found for category, using all stories');
          stories = allStories;
        }
        
        this.stories = stories;
        this.filteredStories = [...stories];
      }
    } catch (error) {
      console.error('🎯 Error loading stories from Firebase:', error);
    }
    
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  onSearchChange(event: any) {
    const searchTerm = event.detail.value.toLowerCase();
    this.searchTerm = searchTerm;
    
    if (!searchTerm) {
      this.filteredStories = [...this.stories];
    } else {
      this.filteredStories = this.stories.filter(story =>
        story.title?.toLowerCase().includes(searchTerm) ||
        story.subtitle?.toLowerCase().includes(searchTerm)
      );
    }
  }

  onPlayStory(story: any) {
    console.log('🎵 Play button clicked for:', story.title);
    
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

    // Use the centralized method that handles all the fixes
    this.globalAudioPlayer.playFromCard(playRequest).then(success => {
      if (success) {
        console.log('✅ Audio started successfully for:', story.title);
      } else {
        console.log('❌ Failed to start audio for:', story.title);
      }
    }).catch(error => {
      console.error('❌ Error starting audio:', error);
    });
  }

  // TrackBy function for performance
  trackByStory(index: number, story: any): string {
    return story.id || index.toString();
  }

  back() {
    // Always go back to explore page
    console.log('🔙 Explore category back button clicked');
    this.router.navigateByUrl('/explore');
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
