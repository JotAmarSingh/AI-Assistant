import React from 'react';
import { Wifi, Signal, BatteryCharging, Sparkles, Bell } from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { isNativeAndroid } from '../../services/nativeBridge';

interface AndroidStatusBarProps {
  onOpenNotifications?: () => void;
}

export const AndroidStatusBar: React.FC<AndroidStatusBarProps> = ({ onOpenNotifications }) => {
  const { currentTimeString, state, mode } = useDay();

  const activeTask = state.tasks.find((t) => t.id === state.current.focusTaskId || t.status === 'ACTIVE');
  const pendingRemindersCount = state.reminders.filter((r) => !r.isDone).length;

  // In native Android APK, status bar is provided natively by Android OS, so we show an unobtrusive compact in-app header row or let real status bar take over
  if (isNativeAndroid()) return null;

  return (
    <div
      id="android-status-bar"
      onClick={onOpenNotifications}
      className="w-full h-8 px-4 flex items-center justify-between text-xs font-medium text-[#E2E2E6] select-none bg-[#111318]/95 backdrop-blur-md border-b border-[#44474E]/30 z-30 cursor-pointer transition-colors hover:bg-[#1D2026]/70"
      title="Tap to pull down DayTrace Notification Center"
    >
      {/* Left side: Time & Notification Icons */}
      <div className="flex items-center space-x-2">
        <span className="font-semibold tracking-tight text-[#E2E2E6]">{currentTimeString}</span>
        
        {/* Dynamic Android Notification Icons */}
        <div className="flex items-center space-x-1.5 pl-1.5 border-l border-[#44474E]/40">
          {activeTask && (
            <div className="flex items-center text-[#D1E1FF] animate-pulse" title={`Active Focus: ${activeTask.title}`}>
              <Sparkles className="w-3 h-3 text-[#D1E1FF]" />
            </div>
          )}
          {pendingRemindersCount > 0 && (
            <div className="flex items-center text-[#D1E1FF]" title={`${pendingRemindersCount} pending reminders`}>
              <Bell className="w-3 h-3 text-[#D1E1FF]" />
            </div>
          )}
          {mode === 'ACCOUNTABILITY' && (
            <div className="text-[10px] text-[#D1E1FF] font-mono px-1 py-0.2 rounded bg-[#334867]/60" title="Accountability Mode Active">
              AI•ON
            </div>
          )}
        </div>
      </div>

      {/* Right side: System Indicators in desktop preview */}
      <div className="flex items-center space-x-2 text-[#C4C6D0]">
        <span className="text-[10px] font-mono tracking-tighter text-[#C4C6D0]/70">5G</span>
        <Signal className="w-3 h-3 text-[#D1E1FF]" />
        <Wifi className="w-3.5 h-3.5 text-[#D1E1FF]" />
        <div className="flex items-center space-x-0.5">
          <span className="text-[10px] font-mono text-[#C4C6D0]">98%</span>
          <BatteryCharging className="w-3.5 h-3.5 text-[#D1E1FF]" />
        </div>
      </div>
    </div>
  );
};
