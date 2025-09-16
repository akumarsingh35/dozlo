import { Injectable } from '@angular/core';
import { FirebaseStory } from '../services/firebase-data.service';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private stories: FirebaseStory[] = [];
  private categoryName: string = '';
  private categoryId: string = '';

  setCategoryData(stories: FirebaseStory[], categoryName: string, categoryId: string) {
    console.log('🎯 CategoryService.setCategoryData called with:', stories?.length || 0, 'stories');
    console.log('🎯 Category name:', categoryName);
    console.log('🎯 Category ID:', categoryId);
    this.stories = stories || [];
    this.categoryName = categoryName;
    this.categoryId = categoryId;
    console.log('🎯 CategoryService stories after set:', this.stories.length);
  }

  getStories(): FirebaseStory[] {
    console.log('🎯 CategoryService.getStories called, returning:', this.stories.length, 'stories');
    return this.stories;
  }

  getCategoryName(): string {
    return this.categoryName;
  }

  getCategoryId(): string {
    return this.categoryId;
  }

  clearData() {
    console.log('🎯 CategoryService.clearData called');
    this.stories = [];
    this.categoryName = '';
    this.categoryId = '';
  }
} 