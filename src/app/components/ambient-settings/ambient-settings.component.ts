import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { AmbientAudioService } from '../../services/ambient-audio.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-ambient-settings',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <div class="ambient-modal">
      <div class="header">
        <span class="title">Ambient Sounds</span>
        <button class="close-btn" (click)="dismiss()">
          <ion-icon name="chevron-down-outline"></ion-icon>
        </button>
      </div>
      <div class="track-list">
        <div class="track-row" *ngFor="let track of tracks">
          <div class="track-icon" [ngClass]="track.id">
            <ion-icon [name]="getIcon(track.id)"></ion-icon>
          </div>
          <div class="track-main">
            <div class="track-name">{{ track.name }}</div>
            <ion-range
              class="custom-range"
              [value]="track.volume"
              (ionChange)="onVolumeChange(track, $event.detail.value)"
              [min]="0"
              [max]="1"
              [step]="0.01"
              [snaps]="false"
              [pin]="false"
              [ticks]="false"
            ></ion-range>
          </div>
          <button class="mute-btn" (click)="toggleMute(track)">
            <ion-icon [name]="track.volume > 0 ? 'volume-high-outline' : 'volume-mute-outline'"></ion-icon>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
    .ambient-modal {
      background: #181529;
      border-radius: 18px 18px 0 0;
      padding: 24px 10px calc(18px + env(safe-area-inset-bottom, 20px)) 10px;
      width: 95vw;
      max-width: 420px;
      min-width: 260px;
      margin: 0 auto;
      color: #fff;
      font-family: var(--ion-font-family);
      display: flex;
      flex-direction: column;
      align-items: center;
      max-height: 90vh;
      min-height: 200px;
      overflow-y: auto;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      position: relative;
      margin-bottom: 28px;
    }
    .title {
      font-size: 1.45rem;
      font-weight: 800;
      color: #fff;
      flex: 1;
      text-align: center;
    }
    .close-btn {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #b3a9c9;
      font-size: 1.4rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      border-radius: 50%;
      transition: all 0.2s ease;
      width: 36px;
      height: 36px;
    }
    .close-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
    }
    .close-btn:active {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-50%) scale(0.95);
    }
    .track-list {
      display: flex;
      flex-direction: column;
      gap: 22px;
      width: 100%;
      align-items: center;
    }
    .track-row {
      display: flex;
      align-items: center;
      gap: 16px;
      background: none;
      padding: 0 0 0 0;
      width: 95%;
      margin: 0 auto;
    }
    .track-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: #221c3a;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      color: #a299f9;
      flex-shrink: 0;
    }
    .track-icon.rain {
      background: #2d234a;
      color: #a299f9;
    }
    .track-icon.cricket {
      background: #2d234a;
      color: #a299f9;
    }
    .track-icon.ocean {
      background: #2d234a;
      color: #a299f9;
    }
    .track-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
      align-items: flex-start;
    }
    .track-name {
      font-size: 1.13rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    ion-range.custom-range {
      --bar-background: #28223b;
      --bar-background-active: #a299f9;
      --bar-height: 6px;
      --bar-border-radius: 3px;
      --knob-size: 22px;
      --knob-background: #fff;
      --knob-border-radius: 50%;
      --knob-box-shadow: 0 2px 8px rgba(127, 88, 255, 0.15);
      --knob-color: #a299f9;
      --pin-background: transparent;
      --pin-color: transparent;
      --ticks-background: transparent;
      --ticks-background-active: transparent;
      margin: 0;
      width: 100%;
      min-width: 120px;
      max-width: 100%;
      height: 32px;
      padding: 0;
    }
    .mute-btn {
      background: none;
      border: none;
      color: #b3a9c9;
      font-size: 1.5rem;
      margin-left: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      padding: 6px;
      transition: background 0.2s;
    }
    .mute-btn:active {
      background: #23203a;
    }
    `
  ]
})
export class AmbientSettingsComponent implements OnInit, OnDestroy {
  tracks: { id: string; name: string; volume: number }[] = [];
  private subscriptions: Subscription[] = [];

  constructor(
    private modalCtrl: ModalController,
    private ambientAudio: AmbientAudioService
  ) {
    // Initial state will be set by reactive subscription in ngOnInit
  }

  ngOnInit(): void {
    // Subscribe to reactive state updates
    this.subscriptions.push(
      this.ambientAudio.tracks$.subscribe(tracks => {
        this.tracks = tracks.map(track => ({
          id: track.id,
          name: track.name,
          volume: Number(track.volume) || 0
        }));
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // NEW: Sync component state with service state
  syncWithService() {
    const serviceTracks = this.ambientAudio.getTracks();
    this.tracks = this.tracks.map(track => {
      const serviceTrack = serviceTracks.find(st => st.id === track.id);
      return {
        ...track,
        volume: serviceTrack ? Number(serviceTrack.volume) || 0 : 0
      };
    });
  }

  // NEW: Handle track reset when switching songs
  handleSongSwitch() {
    this.resetAllTracks();
  }

  getIcon(id: string): string {
    // Map track id to icon name
    if (id.toLowerCase().includes('rain')) return 'water-outline';
    if (id.toLowerCase().includes('cricket')) return 'bug-outline';
    if (id.toLowerCase().includes('ocean')) return 'pulse-outline'; // Changed to pulse-outline for ocean waves
    // Add more mappings as needed
    return 'musical-notes-outline';
  }

  onVolumeChange(track: any, value: any) {
    // If value is an object (dual knob), use value.lower; otherwise, use value directly
    const volume = typeof value === 'number' ? value : value?.lower ?? 0;
    this.ambientAudio.setVolume(track.id, volume);
    track.volume = volume;
  }

  toggleMute(track: any) {
    const newVolume = track.volume > 0 ? 0 : 1;
    this.ambientAudio.setVolume(track.id, newVolume);
    track.volume = newVolume;
  }

  // NEW: Reset all ambient tracks to default state
  resetAllTracks() {
    this.tracks.forEach(track => {
      track.volume = 0;
      this.ambientAudio.setVolume(track.id, 0);
    });
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  // Debug method to get current state
  getDebugState() {
    return this.ambientAudio.getDebugState();
  }

  // Test method to manually restart all tracks
  testRestartTracks() {
    console.log('🧪 Testing restart all tracks');
    this.ambientAudio.restartAllTracks();
  }

  // Test method to log current state
  logCurrentState() {
    const state = this.getDebugState();
    console.log('🧪 Current ambient audio state:', state);
  }
}
