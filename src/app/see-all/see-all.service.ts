import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SeeAllService {
  private stories: any[] = [];
  private category: string = '';

  setStories(stories: any[], category?: string) {
    console.log('🎯 SeeAllService.setStories called with:', stories?.length || 0, 'stories');
    console.log('🎯 Category:', category);
    this.stories = stories || [];
    if (category) {
      this.category = category;
    }
    console.log('🎯 SeeAllService stories after set:', this.stories.length);
  }

  getStories() {
    console.log('🎯 SeeAllService.getStories called, returning:', this.stories.length, 'stories');
    return this.stories;
  }

  getCategory() {
    return this.category;
  }

  clearData() {
    console.log('🎯 SeeAllService.clearData called');
    this.stories = [];
    this.category = '';
  }
}
