import { Component, Input, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { GlobalAudioPlayerService } from '../../services/global-audio-player.service';
import { AmbientAudioService } from '../../services/ambient-audio.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-fullscreen-audio-player',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './fullscreen-audio-player.component.html',
  styleUrls: ['./fullscreen-audio-player.component.scss']
})
export class FullscreenAudioPlayerComponent implements OnInit, OnDestroy {
  @Input() title: string = '';
  @Input() description: string = '';
  @Input() photoUrl: string = '';
  @Input() audioUrl: string = '';
  @Input() r2Path: string = '';
  @Input() storyId: string = '';
  @Input() narrator: string = '';
  @Input() resumePosition: number = 0;

  // Audio state synced from service
  isPlaying = false;
  isLoading = false;
  currentTime = 0;
  duration = 0;
  progress = 0;

  // Ambient tracks state
  ambientTracks: { id: string; name: string; volume: number }[] = [];
  private subscriptions = new Subscription();

  // UI interaction state
  isDragging = false;
  isSeekPending = false;
  private pendingSeekTime: number | null = null;
  private pendingSeekTimer: any = null;

  constructor(
    private modalController: ModalController,
    private ambientAudioService: AmbientAudioService,
    public globalAudioPlayerService: GlobalAudioPlayerService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.subscriptions.add(
      this.globalAudioPlayerService.audioState$.subscribe(state => {
        this.ngZone.run(() => {
          this.isPlaying = state.isPlaying;
          this.isLoading = state.isLoading;
          this.duration = state.duration;
          if (this.duration <= 0 && state.currentTrack?.duration && state.currentTrack.duration > 0) {
            this.duration = state.currentTrack.duration;
          }
          if (this.pendingSeekTime !== null) {
            const cur = state.currentTime || 0;
            const ok = Math.abs(cur - this.pendingSeekTime) <= 2;
            if (ok) {
              this.progress = state.progress;
              this.currentTime = cur;
              this.pendingSeekTime = null;
              if (this.pendingSeekTimer) { clearTimeout(this.pendingSeekTimer); this.pendingSeekTimer = null; }
              this.isDragging = false;
              this.isSeekPending = false;
              console.warn(`🎯 [AUDIO_SYNC_UI] Seek landed currentTime=${cur} duration=${this.duration}`);
            }
          } else if (!this.isDragging) {
            this.progress = state.progress;
            this.currentTime = state.currentTime || 0;
          }
        });
      })
    );

    this.subscriptions.add(
      this.ambientAudioService.tracks$.subscribe(tracks => {
        this.ambientTracks = tracks.map(track => ({ ...track, volume: Number(track.volume) || 0 }));
      })
    );

    // Ensure timing is populated for long streams
    this.globalAudioPlayerService.refreshTiming();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  dismiss() {
    this.modalController.dismiss();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.globalAudioPlayerService.pause();
    } else {
      this.globalAudioPlayerService.play();
    }
  }

  seekBackward() {
    this.globalAudioPlayerService.cancelActiveSeek();
    const newTime = Math.max(0, this.currentTime - 15);
    this.isSeekPending = true;
    console.warn(`🎯 [AUDIO_SYNC_UI] Seek backward from=${this.currentTime} to=${newTime} duration=${this.duration}`);
    this.globalAudioPlayerService.seekTo(newTime);
  }

  seekForward() {
    this.globalAudioPlayerService.cancelActiveSeek();
    const newTime = this.duration > 0
      ? Math.min(this.duration, this.currentTime + 15)
      : this.currentTime + 15;
    this.isSeekPending = true;
    console.warn(`🎯 [AUDIO_SYNC_UI] Seek forward from=${this.currentTime} to=${newTime} duration=${this.duration}`);
    this.globalAudioPlayerService.seekTo(newTime);
  }

  onProgressBarDragStart() {
    this.isDragging = true;
    this.globalAudioPlayerService.cancelActiveSeek();
    if (this.pendingSeekTimer) { clearTimeout(this.pendingSeekTimer); this.pendingSeekTimer = null; }
    this.pendingSeekTime = null;
  }

  onProgressBarDragging(event: any) {
    if (this.isDragging) {
      const progress = event.detail.value / 100;
      this.progress = progress;
      this.currentTime = this.duration * progress;
    }
  }

  onProgressBarDragEnd(event: any) {
    if (this.isDragging) {
      const progress = event.detail.value / 100;
      const seekTime = this.duration * progress;
      this.pendingSeekTime = seekTime;
      this.progress = progress;
      this.currentTime = seekTime;
      this.isSeekPending = true;
      console.warn(`🎯 [AUDIO_SYNC_UI] Slider seek requested seekTime=${seekTime} duration=${this.duration} progress=${progress}`);
      this.globalAudioPlayerService.seekTo(seekTime);
      if (this.pendingSeekTimer) { clearTimeout(this.pendingSeekTimer); }
      this.pendingSeekTimer = setTimeout(() => {
        console.warn(`🎯 [AUDIO_SYNC_UI] Seek confirmation timeout pendingSeekTime=${this.pendingSeekTime} currentTime=${this.currentTime} duration=${this.duration}`);
        this.pendingSeekTime = null;
        this.isDragging = false;
        this.isSeekPending = false;
        this.pendingSeekTimer = null;
      }, 7000);
    }
  }

  formatTime(secs: number): string {
    const minutes = Math.floor(secs / 60) || 0;
    const seconds = Math.floor(secs % 60) || 0;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  // Public method for ion-range pin formatter
  public pinFormatter = (value: number): string => {
    return this.formatTime(this.duration * (value / 100));
  }

  getAmbientIcon(id: string): string {
    const icons: { [key: string]: string } = {
      'rain': 'rainy-outline',
      'waves': 'water-outline',
      'crickets': 'bug-outline',
      'cafe': 'cafe-outline',
      'fire': 'flame-outline',
      'wind': 'leaf-outline' 
    };
    const track = this.ambientTracks.find(t => t.id === id);
    if (track && track.volume > 0) {
      return icons[id] || 'volume-medium-outline';
    }
    return icons[id] ? icons[id].replace('-outline', '') + '-sharp' : 'volume-off-sharp';
  }

  onAmbientVolumeChange(track: any, event: any) {
    const volume = event.detail.value / 100;
    this.ambientAudioService.setVolume(track.id, volume);
  }

  getIcon(id: string): string {
    if (id.toLowerCase().includes('rain')) return 'rainy-outline';
    if (id.toLowerCase().includes('cricket')) return 'bug-outline';
    if (id.toLowerCase().includes('ocean')) return 'water-outline';
    return 'musical-notes-outline';
  }

  toggleMute(track: any) {
    const newVolume = track.volume > 0 ? 0 : 1;
    this.ambientAudioService.setVolume(track.id, newVolume);
    track.volume = newVolume;
  }

  toggleAmbientMute(track: any) {
    const currentVolume = this.ambientAudioService.getVolume(track.id);
    this.ambientAudioService.setVolume(track.id, currentVolume > 0 ? 0 : 0.5);
  }
}
