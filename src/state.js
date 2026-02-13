// src/state.js
// Shared app state (composition + playback only). Audio internals stay in audio.js later.
export const state = {
  composition: {
    melody: [],
    currentChords: [],
  },
  playback: {
    isPlaying: false,
  },
};
