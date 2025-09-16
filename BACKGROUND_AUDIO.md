# Background Audio Implementation

This document explains how the background audio functionality is implemented in the Dozlo app.

## Overview

The app uses a combination of Capacitor plugins and native Android services to provide reliable background audio playback. The implementation includes:

1. **NativeAudioService**: Handles audio playback using platform-specific APIs
2. **PlaybackService**: Android service for background playback
3. **MediaBrowserService**: For Android Auto and media browser integration
4. **MediaSession**: For media controls and metadata display

## Key Components

### 1. NativeAudioService (`native-audio.service.ts`)
- Manages audio playback using Capacitor's NativeAudio plugin
- Handles platform-specific audio behavior
- Provides a consistent interface for the rest of the app

### 2. AudioService (`audio.service.ts`)
- Main service for audio playback
- Falls back to web audio when native features aren't available
- Manages audio state and events

### 3. PlayerComponent (`player.component.ts`)
- UI component for audio controls
- Integrates with both web and native audio services
- Handles user interactions

### 4. Android Services
- **PlaybackService**: Foreground service for background playback
- **MediaBrowserService**: For Android Auto support
- **MediaSession**: For media controls and metadata

## Setup Instructions

### Prerequisites

1. Install the required Capacitor plugins:
   ```bash
   npm install @capacitor-community/native-audio @capacitor-community/media @capacitor/notifications
   ```

2. Sync the Android project:
   ```bash
   npx cap sync android
   ```

### Android Configuration

1. **Permissions**: The following permissions are required in `AndroidManifest.xml`:
   ```xml
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
   <uses-permission android:name="android.permission.WAKE_LOCK" />
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
   ```

2. **Services**: The following services are declared in `AndroidManifest.xml`:
   ```xml
   <service
       android:name=".PlaybackService"
       android:enabled="true"
       android:exported="false"
       android:foregroundServiceType="mediaPlayback"
       android:stopWithTask="false" />

   <service
       android:name=".MediaBrowserService"
       android:enabled="true"
       android:exported="true">
       <intent-filter>
           <action android:name="android.media.browse.MediaBrowserService" />
       </intent-filter>
   </service>
   ```

## Usage

### Playing Audio

```typescript
// In your component
constructor(
  private audioService: AudioService,
  private nativeAudioService: NativeAudioService
) {}

playTrack(track: AudioTrack) {
  if (Capacitor.isNativePlatform()) {
    this.nativeAudioService.playTrack(track);
  } else {
    this.audioService.playTrack(track);
  }
}
```

### Handling Background Playback

The app automatically handles background playback on Android. The `PlaybackService` ensures that audio continues playing when the app is in the background.

### Media Controls

Media controls (play/pause/seek) are automatically integrated with the device's media controls and lock screen.

## Testing

1. **Background Playback**:
   - Start playing audio
   - Press home or lock the device
   - Verify audio continues playing
   - Check notification controls

2. **Media Controls**:
   - Use the device's media controls
   - Test play/pause/seek functionality
   - Check lock screen controls

3. **App Switcher**:
   - Swipe the app away
   - Verify audio stops

## Troubleshooting

### Audio Stops in Background
- Ensure the app has the necessary permissions
- Check that the foreground service is running
- Verify the device's battery optimization settings

### No Sound
- Check device volume
- Verify audio file URLs are accessible
- Check for errors in the console

### Media Controls Not Updating
- Verify MediaSession is properly configured
- Check that playback state is being updated correctly

## Future Improvements

1. Implement proper audio focus handling
2. Add support for playlists and queue management
3. Improve error handling and recovery
4. Add support for audio effects and equalizer
5. Implement offline playback support
