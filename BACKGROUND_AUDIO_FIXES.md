# Background Audio Stability Fixes

This document outlines the comprehensive fixes implemented to resolve background audio playback issues that were causing app crashes.

## Problem Analysis

The app was experiencing crashes when playing audio in the background due to several issues:

1. **URL Expiration**: Cloudflare R2 URLs expire after 10 minutes, causing audio to fail during long playback sessions
2. **Network Connectivity**: No handling for network disconnections during background playback
3. **Error Cascading**: Audio errors weren't properly handled, leading to cascading failures
4. **Background Mode Issues**: Inadequate background mode management on Android
5. **Resource Management**: Memory leaks and improper cleanup of audio resources

## Implemented Solutions

### 1. Enhanced URL Expiration Management

**File**: `src/app/global-audio-player/global-audio-player.component.ts`

- **Proactive URL Refresh**: URLs are refreshed 5 minutes before expiry (instead of 2 minutes)
- **Background Monitoring**: Continuous monitoring of URL expiration during background playback
- **Automatic Recovery**: Seamless URL regeneration without interrupting playback
- **State Preservation**: Maintains playback position during URL refresh

```typescript
private shouldRefreshUrl(): boolean {
  // Refresh if less than 5 minutes left (more conservative than 2 minutes)
  return timeUntilExpiry < this.urlRefreshThreshold;
}
```

### 2. Background Audio Stability Service

**File**: `src/app/services/background-audio-stability.service.ts`

New service specifically designed to monitor and maintain audio stability:

- **Network Monitoring**: Tracks network connectivity changes
- **Error Tracking**: Monitors consecutive playback errors
- **Stability Assessment**: Determines when audio should be paused due to issues
- **Proactive Actions**: Takes corrective actions before problems occur

```typescript
export interface BackgroundAudioState {
  isAppActive: boolean;
  isNetworkConnected: boolean;
  networkType: string;
  hasAudioFocus: boolean;
  lastUrlRefresh: number;
  urlExpiryTime: number;
  playbackErrors: number;
  consecutiveErrors: number;
}
```

### 3. Enhanced Error Handling

**File**: `src/app/global-audio-player/global-audio-player.component.ts`

- **Comprehensive Error Types**: Separate handling for load, play, and network errors
- **Error Recovery**: Automatic retry mechanisms with exponential backoff
- **Stability Integration**: Errors are tracked and used to make stability decisions
- **Graceful Degradation**: App continues to function even when audio fails

```typescript
private handleAudioError(errorType: 'load' | 'play' | 'network', error: any): void {
  // Record error in stability service
  this.backgroundStabilityService.recordPlaybackError();
  
  // Check if we should pause due to stability issues
  if (this.backgroundStabilityService.shouldPauseAudio()) {
    console.warn('⚠️ Pausing audio due to stability issues');
    return;
  }
}
```

### 4. Improved R2 Audio Service

**File**: `src/app/services/r2-audio.service.ts`

- **Background URL Refresh**: Specialized method for background URL regeneration
- **URL Validation**: Checks if URLs are still valid before use
- **Auto-refresh Logic**: Automatically refreshes URLs when needed
- **Enhanced Error Recovery**: Better handling of network failures

```typescript
refreshAudioUrlForBackground(r2Path: string): Observable<string> {
  // Generate fresh signed URL with validation
  // Test the URL to ensure it's working
  // Return validated URL for immediate use
}
```

### 5. Enhanced Background Mode Management

**File**: `src/app/global-audio-player/global-audio-player.component.ts`

- **Proactive Background Mode**: Enables background mode when audio starts playing
- **State Synchronization**: Ensures UI state matches actual playback state
- **Resource Cleanup**: Proper cleanup when audio stops or app is destroyed
- **Media Session Integration**: Better integration with Android media controls

```typescript
private async enableBackgroundMode(): Promise<void> {
  await BackgroundMode.enable({
    title: 'Dozlo Audio',
    text: 'Playing audio in background',
    icon: 'ic_launcher',
    color: '#120f29',
    hidden: false,
    silent: false
  });
}
```

## Key Features

### 1. Proactive URL Management
- URLs are refreshed 5 minutes before expiry
- Background monitoring every 30 seconds
- Seamless playback continuation after refresh

### 2. Network Resilience
- Monitors network connectivity changes
- Automatically pauses audio when network is lost
- Resumes playback when network is restored

### 3. Error Prevention
- Tracks consecutive errors to prevent cascading failures
- Automatically pauses audio after 5 consecutive errors
- Provides recovery mechanisms for different error types

### 4. Resource Management
- Proper cleanup of audio resources
- Memory leak prevention
- Background monitoring cleanup

### 5. User Experience
- Seamless background playback
- No interruption during URL refresh
- Graceful handling of network issues

## Configuration

### Android Permissions
The following permissions are required in `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```

### Capacitor Configuration
Background mode is configured in `capacitor.config.ts`:

```typescript
BackgroundMode: {
  title: 'Dozlo Audio',
  text: 'Playing audio in background',
  icon: 'ic_launcher',
  color: '#120f29',
  hidden: false,
  silent: false
}
```

## Testing

### Background Playback Test
1. Start playing audio
2. Press home button or lock screen
3. Wait for 10+ minutes
4. Verify audio continues without crashes
5. Check that URL refresh happens seamlessly

### Network Disconnection Test
1. Start playing audio
2. Turn off mobile data/WiFi
3. Verify audio pauses gracefully
4. Turn network back on
5. Verify audio resumes automatically

### Error Recovery Test
1. Simulate network errors
2. Verify error tracking works
3. Check that audio pauses after 5 consecutive errors
4. Verify recovery after network restoration

## Monitoring

The system provides comprehensive logging for debugging:

- `🎵` Audio playback events
- `🔄` URL refresh operations
- `📱` App state changes
- `🌐` Network status changes
- `❌` Error events
- `✅` Successful operations
- `⚠️` Warning messages

## Future Improvements

1. **Offline Support**: Cache audio files for offline playback
2. **Adaptive Quality**: Adjust audio quality based on network conditions
3. **Playlist Management**: Better handling of multiple audio tracks
4. **Analytics**: Track playback statistics and error rates
5. **User Preferences**: Allow users to configure stability settings

## Troubleshooting

### Common Issues

1. **Audio stops after 10 minutes**
   - Check URL refresh logs
   - Verify network connectivity
   - Check R2 service configuration

2. **App crashes during background playback**
   - Check error logs for specific error types
   - Verify Android permissions
   - Check background mode configuration

3. **Network-related issues**
   - Check network monitoring logs
   - Verify network permissions
   - Check stability service status

### Debug Commands

```typescript
// Check stability status
console.log(this.backgroundStabilityService.getStabilityStatus());

// Check if background playback is stable
console.log(this.backgroundStabilityService.isBackgroundPlaybackStable());

// Check URL expiry time
console.log(this.r2AudioService.getTimeUntilExpiry(audioUrl));
```

## Conclusion

These fixes provide a robust, stable background audio experience that prevents app crashes and ensures continuous playback even during network issues or URL expiration. The system is designed to be proactive rather than reactive, preventing problems before they occur.


