import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  async logAudioPlay(audioId: string, title: string, duration: number) {
    if (Capacitor.isNativePlatform()) {
      await FirebaseAnalytics.logEvent({
        name: 'audio_play',
        params: { audio_id: audioId, title, duration }
      });
    }
  }

  async logAudioStop(audioId: string, title: string, playedFor: number) {
    if (Capacitor.isNativePlatform()) {
      await FirebaseAnalytics.logEvent({
        name: 'audio_stop',
        params: { audio_id: audioId, title, played_for: playedFor }
      });
    }
  }

  async logAudioPause(audioId: string, position: number) {
    if (Capacitor.isNativePlatform()) {
      await FirebaseAnalytics.logEvent({
        name: 'audio_pause',
        params: { audio_id: audioId, position }
      });
    }
  }

  async logAudioResume(audioId: string, position: number) {
    if (Capacitor.isNativePlatform()) {
      await FirebaseAnalytics.logEvent({
        name: 'audio_resume',
        params: { audio_id: audioId, position }
      });
    }
  }
}
