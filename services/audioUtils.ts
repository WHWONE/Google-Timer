import { AlarmType } from '../types';

let audioContext: AudioContext | null = null;

export const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000, // Gemini TTS often uses 24k
    });
  }
  return audioContext;
};

/**
 * Decodes a base64 string containing raw PCM 16-bit integers into an AudioBuffer.
 */
export const decodeGeminiAudio = async (base64String: string): Promise<AudioBuffer> => {
  const ctx = getAudioContext();
  
  // 1. Decode base64 to binary string
  const binaryString = atob(base64String);
  const len = binaryString.length;
  
  // Safety: Ensure valid length for Int16 (must be multiple of 2)
  const safeLen = len % 2 === 0 ? len : len - 1;
  
  const bytes = new Uint8Array(safeLen);
  for (let i = 0; i < safeLen; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const dataInt16 = new Int16Array(bytes.buffer);
  const sampleRate = 24000;
  const numChannels = 1;
  const frameCount = dataInt16.length;
  
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }

  return buffer;
};

/**
 * Plays an AudioBuffer.
 */
export const playAudioBuffer = (buffer: AudioBuffer, volume: number = 1.0): { done: Promise<void>, stop: () => void } => {
  const ctx = getAudioContext();
  
  if (ctx.state === 'suspended') {
    // Attempt to resume, but don't block
    ctx.resume().catch(e => console.error("Failed to resume audio context", e));
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  
  const gainNode = ctx.createGain();
  gainNode.gain.value = volume;

  source.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  let resolvePromise: () => void;
  const donePromise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  source.onended = () => {
    resolvePromise();
  };

  source.start();

  const stop = () => {
    try {
      source.stop();
      source.disconnect();
      gainNode.disconnect();
    } catch (e) {
      // Ignore errors if already stopped
    }
    resolvePromise(); 
  };

  return { done: donePromise, stop };
};

/**
 * Helper to play a single tone
 */
const playTone = (ctx: AudioContext, dest: AudioNode, freq: number, type: OscillatorType, startTime: number, duration: number, volume: number) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = type;
  osc.frequency.value = freq;
  
  osc.connect(gain);
  gain.connect(dest);
  
  // Envelope
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01); // Fast attack
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Decay
  
  osc.start(startTime);
  osc.stop(startTime + duration);
};

/**
 * Plays a synthetic alarm sound based on the selected type.
 * Uses additive synthesis for crisper, louder sounds.
 */
export const playAlarm = async (type: AlarmType = 'bell', volume: number = 0.8): Promise<void> => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const t = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  masterGain.gain.value = volume; // Master volume control

  let duration = 1.5;

  switch (type) {
    case 'digital':
      // Crisp double beep (Square wave cuts through mix)
      playTone(ctx, masterGain, 880, 'square', t, 0.15, 0.5);
      playTone(ctx, masterGain, 1760, 'square', t, 0.15, 0.1); // Upper harmonic
      
      playTone(ctx, masterGain, 880, 'square', t + 0.25, 0.3, 0.5);
      playTone(ctx, masterGain, 1760, 'square', t + 0.25, 0.3, 0.1);
      duration = 0.6;
      break;

    case 'chime':
      // Bright, glassy chime (Sine + Triangle with high partials)
      playTone(ctx, masterGain, 1500, 'sine', t, 1.5, 0.6);
      playTone(ctx, masterGain, 3000, 'triangle', t, 1.2, 0.3); // Octave up
      playTone(ctx, masterGain, 4500, 'sine', t, 1.0, 0.1); // 5th
      duration = 1.5;
      break;

    case 'gong':
      // Complex cluster for "crash" sound
      // Fundamental
      playTone(ctx, masterGain, 150, 'sawtooth', t, 2.5, 0.5);
      // Dissonant partials
      playTone(ctx, masterGain, 150 * 1.5, 'sine', t, 2.0, 0.3);
      playTone(ctx, masterGain, 150 * 2.2, 'square', t, 1.5, 0.2);
      // Pitch bend on fundamental for "bowing" effect
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.linearRampToValueAtTime(120, t + 2.5);
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(t);
      osc.stop(t + 2.5);
      duration = 2.5;
      break;

    case 'bell':
    default:
      // Metallic Bell (Additive: Fundamental + Overtones)
      const baseFreq = 523.25; // C5
      // Fundamental
      playTone(ctx, masterGain, baseFreq, 'sine', t, 2.0, 0.6);
      // 2nd harmonic (octave)
      playTone(ctx, masterGain, baseFreq * 2, 'triangle', t, 1.5, 0.3);
      // 3rd harmonic (fifth)
      playTone(ctx, masterGain, baseFreq * 3, 'sine', t, 1.2, 0.2);
      // Inharmonic metallic ping
      playTone(ctx, masterGain, baseFreq * 4.2, 'sine', t, 0.5, 0.1);
      duration = 2.0;
      break;
  }

  return new Promise(resolve => setTimeout(resolve, duration * 1000));
};