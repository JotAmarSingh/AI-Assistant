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
  Sparkle,
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
  ShieldCheck
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { AppMode, EnergyLevel } from '../../types';
import { isNativeAndroid } from '../../services/nativeBridge';
import { TutorialModal } from './TutorialModal';
import { AndroidTab } from './AndroidNavigationBar';

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
    loadSampleTemplate, 
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
    focusTimer
  } = useDay();

  const [showEnergyMenu, setShowEnergyMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{ success?: boolean; url?: string; error?: string } | null>(null);
  const [restoreSheetInput, setRestoreSheetInput] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const settings = state.userSettings || {};
  const gamification = state.gamification || { points: 120, currentStreakDays: 1 };

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
      <header id="android-top-app-bar" className="w-full bg-[#111318] px-3 py-2 border-b border-[#44474E]/30 flex items-center justify-between z-20">
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

        {/* Right: Quick Action Tools (Rewards Pill, Voice, Pomodoro, Sheets, Reset) */}
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

          {/* Voice Memo Quick Record Button */}
          <button
            id="voice-capture-top-btn"
            onClick={() => setIsVoiceModalOpen(true)}
            className="p-1.5 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[#D1E1FF] transition shadow-xs"
            title="Hands-Free Voice Memo Capture"
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

          {/* Reset / Sample Menu */}
          <button
            id="reset-day-btn"
            onClick={() => setShowResetConfirmModal(true)}
            className="p-1.5 rounded-xl bg-[#2E3036] hover:bg-[#F87171]/20 hover:text-[#F87171] text-[#C4C6D0] transition shadow-xs"
            title="Reset Day / Load Sample"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

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

      {/* Reset & Template Management Modal */}
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
              <h3 className="font-bold text-sm text-[#E2E2E6]">DayTrace State Options</h3>
              <p className="text-xs text-[#C4C6D0] mt-1">
                Choose to start with a completely empty slate or load the demonstration template.
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
                Clear to Fresh Start (0 Tasks)
              </button>

              <button
                onClick={() => {
                  loadSampleTemplate();
                  setShowResetConfirmModal(false);
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#334867] hover:bg-[#445E86] text-[#D1E1FF] text-xs font-bold transition border border-[#D1E1FF]/30 flex items-center justify-center space-x-1.5"
              >
                <Sparkle className="w-3.5 h-3.5" />
                <span>Load Demonstration Template</span>
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

      {/* Sync & Sheets Modal */}
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
                  <FileSpreadsheet className="w-5 h-5 text-[#D1E1FF]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#E2E2E6]">Google Sheets Sync & Backup</h3>
                  <p className="text-[10px] text-[#C4C6D0]/70">Auto-save timeline, tasks & journal</p>
                </div>
              </div>
              <button onClick={() => setShowSyncModal(false)} className="text-[#C4C6D0] hover:text-[#E2E2E6]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* WhatsApp-Style Nightly Automated Sync Setting */}
            <div className="p-4 rounded-3xl bg-[#111318] border border-[#FBBF24]/30 space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-1 rounded-lg bg-[#FBBF24]/20 text-[#FBBF24]">
                    <Moon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#E2E2E6] block">Nightly Auto-Backup</span>
                    <span className="text-[10px] text-[#C4C6D0]/70">WhatsApp-style automatic night sync</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableNightlySync !== false}
                    onChange={(e) => updateUserSettings({ enableNightlySync: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#2E3036] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FBBF24]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#C4C6D0]/80 pt-1 border-t border-[#44474E]/20">
                <span>Backup Schedule</span>
                <select
                  value={settings.nightlySyncHour ?? 2}
                  onChange={(e) => updateUserSettings({ nightlySyncHour: parseInt(e.target.value, 10) })}
                  className="bg-[#1D2026] text-[#D1E1FF] text-xs font-semibold px-2 py-1 rounded-xl border border-[#44474E]/40"
                >
                  <option value={0}>12:00 AM (Midnight)</option>
                  <option value={1}>01:00 AM</option>
                  <option value={2}>02:00 AM (Recommended)</option>
                  <option value={3}>03:00 AM</option>
                  <option value={4}>04:00 AM</option>
                </select>
              </div>

              {settings.lastNightlyBackupAt && (
                <div className="text-[10px] text-[#86EFAC] font-mono flex items-center pt-0.5">
                  <CheckCircle2 className="w-3 h-3 mr-1 shrink-0" />
                  <span>Last night sync: {new Date(settings.lastNightlyBackupAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Direct 1-Click Google Sheets Integration Section */}
            <div className="p-4 rounded-3xl bg-[#111318] border border-[#D1E1FF]/30 space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Table className="w-4 h-4 text-[#D1E1FF]" />
                  <span className="text-xs font-bold text-[#E2E2E6]">Live Google Spreadsheet</span>
                </div>
                {settings.lastSyncedAt && (
                  <span className="text-[10px] text-[#86EFAC] font-mono flex items-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Synced at {settings.lastSyncedAt}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-[#C4C6D0]/80 leading-relaxed">
                Appends daily summary, timeline entries, task board, reminders, and full JSON snapshot to Google Sheets.
              </p>

              {/* Connected Spreadsheet Link */}
              {settings.googleSpreadsheetUrl && (
                <div className="p-2.5 rounded-2xl bg-[#1D2026] border border-[#44474E]/40 flex items-center justify-between">
                  <div className="truncate mr-2">
                    <span className="text-[10px] text-[#C4C6D0]/60 block">Connected Sheet</span>
                    <span className="text-xs font-semibold text-[#D1E1FF] truncate block">
                      {settings.googleSpreadsheetTitle || 'DayTrace Journal'}
                    </span>
                  </div>
                  <a
                    href={settings.googleSpreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-3 rounded-xl bg-[#334867] hover:bg-[#445E86] text-[#D1E1FF] text-[11px] font-bold flex items-center space-x-1 shrink-0 transition"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Manual Sync Button */}
              <button
                id="one-click-sync-sheets-btn"
                onClick={handleTriggerSync}
                disabled={isSyncingSheets}
                className="w-full py-3 px-4 rounded-2xl bg-[#D1E1FF] hover:bg-[#B6D4FE] text-[#003062] text-xs font-bold flex items-center justify-center space-x-2 shadow-md transition disabled:opacity-50"
              >
                {isSyncingSheets ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#003062]" />
                    <span>Syncing & Backing Up to Google Sheets...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4 text-[#003062]" />
                    <span>Sync & Backup Current State to Google Sheets</span>
                  </>
                )}
              </button>

              {syncFeedback?.error && (
                <div className="text-[11px] text-[#F87171] font-semibold bg-[#7F1D1D]/20 p-2 rounded-xl border border-[#F87171]/30">
                  {syncFeedback.error}
                </div>
              )}
            </div>

            {/* Cloud Restore (For Clean Installs or New Phone) */}
            <div className="p-4 rounded-3xl bg-[#111318] border border-[#86EFAC]/30 space-y-3 shadow-inner">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-xl bg-[#86EFAC]/20 text-[#86EFAC]">
                  <CloudDownload className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#E2E2E6]">Restore from Google Sheets</h4>
                  <p className="text-[10px] text-[#C4C6D0]/70">For new device or clean reinstall (Restores tasks, history, habits & AI learnings)</p>
                </div>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={restoreSheetInput}
                  onChange={(e) => setRestoreSheetInput(e.target.value)}
                  placeholder={settings.googleSpreadsheetId ? `Current ID: ${settings.googleSpreadsheetId.slice(0, 16)}...` : "Paste existing Spreadsheet ID or leave blank to use connected sheet"}
                  className="w-full p-2.5 rounded-xl bg-[#1D2026] border border-[#44474E]/40 text-xs font-mono text-[#E2E2E6] placeholder:text-[#C4C6D0]/40 focus:outline-hidden focus:border-[#86EFAC]"
                />

                <button
                  id="restore-sheets-btn"
                  onClick={handleRestoreFromSheets}
                  disabled={isRestoringBackup}
                  className="w-full py-2.5 px-4 rounded-2xl bg-[#86EFAC]/20 hover:bg-[#86EFAC]/30 text-[#86EFAC] text-xs font-bold flex items-center justify-center space-x-2 transition border border-[#86EFAC]/40 disabled:opacity-50"
                >
                  {isRestoringBackup ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#86EFAC]" />
                      <span>Fetching & Restoring Full State...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-[#86EFAC]" />
                      <span>Restore All Data & Learnings from Google Sheets</span>
                    </>
                  )}
                </button>

                {restoreStatus && (
                  <div className={`text-xs font-semibold p-2 rounded-xl border ${restoreStatus.success ? 'bg-[#86EFAC]/10 border-[#86EFAC]/30 text-[#86EFAC]' : 'bg-[#F87171]/10 border-[#F87171]/30 text-[#F87171]'}`}>
                    {restoreStatus.message || (restoreStatus.success ? 'Restoration complete!' : 'Failed to restore')}
                  </div>
                )}
              </div>
            </div>

            {/* Google Sheets CSV Tables Copy Fallback */}
            <div className="space-y-2 pt-1">
              <h4 className="text-xs font-bold text-[#D1E1FF] uppercase tracking-wider">Quick CSV Copy Tables</h4>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                {Object.entries(sheetsData).map(([tabName, csvContent]) => (
                  <button
                    key={tabName}
                    onClick={() => handleCopySheetsTab(tabName, String(csvContent))}
                    className="p-2.5 rounded-2xl bg-[#2E3036] hover:bg-[#334867] border border-[#44474E]/40 text-left transition flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-xs text-[#E2E2E6]">{tabName}</div>
                      <div className="text-[10px] text-[#C4C6D0]/60">Copy CSV</div>
                    </div>
                    {copiedTab === tabName ? (
                      <Check className="w-4 h-4 text-[#86EFAC]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#D1E1FF]" />
                    )}
                  </button>
                ))}
              </div>
            </div>



            {/* JSON Download Backup */}
            <div className="space-y-2 pt-2 border-t border-[#44474E]/30">
              <h4 className="text-xs font-bold text-[#D1E1FF] uppercase tracking-wider">JSON Full State Backup</h4>
              <button
                onClick={() => {
                  const blob = new Blob([exportDataJSON()], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `daytrace-backup-${state.date}.json`;
                  a.click();
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#334867] hover:bg-[#445E86] text-[#D1E1FF] text-xs font-bold flex items-center justify-center space-x-2 transition border border-[#D1E1FF]/30"
              >
                <Download className="w-4 h-4" />
                <span>Download DayTrace State (.json)</span>
              </button>
            </div>

            {/* Restore from JSON */}
            <div className="space-y-2 pt-2 border-t border-[#44474E]/30">
              <h4 className="text-xs font-bold text-[#D1E1FF] uppercase tracking-wider">Restore State from JSON</h4>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste backup JSON string here to restore..."
                rows={2}
                className="w-full p-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs font-mono text-[#E2E2E6] focus:outline-hidden focus:border-[#D1E1FF]"
              />
              {importStatus && (
                <div className={`text-xs font-semibold ${importStatus.includes('success') ? 'text-[#86EFAC]' : 'text-[#F87171]'}`}>
                  {importStatus}
                </div>
              )}
              <button
                onClick={handleImportSubmit}
                className="w-full py-2 px-4 rounded-2xl bg-[#2E3036] hover:bg-[#334867] text-[#D1E1FF] text-xs font-bold transition border border-[#44474E]/40"
              >
                Restore from JSON
              </button>
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
