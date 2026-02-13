import { internalChromatic } from '../music/theory.js';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// SoundFont integration (Preserved)
let instrument = null;
let isLoading = false;
const soundFontUrl = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3.js";

export function getAudioCtx() {
  return audioCtx;
}

export async function loadPiano() {
  if (instrument || isLoading) return;
  isLoading = true;

  // Minimal-risk: keep #melody-display messaging here for now.
  const display = document.getElementById('melody-display');
  const originalText = display ? display.innerHTML : '';

  try {
    if (display) {
      display.innerHTML = "Loading realistic piano soundfont... (5–15 seconds depending on connection)";
    }

    instrument = await Soundfont.instrument(audioCtx, soundFontUrl, {
      release: 0.6,
      gain: 1.35
    });

    if (display) {
      display.innerHTML = originalText.includes("No composition")
        ? "Piano loaded ✓<br>No composition generated yet."
        : originalText + "<br><br><strong>Realistic piano sound loaded!</strong>";
    }
  } catch (err) {
    console.error("Soundfont loading failed:", err);
    if (display) {
      display.innerHTML = originalText + "<br><br><em>Could not load piano soundfont — using basic synth fallback.</em>";
    }
    instrument = null;
  } finally {
    isLoading = false;
  }
}

export function getFrequency(note, octave) {
  const lookupNote = note.replace('b', '#')
    .replace('Db', 'C#').replace('Eb', 'D#').replace('Gb', 'F#')
    .replace('Ab', 'G#').replace('Bb', 'A#');

  const noteIndex = internalChromatic.indexOf(lookupNote);
  if (noteIndex === -1) return 440;

  const semitonesFromA4 = (octave - 4) * 12 + (noteIndex - 9);
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

export function playNote(freqOrFreqArray, velocity = 80, durationSec = 0.5) {
  const now = audioCtx.currentTime;
  const velGain = velocity / 127;

  // Support both single frequency and array of frequencies (chords)
  const frequencies = Array.isArray(freqOrFreqArray) ? freqOrFreqArray : [freqOrFreqArray];
  const numVoices = frequencies.length;

  // Prevent clipping: scale gain by sqrt(n) for polyphonic playback
  const polyGainScale = 1 / Math.sqrt(numVoices);

  if (instrument) {
    // Soundfont implementation: create multiple players
    frequencies.forEach(f => {
      const midiNote = Math.round(12 * Math.log2(f / 440) + 69);
      const player = instrument.play(midiNote, now, { gain: velGain * 1.4 * polyGainScale });
      player.stop(now + durationSec);
    });
  } else {
    // Fallback oscillator implementation: multiple oscillators through one envelope
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(velGain * polyGainScale, now + 0.006);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + durationSec + 0.15);
    masterGain.connect(audioCtx.destination);

    frequencies.forEach(f => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2800 + f * 1.2;

      osc.connect(filter).connect(masterGain);
      osc.start(now);
      osc.stop(now + durationSec + 0.2);
    });
  }
}
