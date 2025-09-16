import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-bottom-spacer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="bottom-spacer" 
      [style.height.px]="spacerHeight"
      [attr.data-footer-visible]="showFooter"
      [attr.data-player-visible]="showPlayer">
    </div>
  `,
  styles: [`
    .bottom-spacer {
      width: 100%;
      /* This div is invisible but takes up space */
      background: transparent;
      pointer-events: none;
      /* Ensure it doesn't interfere with scrolling */
      position: relative;
      z-index: -1;
    }
  `]
})
export class BottomSpacerComponent implements OnInit, OnDestroy {
  @Input() showFooter: boolean = true;
  @Input() showPlayer: boolean = false;
  
  spacerHeight: number = 0;
  private intervalId: any = null;
  
  // Heights in pixels
  private readonly FOOTER_HEIGHT = 44;
  private readonly PLAYER_HEIGHT = 56;
  private readonly SAFE_AREA_BOTTOM = 20; // Default safe area bottom
  
  constructor() {}
  
  ngOnInit() {
    this.calculateSpacerHeight();
    
    // Listen for window resize events
    window.addEventListener('resize', () => this.calculateSpacerHeight());
    
    // Check for audio player changes periodically
    this.intervalId = setInterval(() => {
      this.calculateSpacerHeight();
    }, 1000); // Check every second
  }
  
  ngOnDestroy() {
    window.removeEventListener('resize', () => this.calculateSpacerHeight());
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
  
  private calculateSpacerHeight(): void {
    let height = 0;
    
    // Add footer height if visible
    if (this.showFooter) {
      height += this.FOOTER_HEIGHT;
      height += this.getSafeAreaBottom();
    }
    
    // Add player height if visible and there's a current track
    if (this.showPlayer) {
      const audioPlayer = document.querySelector('app-global-audio-player') as HTMLElement;
      if (audioPlayer && audioPlayer.offsetHeight > 0) {
        height += this.PLAYER_HEIGHT;
      }
    }
    
    this.spacerHeight = height;
  }
  
  private getSafeAreaBottom(): number {
    // Try to get safe area bottom from CSS environment variable
    if (typeof window !== 'undefined') {
      const safeArea = getComputedStyle(document.documentElement)
        .getPropertyValue('--ion-safe-area-bottom');
      
      if (safeArea) {
        const parsed = parseInt(safeArea);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
      
      // Fallback to CSS env() function
      const envSafeArea = getComputedStyle(document.documentElement)
        .getPropertyValue('env(safe-area-inset-bottom)');
      
      if (envSafeArea) {
        const parsed = parseInt(envSafeArea);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }
    
    return this.SAFE_AREA_BOTTOM;
  }
}
