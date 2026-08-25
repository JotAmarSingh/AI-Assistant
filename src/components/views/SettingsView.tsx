import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Gamepad2,
  MapPin,
  Mic2,
  RefreshCw,
  Settings,
  ShieldCheck,
  Smartphone,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import {
  DeviceCapabilityContext,
  NativeNotificationPermissionStatus,
  checkNativeNotificationPermission,
  exportNativeJsonBackup,
  getDeviceCapabilityContext,
  isNativeAndroid,
  openNativeAppSettings,
  openNativeExactAlarmSettings,
  openNativeNotificationSettings,
  requestNativeGeofencePermissions,
  requestNativeMicrophonePermission,
  requestNativeNotificationPermission,
} from '../../services/nativeBridge';

interface SettingsViewProps {
  onClose: () => void;
}

const permissionLabel = (status?: string) => {
  if (!status) return 'Checking…';
  if (status === 'GRANTED') return 'Allowed';
  if (status === 'NOT_REQUESTED') return 'Not requested';
  if (status.startsWith('NOT_AVAILABLE')) return 'Unavailable here';
  return 'Needs attention';
};

export const SettingsView: React.FC<SettingsViewProps> = ({ onClose }) => {
  const {
    state,
    updateUserSettings,
    snoozePrompts,
    exportDataJSON,
    importDataJSON,
    resetToFreshStart,
    setIsGeofenceModalOpen,
  } = useDay();
  const settings = state.userSettings;
  const [capabilities, setCapabilities] = useState<DeviceCapabilityContext | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NativeNotificationPermissionStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const refreshPermissions = useCallback(async () => {
    const [nextCapabilities, nextNotifications] = await Promise.all([
      getDeviceCapabilityContext(),
      checkNativeNotificationPermission(),
    ]);
    setCapabilities(nextCapabilities);
    setNotificationPermission(nextNotifications);
  }, []);

  useEffect(() => {
    void refreshPermissions();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshPermissions();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshPermissions);
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshPermissions);
    };
  }, [refreshPermissions]);

  const currentDataSummary = useMemo(() => ({
    tasks: state.tasks.length,
    reminders: state.reminders.length,
    timeline: state.timeline.length,
    places: (state.geofenceLocations || []).length,
    memories: (state.memories || []).length,
    meetings: (state.meetings || []).length,
  }), [state]);
  const hasCurrentData = currentDataSummary.tasks + currentDataSummary.reminders + currentDataSummary.timeline
    + currentDataSummary.places + currentDataSummary.memories + currentDataSummary.meetings > 0;

  const completeImport = (jsonText: string) => {
    const success = importDataJSON(jsonText);
    setPendingImport(null);
    setStatusMessage(success
      ? 'Backup merged successfully. Current tasks, reminders, timeline entries and saved places were kept.'
      : 'That file is not a valid DayTrace JSON backup. No current data was changed.');
  };

  const queueImport = (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || !Array.isArray(parsed.tasks)) throw new Error('Invalid DayTrace backup');
    } catch {
      setStatusMessage('That file is not a valid DayTrace JSON backup. No current data was changed.');
      return;
    }
    if (hasCurrentData) setPendingImport(jsonText);
    else completeImport(jsonText);
  };

  const permissionRows = [
    { key: 'notifications', label: 'Notifications', icon: BellRing },
    { key: 'exactAlarms', label: 'Exact reminder timing', icon: Clock3 },
    { key: 'microphone', label: 'Microphone', icon: Mic2 },
    { key: 'location', label: 'Location', icon: MapPin },
    { key: 'backgroundLocation', label: 'Background location', icon: Smartphone },
  ] as const;

  return (
    <div id="settings-view" className="flex-1 h-full overflow-y-auto bg-[#111318] text-[#E2E2E6] p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-2xl bg-[#334867] text-[#D1E1FF]"><Settings className="w-5 h-5" /></div>
          <div>
            <h2 className="font-bold text-base">Settings</h2>
            <p className="text-[11px] text-[#C4C6D0]">Device permissions, personal times and local data</p>
          </div>
        </div>
        <button id="settings-back-btn" type="button" onClick={onClose} className="px-3 py-2 rounded-2xl bg-[#2E3036] text-xs font-semibold flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Today
        </button>
      </div>

      <section id="permission-settings" className="bg-[#1D2026] border border-[#44474E]/40 rounded-[30px] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider">Permission Settings</h3>
            <p className="text-[10px] text-[#C4C6D0] mt-0.5">DayTrace only sends a permission status to AI when it is relevant to your request.</p>
          </div>
          <button type="button" onClick={() => void refreshPermissions()} className="p-2 rounded-xl bg-[#2E3036] text-[#D1E1FF]" title="Refresh permissions">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          {permissionRows.map(({ key, label, icon: Icon }) => {
            const rawStatus = key === 'notifications' && notificationPermission
              ? notificationPermission.status
              : capabilities?.permissions[key];
            const granted = rawStatus === 'GRANTED';
            return (
              <div key={key} className="p-2.5 rounded-2xl bg-[#111318] border border-[#44474E]/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${granted ? 'text-[#86EFAC]' : 'text-[#FCA5A5]'}`} />
                  <div>
                    <span className="text-xs font-semibold block">{label}</span>
                    <span className={`text-[10px] ${granted ? 'text-[#86EFAC]' : 'text-[#FCA5A5]'}`}>{permissionLabel(rawStatus)}</span>
                  </div>
                </div>
                {!granted && isNativeAndroid() && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (key === 'notifications' && notificationPermission?.status === 'NOT_REQUESTED') await requestNativeNotificationPermission();
                      else if (key === 'notifications') await openNativeNotificationSettings();
                      else if (key === 'exactAlarms') await openNativeExactAlarmSettings();
                      else if (key === 'location' || key === 'backgroundLocation') await requestNativeGeofencePermissions();
                      else if (key === 'microphone') await requestNativeMicrophonePermission();
                      else await openNativeAppSettings();
                      await refreshPermissions();
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-[#334867] text-[#D1E1FF] text-[10px] font-bold"
                  >
                    Allow / Open
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setIsGeofenceModalOpen(true)} className="w-full py-2.5 rounded-2xl bg-[#2E3036] text-[#D1E1FF] text-xs font-semibold flex items-center justify-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" /> Manage Saved Places ({(state.geofenceLocations || []).length})
        </button>
      </section>

      <section id="saved-times-settings" className="bg-[#1D2026] border border-[#44474E]/40 rounded-[30px] p-4 space-y-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider">Saved Times</h3>
          <p className="text-[10px] text-[#C4C6D0] mt-0.5">Used to place reminders and pause accountability checks at the right time.</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {([
            ['officeStartTime', 'Office Start'],
            ['officeLeavingTime', 'Office Leaving'],
            ['wakeUpTime', 'Wake Time'],
            ['bedTime', 'Bed / Sleep Time'],
          ] as const).map(([key, label]) => (
            <label key={key} className="p-3 rounded-2xl bg-[#111318] border border-[#44474E]/30">
              <span className="text-[10px] font-bold uppercase text-[#D1E1FF] block mb-1">{label}</span>
              <input type="time" value={settings[key]} onChange={(event) => updateUserSettings({ [key]: event.target.value })} className="w-full bg-transparent text-sm font-mono font-bold focus:outline-none" />
            </label>
          ))}
        </div>
      </section>

      <section id="check-in-prompt-settings" className="bg-[#1D2026] border border-[#44474E]/40 rounded-[30px] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider">Check-In Prompt Frequency</h3>
            <p className="text-[10px] text-[#C4C6D0] mt-0.5">Interactive accountability prompts on the lock screen.</p>
          </div>
          <button type="button" aria-label="Toggle check-in prompts" onClick={() => updateUserSettings({ periodicPromptEnabled: !settings.periodicPromptEnabled })} className={`w-11 h-6 flex items-center rounded-full p-1 ${settings.periodicPromptEnabled ? 'bg-[#D1E1FF] justify-end' : 'bg-[#2E3036] justify-start'}`}>
            <span className={`w-4 h-4 rounded-full ${settings.periodicPromptEnabled ? 'bg-[#003062]' : 'bg-[#C4C6D0]'}`} />
          </button>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {[15, 30, 45, 60, 90, 120].map((minutes) => (
            <button key={minutes} type="button" onClick={() => updateUserSettings({ periodicPromptIntervalMinutes: minutes })} className={`py-2 rounded-xl text-[10px] font-bold ${(settings.periodicPromptIntervalMinutes || 30) === minutes ? 'bg-[#D1E1FF] text-[#003062]' : 'bg-[#2E3036] text-[#C4C6D0]'}`}>
              {minutes}m
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#C4C6D0]">Pause prompts:</span>
          {[30, 60, 120].map((minutes) => <button key={minutes} type="button" onClick={() => snoozePrompts(minutes)} className="px-2 py-1 rounded-xl bg-[#2E3036] text-[10px]">{minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}</button>)}
        </div>
      </section>

      <section id="behavior-settings" className="bg-[#1D2026] border border-[#44474E]/40 rounded-[30px] p-4 space-y-2">
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#111318] border border-[#44474E]/30">
          <div className="flex items-center gap-2"><Gamepad2 className={`w-4 h-4 ${settings.gamingModeActive ? 'text-[#FDE047]' : 'text-[#C4C6D0]'}`} /><div><span className="text-xs font-semibold block">Gaming Mode</span><span className="text-[10px] text-[#C4C6D0]">Suppress accountability prompts while playing.</span></div></div>
          <button type="button" aria-label="Toggle gaming mode" onClick={() => updateUserSettings({ gamingModeActive: !settings.gamingModeActive })} className={`w-11 h-6 flex items-center rounded-full p-1 ${settings.gamingModeActive ? 'bg-[#FDE047] justify-end' : 'bg-[#2E3036] justify-start'}`}><span className="w-4 h-4 rounded-full bg-[#111318]" /></button>
        </div>
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#111318] border border-[#44474E]/30">
          <div className="flex items-center gap-2">{settings.alarmSoundEnabled ? <Volume2 className="w-4 h-4 text-[#D1E1FF]" /> : <VolumeX className="w-4 h-4 text-[#C4C6D0]" />}<div><span className="text-xs font-semibold block">Alarm Audio Ringtone</span><span className="text-[10px] text-[#C4C6D0]">Play audio with reminder alarms.</span></div></div>
          <button type="button" aria-label="Toggle alarm audio" onClick={() => updateUserSettings({ alarmSoundEnabled: !settings.alarmSoundEnabled })} className={`w-11 h-6 flex items-center rounded-full p-1 ${settings.alarmSoundEnabled ? 'bg-[#D1E1FF] justify-end' : 'bg-[#2E3036] justify-start'}`}><span className="w-4 h-4 rounded-full bg-[#111318]" /></button>
        </div>
      </section>

      <section id="data-backup-settings" className="bg-[#1D2026] border border-[#D1E1FF]/30 rounded-[30px] p-4 space-y-3">
        <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#D1E1FF]" /><div><h3 className="text-xs font-bold uppercase tracking-wider">Data Backup & Restore</h3><p className="text-[10px] text-[#C4C6D0]">Includes tasks, reminders, timeline, memories, meetings and saved location tags.</p></div></div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={async () => {
            const result = await exportNativeJsonBackup(exportDataJSON(), 'daytrace-backup.json');
            setStatusMessage(result.success ? `Backup updated: ${result.path || 'daytrace-backup.json'}` : 'Backup export failed. No data was changed.');
          }} className="py-2.5 rounded-2xl bg-[#D1E1FF] text-[#003062] text-xs font-bold flex items-center justify-center gap-1.5"><Download className="w-3.5 h-3.5" /> Update Backup</button>
          <button type="button" onClick={() => document.getElementById('settings-json-input')?.click()} className="py-2.5 rounded-2xl bg-[#86EFAC]/20 text-[#86EFAC] border border-[#86EFAC]/30 text-xs font-bold flex items-center justify-center gap-1.5"><Upload className="w-3.5 h-3.5" /> Import & Merge</button>
        </div>
        <input id="settings-json-input" type="file" accept=".json,application/json" className="hidden" onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === 'string' && queueImport(reader.result);
          reader.readAsText(file);
        }} />
        <button type="button" onClick={() => { void navigator.clipboard.writeText(exportDataJSON()); setStatusMessage('Backup JSON copied to the clipboard.'); }} className="w-full py-2 rounded-2xl bg-[#2E3036] text-xs font-semibold flex items-center justify-center gap-1.5"><Copy className="w-3.5 h-3.5" /> Copy JSON</button>
        {statusMessage && <div className="p-2.5 rounded-2xl bg-[#111318] border border-[#44474E]/30 text-[11px] text-[#D1E1FF] flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />{statusMessage}</div>}
      </section>

      <section id="fresh-start-settings" className="bg-[#1D2026] border border-[#F87171]/20 rounded-[30px] p-4">
        <button type="button" onClick={() => setShowResetConfirm(true)} className="w-full py-2.5 rounded-2xl bg-[#F87171]/10 text-[#FCA5A5] border border-[#F87171]/20 text-xs font-bold flex items-center justify-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Delete All Data & Start Fresh</button>
      </section>

      {pendingImport && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={() => setPendingImport(null)}>
          <div className="w-full max-w-sm bg-[#1D2026] border border-[#D1E1FF]/30 rounded-[30px] p-5 space-y-4" onClick={(event) => event.stopPropagation()}>
            <div><h3 className="text-sm font-bold">Current data found</h3><p className="text-xs text-[#C4C6D0] mt-1">You currently have {currentDataSummary.tasks} tasks, {currentDataSummary.reminders} reminders, {currentDataSummary.timeline} timeline entries and {currentDataSummary.places} saved places. Import will merge the backup and keep these current records.</p></div>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setPendingImport(null)} className="py-2.5 rounded-2xl bg-[#2E3036] text-xs font-semibold">Cancel</button><button type="button" onClick={() => completeImport(pendingImport)} className="py-2.5 rounded-2xl bg-[#D1E1FF] text-[#003062] text-xs font-bold">Merge Backup</button></div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={() => setShowResetConfirm(false)}>
          <div className="w-full max-w-sm bg-[#1D2026] border border-[#F87171]/30 rounded-[30px] p-5 space-y-4" onClick={(event) => event.stopPropagation()}>
            <div><h3 className="text-sm font-bold">Delete all DayTrace data?</h3><p className="text-xs text-[#C4C6D0] mt-1">Tasks, reminders, timeline, saved places, memories, meetings and settings will be removed from this device. Export a backup first if needed.</p></div>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setShowResetConfirm(false)} className="py-2.5 rounded-2xl bg-[#2E3036] text-xs font-semibold">Cancel</button><button type="button" onClick={() => { resetToFreshStart(); setShowResetConfirm(false); onClose(); }} className="py-2.5 rounded-2xl bg-[#F87171]/20 text-[#FCA5A5] text-xs font-bold">Delete Everything</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
