# Network Failure Handling - Audio URL Refresh & Error Recovery

## Overview

This implementation provides robust error handling for network failures, URL expiration issues, and audio playback problems with intelligent retry mechanisms and fallback strategies.

## **Network Failure Scenarios Handled**

### **1. URL Expiration Failures**
- **Scenario**: URL expires during playback, causing audio to stop
- **Handling**: Proactive URL refresh with retry mechanisms
- **Fallback**: Cached URLs, direct URL generation

### **2. Network Connectivity Issues**
- **Scenario**: Poor network connection, timeouts, DNS failures
- **Handling**: Exponential backoff retry with increasing delays
- **Fallback**: Multiple retry strategies based on error type

### **3. R2 Worker Failures**
- **Scenario**: Cloudflare R2 worker unavailable or slow
- **Handling**: Timeout protection and worker health checks
- **Fallback**: Direct URL generation, cached URLs

### **4. Audio Loading Failures**
- **Scenario**: Audio file corrupted, server errors, 404/500 responses
- **Handling**: Error categorization and appropriate retry strategies
- **Fallback**: URL refresh, delayed retry, graceful degradation

## **Error Handling Architecture**

### **1. Error Tracking System**

```typescript
// Error handling improvements
private retryCount = 0; // Track retry attempts
private maxRetries = 3; // Maximum retry attempts
private retryDelay = 3000; // Delay between retries (3 seconds)
private lastErrorTime = 0; // Track when last error occurred
private errorBackoffMultiplier = 2; // Exponential backoff multiplier
```

### **2. Error Classification**

#### **Load Errors** (`'load'`)
- **Causes**: Network timeouts, DNS failures, 404/500 responses
- **Strategy**: URL refresh with fallback to cached URLs
- **Retry**: Up to 3 attempts with exponential backoff

#### **Play Errors** (`'play'`)
- **Causes**: Audio format issues, browser compatibility, codec problems
- **Strategy**: Delayed retry with increasing delays
- **Retry**: Up to 3 attempts with exponential backoff

#### **Network Errors** (`'network'`)
- **Causes**: Connection lost, server unavailable, proxy issues
- **Strategy**: URL refresh with multiple fallback options
- **Retry**: Up to 3 attempts with exponential backoff

## **Retry Strategies**

### **1. Immediate Retry**
```typescript
case 'immediate':
  console.log('🔄 Immediate retry...');
  setTimeout(() => {
    if (this.audioUrl && !this.isPlaying) {
      this.initializeAudio();
    }
  }, 1000);
  break;
```

**Use Case**: Quick network hiccups, temporary server issues

### **2. Delayed Retry with Exponential Backoff**
```typescript
case 'delayed':
  const delay = this.retryDelay * Math.pow(this.errorBackoffMultiplier, this.retryCount - 1);
  console.log(`🔄 Delayed retry in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})...`);
  setTimeout(() => {
    if (this.audioUrl && !this.isPlaying) {
      this.initializeAudio();
    }
  }, delay);
  break;
```

**Use Case**: Persistent network issues, server overload

### **3. URL Refresh Retry**
```typescript
case 'url_refresh':
  console.log('🔄 URL refresh retry...');
  if (this.r2Path && !this.isUrlRefreshing) {
    this.regenerateAudioUrlWithErrorHandling();
  } else {
    // Fallback to delayed retry
  }
  break;
```

**Use Case**: URL expiration, authentication failures, worker issues

## **URL Refresh Error Handling**

### **1. Enhanced URL Refresh with Retry**
```typescript
refreshAudioUrlForBackground(r2Path: string): Observable<string> {
  return new Observable(observer => {
    let retryCount = 0;
    const maxRetries = 2;
    const baseTimeout = 10000; // 10 second base timeout
    
    const attemptRefresh = () => {
      // Generate fresh URL and test with timeout
      this.testStreamingPerformance(r2Path).pipe(
        timeout(baseTimeout * (retryCount + 1)), // Exponential timeout
        catchError(error => {
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(attemptRefresh, 2000 * retryCount); // Exponential backoff
            return of(null);
          } else {
            // Continue with generated URL despite test failure
            return of(null);
          }
        })
      ).subscribe({
        next: (result) => {
          observer.next(freshUrl);
          observer.complete();
        },
        error: (error) => {
          // Return generated URL even if test failed
          observer.next(freshUrl);
          observer.complete();
        }
      });
    };
    
    attemptRefresh();
  });
}
```

### **2. Fallback Strategies for URL Refresh**

#### **Strategy 1: Cached URL Fallback**
```typescript
// Try to use cached URL if available
const cachedUrl = this.r2AudioService.getCachedAudioUrl(this.r2Path);
if (cachedUrl) {
  console.log('🔄 Using cached URL as fallback...');
  this.audioUrl = cachedUrl;
  this.initializeAudio();
  return;
}
```

#### **Strategy 2: Direct URL Generation**
```typescript
// Try direct URL generation without testing
try {
  console.log('🔄 Attempting direct URL generation...');
  const directUrl = this.r2AudioService.getFreshSignedUrl(this.r2Path);
  this.audioUrl = directUrl;
  this.initializeAudio();
  return;
} catch (directError) {
  console.error('❌ Direct URL generation also failed:', directError);
}
```

#### **Strategy 3: Delayed Retry**
```typescript
// Final fallback: delayed retry
const delay = this.retryDelay * Math.pow(this.errorBackoffMultiplier, this.retryCount - 1);
console.log(`🔄 Final fallback: delayed retry in ${delay}ms...`);
setTimeout(() => {
  if (this.audioUrl && !this.isPlaying) {
    this.initializeAudio();
  }
}, delay);
```

## **Error Recovery Flow**

### **1. Error Detection**
```typescript
private handleAudioError(errorType: 'load' | 'play' | 'network', error: any): void {
  // Record error in stability service
  this.backgroundStabilityService.recordPlaybackError();
  
  // Update error tracking
  this.lastErrorTime = Date.now();
  this.retryCount++;
  
  // Clean up audio state
  this.isPlaying = false;
  this.cancelProgressBar();
  this.ambientAudioService.stopAll();
}
```

### **2. Error Classification**
```typescript
switch (errorType) {
  case 'load':
    errorMessage = 'Failed to load audio. Please check your connection.';
    shouldRetry = this.retryCount < this.maxRetries;
    retryStrategy = 'url_refresh';
    break;
  case 'play':
    errorMessage = 'Playback error. Please try again.';
    shouldRetry = this.retryCount < this.maxRetries;
    retryStrategy = 'delayed';
    break;
  case 'network':
    errorMessage = 'Network error. Please check your connection.';
    shouldRetry = this.retryCount < this.maxRetries;
    retryStrategy = 'url_refresh';
    break;
}
```

### **3. Retry Execution**
```typescript
if (shouldRetry && this.audioUrl) {
  this.handleRetryStrategy(retryStrategy, errorType);
} else {
  // Max retries reached
  this.resetRetryCount();
  this.showFinalErrorMessage(errorMessage);
}
```

## **Network Monitoring & Stability**

### **1. Stability Service Integration**
```typescript
// Check if we should pause due to stability issues
if (this.backgroundStabilityService.shouldPauseAudio()) {
  console.warn('⚠️ Pausing audio due to stability issues');
  this.resetRetryCount();
  return;
}
```

### **2. Error Rate Tracking**
- **Consecutive Errors**: Track number of consecutive failures
- **Error Patterns**: Identify recurring error types
- **Stability Assessment**: Determine when to pause audio

### **3. Graceful Degradation**
- **Partial Functionality**: App continues working even with audio issues
- **User Feedback**: Clear error messages and status updates
- **State Recovery**: Proper cleanup and state restoration

## **Timeout Protection**

### **1. URL Refresh Timeouts**
```typescript
timeout(baseTimeout * (retryCount + 1)) // Exponential timeout
```

**Timeout Values:**
- **Attempt 1**: 10 seconds
- **Attempt 2**: 20 seconds  
- **Attempt 3**: 30 seconds

### **2. Audio Loading Timeouts**
```typescript
timeout(60000) // 60 second timeout for audio loading
```

### **3. Network Request Timeouts**
```typescript
timeout(5000) // 5 second timeout for URL validation
```

## **User Experience During Failures**

### **1. Loading Indicators**
- **URL Refresh**: Shows loading spinner during refresh
- **Retry Attempts**: Visual feedback for retry operations
- **Error States**: Clear indication of error conditions

### **2. Error Messages**
```typescript
private showFinalErrorMessage(message: string): void {
  console.error('❌ Final error message:', message);
  
  // Update UI to show error state
  this.isLoading = false;
  this.isUrlRefreshing = false;
  
  // Update global state
  this.globalAudioPlayerService.stop();
}
```

### **3. Recovery Options**
- **Automatic Retry**: Transparent retry attempts
- **Manual Retry**: User can manually retry
- **Alternative Content**: Suggest other audio options

## **Testing Network Failure Scenarios**

### **1. Network Disconnection Test**
1. Start playing audio
2. Disconnect network (WiFi/mobile data)
3. Verify error handling and retry mechanisms
4. Reconnect network
5. Verify automatic recovery

### **2. URL Expiration Test**
1. Start playing audio
2. Wait for URL to expire (10+ minutes)
3. Verify proactive URL refresh
4. Check position preservation
5. Verify seamless playback continuation

### **3. Server Failure Test**
1. Start playing audio
2. Simulate server errors (404/500 responses)
3. Verify retry strategies
4. Check fallback mechanisms
5. Verify graceful degradation

### **4. Slow Network Test**
1. Start playing audio on slow connection
2. Verify timeout handling
3. Check retry with exponential backoff
4. Verify user feedback during delays
5. Check eventual success or graceful failure

## **Console Logs for Monitoring**

### **Successful Recovery:**
```
❌ Audio load error: NetworkError
🔄 URL refresh retry...
✅ URL refresh successful: https://...
✅ Seeking to previous position: 325 seconds
✅ Playback resumed after URL regeneration
```

### **Retry Attempts:**
```
🔄 Delayed retry in 3000ms (attempt 1/3)...
🔄 Delayed retry in 6000ms (attempt 2/3)...
🔄 Delayed retry in 12000ms (attempt 3/3)...
```

### **Fallback Strategies:**
```
❌ URL refresh failed, attempting fallback strategies...
🔄 Using cached URL as fallback...
🔄 Attempting direct URL generation...
🔄 Final fallback: delayed retry in 3000ms...
```

### **Final Failure:**
```
❌ Max retries reached for URL refresh
❌ Final error message: Unable to load audio. Please check your connection and try again.
```

## **Configuration Options**

### **Retry Settings:**
```typescript
private maxRetries = 3; // Maximum retry attempts
private retryDelay = 3000; // Base delay between retries
private errorBackoffMultiplier = 2; // Exponential backoff multiplier
```

### **Timeout Settings:**
```typescript
const baseTimeout = 10000; // 10 second base timeout
const maxRetries = 2; // Maximum URL refresh retries
```

### **Stability Settings:**
```typescript
// In background stability service
shouldPauseAudio(): boolean {
  return this.consecutiveErrors > 5; // Pause after 5 consecutive errors
}
```

## **Benefits**

### **User Experience:**
- ✅ **Seamless Recovery** - Most failures are invisible to users
- ✅ **Clear Feedback** - Users know when issues occur
- ✅ **Graceful Degradation** - App continues working
- ✅ **Automatic Recovery** - No manual intervention needed

### **Developer Experience:**
- ✅ **Comprehensive Logging** - Easy to debug issues
- ✅ **Predictable Behavior** - Consistent error handling
- ✅ **Maintainable Code** - Clear separation of concerns
- ✅ **Testable Scenarios** - Easy to test failure modes

### **System Reliability:**
- ✅ **Fault Tolerance** - Handles various failure types
- ✅ **Resource Management** - Proper cleanup and timeouts
- ✅ **Performance Optimization** - Efficient retry strategies
- ✅ **Scalability** - Handles multiple concurrent failures

## **Conclusion**

The network failure handling system provides:
- **Robust Error Recovery** - Handles all common failure scenarios
- **Intelligent Retry Logic** - Appropriate strategies for different errors
- **Multiple Fallback Options** - Ensures audio continues when possible
- **Excellent User Experience** - Seamless recovery and clear feedback
- **Comprehensive Monitoring** - Detailed logging for debugging

The system ensures that audio playback is reliable even under poor network conditions, providing a professional user experience similar to native music apps.
