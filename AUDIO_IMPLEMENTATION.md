# Audio Implementation for Seamless Background Playback

## Overview

This implementation provides seamless audio playback in Android that works like native music apps (Spotify, Apple Music, etc.) with proper background playback, notification controls, and media session integration.

## Key Features

### ✅ Background Audio Playback
- Audio continues playing when app is in background
- Proper Android foreground service integration
- Wake lock management to prevent audio interruption

### ✅ Media Session Controls
- Lock screen media controls (play/pause/seek)
- Notification media controls
- Bluetooth device controls support
- Android Auto compatibility

### ✅ Audio Focus Management
- Proper handling when other apps play audio
- Automatic pause/resume based on audio focus
- Respects system audio policies

### ✅ Notification Controls
- Persistent notification during playback
- Media control buttons in notification
- Album artwork display in notification

### ✅ Seamless User Experience
- Instant audio loading and playback
- Smooth progress tracking
- Error handling and recovery
- Cross-platform compatibility

## Architecture

### Services

#### 1. NativeAudioService (`src/app/services/native-audio.service.ts`)
**Main audio service that handles all audio operations**

```typescript
// Key methods:
- loadTrack(track: AudioTrack): Promise<void>
- play(): Promise<void>
- pause(): void
- stop(): void
- seekTo(time: number): void
```

**Features:**
- HTML5 Audio API with native optimizations
- Background mode integration
- Media session management
- Progress tracking
- Error handling

#### 2. GlobalAudioPlayerService (`src/app/services/global-audio-player.service.ts`)
**State management service that coordinates audio state across the app**

```typescript
// Key methods:
- play(track: AudioTrack): Promise<void>
- pause(): void
- stop(): void
- updateAudioState(state: Partial<AudioState>): void
```

**Features:**
- Centralized audio state management
- Integration with native audio service
- State synchronization across components

#### 3. R2AudioService (`src/app/services/r2-audio.service.ts`)
**Handles signed URL generation for cloud storage**

```typescript
// Key methods:
- getSignedUrl(r2Path: string): Observable<SignedUrlResponse>
- prepareAudioTrack(track: AudioTrack): Observable<AudioTrack>
```

**Features:**
- Secure URL generation for cloud audio files
- URL caching and expiration handling
- Error handling for network issues

### Components

#### GlobalAudioPlayerComponent (`src/app/global-audio-player/global-audio-player.component.ts`)
**Main audio player UI component**

**Features:**
- Play/pause controls
- Progress bar with seeking
- Time display
- Ambient audio integration
- Media session integration

## Android Configuration

### Permissions (AndroidManifest.xml)
```xml
<!-- Background audio permissions -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

### Capacitor Configuration (capacitor.config.ts)
```typescript
plugins: {
  BackgroundMode: {
    title: 'Dozlo Audio',
    text: 'Playing audio in background',
    icon: 'ic_launcher',
    color: '#120f29',
    hidden: false,
    silent: false
  },
  LocalNotifications: {
    smallIcon: 'ic_launcher',
    iconColor: '#120f29'
  }
}
```

## Usage

### Playing Audio from Home Page

```typescript
async onPlay(story: ProcessedStory) {
  // Set loading state
  story.isLoading = true;
  
  // Get signed URL if needed
  let audioUrl = story.audioUrl || '';
  if (story.r2Path) {
    const response = await this.r2AudioService.getSignedUrl(story.r2Path).toPromise();
    audioUrl = response.signedUrl;
  }
  
  // Play using global audio service
  await this.globalAudioPlayer.play({
    audioUrl: audioUrl,
    title: story.title,
    photoUrl: story.imageUrl,
    description: story.subTitle,
    r2Path: story.r2Path
  });
  
  story.isLoading = false;
}
```

### Audio State Management

```typescript
// Subscribe to audio state changes
this.globalAudioPlayer.audioState$.subscribe(state => {
  console.log('Audio state:', state);
  // Update UI based on state
});
```

## Background Playback Features

### 1. Foreground Service
- App continues playing audio when minimized
- Notification shows current track info
- Media controls in notification

### 2. Media Session Integration
- Lock screen controls work
- Bluetooth device controls
- Android Auto compatibility
- System media controls integration

### 3. Audio Focus Management
- Automatically pauses when other apps play audio
- Resumes when audio focus is regained
- Respects system audio policies

### 4. Wake Lock Management
- Prevents device sleep during playback
- Optimized battery usage
- Proper cleanup when playback stops

## Error Handling

### Network Issues
- Automatic retry for failed audio loads
- Fallback to cached URLs
- User-friendly error messages

### Audio Focus Loss
- Automatic pause when other apps play audio
- Graceful handling of audio interruptions
- Proper state restoration

### Background Mode Issues
- Fallback to standard audio playback
- Proper cleanup on app termination
- State persistence across app restarts

## Performance Optimizations

### 1. Audio Preloading
```typescript
// Preload popular tracks for instant playback
this.optimizedAudioService.preloadAudio(trackIds, audioTracks);
```

### 2. URL Caching
```typescript
// Cache signed URLs to reduce API calls
this.r2AudioService.urlCache.set(r2Path, {
  url: signedUrl,
  expiresAt: expiryDate
});
```

### 3. Memory Management
```typescript
// Clear audio cache when needed
this.optimizedAudioService.clearCache();
```

## Testing

### Android Testing Checklist

1. **Background Playback**
   - [ ] Audio continues when app is minimized
   - [ ] Notification shows correct track info
   - [ ] Media controls work from notification

2. **Lock Screen Controls**
   - [ ] Play/pause works from lock screen
   - [ ] Seek controls work
   - [ ] Track info displays correctly

3. **Audio Focus**
   - [ ] Audio pauses when other apps play
   - [ ] Audio resumes when focus is regained
   - [ ] No conflicts with system audio

4. **Bluetooth Devices**
   - [ ] Controls work with Bluetooth headphones
   - [ ] Track info displays on Bluetooth devices
   - [ ] Playback continues when device connects/disconnects

5. **Battery Optimization**
   - [ ] Audio doesn't stop due to battery optimization
   - [ ] Proper wake lock management
   - [ ] Efficient battery usage

## Troubleshooting

### Common Issues

1. **Audio stops in background**
   - Check Android permissions
   - Verify background mode is enabled
   - Ensure wake lock is properly managed

2. **Media controls not working**
   - Verify media session is properly configured
   - Check notification permissions
   - Ensure audio focus is properly managed

3. **Audio focus conflicts**
   - Check audio focus request implementation
   - Verify pause/resume logic
   - Test with other audio apps

4. **Performance issues**
   - Clear audio cache if needed
   - Check memory usage
   - Optimize audio preloading

## Future Enhancements

### Planned Features
- [ ] Playlist support
- [ ] Crossfade between tracks
- [ ] Audio equalizer
- [ ] Sleep timer
- [ ] Audio bookmarks
- [ ] Offline playback
- [ ] Audio quality selection

### Platform Extensions
- [ ] iOS background audio
- [ ] Web audio optimization
- [ ] Desktop audio support

## Dependencies

### Required Packages
```json
{
  "@anuradev/capacitor-background-mode": "^7.2.1",
  "@jofr/capacitor-media-session": "^4.0.0",
  "@capacitor/local-notifications": "^7.0.1"
}
```

### Optional Packages
```json
{
  "howler": "^2.2.4",
  "@types/howler": "^2.2.12"
}
```

## Conclusion

This implementation provides a robust, native-like audio experience that works seamlessly in the background, respects system audio policies, and provides users with familiar media controls. The architecture is modular, maintainable, and ready for future enhancements. 