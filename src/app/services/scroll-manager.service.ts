import { Injectable, NgZone } from '@angular/core';
import { Platform } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class ScrollManagerService {
  private resizeObserver: ResizeObserver | null = null;
  private contentElements = new Map<string, HTMLElement>();

  constructor(
    private platform: Platform,
    private ngZone: NgZone
  ) {
    this.initializeScrollManager();
  }

  private initializeScrollManager() {
    this.platform.ready().then(() => {
      if (this.platform.is('android')) {
        this.setupAndroidScrollBehavior();
      }
    });
  }

  private setupAndroidScrollBehavior() {
    // Prevent overscroll bounce on Android
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';

    // Add global CSS to prevent scrollbars on short content
    this.addGlobalScrollStyles();
  }

  private addGlobalScrollStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Android WebView scrollbar prevention */
      ion-content::part(scroll) {
        overscroll-behavior: none !important;
        -webkit-overflow-scrolling: touch;
      }
      
      /* Prevent scrollbar on short content */
      .content-short {
        overflow: hidden !important;
      }
      
      .content-short ion-content::part(scroll) {
        overflow: hidden !important;
        pointer-events: none !important;
        touch-action: none !important;
        transform: none !important;
      }
      
      /* Re-enable scroll when content overflows */
      .content-overflow ion-content::part(scroll) {
        overflow-y: auto !important;
        pointer-events: auto !important;
        touch-action: pan-y pinch-zoom !important;
      }
      
      /* Ensure header stays visible */
      ion-header {
        position: relative !important;
        z-index: 1000 !important;
      }
      
      /* Content spacing protection */
      .initial-content,
      .search-results,
      .main-content,
      .page-content {
        /* Ensure minimum bottom spacing for footer and audio player */
        padding-bottom: calc(44px + 56px + env(safe-area-inset-bottom, 20px) + 20px) !important;
      }
      
      /* When audio player is not visible, reduce padding */
      .no-audio-player .initial-content,
      .no-audio-player .search-results,
      .no-audio-player .main-content,
      .no-audio-player .page-content {
        padding-bottom: calc(44px + env(safe-area-inset-bottom, 20px) + 20px) !important;
      }
      
      /* Force hide scrollbars on Android */
      @media screen and (max-width: 768px) {
        ion-content::part(scroll)::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Monitor content height and prevent scrollbars on short content
   */
  public monitorContentHeight(pageId: string, contentElement: HTMLElement) {
    this.contentElements.set(pageId, contentElement);

    // Use ResizeObserver to monitor content height changes
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver((entries) => {
        this.ngZone.run(() => {
          entries.forEach(entry => {
            this.checkContentHeight(entry.target as HTMLElement, pageId);
          });
        });
      });

      this.resizeObserver.observe(contentElement);
    } else {
      // Fallback for older browsers
      this.setupFallbackHeightMonitoring(contentElement, pageId);
    }

    // Initial check
    this.checkContentHeight(contentElement, pageId);
    
    // Also monitor audio player visibility
    this.monitorAudioPlayerVisibility();
  }

  private checkContentHeight(element: HTMLElement, pageId: string) {
    const viewportHeight = window.innerHeight;
    const contentHeight = element.scrollHeight;
    const hasOverflow = contentHeight > viewportHeight;

    // Add or remove class based on content height
    if (hasOverflow) {
      element.classList.remove('content-short');
      element.classList.add('content-overflow');
    } else {
      element.classList.add('content-short');
      element.classList.remove('content-overflow');
    }

    console.log(`📏 Content height check for ${pageId}:`, {
      viewportHeight,
      contentHeight,
      hasOverflow,
      element: element.tagName
    });
  }

  private setupFallbackHeightMonitoring(element: HTMLElement, pageId: string) {
    // Use MutationObserver as fallback
    const observer = new MutationObserver(() => {
      this.checkContentHeight(element, pageId);
    });

    observer.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    // Also check on window resize
    window.addEventListener('resize', () => {
      this.checkContentHeight(element, pageId);
    });
  }

  /**
   * Stop monitoring content height for a specific page
   */
  public stopMonitoring(pageId: string) {
    const element = this.contentElements.get(pageId);
    if (element && this.resizeObserver) {
      this.resizeObserver.unobserve(element);
    }
    this.contentElements.delete(pageId);
  }

  /**
   * Force check content height for all monitored elements
   */
  public forceCheckAll() {
    this.contentElements.forEach((element, pageId) => {
      this.checkContentHeight(element, pageId);
    });
  }

  /**
   * Clean up all observers
   */
  public destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.contentElements.clear();
  }

  /**
   * Get scroll behavior info for debugging
   */
  public getScrollInfo(pageId: string) {
    const element = this.contentElements.get(pageId);
    if (!element) return null;

    return {
      pageId,
      viewportHeight: window.innerHeight,
      contentHeight: element.scrollHeight,
      hasOverflow: element.scrollHeight > window.innerHeight,
      isShort: element.classList.contains('content-short'),
      isOverflow: element.classList.contains('content-overflow')
    };
  }

  private monitorAudioPlayerVisibility() {
    // Check for audio player visibility and adjust padding accordingly
    const audioPlayer = document.querySelector('app-global-audio-player');
    if (audioPlayer) {
      // Audio player is present, ensure proper padding
      document.body.classList.add('with-audio-player');
      document.body.classList.remove('no-audio-player');
    } else {
      // No audio player, reduce padding
      document.body.classList.add('no-audio-player');
      document.body.classList.remove('with-audio-player');
    }
    
    // Monitor for changes in audio player visibility
    const observer = new MutationObserver(() => {
      const audioPlayer = document.querySelector('app-global-audio-player');
      if (audioPlayer) {
        document.body.classList.add('with-audio-player');
        document.body.classList.remove('no-audio-player');
      } else {
        document.body.classList.add('no-audio-player');
        document.body.classList.remove('with-audio-player');
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}
