import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface FavoriteStory {
  id: string;
  title: string;
  subTitle?: string;
  imageUrl?: string;
  audioUrl?: string;
  r2Path?: string;
  addedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private favoritesSubject = new BehaviorSubject<FavoriteStory[]>([]);
  private favorites: FavoriteStory[] = [];

  constructor() {
    this.loadFavorites();
  }

  getFavorites(): Observable<FavoriteStory[]> {
    return this.favoritesSubject.asObservable();
  }

  addToFavorites(story: any): void {
    const favoriteStory: FavoriteStory = {
      id: story.id || '',
      title: story.title || '',
      subTitle: story.subTitle || story.subtitle || '',
      imageUrl: story.imageUrl || story.photoUrl || '',
      audioUrl: story.audioUrl || '',
      r2Path: story.r2Path || '',
      addedAt: new Date()
    };

    if (!this.isFavorite(favoriteStory.id)) {
      this.favorites.push(favoriteStory);
      this.saveFavorites();
      this.favoritesSubject.next([...this.favorites]);
    }
  }

  removeFromFavorites(storyId: string): void {
    this.favorites = this.favorites.filter(fav => fav.id !== storyId);
    this.saveFavorites();
    this.favoritesSubject.next([...this.favorites]);
  }

  isFavorite(storyId: string): boolean {
    return this.favorites.some(fav => fav.id === storyId);
  }

  toggleFavorite(story: any): void {
    const storyId = story.id || '';
    if (this.isFavorite(storyId)) {
      this.removeFromFavorites(storyId);
    } else {
      this.addToFavorites(story);
    }
  }

  private saveFavorites(): void {
    try {
      localStorage.setItem('favorites', JSON.stringify(this.favorites));
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  }

  private loadFavorites(): void {
    try {
      const saved = localStorage.getItem('favorites');
      if (saved) {
        this.favorites = JSON.parse(saved);
        this.favoritesSubject.next([...this.favorites]);
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
      this.favorites = [];
    }
  }
}






