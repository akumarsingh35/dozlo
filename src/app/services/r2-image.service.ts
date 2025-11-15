import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class R2ImageService {
  private readonly IMAGE_WORKER_URL = environment.r2ImageWorkerUrl;
  private readonly APP_SECRET = environment.r2AppSecret;

  /**
   * Get secure image URL that works directly in <img> tags
   * No API calls needed - just URL generation
   */
  getSecureImageUrl(r2Path: string): string {
    if (!r2Path) {
      return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e'; // fallback
    }
    
    // Create secure URL with authentication
    return `${this.IMAGE_WORKER_URL}?path=${encodeURIComponent(r2Path)}&auth=${this.APP_SECRET}`;
  }

  /**
   * Get secure image URL with timestamp for cache busting (optional)
   */
  getSecureImageUrlWithCache(r2Path: string): string {
    if (!r2Path) {
      return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e'; // fallback
    }
    
    const timestamp = Date.now();
    return `${this.IMAGE_WORKER_URL}?path=${encodeURIComponent(r2Path)}&auth=${this.APP_SECRET}&t=${timestamp}`;
  }
}