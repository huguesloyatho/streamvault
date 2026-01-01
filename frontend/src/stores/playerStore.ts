import { create } from 'zustand';
import type { Channel, PlayerState } from '@/types';

interface PlayerStore extends PlayerState {
  currentChannel: Channel | null;
  isMinimized: boolean;
  showControls: boolean;

  // PiP state
  isPipActive: boolean;
  isPipVisible: boolean;
  pipChannel: Channel | null;
  isOnWatchPage: boolean;
  shouldAutoPlayPip: boolean; // Whether PiP should auto-play when shown

  // Actions
  setChannel: (channel: Channel | null) => void;
  setPlaying: (isPlaying: boolean) => void;
  setPaused: (isPaused: boolean) => void;
  setBuffering: (isBuffering: boolean) => void;
  setMuted: (isMuted: boolean) => void;
  setFullscreen: (isFullscreen: boolean) => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setQuality: (quality: string) => void;
  setAvailableQualities: (qualities: string[]) => void;
  setError: (error: string | null) => void;
  setMinimized: (isMinimized: boolean) => void;
  setShowControls: (show: boolean) => void;

  // PiP actions
  enablePip: () => void;
  disablePip: () => void;
  showPip: () => void;
  hidePip: () => void;
  setOnWatchPage: (isOnPage: boolean) => void;
  closePip: () => void;

  reset: () => void;
}

const initialState: PlayerState = {
  isPlaying: false,
  isPaused: false,
  isBuffering: false,
  isMuted: false,
  isFullscreen: false,
  volume: 1,
  currentTime: 0,
  duration: 0,
  quality: 'auto',
  availableQualities: [],
  error: null,
};

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  ...initialState,
  currentChannel: null,
  isMinimized: false,
  showControls: true,

  // PiP initial state
  isPipActive: false,
  isPipVisible: false,
  pipChannel: null,
  isOnWatchPage: false,
  shouldAutoPlayPip: true,

  setChannel: (channel) =>
    set({
      currentChannel: channel,
      pipChannel: channel,
      isPlaying: false,
      isPaused: false,
      isBuffering: false,
      error: null,
      currentTime: 0,
      duration: 0,
      isMinimized: false,
      isPipActive: !!channel,
    }),

  setPlaying: (isPlaying) => set({ isPlaying, isPaused: !isPlaying }),
  setPaused: (isPaused) => set({ isPaused, isPlaying: !isPaused }),
  setBuffering: (isBuffering) => set({ isBuffering }),
  setMuted: (isMuted) => set({ isMuted }),
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
  setVolume: (volume) => set({ volume, isMuted: volume === 0 }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setQuality: (quality) => set({ quality }),
  setAvailableQualities: (availableQualities) => set({ availableQualities }),
  setError: (error) => set({ error }),
  setMinimized: (isMinimized) => set({ isMinimized }),
  setShowControls: (showControls) => set({ showControls }),

  // PiP actions
  enablePip: () => {
    const { currentChannel } = get();
    set({
      isPipActive: true,
      pipChannel: currentChannel,
    });
  },

  disablePip: () =>
    set({
      isPipActive: false,
      isPipVisible: false,
    }),

  showPip: () => {
    const { isPipActive, isOnWatchPage, isPlaying } = get();
    // Only show PiP when navigating away from watch page and there's an active channel
    if (isPipActive && !isOnWatchPage) {
      // Remember if video was playing when transitioning to PiP
      set({ isPipVisible: true, shouldAutoPlayPip: isPlaying });
    }
  },

  hidePip: () =>
    set({
      isPipVisible: false,
    }),

  setOnWatchPage: (isOnPage) => {
    set({ isOnWatchPage: isOnPage });
    // Hide PiP when entering watch page
    if (isOnPage) {
      set({ isPipVisible: false });
    }
  },

  closePip: () =>
    set({
      isPipActive: false,
      isPipVisible: false,
      pipChannel: null,
      isPlaying: false,
      isPaused: true,
    }),

  reset: () =>
    set({
      ...initialState,
      currentChannel: null,
      isMinimized: false,
      showControls: true,
      isPipActive: false,
      isPipVisible: false,
      pipChannel: null,
      isOnWatchPage: false,
      shouldAutoPlayPip: true,
    }),
}));
