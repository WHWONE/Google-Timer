import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Clock, Play, Save, FolderOpen, X, Settings as SettingsIcon, Volume2, HardDrive, Mic, Square, Loader2, Copy } from 'lucide-react';
import { TimerStep, ChainSettings, AlarmType } from '../types';
import { transcribeAudio } from '../services/geminiService';

interface TimerSetupProps {
  timers: TimerStep[];
  setTimers: React.Dispatch<React.SetStateAction<TimerStep[]>>;
  settings: ChainSettings;
  setSettings: React.Dispatch<React.SetStateAction<ChainSettings>>;
  onStart: () => void;
}

interface SavedChain {
  name: string;
  timers: TimerStep[];
  settings: ChainSettings; 
  createdAt: number;
}

const STORAGE_KEY = 'chainflow_saved_chains';

const TimerSetup: React.FC<TimerSetupProps> = ({ timers, setTimers, settings, setSettings, onStart }) => {
  const [newName, setNewName] = useState('');
  const [newMinutes, setNewMinutes] = useState('0');
  const [newSeconds, setNewSeconds] = useState('0');
  
  // Save/Load State
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedChains, setSavedChains] = useState<SavedChain[]>([]);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [showMicSettings, setShowMicSettings] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const loaded = localStorage.getItem(STORAGE_KEY);
    if (loaded) {
      try {
        setSavedChains(JSON.parse(loaded));
      } catch (e) {
        console.error("Failed to parse saved chains", e);
      }
    }
    
    // Enumerate audio devices
    const getDevices = async () => {
      try {
        // Request permission first to get labels
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        setAudioDevices(inputs);
        if (inputs.length > 0) {
          setSelectedDeviceId(inputs[0].deviceId);
        }
      } catch (e) {
        console.warn("Could not access microphone devices", e);
      }
    };
    getDevices();

  }, []);

  const addTimer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const duration = (parseInt(newMinutes) || 0) * 60 + (parseInt(newSeconds) || 0);
    if (duration <= 0) return;

    const newTimer: TimerStep = {
      id: crypto.randomUUID(),
      name: newName,
      durationSeconds: duration,
    };

    setTimers([...timers, newTimer]);
    setNewName('');
    setNewMinutes('0');
    setNewSeconds('0');
  };

  const removeTimer = (id: string) => {
    setTimers(timers.filter(t => t.id !== id));
  };

  const duplicateTimer = (timer: TimerStep) => {
    const newTimer = {
      ...timer,
      id: crypto.randomUUID()
    };
    setTimers([...timers, newTimer]);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  // --- Recording Logic ---

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined }
      });
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        setIsTranscribing(true);
        stream.getTracks().forEach(track => track.stop()); // Stop mic usage

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const base64Audio = await blobToBase64(audioBlob);
          const text = await transcribeAudio(base64Audio, mimeType);
          if (text) {
            setNewName(text);
          }
        } catch (error) {
          console.error("Transcription failed", error);
          alert("Could not transcribe audio. Please try again.");
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
      setShowMicSettings(false);
    } catch (err) {
      console.error("Error starting recording:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // --- Save/Load Logic ---

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim() || timers.length === 0) return;

    const newChain: SavedChain = {
      name: saveName.trim(),
      timers: timers,
      settings: settings,
      createdAt: Date.now()
    };

    const existingIndex = savedChains.findIndex(c => c.name === saveName.trim());
    let updatedChains;
    if (existingIndex >= 0) {
      if (!confirm(`Overwrite existing chain "${saveName}"?`)) return;
      updatedChains = [...savedChains];
      updatedChains[existingIndex] = newChain;
    } else {
      updatedChains = [...savedChains, newChain];
    }

    setSavedChains(updatedChains);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedChains));
    setSaveName('');
    setShowSaveInput(false);
    alert(`Saved "${saveName}" to browser local storage.`);
  };

  const handleLoad = (chain: SavedChain) => {
    setTimers(chain.timers);
    setSettings(chain.settings || { alarmSound: 'bell', bufferSeconds: 0, alarmVolume: 0.8 });
    setShowLoadModal(false);
  };

  const handleDeleteChain = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete chain "${name}"?`)) {
      const updated = savedChains.filter(c => c.name !== name);
      setSavedChains(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-8 relative">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
          ChainFlow Timer
        </h1>
        <div className="flex justify-center gap-4">
          <button 
            onClick={() => setShowLoadModal(true)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800 border border-slate-700/50"
          >
            <FolderOpen className="w-4 h-4" /> Load Routine
          </button>
          {timers.length > 0 && (
            <button 
              onClick={() => setShowSaveInput(true)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800 border border-slate-700/50"
            >
              <Save className="w-4 h-4" /> Save Routine
            </button>
          )}
        </div>
      </div>

      {/* Save Input Inline Modal */}
      {showSaveInput && (
        <div className="bg-slate-800 p-4 rounded-xl border border-indigo-500/50 shadow-lg animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2 mb-2 text-xs text-indigo-300">
             <HardDrive className="w-3 h-3" />
             <span>Saving to Browser Local Storage</span>
          </div>
          <form onSubmit={handleSave} className="flex gap-2 items-center">
            <input 
              autoFocus
              type="text" 
              placeholder="Name this routine..." 
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium">Save</button>
            <button type="button" onClick={() => setShowSaveInput(false)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><X className="w-5 h-5"/></button>
          </form>
        </div>
      )}

      {/* Add Timer Form */}
      <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 relative">
        <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" />
          Add Step
        </h2>
        <form onSubmit={addTimer} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full relative">
            <label className="block text-xs font-medium text-slate-400 mb-1">Task Name</label>
            <div className="relative">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={isRecording ? "Recording..." : isTranscribing ? "Transcribing..." : "e.g. Wash Dishes"}
                disabled={isRecording || isTranscribing}
                className={`w-full bg-slate-900 border rounded-lg pl-4 pr-20 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all ${isRecording ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'border-slate-700'}`}
              />
              
              <div className="absolute right-1 top-1 flex items-center gap-1">
                 {/* Mic Selection Trigger */}
                 {audioDevices.length > 1 && !isRecording && !isTranscribing && (
                   <button
                    type="button"
                    onClick={() => setShowMicSettings(!showMicSettings)}
                    className="p-1.5 text-slate-500 hover:text-white rounded hover:bg-slate-700"
                    title="Select Microphone"
                   >
                     <SettingsIcon className="w-3 h-3" />
                   </button>
                 )}

                 {/* Record Button */}
                 <button
                   type="button"
                   onClick={isRecording ? stopRecording : startRecording}
                   disabled={isTranscribing}
                   className={`p-1.5 rounded-md transition-colors ${
                     isRecording 
                       ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                       : isTranscribing 
                         ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                         : 'bg-slate-700 hover:bg-slate-600 text-indigo-400'
                   }`}
                   title={isRecording ? "Stop Recording" : "Record Task Name"}
                 >
                   {isTranscribing ? (
                     <Loader2 className="w-4 h-4 animate-spin" />
                   ) : isRecording ? (
                     <Square className="w-4 h-4 fill-current" />
                   ) : (
                     <Mic className="w-4 h-4" />
                   )}
                 </button>
              </div>

              {/* Mic Dropdown */}
              {showMicSettings && !isRecording && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-20 p-1">
                  <div className="text-xs font-semibold text-slate-400 px-2 py-1 mb-1 border-b border-slate-700">Select Microphone</div>
                  {audioDevices.map(device => (
                    <button
                      key={device.deviceId}
                      type="button"
                      onClick={() => {
                        setSelectedDeviceId(device.deviceId);
                        setShowMicSettings(false);
                      }}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded truncate ${selectedDeviceId === device.deviceId ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                    >
                      {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Min</label>
              <input
                type="number"
                min="0"
                value={newMinutes}
                onChange={(e) => setNewMinutes(e.target.value)}
                className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Sec</label>
              <input
                type="number"
                min="0"
                max="59"
                value={newSeconds}
                onChange={(e) => setNewSeconds(e.target.value)}
                className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </form>
      </div>

      {/* Settings Section */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
        <h2 className="text-sm font-semibold mb-4 text-slate-300 flex items-center gap-2 uppercase tracking-wide">
          <SettingsIcon className="w-4 h-4" />
          Sequence Settings
        </h2>
        <div className="grid grid-cols-1 gap-6">
          {/* Alarm Sound Selection */}
          <div>
             <label className="block text-sm text-slate-400 mb-2">Timer Completion Sound</label>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(['bell', 'digital', 'chime', 'gong'] as AlarmType[]).map(sound => (
                  <button
                    key={sound}
                    onClick={() => setSettings(prev => ({...prev, alarmSound: sound}))}
                    className={`px-3 py-2 rounded-lg text-sm border transition-all ${
                      settings.alarmSound === sound 
                        ? 'bg-indigo-600 border-indigo-500 text-white' 
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {sound.charAt(0).toUpperCase() + sound.slice(1)}
                  </button>
                ))}
             </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Buffer Setting */}
            <div className="flex-1">
                <label className="block text-sm text-slate-400 mb-2">Buffer Between Tasks</label>
                <div className="flex items-center gap-3">
                <input 
                    type="number"
                    min="0"
                    max="600"
                    value={settings.bufferSeconds}
                    onChange={(e) => setSettings(prev => ({...prev, bufferSeconds: Math.max(0, parseInt(e.target.value) || 0)}))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="text-slate-500 text-sm whitespace-nowrap">seconds</span>
                </div>
            </div>

            {/* Volume Setting */}
            <div className="flex-1">
                <label className="block text-sm text-slate-400 mb-2 flex items-center gap-2">
                    <Volume2 className="w-4 h-4" /> Alarm Volume
                </label>
                <div className="flex items-center gap-3 h-10">
                    <input 
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.alarmVolume ?? 0.8}
                        onChange={(e) => setSettings(prev => ({...prev, alarmVolume: parseFloat(e.target.value)}))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-slate-500 text-sm w-8 text-right">{Math.round((settings.alarmVolume ?? 0.8) * 100)}%</span>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timer List */}
      <div className="space-y-4">
        {timers.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-800/50 rounded-xl border border-slate-700 border-dashed">
            No timers yet. Add your first step above or load a saved routine.
          </div>
        ) : (
          <div className="grid gap-3">
             {timers.map((timer, index) => (
              <div key={timer.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex items-center gap-4 group hover:border-indigo-500/50 transition-colors">
                <div className="text-slate-500 font-mono text-sm w-6">{(index + 1).toString().padStart(2, '0')}</div>
                <div className="flex-1">
                  <h3 className="font-medium text-white">{timer.name}</h3>
                  <p className="text-sm text-slate-400">{formatTime(timer.durationSeconds)}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                    onClick={() => duplicateTimer(timer)}
                    className="text-slate-500 hover:text-indigo-400 transition-colors p-2 rounded-full hover:bg-slate-700"
                    title="Duplicate Step"
                    >
                    <Copy className="w-5 h-5" />
                    </button>
                    <button
                    onClick={() => removeTimer(timer.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded-full hover:bg-slate-700"
                    title="Remove Step"
                    >
                    <Trash2 className="w-5 h-5" />
                    </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {timers.length > 0 && (
        <button
          onClick={onStart}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/20 transform transition-all hover:scale-[1.01] flex items-center justify-center gap-3 text-lg"
        >
          <Play className="w-6 h-6 fill-current" />
          Start Sequence
        </button>
      )}

      {/* Load Modal Overlay */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Load Routine</h3>
              <button onClick={() => setShowLoadModal(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6"/></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2 flex-1">
              {savedChains.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No saved routines found.</p>
              ) : (
                savedChains.map((chain) => (
                  <div key={chain.name} 
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 cursor-pointer group"
                    onClick={() => handleLoad(chain)}
                  >
                    <div>
                      <h4 className="font-medium text-white">{chain.name}</h4>
                      <p className="text-xs text-slate-400">{chain.timers.length} steps • {new Date(chain.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteChain(chain.name, e)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimerSetup;