import { Injectable } from '@angular/core';

export interface AudioTrack {
  id: string;
  title: string;
  subtitle?: string;
  photoUrl?: string;
  duration?: string;
  r2Path?: string;
  audioUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OptimizedAudioService {
  private audioCache: Map<string, HTMLAudioElement> = new Map();

  constructor() {}

  /**
   * Preload audio files for the given track IDs and track metadata.
   * This method fetches and caches audio elements to reduce load time.
   */
  preloadAudio(trackIds: string[], audioTracks: AudioTrack[]): void {
    audioTracks.forEach(track => {
      if (track.audioUrl && !this.audioCache.has(track.id)) {
        const audio = new Audio(track.audioUrl);
        // Preload metadata and buffer
        audio.preload = 'auto';
        audio.load();
        this.audioCache.set(track.id, audio);
      }
    });
  }

  /**
   * Get a cached audio element if available, or create a new one.
   * This ensures instant playback if already preloaded.
   */
  getAudioElement(track: AudioTrack): HTMLAudioElement {
    if (this.audioCache.has(track.id)) {
      return this.audioCache.get(track.id)!;
    }
    if (track.audioUrl) {
      const audio = new Audio(track.audioUrl);
      audio.preload = 'auto';
      this.audioCache.set(track.id, audio);
      return audio;
    }
    throw new Error('Audio URL is missing for track: ' + track.id);
  }

  /**
   * Optionally clear the cache to free memory
   */
  clearCache(): void {
    this.audioCache.clear();
  }
}
