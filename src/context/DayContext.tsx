import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  DailyState, 
  TaskItem, 
  TaskStatus, 
  TimelineEvent, 
  FixedEvent, 
  ReminderItem, 
  AppMode, 
  EnergyLevel, 
  TimetableSlot, 
  RoutineSlotStatus,
  UserSettings,
  FocusTimerMode,
  FocusSessionState,
  RewardItem,
  RewardTier,
  ClaimedRewardHistory,
  GeofenceLocation
} from '../types';
import { createFreshDailyState, SAMPLE_TEMPLATE_STATE, INITIAL_DAILY_STATE, DEFAULT_USER_SETTINGS, DEFAULT_GEOFENCE_LOCATIONS } from '../utils/initialState';
import { recordTaskInteraction, recordRoutineInteraction, getLearningProfile, resetLearningProfile, saveLearningProfile, AutoLearningProfile } from '../utils/autoLearning';
import { parseOfflineUserInput, generateOfflineEndOfDayReview } from '../utils/offlineParser';
import { scheduleNativeReminder, cancelNativeReminder, promptOnDeviceAi } from '../services/nativeBridge';
import { locationService } from '../services/locationService';
import { soundEffects } from '../services/soundEffects';
import { syncStateToGoogleSheets, fetchLatestBackupFromGoogleSheets } from '../services/googleSheetsSync';
import { speechService } from '../services/speechRecognition';
import { DEFAULT_REWARDS, INITIAL_GAMIFICATION_STATE, updateStreak } from '../services/rewardsCatalog';

const STORAGE_KEY = 'daytrace_state_v2';

interface DayContextType {
  state: DailyState;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isProcessing: boolean;
  processUserInput: (input: string) => Promise<string>;
  updateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  addTask: (task: Omit<TaskItem, 'id' | 'createdAt'>) => void;
  deleteTask: (taskId: string) => void;
  editTask: (taskId: string, updates: Partial<TaskItem>) => void;
  addTimelineEvent: (event: Omit<TimelineEvent, 'id'>) => void;
  deleteTimelineEvent: (eventId: string) => void;
  addFixedEvent: (event: Omit<FixedEvent, 'id'>) => void;
  deleteFixedEvent: (eventId: string) => void;
  toggleReminder: (reminderId: string) => void;
  addReminder: (reminder: Omit<ReminderItem, 'id' | 'createdAt' | 'isDone'>) => void;
  deleteReminder: (reminderId: string) => void;
  addTimetableSlot: (slot: Omit<TimetableSlot, 'id'>) => void;
  updateTimetableSlot: (id: string, updates: Partial<TimetableSlot>) => void;
  deleteTimetableSlot: (id: string) => void;
  toggleSlotStatus: (id: string, status: RoutineSlotStatus) => void;
  syncTimetableToDailyTasks: () => void;
  applyTimetablePreset: (presetType: 'BALANCED' | 'FITNESS_CREATOR' | 'DEEP_WORK') => void;
  setCurrentEnergy: (energy: EnergyLevel) => void;
  setCurrentLocation: (loc: string) => void;
  setFocusTask: (taskId: string | null) => void;
  updateUserSettings: (updates: Partial<UserSettings>) => void;
  snoozePrompts: (minutes: number) => void;
  isPeriodicPromptOpen: boolean;
  setIsPeriodicPromptOpen: (open: boolean) => void;
  triggerManualPromptCheck: () => void;
  syncToGoogleSheets: () => Promise<{ success: boolean; url?: string; error?: string }>;
  isSyncingSheets: boolean;
  restoreFromGoogleSheetsBackup: (spreadsheetId?: string) => Promise<{ success: boolean; message?: string }>;
  isRestoringBackup: boolean;
  // Deep Work & Pomodoro Focus Engine
  focusTimer: FocusSessionState;
  startFocusTimer: (mode: FocusTimerMode, taskId?: string, taskTitle?: string) => void;
  pauseFocusTimer: () => void;
  resumeFocusTimer: () => void;
  stopFocusTimer: () => void;
  extendFocusTimer: (minutes: number) => void;
  finishFocusTaskEarly: () => void;
  // Voice Memo Quick Capture
  executeVoiceTranscript: (transcript: string) => void;
  // Gamification & Rewards Vault
  claimReward: (rewardId: string) => boolean;
  addCustomReward: (reward: Omit<RewardItem, 'id' | 'timesClaimed'>) => void;
  awardPoints: (points: number, reason?: string) => void;
  // Geofence routines
  simulateGeofenceEnter: (locationName: string) => void;
  // Modals visibility toggles
  isFocusModalOpen: boolean;
  setIsFocusModalOpen: (open: boolean) => void;
  isVoiceModalOpen: boolean;
  setIsVoiceModalOpen: (open: boolean) => void;
  isRewardsModalOpen: boolean;
  setIsRewardsModalOpen: (open: boolean) => void;
  isGeofenceModalOpen: boolean;
  setIsGeofenceModalOpen: (open: boolean) => void;
  resetToDefault: () => void;
  resetToFreshStart: () => void;
  loadSampleTemplate: () => void;
  exportDataJSON: () => string;
  exportDataSheetsCSV: () => { [tab: string]: string };
  importDataJSON: (jsonStr: string) => boolean;
  currentTimeString: string;
  learningProfile: AutoLearningProfile;
  recordCustomRoutine: (id: string, label: string, prompt: string) => void;
  resetLearnedShortcuts: () => void;
  notificationToast: string | null;
  dismissToast: () => void;
}

const DayContext = createContext<DayContextType | undefined>(undefined);

export const DayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DailyState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...createFreshDailyState(),
          ...parsed,
          gamification: {
            ...INITIAL_GAMIFICATION_STATE,
            ...(parsed.gamification || {}),
          },
          geofenceLocations: parsed.geofenceLocations || DEFAULT_GEOFENCE_LOCATIONS,
        };
      }
    } catch (e) {
      console.error('Failed to load DayTrace state from localStorage', e);
    }
    return createFreshDailyState();
  });

  const [mode, setMode] = useState<AppMode>('ACCOUNTABILITY');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentTimeString, setCurrentTimeString] = useState<string>('09:45');
  const [learningProfile, setLearningProfileState] = useState<AutoLearningProfile>(() => getLearningProfile());
  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const [isPeriodicPromptOpen, setIsPeriodicPromptOpen] = useState<boolean>(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);

  // Modals state
  const [isFocusModalOpen, setIsFocusModalOpen] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [isRewardsModalOpen, setIsRewardsModalOpen] = useState<boolean>(false);
  const [isGeofenceModalOpen, setIsGeofenceModalOpen] = useState<boolean>(false);

  // Deep Work & Pomodoro Focus Timer State
  const [focusTimer, setFocusTimer] = useState<FocusSessionState>({
    isActive: false,
    isPaused: false,
    mode: 'POMODORO_25',
    targetTaskId: null,
    targetTaskTitle: 'Deep Focus Block',
    startedAt: undefined,
    totalDurationSeconds: 25 * 60,
    secondsRemaining: 25 * 60,
    elapsedSeconds: 0,
  });

  const lastPromptTimeRef = useRef<number>(Date.now());
  const triggeredAlarmsRef = useRef<Set<string>>(new Set());

  const dismissToast = useCallback(() => setNotificationToast(null), []);

  const refreshLearningProfile = useCallback(() => {
    setLearningProfileState(getLearningProfile());
  }, []);

  const recordCustomRoutine = useCallback((id: string, label: string, prompt: string) => {
    recordRoutineInteraction(id, label, prompt);
    refreshLearningProfile();
  }, [refreshLearningProfile]);

  const resetLearnedShortcuts = useCallback(() => {
    const fresh = resetLearningProfile();
    setLearningProfileState(fresh);
  }, []);

  const awardPoints = useCallback((pointsToAdd: number, reason?: string) => {
    setState((prev) => {
      const currentGam = prev.gamification || INITIAL_GAMIFICATION_STATE;
      const updatedGam = updateStreak({
        ...currentGam,
        points: currentGam.points + pointsToAdd,
      });

      return {
        ...prev,
        gamification: updatedGam,
      };
    });
    if (reason) {
      setNotificationToast(`🪙 +${pointsToAdd} DayCoins: ${reason}`);
    }
  }, []);

  const claimReward = useCallback((rewardId: string): boolean => {
    let success = false;
    setState((prev) => {
      const currentGam = prev.gamification || INITIAL_GAMIFICATION_STATE;
      const allRewards = [...DEFAULT_REWARDS, ...(currentGam.customRewards || [])];
      const target = allRewards.find((r) => r.id === rewardId);

      if (!target || currentGam.points < target.pointsCost) {
        return prev;
      }

      success = true;
      const claimedItem: ClaimedRewardHistory = {
        id: `claim-${Date.now()}`,
        rewardId: target.id,
        title: target.title,
        pointsCost: target.pointsCost,
        claimedAt: new Date().toISOString(),
        tier: target.tier,
        icon: target.icon,
      };

      return {
        ...prev,
        gamification: {
          ...currentGam,
          points: currentGam.points - target.pointsCost,
          claimedRewards: [claimedItem, ...(currentGam.claimedRewards || [])],
        },
      };
    });
    return success;
  }, []);

  const addCustomReward = useCallback((rewardData: Omit<RewardItem, 'id' | 'timesClaimed'>) => {
    const newReward: RewardItem = {
      ...rewardData,
      id: `custom-rew-${Date.now()}`,
      timesClaimed: 0,
    };
    setState((prev) => {
      const currentGam = prev.gamification || INITIAL_GAMIFICATION_STATE;
      return {
        ...prev,
        gamification: {
          ...currentGam,
          customRewards: [...(currentGam.customRewards || []), newReward],
        },
      };
    });
    setNotificationToast(`🎁 Custom Reward Goal Added: ${newReward.title}`);
  }, []);

  const updateUserSettings = useCallback((updates: Partial<UserSettings>) => {
    setState((prev) => ({
      ...prev,
      userSettings: {
        ...(prev.userSettings || DEFAULT_USER_SETTINGS),
        ...updates,
      },
    }));
  }, []);

  const snoozePrompts = useCallback((minutes: number) => {
    const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    updateUserSettings({ snoozedUntil: until });
    setNotificationToast(`💤 Accountability prompts snoozed for ${minutes} min`);
  }, [updateUserSettings]);

  const triggerManualPromptCheck = useCallback(() => {
    soundEffects.playPromptChime();
    setIsPeriodicPromptOpen(true);
  }, []);

  // Save state to localStorage whenever modified
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save DayTrace state to localStorage', e);
    }
  }, [state]);

  // Live time ticker & Periodic 30-min prompt evaluation & Alarm triggers
  useEffect(() => {
    const checkAlarmsAndPrompts = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const currentHM = `${h}:${m}`;
      setCurrentTimeString(currentHM);

      const settings = state.userSettings || DEFAULT_USER_SETTINGS;

      // 1. Evaluate Scheduled Alarms & Reminders (including office leaving time)
      const pendingReminders = state.reminders.filter(r => !r.isDone);
      pendingReminders.forEach((reminder) => {
        if (reminder.type === 'TIME_BASED' && reminder.triggerCondition) {
          const triggerHM = reminder.triggerCondition.length === 5 ? reminder.triggerCondition : null;
          if (triggerHM && triggerHM === currentHM && !triggeredAlarmsRef.current.has(reminder.id)) {
            triggeredAlarmsRef.current.add(reminder.id);
            if (settings.alarmSoundEnabled) {
              soundEffects.playAlarmRing();
            }
            setNotificationToast(`⏰ ALARM: ${reminder.message}`);
            // Mark reminder as triggered/done
            setState(prev => ({
              ...prev,
              reminders: prev.reminders.map(r => r.id === reminder.id ? { ...r, isDone: true } : r),
              timeline: [
                ...prev.timeline,
                {
                  id: `time-${Date.now()}`,
                  time: currentHM,
                  type: 'EVENT',
                  description: `Alarm triggered: ${reminder.message}`,
                  location: prev.current.location,
                }
              ]
            }));
          }
        }
      });

      // 2. Evaluate 30-Minute Recurring Accountability Check
      // Only pop up if enabled, not in gaming mode, not snoozed, and within waking hours
      if (settings.periodicPromptEnabled && !settings.gamingModeActive) {
        // Check snooze
        if (settings.snoozedUntil) {
          const snoozeEnd = new Date(settings.snoozedUntil).getTime();
          if (Date.now() < snoozeEnd) {
            return; // still snoozed
          }
        }

        // Check sleep window (e.g. bedTime to wakeUpTime)
        const [bedH, bedM] = (settings.bedTime || '23:30').split(':').map(Number);
        const [wakeH, wakeM] = (settings.wakeUpTime || '07:00').split(':').map(Number);
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const bedMins = bedH * 60 + bedM;
        const wakeMins = wakeH * 60 + wakeM;

        // If sleep is crossing midnight (e.g. 23:30 to 07:00)
        let isSleeping = false;
        if (bedMins > wakeMins) {
          isSleeping = currentMins >= bedMins || currentMins < wakeMins;
        } else {
          isSleeping = currentMins >= bedMins && currentMins < wakeMins;
        }

        if (!isSleeping) {
          const intervalMs = (settings.periodicPromptIntervalMinutes || 30) * 60 * 1000;
          if (Date.now() - lastPromptTimeRef.current >= intervalMs) {
            lastPromptTimeRef.current = Date.now();
            soundEffects.playPromptChime();
            setIsPeriodicPromptOpen(true);
          }
        }
      }
    };

    checkAlarmsAndPrompts();
    const interval = setInterval(checkAlarmsAndPrompts, 10000);
    return () => clearInterval(interval);
  }, [state.userSettings, state.reminders]);

  // Continuous Geofencing and Location Monitoring
  useEffect(() => {
    const locations = state.geofenceLocations || DEFAULT_GEOFENCE_LOCATIONS;
    locationService.startWatching((locName) => {
      setState((prev) => {
        if (prev.current.location === locName) return prev;

        // Location changed: check for pending location-based reminders!
        const locLower = locName.toLowerCase();
        let triggeredAny = false;
        const updatedReminders = prev.reminders.map((rem) => {
          if (!rem.isDone && rem.type === 'LOCATION_BASED' && rem.triggerCondition.toLowerCase().includes(locLower)) {
            triggeredAny = true;
            setNotificationToast(`📍 Location Alert: ${rem.message}`);
            return { ...rem, isDone: true };
          }
          return rem;
        });

        const newTimeline = [...prev.timeline];
        if (triggeredAny) {
          newTimeline.push({
            id: `time-${Date.now()}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            type: 'EVENT',
            description: `Triggered location reminder at ${locName}`,
            location: locName,
          });
        }

        return {
          ...prev,
          current: {
            ...prev.current,
            location: locName,
            updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          },
          reminders: updatedReminders,
          timeline: newTimeline,
        };
      });
    }, locations);

    return () => {
      locationService.stopWatching();
    };
  }, [state.geofenceLocations]);

  // Deep Work & Pomodoro Focus Timer Ticker
  useEffect(() => {
    if (!focusTimer.isActive || focusTimer.isPaused) return;

    const interval = setInterval(() => {
      setFocusTimer((prev) => {
        if (!prev.isActive || prev.isPaused) return prev;

        if (prev.mode === 'STOPWATCH') {
          return {
            ...prev,
            elapsedSeconds: prev.elapsedSeconds + 1,
          };
        }

        if (prev.secondsRemaining <= 1) {
          // Session Completed!
          soundEffects.playTaskDone();

          const minsLogged = Math.max(1, Math.round(prev.totalDurationSeconds / 60));
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

          // Auto-log timeline entry and award XP points
          setState((prevState) => {
            const currentGam = prevState.gamification || INITIAL_GAMIFICATION_STATE;
            const updatedGam = {
              ...currentGam,
              points: currentGam.points + 30,
              totalFocusMinutes: currentGam.totalFocusMinutes + minsLogged,
            };

            const updatedTimeline = [
              ...prevState.timeline,
              {
                id: `time-${Date.now()}`,
                time: nowStr,
                type: 'EVENT' as const,
                description: `🎯 Completed ${minsLogged}m Focus Block on: ${prev.targetTaskTitle}`,
                location: prevState.current.location,
              },
            ];

            return {
              ...prevState,
              timeline: updatedTimeline,
              gamification: updatedGam,
            };
          });

          setNotificationToast(`🎉 Focus block completed (+30 DayCoins, ${minsLogged}m logged)!`);

          return {
            ...prev,
            isActive: false,
            secondsRemaining: 0,
            elapsedSeconds: prev.totalDurationSeconds,
          };
        }

        return {
          ...prev,
          secondsRemaining: prev.secondsRemaining - 1,
          elapsedSeconds: prev.elapsedSeconds + 1,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [focusTimer.isActive, focusTimer.isPaused]);

  const startFocusTimer = useCallback((mode: FocusTimerMode, taskId?: string, taskTitle?: string) => {
    let durationSeconds = 25 * 60;
    if (mode === 'DEEP_FLOW_50') durationSeconds = 50 * 60;
    else if (mode === 'SHORT_BREAK_5') durationSeconds = 5 * 60;
    else if (mode === 'LONG_BREAK_15') durationSeconds = 15 * 60;
    else if (mode === 'STOPWATCH') durationSeconds = 0;

    const title = taskTitle || (taskId ? state.tasks.find(t => t.id === taskId)?.title : 'Deep Focus Block') || 'Deep Focus Block';

    setFocusTimer({
      isActive: true,
      isPaused: false,
      mode,
      targetTaskId: taskId || null,
      targetTaskTitle: title,
      startedAt: new Date().toISOString(),
      totalDurationSeconds: durationSeconds,
      secondsRemaining: durationSeconds,
      elapsedSeconds: 0,
    });

    if (taskId) {
      // Mark task as active
      setState((prev) => ({
        ...prev,
        current: { ...prev.current, focusTaskId: taskId },
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: 'ACTIVE' as TaskStatus } : t)),
      }));
    }

    soundEffects.playPromptChime();
    setNotificationToast(`⏱️ Started ${mode.replace('_', ' ')} focus session`);
  }, [state.tasks]);

  const pauseFocusTimer = useCallback(() => {
    setFocusTimer((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resumeFocusTimer = useCallback(() => {
    setFocusTimer((prev) => ({ ...prev, isPaused: false }));
  }, []);

  const stopFocusTimer = useCallback(() => {
    setFocusTimer((prev) => ({
      ...prev,
      isActive: false,
      isPaused: false,
      secondsRemaining: prev.totalDurationSeconds,
      elapsedSeconds: 0,
    }));
  }, []);

  const extendFocusTimer = useCallback((minutes: number) => {
    setFocusTimer((prev) => ({
      ...prev,
      secondsRemaining: prev.secondsRemaining + minutes * 60,
      totalDurationSeconds: prev.totalDurationSeconds + minutes * 60,
    }));
    setNotificationToast(`⏱️ Added +${minutes}m to focus timer`);
  }, []);

  const finishFocusTaskEarly = useCallback(() => {
    soundEffects.playTaskDone();

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const targetTaskId = focusTimer.targetTaskId;
    const targetTitle = focusTimer.targetTaskTitle;
    const minsElapsed = Math.max(1, Math.round(focusTimer.elapsedSeconds / 60));

    setState((prev) => {
      let updatedTasks = prev.tasks;
      if (targetTaskId) {
        updatedTasks = prev.tasks.map((t) =>
          t.id === targetTaskId ? { ...t, status: 'DONE' as TaskStatus, completedAt: nowStr } : t
        );
      }

      const currentGam = prev.gamification || INITIAL_GAMIFICATION_STATE;
      const updatedGam = {
        ...currentGam,
        points: currentGam.points + 25,
        totalTasksCompleted: currentGam.totalTasksCompleted + (targetTaskId ? 1 : 0),
        totalFocusMinutes: currentGam.totalFocusMinutes + minsElapsed,
      };

      const updatedTimeline = [
        ...prev.timeline,
        {
          id: `time-${Date.now()}`,
          time: nowStr,
          type: 'TASK_COMPLETED' as const,
          description: `Finished: ${targetTitle} (${minsElapsed}m focus)`,
          relatedTaskId: targetTaskId || undefined,
          location: prev.current.location,
        },
      ];

      return {
        ...prev,
        tasks: updatedTasks,
        timeline: updatedTimeline,
        gamification: updatedGam,
        current: {
          ...prev.current,
          focusTaskId: prev.current.focusTaskId === targetTaskId ? null : prev.current.focusTaskId,
        },
      };
    });

    setFocusTimer((prev) => ({
      ...prev,
      isActive: false,
      isPaused: false,
      secondsRemaining: prev.totalDurationSeconds,
      elapsedSeconds: 0,
    }));

    setNotificationToast(`🎉 Task marked completed (+25 DayCoins)!`);
  }, [focusTimer]);

  // Voice Memo Quick Capture Handler
  const executeVoiceTranscript = useCallback((rawTranscript: string) => {
    const parsed = speechService.parseVoiceTranscript(rawTranscript);
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    soundEffects.playTaskDone();

    if (parsed.type === 'NEW_REMINDER') {
      const newRemId = `rem-${Date.now()}`;
      const trigger = parsed.timeHint || nowStr;
      const newReminder: ReminderItem = {
        id: newRemId,
        type: 'TIME_BASED',
        triggerCondition: trigger,
        message: parsed.titleOrText,
        isDone: false,
        createdAt: nowStr,
      };

      setState((prev) => ({
        ...prev,
        reminders: [...prev.reminders, newReminder],
      }));

      scheduleNativeReminder(newRemId, trigger, parsed.titleOrText);
      awardPoints(15, `Voice reminder added: "${parsed.titleOrText}"`);
    } else if (parsed.type === 'TASK_DONE') {
      // Find task matching title or create completed task entry
      const lower = parsed.titleOrText.toLowerCase();
      let matchedTask: TaskItem | undefined;

      setState((prev) => {
        matchedTask = prev.tasks.find((t) => t.title.toLowerCase().includes(lower) || lower.includes(t.title.toLowerCase()));

        let updatedTasks = prev.tasks;
        if (matchedTask) {
          updatedTasks = prev.tasks.map((t) => (t.id === matchedTask!.id ? { ...t, status: 'DONE' as TaskStatus, completedAt: nowStr } : t));
        }

        const currentGam = prev.gamification || INITIAL_GAMIFICATION_STATE;
        const updatedGam = {
          ...currentGam,
          points: currentGam.points + 20,
          totalTasksCompleted: currentGam.totalTasksCompleted + 1,
        };

        const updatedTimeline = [
          ...prev.timeline,
          {
            id: `time-${Date.now()}`,
            time: nowStr,
            type: 'TASK_COMPLETED' as const,
            description: `Voice Completed: ${matchedTask ? matchedTask.title : parsed.titleOrText}`,
            relatedTaskId: matchedTask?.id,
            location: prev.current.location,
          },
        ];

        return {
          ...prev,
          tasks: updatedTasks,
          timeline: updatedTimeline,
          gamification: updatedGam,
        };
      });

      setNotificationToast(`✅ Voice Completed: "${matchedTask ? matchedTask.title : parsed.titleOrText}" (+20 DayCoins)`);
    } else if (parsed.type === 'NEW_TASK') {
      const newTask: TaskItem = {
        id: `task-${Date.now()}`,
        title: parsed.titleOrText,
        category: 'OFFICE',
        owner: 'ME',
        status: 'NEXT',
        priority: 1,
        createdAt: nowStr,
      };

      setState((prev) => ({
        ...prev,
        tasks: [newTask, ...prev.tasks],
      }));

      awardPoints(10, `Voice task added: "${parsed.titleOrText}"`);
    } else {
      // Timeline Update
      setState((prev) => {
        const newLocation = parsed.locationHint || prev.current.location;
        const newEnergy = parsed.energyHint || prev.current.energy;

        const updatedTimeline = [
          ...prev.timeline,
          {
            id: `time-${Date.now()}`,
            time: nowStr,
            type: 'EVENT' as const,
            description: `🎙️ Voice Note: ${parsed.rawTranscript}`,
            location: newLocation,
          },
        ];

        return {
          ...prev,
          current: {
            ...prev.current,
            location: newLocation,
            energy: newEnergy,
            updatedAt: nowStr,
          },
          timeline: updatedTimeline,
        };
      });

      awardPoints(10, 'Voice memo logged to Timeline');
    }
  }, [awardPoints]);

  // Geofence Enter & Automation
  const simulateGeofenceEnter = useCallback((locationName: string) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const locLower = locationName.toLowerCase();

    setState((prev) => {
      const previousLocation = prev.current.location;
      const locations = prev.geofenceLocations || DEFAULT_GEOFENCE_LOCATIONS;
      const matched = locations.find((l) => l.name.toLowerCase() === locLower);

      let arrivalMsg = matched?.arrivalMessage || `Arrived at ${locationName}`;
      let departureMsg = `Departed ${previousLocation}`;

      // Check if location reminders are triggered
      const updatedReminders = prev.reminders.map((rem) => {
        if (!rem.isDone && rem.type === 'LOCATION_BASED' && rem.triggerCondition.toLowerCase().includes(locLower)) {
          return { ...rem, isDone: true };
        }
        return rem;
      });

      const updatedTimeline = [
        ...prev.timeline,
        {
          id: `time-${Date.now()}`,
          time: nowStr,
          type: 'EVENT' as const,
          description: `📍 [GEOFENCE] ${previousLocation} ➔ ${locationName} (${arrivalMsg})`,
          location: locationName,
        },
      ];

      return {
        ...prev,
        current: {
          ...prev.current,
          location: locationName,
          updatedAt: nowStr,
        },
        reminders: updatedReminders,
        timeline: updatedTimeline,
      };
    });

    soundEffects.playPromptChime();
    setNotificationToast(`📍 Smart Geofence: Entered ${locationName}`);
    awardPoints(10, `Geofence check-in at ${locationName}`);
  }, [awardPoints]);

  // Event-Triggered Reminders Watcher (Section 13 Implementation)
  const evaluateEventTriggeredReminders = useCallback((triggerPhrase: string) => {
    setState((prev) => {
      let triggered = false;
      const lowerPhrase = triggerPhrase.toLowerCase();

      const updatedReminders = prev.reminders.map((rem) => {
        if (!rem.isDone && rem.type === 'EVENT_TRIGGERED') {
          const conditionLower = rem.triggerCondition.toLowerCase();
          if (lowerPhrase.includes(conditionLower) || conditionLower.includes(lowerPhrase)) {
            triggered = true;
            setNotificationToast(`⚡ Event Trigger: ${rem.message}`);
            return { ...rem, isDone: true };
          }
        }
        return rem;
      });

      if (!triggered) return prev;

      return {
        ...prev,
        reminders: updatedReminders,
      };
    });
  }, []);

  // Process natural language input (with on-device AI + deterministic offline parser fallback)
  const processUserInput = useCallback(async (userInput: string): Promise<string> => {
    if (!userInput.trim()) return '';
    setIsProcessing(true);

    const userMessageId = `msg-${Date.now()}`;
    const userTimestamp = currentTimeString;

    // Immediately log user message
    setState((prev) => ({
      ...prev,
      conversationHistory: [
        ...prev.conversationHistory,
        {
          id: userMessageId,
          sender: 'user',
          text: userInput,
          timestamp: userTimestamp,
        },
      ],
    }));

    try {
      let parseResult: any = null;

      // 1. Try On-Device Gemini Nano (if available via AICore or window.ai)
      const onDeviceResult = await promptOnDeviceAi(userInput);
      if (onDeviceResult) {
        try {
          parseResult = JSON.parse(onDeviceResult);
        } catch {
          // Output was natural language, feed through deterministic parser
        }
      }

      // 2. Try Server-side AI endpoint
      if (!parseResult) {
        try {
          const res = await fetch('/api/ai/process-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userInput,
              currentState: state,
              mode,
              currentTime: userTimestamp,
            }),
          });
          if (res.ok) {
            parseResult = await res.json();
          }
        } catch {
          // Server offline or unavailable, fallback to deterministic parser
        }
      }

      // 3. Robust Offline Deterministic Parser (always succeeds offline with 0 latency)
      if (!parseResult || !parseResult.extractedStateUpdate) {
        parseResult = parseOfflineUserInput(userInput, state, userTimestamp);
      }

      const { aiResponseText, extractedStateUpdate } = parseResult;

      // Apply extracted state updates cleanly
      setState((prev) => {
        let updatedTasks = [...prev.tasks];
        let updatedTimeline = [...prev.timeline];
        let updatedFixed = [...prev.fixedEvents];
        let updatedReminders = [...prev.reminders];

        // 1. Process completed tasks
        if (extractedStateUpdate?.completedTaskTitles?.length) {
          const compTitles = extractedStateUpdate.completedTaskTitles.map((t: string) => t.toLowerCase());
          updatedTasks = updatedTasks.map((task) => {
            const match = compTitles.some((title: string) =>
              task.title.toLowerCase().includes(title) || title.includes(task.title.toLowerCase())
            );
            if (match && task.status !== 'DONE') {
              recordTaskInteraction(task.title, task.id, 'COMPLETE', task.category);
              return {
                ...task,
                status: 'DONE' as TaskStatus,
                completedAt: userTimestamp,
              };
            }
            return task;
          });
        }

        // 2. Process task updates (including partial note updates)
        if (extractedStateUpdate?.updatedTasks?.length) {
          extractedStateUpdate.updatedTasks.forEach((up: any) => {
            const index = updatedTasks.findIndex(
              (t) => (up.id && t.id === up.id) || (up.title && t.title.toLowerCase() === up.title.toLowerCase())
            );
            if (index !== -1) {
              const currentT = updatedTasks[index];
              if (up.status === 'DONE') {
                recordTaskInteraction(currentT.title, currentT.id, 'COMPLETE', currentT.category);
              } else if (up.status === 'ACTIVE') {
                recordTaskInteraction(currentT.title, currentT.id, 'START', currentT.category);
              } else {
                recordTaskInteraction(currentT.title, currentT.id, 'UPDATE', currentT.category);
              }
              updatedTasks[index] = { ...currentT, ...up };
            }
          });
        }

        // 3. Process new tasks
        if (extractedStateUpdate?.newTasks?.length) {
          extractedStateUpdate.newTasks.forEach((nt: any) => {
            const exists = updatedTasks.some(
              (t) => t.title.toLowerCase() === nt.title.toLowerCase() && t.category === nt.category
            );
            if (!exists) {
              const newId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
              recordTaskInteraction(nt.title, newId, 'UPDATE', nt.category || 'OFFICE');
              updatedTasks.push({
                id: newId,
                createdAt: userTimestamp,
                priority: nt.priority || 6,
                ...nt,
              });
            }
          });
        }

        // 4. Dependency cascade: unblock blocked tasks if blocker is DONE
        const doneTaskTitles = updatedTasks.filter((t) => t.status === 'DONE').map((t) => t.title.toLowerCase());
        updatedTasks = updatedTasks.map((task) => {
          if (task.status === 'BLOCKED' && task.blockedBy) {
            const blockerDone = doneTaskTitles.some((title) =>
              task.blockedBy?.toLowerCase().includes(title)
            );
            if (blockerDone) {
              return { ...task, status: 'NEXT' as TaskStatus };
            }
          }
          return task;
        });

        // 5. Process timeline events
        if (extractedStateUpdate?.newTimelineEvents?.length) {
          extractedStateUpdate.newTimelineEvents.forEach((ev: any) => {
            updatedTimeline.push({
              id: `time-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              time: ev.time || userTimestamp,
              ...ev,
            });
          });
        }

        // 6. Process new fixed events
        if (extractedStateUpdate?.newFixedEvents?.length) {
          extractedStateUpdate.newFixedEvents.forEach((fe: any) => {
            const exists = updatedFixed.some((f) => f.title.toLowerCase() === fe.title.toLowerCase());
            if (!exists) {
              updatedFixed.push({
                id: `fix-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                ...fe,
              });
            }
          });
        }

        // 7. Process new reminders & schedule native alarms
        if (extractedStateUpdate?.newReminders?.length) {
          extractedStateUpdate.newReminders.forEach((rem: any) => {
            const newRemId = `rem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
            updatedReminders.push({
              id: newRemId,
              createdAt: userTimestamp,
              isDone: false,
              ...rem,
            });

            // Schedule on-device exact Android alarm if time-based
            if (rem.type === 'TIME_BASED' && rem.triggerCondition) {
              scheduleNativeReminder(newRemId, rem.triggerCondition, rem.message);
            }
          });
        }

        const newLocation = extractedStateUpdate?.currentLocation || prev.current.location;
        const newActivity = extractedStateUpdate?.currentActivity || prev.current.activity;
        const newEnergy = extractedStateUpdate?.currentEnergy || prev.current.energy;

        const nextAction = extractedStateUpdate?.nextBestAction
          ? {
              taskId: extractedStateUpdate.nextBestAction.taskId || null,
              title: extractedStateUpdate.nextBestAction.title,
              rationale: extractedStateUpdate.nextBestAction.rationale,
              category: extractedStateUpdate.nextBestAction.category,
              estimatedMinutes: extractedStateUpdate.nextBestAction.estimatedMinutes,
              secondaryRecommendations: extractedStateUpdate.nextBestAction.secondaryRecommendations,
            }
          : prev.nextBestAction;

        return {
          ...prev,
          current: {
            ...prev.current,
            location: newLocation,
            activity: newActivity,
            energy: newEnergy,
            updatedAt: userTimestamp,
          },
          tasks: updatedTasks,
          timeline: updatedTimeline,
          fixedEvents: updatedFixed,
          reminders: updatedReminders,
          nextBestAction: nextAction,
          conversationHistory: [
            ...prev.conversationHistory,
            {
              id: `ai-${Date.now()}`,
              sender: 'ai',
              text: aiResponseText || 'State updated according to your message.',
              timestamp: userTimestamp,
              changesSummary: extractedStateUpdate?.changesSummary,
            },
          ],
        };
      });

      // Check for event-triggered reminders based on user message
      evaluateEventTriggeredReminders(userInput);

      return aiResponseText;
    } catch (err) {
      console.error('Failed to process message', err);
      return 'State recorded.';
    } finally {
      setIsProcessing(false);
    }
  }, [state, mode, currentTimeString, evaluateEventTriggeredReminders]);

  const updateTaskStatus = useCallback((taskId: string, newStatus: TaskStatus) => {
    setState((prev) => {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const targetTask = prev.tasks.find((t) => t.id === taskId);
      if (!targetTask) return prev;

      if (newStatus === 'DONE') {
        recordTaskInteraction(targetTask.title, targetTask.id, 'COMPLETE', targetTask.category);
      } else if (newStatus === 'ACTIVE') {
        recordTaskInteraction(targetTask.title, targetTask.id, 'START', targetTask.category);
      } else {
        recordTaskInteraction(targetTask.title, targetTask.id, 'UPDATE', targetTask.category);
      }

      let updatedTasks = prev.tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            status: newStatus,
            completedAt: newStatus === 'DONE' ? now : t.completedAt,
          };
        }
        return t;
      });

      // Unblock dependent tasks when blocker completes
      if (newStatus === 'DONE') {
        const completedTitle = targetTask.title.toLowerCase();
        updatedTasks = updatedTasks.map((t) => {
          if (t.status === 'BLOCKED' && t.blockedBy && t.blockedBy.toLowerCase().includes(completedTitle)) {
            return { ...t, status: 'NEXT' as TaskStatus };
          }
          return t;
        });
      }

      let updatedTimeline = [...prev.timeline];
      if (newStatus === 'DONE') {
        updatedTimeline.push({
          id: `time-${Date.now()}`,
          time: now,
          type: 'TASK_COMPLETED',
          description: `Completed: ${targetTask.title}`,
          relatedTaskId: taskId,
          location: prev.current.location,
        });
      } else if (newStatus === 'ACTIVE') {
        updatedTimeline.push({
          id: `time-${Date.now()}`,
          time: now,
          type: 'TASK_STARTED',
          description: `Started: ${targetTask.title}`,
          relatedTaskId: taskId,
          location: prev.current.location,
        });
      }

      return {
        ...prev,
        current: {
          ...prev.current,
          focusTaskId: newStatus === 'ACTIVE' ? taskId : prev.current.focusTaskId === taskId ? null : prev.current.focusTaskId,
        },
        tasks: updatedTasks,
        timeline: updatedTimeline,
      };
    });

    // Check if completing this task triggers any event reminders
    evaluateEventTriggeredReminders(`Completed ${taskId}`);
    refreshLearningProfile();
  }, [refreshLearningProfile, evaluateEventTriggeredReminders]);

  const addTask = useCallback((taskData: Omit<TaskItem, 'id' | 'createdAt'>) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      createdAt: now,
      ...taskData,
    };
    setState((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
      current: {
        ...prev.current,
        focusTaskId: prev.current.focusTaskId === taskId ? null : prev.current.focusTaskId,
      },
    }));
  }, []);

  const editTask = useCallback((taskId: string, updates: Partial<TaskItem>) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
    }));
  }, []);

  const addTimelineEvent = useCallback((eventData: Omit<TimelineEvent, 'id'>) => {
    setState((prev) => ({
      ...prev,
      timeline: [
        ...prev.timeline,
        {
          id: `time-${Date.now()}`,
          ...eventData,
        },
      ],
    }));
  }, []);

  const deleteTimelineEvent = useCallback((eventId: string) => {
    setState((prev) => ({
      ...prev,
      timeline: prev.timeline.filter((e) => e.id !== eventId),
    }));
  }, []);

  const addFixedEvent = useCallback((eventData: Omit<FixedEvent, 'id'>) => {
    setState((prev) => ({
      ...prev,
      fixedEvents: [
        ...prev.fixedEvents,
        {
          id: `fix-${Date.now()}`,
          ...eventData,
        },
      ],
    }));
  }, []);

  const deleteFixedEvent = useCallback((eventId: string) => {
    setState((prev) => ({
      ...prev,
      fixedEvents: prev.fixedEvents.filter((e) => e.id !== eventId),
    }));
  }, []);

  const toggleReminder = useCallback((reminderId: string) => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) =>
        r.id === reminderId ? { ...r, isDone: !r.isDone } : r
      ),
    }));
  }, []);

  const addReminder = useCallback((reminderData: Omit<ReminderItem, 'id' | 'createdAt' | 'isDone'>) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const newId = `rem-${Date.now()}`;
    setState((prev) => ({
      ...prev,
      reminders: [
        ...prev.reminders,
        {
          id: newId,
          createdAt: now,
          isDone: false,
          ...reminderData,
        },
      ],
    }));

    if (reminderData.type === 'TIME_BASED' && reminderData.triggerCondition) {
      scheduleNativeReminder(newId, reminderData.triggerCondition, reminderData.message);
    }
  }, []);

  const deleteReminder = useCallback((reminderId: string) => {
    cancelNativeReminder(reminderId);
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.filter((r) => r.id !== reminderId),
    }));
  }, []);

  const addTimetableSlot = useCallback((slotData: Omit<TimetableSlot, 'id'>) => {
    setState((prev) => ({
      ...prev,
      timetable: [
        ...(prev.timetable || []),
        {
          id: `slot-${Date.now()}`,
          ...slotData,
        },
      ].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));
  }, []);

  const updateTimetableSlot = useCallback((id: string, updates: Partial<TimetableSlot>) => {
    setState((prev) => ({
      ...prev,
      timetable: (prev.timetable || []).map((s) => (s.id === id ? { ...s, ...updates } : s))
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));
  }, []);

  const deleteTimetableSlot = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      timetable: (prev.timetable || []).filter((s) => s.id !== id),
    }));
  }, []);

  const toggleSlotStatus = useCallback((id: string, status: RoutineSlotStatus) => {
    setState((prev) => {
      const slot = (prev.timetable || []).find((s) => s.id === id);
      if (!slot) return prev;

      if (status === 'COMPLETED') {
        recordTaskInteraction(slot.title, slot.id, 'COMPLETE', slot.category);
      } else if (status === 'ACTIVE') {
        recordTaskInteraction(slot.title, slot.id, 'START', slot.category);
      }

      return {
        ...prev,
        timetable: (prev.timetable || []).map((s) => (s.id === id ? { ...s, status } : s)),
      };
    });
    refreshLearningProfile();
  }, [refreshLearningProfile]);

  const syncTimetableToDailyTasks = useCallback(() => {
    setState((prev) => {
      const currentTasks = [...prev.tasks];
      const slots = prev.timetable || [];

      slots.forEach((slot) => {
        const existingTask = currentTasks.find(
          (t) => t.title.toLowerCase() === slot.title.toLowerCase()
        );

        if (!existingTask) {
          currentTasks.push({
            id: `task-routine-${slot.id}`,
            title: slot.title,
            category: slot.category,
            owner: 'ME',
            status: slot.status === 'COMPLETED' ? 'DONE' : slot.status === 'ACTIVE' ? 'ACTIVE' : 'NEXT',
            priority: 8,
            createdAt: slot.startTime,
            scheduledAt: slot.startTime,
            estimatedMinutes: slot.durationMinutes,
            recurring: true,
            recurrenceRule: 'DAILY',
            notes: slot.targetMetric || slot.notes,
          });
        }
      });

      return {
        ...prev,
        tasks: currentTasks,
      };
    });
  }, []);

  const applyTimetablePreset = useCallback((presetType: 'BALANCED' | 'FITNESS_CREATOR' | 'DEEP_WORK') => {
    let presetSlots: Omit<TimetableSlot, 'id'>[] = [];

    if (presetType === 'FITNESS_CREATOR') {
      presetSlots = [
        {
          title: 'High-Protein Breakfast & Hydration',
          category: 'HEALTH',
          startTime: '07:00',
          endTime: '07:45',
          durationMinutes: 45,
          days: 'DAILY',
          status: 'PENDING',
          location: 'HOME',
          isRegularHabit: true,
          targetMetric: '40g protein + 750ml water',
          iconKey: 'breakfast',
        },
        {
          title: 'Gym & Core Strength Session',
          category: 'HEALTH',
          startTime: '07:45',
          endTime: '09:00',
          durationMinutes: 75,
          days: 'DAILY',
          status: 'PENDING',
          location: 'GYM',
          isRegularHabit: true,
          targetMetric: 'Heavy compound lift + stretching',
          iconKey: 'gym',
        },
        {
          title: 'Morning Social Media Post & Engagement',
          category: 'CONTENT',
          startTime: '09:30',
          endTime: '10:15',
          durationMinutes: 45,
          days: 'DAILY',
          status: 'PENDING',
          location: 'OFFICE',
          isRegularHabit: true,
          targetMetric: 'Post reel/thread + 15 min community engagement',
          iconKey: 'social',
        },
        {
          title: 'High Priority Client & Office Deliverables',
          category: 'OFFICE',
          startTime: '10:15',
          endTime: '13:00',
          durationMinutes: 165,
          days: 'WEEKDAYS',
          status: 'PENDING',
          location: 'OFFICE',
          isRegularHabit: true,
          iconKey: 'work',
        },
        {
          title: 'Lunch, Outdoor Sunlight & Walk',
          category: 'HEALTH',
          startTime: '13:00',
          endTime: '14:00',
          durationMinutes: 60,
          days: 'DAILY',
          status: 'PENDING',
          location: 'HOME',
          isRegularHabit: true,
          iconKey: 'lunch',
        },
        {
          title: 'Content Scriptwriting & Video Production',
          category: 'CONTENT',
          startTime: '17:30',
          endTime: '19:00',
          durationMinutes: 90,
          days: 'WEEKDAYS',
          status: 'PENDING',
          location: 'HOME',
          isRegularHabit: true,
          iconKey: 'script',
        },
        {
          title: 'Night Review, Journal & Wind-down',
          category: 'PERSONAL',
          startTime: '21:30',
          endTime: '22:15',
          durationMinutes: 45,
          days: 'DAILY',
          status: 'PENDING',
          location: 'HOME',
          isRegularHabit: true,
          iconKey: 'night',
        },
      ];
    } else if (presetType === 'DEEP_WORK') {
      presetSlots = [
        {
          title: 'Morning Fuel & Day Blueprint',
          category: 'HEALTH',
          startTime: '07:30',
          endTime: '08:15',
          durationMinutes: 45,
          days: 'DAILY',
          status: 'PENDING',
          location: 'HOME',
          isRegularHabit: true,
          iconKey: 'breakfast',
        },
        {
          title: 'Deep Work Block 1 (Hardest Task)',
          category: 'OFFICE',
          startTime: '08:30',
          endTime: '11:30',
          durationMinutes: 180,
          days: 'WEEKDAYS',
          status: 'PENDING',
          location: 'OFFICE',
          isRegularHabit: true,
          iconKey: 'work',
        },
        {
          title: 'Lunch & Screen Detox',
          category: 'HEALTH',
          startTime: '12:30',
          endTime: '13:30',
          durationMinutes: 60,
          days: 'DAILY',
          status: 'PENDING',
          location: 'HOME',
          isRegularHabit: true,
          iconKey: 'lunch',
        },
        {
          title: 'Deep Work Block 2 (Execution)',
          category: 'OFFICE',
          startTime: '13:30',
          endTime: '16:30',
          durationMinutes: 180,
          days: 'WEEKDAYS',
          status: 'PENDING',
          location: 'OFFICE',
          isRegularHabit: true,
          iconKey: 'work',
        },
        {
          title: 'Evening Gym & Functional Movement',
          category: 'HEALTH',
          startTime: '17:30',
          endTime: '18:45',
          durationMinutes: 75,
          days: 'DAILY',
          status: 'PENDING',
          location: 'GYM',
          isRegularHabit: true,
          iconKey: 'gym',
        },
      ];
    } else {
      presetSlots = SAMPLE_TEMPLATE_STATE.timetable.map(({ id, ...rest }) => rest);
    }

    setState((prev) => ({
      ...prev,
      timetable: presetSlots.map((slot, index) => ({
        id: `slot-preset-${Date.now()}-${index}`,
        ...slot,
      })),
    }));
  }, []);

  const setCurrentEnergy = useCallback((energy: EnergyLevel) => {
    setState((prev) => ({
      ...prev,
      current: { ...prev.current, energy },
    }));
  }, []);

  const setCurrentLocation = useCallback((location: string) => {
    setState((prev) => ({
      ...prev,
      current: { ...prev.current, location },
    }));
  }, []);

  const setFocusTask = useCallback((taskId: string | null) => {
    setState((prev) => {
      let updatedTasks = prev.tasks;
      if (taskId) {
        updatedTasks = updatedTasks.map((t) => (t.id === taskId ? { ...t, status: 'ACTIVE' as TaskStatus } : t));
      }
      return {
        ...prev,
        current: { ...prev.current, focusTaskId: taskId },
        tasks: updatedTasks,
      };
    });
  }, []);

  const resetToDefault = useCallback(() => {
    setState(createFreshDailyState());
  }, []);

  const resetToFreshStart = useCallback(() => {
    setState(createFreshDailyState());
  }, []);

  const loadSampleTemplate = useCallback(() => {
    setState(SAMPLE_TEMPLATE_STATE);
  }, []);

  const exportDataJSON = useCallback(() => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const exportDataSheetsCSV = useCallback(() => {
    const todayCSV = `Metric,Value\nDate,${state.date}\nLocation,${state.current.location}\nEnergy,${state.current.energy}\nFocus Task,${state.nextBestAction?.title || 'None'}\nUpdated,${state.current.updatedAt}`;
    
    const tasksCSV = `ID,Title,Category,Owner,Status,Priority,DueAt,BlockedBy,Trigger\n` +
      state.tasks.map(t => `"${t.id}","${t.title}","${t.category}","${t.owner}","${t.status}",${t.priority},"${t.dueAt || ''}","${t.blockedBy || ''}","${t.trigger || ''}"`).join('\n');

    const timelineCSV = `Time,Type,Description,Location,Variance\n` +
      state.timeline.map(e => `"${e.time}","${e.type}","${e.description}","${e.location || ''}","${e.varianceMinutes ? `${e.varianceMinutes}m` : ''}"`).join('\n');

    const waitingCSV = `Title,Owner,Category,Status,Notes\n` +
      state.tasks.filter(t => t.status === 'WAITING' || t.status === 'BLOCKED').map(t => `"${t.title}","${t.owner}","${t.category}","${t.status}","${t.blockedBy || t.notes || ''}"`).join('\n');

    const timetableCSV = `Slot,Category,Time Window,Duration,Days,Status,Goal\n` +
      (state.timetable || []).map(s => `"${s.title}","${s.category}","${s.startTime}-${s.endTime}",${s.durationMinutes},"${s.days}","${s.status}","${s.targetMetric || ''}"`).join('\n');

    return {
      TODAY: todayCSV,
      TIMETABLE: timetableCSV,
      TASKS: tasksCSV,
      TIMELINE: timelineCSV,
      WAITING: waitingCSV,
    };
  }, [state]);

  const importDataJSON = useCallback((jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && Array.isArray(parsed.tasks)) {
        setState({
          ...createFreshDailyState(),
          ...parsed,
        });
        return true;
      }
    } catch (e) {
      console.error('Invalid JSON import', e);
    }
    return false;
  }, []);

  const [isRestoringBackup, setIsRestoringBackup] = useState<boolean>(false);

  const restoreFromGoogleSheetsBackup = useCallback(async (customSpreadsheetId?: string): Promise<{ success: boolean; message?: string }> => {
    setIsRestoringBackup(true);
    try {
      const sheetId = customSpreadsheetId || state.userSettings?.googleSpreadsheetId;
      if (!sheetId) {
        throw new Error('No Google Spreadsheet connected. Please connect your Google account or provide a Spreadsheet ID.');
      }

      const snapshot = await fetchLatestBackupFromGoogleSheets(sheetId);
      if (!snapshot) {
        throw new Error('No backup records found in this Google Spreadsheet.');
      }

      // 1. Restore DailyState
      if (snapshot.state) {
        setState({
          ...createFreshDailyState(),
          ...snapshot.state,
          userSettings: {
            ...DEFAULT_USER_SETTINGS,
            ...(snapshot.state.userSettings || {}),
            googleSpreadsheetId: sheetId,
            googleSpreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
          },
        });
      }

      // 2. Restore AutoLearning Profile
      if (snapshot.learningProfile) {
        saveLearningProfile(snapshot.learningProfile);
        setLearningProfileState(snapshot.learningProfile);
      }

      soundEffects.playTaskDone();
      setNotificationToast(`✅ Restored DayTrace from backup (${snapshot.date})!`);
      return { success: true, message: `Restored ${snapshot.stats?.totalTasks || 0} tasks & ${snapshot.stats?.learningInteractions || 0} learned patterns` };
    } catch (err: any) {
      console.error('Failed to restore backup from Google Sheets:', err);
      const msg = err?.message || 'Failed to restore backup';
      setNotificationToast(`⚠️ Restore Error: ${msg}`);
      return { success: false, message: msg };
    } finally {
      setIsRestoringBackup(false);
    }
  }, [state.userSettings?.googleSpreadsheetId]);

  // WhatsApp-style Automated Nightly Backup (e.g. 02:00 AM)
  useEffect(() => {
    const checkNightlySync = async () => {
      const settings = state.userSettings || DEFAULT_USER_SETTINGS;
      if (settings.enableNightlySync === false || !settings.googleSpreadsheetId) return;

      const now = new Date();
      const currentHour = now.getHours();
      const targetHour = settings.nightlySyncHour ?? 2; // 2 AM
      const todayDateStr = now.toISOString().split('T')[0];

      const lastBackupDate = settings.lastNightlyBackupAt ? settings.lastNightlyBackupAt.split('T')[0] : '';
      if (currentHour === targetHour && lastBackupDate !== todayDateStr) {
        try {
          const res = await syncStateToGoogleSheets(state, settings.googleSpreadsheetId);
          updateUserSettings({
            lastSyncedAt: res.syncedAt,
            lastNightlyBackupAt: now.toISOString(),
          });
          setNotificationToast(`🌙 Nightly Backup: Synced all tasks, logs & learnings to Google Sheets`);
        } catch (e) {
          console.warn('Nightly auto-backup attempt skipped/failed', e);
        }
      }
    };

    const interval = setInterval(checkNightlySync, 60 * 1000);
    return () => clearInterval(interval);
  }, [state, updateUserSettings]);

  const syncToGoogleSheets = useCallback(async (): Promise<{ success: boolean; url?: string; error?: string }> => {
    setIsSyncingSheets(true);
    try {
      const settings = state.userSettings || DEFAULT_USER_SETTINGS;
      const res = await syncStateToGoogleSheets(state, settings.googleSpreadsheetId);
      
      updateUserSettings({
        googleSpreadsheetId: res.spreadsheetId,
        googleSpreadsheetUrl: res.spreadsheetUrl,
        googleSpreadsheetTitle: res.spreadsheetTitle,
        lastSyncedAt: res.syncedAt,
      });

      setNotificationToast(`📊 Synced ${res.rowsAppended} rows + full backup to Google Sheets!`);
      soundEffects.playTaskDone();
      return { success: true, url: res.spreadsheetUrl };
    } catch (err: any) {
      console.error('Google Sheets sync error:', err);
      const errMsg = err?.message || 'Sync failed. Please check permissions.';
      setNotificationToast(`⚠️ Google Sheets Sync: ${errMsg}`);
      return { success: false, error: errMsg };
    } finally {
      setIsSyncingSheets(false);
    }
  }, [state, updateUserSettings]);

  return (
    <DayContext.Provider
      value={{
        state,
        mode,
        setMode,
        isProcessing,
        processUserInput,
        updateTaskStatus,
        addTask,
        deleteTask,
        editTask,
        addTimelineEvent,
        deleteTimelineEvent,
        addFixedEvent,
        deleteFixedEvent,
        toggleReminder,
        addReminder,
        deleteReminder,
        addTimetableSlot,
        updateTimetableSlot,
        deleteTimetableSlot,
        toggleSlotStatus,
        syncTimetableToDailyTasks,
        applyTimetablePreset,
        setCurrentEnergy,
        setCurrentLocation,
        setFocusTask,
        updateUserSettings,
        snoozePrompts,
        isPeriodicPromptOpen,
        setIsPeriodicPromptOpen,
        triggerManualPromptCheck,
        syncToGoogleSheets,
        isSyncingSheets,
        restoreFromGoogleSheetsBackup,
        isRestoringBackup,
        // Deep Work & Pomodoro Focus Engine
        focusTimer,
        startFocusTimer,
        pauseFocusTimer,
        resumeFocusTimer,
        stopFocusTimer,
        extendFocusTimer,
        finishFocusTaskEarly,
        // Voice Memo Quick Capture
        executeVoiceTranscript,
        // Gamification & Rewards Vault
        claimReward,
        addCustomReward,
        awardPoints,
        // Geofence routines
        simulateGeofenceEnter,
        // Modals
        isFocusModalOpen,
        setIsFocusModalOpen,
        isVoiceModalOpen,
        setIsVoiceModalOpen,
        isRewardsModalOpen,
        setIsRewardsModalOpen,
        isGeofenceModalOpen,
        setIsGeofenceModalOpen,
        resetToDefault,
        resetToFreshStart,
        loadSampleTemplate,
        exportDataJSON,
        exportDataSheetsCSV,
        importDataJSON,
        currentTimeString,
        learningProfile,
        recordCustomRoutine,
        resetLearnedShortcuts,
        notificationToast,
        dismissToast,
      }}
    >
      {children}
    </DayContext.Provider>
  );
};

export const useDay = () => {
  const context = useContext(DayContext);
  if (!context) throw new Error('useDay must be used within DayProvider');
  return context;
};
