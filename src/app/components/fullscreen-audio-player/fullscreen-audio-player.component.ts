import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { Howl } from 'howler';
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
  private pendingSeekTime: number | null = null;
  private pendingSeekTimer: any = null;

  constructor(
    private modalController: ModalController,
    private ambientAudioService: AmbientAudioService,
    public globalAudioPlayerService: GlobalAudioPlayerService // Public for template access
  ) {}

  ngOnInit() {
    this.subscriptions.add(
      this.globalAudioPlayerService.audioState$.subscribe(state => {
        this.isPlaying = state.isPlaying;
        this.isLoading = state.isLoading;
        this.duration = state.duration;
        if (this.pendingSeekTime !== null) {
          const cur = state.currentTime || 0;
          const ok = Math.abs(cur - this.pendingSeekTime) <= 1;
          if (ok) {
            this.progress = state.progress;
            this.currentTime = cur;
            this.pendingSeekTime = null;
            if (this.pendingSeekTimer) { clearTimeout(this.pendingSeekTimer); this.pendingSeekTimer = null; }
            this.isDragging = false;
          } else {
            // ignore progress update until seek lands near target
          }
        } else if (!this.isDragging) {
          this.progress = state.progress;
          this.currentTime = state.currentTime || 0;
        }
      })
    );

    this.subscriptions.add(
      this.ambientAudioService.tracks$.subscribe(tracks => {
        this.ambientTracks = tracks.map(track => ({ ...track, volume: Number(track.volume) || 0 }));
      })
    );
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
    this.globalAudioPlayerService.seekTo(newTime);
  }

  seekForward() {
    this.globalAudioPlayerService.cancelActiveSeek();
    const newTime = Math.min(this.duration, this.currentTime + 15);
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
      this.globalAudioPlayerService.seekTo(seekTime);
      if (this.pendingSeekTimer) { clearTimeout(this.pendingSeekTimer); }
      this.pendingSeekTimer = setTimeout(() => {
        this.pendingSeekTime = null;
        this.isDragging = false;
        this.pendingSeekTimer = null;
      }, 2500);
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
    if (id.toLowerCase().includes('rain')) return 'water-outline';
    if (id.toLowerCase().includes('cricket')) return 'bug-outline';
    if (id.toLowerCase().includes('ocean')) return 'pulse-outline';
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