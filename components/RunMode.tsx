import React, { useEffect, useState, useRef } from 'react';
import { TimerStep, TimerPhase, ChainSettings } from '../types';
import { generateTimerAnnouncement, generateCompletionAnnouncement } from '../services/geminiService';
import { decodeGeminiAudio, playAudioBuffer, playAlarm, getAudioContext } from '../services/audioUtils';
import { Pause, Play, SkipForward, X, Loader2, Volume2, Coffee, CheckCircle2, AlertCircle } from 'lucide-react';

interface RunModeProps {
  timers: TimerStep[];
  settings: ChainSettings;
  onExit: () => void;
}

const RunMode: React.FC<RunModeProps> = ({ timers, settings, onExit }) => {
  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<TimerPhase>(TimerPhase.PREPARING_AUDIO);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // References for Lifecycle & Async Control
  const opIdRef = useRef(0);
  const audioStopRef = useRef<(() => void) | null>(null);
  const intervalRef = useRef<number | null>(null);
  
  // Cache to store pre-loaded audio buffers: Key = index, Value = AudioBuffer
  // Index 'timers.length' is reserved for the "All Done" completion audio.
  const audioCache = useRef<Map<number, AudioBuffer>>(new Map());

  const currentTimer = timers[currentIndex];
  const totalSteps = timers.length;

  // --- Helpers ---

  const stopEverything = () => {
    if (audioStopRef.current) {
      audioStopRef.current();
      audioStopRef.current = null;
    }
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const cleanup = () => {
    stopEverything();
    opIdRef.current++; // Invalidate any pending async ops
  };

  useEffect(() => {
    return cleanup;
  }, []);

  // Auto-dismiss error messages
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // --- Pre-loading Logic ---

  const preloadNextAudio = async (targetIndex: number) => {
    // Don't preload if already cached
    if (audioCache.current.has(targetIndex)) return;

    try {
      let base64: string;
      // If target is beyond the list, it's the completion audio
      if (targetIndex === timers.length) {
        base64 = await generateCompletionAnnouncement();
      } else if (targetIndex < timers.length) {
        const step = timers[targetIndex];
        base64 = await generateTimerAnnouncement(step.name, step.durationSeconds);
      } else {
        return;
      }

      const buffer = await decodeGeminiAudio(base64);
      audioCache.current.set(targetIndex, buffer);
      // console.log(`Preloaded audio for index ${targetIndex}`);
    } catch (e) {
      // Silent fail on preload - we'll retry comfortably when the step actually starts
      console.warn(`Background preload failed for index ${targetIndex}`, e);
    }
  };

  // --- Core Logic ---

  const runSequence = async (index: number) => {
    const myOpId = ++opIdRef.current;
    stopEverything();
    setErrorMessage(null);
    setIsPaused(false);

    // 2. Check for Completion
    if (index >= timers.length) {
      setPhase(TimerPhase.COMPLETION_ANNOUNCEMENT);
      try {
        // Check cache first, else generate
        let buffer = audioCache.current.get(index);
        
        if (!buffer) {
          const base64 = await generateCompletionAnnouncement();
          if (opIdRef.current !== myOpId) return;
          buffer = await decodeGeminiAudio(base64);
        }
        
        if (opIdRef.current !== myOpId || !buffer) return;

        const { done, stop } = playAudioBuffer(buffer, settings.alarmVolume ?? 0.8);
        audioStopRef.current = stop;
        await done;
      } catch (e) {
        console.warn("Completion audio skipped due to error:", e);
      }
      
      if (opIdRef.current === myOpId) {
        setPhase(TimerPhase.COMPLETED);
      }
      return;
    }

    // 3. Start Step
    setCurrentIndex(index);
    setPhase(TimerPhase.PREPARING_AUDIO);

    try {
      const step = timers[index];
      let buffer = audioCache.current.get(index);

      // If not in cache, fetch it now
      if (!buffer) {
        const base64 = await generateTimerAnnouncement(step.name, step.durationSeconds);
        if (opIdRef.current !== myOpId) return;

        buffer = await decodeGeminiAudio(base64);
        // Cache it just in case we re-use it (though unlikely in linear flow)
        audioCache.current.set(index, buffer);
      }

      if (opIdRef.current !== myOpId) return;

      // Play Announcement
      setPhase(TimerPhase.ANNOUNCING);
      const { done, stop } = playAudioBuffer(buffer!, settings.alarmVolume ?? 0.8);
      audioStopRef.current = stop;
      await done;
      if (opIdRef.current !== myOpId) return;
      audioStopRef.current = null;

      // Start Countdown
      setPhase(TimerPhase.COUNTDOWN);
      startTimer(step.durationSeconds, myOpId, () => handleStepComplete(index, myOpId));
      
      // --- TRIGGER PRELOAD FOR NEXT STEP ---
      // While counting down, load the next step (or completion)
      preloadNextAudio(index + 1);

    } catch (e: any) {
      console.warn("Sequence error (handled):", e);
      if (opIdRef.current === myOpId) {
         setErrorMessage("Audio unavailable - starting silently.");
         setPhase(TimerPhase.COUNTDOWN);
         startTimer(timers[index].durationSeconds, myOpId, () => handleStepComplete(index, myOpId));
         // Still try to preload next
         preloadNextAudio(index + 1);
      }
    }
  };

  const startTimer = (duration: number, myOpId: number, onComplete: () => void) => {
    setRemainingSeconds(duration);
    
    if (intervalRef.current) window.clearInterval(intervalRef.current);

    intervalRef.current = window.setInterval(() => {
      if (opIdRef.current !== myOpId) {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        return;
      }

      setRemainingSeconds(prev => {
        if (prev <= 1) {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleStepComplete = async (completedIndex: number, myOpId: number) => {
    if (opIdRef.current !== myOpId) return;

    // Play Alarm
    try {
        await playAlarm(settings.alarmSound, settings.alarmVolume ?? 0.8);
    } catch (e) {
        console.error("Alarm play failed", e);
    }
    
    if (opIdRef.current !== myOpId) return;

    const nextIndex = completedIndex + 1;

    // Check Buffer
    if (nextIndex < totalSteps && settings.bufferSeconds > 0) {
      setPhase(TimerPhase.BUFFER);
      setCurrentIndex(nextIndex); // Visual update to show what's coming

      startTimer(settings.bufferSeconds, myOpId, () => {
        if (opIdRef.current === myOpId) {
            runSequence(nextIndex);
        }
      });
    } else {
      runSequence(nextIndex);
    }
  };

  // --- User Actions ---

  useEffect(() => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    // Start the first one
    runSequence(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSkip = () => {
    runSequence(currentIndex + 1);
  };

  const togglePause = () => {
    if (phase !== TimerPhase.COUNTDOWN && phase !== TimerPhase.BUFFER) return;

    if (isPaused) {
      // Resume
      setIsPaused(false);
      startTimer(remainingSeconds, opIdRef.current, () => {
        if (phase === TimerPhase.BUFFER) {
             // If buffering, resume leads to starting the actual next sequence
             runSequence(currentIndex); 
        } else {
             handleStepComplete(currentIndex, opIdRef.current);
        }
      });
    } else {
      // Pause
      setIsPaused(true);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    }
  };

  // --- Render ---

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Progress Ring Calculation
  let progress = 0;
  let totalForPhase = 1;
  if (phase === TimerPhase.BUFFER) {
     totalForPhase = settings.bufferSeconds;
  } else if (currentTimer && phase === TimerPhase.COUNTDOWN) {
     totalForPhase = currentTimer.durationSeconds;
  }
  
  if (totalForPhase > 0) {
      progress = ((totalForPhase - remainingSeconds) / totalForPhase) * 100;
  }

  const circumference = 2 * Math.PI * 120; // r=120
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const ringColor = phase === TimerPhase.BUFFER ? 'text-amber-500' : 'text-indigo-500';

  if (phase === TimerPhase.COMPLETED) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white p-6 text-center space-y-6 animate-in fade-in duration-500">
        <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-900/50">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">All Done!</h2>
        <p className="text-slate-400 text-lg">You've completed your sequence.</p>
        <button 
          onClick={onExit}
          className="px-8 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-colors border border-slate-700 mt-8"
        >
          Back to Setup
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="p-4 flex justify-between items-center bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <button onClick={onExit} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
        <div className="text-sm font-medium text-slate-400">
          Step {Math.min(currentIndex + 1, totalSteps)} of {totalSteps}
        </div>
        <div className="w-10"></div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-12">
        
        {/* Status Text */}
        <div className="text-center space-y-2 h-24 flex flex-col justify-end">
          {errorMessage && (
            <div className="flex items-center justify-center gap-2 text-amber-400 mb-2 animate-pulse">
               <AlertCircle className="w-4 h-4" />
               <span className="text-sm">{errorMessage}</span>
            </div>
          )}

          {(phase === TimerPhase.PREPARING_AUDIO || phase === TimerPhase.COMPLETION_ANNOUNCEMENT) && (
            <div className="flex items-center justify-center gap-3 text-indigo-400 animate-pulse">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xl font-medium">Preparing Next Step...</span>
            </div>
          )}
          {phase === TimerPhase.ANNOUNCING && (
            <div className="flex items-center justify-center gap-3 text-emerald-400">
              <Volume2 className="w-8 h-8 animate-pulse" />
              <span className="text-2xl font-semibold">Listen...</span>
            </div>
          )}
          {phase === TimerPhase.BUFFER && (
             <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 text-amber-400">
                    <Coffee className="w-5 h-5" />
                    <span className="text-lg uppercase tracking-widest font-bold">Rest / Buffer</span>
                </div>
                <p className="text-slate-400">Next: {currentTimer?.name}</p>
             </div>
          )}
          {phase === TimerPhase.COUNTDOWN && (
            <>
              <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">{currentTimer?.name}</h2>
              {isPaused && <span className="text-amber-400 font-bold uppercase tracking-widest text-sm">Paused</span>}
            </>
          )}
        </div>

        {/* Timer Visualization */}
        <div className="relative flex items-center justify-center">
          {/* SVG Ring */}
          <svg className="transform -rotate-90 w-72 h-72 md:w-96 md:h-96">
            <circle
              cx="50%"
              cy="50%"
              r="120"
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              className="text-slate-800"
            />
            <circle
              cx="50%"
              cy="50%"
              r="120"
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              strokeLinecap="round"
              className={`${ringColor} transition-all duration-500 ease-linear ${isPaused ? 'opacity-50' : ''}`}
              style={{
                strokeDasharray: circumference,
                strokeDashoffset: (phase === TimerPhase.COUNTDOWN || phase === TimerPhase.BUFFER) ? strokeDashoffset : circumference
              }}
            />
          </svg>
          
          {/* Digital Time */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl md:text-8xl font-mono font-bold text-white tracking-tighter">
              {(phase === TimerPhase.COUNTDOWN || phase === TimerPhase.BUFFER || isPaused) ? formatTime(remainingSeconds) : "--:--"}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-6 items-center">
          <button
            onClick={togglePause}
            disabled={phase !== TimerPhase.COUNTDOWN && phase !== TimerPhase.BUFFER}
            className="w-16 h-16 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-slate-600 shadow-lg"
          >
            {isPaused ? <Play className="w-8 h-8 ml-1" /> : <Pause className="w-8 h-8" />}
          </button>

          <button
            onClick={handleSkip}
            className="w-16 h-16 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white transition-all border border-slate-600 shadow-lg active:scale-95"
            title="Skip to next"
          >
            <SkipForward className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RunMode;