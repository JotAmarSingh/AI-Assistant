import React, { useState } from 'react';
import { 
  Calendar, 
  Bell, 
  Plus, 
  MapPin, 
  CheckCircle2, 
  Trash2, 
  Zap, 
  Clock, 
  Shield, 
  Gamepad2, 
  Volume2, 
  Sparkles, 
  VolumeX,
  FileSpreadsheet,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { ReminderType } from '../../types';

export const RemindersAnchorsView: React.FC = () => {
  const { 
    state, 
    addFixedEvent, 
    deleteFixedEvent, 
    addReminder, 
    deleteReminder, 
    toggleReminder, 
    updateTaskStatus,
    updateUserSettings,
    snoozePrompts,
    triggerManualPromptCheck,
    syncToGoogleSheets,
    isSyncingSheets,
    markAutomationComplete,
    deleteAutomation,
    snoozeAutomation,
  } = useDay();
  const [isAddAnchorModalOpen, setIsAddAnchorModalOpen] = useState(false);
  const [isAddReminderModalOpen, setIsAddReminderModalOpen] = useState(false);

  const settings = state.userSettings || {
    officeStartTime: '09:30',
    officeLeavingTime: '18:30',
    wakeUpTime: '07:00',
    bedTime: '23:30',
    periodicPromptEnabled: true,
    periodicPromptIntervalMinutes: 30,
    gamingModeActive: false,
    snoozedUntil: null,
    alarmSoundEnabled: true,
  };

  // New Anchor Form
  const [anchorTime, setAnchorTime] = useState('11:30');
  const [anchorEndTime, setAnchorEndTime] = useState('12:30');
  const [anchorTitle, setAnchorTitle] = useState('');
  const [anchorLocation, setAnchorLocation] = useState('Office');
  const [anchorNotes, setAnchorNotes] = useState('');

  // New Reminder Form
  const [reminderType, setReminderType] = useState<ReminderType>('TIME_BASED');
  const [reminderCondition, setReminderCondition] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');

  const handleCreateAnchor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!anchorTitle.trim()) return;

    addFixedEvent({
      time: anchorTime,
      endTime: anchorEndTime || undefined,
      title: anchorTitle.trim(),
      location: anchorLocation.trim() || undefined,
      notes: anchorNotes.trim() || undefined,
      category: 'OFFICE',
    });

    setAnchorTitle('');
    setAnchorNotes('');
    setIsAddAnchorModalOpen(false);
  };

  const handleCreateReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderMessage.trim()) return;

    addReminder({
      type: reminderType,
      triggerCondition: reminderCondition.trim() || (reminderType === 'TIME_BASED' ? settings.officeLeavingTime : 'Trigger condition'),
      message: reminderMessage.trim(),
    });

    setReminderMessage('');
    setReminderCondition('');
    setIsAddReminderModalOpen(false);
  };

  return (
    <div id="reminders-anchors-view" className="flex-1 flex flex-col h-full bg-[#111318] text-[#E2E2E6] overflow-hidden relative">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* Section 0: Office Hours & 30-Min Accountability Settings */}
        <section className="bg-[#1D2026] border border-[#D1E1FF]/30 rounded-[32px] p-4 shadow-lg space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-xl bg-[#334867] text-[#D1E1FF]">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#E2E2E6]">
                  Schedule & Accountability Settings
                </h3>
                <span className="text-[10px] text-[#C4C6D0]/70">Office hours & 30-min dialog triggers</span>
              </div>
            </div>

            <button
              onClick={triggerManualPromptCheck}
              className="py-1 px-2.5 rounded-xl bg-[#334867] hover:bg-[#D1E1FF] hover:text-[#003062] text-[#D1E1FF] text-[11px] font-semibold flex items-center space-x-1 transition shadow-sm"
              title="Test the 30-minute accountability dialogue"
            >
              <Sparkles className="w-3 h-3" />
              <span>Test Dialog</span>
            </button>
          </div>

          {/* Office Departure & Sleep Times */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="p-2.5 rounded-2xl bg-[#111318] border border-[#44474E]/40 space-y-1">
              <label className="block text-[10px] font-bold text-[#D1E1FF] uppercase">Office Leaving Time</label>
              <div className="flex items-center space-x-1.5">
                <input
                  type="time"
                  value={settings.officeLeavingTime}
                  onChange={(e) => updateUserSettings({ officeLeavingTime: e.target.value })}
                  className="w-full bg-transparent text-xs font-mono font-bold text-[#E2E2E6] focus:outline-none"
                />
              </div>
              <span className="text-[9px] text-[#C4C6D0]/60 block leading-tight">
                Alarms for "evening after office" auto-set to this time
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-[#111318] border border-[#44474E]/40 space-y-1">
              <label className="block text-[10px] font-bold text-[#D1E1FF] uppercase">Bed Time (Sleep)</label>
              <div className="flex items-center space-x-1.5">
                <input
                  type="time"
                  value={settings.bedTime}
                  onChange={(e) => updateUserSettings({ bedTime: e.target.value })}
                  className="w-full bg-transparent text-xs font-mono font-bold text-[#E2E2E6] focus:outline-none"
                />
              </div>
              <span className="text-[9px] text-[#C4C6D0]/60 block leading-tight">
                30-min checks pause automatically while you sleep
              </span>
            </div>
          </div>

          {/* Toggles: Periodic Prompt & Gaming Mode */}
          <div className="space-y-2 pt-1 border-t border-[#44474E]/30">
            {/* 30-Min Dialog Toggle */}
            <div className="flex items-center justify-between p-2 rounded-2xl bg-[#111318] border border-[#44474E]/30">
              <div className="flex items-center space-x-2">
                <Sparkles className={`w-4 h-4 ${settings.periodicPromptEnabled ? 'text-[#D1E1FF]' : 'text-[#C4C6D0]/40'}`} />
                <div>
                  <span className="text-xs font-semibold text-[#E2E2E6] block">30-Minute Task Prompt</span>
                  <span className="text-[10px] text-[#C4C6D0]/60 block">Pops dialogue asking current task until sleep</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateUserSettings({ periodicPromptEnabled: !settings.periodicPromptEnabled })}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                  settings.periodicPromptEnabled ? 'bg-[#D1E1FF] justify-end' : 'bg-[#2E3036] justify-start'
                }`}
              >
                <div className={`w-4 h-4 rounded-full shadow-md ${settings.periodicPromptEnabled ? 'bg-[#003062]' : 'bg-[#C4C6D0]'}`} />
              </button>
            </div>

            {/* Gaming Mode Toggle */}
            <div className="flex items-center justify-between p-2 rounded-2xl bg-[#111318] border border-[#44474E]/30">
              <div className="flex items-center space-x-2">
                <Gamepad2 className={`w-4 h-4 ${settings.gamingModeActive ? 'text-[#FDE047]' : 'text-[#C4C6D0]/40'}`} />
                <div>
                  <span className="text-xs font-semibold text-[#E2E2E6] block">Gaming Mode</span>
                  <span className="text-[10px] text-[#C4C6D0]/60 block">Completely suppresses all prompts while playing</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateUserSettings({ gamingModeActive: !settings.gamingModeActive })}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                  settings.gamingModeActive ? 'bg-[#FDE047] justify-end' : 'bg-[#2E3036] justify-start'
                }`}
              >
                <div className={`w-4 h-4 rounded-full shadow-md ${settings.gamingModeActive ? 'bg-[#422006]' : 'bg-[#C4C6D0]'}`} />
              </button>
            </div>

            {/* Alarm Ringtone Sound Toggle */}
            <div className="flex items-center justify-between p-2 rounded-2xl bg-[#111318] border border-[#44474E]/30">
              <div className="flex items-center space-x-2">
                {settings.alarmSoundEnabled ? (
                  <Volume2 className="w-4 h-4 text-[#D1E1FF]" />
                ) : (
                  <VolumeX className="w-4 h-4 text-[#C4C6D0]/40" />
                )}
                <div>
                  <span className="text-xs font-semibold text-[#E2E2E6] block">Alarm Audio Ringtone</span>
                  <span className="text-[10px] text-[#C4C6D0]/60 block">Synthesized audible alarm on trigger time</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateUserSettings({ alarmSoundEnabled: !settings.alarmSoundEnabled })}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                  settings.alarmSoundEnabled ? 'bg-[#D1E1FF] justify-end' : 'bg-[#2E3036] justify-start'
                }`}
              >
                <div className={`w-4 h-4 rounded-full shadow-md ${settings.alarmSoundEnabled ? 'bg-[#003062]' : 'bg-[#C4C6D0]'}`} />
              </button>
            </div>

            {/* Google Sheets Cloud Auto-Sync Section */}
            <div className="p-3 rounded-2xl bg-[#111318] border border-[#44474E]/30 space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#D1E1FF]" />
                  <div>
                    <span className="text-xs font-semibold text-[#E2E2E6] block">Google Sheets Backup</span>
                    <span className="text-[10px] text-[#C4C6D0]/60 block">
                      {settings.lastSyncedAt ? `Last synced: ${settings.lastSyncedAt}` : 'Not synced yet today'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => syncToGoogleSheets()}
                  disabled={isSyncingSheets}
                  className="py-1.5 px-3 rounded-xl bg-[#334867] hover:bg-[#445E86] text-[#D1E1FF] text-xs font-bold flex items-center space-x-1.5 transition disabled:opacity-50"
                >
                  {isSyncingSheets ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D1E1FF]" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#D1E1FF]" />
                  )}
                  <span>{isSyncingSheets ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              </div>

              {settings.googleSpreadsheetUrl && (
                <div className="flex items-center justify-between pt-1 border-t border-[#44474E]/20 text-[10px]">
                  <span className="text-[#86EFAC] font-mono flex items-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Sheet linked
                  </span>
                  <a
                    href={settings.googleSpreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#D1E1FF] underline font-semibold flex items-center space-x-1"
                  >
                    <span>View Spreadsheet</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Temporary Snooze Quick Buttons */}
            <div className="flex items-center space-x-1.5 pt-1">
              <span className="text-[10px] text-[#C4C6D0]/70 font-semibold mr-1">Quick Pause:</span>
              <button
                type="button"
                onClick={() => snoozePrompts(30)}
                className="py-1 px-2 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[10px] font-semibold text-[#C4C6D0] hover:text-[#E2E2E6] transition"
              >
                30 min
              </button>
              <button
                type="button"
                onClick={() => snoozePrompts(60)}
                className="py-1 px-2 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[10px] font-semibold text-[#C4C6D0] hover:text-[#E2E2E6] transition"
              >
                1 hr
              </button>
              <button
                type="button"
                onClick={() => snoozePrompts(120)}
                className="py-1 px-2 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[10px] font-semibold text-[#C4C6D0] hover:text-[#E2E2E6] transition"
              >
                2 hrs
              </button>
            </div>
          </div>
        </section>

        {/* Section 1: Fixed-Time Planning Anchors */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-xl bg-[#334867] text-[#D1E1FF]">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#E2E2E6]">
                Fixed-Time Planning Anchors
              </h3>
            </div>

            <button
              onClick={() => setIsAddAnchorModalOpen(true)}
              className="py-1.5 px-3 rounded-2xl bg-[#D1E1FF] hover:bg-white text-[#003062] text-xs font-bold flex items-center space-x-1.5 transition shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Anchor</span>
            </button>
          </div>

          <p className="text-[11px] text-[#C4C6D0]/70 leading-relaxed">
            Meetings, appointments, and fixed deadlines serve as structural anchors. The AI plans deep-work windows around these fixed points.
          </p>

          {state.fixedEvents.length === 0 ? (
            <div className="p-4 rounded-[24px] bg-[#1D2026] border border-[#44474E]/40 text-center text-xs text-[#C4C6D0]/60">
              No fixed anchor events today. Add a meeting or appointment to structure your work windows.
            </div>
          ) : (
            <div className="space-y-2.5">
              {state.fixedEvents.map((anchor) => (
                <div
                  key={anchor.id}
                  className="bg-[#1D2026] border border-[#44474E]/40 rounded-[28px] p-4 shadow-md flex items-center justify-between transition hover:border-[#D1E1FF]/40"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-[#D1E1FF] px-2.5 py-0.5 rounded-full bg-[#334867] border border-[#D1E1FF]/30">
                        {anchor.time} {anchor.endTime ? `- ${anchor.endTime}` : ''}
                      </span>
                      <h4 className="text-sm font-bold text-[#E2E2E6]">{anchor.title}</h4>
                    </div>

                    <div className="flex items-center space-x-3 text-[11px] text-[#C4C6D0]">
                      {anchor.location && (
                        <span className="flex items-center">
                          <MapPin className="w-3 h-3 mr-1 text-[#D1E1FF]" />
                          {anchor.location}
                        </span>
                      )}
                      {anchor.notes && <span>• {anchor.notes}</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteFixedEvent(anchor.id)}
                    className="p-2 text-[#C4C6D0] hover:text-[#F87171] hover:bg-[#2E3036] rounded-xl transition"
                    title="Delete anchor"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 1.5: Voice Automations & Geofence Triggers */}
        <section className="space-y-3 pt-3 border-t border-[#44474E]/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-xl bg-[#334867] text-[#D1E1FF]">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#E2E2E6]">
                Voice Automations & Triggers
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[#D1E1FF] px-2 py-0.5 rounded-full bg-[#111318] border border-[#44474E]/40">
              {(state.automations || []).filter((a) => a.status === 'PENDING').length} active
            </span>
          </div>

          <p className="text-[11px] text-[#C4C6D0]/70 leading-relaxed">
            Automations created via speech ("Remind me when leaving office..."). Handled automatically by Android geofences & alarms.
          </p>

          {(!state.automations || state.automations.length === 0) ? (
            <div className="p-4 rounded-[24px] bg-[#1D2026] border border-[#44474E]/40 text-center text-xs text-[#C4C6D0]/60">
              No voice automations active. Speak a trigger (e.g. <span className="text-[#D1E1FF]">"Remind me when I leave office to get medicines"</span>) to create one.
            </div>
          ) : (
            <div className="space-y-2.5">
              {state.automations.map((auto) => {
                const isPending = auto.status === 'PENDING';
                const isCompleted = auto.status === 'COMPLETED';
                const isSnoozed = auto.status === 'SNOOZED';
                const triggerBadge =
                  auto.triggerType === 'GEOFENCE_EXIT'
                    ? `Exit ${auto.locationName || 'Location'}`
                    : auto.triggerType === 'GEOFENCE_ENTER'
                    ? `Arrive at ${auto.locationName || 'Location'}`
                    : `Time ${auto.scheduledTime || ''}`;

                return (
                  <div
                    key={auto.id}
                    className={`bg-[#1D2026] border rounded-[28px] p-4 shadow-md space-y-2.5 transition ${
                      isCompleted
                        ? 'border-[#44474E]/30 opacity-60 bg-[#1A1C1E]'
                        : 'border-[#D1E1FF]/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#334867] text-[#D1E1FF] border border-[#D1E1FF]/20">
                            {triggerBadge}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isPending
                                ? 'bg-[#334867]/40 text-[#D1E1FF]'
                                : isCompleted
                                ? 'bg-[#86EFAC]/20 text-[#86EFAC]'
                                : isSnoozed
                                ? 'bg-[#FDE047]/20 text-[#FDE047]'
                                : 'bg-[#D1E1FF]/20 text-[#D1E1FF]'
                            }`}
                          >
                            {auto.status}
                          </span>
                        </div>
                        <h4 className={`text-xs font-bold text-[#E2E2E6] ${isCompleted ? 'line-through text-[#C4C6D0]/50' : ''}`}>
                          {auto.title}
                        </h4>
                        {auto.reminderText && (
                          <div className="text-[11px] text-[#C4C6D0]">
                            Reminder: <span className="text-[#D1E1FF]">{auto.reminderText}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => deleteAutomation(auto.id)}
                        className="p-1.5 text-[#C4C6D0] hover:text-[#F87171] hover:bg-[#2E3036] rounded-xl transition"
                        title="Delete automation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {!isCompleted && (
                      <div className="flex items-center space-x-2 pt-1 border-t border-[#44474E]/20">
                        <button
                          type="button"
                          onClick={() => markAutomationComplete(auto.id)}
                          className="py-1 px-2.5 rounded-xl bg-[#D1E1FF] text-[#003062] hover:bg-white text-[10px] font-bold flex items-center space-x-1 transition shadow-sm"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Done</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => snoozeAutomation(auto.id, 10)}
                          className="py-1 px-2.5 rounded-xl bg-[#2E3036] text-[#C4C6D0] hover:text-[#E2E2E6] text-[10px] font-semibold flex items-center space-x-1 transition"
                        >
                          <span>Snooze (10m)</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 2: Reminders Engine */}
        <section className="space-y-3 pt-3 border-t border-[#44474E]/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-xl bg-[#2E3036] text-[#FDE047]">
                <Bell className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#E2E2E6]">
                Contextual Reminders
              </h3>
            </div>

            <button
              onClick={() => setIsAddReminderModalOpen(true)}
              className="py-1.5 px-3 rounded-2xl bg-[#D1E1FF] hover:bg-white text-[#003062] text-xs font-bold flex items-center space-x-1.5 transition shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Reminder</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {state.reminders.length === 0 ? (
              <div className="p-4 rounded-[24px] bg-[#1D2026] border border-[#44474E]/40 text-center text-xs text-[#C4C6D0]/60">
                No active reminders.
              </div>
            ) : (
              state.reminders.map((rem) => (
                <div
                  key={rem.id}
                  className={`bg-[#1D2026] border rounded-[28px] p-4 shadow-md space-y-2 transition ${
                    rem.isDone
                      ? 'border-[#44474E]/30 opacity-60 bg-[#1A1C1E]'
                      : 'border-[#44474E]/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start space-x-2.5">
                      <button
                        onClick={() => toggleReminder(rem.id)}
                        className={`mt-0.5 p-1 rounded-xl transition ${
                          rem.isDone
                            ? 'text-[#D1E1FF] bg-[#334867]'
                            : 'text-[#C4C6D0] hover:text-[#D1E1FF] bg-[#2E3036]'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>

                      <div>
                        <div className={`text-xs font-semibold text-[#E2E2E6] ${rem.isDone ? 'line-through text-[#C4C6D0]/50' : ''}`}>
                          {rem.message}
                        </div>
                        <div className="text-[10px] font-mono text-[#FDE047] mt-0.5">
                          Trigger: {rem.triggerCondition} ({rem.type.replace('_', ' ')})
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteReminder(rem.id)}
                      className="p-1.5 text-[#C4C6D0] hover:text-[#F87171] hover:bg-[#2E3036] rounded-xl transition"
                      title="Delete reminder"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* If Event Triggered: simulate external webhook trigger */}
                  {rem.type === 'EVENT_TRIGGERED' && !rem.isDone && (
                    <div className="pt-2 flex items-center justify-between border-t border-[#44474E]/30">
                      <span className="text-[10px] text-[#C4C6D0]/60 italic">Waiting for external event...</span>
                      <button
                        onClick={() => {
                          toggleReminder(rem.id);
                          if (rem.relatedTaskId) {
                            updateTaskStatus(rem.relatedTaskId, 'NEXT');
                          }
                        }}
                        className="py-1 px-2.5 bg-[#334867] hover:bg-[#2E3036] border border-[#D1E1FF]/40 text-[#D1E1FF] rounded-xl text-[10px] font-semibold flex items-center space-x-1.5 transition"
                      >
                        <Zap className="w-3 h-3 text-[#D1E1FF]" />
                        <span>Simulate Trigger Complete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Add Anchor Modal */}
      {isAddAnchorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setIsAddAnchorModalOpen(false)}>
          <div className="bg-[#1D2026] text-[#E2E2E6] border border-[#44474E]/50 rounded-[36px] p-6 shadow-2xl max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[#44474E]/30">
              <h3 className="font-bold text-base text-[#E2E2E6]">Add Planning Anchor Event</h3>
              <button onClick={() => setIsAddAnchorModalOpen(false)} className="text-[#C4C6D0] hover:text-[#E2E2E6] font-semibold text-sm">✕</button>
            </div>

            <form onSubmit={handleCreateAnchor} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Anchor Event Title *</label>
                <input
                  type="text"
                  required
                  value={anchorTitle}
                  onChange={(e) => setAnchorTitle(e.target.value)}
                  placeholder="e.g., Boss Meeting / Client Call"
                  className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Start Time (HH:MM)</label>
                  <input
                    type="text"
                    required
                    value={anchorTime}
                    onChange={(e) => setAnchorTime(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] font-mono focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">End Time (Optional)</label>
                  <input
                    type="text"
                    value={anchorEndTime}
                    onChange={(e) => setAnchorEndTime(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] font-mono focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Location</label>
                <input
                  type="text"
                  value={anchorLocation}
                  onChange={(e) => setAnchorLocation(e.target.value)}
                  placeholder="e.g., Conference Room B / Google Meet"
                  className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#D1E1FF] hover:bg-white text-[#003062] font-bold rounded-2xl text-xs transition shadow-lg mt-3"
              >
                Save Planning Anchor
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Reminder Modal */}
      {isAddReminderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setIsAddReminderModalOpen(false)}>
          <div className="bg-[#1D2026] text-[#E2E2E6] border border-[#44474E]/50 rounded-[36px] p-6 shadow-2xl max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[#44474E]/30">
              <h3 className="font-bold text-base text-[#E2E2E6]">Add Contextual Reminder</h3>
              <button onClick={() => setIsAddReminderModalOpen(false)} className="text-[#C4C6D0] hover:text-[#E2E2E6] font-semibold text-sm">✕</button>
            </div>

            <form onSubmit={handleCreateReminder} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Reminder Type</label>
                <select
                  value={reminderType}
                  onChange={(e) => setReminderType(e.target.value as ReminderType)}
                  className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                >
                  <option value="TIME_BASED">Time-Based (At specific hour, e.g. 1:00 PM)</option>
                  <option value="LOCATION_BASED">Location-Based (When arriving at Home/Office)</option>
                  <option value="EVENT_TRIGGERED">Event-Triggered (When IT finishes, etc.)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Trigger Condition</label>
                <input
                  type="text"
                  required
                  value={reminderCondition}
                  onChange={(e) => setReminderCondition(e.target.value)}
                  placeholder={
                    reminderType === 'TIME_BASED'
                      ? 'e.g., 13:00'
                      : reminderType === 'LOCATION_BASED'
                      ? 'e.g., Arriving home'
                      : 'e.g., When IT confirms CRM workflow'
                  }
                  className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Reminder Note / Message *</label>
                <input
                  type="text"
                  required
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  placeholder="e.g., Grab water bottle from kitchen"
                  className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#D1E1FF] hover:bg-white text-[#003062] font-bold rounded-2xl text-xs transition shadow-lg mt-3"
              >
                Save Reminder
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

