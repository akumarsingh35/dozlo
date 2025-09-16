import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, CollectionReference } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface AudioStory {
  id?: string;
  title: string;
  subtitle?: string;
  duration?: string;
  imageUrl?: string;
  audioUrl: string;
  // Add other properties as needed
}

export interface Section {
  category: string;
  title: string;
  stories: AudioStory[];
}

@Injectable({ providedIn: 'root' })
export class AudioService {
  firestore = inject(Firestore);

  getAllAudioStories(): Observable<AudioStory[]> {
    try {
      const audioRef = collection(this.firestore, 'audios') as CollectionReference<AudioStory>;
      return collectionData(audioRef, { idField: 'id' }).pipe(
        catchError(error => {
          console.error('Error in getAllAudioStories:', error);
          // Optionally rethrow or return a default value
          return of([]);
        })
      );
    } catch (error) {
      console.error('Unexpected error in getAllAudioStories:', error);
      return of([]);
    }
  }
}
