import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  DailyState, 
  TaskItem, 
  TaskStatus, 
  TaskCategory,
  TimelineEvent, 
  FixedEvent, 
  ReminderItem, 
  Automation,
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
  GeofenceLocation,
  IgnoredLocationCluster,
  MeetingRecord,
  TaskCategoryDefinition,
  UserMemoryItem
} from '../types';
import { createFreshDailyState, DEFAULT_USER_SETTINGS, DEFAULT_GEOFENCE_LOCATIONS, UNCATEGORISED_CATEGORY_ID } from '../utils/initialState';
import { recordTaskInteraction, recordRoutineInteraction, getLearningProfile, resetLearningProfile, saveLearningProfile, AutoLearningProfile } from '../utils/autoLearning';
import { parseOfflineUserInput, generateOfflineEndOfDayReview } from '../utils/offlineParser';
import { contextTriggerLabel, parseVoiceAutomations } from '../utils/localAutomationParser';
import {
  classifyInterruption,
  detectContextEvent,
  inferTaskResources,
  recalculateAccountabilityState,
} from '../utils/accountabilityEngine';
import { classifyUserIntent, executeDayTraceQuery, extractCompoundCheckInIntent, extractSaveCurrentLocationIntent, speakQueryResponse } from '../utils/intentClassifier';
import { scheduleNativeReminder, cancelNativeReminder, promptOnDeviceAi, DayTraceNative, isNativeAndroid, triggerPixelHaptic, persistNativeAutomations, fetchNativePendingState, acknowledgeNativeEvents, syncNativePeriodicPromptConfig, triggerNativeTestPrompt, getCurrentCoordinates, checkNativeNotificationPermission, requestNativeNotificationPermission, deleteNativeMeetingAudio } from '../services/nativeBridge';
import { locationService } from '../services/locationService';
import { soundEffects } from '../services/soundEffects';
import { speechService } from '../services/speechRecognition';
import { DEFAULT_REWARDS, INITIAL_GAMIFICATION_STATE, updateStreak } from '../services/rewardsCatalog';
import { reconcileNativeAccountabilityEvents, selectNativeSuggestedTasks } from '../utils/nativeAccountability';
import {
  createEmptyHistoricalState,
  createNextDailyState,
  getDailySnapshot,
  mergeImportedDailyHistory,
  normalizeDailyStateDates,
  readDailyHistory,
  recoverHistoricalState,
  saveDailySnapshot,
  toLocalDateKey,
} from '../utils/dailyHistory';
import { migrateDailyState } from '../utils/stateMigrations';
import { GeneratedVisualRequest, queueGeneratedVisuals } from '../services/visualAssetService';

export interface DestructiveConfirmationRequest {
  id: string;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export interface LocationNameConflict {
  label: string;
  latitude: number;
  longitude: number;
  existing: GeofenceLocation;
}

const STORAGE_KEY = 'daytrace_state_v2';

const mergeRecordsById = <T extends { id: string }>(imported: T[] = [], current: T[] = []): T[] => {
  const records = new Map<string, T>();
  imported.forEach((item) => records.set(item.id, item));
  current.forEach((item) => records.set(item.id, item));
  return Array.from(records.values());
};

interface DayContextType {
  state: DailyState;
  selectedDate: string;
  isViewingToday: boolean;
  isLoadingHistoricalDate: boolean;
  historicalDateMessage: string | null;
  selectViewDate: (date: string) => Promise<void>;
  automations: Automation[];
  addAutomation: (auto: Omit<Automation, 'id' | 'createdAt'>) => void;
  deleteAutomation: (id: string) => void;
  markAutomationComplete: (id: string) => void;
  snoozeAutomation: (id: string, minutes?: number) => void;
  activeTriggeredAlert: { id: string; title: string; subtitle: string; automationId?: string; reminderId?: string } | null;
  dismissTriggeredAlert: () => void;
  handleAlertAction: (action: 'DONE' | 'SNOOZE', alertId?: string) => void;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isProcessing: boolean;
  processUserInput: (input: string) => Promise<string>;
  saveMemory: (fact: string, options?: Partial<Pick<UserMemoryItem, 'category' | 'source' | 'status' | 'triggerKeywords'>>) => string;
  updateMemory: (memoryId: string, updates: Partial<Pick<UserMemoryItem, 'fact' | 'category' | 'status' | 'triggerKeywords'>>) => void;
  deleteMemory: (memoryId: string) => void;
  startAccountabilityTask: (task: { id?: string; title: string; category?: string }) => void;
  updateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  addTask: (task: Omit<TaskItem, 'id' | 'createdAt'>) => string;
  deleteTask: (taskId: string) => void;
  editTask: (taskId: string, updates: Partial<TaskItem>) => void;
  addTimelineEvent: (event: Omit<TimelineEvent, 'id'>) => void;
  logActivity: (description: string, options?: { location?: string; time?: string; type?: TimelineEvent['type'] }) => string;
  deleteTimelineEvent: (eventId: string) => void;
  addFixedEvent: (event: Omit<FixedEvent, 'id'>) => void;
  deleteFixedEvent: (eventId: string) => void;
  toggleReminder: (reminderId: string) => void;
  addReminder: (reminder: Omit<ReminderItem, 'id' | 'createdAt' | 'isDone'>) => void;
  editReminder: (reminderId: string, updates: Partial<ReminderItem>) => void;
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
  recordPeriodicPromptCompletion: () => void;
  triggerNativePromptTest: (delaySeconds?: number) => Promise<{ scheduled: boolean; delaySeconds: number }>;
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
  claimMilestone: (id: string, label: string, points: number) => boolean;
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
  exportDataJSON: () => string;
  importDataJSON: (jsonStr: string) => boolean;
  currentTimeString: string;
  learningProfile: AutoLearningProfile;
  recordCustomRoutine: (id: string, label: string, prompt: string) => void;
  resetLearnedShortcuts: () => void;
  taskCategories: TaskCategoryDefinition[];
  createTaskCategory: (label: string, color: string, icon: string) => string | null;
  updateTaskCategory: (id: string, updates: Partial<Pick<TaskCategoryDefinition, 'label' | 'color' | 'icon'>>) => void;
  deleteTaskCategory: (id: string, reassignToId: string) => void;
  saveCurrentLocation: (label: string, duplicateMode?: 'UPDATE' | 'CREATE') => Promise<string>;
  saveLearnedLocation: (label: string) => string;
  updateSavedLocation: (id: string, updates: Partial<GeofenceLocation>) => void;
  deleteSavedLocation: (id: string) => void;
  unignoreLocation: (id: string) => void;
  ignoreLocationCluster: (cluster: Omit<IgnoredLocationCluster, 'id' | 'ignoredAt'>) => void;
  pendingLocationLearning: { latitude: number; longitude: number } | null;
  dismissLocationLearning: (ignore: boolean) => void;
  locationNameConflict: LocationNameConflict | null;
  resolveLocationNameConflict: (choice: 'UPDATE' | 'CREATE' | 'CANCEL') => void;
  meetings: MeetingRecord[];
  addMeeting: (meeting: MeetingRecord) => void;
  updateMeeting: (id: string, updates: Partial<MeetingRecord>) => void;
  deleteMeeting: (id: string, mode?: 'AUDIO' | 'TRANSCRIPT' | 'ENTIRE') => void;
  destructiveConfirmation: DestructiveConfirmationRequest | null;
  requestDestructiveConfirmation: (request: Omit<DestructiveConfirmationRequest, 'id'>) => void;
  confirmDestructiveAction: () => void;
  cancelDestructiveAction: () => void;
  undoAction: { label: string; action: () => void } | null;
  performUndo: () => void;
  notificationToast: string | null;
  dismissToast: () => void;
}

const DayContext = createContext<DayContextType | undefined>(undefined);

const taskCompletionPoints = (priority: number): number => {
  if (priority >= 8) return 120;
  if (priority <= 3) return 30;
  return 60;
};

const inferChecklist = (title: string): TaskItem['checklist'] => {
  const isWorkout = /\b(push[ -]?ups?|pull[ -]?ups?|yoga|squats?|workout|gym)\b/i.test(title);
  const parts = title
    .split(/\s*(?:,|;|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
  if (!isWorkout || parts.length < 2) return undefined;
  return parts.map((text, index) => ({ id: `check-${Date.now()}-${index}`, text, isDone: false }));
};

export const DayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DailyState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const hydrated = migrateDailyState({
          ...createFreshDailyState(),
          ...parsed,
          automations: parsed.automations || [],
          gamification: {
            ...INITIAL_GAMIFICATION_STATE,
            ...(parsed.gamification || {}),
          },
          geofenceLocations: parsed.geofenceLocations || [],
        }).state;
        const today = toLocalDateKey();
        if (hydrated.date !== today) {
          saveDailySnapshot(hydrated);
          return createNextDailyState(hydrated, today);
        }
        return hydrated;
      }
    } catch (e) {
      console.error('Failed to load DayTrace state from localStorage', e);
    }
    return createFreshDailyState();
  });
  const stateRef = useRef(state);

  const [selectedDate, setSelectedDate] = useState<string>(state.date);
  const [historicalState, setHistoricalState] = useState<DailyState | null>(null);
  const [isLoadingHistoricalDate, setIsLoadingHistoricalDate] = useState(false);
  const [historicalDateMessage, setHistoricalDateMessage] = useState<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [mode, setMode] = useState<AppMode>('ACCOUNTABILITY');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentTimeString, setCurrentTimeString] = useState<string>('09:45');
  const [learningProfile, setLearningProfileState] = useState<AutoLearningProfile>(() => getLearningProfile());
  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const [destructiveConfirmation, setDestructiveConfirmation] = useState<DestructiveConfirmationRequest | null>(null);
  const [undoAction, setUndoAction] = useState<{ label: string; action: () => void } | null>(null);
  const [pendingLocationLearning, setPendingLocationLearning] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationNameConflict, setLocationNameConflict] = useState<LocationNameConflict | null>(null);
  const [isPeriodicPromptOpen, setIsPeriodicPromptOpen] = useState<boolean>(false);

  // Active triggered alert (Heads-up in-app card)
  const [activeTriggeredAlert, setActiveTriggeredAlert] = useState<{
    id: string;
    title: string;
    subtitle: string;
    automationId?: string;
    reminderId?: string;
  } | null>(null);

  const dismissTriggeredAlert = useCallback(() => {
    setActiveTriggeredAlert(null);
  }, []);

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
  const lastQueryContextRef = useRef<{ targetLocation?: { name: string; id?: string }; triggerType?: 'GEOFENCE_ENTER' | 'GEOFENCE_EXIT' | 'ANY' } | undefined>(undefined);
  const contextualAutomationEvaluatorRef = useRef<(input: string) => void>(() => undefined);

  const dismissToast = useCallback(() => setNotificationToast(null), []);

  const requestDestructiveConfirmation = useCallback((request: Omit<DestructiveConfirmationRequest, 'id'>) => {
    setDestructiveConfirmation({ ...request, id: `destructive-${Date.now()}` });
  }, []);

  const cancelDestructiveAction = useCallback(() => setDestructiveConfirmation(null), []);

  const confirmDestructiveAction = useCallback(() => {
    setDestructiveConfirmation((pending) => {
      if (pending) pending.onConfirm();
      return null;
    });
  }, []);

  const offerUndo = useCallback((label: string, action: () => void) => {
    setUndoAction({ label, action });
    setNotificationToast(`Deleted ${label}.`);
    window.setTimeout(() => setUndoAction((current) => current?.action === action ? null : current), 7000);
  }, []);

  const performUndo = useCallback(() => {
    setUndoAction((current) => {
      current?.action();
      if (current) setNotificationToast(`Restored ${current.label}`);
      return null;
    });
  }, []);

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
    setState((prev) => ({ ...prev, nextBestAction: null }));
    setNotificationToast('Learning memory purged. Suggestions will rebuild only from future activity.');
  }, []);

  const selectViewDate = useCallback(async (date: string) => {
    const today = toLocalDateKey();
    const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
    if (normalizedDate === stateRef.current.date || normalizedDate === today) {
      setSelectedDate(stateRef.current.date);
      setHistoricalState(null);
      setHistoricalDateMessage(null);
      return;
    }

    setSelectedDate(normalizedDate);
    setHistoricalDateMessage(null);
    const localSnapshot = getDailySnapshot(normalizedDate);
    const recovered = recoverHistoricalState(normalizedDate, stateRef.current, localSnapshot);
    setHistoricalState(recovered.state);
    if (recovered.recoveredFromLiveState) saveDailySnapshot(recovered.state);
    setHistoricalDateMessage(recovered.hasRecords ? null : 'No saved records found for this date');
  }, []);

  const isViewingToday = selectedDate === state.date;
  const displayedState = isViewingToday
    ? state
    : historicalState || createEmptyHistoricalState(selectedDate, state);

  const rollForwardIfNeeded = useCallback(() => {
    const today = toLocalDateKey();
    setState((previous) => {
      if (previous.date === today) return previous;
      saveDailySnapshot(previous);
      const next = createNextDailyState(previous, today);
      stateRef.current = next;
      return next;
    });
    setSelectedDate(today);
    setHistoricalState(null);
    setHistoricalDateMessage(null);
  }, []);

  useEffect(() => {
    rollForwardIfNeeded();
    const timer = window.setInterval(rollForwardIfNeeded, 30_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setSelectedDate(toLocalDateKey());
        setHistoricalState(null);
        setHistoricalDateMessage(null);
      } else {
        rollForwardIfNeeded();
      }
    };
    const handlePageHide = () => {
      setSelectedDate(toLocalDateKey());
      setHistoricalState(null);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [rollForwardIfNeeded]);

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

  const claimMilestone = useCallback((id: string, label: string, points: number): boolean => {
    const alreadyClaimed = (stateRef.current.gamification?.milestoneClaims || []).some((claim) => claim.id === id);
    if (alreadyClaimed || points <= 0) return false;
    const claimedAt = new Date().toISOString();
    setState((prev) => {
      const currentGam = prev.gamification || INITIAL_GAMIFICATION_STATE;
      if ((currentGam.milestoneClaims || []).some((claim) => claim.id === id)) return prev;
      return {
        ...prev,
        gamification: updateStreak({
          ...currentGam,
          points: currentGam.points + points,
          milestoneClaims: [
            ...(currentGam.milestoneClaims || []),
            { id, label, points, claimedAt },
          ],
        }),
      };
    });
    setNotificationToast(`🏆 +${points} XP: ${label}`);
    return true;
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
    if (updates.periodicPromptEnabled === true && !stateRef.current.userSettings.periodicPromptEnabled && isNativeAndroid()) {
      void (async () => {
        const before = await checkNativeNotificationPermission();
        const granted = before.granted || await requestNativeNotificationPermission();
        if (!granted) {
          setNotificationToast('Notifications are blocked. Use Retry or Android settings to allow lock-screen prompts.');
        }
      })();
    }
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

  const recordPeriodicPromptCompletion = useCallback(() => {
    setState((prev) => ({
      ...prev,
      nativeAccountability: {
        processedEventIds: prev.nativeAccountability?.processedEventIds || [],
        lastCompletedAtMillis: Date.now(),
      },
    }));
  }, []);

  // Save state to localStorage whenever modified
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save DayTrace state to localStorage', e);
    }
  }, [state]);

  // Visuals are derived data, but their requests must be durable. Queue every
  // real task/timeline/timetable concept here so records created while the Home
  // screen is open and the phone is offline are reconciled after connectivity
  // returns without requiring the user to revisit each tab.
  useEffect(() => {
    const categories = new Map<string, string>((state.taskCategories || []).map((category) => [category.id, category.label]));
    const taskById = new Map<string, TaskItem>((state.tasks || []).map((task) => [task.id, task]));
    const categoryTasks = new Map<string, string[]>();
    const requests: GeneratedVisualRequest[] = [];

    (state.tasks || []).forEach((task) => {
      const categoryLabel = categories.get(task.category) || task.category || 'Uncategorised';
      requests.push({ kind: 'TASK_STICKER', subject: task.title, details: [categoryLabel] });
      categoryTasks.set(categoryLabel, [...(categoryTasks.get(categoryLabel) || []), task.title]);
    });
    (state.timeline || []).forEach((event) => {
      const relatedTask = event.relatedTaskId ? taskById.get(event.relatedTaskId) : undefined;
      const subject = relatedTask?.title || event.description;
      const categoryLabel = relatedTask
        ? categories.get(relatedTask.category) || relatedTask.category
        : event.category || event.type;
      requests.push({ kind: 'TASK_STICKER', subject, details: [categoryLabel] });
    });
    (state.timetable || []).forEach((slot) => {
      requests.push({ kind: 'TASK_STICKER', subject: slot.title, details: [slot.category || 'Schedule'] });
    });
    categoryTasks.forEach((titles, label) => {
      if (label.toLowerCase() !== 'uncategorised') {
        requests.push({ kind: 'CATEGORY_ISLAND', subject: label, details: titles });
      }
    });

    queueGeneratedVisuals(requests);
  }, [state.tasks, state.timeline, state.timetable, state.taskCategories]);

  // Persist active automations for dead-process geofence matching.
  useEffect(() => {
    if (state.automations) {
      persistNativeAutomations(state.automations);
    }
  }, [state.automations]);

  // 1b. Sync periodic accountability prompt configuration with native Android AlarmManager
  useEffect(() => {
    const settings = state.userSettings || DEFAULT_USER_SETTINGS;
    const suggestedTasks = selectNativeSuggestedTasks(state.tasks || [], state.current.focusTaskId);

    syncNativePeriodicPromptConfig({
      enabled: !!settings.periodicPromptEnabled,
      intervalMinutes: settings.periodicPromptIntervalMinutes || 30,
      wakeUpTime: settings.wakeUpTime || '07:00',
      bedTime: settings.bedTime || '23:30',
      gamingModeActive: !!settings.gamingModeActive,
      snoozedUntil: settings.snoozedUntil || null,
      suggestedTasks,
      lastActivityTimestampMillis: state.nativeAccountability?.lastCompletedAtMillis,
    });
  }, [
    state.userSettings?.periodicPromptEnabled,
    state.userSettings?.periodicPromptIntervalMinutes,
    state.userSettings?.wakeUpTime,
    state.userSettings?.bedTime,
    state.userSettings?.gamingModeActive,
    state.userSettings?.snoozedUntil,
    state.tasks,
    state.current.focusTaskId,
    state.nativeAccountability?.lastCompletedAtMillis,
  ]);

  const reconcileBackgroundActivity = useCallback(async () => {
    const pendingState = await fetchNativePendingState();
    if (!pendingState) return;
    const nativeEvents = pendingState.pendingEvents || [];
    const nativeAutos = pendingState.automations || [];
    let baseState = stateRef.current;
    if (nativeAutos.length > 0) {
      const nativeMap = new Map(nativeAutos.map((automation: any) => [automation.id, automation]));
      baseState = {
        ...baseState,
        automations: (baseState.automations || []).map((automation) => {
          const match: any = nativeMap.get(automation.id);
          return match && match.status !== automation.status ? { ...automation, ...match } : automation;
        }),
      };
    }
    const result = reconcileNativeAccountabilityEvents(baseState, nativeEvents);
    if (result.state !== stateRef.current) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.state));
      stateRef.current = result.state;
      setState(result.state);
    }
    if (result.shouldOpenPrompt) setIsPeriodicPromptOpen(true);
    if (result.shouldOpenMeetings) window.dispatchEvent(new Event('daytrace-open-meetings'));
    await acknowledgeNativeEvents(result.acknowledgedEventIds);
  }, []);

  useEffect(() => {
    reconcileBackgroundActivity();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reconcileBackgroundActivity();
      }
    };
    const handleNativeReconcile = () => reconcileBackgroundActivity();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleNativeReconcile);
    window.addEventListener('daytrace-native-reconcile', handleNativeReconcile);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleNativeReconcile);
      window.removeEventListener('daytrace-native-reconcile', handleNativeReconcile);
    };
  }, [reconcileBackgroundActivity]);

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
                  date: prev.date,
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
      if (!isNativeAndroid() && settings.periodicPromptEnabled && !settings.gamingModeActive) {
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
          const intervalMins = settings.periodicPromptIntervalMinutes || 30;
          
          // Calculate time gap since last logged timeline event or state update
          let minsSinceLastActivity = 999;
          if (state.timeline && state.timeline.length > 0) {
            const lastEvent = state.timeline[state.timeline.length - 1];
            const timePart = lastEvent.time.includes('–') ? lastEvent.time.split('–')[1] : lastEvent.time;
            const parts = timePart.split(':');
            if (parts.length >= 2) {
              const lh = parseInt(parts[0], 10);
              const lm = parseInt(parts[1], 10);
              if (!isNaN(lh) && !isNaN(lm)) {
                let diff = (now.getHours() * 60 + now.getMinutes()) - (lh * 60 + lm);
                if (diff < 0) diff += 24 * 60;
                minsSinceLastActivity = diff;
              }
            }
          }

          // Trigger check-in prompt if there is an unexplained activity gap >= intervalMins
          if (minsSinceLastActivity >= intervalMins) {
            const intervalMs = intervalMins * 60 * 1000;
            if (Date.now() - lastPromptTimeRef.current >= intervalMs) {
              lastPromptTimeRef.current = Date.now();
              soundEffects.playPromptChime();
              setIsPeriodicPromptOpen(true);
            }
          }
        }
      }
    };

    checkAlarmsAndPrompts();
    const interval = setInterval(checkAlarmsAndPrompts, 10000);
    return () => clearInterval(interval);
  }, [state.userSettings, state.reminders, state.timeline]);

  // Continuous Geofencing and Location Monitoring
  useEffect(() => {
    const settings = state.userSettings || DEFAULT_USER_SETTINGS;
    if (!settings.geofenceEnabled && !settings.locationLearningEnabled) {
      locationService.stopWatching();
      return;
    }
    const locations = state.geofenceLocations || [];
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
            date: prev.date,
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
    }, locations, {
      enabled: !!settings.locationLearningEnabled,
      dwellMinutes: settings.locationDwellMinutes || 10,
      ignoredClusters: state.ignoredLocationClusters || [],
      onNewLocationDwell: (coords) => setPendingLocationLearning(coords),
    });

    return () => {
      locationService.stopWatching();
    };
  }, [state.geofenceLocations, state.ignoredLocationClusters, state.userSettings?.geofenceEnabled, state.userSettings?.locationLearningEnabled, state.userSettings?.locationDwellMinutes]);

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
                date: prevState.date,
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
          date: prev.date,
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
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    // 0. TOP PRIORITY: Intent Router & Question Classifier (ZERO SIDE EFFECTS FOR QUERIES)
    const classified = classifyUserIntent(rawTranscript, state, lastQueryContextRef.current);
    if (classified.type === 'QUERY' || classified.isQuestion) {
      if (classified.queryDetails?.targetLocation || classified.queryDetails?.triggerType) {
        lastQueryContextRef.current = {
          targetLocation: classified.queryDetails.targetLocation,
          triggerType: classified.queryDetails.triggerType,
        };
      }
      const queryResult = executeDayTraceQuery(rawTranscript, state, nowStr, lastQueryContextRef.current);

      soundEffects.playTaskDone();
      triggerPixelHaptic('light');
      speakQueryResponse(queryResult.spokenText || queryResult.answerText);
      setNotificationToast(queryResult.answerText.replace(/\n+/g, ' · '));

      // Append purely to conversation history for user visibility (ZERO data/task/automation side effects)
      setState((prev) => ({
        ...prev,
        conversationHistory: [
          ...prev.conversationHistory,
          {
            id: `msg-${Date.now()}-user`,
            sender: 'user',
            text: rawTranscript,
            timestamp: nowStr,
          },
          {
            id: `msg-${Date.now()}-ai`,
            sender: 'assistant',
            text: queryResult.answerText,
            timestamp: nowStr,
          },
        ],
      }));
      return;
    }

    if (mode !== 'ACCOUNTABILITY') {
      const modeLabel = mode === 'NORMAL_CHAT' ? 'Normal Chat' : mode === 'RESEARCH' ? 'Research' : 'Creative';
      setNotificationToast(`${modeLabel} mode is read-only. Use the Home AI screen, or switch to Accountability to log this.`);
      return;
    }

    contextualAutomationEvaluatorRef.current(rawTranscript);

    // 1. High priority: Fast local automation & multi-activity parser
    const autoParse = parseVoiceAutomations(rawTranscript, state, nowStr);
    if (autoParse.isAutomation && autoParse.automations.length > 0) {
      soundEffects.playTaskDone();
      triggerPixelHaptic('taskDone');

      setState((prev) => {
        const newAutos: Automation[] = autoParse.automations.map((a, i) => {
          const autoId = `auto-${Date.now()}-${i}`;
          if (a.triggerType === 'TIME' && a.scheduledTime) {
            scheduleNativeReminder(autoId, a.scheduledTime, a.reminderText);
          }
          return {
            id: autoId,
            title: a.title,
            originalVoiceText: a.originalVoiceText || rawTranscript,
            triggerType: a.triggerType,
            contextEvent: a.contextEvent,
            locationId: a.locationId,
            locationName: a.locationName,
            scheduledTime: a.scheduledTime,
            reminderText: a.reminderText,
            status: 'PENDING' as const,
            createdAt: nowStr,
            relatedContext: a.relatedContext,
          };
        });

        return {
          ...prev,
          automations: [...(prev.automations || []), ...newAutos],
        };
      });

      awardPoints(15 * autoParse.automations.length, `Created ${autoParse.automations.length} automation(s)`);
      setNotificationToast(`✓ Created ${autoParse.automations.length} automation(s) from voice`);
      return;
    }

    if (autoParse.timelineLogs.length > 0) {
      soundEffects.playTaskDone();
      triggerPixelHaptic('taskDone');

      setState((prev) => {
        const newEvents: TimelineEvent[] = autoParse.timelineLogs.map((te, i) => ({
          id: `time-voice-${Date.now()}-${i}`,
          date: prev.date,
          time: te.time || nowStr,
          type: te.type || 'EVENT',
          description: te.description,
          location: prev.current.location,
          source: 'CHECK_IN' as const,
          syncStatus: 'PENDING' as const,
        }));

        const lastEv = autoParse.timelineLogs[autoParse.timelineLogs.length - 1];
        const activeWorkTitle = rawTranscript.match(/^(?:i(?:'m| am)?\s+)?working on\s+(.+?)[.!]?$/i)?.[1]?.trim();
        const matchingTask = activeWorkTitle
          ? prev.tasks.find((task) => task.title.toLowerCase() === activeWorkTitle.toLowerCase())
          : undefined;
        const activeTaskId = matchingTask?.id || (activeWorkTitle ? `task-voice-work-${Date.now()}` : undefined);
        const tasks = !activeWorkTitle ? prev.tasks : [
          ...(matchingTask ? [] : [{
            id: activeTaskId!,
            date: prev.date,
            title: activeWorkTitle,
            category: UNCATEGORISED_CATEGORY_ID,
            owner: 'ME' as const,
            status: 'ACTIVE' as const,
            priority: 7,
            createdAt: new Date().toISOString(),
            persistent: true,
            commitmentLevel: 'IMPORTANT' as const,
          }]),
          ...prev.tasks.map((task) => task.id === activeTaskId
            ? { ...task, status: 'ACTIVE' as TaskStatus }
            : task.status === 'ACTIVE'
              ? { ...task, status: 'NEXT' as TaskStatus }
              : task),
        ];
        return recalculateAccountabilityState({
          ...prev,
          current: {
            ...prev.current,
            activity: lastEv ? lastEv.description : prev.current.activity,
            focusTaskId: activeTaskId || prev.current.focusTaskId,
            updatedAt: nowStr,
          },
          tasks,
          timeline: [...prev.timeline, ...newEvents],
        }, { input: rawTranscript, at: new Date().toISOString() });
      });

      awardPoints(15, 'Voice activities logged to timeline');
      setNotificationToast(`✓ Logged activities to timeline`);
      return;
    }

    const parsed = speechService.parseVoiceTranscript(rawTranscript);
    soundEffects.playTaskDone();

    if (parsed.type === 'NEW_REMINDER') {
      const newRemId = `rem-${Date.now()}`;
      const trigger = parsed.timeHint || nowStr;
      const newReminder: ReminderItem = {
        id: newRemId,
        date: state.date,
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
            date: prev.date,
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
        date: state.date,
        title: parsed.titleOrText,
        category: 'OFFICE',
        owner: 'ME',
        status: state.current.focusTaskId ? 'CAPTURED' : 'NEXT',
        priority: 7,
        createdAt: new Date().toISOString(),
        persistent: true,
        commitmentLevel: 'IMPORTANT',
        requiredResources: inferTaskResources({
          id: 'voice-preview',
          title: parsed.titleOrText,
          category: 'OFFICE',
          owner: 'ME',
          status: 'NEXT',
          priority: 7,
          createdAt: new Date().toISOString(),
        }),
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
            date: prev.date,
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
  }, [awardPoints, mode, state]);

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
          date: prev.date,
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

  const evaluateContextualAutomations = useCallback((triggerPhrase: string) => {
    const contextEvent = detectContextEvent(triggerPhrase);
    if (!contextEvent || /\b(remind me|create|set (?:a )?reminder)\b/i.test(triggerPhrase)) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    let firstTriggered: Automation | undefined;
    setState((prev) => {
      const matched: Automation[] = [];
      const automations = (prev.automations || []).map((automation) => {
        if (automation.status === 'PENDING'
          && automation.triggerType === 'CONTEXT_EVENT'
          && automation.contextEvent === contextEvent) {
          matched.push(automation);
          return { ...automation, status: 'TRIGGERED' as const, triggeredAt: now };
        }
        return automation;
      });
      if (!matched.length) return prev;
      firstTriggered = matched[0];
      const triggerEvents: TimelineEvent[] = matched.map((automation, index) => ({
        id: `context-trigger-${Date.now()}-${index}`,
        date: prev.date,
        time: now,
        type: 'REMINDER',
        description: `Triggered: ${automation.reminderText}`,
        relatedAutomationId: automation.id,
        source: 'AUTOMATION',
        syncStatus: 'PENDING',
      }));
      return recalculateAccountabilityState({
        ...prev,
        automations,
        timeline: [...prev.timeline, ...triggerEvents],
      }, { input: triggerPhrase, at: new Date().toISOString() });
    });
    window.setTimeout(() => {
      if (!firstTriggered) return;
      setActiveTriggeredAlert({
        id: firstTriggered.id,
        title: firstTriggered.title,
        subtitle: `${contextTriggerLabel(contextEvent)} • ${firstTriggered.reminderText}`,
        automationId: firstTriggered.id,
      });
      setNotificationToast(`⚡ ${firstTriggered.reminderText}`);
      soundEffects.playPromptChime();
    }, 0);
  }, []);
  contextualAutomationEvaluatorRef.current = evaluateContextualAutomations;

  const applyLatestExplicitCorrection = useCallback((input: string, timestamp: string): string | null => {
    if (!/^(?:no[, ]|actually[, ]|correction\s*[:,-]|i mean\b)/i.test(input.trim())) return null;
    if (/\b(finished|completed|done|cancel|postpone|remind|schedule|make it|move it|change it)\b/i.test(input)) return null;
    const correctedText = input
      .replace(/^(?:no[, ]+|actually[, ]+|correction\s*[:,-]\s*|i mean\s+)/i, '')
      .replace(/[.!?]+$/g, '')
      .trim();
    if (!correctedText) return null;
    const snapshot = stateRef.current;
    const latest = [...snapshot.timeline]
      .map((event, index) => ({ event, index }))
      .reverse()
      .find(({ event }) => event.source !== 'SYSTEM');
    const replacedText = latest?.event.description || '';
    const correctionEventId = latest?.event.id;
    setState((prev) => {
      const timeline = [...prev.timeline];
      const correctionIndex = correctionEventId
        ? timeline.findIndex((event) => event.id === correctionEventId)
        : -1;
      if (correctionIndex >= 0) {
        timeline[correctionIndex] = {
          ...timeline[correctionIndex],
          description: correctedText,
          updatedAt: new Date().toISOString(),
          notes: `${timeline[correctionIndex].notes ? `${timeline[correctionIndex].notes}\n` : ''}Corrected from: ${replacedText}`,
        };
      }
      const accountability = prev.accountability || { corrections: [], carryForwardHistory: [], habitSignals: [], plannedVsActual: [] };
      return recalculateAccountabilityState({
        ...prev,
        current: { ...prev.current, activity: correctedText, updatedAt: timestamp },
        timeline,
        accountability: {
          ...accountability,
          corrections: [
            ...accountability.corrections,
            {
              id: `correction-${Date.now()}`,
              at: new Date().toISOString(),
              correctedText,
              replacedText: replacedText || undefined,
              target: correctionIndex < 0 ? 'ACTIVITY' as const : 'TIMELINE' as const,
            },
          ].slice(-250),
        },
      }, { at: new Date().toISOString() });
    });
    return replacedText
      ? `✓ Corrected the latest activity from “${replacedText}” to “${correctedText}”.`
      : `✓ Current activity corrected to “${correctedText}”.`;
  }, []);

  /** Atomically keeps the Now state and Timeline in agreement. */
  const logActivity = useCallback((
    description: string,
    options: { location?: string; time?: string; type?: TimelineEvent['type'] } = {},
  ): string => {
    const cleaned = description.replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    const timestamp = options.time || new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const createdAt = new Date().toISOString();
    setState((prev) => recalculateAccountabilityState({
      ...prev,
      current: {
        ...prev.current,
        activity: cleaned,
        location: options.location || prev.current.location,
        updatedAt: timestamp,
      },
      timeline: [
        ...prev.timeline,
        {
          id: `time-activity-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: prev.date,
          time: timestamp,
          type: options.type || 'TASK_STARTED',
          description: cleaned,
          location: options.location || prev.current.location,
          source: 'CHECK_IN',
          syncStatus: 'PENDING',
          createdAt,
        },
      ],
    }, { input: cleaned, at: createdAt }));
    return `✓ Added to Timeline at ${timestamp}: ${cleaned}`;
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
      // 0. TOP PRIORITY: Intent Router & Question Classifier (ZERO SIDE EFFECTS FOR QUERIES)
      const classified = classifyUserIntent(userInput, state, lastQueryContextRef.current);
      if (classified.type === 'SAVE_CURRENT_LOCATION') {
        const compoundIntent = extractCompoundCheckInIntent(userInput);
        const locationIntent = extractSaveCurrentLocationIntent(userInput);
        let locationResult = 'Tell me what name to use for this location.';
        let locationApplied = false;
        if (locationIntent) {
          try {
            locationResult = await saveCurrentLocation(locationIntent.label);
            locationApplied = /current location (?:saved as|updated for)/i.test(locationResult);
          } catch (error) {
            locationResult = error instanceof Error
              ? `Location was not saved: ${error.message}`
              : 'Location was not saved because GPS could not be read.';
          }
        }
        const activityDescription = compoundIntent?.activityDescription;
        const answerText = activityDescription
          ? `✓ ${locationResult}\n✓ Added to Timeline at ${userTimestamp}: ${activityDescription}`
          : locationResult;
        setState((prev) => ({
          ...prev,
          current: activityDescription ? {
            ...prev.current,
            ...(locationApplied && locationIntent ? { location: locationIntent.label } : {}),
            activity: activityDescription,
            updatedAt: userTimestamp,
          } : prev.current,
          timeline: activityDescription ? [
            ...prev.timeline,
            {
              id: `time-compound-${Date.now()}`,
              date: prev.date,
              time: userTimestamp,
              type: 'TASK_STARTED' as const,
              description: activityDescription,
              location: locationApplied && locationIntent ? locationIntent.label : prev.current.location,
              source: 'CHECK_IN' as const,
              syncStatus: 'PENDING' as const,
            },
          ] : prev.timeline,
          conversationHistory: [
            ...prev.conversationHistory,
            {
              id: `msg-${Date.now()}`,
              sender: 'ai',
              text: answerText,
              timestamp: userTimestamp,
            },
          ],
        }));
        setNotificationToast(answerText);
        return answerText;
      }
      if (classified.type === 'QUERY' || classified.isQuestion) {
        if (classified.queryDetails?.targetLocation || classified.queryDetails?.triggerType) {
          lastQueryContextRef.current = {
            targetLocation: classified.queryDetails.targetLocation,
            triggerType: classified.queryDetails.triggerType,
          };
        }
        const queryResult = executeDayTraceQuery(userInput, state, userTimestamp, lastQueryContextRef.current);

        soundEffects.playTaskDone();
        triggerPixelHaptic('light');
        speakQueryResponse(queryResult.spokenText || queryResult.answerText);

        // Append assistant response to conversation history (ZERO data/task/automation side effects)
        setState((prev) => ({
          ...prev,
          conversationHistory: [
            ...prev.conversationHistory,
            {
              id: `msg-${Date.now()}`,
              sender: 'assistant',
              text: queryResult.answerText,
              timestamp: userTimestamp,
            },
          ],
        }));

        setNotificationToast(queryResult.answerText.replace(/\n+/g, ' · '));
        return queryResult.answerText;
      }

      if (mode !== 'ACCOUNTABILITY') {
        const modeLabel = mode === 'NORMAL_CHAT' ? 'Normal Chat' : mode === 'RESEARCH' ? 'Research' : 'Creative';
        const answerText = `${modeLabel} mode is read-only. Nothing was logged or changed. Switch to Accountability mode to perform this action.`;
        setState((prev) => ({
          ...prev,
          conversationHistory: [...prev.conversationHistory, {
            id: `msg-${Date.now()}-mode-guard`,
            sender: 'assistant',
            text: answerText,
            timestamp: userTimestamp,
          }],
        }));
        setNotificationToast(answerText);
        return answerText;
      }

      const correctionConfirmation = applyLatestExplicitCorrection(userInput, userTimestamp);
      if (correctionConfirmation) {
        setState((prev) => ({
          ...prev,
          conversationHistory: [...prev.conversationHistory, {
            id: `msg-${Date.now()}-correction`,
            sender: 'assistant',
            text: correctionConfirmation,
            timestamp: userTimestamp,
          }],
        }));
        setNotificationToast(correctionConfirmation);
        return correctionConfirmation;
      }

      // 1. Instant deterministic local automation & activity parser (0ms, 100% offline, privacy first)
      const autoParse = parseVoiceAutomations(userInput, state, userTimestamp);
      if (autoParse.isAutomation && autoParse.automations.length > 0) {
        soundEffects.playTaskDone();
        triggerPixelHaptic('taskDone');

        const newAutos: Automation[] = autoParse.automations.map((a, i) => {
          const autoId = `auto-${Date.now()}-${i}`;
          if (a.triggerType === 'TIME' && a.scheduledTime) {
            scheduleNativeReminder(autoId, a.scheduledTime, a.reminderText);
          }
          return {
            id: autoId,
            title: a.title,
            originalVoiceText: a.originalVoiceText || userInput,
            triggerType: a.triggerType,
            contextEvent: a.contextEvent,
            locationId: a.locationId,
            locationName: a.locationName,
            scheduledTime: a.scheduledTime,
            reminderText: a.reminderText,
            status: 'PENDING' as const,
            createdAt: userTimestamp,
            relatedContext: a.relatedContext,
          };
        });

        const lines = autoParse.automations.map((a) => {
          const triggerLabel =
            a.triggerType === 'CONTEXT_EVENT'
              ? contextTriggerLabel(a.contextEvent)
              : a.triggerType === 'GEOFENCE_EXIT'
              ? `Leaving ${a.locationName || 'location'}`
              : a.triggerType === 'GEOFENCE_ENTER'
              ? `Arriving ${a.locationName || 'location'}`
              : `At ${a.scheduledTime || 'time'}`;
          return `${triggerLabel} → ${a.title}`;
        });

        const confirmation = `✓ ${autoParse.automations.length} automation${
          autoParse.automations.length > 1 ? 's' : ''
        } created:\n${lines.join('\n')}`;

        setState((prev) => ({
          ...prev,
          automations: [...(prev.automations || []), ...newAutos],
          conversationHistory: [
            ...prev.conversationHistory,
            {
              id: `msg-${Date.now()}`,
              sender: 'assistant',
              text: confirmation,
              timestamp: userTimestamp,
            },
          ],
        }));

        awardPoints(15 * autoParse.automations.length, `Created ${autoParse.automations.length} automation(s)`);
        setNotificationToast(`✓ Created ${autoParse.automations.length} automation(s)`);
        return confirmation;
      }

      if (autoParse.timelineLogs.length > 0) {
        soundEffects.playTaskDone();
        triggerPixelHaptic('taskDone');

        const newEvents: TimelineEvent[] = autoParse.timelineLogs.map((te, i) => ({
          id: `time-log-${Date.now()}-${i}`,
          date: state.date,
          time: te.time || userTimestamp,
          type: te.type || 'EVENT',
          description: te.description,
          location: state.current.location,
          source: 'CHECK_IN' as const,
          syncStatus: 'PENDING' as const,
        }));

        const lastEv = autoParse.timelineLogs[autoParse.timelineLogs.length - 1];
        const lines = autoParse.timelineLogs.map((e) => `${e.time ? e.time + ' ' : ''}${e.description}`);
        const confirmation = `✓ Added to timeline:\n${lines.join('\n')}`;

        setState((prev) => {
          const activeWorkTitle = userInput.match(/^(?:i(?:'m| am)?\s+)?working on\s+(.+?)[.!]?$/i)?.[1]?.trim();
          const matchingTask = activeWorkTitle
            ? prev.tasks.find((task) => task.title.toLowerCase() === activeWorkTitle.toLowerCase())
            : undefined;
          const activeTaskId = matchingTask?.id || (activeWorkTitle ? `task-work-${Date.now()}` : undefined);
          const tasks = !activeWorkTitle ? prev.tasks : [
            ...(matchingTask ? [] : [{
              id: activeTaskId!,
              date: prev.date,
              title: activeWorkTitle,
              category: UNCATEGORISED_CATEGORY_ID,
              owner: 'ME' as const,
              status: 'ACTIVE' as const,
              priority: 7,
              createdAt: new Date().toISOString(),
              persistent: true,
              commitmentLevel: 'IMPORTANT' as const,
            }]),
            ...prev.tasks.map((task) => task.id === activeTaskId
              ? { ...task, status: 'ACTIVE' as TaskStatus }
              : task.status === 'ACTIVE'
                ? { ...task, status: 'NEXT' as TaskStatus }
                : task),
          ];
          return recalculateAccountabilityState({
            ...prev,
            current: {
              ...prev.current,
              activity: lastEv ? lastEv.description : prev.current.activity,
              focusTaskId: activeTaskId || prev.current.focusTaskId,
              updatedAt: userTimestamp,
            },
            tasks,
            timeline: [...prev.timeline, ...newEvents],
            conversationHistory: [
              ...prev.conversationHistory,
              {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                text: activeWorkTitle ? `${confirmation}\n• Active task: ${activeWorkTitle}` : confirmation,
                timestamp: userTimestamp,
              },
            ],
          }, { input: userInput, at: new Date().toISOString() });
        });

        awardPoints(15, 'Activities logged to timeline');
        setNotificationToast('✓ Logged activities to timeline');
        evaluateContextualAutomations(userInput);
        return confirmation;
      }

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

      // 2. Robust Offline Deterministic Parser (always succeeds offline with 0 latency).
      // Device actions never upload the full app state or consume cloud tokens.
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
                date: prev.date,
                createdAt: new Date().toISOString(),
                priority: nt.priority || 6,
                persistent: nt.persistent !== false,
                commitmentLevel: nt.commitmentLevel || ((nt.priority || 6) >= 9 ? 'CRITICAL' : (nt.priority || 6) >= 7 ? 'IMPORTANT' : 'STANDARD'),
                requiredResources: nt.requiredResources || inferTaskResources(nt as TaskItem),
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
              date: prev.date,
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
                date: prev.date,
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
              date: prev.date,
              createdAt: new Date().toISOString(),
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

        const interruption = classifyInterruption(userInput);
        const normalizedTimeline = updatedTimeline.map((event) => event.type === 'INTERRUPTION' && !event.classification
          ? { ...event, classification: interruption || 'UNEXPECTED' as const }
          : event);
        if (interruption && !normalizedTimeline.some((event) => event.type === 'INTERRUPTION' && event.notes === userInput)) {
          normalizedTimeline.push({
            id: `interrupt-${Date.now()}`,
            date: prev.date,
            time: userTimestamp,
            type: 'INTERRUPTION',
            description: userInput,
            classification: interruption,
            source: 'CHECK_IN',
            notes: userInput,
            syncStatus: 'PENDING',
          });
        }

        return recalculateAccountabilityState({
          ...prev,
          current: {
            ...prev.current,
            location: newLocation,
            activity: newActivity,
            energy: newEnergy,
            updatedAt: userTimestamp,
          },
          tasks: updatedTasks,
          timeline: normalizedTimeline,
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
        }, { input: userInput, at: new Date().toISOString(), interruption });
      });

      // Check for event-triggered reminders based on user message
      evaluateEventTriggeredReminders(userInput);
      evaluateContextualAutomations(userInput);

      return aiResponseText;
    } catch (err) {
      console.error('Failed to process message', err);
      return 'State recorded.';
    } finally {
      setIsProcessing(false);
    }
  }, [state, mode, currentTimeString, applyLatestExplicitCorrection, evaluateContextualAutomations, evaluateEventTriggeredReminders]);

  const updateTaskStatus = useCallback((taskId: string, newStatus: TaskStatus) => {
    const beforeUpdate = stateRef.current.tasks.find((task) => task.id === taskId);
    const shouldAwardCompletion = newStatus === 'DONE'
      && beforeUpdate?.status !== 'DONE'
      && !beforeUpdate?.xpAwardedAt;
    const awardedPoints = shouldAwardCompletion ? taskCompletionPoints(beforeUpdate?.priority || 5) : 0;
    setState((prev) => {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const nowIso = new Date().toISOString();
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
            ...(shouldAwardCompletion ? { xpAwardedAt: nowIso, xpAwarded: awardedPoints } : {}),
          };
        }
        if (newStatus === 'ACTIVE' && t.status === 'ACTIVE') {
          return { ...t, status: 'NEXT' as TaskStatus };
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
          date: prev.date,
          time: now,
          type: 'TASK_COMPLETED',
          description: `Completed: ${targetTask.title}`,
          relatedTaskId: taskId,
          location: prev.current.location,
        });
      } else if (newStatus === 'ACTIVE') {
        updatedTimeline.push({
          id: `time-${Date.now()}`,
          date: prev.date,
          time: now,
          type: 'TASK_STARTED',
          description: `Started: ${targetTask.title}`,
          relatedTaskId: taskId,
          location: prev.current.location,
        });
      }

      const nextState = recalculateAccountabilityState({
        ...prev,
        current: {
          ...prev.current,
          focusTaskId: newStatus === 'ACTIVE' ? taskId : prev.current.focusTaskId === taskId ? null : prev.current.focusTaskId,
          activity: newStatus === 'ACTIVE' ? `Working on: ${targetTask.title}` : prev.current.activity,
          updatedAt: now,
        },
        tasks: updatedTasks,
        timeline: updatedTimeline,
      }, { at: new Date().toISOString() });
      if (!shouldAwardCompletion) return nextState;
      const currentGam = nextState.gamification || INITIAL_GAMIFICATION_STATE;
      return {
        ...nextState,
        gamification: updateStreak({
          ...currentGam,
          points: currentGam.points + awardedPoints,
          totalTasksCompleted: currentGam.totalTasksCompleted + 1,
        }),
      };
    });

    if (shouldAwardCompletion) setNotificationToast(`✓ Task completed • +${awardedPoints} XP`);

    // Check if completing this task triggers any event reminders
    evaluateEventTriggeredReminders(`Completed ${taskId}`);
    refreshLearningProfile();
  }, [refreshLearningProfile, evaluateEventTriggeredReminders]);

  const addTask = useCallback((taskData: Omit<TaskItem, 'id' | 'createdAt'>) => {
    const now = Date.now();
    const taskId = `task-${now}`;
    const trigger = taskData.scheduledAt || taskData.dueAt;
    const reminderId = `rem-task-${now}`;
    setState((prev) => {
      const newTask: TaskItem = {
        id: taskId,
        date: prev.date,
        createdAt: new Date(now).toISOString(),
        ...taskData,
        persistent: taskData.persistent ?? true,
        commitmentLevel: taskData.commitmentLevel || (taskData.priority >= 9 ? 'CRITICAL' : 'IMPORTANT'),
        checklist: taskData.checklist || inferChecklist(taskData.title),
      };
      newTask.requiredResources = taskData.requiredResources || inferTaskResources(newTask);
      const categoryId = newTask.category || UNCATEGORISED_CATEGORY_ID;
      const existingCategories = prev.taskCategories || [];
      const needsCategory = !existingCategories.some((category) => category.id === categoryId);
      const nowIso = new Date(now).toISOString();
      const categoryLabel = categoryId
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
      return recalculateAccountabilityState({
        ...prev,
        tasks: [newTask, ...prev.tasks],
        taskCategories: needsCategory
          ? [...existingCategories, {
              id: categoryId,
              label: categoryLabel,
              color: '#22D3EE',
              icon: 'sparkles',
              createdAt: nowIso,
              updatedAt: nowIso,
            }]
          : existingCategories,
        reminders: trigger ? [
          ...prev.reminders,
          {
            id: reminderId,
            date: taskData.date || prev.date,
            type: 'TIME_BASED',
            triggerCondition: trigger,
            message: taskData.title,
            relatedTaskId: taskId,
            isDone: false,
            createdAt: new Date(now).toISOString(),
          },
        ] : prev.reminders,
      }, { at: new Date(now).toISOString() });
    });
    if (trigger) scheduleNativeReminder(reminderId, trigger, taskData.title);
    return taskId;
  }, []);

  const startAccountabilityTask = useCallback((selection: { id?: string; title: string; category?: string }) => {
    const cleanTitle = selection.title.trim();
    if (!cleanTitle) return;
    const category = stateRef.current.taskCategories?.some((item) => item.id === selection.category)
      ? selection.category as TaskCategory
      : UNCATEGORISED_CATEGORY_ID;
    const now = new Date();
    const nowTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const knownTask = stateRef.current.tasks.find((task) =>
      (selection.id && task.id === selection.id)
      || task.title.trim().toLowerCase() === cleanTitle.toLowerCase()
    );
    const taskId = knownTask?.id || selection.id || `task-${Date.now()}`;

    setState((prev) => {
      const existing = prev.tasks.find((task) =>
        task.id === taskId
        || task.title.trim().toLowerCase() === cleanTitle.toLowerCase()
      );
      const selectedTask: TaskItem = existing || {
        id: taskId,
        date: prev.date,
        title: cleanTitle,
        category,
        owner: 'ME',
        status: 'ACTIVE',
        priority: 7,
        createdAt: now.toISOString(),
        source: 'ACCOUNTABILITY_PROMPT',
        persistent: true,
        commitmentLevel: 'IMPORTANT',
      };
      const activity = `Working on: ${selectedTask.title}`;
      const hasTask = prev.tasks.some((task) => task.id === taskId);
      const tasks = (hasTask ? prev.tasks : [selectedTask, ...prev.tasks]).map((task) => {
        if (task.id === taskId) return { ...task, status: 'ACTIVE' as TaskStatus };
        if (task.status === 'ACTIVE') return { ...task, status: 'NEXT' as TaskStatus };
        return task;
      });

      return recalculateAccountabilityState({
        ...prev,
        tasks,
        current: {
          ...prev.current,
          focusTaskId: taskId,
          activity,
          updatedAt: nowTime,
        },
        timeline: [
          ...prev.timeline,
          {
            id: `prompt-task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            date: prev.date,
            time: nowTime,
            type: 'TASK_STARTED',
            description: activity,
            relatedTaskId: taskId,
            location: prev.current.location,
            source: 'CHECK_IN',
            syncStatus: 'PENDING',
            createdAt: now.toISOString(),
          },
        ],
        nativeAccountability: {
          processedEventIds: prev.nativeAccountability?.processedEventIds || [],
          lastCompletedAtMillis: now.getTime(),
        },
      }, { input: activity, at: now.toISOString() });
    });

    recordTaskInteraction(cleanTitle, taskId, 'START', category);
    refreshLearningProfile();
  }, [refreshLearningProfile]);

  const deleteTask = useCallback((taskId: string) => {
    const task = stateRef.current.tasks.find((item) => item.id === taskId);
    if (!task) return;
    requestDestructiveConfirmation({
      title: `Delete “${task.title}”?`,
      description: 'The task will be removed from the board. Its existing timeline history will remain.',
      confirmLabel: 'Delete task',
      onConfirm: () => {
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.filter((item) => item.id !== taskId),
          current: {
            ...prev.current,
            focusTaskId: prev.current.focusTaskId === taskId ? null : prev.current.focusTaskId,
          },
        }));
        offerUndo(`“${task.title}”`, () => setState((prev) => ({ ...prev, tasks: [...prev.tasks, task] })));
      },
    });
  }, [offerUndo, requestDestructiveConfirmation]);

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
          date: prev.date,
          ...eventData,
        },
      ],
    }));
  }, []);

  const deleteTimelineEvent = useCallback((eventId: string) => {
    const event = stateRef.current.timeline.find((item) => item.id === eventId);
    if (!event) return;
    requestDestructiveConfirmation({
      title: 'Delete this timeline entry?',
      description: `“${event.description}” will be removed from DayTrace history.`,
      confirmLabel: 'Delete entry',
      onConfirm: () => {
        setState((prev) => ({ ...prev, timeline: prev.timeline.filter((item) => item.id !== eventId) }));
        offerUndo('timeline entry', () => setState((prev) => ({ ...prev, timeline: [...prev.timeline, event] })));
      },
    });
  }, [offerUndo, requestDestructiveConfirmation]);

  const addFixedEvent = useCallback((eventData: Omit<FixedEvent, 'id'>) => {
    setState((prev) => ({
      ...prev,
      fixedEvents: [
        ...prev.fixedEvents,
        {
          id: `fix-${Date.now()}`,
          date: prev.date,
          ...eventData,
        },
      ],
    }));
  }, []);

  const deleteFixedEvent = useCallback((eventId: string) => {
    const event = stateRef.current.fixedEvents.find((item) => item.id === eventId);
    if (!event) return;
    requestDestructiveConfirmation({
      title: `Delete “${event.title}”?`,
      description: 'This fixed event will be removed from the selected day.',
      confirmLabel: 'Delete event',
      onConfirm: () => {
        setState((prev) => ({ ...prev, fixedEvents: prev.fixedEvents.filter((item) => item.id !== eventId) }));
        offerUndo(`“${event.title}”`, () => setState((prev) => ({ ...prev, fixedEvents: [...prev.fixedEvents, event] })));
      },
    });
  }, [offerUndo, requestDestructiveConfirmation]);

  const toggleReminder = useCallback((reminderId: string) => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) =>
        r.id === reminderId ? { ...r, isDone: !r.isDone } : r
      ),
    }));
  }, []);

  const saveMemory = useCallback((
    fact: string,
    options: Partial<Pick<UserMemoryItem, 'category' | 'source' | 'status' | 'triggerKeywords'>> = {},
  ): string => {
    const normalized = fact.trim();
    if (!normalized) return '';
    const id = `memory-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    setState((prev) => {
      // Offline inbox entries are events, not durable facts. The same sentence
      // may be valid on different days, so only normal memories are de-duplicated.
      const existing = options.source === 'OFFLINE_AI_INBOX'
        ? undefined
        : (prev.memories || []).find(
            (item) => item.fact.trim().toLowerCase() === normalized.toLowerCase(),
          );
      if (existing) {
        return {
          ...prev,
          memories: (prev.memories || []).map((item) => item.id === existing.id
            ? {
                ...item,
                ...options,
                updatedAt: now,
              }
            : item),
        };
      }
      return {
        ...prev,
        memories: [
          ...(prev.memories || []),
          {
            id,
            category: options.category || 'GENERAL',
            fact: normalized,
            source: options.source || 'AI_AGENT',
            status: options.status || 'ACTIVE',
            triggerKeywords: options.triggerKeywords,
            createdAt: now,
            updatedAt: now,
          },
        ],
      };
    });
    return id;
  }, []);

  const updateMemory = useCallback((
    memoryId: string,
    updates: Partial<Pick<UserMemoryItem, 'fact' | 'category' | 'status' | 'triggerKeywords'>>,
  ) => {
    setState((prev) => ({
      ...prev,
      memories: (prev.memories || []).map((memory) => memory.id === memoryId
        ? { ...memory, ...updates, updatedAt: Date.now() }
        : memory),
    }));
  }, []);

  const deleteMemory = useCallback((memoryId: string) => {
    setState((prev) => ({
      ...prev,
      memories: (prev.memories || []).filter((memory) => memory.id !== memoryId),
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
          date: prev.date,
          createdAt: new Date().toISOString(),
          isDone: false,
          ...reminderData,
        },
      ],
    }));

    if (reminderData.type === 'TIME_BASED' && reminderData.triggerCondition) {
      scheduleNativeReminder(newId, reminderData.triggerCondition, reminderData.message);
    }
  }, []);

  const editReminder = useCallback((reminderId: string, updates: Partial<ReminderItem>) => {
    const existing = stateRef.current.reminders.find((item) => item.id === reminderId);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.map((item) => item.id === reminderId ? updated : item),
    }));
    if (updated.type === 'TIME_BASED' && updated.triggerCondition) {
      cancelNativeReminder(reminderId);
      scheduleNativeReminder(reminderId, updated.triggerCondition, updated.message);
    }
  }, []);

  const deleteReminder = useCallback((reminderId: string) => {
    const reminder = stateRef.current.reminders.find((item) => item.id === reminderId);
    if (!reminder) return;
    requestDestructiveConfirmation({
      title: `Delete “${reminder.message}”?`,
      description: 'The reminder and its scheduled Android alarm will be removed.',
      confirmLabel: 'Delete reminder',
      onConfirm: () => {
        cancelNativeReminder(reminderId);
        setState((prev) => ({ ...prev, reminders: prev.reminders.filter((item) => item.id !== reminderId) }));
        offerUndo(`“${reminder.message}”`, () => setState((prev) => ({ ...prev, reminders: [...prev.reminders, reminder] })));
      },
    });
  }, [offerUndo, requestDestructiveConfirmation]);

  // Automations CRUD & Actions
  const addAutomation = useCallback((autoData: Omit<Automation, 'id' | 'createdAt'>) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const newId = `auto-${Date.now()}`;
    const newAuto: Automation = {
      id: newId,
      createdAt: now,
      ...autoData,
    };

    setState((prev) => ({
      ...prev,
      automations: [...(prev.automations || []), newAuto],
    }));

    if (newAuto.triggerType === 'TIME' && newAuto.scheduledTime) {
      scheduleNativeReminder(newId, newAuto.scheduledTime, newAuto.reminderText);
    }
  }, []);

  const deleteAutomation = useCallback((id: string) => {
    const automation = (stateRef.current.automations || []).find((item) => item.id === id);
    if (!automation) return;
    requestDestructiveConfirmation({
      title: `Delete “${automation.title}”?`,
      description: 'This automation and its scheduled alarm will be removed.',
      confirmLabel: 'Delete automation',
      onConfirm: () => {
        cancelNativeReminder(id);
        setState((prev) => ({ ...prev, automations: (prev.automations || []).filter((item) => item.id !== id) }));
        offerUndo(`“${automation.title}”`, () => setState((prev) => ({ ...prev, automations: [...(prev.automations || []), automation] })));
      },
    });
  }, [offerUndo, requestDestructiveConfirmation]);

  const markAutomationComplete = useCallback((id: string) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    setState((prev) => {
      const target = (prev.automations || []).find((a) => a.id === id);
      const title = target?.title || 'Automation task';

      const updatedAutomations = (prev.automations || []).map((a) =>
        a.id === id ? { ...a, status: 'COMPLETED' as const, completedAt: nowStr } : a
      );

      const updatedTimeline = [
        ...prev.timeline,
        {
          id: `time-${Date.now()}`,
          date: prev.date,
          time: nowStr,
          type: 'TASK_COMPLETED' as const,
          description: `✓ ${title} — Completed`,
          location: prev.current.location,
          source: 'TASK_COMPLETION' as const,
          syncStatus: 'PENDING' as const,
        },
      ];

      return {
        ...prev,
        automations: updatedAutomations,
        timeline: updatedTimeline,
      };
    });

    triggerPixelHaptic('taskDone');
    soundEffects.playTaskDone();
    awardPoints(20, 'Automation completed');
    setNotificationToast(`✓ Completed automation task`);
    setActiveTriggeredAlert(null);
  }, [awardPoints]);

  const snoozeAutomation = useCallback((id: string, minutes = 10) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const snoozeTime = new Date(Date.now() + minutes * 60 * 1000);
    const snoozeHM = `${String(snoozeTime.getHours()).padStart(2, '0')}:${String(snoozeTime.getMinutes()).padStart(2, '0')}`;

    setState((prev) => {
      const target = (prev.automations || []).find((a) => a.id === id);
      const title = target?.title || 'Automation task';

      const updatedAutomations = (prev.automations || []).map((a) =>
        a.id === id ? { ...a, status: 'SNOOZED' as const, snoozedUntil: snoozeTime.toISOString() } : a
      );

      const updatedTimeline = [
        ...prev.timeline,
        {
          id: `time-${Date.now()}`,
          date: prev.date,
          time: nowStr,
          type: 'EVENT' as const,
          description: `💤 Snoozed: ${title} (${minutes}m)`,
          location: prev.current.location,
          source: 'AUTOMATION' as const,
          syncStatus: 'PENDING' as const,
        },
      ];

      return {
        ...prev,
        automations: updatedAutomations,
        timeline: updatedTimeline,
      };
    });

    scheduleNativeReminder(`snooze-${id}`, snoozeHM, `Snoozed Alert: Task Reminder`);
    setNotificationToast(`💤 Snoozed for ${minutes} min`);
    setActiveTriggeredAlert(null);
  }, []);

  const handleAlertAction = useCallback((action: 'DONE' | 'SNOOZE', alertId?: string) => {
    const alert = activeTriggeredAlert;
    const targetAutoId = alert?.automationId || (alertId?.startsWith('auto-') ? alertId : undefined);
    const targetRemId = alert?.reminderId || (alertId?.startsWith('rem-') ? alertId : undefined);

    if (action === 'DONE') {
      if (targetAutoId) {
        markAutomationComplete(targetAutoId);
      } else if (targetRemId) {
        toggleReminder(targetRemId);
      }
      setActiveTriggeredAlert(null);
    } else if (action === 'SNOOZE') {
      if (targetAutoId) {
        snoozeAutomation(targetAutoId, 10);
      } else {
        snoozePrompts(10);
      }
      setActiveTriggeredAlert(null);
    }
  }, [activeTriggeredAlert, markAutomationComplete, toggleReminder, snoozeAutomation, snoozePrompts]);

  // Native geofenceTransition & notificationAction background listeners
  useEffect(() => {
    if (!isNativeAndroid()) return;

    let geofenceSub: any = null;
    let notificationSub: any = null;

    const setupListeners = async () => {
      try {
        geofenceSub = await DayTraceNative.addListener('geofenceTransition', (data) => {
          const { locationName, transitionType } = data;
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          const isExit = transitionType === 'EXIT';
          const isEnter = transitionType === 'ENTER' || transitionType === 'DWELL';

          setState((prev) => {
            const locLower = (locationName || '').toLowerCase();
            const automations = prev.automations || [];

            const matchedAutos: Automation[] = [];
            const updatedAutos = automations.map((a) => {
              if (a.status === 'PENDING') {
                const autoLocLower = (a.locationName || '').toLowerCase();
                const locMatches = autoLocLower.includes(locLower) || locLower.includes(autoLocLower);
                if (locMatches) {
                  if ((isExit && a.triggerType === 'GEOFENCE_EXIT') || (isEnter && a.triggerType === 'GEOFENCE_ENTER')) {
                    matchedAutos.push(a);
                    return { ...a, status: 'TRIGGERED' as const, triggeredAt: nowStr };
                  }
                }
              }
              return a;
            });

            const newTimeline = [...prev.timeline];

            newTimeline.push({
              id: `geo-${Date.now()}`,
              time: nowStr,
              type: isExit ? 'DEPARTURE' : 'ARRIVAL',
              description: isExit ? `📍 Left ${locationName}` : `📍 Arrived at ${locationName}`,
              location: locationName,
              source: 'GEOFENCE',
              syncStatus: 'PENDING',
            });

            matchedAutos.forEach((a) => {
              newTimeline.push({
                id: `auto-log-${Date.now()}-${a.id}`,
                time: nowStr,
                type: 'EVENT',
                description: `⚡ Reminder: ${a.title}`,
                location: locationName,
                source: 'AUTOMATION',
                syncStatus: 'PENDING',
              });
            });

            if (matchedAutos.length > 0) {
              const primary = matchedAutos[0];
              setActiveTriggeredAlert({
                id: primary.id,
                title: primary.title,
                subtitle: `${isExit ? 'Leaving' : 'Arriving at'} ${locationName}`,
                automationId: primary.id,
              });
              setNotificationToast(`⚡ Reminder: ${primary.title}`);
              triggerPixelHaptic('notification');
            }

            return {
              ...prev,
              current: {
                ...prev.current,
                location: locationName || prev.current.location,
                updatedAt: nowStr,
              },
              automations: updatedAutos,
              timeline: newTimeline,
            };
          });
        });

        notificationSub = await DayTraceNative.addListener('notificationAction', (data) => {
          const { action, reminderId } = data;
          if (action === 'DONE') {
            if (reminderId) {
              markAutomationComplete(reminderId);
            }
          } else if (action === 'SNOOZE') {
            if (reminderId) {
              snoozeAutomation(reminderId, 10);
            }
          } else if (action === 'OPEN_PERIODIC_PROMPT' || action === 'ACCOUNTABILITY_EVENT') {
            window.dispatchEvent(new Event('daytrace-native-reconcile'));
          } else if (action === 'OPEN_MEETINGS') {
            window.dispatchEvent(new Event('daytrace-native-reconcile'));
            window.dispatchEvent(new Event('daytrace-open-meetings'));
          }
        });
      } catch (err) {
        console.warn('Native listener setup skipped in non-native environment', err);
      }
    };

    setupListeners();

    return () => {
      geofenceSub?.remove?.();
      notificationSub?.remove?.();
    };
  }, [markAutomationComplete, snoozeAutomation]);

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
    const slot = (stateRef.current.timetable || []).find((item) => item.id === id);
    if (!slot) return;
    requestDestructiveConfirmation({
      title: `Delete “${slot.title}”?`,
      description: 'This routine slot will be removed. Tasks already created from it will remain.',
      confirmLabel: 'Delete routine',
      onConfirm: () => {
        setState((prev) => ({ ...prev, timetable: (prev.timetable || []).filter((item) => item.id !== id) }));
        offerUndo(`“${slot.title}”`, () => setState((prev) => ({ ...prev, timetable: [...(prev.timetable || []), slot] })));
      },
    });
  }, [offerUndo, requestDestructiveConfirmation]);

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
            date: prev.date,
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
      presetSlots = [
        { title: 'Morning planning', category: 'PERSONAL', startTime: '08:30', endTime: '09:00', durationMinutes: 30, days: 'DAILY', status: 'PENDING', isRegularHabit: true, iconKey: 'default' },
        { title: 'Priority work block', category: 'OFFICE', startTime: '09:00', endTime: '12:00', durationMinutes: 180, days: 'WEEKDAYS', status: 'PENDING', isRegularHabit: true, iconKey: 'work' },
        { title: 'End-of-day review', category: 'PERSONAL', startTime: '18:00', endTime: '18:20', durationMinutes: 20, days: 'DAILY', status: 'PENDING', isRegularHabit: true, iconKey: 'night' },
      ];
    }

    const applyPreset = () => setState((prev) => ({
      ...prev,
      timetable: presetSlots.map((slot, index) => ({
        id: `slot-preset-${Date.now()}-${index}`,
        ...slot,
      })),
    }));
    const existingCount = stateRef.current.timetable?.length || 0;
    if (existingCount === 0) {
      applyPreset();
      return;
    }
    requestDestructiveConfirmation({
      title: `Replace ${existingCount} timetable routine${existingCount === 1 ? '' : 's'}?`,
      description: 'Applying this preset replaces the current timetable. Tasks and timeline history are not deleted.',
      confirmLabel: 'Replace timetable',
      onConfirm: applyPreset,
    });
  }, [requestDestructiveConfirmation]);

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

  const createTaskCategory = useCallback((label: string, color: string, icon: string) => {
    const cleanLabel = label.trim();
    if (!cleanLabel) return null;
    const exists = (stateRef.current.taskCategories || []).some(
      (item) => item.label.toLowerCase() === cleanLabel.toLowerCase(),
    );
    if (exists) {
      setNotificationToast(`A category named “${cleanLabel}” already exists.`);
      return null;
    }
    const now = new Date().toISOString();
    const item: TaskCategoryDefinition = {
      id: `category-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: cleanLabel,
      color: color || '#6B7280',
      icon: icon || 'tag',
      createdAt: now,
      updatedAt: now,
    };
    setState((prev) => ({ ...prev, taskCategories: [...(prev.taskCategories || []), item] }));
    setNotificationToast(`Created category “${cleanLabel}”.`);
    return item.id;
  }, []);

  const updateTaskCategory = useCallback((id: string, updates: Partial<Pick<TaskCategoryDefinition, 'label' | 'color' | 'icon'>>) => {
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      taskCategories: (prev.taskCategories || []).map((item) => item.id === id
        ? { ...item, ...updates, label: updates.label?.trim() || item.label, updatedAt: now }
        : item),
    }));
  }, []);

  const deleteTaskCategory = useCallback((id: string, reassignToId: string) => {
    const category = (stateRef.current.taskCategories || []).find((item) => item.id === id);
    const destination = (stateRef.current.taskCategories || []).find((item) => item.id === reassignToId);
    if (!category || category.isSystem || !destination || destination.id === id) return;
    const affectedCount = stateRef.current.tasks.filter((task) => task.category === id).length;
    requestDestructiveConfirmation({
      title: `Delete category “${category.label}”?`,
      description: `${affectedCount} task${affectedCount === 1 ? '' : 's'} will move to “${destination.label}”. No task will be deleted.`,
      confirmLabel: 'Delete category',
      onConfirm: () => setState((prev) => ({
        ...prev,
        taskCategories: (prev.taskCategories || []).filter((item) => item.id !== id),
        tasks: prev.tasks.map((task) => task.category === id ? { ...task, category: destination.id } : task),
      })),
    });
  }, [requestDestructiveConfirmation]);

  const saveLocationAt = useCallback((label: string, latitude: number, longitude: number, source: 'USER' | 'LEARNED' = 'USER') => {
    const cleanLabel = label.trim();
    const now = new Date().toISOString();
    const location: GeofenceLocation = {
      id: `location-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: cleanLabel,
      latitude,
      longitude,
      radiusMeters: stateRef.current.userSettings.geofenceRadiusMeters || 200,
      source,
      createdAt: now,
      updatedAt: now,
    };
    setState((prev) => ({
      ...prev,
      geofenceLocations: [...(prev.geofenceLocations || []), location],
      current: { ...prev.current, location: cleanLabel, updatedAt: currentTimeString },
    }));
    setNotificationToast(`Current location saved as ${cleanLabel}.`);
    return location;
  }, [currentTimeString]);

  const saveCurrentLocation = useCallback(async (label: string, duplicateMode?: 'UPDATE' | 'CREATE'): Promise<string> => {
    const cleanLabel = label.trim();
    if (!cleanLabel) throw new Error('Enter a name for this location.');
    const coordinates = await getCurrentCoordinates();
    const existing = (stateRef.current.geofenceLocations || []).find(
      (item) => item.name.toLowerCase() === cleanLabel.toLowerCase(),
    );
    if (existing && !duplicateMode) {
      setLocationNameConflict({
        label: cleanLabel,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        existing,
      });
      return `A location named ${cleanLabel} already exists. Choose Update, Create another, or Cancel.`;
    }
    if (existing && duplicateMode === 'UPDATE') {
      setState((prev) => ({
        ...prev,
        geofenceLocations: (prev.geofenceLocations || []).map((item) => item.id === existing.id
          ? { ...item, latitude: coordinates.latitude, longitude: coordinates.longitude, updatedAt: new Date().toISOString() }
          : item),
        current: { ...prev.current, location: existing.name, updatedAt: currentTimeString },
      }));
      return `Current location updated for ${existing.name}.`;
    }
    const finalLabel = existing && duplicateMode === 'CREATE'
      ? `${cleanLabel} ${(stateRef.current.geofenceLocations || []).filter((item) => item.name.toLowerCase().startsWith(cleanLabel.toLowerCase())).length + 1}`
      : cleanLabel;
    saveLocationAt(finalLabel, coordinates.latitude, coordinates.longitude, 'USER');
    return `Current location saved as ${finalLabel}.`;
  }, [currentTimeString, saveLocationAt]);

  const saveLearnedLocation = useCallback((label: string): string => {
    if (!pendingLocationLearning || !label.trim()) return 'Enter a name for this location.';
    saveLocationAt(label, pendingLocationLearning.latitude, pendingLocationLearning.longitude, 'LEARNED');
    setPendingLocationLearning(null);
    return `Current location saved as ${label.trim()}.`;
  }, [pendingLocationLearning, saveLocationAt]);

  const updateSavedLocation = useCallback((id: string, updates: Partial<GeofenceLocation>) => {
    setState((prev) => ({
      ...prev,
      geofenceLocations: (prev.geofenceLocations || []).map((item) => item.id === id
        ? { ...item, ...updates, updatedAt: new Date().toISOString() }
        : item),
    }));
  }, []);

  const deleteSavedLocation = useCallback((id: string) => {
    const location = (stateRef.current.geofenceLocations || []).find((item) => item.id === id);
    if (!location) return;
    requestDestructiveConfirmation({
      title: `Delete location “${location.name}”?`,
      description: 'Location automations that reference it may stop matching. Tasks and timeline history will remain.',
      confirmLabel: 'Delete location',
      onConfirm: () => setState((prev) => ({
        ...prev,
        geofenceLocations: (prev.geofenceLocations || []).filter((item) => item.id !== id),
        current: prev.current.location === location.name ? { ...prev.current, location: 'Unknown' } : prev.current,
      })),
    });
  }, [requestDestructiveConfirmation]);

  const ignoreLocationCluster = useCallback((cluster: Omit<IgnoredLocationCluster, 'id' | 'ignoredAt'>) => {
    const ignored: IgnoredLocationCluster = {
      ...cluster,
      id: `ignored-location-${Date.now()}`,
      ignoredAt: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, ignoredLocationClusters: [...(prev.ignoredLocationClusters || []), ignored] }));
  }, []);

  const unignoreLocation = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      ignoredLocationClusters: (prev.ignoredLocationClusters || []).filter((item) => item.id !== id),
    }));
  }, []);

  const dismissLocationLearning = useCallback((ignore: boolean) => {
    if (ignore && pendingLocationLearning) {
      ignoreLocationCluster({
        latitude: pendingLocationLearning.latitude,
        longitude: pendingLocationLearning.longitude,
        radiusMeters: stateRef.current.userSettings.geofenceRadiusMeters || 200,
      });
    }
    setPendingLocationLearning(null);
  }, [ignoreLocationCluster, pendingLocationLearning]);

  const resolveLocationNameConflict = useCallback((choice: 'UPDATE' | 'CREATE' | 'CANCEL') => {
    const conflict = locationNameConflict;
    setLocationNameConflict(null);
    if (!conflict || choice === 'CANCEL') return;
    if (choice === 'UPDATE') {
      updateSavedLocation(conflict.existing.id, {
        latitude: conflict.latitude,
        longitude: conflict.longitude,
      });
      setNotificationToast(`Updated ${conflict.existing.name} to the current location.`);
      return;
    }
    const count = (stateRef.current.geofenceLocations || []).filter(
      (item) => item.name.toLowerCase().startsWith(conflict.label.toLowerCase()),
    ).length;
    saveLocationAt(`${conflict.label} ${count + 1}`, conflict.latitude, conflict.longitude, 'USER');
  }, [locationNameConflict, saveLocationAt, updateSavedLocation]);

  const addMeeting = useCallback((meeting: MeetingRecord) => {
    setState((prev) => ({ ...prev, meetings: [...(prev.meetings || []).filter((item) => item.id !== meeting.id), meeting] }));
  }, []);

  const updateMeeting = useCallback((id: string, updates: Partial<MeetingRecord>) => {
    setState((prev) => ({
      ...prev,
      meetings: (prev.meetings || []).map((meeting) => meeting.id === id
        ? { ...meeting, ...updates, updatedAt: new Date().toISOString() }
        : meeting),
    }));
  }, []);

  const deleteMeeting = useCallback((id: string, mode: 'AUDIO' | 'TRANSCRIPT' | 'ENTIRE' = 'ENTIRE') => {
    const meeting = (stateRef.current.meetings || []).find((item) => item.id === id);
    if (!meeting) return;
    const consequence = mode === 'AUDIO'
      ? 'The audio recording will be removed; the transcript, summary and tasks will remain.'
      : mode === 'TRANSCRIPT'
        ? 'The transcript and summary will be removed; the audio and tasks will remain.'
        : 'The meeting record, recording, transcript and summary will be removed. Tasks created from action items will remain.';
    requestDestructiveConfirmation({
      title: `${mode === 'AUDIO' ? 'Delete recording from' : mode === 'TRANSCRIPT' ? 'Delete transcript from' : 'Delete'} “${meeting.title}”?`,
      description: consequence,
      confirmLabel: mode === 'ENTIRE' ? 'Delete meeting' : mode === 'AUDIO' ? 'Delete recording' : 'Delete transcript',
      onConfirm: () => {
        if ((mode === 'AUDIO' || mode === 'ENTIRE') && meeting.audioPath) {
          void deleteNativeMeetingAudio(meeting.audioPath).catch((error) => {
            console.warn('Meeting audio deletion failed', error);
            setNotificationToast('The meeting record was updated, but Android could not delete the audio file.');
          });
        }
        setState((prev) => ({
          ...prev,
          meetings: mode === 'ENTIRE'
            ? (prev.meetings || []).filter((item) => item.id !== id)
            : (prev.meetings || []).map((item) => item.id === id
              ? mode === 'AUDIO'
                ? { ...item, audioPath: undefined, updatedAt: new Date().toISOString() }
                : { ...item, transcript: undefined, summary: undefined, actionItems: [], updatedAt: new Date().toISOString() }
              : item),
        }));
      },
    });
  }, [requestDestructiveConfirmation]);

  const resetToDefault = useCallback(() => {
    setState(createFreshDailyState());
  }, []);

  const resetToFreshStart = useCallback(() => {
    setState(createFreshDailyState());
  }, []);

  const exportDataJSON = useCallback(() => {
    return JSON.stringify({
      ...state,
      dailyHistory: readDailyHistory(),
    }, null, 2);
  }, [state]);

  const importDataJSON = useCallback((jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && Array.isArray(parsed.tasks)) {
        mergeImportedDailyHistory(parsed.dailyHistory);
        const { dailyHistory: _archivedDays, ...parsedState } = parsed;
        const imported = migrateDailyState({
          ...createFreshDailyState(),
          ...parsedState,
        }).state;
        setState((current) => migrateDailyState({
          ...imported,
          ...current,
          date: current.date,
          userSettings: { ...imported.userSettings, ...current.userSettings },
          current: { ...imported.current, ...current.current },
          tasks: mergeRecordsById(imported.tasks, current.tasks),
          timeline: mergeRecordsById(imported.timeline, current.timeline),
          fixedEvents: mergeRecordsById(imported.fixedEvents, current.fixedEvents),
          reminders: mergeRecordsById(imported.reminders, current.reminders),
          automations: mergeRecordsById(imported.automations, current.automations),
          timetable: mergeRecordsById(imported.timetable, current.timetable),
          geofenceLocations: mergeRecordsById(imported.geofenceLocations, current.geofenceLocations),
          ignoredLocationClusters: mergeRecordsById(imported.ignoredLocationClusters, current.ignoredLocationClusters),
          taskCategories: mergeRecordsById(imported.taskCategories, current.taskCategories),
          meetings: mergeRecordsById(imported.meetings, current.meetings),
          memories: mergeRecordsById(imported.memories, current.memories),
          conversationHistory: mergeRecordsById(imported.conversationHistory, current.conversationHistory),
          nextBestAction: current.nextBestAction || imported.nextBestAction,
          accountability: {
            corrections: mergeRecordsById(imported.accountability?.corrections, current.accountability?.corrections),
            carryForwardHistory: Array.from(new Map([
              ...(imported.accountability?.carryForwardHistory || []),
              ...(current.accountability?.carryForwardHistory || []),
            ].map((item) => [`${item.taskId}:${item.fromDate}:${item.toDate}`, item])).values()),
            habitSignals: mergeRecordsById(imported.accountability?.habitSignals, current.accountability?.habitSignals),
            plannedVsActual: mergeRecordsById(imported.accountability?.plannedVsActual, current.accountability?.plannedVsActual),
            weeklyInsights: Array.from(new Set([...(imported.accountability?.weeklyInsights || []), ...(current.accountability?.weeklyInsights || [])])),
            lastRecalculatedAt: current.accountability?.lastRecalculatedAt || imported.accountability?.lastRecalculatedAt,
          },
          gamification: {
            ...(imported.gamification || INITIAL_GAMIFICATION_STATE),
            ...(current.gamification || INITIAL_GAMIFICATION_STATE),
            points: Math.max(imported.gamification?.points || 0, current.gamification?.points || 0),
            currentStreakDays: Math.max(imported.gamification?.currentStreakDays || 0, current.gamification?.currentStreakDays || 0),
            longestStreakDays: Math.max(imported.gamification?.longestStreakDays || 0, current.gamification?.longestStreakDays || 0),
            totalFocusMinutes: Math.max(imported.gamification?.totalFocusMinutes || 0, current.gamification?.totalFocusMinutes || 0),
            totalTasksCompleted: Math.max(imported.gamification?.totalTasksCompleted || 0, current.gamification?.totalTasksCompleted || 0),
            totalReviewsCompleted: Math.max(imported.gamification?.totalReviewsCompleted || 0, current.gamification?.totalReviewsCompleted || 0),
            claimedRewards: mergeRecordsById(imported.gamification?.claimedRewards, current.gamification?.claimedRewards),
            customRewards: mergeRecordsById(imported.gamification?.customRewards, current.gamification?.customRewards),
            milestoneClaims: mergeRecordsById(imported.gamification?.milestoneClaims, current.gamification?.milestoneClaims),
          },
          nativeAccountability: {
            processedEventIds: Array.from(new Set([...(imported.nativeAccountability?.processedEventIds || []), ...(current.nativeAccountability?.processedEventIds || [])])),
            lastCompletedAtMillis: Math.max(imported.nativeAccountability?.lastCompletedAtMillis || 0, current.nativeAccountability?.lastCompletedAtMillis || 0) || undefined,
          },
        }).state);
        return true;
      }
    } catch (e) {
      console.error('Invalid JSON import', e);
    }
    return false;
  }, []);

  const triggerNativePromptTest = useCallback(async (delaySeconds: number = 10) => {
    if (isNativeAndroid()) {
      const before = await checkNativeNotificationPermission();
      const granted = before.granted || await requestNativeNotificationPermission();
      if (!granted) {
        setNotificationToast('Notification permission was denied. Retry the test or open Android notification settings.');
        return { scheduled: false, delaySeconds: 0 };
      }
      const res = await triggerNativeTestPrompt(delaySeconds);
      setNotificationToast(res.scheduled
        ? `📱 Lock phone now! Test prompt arrives in ${delaySeconds}s.`
        : 'The test notification could not be scheduled.');
      return res;
    } else {
      setNotificationToast(`📱 Simulating lock-screen check in ${delaySeconds}s...`);
      setTimeout(() => {
        soundEffects.playPromptChime();
        setIsPeriodicPromptOpen(true);
      }, delaySeconds * 1000);
      return { scheduled: true, delaySeconds };
    }
  }, []);

  return (
    <DayContext.Provider
      value={{
        state: displayedState,
        selectedDate,
        isViewingToday,
        isLoadingHistoricalDate,
        historicalDateMessage,
        selectViewDate,
        automations: displayedState.automations || [],
        mode,
        setMode,
        isProcessing,
        processUserInput,
        saveMemory,
        updateMemory,
        deleteMemory,
        startAccountabilityTask,
        updateTaskStatus,
        addTask,
        deleteTask,
        editTask,
        addTimelineEvent,
        logActivity,
        deleteTimelineEvent,
        addFixedEvent,
        deleteFixedEvent,
        toggleReminder,
        addReminder,
        editReminder,
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
        recordPeriodicPromptCompletion,
        triggerNativePromptTest,
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
        // Automations & Background Triggers
        addAutomation,
        deleteAutomation,
        markAutomationComplete,
        snoozeAutomation,
        activeTriggeredAlert,
        dismissTriggeredAlert,
        handleAlertAction,
        // Gamification & Rewards Vault
        claimReward,
        claimMilestone,
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
        exportDataJSON,
        importDataJSON,
        currentTimeString,
        learningProfile,
        recordCustomRoutine,
        resetLearnedShortcuts,
        taskCategories: displayedState.taskCategories || [],
        createTaskCategory,
        updateTaskCategory,
        deleteTaskCategory,
        saveCurrentLocation,
        saveLearnedLocation,
        updateSavedLocation,
        deleteSavedLocation,
        unignoreLocation,
        ignoreLocationCluster,
        pendingLocationLearning,
        dismissLocationLearning,
        locationNameConflict,
        resolveLocationNameConflict,
        meetings: displayedState.meetings || [],
        addMeeting,
        updateMeeting,
        deleteMeeting,
        destructiveConfirmation,
        requestDestructiveConfirmation,
        confirmDestructiveAction,
        cancelDestructiveAction,
        undoAction,
        performUndo,
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
