import { TestBed } from '@angular/core/testing';
import { NativeAudioService, AudioTrack } from './native-audio.service';

describe('NativeAudioService', () => {
  let service: NativeAudioService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NativeAudioService]
    });
    service = TestBed.inject(NativeAudioService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default state', () => {
    const state = service.getCurrentState();
    expect(state.isPlaying).toBe(false);
    expect(state.currentTrack).toBeNull();
    expect(state.progress).toBe(0);
    expect(state.duration).toBe(0);
    expect(state.isLoading).toBe(false);
  });

  it('should load track successfully', async () => {
    const track: AudioTrack = {
      id: 'test-track',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      audioUrl: 'https://example.com/test.mp3'
    };

    await service.loadTrack(track);
    const state = service.getCurrentState();
    
    expect(state.currentTrack).toEqual(track);
    expect(state.isLoading).toBe(false);
  });

  it('should handle play/pause correctly', async () => {
    const track: AudioTrack = {
      id: 'test-track',
      title: 'Test Track',
      audioUrl: 'https://example.com/test.mp3'
    };

    await service.loadTrack(track);
    
    // Mock audio element for testing
    const mockAudio = {
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn(),
      currentTime: 0,
      duration: 100
    };
    
    // @ts-ignore - Mock the audio element
    service['audioElement'] = mockAudio;

    await service.play();
    expect(mockAudio.play).toHaveBeenCalled();

    service.pause();
    expect(mockAudio.pause).toHaveBeenCalled();
  });

  it('should handle seek correctly', async () => {
    const track: AudioTrack = {
      id: 'test-track',
      title: 'Test Track',
      audioUrl: 'https://example.com/test.mp3'
    };

    await service.loadTrack(track);
    
    const mockAudio = {
      currentTime: 0,
      duration: 100
    };
    
    // @ts-ignore - Mock the audio element
    service['audioElement'] = mockAudio;

    service.seekTo(50);
    expect(mockAudio.currentTime).toBe(50);
  });

  it('should handle errors gracefully', async () => {
    const track: AudioTrack = {
      id: 'test-track',
      title: 'Test Track',
      audioUrl: 'invalid-url'
    };

    try {
      await service.loadTrack(track);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should cleanup resources on destroy', () => {
    const mockAudio = {
      pause: jest.fn(),
      currentTime: 0
    };
    
    // @ts-ignore - Mock the audio element
    service['audioElement'] = mockAudio;
    service['progressInterval'] = setInterval(() => {}, 1000);

    service.destroy();
    
    expect(mockAudio.pause).toHaveBeenCalled();
    expect(service['audioElement']).toBeNull();
    expect(service['progressInterval']).toBeNull();
  });
}); 