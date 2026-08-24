import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  MapPin, 
  Zap, 
  RefreshCw, 
  FileSpreadsheet, 
  Copy, 
  Check, 
  Download, 
  Smartphone, 
  HelpCircle, 
  X, 
  RotateCcw,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Table,
  Mic,
  BrainCircuit,
  Flame,
  Coins,
  Radio,
  Trophy,
  Moon,
  CloudDownload,
  ShieldCheck,
  CalendarDays
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { AppMode, EnergyLevel } from '../../types';
import { isNativeAndroid } from '../../services/nativeBridge';
import { TutorialModal } from './TutorialModal';
import { AndroidTab } from './AndroidNavigationBar';
import { toLocalDateKey } from '../../utils/dailyHistory';

interface AndroidTopAppBarProps {
  onNavigateTab?: (tab: AndroidTab) => void;
}

export const AndroidTopAppBar: React.FC<AndroidTopAppBarProps> = ({ onNavigateTab }) => {
  const { 
    state, 
    mode, 
    setMode, 
    setCurrentEnergy, 
    resetToFreshStart, 
    exportDataJSON, 
    exportDataSheetsCSV, 
    importDataJSON,
    syncToGoogleSheets,
    isSyncingSheets,
    restoreFromGoogleSheetsBackup,
    isRestoringBackup,
    updateUserSettings,
    setIsFocusModalOpen,
    setIsVoiceModalOpen,
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
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateInput, setDateInput] = useState(selectedDate);
  const [isNative, setIsNative] = useState(false);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{ success?: boolean; url?: string; error?: string } | null>(null);
  const [restoreSheetInput, setRestoreSheetInput] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const settings = state.userSettings || {};
  const gamification = state.gamification || { points: 0, currentStreakDays: 0 };

  const handleTriggerSync = async () => {
    setSyncFeedback(null);
    const res = await syncToGoogleSheets();
    setSyncFeedback(res);
  };

  const handleRestoreFromSheets = async () => {
    setRestoreStatus(null);
    const targetId = restoreSheetInput.trim() || settings.googleSpreadsheetId || undefined;
    const res = await restoreFromGoogleSheetsBackup(targetId);
    setRestoreStatus(res);
  };

  useEffect(() => {
    setIsNative(isNativeAndroid());
  }, []);

  useEffect(() => {
    setDateInput(selectedDate);
  }, [selectedDate]);

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

  const handleCopySheetsTab = (tabName: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const handleImportSubmit = () => {
    if (!importText.trim()) return;
    const success = importDataJSON(importText);
    if (success) {
      setImportStatus('DayTrace state restored successfully!');
      setTimeout(() => {
        setShowSyncModal(false);
        setImportStatus(null);
        setImportText('');
      }, 1200);
    } else {
      setImportStatus('Invalid JSON data format. Please check structure.');
    }
  };

  const sheetsData = exportDataSheetsCSV();

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
        {/* Left: App Identity & Geofence / Energy status */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-[#334867] text-[#D1E1FF] flex items-center justify-center font-bold text-sm shadow-md border border-[#D1E1FF]/20 shrink-0">
            <Sparkles className="w-4 h-4 text-[#D1E1FF]" />
          </div>
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

        {/* Right: Quick Action Tools (Rewards, Meeting Mode, Pomodoro, Sheets, Reset) */}
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

          {/* Meeting Mode foreground recorder */}
          <button
            id="voice-capture-top-btn"
            onClick={() => setIsVoiceModalOpen(true)}
            className="p-1.5 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[#D1E1FF] transition shadow-xs"
            title="Start Meeting Mode recording"
          >
            <Mic className="w-3.5 h-3.5 text-[#D1E1FF]" />
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

          {/* Backup & Sheets Sync Button */}
          <button
            id="sync-sheets-btn"
            onClick={() => setShowSyncModal(true)}
            className="p-1.5 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[#D1E1FF] transition shadow-xs"
            title="Google Sheets & JSON Backup"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
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

          {/* Destructive reset */}
          <button
            id="reset-day-btn"
            onClick={() => setShowResetConfirmModal(true)}
            className="p-1.5 rounded-xl bg-[#2E3036] hover:bg-[#F87171]/20 hover:text-[#F87171] text-[#C4C6D0] transition shadow-xs"
            title="Delete DayTrace data and start fresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {showDatePicker && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowDatePicker(false)}
        >
          <div
            className="bg-[#1D2026] border border-[#44474E]/50 rounded-[30px] p-5 w-full max-w-sm shadow-2xl space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#44474E]/30 pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#E2E2E6]">Browse DayTrace by date</h3>
                <p className="text-[11px] text-[#C4C6D0] mt-0.5">Past dates open as read-only history.</p>
              </div>
              <button onClick={() => setShowDatePicker(false)} className="p-1 text-[#C4C6D0]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="date"
              value={dateInput}
              max={toLocalDateKey()}
              onChange={(event) => setDateInput(event.target.value)}
              className="w-full py-3 px-3.5 rounded-2xl bg-[#111318] border border-[#44474E]/50 text-sm text-[#E2E2E6] focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
            />

            {historicalDateMessage && (
              <p className="text-[11px] text-[#C4C6D0] bg-[#2E3036] rounded-xl p-2.5">{historicalDateMessage}</p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  await selectViewDate(toLocalDateKey());
                  setShowDatePicker(false);
                }}
                className="flex-1 py-2.5 rounded-2xl bg-[#2E3036] text-[#E2E2E6] text-xs font-semibold"
              >
                Today
              </button>
              <button
                disabled={!dateInput || isLoadingHistoricalDate}
                onClick={async () => {
                  await selectViewDate(dateInput);
                  setShowDatePicker(false);
                }}
                className="flex-1 py-2.5 rounded-2xl bg-[#D1E1FF] text-[#003062] text-xs font-bold disabled:opacity-40"
              >
                {isLoadingHistoricalDate ? 'Loading...' : 'View Date'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Destructive fresh-start confirmation */}
      {showResetConfirmModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowResetConfirmModal(false)}
        >
          <div 
            className="bg-[#1D2026] border border-[#44474E]/60 rounded-[32px] p-6 w-full max-w-sm shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#334867] text-[#D1E1FF] flex items-center justify-center mx-auto shadow-inner">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#E2E2E6]">Delete all DayTrace data?</h3>
              <p className="text-xs text-[#C4C6D0] mt-1">
                This permanently removes tasks, timeline history, meetings, learned context, locations and settings from this device. Export a backup first if needed.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  resetToFreshStart();
                  setShowResetConfirmModal(false);
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#F87171]/20 hover:bg-[#F87171]/30 text-[#FCA5A5] text-xs font-bold transition border border-[#F87171]/30"
              >
                Delete All Data & Start Fresh
              </button>

              <button
                onClick={() => setShowResetConfirmModal(false)}
                className="w-full py-2 px-4 rounded-2xl text-xs text-[#C4C6D0] hover:text-[#E2E2E6] hover:bg-[#2E3036] transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Backup & JSON Restore Modal */}
      {showSyncModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" 
          onClick={() => setShowSyncModal(false)}
        >
          <div 
            className="bg-[#1D2026] text-[#E2E2E6] border border-[#44474E]/60 rounded-[32px] p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#44474E]/30">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-xl bg-[#334867] text-[#D1E1FF]">
                  <Download className="w-5 h-5 text-[#D1E1FF]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#E2E2E6]">Data Backup & Restore (.json)</h3>
                  <p className="text-[10px] text-[#C4C6D0]/70">Export or import your complete DayTrace backup</p>
                </div>
              </div>
              <button onClick={() => setShowSyncModal(false)} className="text-[#C4C6D0] hover:text-[#E2E2E6]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Export Section */}
            <div className="p-4 rounded-3xl bg-[#111318] border border-[#D1E1FF]/30 space-y-3 shadow-inner">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-xl bg-[#334867] text-[#D1E1FF]">
                  <Download className="w-4 h-4 text-[#D1E1FF]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#E2E2E6]">Export Backup File</h4>
                  <p className="text-[10px] text-[#C4C6D0]/70">Saves all tasks, timeline, routines, categories & learnings to a .json file</p>
                </div>
              </div>

              <button
                onClick={() => {
                  const blob = new Blob([exportDataJSON()], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `daytrace-backup-${state.date}.json`;
                  a.click();
                }}
                className="w-full py-3 px-4 rounded-2xl bg-[#D1E1FF] hover:bg-white text-[#003062] text-xs font-bold flex items-center justify-center space-x-2 shadow-md transition"
              >
                <Download className="w-4 h-4 text-[#003062]" />
                <span>Export & Save Backup (.json file)</span>
              </button>
            </div>

            {/* Import Section */}
            <div className="p-4 rounded-3xl bg-[#111318] border border-[#86EFAC]/30 space-y-3 shadow-inner">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-xl bg-[#86EFAC]/20 text-[#86EFAC]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#E2E2E6]">Import Backup File</h4>
                  <p className="text-[10px] text-[#C4C6D0]/70">Select your saved .json backup file to restore your app data</p>
                </div>
              </div>

              <input
                type="file"
                id="json-file-input"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const content = event.target?.result as string;
                    if (content) {
                      const success = importDataJSON(content);
                      if (success) {
                        setImportStatus('DayTrace data restored successfully!');
                        setTimeout(() => {
                          setShowSyncModal(false);
                          setImportStatus(null);
                        }, 1200);
                      } else {
                        setImportStatus('Invalid JSON backup file format.');
                      }
                    }
                  };
                  reader.readAsText(file);
                }}
              />

              <button
                onClick={() => document.getElementById('json-file-input')?.click()}
                className="w-full py-3 px-4 rounded-2xl bg-[#86EFAC]/20 hover:bg-[#86EFAC]/30 text-[#86EFAC] text-xs font-bold flex items-center justify-center space-x-2 transition border border-[#86EFAC]/40"
              >
                <CloudDownload className="w-4 h-4 text-[#86EFAC]" />
                <span>Select & Restore (.json File)</span>
              </button>

              {importStatus && (
                <div className={`text-xs font-semibold p-2.5 rounded-xl border ${importStatus.includes('success') ? 'bg-[#86EFAC]/10 border-[#86EFAC]/30 text-[#86EFAC]' : 'bg-[#F87171]/10 border-[#F87171]/30 text-[#F87171]'}`}>
                  {importStatus}
                </div>
              )}

              {/* Text Area Fallback */}
              <div className="pt-2 border-t border-[#44474E]/20 space-y-2">
                <details className="text-[11px] text-[#C4C6D0]">
                  <summary className="cursor-pointer font-semibold text-[#D1E1FF] hover:underline">Or paste JSON string manually</summary>
                  <div className="pt-2 space-y-2">
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="Paste backup JSON string here..."
                      rows={3}
                      className="w-full p-2.5 rounded-xl bg-[#1D2026] border border-[#44474E]/40 text-xs font-mono text-[#E2E2E6] focus:outline-hidden focus:border-[#D1E1FF]"
                    />
                    <button
                      onClick={handleImportSubmit}
                      className="w-full py-2 px-4 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[#D1E1FF] text-xs font-bold transition border border-[#44474E]/40"
                    >
                      Restore from Pasted JSON
                    </button>
                  </div>
                </details>
              </div>
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
