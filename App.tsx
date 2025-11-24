import React, { useState } from 'react';
import TimerSetup from './components/TimerSetup';
import RunMode from './components/RunMode';
import { TimerStep, AppStatus, ChainSettings } from './types';

const App: React.FC = () => {
  const [timers, setTimers] = useState<TimerStep[]>([]);
  const [status, setStatus] = useState<AppStatus>(AppStatus.SETUP);
  const [settings, setSettings] = useState<ChainSettings>({
    alarmSound: 'bell',
    bufferSeconds: 0,
    alarmVolume: 0.8
  });

  const handleStart = () => {
    if (timers.length > 0) {
      setStatus(AppStatus.RUNNING);
    }
  };

  const handleExit = () => {
    setStatus(AppStatus.SETUP);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {status === AppStatus.SETUP && (
        <TimerSetup 
          timers={timers} 
          setTimers={setTimers}
          settings={settings}
          setSettings={setSettings}
          onStart={handleStart} 
        />
      )}
      {status === AppStatus.RUNNING && (
        <RunMode 
          timers={timers}
          settings={settings}
          onExit={handleExit} 
        />
      )}
    </div>
  );
};

export default App;