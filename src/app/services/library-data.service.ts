import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface LibraryStory {
  id: string;
  title: string;
  subTitle?: string;
  imageUrl?: string;
  audioUrl?: string;
  r2Path?: string;
  duration?: number;
  lastPlayedAt?: Date | string;
  playCount?: number;
  progress?: number;
}

@Injectable({
  providedIn: 'root'
})
export class LibraryDataService {
  private librarySubject = new BehaviorSubject<LibraryStory[]>([]);
  private library: LibraryStory[] = [];
  private readonly MAX_LIBRARY_ITEMS = 200; // Capacity cap; evict oldest beyond this

  constructor() {
    this.loadLibrary();
  }

  getLibrary(): Observable<LibraryStory[]> {
    return this.librarySubject.asObservable();
  }

  addToLibrary(story: any): void {
    const libraryStory: LibraryStory = {
      id: story.id || '',
      title: story.title || '',
      subTitle: story.subTitle || story.subtitle || '',
      imageUrl: story.imageUrl || story.photoUrl || '',
      audioUrl: story.audioUrl || '',
      r2Path: story.r2Path || '',
      duration: story.duration || 0,
      lastPlayedAt: new Date(),
      playCount: 1,
      progress: 0
    };

    const existingIndex = this.library.findIndex(item => item.id === libraryStory.id);
    if (existingIndex >= 0) {
      // Update existing story
      this.library[existingIndex] = {
        ...this.library[existingIndex],
        lastPlayedAt: new Date(),
        playCount: (this.library[existingIndex].playCount || 0) + 1
      };
    } else {
      // Add new story
      this.library.push(libraryStory);
    }

    this.enforceCapacity();
    this.saveLibrary();
    this.librarySubject.next([...this.library]);
  }

  updateProgress(storyId: string, progress: number): void {
    const storyIndex = this.library.findIndex(item => item.id === storyId);
    if (storyIndex >= 0) {
      this.library[storyIndex].progress = progress;
      this.library[storyIndex].lastPlayedAt = new Date();
      this.saveLibrary();
      this.librarySubject.next([...this.library]);
    }
  }

  updateMetadata(storyId: string, partial: Partial<LibraryStory>): void {
    const storyIndex = this.library.findIndex(item => item.id === storyId);
    if (storyIndex >= 0) {
      this.library[storyIndex] = { ...this.library[storyIndex], ...partial, lastPlayedAt: new Date() };
      this.saveLibrary();
      this.librarySubject.next([...this.library]);
    }
  }

  markCompleted(storyId: string): void {
    const storyIndex = this.library.findIndex(item => item.id === storyId);
    if (storyIndex >= 0) {
      this.library[storyIndex].progress = 1;
      this.library[storyIndex].lastPlayedAt = new Date();
      // Increment play count on completion if it wasn't incremented already on play
      this.library[storyIndex].playCount = (this.library[storyIndex].playCount || 0) + 0;
      this.saveLibrary();
      this.librarySubject.next([...this.library]);
    }
  }

  removeFromLibrary(storyId: string): void {
    this.library = this.library.filter(item => item.id !== storyId);
    this.saveLibrary();
    this.librarySubject.next([...this.library]);
  }

  isInLibrary(storyId: string): boolean {
    return this.library.some(item => item.id === storyId);
  }

  getRecentlyPlayed(limit: number = 10): LibraryStory[] {
    return this.library
      .filter(story => (story.progress || 0) >= 0.98)
      .sort((a, b) => new Date(b.lastPlayedAt as any).getTime() - new Date(a.lastPlayedAt as any).getTime())
      .slice(0, limit);
  }

  getContinueListening(limit: number = 10): LibraryStory[] {
    return this.library
      .filter(story => {
        const p = story.progress || 0;
        return p > 0 && p < 0.98;
      })
      .sort((a, b) => new Date(b.lastPlayedAt as any).getTime() - new Date(a.lastPlayedAt as any).getTime())
      .slice(0, limit);
  }

  getMostPlayed(limit: number = 10): LibraryStory[] {
    return this.library
      .filter(story => story.playCount && story.playCount > 0)
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, limit);
  }

  getTotalPlayTime(): number {
    return this.library.reduce((total, story) => {
      return total + (story.duration || 0) * (story.playCount || 0);
    }, 0);
  }

  getWeeklyPlayTime(): number {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return this.library
      .filter(story => story.lastPlayedAt && new Date(story.lastPlayedAt) > sevenDaysAgo)
      .reduce((total, story) => {
        return total + (story.duration || 0) * (story.playCount || 0);
      }, 0);
  }

  private saveLibrary(): void {
    try {
      localStorage.setItem('library', JSON.stringify(this.library));
    } catch (error) {
      console.error('Error saving library:', error);
    }
  }

  private loadLibrary(): void {
    try {
      const saved = localStorage.getItem('library');
      if (saved) {
        this.library = JSON.parse(saved).map((s: any) => ({
          ...s,
          // Normalize date type if deserialized as string
          lastPlayedAt: s.lastPlayedAt ? new Date(s.lastPlayedAt) : undefined
        }));
        this.librarySubject.next([...this.library]);
      }
    } catch (error) {
      console.error('Error loading library:', error);
      this.library = [];
    }
  }

  private enforceCapacity(): void {
    if (this.library.length <= this.MAX_LIBRARY_ITEMS) return;
    // Sort by lastPlayedAt ascending and remove oldest
    this.library.sort((a, b) => new Date(a.lastPlayedAt as any).getTime() - new Date(b.lastPlayedAt as any).getTime());
    this.library = this.library.slice(this.library.length - this.MAX_LIBRARY_ITEMS);
  }
}






