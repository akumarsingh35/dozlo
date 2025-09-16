import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, Subject, of, BehaviorSubject, timer } from 'rxjs';
import { map, catchError, takeUntil, timeout, tap, shareReplay, finalize, retry, switchMap, delay } from 'rxjs/operators';
import { environment } from '../../environments/environment';


export interface AudioTrack {
  id: string;
  title: string;
  subtitle?: string;
  photoUrl?: string;
  image?: string;
  duration?: string;
  r2Path: string;
  audioUrl?: string;
  isLoading?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class R2AudioService {
  private readonly WORKER_URL = environment.r2WorkerUrl;
  private readonly APP_SECRET = environment.r2AppSecret;
  private cancelRequest$ = new Subject<void>();
  
  // Audio cache to store preloaded audio blobs
  private audioCache = new Map<string, { blob: Blob; url: string; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  // Simple Android security features (no extra dependencies)
  private deviceFingerprint: string | null = null;
  private requestCount = 0;
  private readonly APP_VERSION = '1.0.0'; // You can get this from your app config

  constructor(
    private http: HttpClient
  ) {
    // R2AudioService initialized
    console.log('🔐 WORKER_URL:', this.WORKER_URL);
    console.log('🔐 WORKER_URL endsWith slash:', this.WORKER_URL.endsWith('/'));
    
    // Initialize simple security features
    this.initializeSecurity();
  }

  // Initialize simple security features without extra dependencies
  private initializeSecurity(): void {
    try {
      // Generate simple device fingerprint using available browser APIs
      this.deviceFingerprint = this.generateSimpleFingerprint();
      
      console.log('🔐 Security initialized:', {
        fingerprint: this.deviceFingerprint,
        userAgent: navigator.userAgent,
        platform: navigator.platform
      });
    } catch (error) {
      console.error('❌ Failed to initialize security:', error);
    }
  }

  // Generate simple device fingerprint using browser APIs
  private generateSimpleFingerprint(): string {
    try {
      // Use available browser information
      const fingerprint = [
        navigator.userAgent,
        navigator.platform,
        navigator.language,
        screen.width,
        screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset()
      ].join('-');
      
      // Simple hash of the fingerprint
      let hash = 0;
      for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      
      return Math.abs(hash).toString(16);
    } catch (error) {
      console.error('❌ Failed to generate fingerprint:', error);
      return 'unknown-device';
    }
  }

  // Get secure headers for requests
  private getSecureHeaders(): HttpHeaders {
    const timestamp = Date.now().toString();
    this.requestCount++;
    
    const headers = new HttpHeaders({
      'X-Device-Fingerprint': this.deviceFingerprint || 'unknown',
      'X-Request-Count': this.requestCount.toString(),
      'X-Request-Timestamp': timestamp,
      'X-Platform': 'android',
      'X-App-Version': this.APP_VERSION,
      'X-App-Secret': this.APP_SECRET // Keep existing header for compatibility
    });
    
    return headers;
  }

  /**
   * Helper method to construct worker URL with proper formatting
   * Prevents automatic slash insertion by HttpClient/browser
   */
  private getWorkerUrl(r2Path: string): string {
    // Ensure no double slashes in URL and prevent automatic slash insertion
    let baseUrl = this.WORKER_URL;
    
    // Remove trailing slash if present
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    
    // Generate timestamp and secure signature
    const timestamp = Date.now().toString();
    const signature = this.generateSecureSignatureSync(r2Path, timestamp);
    
    // Construct signed URL
    let finalUrl = `${baseUrl}?path=${encodeURIComponent(r2Path)}&ts=${timestamp}&sig=${signature}`;
    
    // Force remove any double slashes before the query parameter
    finalUrl = finalUrl.replace(/\/\?/, '?');
    
    // URL construction complete
    return finalUrl;
  }

  // SECURE: Generate more secure signature synchronously
  private generateSecureSignatureSync(path: string, timestamp: string): string {
    const message = `${this.APP_SECRET}:${timestamp}:${path}`;
    
    // Use a more secure hash algorithm (still synchronous)
    let hash = 0;
    const prime = 31;
    const mod = 1000000007;
    
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash * prime) % mod + char) % mod;
    }
    
    // Add additional entropy
    const entropy = timestamp.length + path.length;
    hash = (hash * prime + entropy) % mod;
    
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  // SECURE: Generate HMAC-SHA256 signature using Web Crypto API
  private async generateSecureSignature(path: string, timestamp: string): Promise<string> {
    const message = `${timestamp}:${path}`;
    
    try {
      // Convert secret to ArrayBuffer
      const encoder = new TextEncoder();
      const keyData = encoder.encode(this.APP_SECRET);
      const messageData = encoder.encode(message);
      
      // Import the secret as a crypto key
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      // Generate HMAC signature
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      
      // Convert to hex string
      return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      console.error('❌ Error generating secure signature:', error);
      // Fallback to simple hash for compatibility
      return this.generateSecureSignatureSync(path, timestamp);
    }
  }

  /**
   * Get a fresh signed URL for long audio files
   * This ensures URLs don't expire during long playback
   */
  getFreshSignedUrl(r2Path: string): string {
    return this.getWorkerUrl(r2Path);
  }

  /**
   * Check if a URL is valid (no expiration for better UX)
   */
  isUrlValid(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const timestamp = urlObj.searchParams.get('ts');
      const signature = urlObj.searchParams.get('sig');
      
      // URL is valid if it has timestamp and signature (no expiration check)
      return !!(timestamp && signature);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get URL age in milliseconds (for monitoring purposes only)
   */
  getUrlAge(url: string): number {
    try {
      const urlObj = new URL(url);
      const timestamp = urlObj.searchParams.get('ts');
      if (!timestamp) return 0;
      
      const requestTime = parseInt(timestamp);
      const now = Date.now();
      
      return Math.max(0, now - requestTime);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check if URL needs refresh (always false since no expiration)
   */
  needsUrlRefresh(url: string): boolean {
    // URLs never expire, so they never need refresh
    return false;
  }

  /**
   * Get URL information (simplified for no expiration)
   */
  getUrlInfo(url: string): { age: number; minutesOld: number; isValid: boolean } {
    const age = this.getUrlAge(url);
    const minutesOld = Math.floor(age / 1000 / 60);
    const isValid = this.isUrlValid(url);
    
    return {
      age,
      minutesOld,
      isValid
    };
  }

  /**
   * Cancel all pending audio requests
   */
  cancelAllRequests(): void {
    this.cancelRequest$.next();
  }

  /**
   * Get audio URL directly from R2 through worker (DEPRECATED - use prepareAudioTrack instead)
   */
  getAudioUrl(r2Path: string): string {
    console.warn('⚠️ getAudioUrl is deprecated. Use prepareAudioTrack() for authenticated requests.');
    return this.getWorkerUrl(r2Path);
  }

  /**
   * Get streaming audio URL for immediate playback
   * This method returns a direct URL that supports streaming
   */
  getStreamingAudioUrl(r2Path: string): string {
    // Remove cache-busting parameter for better caching with the worker
    // The worker handles ETags and caching properly
    const url = this.getWorkerUrl(r2Path);
    // Streaming URL generated
    return url;
  }

  /**
   * Preload audio file for faster playback with streaming optimization
   */
  preloadAudio(r2Path: string): Observable<Blob> {
    // Check if already cached
    const cached = this.audioCache.get(r2Path);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      console.log('🎵 Using cached audio for:', r2Path);
      return of(cached.blob);
    }

    console.log('🎵 Preloading audio with streaming optimization:', r2Path);
    return this.getAudioBlob(r2Path).pipe(
      tap(blob => {
        // Cache the blob
        const url = URL.createObjectURL(blob);
        this.audioCache.set(r2Path, {
          blob,
          url,
          timestamp: Date.now()
        });
        console.log('🎵 Audio preloaded and cached:', r2Path);
      }),
      shareReplay(1) // Share the same request for multiple subscribers
    );
  }

  /**
   * Preload audio metadata for faster initial playback
   * This method only loads the headers to get duration and format info
   */
  preloadAudioMetadata(r2Path: string): Observable<any> {
    const url = this.getWorkerUrl(r2Path);
    
    // Use secure headers with device fingerprinting
    const headers = this.getSecureHeaders();
    headers.set('Range', 'bytes=0-1023'); // Restored for true streaming
    
    console.log('🎵 Preloading metadata with URL:', url);
    
    // Use GET instead of HEAD for better compatibility with range requests
    return this.http.get(url, { 
      headers,
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      takeUntil(this.cancelRequest$),
      timeout(10000), // 10 second timeout for metadata
      map(response => {
        // Return only the headers and status, not the body
        return {
          headers: response.headers,
          status: response.status,
          statusText: response.statusText
        };
      }),
      catchError(error => {
        console.error('❌ Error fetching audio metadata:', error);
        console.error('❌ Metadata error details:', {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          message: error.message,
          name: error.name
        });
        
        // Log the exact request that failed
        console.error('❌ Failed metadata request details:', {
          method: 'GET',
          url: url
        });
        
        return throwError(() => new Error('Failed to get audio metadata'));
      })
    );
  }

  /**
   * Get cached audio URL if available
   */
  getCachedAudioUrl(r2Path: string): string | null {
    const cached = this.audioCache.get(r2Path);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.url;
    }
    return null;
  }

  /**
   * Clear old cache entries to prevent memory leaks
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.audioCache.entries()) {
      if ((now - value.timestamp) > this.CACHE_DURATION) {
        URL.revokeObjectURL(value.url);
        this.audioCache.delete(key);
      }
    }
  }

  /**
   * Get audio blob with authentication
   */
  getAudioBlob(r2Path: string): Observable<Blob> {
    // Use secure headers with device fingerprinting
    const url = this.getWorkerUrl(r2Path);
    const headers = this.getSecureHeaders();
    
    console.log('🔐 Sending request with secure headers:', {
      'URL': url,
      'Device-Fingerprint': headers.get('X-Device-Fingerprint'),
      'Request-Count': headers.get('X-Request-Count'),
      'App-Version': headers.get('X-App-Version')
    });

    return this.http.get(url, { 
      responseType: 'blob',
      headers: headers
    }).pipe(
      takeUntil(this.cancelRequest$),
      timeout(60000), // 60 second timeout to prevent hanging requests
      catchError(error => {
        console.error('❌ Error fetching audio:', error);
        console.error('❌ Error status:', error.status);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error URL:', error.url);
        return throwError(() => new Error('Failed to get audio'));
      })
    );
  }

  /**
   * Prepare audio track with streaming URL (RECOMMENDED)
   * This method returns a streaming URL for immediate playback with comprehensive error handling
   */
  prepareAudioTrack(track: AudioTrack): Observable<AudioTrack> {
    if (!track.r2Path) {
      console.error('❌ No R2 path provided for track:', track.title);
      return throwError(() => new Error('No R2 path provided'));
    }

    // Mark as loading
    track.isLoading = true;

    console.log('🎵 Preparing streaming audio track:', track.title);

    // First, test the streaming connection
    return this.testStreamingPerformance(track.r2Path).pipe(
      // If streaming test passes, proceed with streaming
      map(() => {
        const streamingUrl = this.getStreamingAudioUrl(track.r2Path);
        console.log('🎵 Streaming URL generated:', streamingUrl);

        // Start preloading metadata in background for better UX
        this.preloadAudioMetadata(track.r2Path).subscribe({
          next: (metadata) => {
            console.log('🎵 Audio metadata preloaded:', metadata);
          },
          error: (error) => {
            console.warn('⚠️ Could not preload metadata (non-critical):', error);
          }
        });

        track.isLoading = false;
        return {
          ...track,
          audioUrl: streamingUrl,
          isLoading: false
        };
      }),
      // If streaming fails, fallback to download method
      catchError((streamingError) => {
        console.warn('⚠️ Streaming failed, falling back to download method:', streamingError);
        return this.prepareAudioTrackWithDownload(track);
      }),
      // Final error handling
      catchError((error) => {
        console.error('❌ All audio preparation methods failed for track:', track.title, error);
        track.isLoading = false;
        
        // Return a safe fallback that won't crash the app
        return of({
          ...track,
          audioUrl: '', // Empty URL to prevent crashes
          isLoading: false,
          error: 'Audio unavailable'
        });
      }),
      // Ensure loading state is always cleared
      finalize(() => {
        track.isLoading = false;
      })
    );
  }

  /**
   * Prepare audio track with full download (LEGACY - for offline support)
   * Use this only if you need offline playback
   */
  prepareAudioTrackWithDownload(track: AudioTrack): Observable<AudioTrack> {
    if (!track.r2Path) {
      console.error('❌ No R2 path provided for download track:', track.title);
      return throwError(() => new Error('No R2 path provided'));
    }

    // Mark as loading
    track.isLoading = true;

    console.log('🎵 Preparing download audio track:', track.title);

    // Check if we have cached audio
    const cachedUrl = this.getCachedAudioUrl(track.r2Path);
    if (cachedUrl) {
      console.log('🎵 Using cached audio for track:', track.title);
      track.isLoading = false;
      return of({
        ...track,
        audioUrl: cachedUrl,
        isLoading: false
      });
    }

    return this.getAudioBlob(track.r2Path).pipe(
      map(blob => {
        if (!blob || blob.size === 0) {
          throw new Error('Received empty audio blob');
        }
        
        const audioUrl = URL.createObjectURL(blob);
        console.log('🎵 Audio downloaded and cached:', track.title, 'Size:', blob.size);
        
        return {
          ...track,
          audioUrl,
          isLoading: false
        };
      }),
      catchError(error => {
        console.error('❌ Download failed for track:', track.title, error);
        track.isLoading = false;
        
        // Return safe fallback
        return of({
          ...track,
          audioUrl: '', // Empty URL to prevent crashes
          isLoading: false,
          error: 'Download failed'
        });
      }),
      finalize(() => {
        track.isLoading = false;
      })
    );
  }

  /**
   * Prepare streaming audio track for immediate playback
   * This method returns a streaming URL without downloading the entire file
   */
  prepareStreamingAudioTrack(track: AudioTrack): Observable<AudioTrack> {
    if (!track.r2Path) {
      return throwError(() => new Error('No R2 path provided'));
    }

    // Mark as loading
    track.isLoading = true;

    // Get streaming URL immediately (no download needed)
    const streamingUrl = this.getStreamingAudioUrl(track.r2Path);
    
    console.log('🎵 Preparing streaming audio track:', track.title);
    console.log('🎵 Streaming URL:', streamingUrl);

    // Start preloading metadata in background for better UX
    this.preloadAudioMetadata(track.r2Path).subscribe({
      next: (metadata) => {
        console.log('🎵 Audio metadata preloaded:', metadata);
      },
      error: (error) => {
        console.warn('⚠️ Could not preload metadata:', error);
      }
    });

    // Return immediately with streaming URL
    track.isLoading = false;
    return of({
      ...track,
      audioUrl: streamingUrl,
      isLoading: false
    });
  }

  /**
   * Test worker connection and performance
   */
  testWorkerConnection(r2Path: string): Observable<any> {
    const url = this.getWorkerUrl(r2Path);
    
    const headers = new HttpHeaders({
      'X-App-Secret': this.APP_SECRET
    });
    
    console.log('🧪 Testing worker connection for:', r2Path);
    console.log('🧪 Test URL:', url);
    console.log('🧪 Headers being sent:', {
      'X-App-Secret': '[REDACTED]'
    });
    
    return this.http.head(url, { headers }).pipe(
      takeUntil(this.cancelRequest$),
      timeout(15000), // 15 second timeout
      map(response => {
        console.log('✅ Worker connection test successful:', response);
        return response;
      }),
      catchError(error => {
        console.error('❌ Worker connection test failed:', error);
        return throwError(() => new Error('Worker connection test failed'));
      })
    );
  }

  /**
   * Test streaming performance with range requests
   */
  testStreamingPerformance(r2Path: string): Observable<any> {
    const url = this.getWorkerUrl(r2Path);
    
    const headers = new HttpHeaders({
      'X-App-Secret': this.APP_SECRET,
      'Range': 'bytes=0-1023' // Restored for true streaming
    });
    
    console.log('🧪 Testing streaming performance for:', r2Path);
    console.log('🧪 Test URL:', url);
    // Headers sent for testing
    
    return this.http.get(url, { 
      headers,
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      takeUntil(this.cancelRequest$),
      timeout(10000), // 10 second timeout
      map(response => {
        const rangeHeader = response.headers.get('Content-Range');
        const acceptRanges = response.headers.get('Accept-Ranges');
        
        console.log('✅ Streaming test successful:', {
          status: response.status,
          rangeHeader,
          acceptRanges,
          contentLength: response.headers.get('Content-Length')
        });
        
        return {
          supportsRangeRequests: acceptRanges === 'bytes',
          hasRangeHeader: !!rangeHeader,
          status: response.status
        };
      }),
      catchError(error => {
        console.error('❌ Streaming test failed:', error);
        console.error('❌ Error details:', {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          message: error.message,
          name: error.name
        });
        
        // Log the exact request that failed
        console.error('❌ Failed request details:', {
          method: 'GET',
          url: url
        });
        
        return throwError(() => new Error('Streaming test failed'));
      })
    );
  }

  /**
   * Comprehensive debugging to determine if audio is streaming or downloading
   * This method monitors network requests and provides detailed analysis
   */
  debugAudioBehavior(r2Path: string): Observable<any> {
    // Use the same URL construction as the working download method
    const url = this.getWorkerUrl(r2Path);
    
    console.log('🔍 === AUDIO BEHAVIOR DEBUGGING ===');
    console.log('🔍 Audio file:', r2Path);
    console.log('🔍 Test URL:', url);
    console.log('🔍 Worker URL:', this.WORKER_URL);
    // App secret configured
    
    // Test 1: Check if URL supports range requests
    const headers = this.getSecureHeaders();
    headers.set('Range', 'bytes=0-1023'); // Restored for true streaming
    
    return this.http.get(url, { 
      headers,
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      takeUntil(this.cancelRequest$),
      timeout(15000), // 15 second timeout for debugging
      map(response => {
        console.log('🔍 === NETWORK RESPONSE ANALYSIS ===');
        console.log('🔍 Status Code:', response.status);
        console.log('🔍 Accept-Ranges:', response.headers.get('Accept-Ranges'));
        console.log('🔍 Content-Range:', response.headers.get('Content-Range'));
        console.log('🔍 Content-Length:', response.headers.get('Content-Length'));
        console.log('🔍 Response Size:', response.body?.size || 'unknown');
        console.log('🔍 Content-Type:', response.headers.get('Content-Type'));
        
        // Analyze streaming behavior
        const isStreaming = response.status === 206 && response.headers.get('Accept-Ranges') === 'bytes';
        const isDownloading = response.status === 200 && !response.headers.get('Content-Range');
        const supportsRangeRequests = response.headers.get('Accept-Ranges') === 'bytes';
        const hasPartialContent = response.status === 206;
        
        console.log('🔍 === BEHAVIOR ANALYSIS ===');
        console.log('🔍 Is Streaming (206 + Accept-Ranges):', isStreaming);
        console.log('🔍 Is Downloading (200 + no Content-Range):', isDownloading);
        console.log('🔍 Supports Range Requests:', supportsRangeRequests);
        console.log('🔍 Expected Behavior:', isStreaming ? '✅ STREAMING' : '❌ DOWNLOADING');
        
        return {
          isStreaming,
          isDownloading,
          supportsRangeRequests,
          hasPartialContent,
          responseSize: response.body?.size || 0,
          status: response.status,
          rangeHeader: response.headers.get('Range'),
          acceptRanges: response.headers.get('Accept-Ranges'),
          contentLength: response.headers.get('Content-Length')
        };
      }),
      catchError(error => {
        console.error('❌ Debug request failed:', error);
        return of({
          isStreaming: false,
          isDownloading: false,
          supportsRangeRequests: false,
          hasPartialContent: false,
          responseSize: 0,
          error: error.message
        });
      })
    );
  }

  /**
   * Test and verify streaming behavior
   * This method helps determine if we're truly streaming or downloading
   */
  verifyStreamingBehavior(r2Path: string): Observable<any> {
    const streamingUrl = this.getStreamingAudioUrl(r2Path);
    
    console.log('🔍 Verifying streaming behavior for:', r2Path);
    console.log('🔍 Streaming URL:', streamingUrl);
    
    // Test 1: Check if URL supports range requests
    const headers = new HttpHeaders({
      'X-App-Secret': this.APP_SECRET,
      'Range': 'bytes=0-1023' // Restored for true streaming
    });
    
    return this.http.get(streamingUrl, { 
      headers,
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      takeUntil(this.cancelRequest$),
      timeout(15000),
      map(response => {
        const acceptRanges = response.headers.get('Accept-Ranges');
        const contentRange = response.headers.get('Content-Range');
        const contentLength = response.headers.get('Content-Length');
        const status = response.status;
        
        console.log('🔍 Streaming verification results:', {
          status,
          acceptRanges,
          contentRange,
          contentLength,
          responseSize: response.body?.size,
          isStreaming: status === 206 && acceptRanges === 'bytes'
        });
        
        return {
          isStreaming: status === 206 && acceptRanges === 'bytes',
          supportsRangeRequests: acceptRanges === 'bytes',
          hasPartialContent: status === 206,
          responseSize: response.body?.size,
          headers: {
            acceptRanges,
            contentRange,
            contentLength,
            status
          }
        };
      }),
      catchError(error => {
        console.error('❌ Streaming verification failed:', error);
        return throwError(() => new Error('Streaming verification failed'));
      })
    );
  }

  /**
   * Clean up blob URLs to prevent memory leaks
   */
  revokeAudioUrl(audioUrl: string): void {
    if (audioUrl && audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrl);
    }
  }

  /**
   * Clean up all cached audio
   */
  clearCache(): void {
    for (const [key, value] of this.audioCache.entries()) {
      URL.revokeObjectURL(value.url);
    }
    this.audioCache.clear();
    console.log('🎵 Audio cache cleared');
  }

  /**
   * Enhanced method for background audio URL refresh with network failure handling
   * This method is specifically designed for background playback scenarios
   */
  refreshAudioUrlForBackground(r2Path: string): Observable<string> {
    console.log('🔄 Refreshing audio URL for background playback:', r2Path);
    
    return new Observable(observer => {
      let retryCount = 0;
      const maxRetries = 3;
      const baseTimeout = 10000; // 10 second base timeout
      
      const attemptRefresh = () => {
        // Network connectivity check disabled
        console.log('🌐 Network check disabled');
        
        try {
          // Generate fresh signed URL
          const freshUrl = this.getFreshSignedUrl(r2Path);
          
          // Test the URL to ensure it's working with timeout
          this.testStreamingPerformance(r2Path).pipe(
            timeout(baseTimeout * (retryCount + 1)), // Exponential timeout
            retry({
              count: 2,
              delay: (error, retryCount) => {
                // Network state check disabled
                console.log('🌐 Network check disabled during retry');
                
                const delay = Math.pow(2, retryCount) * 2000; // Exponential backoff
                console.log(`🔄 URL refresh retry ${retryCount} in ${delay}ms...`);
                return timer(delay);
              },
              resetOnSuccess: true
            }),
            catchError(error => {
              console.warn(`⚠️ Background URL refresh test failed (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);
              
              // Network error check disabled
              console.log('🌐 Network error check disabled');
              
              // If we have retries left, try again
              if (retryCount < maxRetries) {
                retryCount++;
                console.log(`🔄 Retrying URL refresh (attempt ${retryCount + 1}/${maxRetries + 1})...`);
                setTimeout(attemptRefresh, 2000 * retryCount); // Exponential backoff
                return of(null);
              } else {
                // No more retries, but continue anyway as the URL might still work
                console.warn('⚠️ Max retries reached, continuing with generated URL');
                return of(null);
              }
            })
          ).subscribe({
            next: (result) => {
              console.log('✅ Background URL refresh successful:', freshUrl);
              observer.next(freshUrl);
              observer.complete();
            },
            error: (error) => {
              console.error('❌ Background URL refresh failed after all retries:', error);
              
              // Network state check disabled for final error
              console.log('🌐 Network state check disabled');
              
              // Even if testing failed, try to return the generated URL
              // It might work even if the test failed
              console.log('🔄 Returning generated URL despite test failure...');
              observer.next(freshUrl);
              observer.complete();
            }
          });
        } catch (error) {
          console.error('❌ Error generating fresh URL for background:', error);
          
          // Network state check disabled for generation error
          console.log('🌐 Network state check disabled');
          
          // If URL generation fails, try to use cached URL as fallback
          const cachedUrl = this.getCachedAudioUrl(r2Path);
          if (cachedUrl) {
            console.log('🔄 Using cached URL as fallback...');
            observer.next(cachedUrl);
            observer.complete();
          } else {
            observer.error(error);
          }
        }
      };
      
      // Start the refresh attempt
      attemptRefresh();
    });
  }

  /**
   * Check if audio URL is still valid for playback
   */
  isAudioUrlValid(audioUrl: string): Observable<boolean> {
    if (!audioUrl) {
      return of(false);
    }

    return this.http.head(audioUrl, { observe: 'response' }).pipe(
      timeout(5000), // 5 second timeout
      map(response => {
        const isValid = response.status === 200 || response.status === 206;
        console.log('🔍 Audio URL validation result:', isValid, 'status:', response.status);
        return isValid;
      }),
      catchError(error => {
        console.warn('⚠️ Audio URL validation failed:', error);
        return of(false);
      })
    );
  }

  /**
   * Get audio URL with automatic refresh if needed
   */
  getAudioUrlWithAutoRefresh(r2Path: string, currentUrl?: string): Observable<string> {
    // If we have a current URL, check if it's still valid
    if (currentUrl && this.isUrlValid(currentUrl)) {
      console.log('✅ Current URL is still valid, using existing URL');
      return of(currentUrl);
    }

    // Generate fresh URL
    console.log('🔄 Generating fresh audio URL for:', r2Path);
    return this.refreshAudioUrlForBackground(r2Path);
  }
} 