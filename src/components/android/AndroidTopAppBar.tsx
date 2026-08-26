import React, { useState } from 'react';
import { 
  Sparkles, 
  MapPin, 
  Zap, 
  HelpCircle, 
  X, 
  BrainCircuit,
  Flame,
  CalendarDays,
  Settings
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { AppMode, EnergyLevel } from '../../types';
import { TutorialModal } from './TutorialModal';
import { AndroidTab } from './AndroidNavigationBar';
import { CompactDateBrowser } from './CompactDateBrowser';

interface AndroidTopAppBarProps {
  onNavigateTab?: (tab: AndroidTab) => void;
}

export const AndroidTopAppBar: React.FC<AndroidTopAppBarProps> = ({ onNavigateTab }) => {
  const { 
    state, 
    mode, 
    setMode, 
    setCurrentEnergy, 
    setIsFocusModalOpen,
    setIsRewardsModalOpen,
    setIsGeofenceModalOpen,
    focusTimer,
    selectedDate,
    isViewingToday,
    isLoadingHistoricalDate,
    historicalDateMessage,
    selectViewDate
  } = useDay();

  const [showEnergyMenu, setShowEnergyMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const gamification = state.gamification || { points: 0, currentStreakDays: 0 };

  const energyOptions: { level: EnergyLevel; label: string; icon: string }[] = [
    { level: 'HIGH_FOCUS', label: 'High Focus', icon: '⚡' },
    { level: 'NORMAL', label: 'Normal', icon: '🌿' },
    { level: 'LOW_ENERGY', label: 'Low Energy', icon: '🔋' },
    { level: 'RUSHED', label: 'Rushed', icon: '⏱️' },
    { level: 'DISTRACTED', label: 'Distracted', icon: '🎯' },
    { level: 'TIRED', label: 'Tired', icon: '🌙' },
  ];

  const modeOptions: { mode: AppMode; label: string; desc: string }[] = [
    { mode: 'ACCOUNTABILITY', label: 'Accountability Mode', desc: 'Directs focus, protects context, enforces priorities' },
    { mode: 'NORMAL_CHAT', label: 'Normal Chat', desc: 'Answers questions without productivity coaching' },
    { mode: 'RESEARCH', label: 'Research Mode', desc: 'Deep dive into topics and information' },
    { mode: 'CREATIVE', label: 'Creative Mode', desc: 'Unstructured idea generation & drafts' },
  ];

  return (
    <>
      <header
        id="android-top-app-bar"
        className="w-full bg-[#111318] px-3 py-2 border-b border-[#44474E]/30 flex items-center justify-between z-20"
        onClickCapture={(event) => {
          if (!isViewingToday && !(event.target as HTMLElement).closest('[data-history-allowed="true"]')) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {/* Left: Settings entry & status */}
        <div className="flex items-center space-x-2">
          <button
            id="settings-top-btn"
            data-history-allowed="true"
            type="button"
            onClick={() => onNavigateTab?.('settings')}
            className="w-8 h-8 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[#D1E1FF] flex items-center justify-center shadow-md border border-[#44474E]/40 shrink-0 transition"
            title="Open DayTrace settings"
            aria-label="Open DayTrace settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-sm tracking-tight text-[#E2E2E6]">DayTrace</span>
              <button
                id="mode-picker-btn"
                onClick={() => setShowModeMenu(!showModeMenu)}
                className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-[#2E3036] text-[#D1E1FF] border border-[#44474E]/40 hover:bg-[#334867] transition"
              >
                {mode.replace('_', ' ')}
              </button>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] text-[#C4C6D0]">
              <button
                onClick={() => setIsGeofenceModalOpen(true)}
                className="flex items-center hover:text-[#D1E1FF] transition"
                title="Smart Geofence Location & Automation"
              >
                <MapPin className="w-3 h-3 mr-0.5 text-[#D1E1FF]" />
                <span className="underline decoration-dotted">{state.current.location}</span>
              </button>
              <span className="text-[#44474E]">•</span>
              <button
                id="energy-picker-btn"
                onClick={() => setShowEnergyMenu(!showEnergyMenu)}
                className="hover:underline flex items-center text-[#E2E2E6] font-medium"
              >
                <Zap className="w-3 h-3 mr-0.5 text-[#D1E1FF]" />
                {state.current.energy}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Tools */}
        <div className="flex items-center space-x-1">
          {/* Rewards & Streak Pill */}
          <button
            id="rewards-vault-top-btn"
            onClick={() => setIsRewardsModalOpen(true)}
            className="px-2 py-1 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[#E2E2E6] transition shadow-xs border border-[#FBBF24]/30 flex items-center space-x-1"
            title="Rewards Vault & Streaks"
          >
            <Flame className="w-3 h-3 text-[#F87171] fill-current" />
            <span className="text-[11px] font-bold font-mono text-[#FBBF24]">{gamification.points}</span>
          </button>

          {/* Pomodoro Focus Timer Button */}
          <button
            id="focus-timer-top-btn"
            onClick={() => setIsFocusModalOpen(true)}
            className={`p-1.5 rounded-xl transition shadow-xs relative ${
              focusTimer.isActive 
                ? 'bg-[#003062] text-[#D1E1FF] border border-[#D1E1FF]' 
                : 'bg-[#2E3036] hover:bg-[#334867] text-[#D1E1FF]'
            }`}
            title="Deep Work & Pomodoro Stopwatch"
          >
            <BrainCircuit className="w-3.5 h-3.5 text-[#D1E1FF]" />
            {focusTimer.isActive && !focusTimer.isPaused && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#86EFAC] rounded-full animate-ping" />
            )}
          </button>

          {/* Guide & Tutorial Button */}
          <button
            onClick={() => setShowTutorialModal(true)}
            className="p-1.5 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[#D1E1FF] transition shadow-xs"
            title="DayTrace Interactive Guide"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Global Date Browser: available from every tab through the shared app bar */}
          <button
            data-history-allowed="true"
            onClick={() => setShowDatePicker(true)}
            className={`p-1.5 rounded-xl transition shadow-xs ${
              isViewingToday
                ? 'bg-[#2E3036] hover:bg-[#334867] text-[#D1E1FF]'
                : 'bg-[#D1E1FF] text-[#003062]'
            }`}
            title={isViewingToday ? 'Browse another DayTrace date' : `Viewing ${selectedDate}`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
          </button>

        </div>
      </header>

      {showDatePicker && <CompactDateBrowser selectedDate={selectedDate} isLoading={isLoadingHistoricalDate} message={historicalDateMessage} onClose={() => setShowDatePicker(false)} onViewDate={selectViewDate} />}

      {/* Energy Level Selection Menu */}
      {showEnergyMenu && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" 
          onClick={() => setShowEnergyMenu(false)}
        >
          <div 
            className="bg-[#1D2026] border border-[#44474E]/60 rounded-3xl p-5 w-full max-w-xs shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#44474E]/30">
              <h3 className="font-bold text-sm text-[#E2E2E6]">Set Current Energy</h3>
              <button onClick={() => setShowEnergyMenu(false)} className="text-[#C4C6D0] hover:text-[#E2E2E6]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {energyOptions.map((opt) => (
                <button
                  key={opt.level}
                  onClick={() => {
                    setCurrentEnergy(opt.level);
                    setShowEnergyMenu(false);
                  }}
                  className={`flex items-center space-x-2 p-2.5 rounded-2xl text-xs font-medium transition ${
                    state.current.energy === opt.level
                      ? 'bg-[#334867] text-[#D1E1FF] border border-[#D1E1FF]/40'
                      : 'bg-[#2E3036] text-[#E2E2E6] hover:bg-[#334867]/50'
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mode Selection Menu */}
      {showModeMenu && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" 
          onClick={() => setShowModeMenu(false)}
        >
          <div 
            className="bg-[#1D2026] border border-[#44474E]/60 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#44474E]/30">
              <h3 className="font-bold text-sm text-[#E2E2E6]">DayTrace Assistant Mode</h3>
              <button onClick={() => setShowModeMenu(false)} className="text-[#C4C6D0] hover:text-[#E2E2E6]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {modeOptions.map((opt) => (
                <button
                  key={opt.mode}
                  onClick={() => {
                    setMode(opt.mode);
                    setShowModeMenu(false);
                  }}
                  className={`w-full text-left p-3 rounded-2xl transition border ${
                    mode === opt.mode
                      ? 'bg-[#334867] text-[#D1E1FF] border-[#D1E1FF]/40 shadow-sm'
                      : 'bg-[#2E3036] text-[#E2E2E6] border-transparent hover:border-[#44474E]/40'
                  }`}
                >
                  <div className="font-bold text-xs">{opt.label}</div>
                  <div className="text-[11px] text-[#C4C6D0]/80 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Modal */}
      <TutorialModal
        isOpen={showTutorialModal}
        onClose={() => setShowTutorialModal(false)}
        onNavigateTab={onNavigateTab}
      />
    </>
  );
};
