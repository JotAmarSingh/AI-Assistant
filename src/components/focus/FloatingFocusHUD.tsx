import React from 'react';
import { Play, Pause, CheckCircle2, RotateCcw, Target, Sparkles, BrainCircuit, Maximize2 } from 'lucide-react';
import { useDay } from '../../context/DayContext';

interface FloatingFocusHUDProps {
  onOpenModal: () => void;
}

export const FloatingFocusHUD: React.FC<FloatingFocusHUDProps> = ({ onOpenModal }) => {
  const { focusTimer, pauseFocusTimer, resumeFocusTimer, finishFocusTaskEarly } = useDay();

  if (!focusTimer.isActive) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const displayTime = focusTimer.mode === 'STOPWATCH' 
    ? formatTime(focusTimer.elapsedSeconds) 
    : formatTime(focusTimer.secondsRemaining);

  return (
    <div 
      id="floating-focus-hud"
      onClick={onOpenModal}
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 max-w-sm w-[92%] bg-[#1D2026]/95 backdrop-blur-md border border-[#D1E1FF]/40 rounded-full px-4 py-2 shadow-2xl flex items-center justify-between cursor-pointer transition hover:border-[#D1E1FF] group select-none animate-in slide-in-from-bottom-2"
    >
      <div className="flex items-center space-x-2.5 truncate mr-2">
        <div className="w-8 h-8 rounded-full bg-[#334867] text-[#D1E1FF] flex items-center justify-center shrink-0 relative">
          <BrainCircuit className="w-4 h-4" />
          {!focusTimer.isPaused && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#86EFAC] rounded-full animate-ping" />
          )}
        </div>

        <div className="truncate">
          <div className="text-[10px] text-[#C4C6D0]/80 font-semibold truncate flex items-center space-x-1">
            <span className="truncate">{focusTimer.targetTaskTitle}</span>
          </div>
          <div className="text-xs font-mono font-bold text-[#D1E1FF]">
            {displayTime} {focusTimer.isPaused && <span className="text-[#FBBF24] text-[10px] font-sans ml-1">(Paused)</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        {focusTimer.isPaused ? (
          <button
            onClick={resumeFocusTimer}
            className="p-1.5 rounded-full bg-[#D1E1FF] text-[#003062] hover:bg-[#B6D4FE] transition"
            title="Resume"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={pauseFocusTimer}
            className="p-1.5 rounded-full bg-[#334867] text-[#D1E1FF] hover:bg-[#445E86] transition"
            title="Pause"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={finishFocusTaskEarly}
          className="p-1.5 rounded-full bg-[#064E3B] text-[#86EFAC] hover:bg-[#047857] transition border border-[#059669]/40"
          title="Mark Task Finished"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onOpenModal}
          className="p-1.5 rounded-full bg-[#2E3036] text-[#C4C6D0] hover:text-[#E2E2E6] transition"
          title="Expand Details"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
