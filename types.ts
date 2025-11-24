export interface TimerStep {
  id: string;
  name: string;
  durationSeconds: number;
}

export type AlarmType = 'bell' | 'digital' | 'chime' | 'gong';

export interface ChainSettings {
  alarmSound: AlarmType;
  alarmVolume: number; // 0.0 to 1.0
  bufferSeconds: number;
}

export enum AppStatus {
  SETUP = 'SETUP',
  RUNNING = 'RUNNING',
  FINISHED = 'FINISHED'
}

export enum TimerPhase {
  PREPARING_AUDIO = 'PREPARING_AUDIO', // Generating TTS
  ANNOUNCING = 'ANNOUNCING', // Playing TTS
  COUNTDOWN = 'COUNTDOWN', // Ticking down
  BUFFER = 'BUFFER', // Waiting between tasks
  COMPLETION_ANNOUNCEMENT = 'COMPLETION_ANNOUNCEMENT', // Final voice
  COMPLETED = 'COMPLETED' // Done
}