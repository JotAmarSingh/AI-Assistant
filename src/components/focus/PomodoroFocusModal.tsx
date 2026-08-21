import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Plus, 
  Target, 
  X, 
  BrainCircuit
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { FocusTimerMode } from '../../types';

interface PomodoroFocusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PomodoroFocusModal: React.FC<PomodoroFocusModalProps> = ({ isOpen, onClose }) => {
  const { 
    state, 
    focusTimer, 
    startFocusTimer, 
    pauseFocusTimer, 
    resumeFocusTimer, 
    stopFocusTimer, 
    extendFocusTimer, 
    finishFocusTaskEarly
  } = useDay();

  const [selectedMode, setSelectedMode] = useState<FocusTimerMode>('POMODORO_25');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');

  const availableTasks = state.tasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED');

  // Initialize selected task with current active focus task
  useEffect(() => {
    if (state.current.focusTaskId) {
      setSelectedTaskId(state.current.focusTaskId);
    } else if (availableTasks.length > 0 && !selectedTaskId) {
      setSelectedTaskId(availableTasks[0].id);
    }
  }, [state.current.focusTaskId, availableTasks]);

  useEffect(() => {
    if (focusTimer.isActive) {
      setSelectedMode(focusTimer.mode);
    }
  }, [focusTimer.isActive, focusTimer.mode]);

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    let taskTitle = customTitle.trim();
    let taskId: string | undefined = undefined;

    if (selectedTaskId) {
      const task = availableTasks.find((t) => t.id === selectedTaskId);
      if (task) {
        taskTitle = task.title;
        taskId = task.id;
      }
    }

    if (!taskTitle) {
      taskTitle = 'Deep Focus Block';
    }

    startFocusTimer(selectedMode, taskId, taskTitle);
  };

  const progressPercent = focusTimer.totalDurationSeconds > 0
    ? ((focusTimer.totalDurationSeconds - focusTimer.secondsRemaining) / focusTimer.totalDurationSeconds) * 100
    : 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#1D2026] text-[#E2E2E6] border border-[#44474E]/60 rounded-[32px] p-6 max-w-md w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#44474E]/30">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-2xl bg-[#D1E1FF]/10 text-[#D1E1FF]">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-[#E2E2E6]">Deep Work & Pomodoro Timer</h2>
              <p className="text-[11px] text-[#C4C6D0]/70">Automated timeline logging and focus tracking</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#C4C6D0] hover:text-[#E2E2E6] p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timer Display Card */}
        <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-[#111318] border border-[#44474E]/40 relative overflow-hidden">
          {/* Circular Visual Background Glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="w-48 h-48 rounded-full bg-[#D1E1FF] blur-2xl animate-pulse" />
          </div>

          {/* Active Task Target Pill */}
          <div className="z-10 mb-3 px-3 py-1 rounded-full bg-[#2E3036] border border-[#44474E]/50 flex items-center space-x-1.5 max-w-[90%]">
            <Target className="w-3.5 h-3.5 text-[#D1E1FF] shrink-0" />
            <span className="text-xs font-semibold text-[#E2E2E6] truncate">
              {focusTimer.isActive ? focusTimer.targetTaskTitle : (selectedTaskId ? availableTasks.find(t => t.id === selectedTaskId)?.title : customTitle || 'Select focus objective')}
            </span>
          </div>

          {/* Big Digital Countdown */}
          <div className="z-10 text-5xl font-extrabold font-mono tracking-tight text-[#D1E1FF] my-2">
            {focusTimer.isActive ? (
              focusTimer.mode === 'STOPWATCH' ? formatTime(focusTimer.elapsedSeconds) : formatTime(focusTimer.secondsRemaining)
            ) : (
              selectedMode === 'POMODORO_25' ? '25:00' :
              selectedMode === 'DEEP_FLOW_50' ? '50:00' :
              selectedMode === 'SHORT_BREAK_5' ? '05:00' :
              selectedMode === 'LONG_BREAK_15' ? '15:00' : '00:00'
            )}
          </div>

          {/* Mode Badge / Status */}
          <div className="z-10 text-[11px] font-semibold text-[#C4C6D0]/80 mt-1 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#86EFAC] animate-ping" />
            <span>
              {focusTimer.isActive 
                ? (focusTimer.isPaused ? 'Paused' : 'Focus Session in Progress') 
                : 'Ready to Start'}
            </span>
          </div>

          {/* Progress Bar */}
          {focusTimer.isActive && focusTimer.mode !== 'STOPWATCH' && (
            <div className="w-full bg-[#2E3036] h-1.5 rounded-full mt-4 overflow-hidden z-10">
              <div 
                className="bg-[#D1E1FF] h-full transition-all duration-1000"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
          )}

          {/* Timer Action Controls */}
          <div className="flex items-center space-x-3 mt-5 z-10">
            {!focusTimer.isActive ? (
              <button
                id="start-focus-session-btn"
                onClick={handleStart}
                className="py-3 px-8 rounded-2xl bg-[#D1E1FF] hover:bg-[#B6D4FE] text-[#003062] font-bold text-sm flex items-center space-x-2 shadow-lg transition active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Focus</span>
              </button>
            ) : (
              <>
                {focusTimer.isPaused ? (
                  <button
                    onClick={resumeFocusTimer}
                    className="py-2.5 px-5 rounded-2xl bg-[#D1E1FF] text-[#003062] font-bold text-xs flex items-center space-x-1.5 transition active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    onClick={pauseFocusTimer}
                    className="py-2.5 px-5 rounded-2xl bg-[#334867] hover:bg-[#445E86] text-[#D1E1FF] font-bold text-xs flex items-center space-x-1.5 transition active:scale-95"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </button>
                )}

                <button
                  onClick={() => extendFocusTimer(5)}
                  className="py-2.5 px-3.5 rounded-2xl bg-[#2E3036] hover:bg-[#44474E]/60 text-[#E2E2E6] font-semibold text-xs flex items-center space-x-1 transition"
                  title="Add 5 Minutes"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>5m</span>
                </button>

                <button
                  onClick={finishFocusTaskEarly}
                  className="py-2.5 px-4 rounded-2xl bg-[#064E3B] hover:bg-[#047857] text-[#86EFAC] font-bold text-xs flex items-center space-x-1.5 transition border border-[#059669]/40"
                  title="Mark Task Finished & Log to Timeline"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Done</span>
                </button>

                <button
                  onClick={stopFocusTimer}
                  className="p-2.5 rounded-2xl bg-[#2E3036] hover:bg-[#7F1D1D]/30 text-[#C4C6D0] hover:text-[#F87171] transition"
                  title="Stop & Reset"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mode Selector Presets */}
        {!focusTimer.isActive && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#D1E1FF] uppercase tracking-wider">Focus Duration Preset</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'POMODORO_25', label: 'Pomodoro', desc: '25m Focus' },
                { id: 'DEEP_FLOW_50', label: 'Deep Flow', desc: '50m Focus' },
                { id: 'SHORT_BREAK_5', label: 'Short Break', desc: '5m Rest' },
                { id: 'LONG_BREAK_15', label: 'Long Break', desc: '15m Rest' },
                { id: 'STOPWATCH', label: 'Open Flow', desc: 'Stopwatch' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMode(m.id as FocusTimerMode)}
                  className={`p-2.5 rounded-2xl text-left border transition ${
                    selectedMode === m.id
                      ? 'bg-[#334867] border-[#D1E1FF] text-[#D1E1FF]'
                      : 'bg-[#111318] border-[#44474E]/30 text-[#C4C6D0] hover:border-[#44474E]/70'
                  }`}
                >
                  <div className="font-bold text-xs">{m.label}</div>
                  <div className="text-[10px] opacity-70">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Task Objective Selector */}
        {!focusTimer.isActive && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#D1E1FF] uppercase tracking-wider">Target Focus Task</label>
            {availableTasks.length > 0 ? (
              <select
                value={selectedTaskId}
                onChange={(e) => {
                  setSelectedTaskId(e.target.value);
                  setCustomTitle('');
                }}
                className="w-full p-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs font-semibold text-[#E2E2E6] focus:outline-hidden focus:border-[#D1E1FF]"
              >
                <option value="">-- Or enter custom objective below --</option>
                {availableTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.category}] {t.title} ({t.status})
                  </option>
                ))}
              </select>
            ) : null}

            <input
              type="text"
              value={customTitle}
              onChange={(e) => {
                setCustomTitle(e.target.value);
                if (e.target.value) setSelectedTaskId('');
              }}
              placeholder="e.g. Write newsletter draft, debug API endpoint..."
              className="w-full p-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:outline-hidden focus:border-[#D1E1FF]"
            />
          </div>
        )}
      </div>
    </div>
  );
};
