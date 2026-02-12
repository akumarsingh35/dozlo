import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CategoryService } from './category.service';
import { GlobalAudioPlayerService } from '../services/global-audio-player.service';
import { R2ImageService } from '../services/r2-image.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-category',
  templateUrl: './category.page.html',
  styleUrls: ['./category.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class CategoryPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  categoryName: string = '';
  categoryId: string = '';
  stories: any[] = [];
  isLoading = true;

  constructor(
    private categoryService: CategoryService,
    public globalAudioPlayer: GlobalAudioPlayerService,
    private r2ImageService: R2ImageService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadCategoryData();
  }

  ionViewWillEnter() {
    this.loadCategoryData();
  }

  ionViewDidEnter() {
    this.loadCategoryData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCategoryData() {
    console.log('=== CategoryPage loadCategoryData called ===');
    
    const stories = this.categoryService.getStories();
    const categoryName = this.categoryService.getCategoryName();
    const categoryId = this.categoryService.getCategoryId();
    
    console.log('📊 Stories from service:', stories);
    console.log('📊 Category name from service:', categoryName);
    console.log('📊 Category ID from service:', categoryId);
    console.log('📊 Stories length:', stories?.length);
    
    if (stories && stories.length > 0) {
      this.stories = stories;
      this.categoryName = categoryName;
      this.categoryId = categoryId;
      this.isLoading = false;
      
      // Enrich stories with R2 URLs
      this.enrichStoriesWithR2Urls();
      
      // Force change detection
      this.cdr.detectChanges();
      
      console.log('✅ Category data loaded successfully');
      console.log('✅ Stories count:', this.stories.length);
      console.log('✅ Category name:', this.categoryName);
    } else {
      console.log('❌ No category data found');
      this.isLoading = false;
      // Navigate back to explore page if no data
      this.router.navigate(['/explore']);
    }

  }

  private enrichStoriesWithR2Urls() {
    this.stories.forEach(story => {
      if (story.imagePath && !story.imageUrl) {
        story.imageUrl = this.r2ImageService.getSecureImageUrl(story.imagePath);
      }
    });
  }

  trackByStory(index: number, story: any): string {
    return story.id || index.toString();
  }

  async onPlayStory(story: any) {
    console.log('🎵 Play button clicked for:', story.title);
    
    // CRITICAL FIX: Use centralized audio service instead of duplicating logic
    const playRequest = {
      storyId: story.id || '',
      title: story.title || '',
      r2Path: story.r2Path || story.audioPath || '',
      photoUrl: story.imageUrl || story.image || '',
      description: story.subTitle || story.subtitle || '',
      resumePosition: 0, // You can add resume position logic here if needed
      duration: Number(story.duration || 0),
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

  back() {
    this.router.navigate(['/explore']);
  }
}
