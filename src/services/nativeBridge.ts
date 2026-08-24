/**
 * Real Capacitor 8 Native Bridge for DayTrace
 * Connects React UI layer directly to DayTraceNativePlugin on Pixel 10a / Android 16
 */

import { registerPlugin, Capacitor, PluginListenerHandle } from '@capacitor/core';
import { GeofenceLocation, Automation, TimelineEvent } from '../types';

export interface DayTraceNativePluginInterface {
  // Speech Recognition
  startSpeechRecognition(): Promise<{ started: boolean; isOnDevice?: boolean }>;
  stopSpeechRecognition(): Promise<{ stopped: boolean }>;
  cancelSpeechRecognition(): Promise<{ cancelled: boolean }>;
  
  // Exact AlarmManager
  scheduleExactAlarm(options: {
    reminderId: string;
    triggerTimeMillis: number;
    title?: string;
    message?: string;
  }): Promise<{ scheduled: boolean; isExact: boolean }>;
  cancelAlarm(options: { reminderId: string }): Promise<{ cancelled: boolean }>;
  canScheduleExactAlarms(): Promise<{ canScheduleExact: boolean }>;

  // Geofencing
  registerGeofences(options: { locations: GeofenceLocation[] }): Promise<{ success: boolean; registeredCount: number }>;
  removeAllGeofences(): Promise<{ success: boolean }>;
  getCurrentLocation(): Promise<{ latitude: number; longitude: number; accuracyMeters: number }>;

  // Native Automation Persistence (Dead-Process Geofence Matching)
  syncNativeAutomations(options: { automations: Automation[] }): Promise<{ success: boolean; count: number }>;
  getNativePendingState(): Promise<{ pendingEvents?: any[]; pendingLogs: any[]; automations: any[] }>;
  acknowledgeNativeEvents(options: { eventIds: string[] }): Promise<{ success: boolean; acknowledged: number }>;
  syncPendingQueue(options: { queue: any }): Promise<{ success: boolean }>;
  getPendingQueue(): Promise<{ queue: any; syncStatus: string; lastQueuedAt: number }>;
  markNativeSyncCompleted(): Promise<{ success: boolean }>;
  configureNightlySync(options: { syncEndpoint?: string; authToken?: string }): Promise<{ scheduled: boolean }>;

  // On-Device AI / Gemini Nano Status Check
  checkGeminiNanoStatus(): Promise<{
    status: 'AVAILABLE' | 'DOWNLOADABLE' | 'DOWNLOADING' | 'UNAVAILABLE';
    hasAiCorePackage: boolean;
    deviceModel: string;
    androidVersion: string;
    sdkInt: number;
  }>;

  // Pixel Haptics
  triggerHaptic(options: { type?: 'light' | 'impactHeavy' | 'taskDone' | 'tick' | 'notification' }): Promise<{ success: boolean }>;

  // Native Accountability Prompts (Lock-Screen & AlarmManager)
  configurePeriodicPrompt(options: {
    enabled: boolean;
    intervalMinutes: number;
    wakeUpTime: string;
    bedTime: string;
    gamingModeActive: boolean;
    snoozedUntilMillis?: number;
    suggestedTasks: Array<{ id: string; title: string; status: string; priority: number }>;
    lastActivityTimestampMillis?: number;
  }): Promise<{ success: boolean; enabled: boolean; intervalMinutes: number; nextTriggerAtMillis?: number }>;

  triggerTestPeriodicPrompt(options?: { delaySeconds?: number }): Promise<{ scheduled: boolean; delaySeconds: number }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  requestAllPermissions(): Promise<{ notifications: boolean; recordAudio: boolean; location: boolean; granted: boolean }>;
  exportJsonBackup(options: { jsonText: string; fileName?: string }): Promise<{ success: boolean; path?: string }>;
  checkNotificationPermission(): Promise<NativeNotificationPermissionStatus>;
  openNotificationSettings(): Promise<{ success: boolean }>;
  requestGoogleSheetsAccess(): Promise<{ accessToken: string; expiresInSeconds: number }>;
  getAppIdentity(): Promise<NativeAppIdentity>;
  clearGoogleSheetsAccess(): Promise<{ success: boolean }>;
  revokeGoogleSheetsAccess(): Promise<{ success: boolean; revoked: boolean }>;

  // Meeting Mode foreground recording
  startMeetingRecording(options: { meetingId: string; title: string }): Promise<NativeMeetingRecordingState>;
  pauseMeetingRecording(): Promise<NativeMeetingRecordingState>;
  resumeMeetingRecording(): Promise<NativeMeetingRecordingState>;
  stopMeetingRecording(): Promise<NativeMeetingRecordingState>;
  getMeetingRecordingState(): Promise<NativeMeetingRecordingState>;
  deleteMeetingAudio(options: { audioPath: string }): Promise<{ deleted: boolean }>;

  // Event Listeners
  addListener(
    eventName: 'speechResult',
    listenerFunc: (data: { transcript: string; isFinal: boolean }) => void
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'speechStatus',
    listenerFunc: (data: { status: 'ready' | 'listening' | 'processing' }) => void
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'speechError',
    listenerFunc: (data: { error: string; code?: number }) => void
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'geofenceTransition',
    listenerFunc: (data: { locationId: string; locationName: string; transitionType: 'ENTER' | 'EXIT' | 'DWELL'; timestamp: number }) => void
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'notificationAction',
    listenerFunc: (data: { action: 'DONE' | 'SNOOZE' | string; reminderId?: string; locationName?: string; timestamp: number }) => void
  ): Promise<PluginListenerHandle>;
}

export const DayTraceNative = registerPlugin<DayTraceNativePluginInterface>('DayTraceNative');

export interface NativeNotificationPermissionStatus {
  granted: boolean;
  status: 'GRANTED' | 'DENIED' | 'NOT_REQUESTED';
  runtimeGranted: boolean;
  notificationsEnabled: boolean;
  channelEnabled: boolean;
  canRequest: boolean;
}

export interface NativeAppIdentity {
  packageName: string;
  sha1: string;
  versionName: string;
  versionCode: number;
  buildType: string;
}

export interface NativeMeetingRecordingState {
  meetingId: string;
  title: string;
  status: 'IDLE' | 'RECORDING' | 'PAUSED' | 'STOPPED' | 'INTERRUPTED' | 'FAILED';
  startedAtMillis: number;
  endedAtMillis?: number;
  durationSeconds: number;
  audioPath?: string;
  error?: string;
}

/**
 * Strict Native Platform Detection using Capacitor
 * Never confuses standalone PWA or browser window with native APK
 */
export const isNativeAndroid = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

/**
 * Runtime Feature Detection for On-Device Gemini Nano / AICore Prompt API
 */
export const checkOnDeviceAiAvailability = async (): Promise<{
  available: boolean;
  status: 'AVAILABLE' | 'DOWNLOADABLE' | 'DOWNLOADING' | 'UNAVAILABLE';
  provider: 'AICORE_NATIVE' | 'WINDOW_AI' | 'NONE';
  deviceDetails?: any;
}> => {
  // 1. Check Native Android AICore status on Pixel
  if (isNativeAndroid()) {
    try {
      const res = await DayTraceNative.checkGeminiNanoStatus();
      if (res && res.status === 'AVAILABLE') {
        return {
          available: true,
          status: 'AVAILABLE',
          provider: 'AICORE_NATIVE',
          deviceDetails: res,
        };
      }
      return {
        available: false,
        status: res?.status || 'UNAVAILABLE',
        provider: 'NONE',
        deviceDetails: res,
      };
    } catch (e) {
      console.warn('Native checkGeminiNanoStatus error:', e);
    }
  }

  // 2. Check Chrome Built-in Prompt API (window.ai) in web preview
  if (typeof window !== 'undefined' && (window as any).ai?.languageModel) {
    try {
      const caps = await (window as any).ai.languageModel.capabilities?.();
      const status = caps?.available === 'readily' ? 'AVAILABLE' : caps?.available === 'after-download' ? 'DOWNLOADABLE' : 'UNAVAILABLE';
      return {
        available: status === 'AVAILABLE',
        status,
        provider: status === 'AVAILABLE' ? 'WINDOW_AI' : 'NONE',
      };
    } catch {
      // ignore
    }
  }

  return {
    available: false,
    status: 'UNAVAILABLE',
    provider: 'NONE',
  };
};

/**
 * Executes a prompt on-device if verified available
 */
export const promptOnDeviceAi = async (promptText: string): Promise<string | null> => {
  const aiStatus = await checkOnDeviceAiAvailability();
  if (!aiStatus.available) {
    return null;
  }

  if (aiStatus.provider === 'WINDOW_AI' && (window as any).ai?.languageModel) {
    try {
      const session = await (window as any).ai.languageModel.create();
      const output = await session.prompt(promptText);
      session.destroy?.();
      return output;
    } catch (e) {
      console.warn('window.ai Prompt API error', e);
    }
  }

  return null;
};

/**
 * Schedules an exact native Android Alarm via AlarmManager
 */
export const scheduleNativeReminder = async (reminderId: string, timeStr: string, message: string) => {
  if (!isNativeAndroid()) return;

  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const target = new Date();
    target.setHours(hours || 9, minutes || 0, 0, 0);
    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1); // schedule for tomorrow if time already passed
    }

    await DayTraceNative.scheduleExactAlarm({
      reminderId,
      triggerTimeMillis: target.getTime(),
      title: 'DayTrace Reminder',
      message,
    });
  } catch (e) {
    console.warn('Failed to schedule native alarm via Capacitor plugin', e);
  }
};

/**
 * Cancels a scheduled native Android Alarm
 */
export const cancelNativeReminder = async (reminderId: string) => {
  if (!isNativeAndroid()) return;

  try {
    await DayTraceNative.cancelAlarm({ reminderId });
  } catch (e) {
    console.warn('Failed to cancel native alarm', e);
  }
};

/**
 * Triggers native Pixel haptic motor
 */
export const triggerPixelHaptic = async (type: 'light' | 'impactHeavy' | 'taskDone' | 'tick' | 'notification' = 'taskDone') => {
  if (!isNativeAndroid()) return;
  try {
    await DayTraceNative.triggerHaptic({ type });
  } catch {
    // fallback or ignore
  }
};

/**
 * Synchronizes active automations with Android native SharedPreferences
 * Allows GeofenceBroadcastReceiver to match tasks even when the app process is terminated
 */
export const persistNativeAutomations = async (automations: Automation[]) => {
  if (!isNativeAndroid()) return;
  try {
    await DayTraceNative.syncNativeAutomations({ automations });
  } catch (e) {
    console.warn('Failed to sync automations to native storage:', e);
  }
};

/**
 * Reconciles background geofence/alarm triggers and completion actions logged by native receivers
 */
export const fetchNativePendingState = async (): Promise<{ pendingEvents: any[]; pendingLogs: any[]; automations: any[] } | null> => {
  if (!isNativeAndroid()) return null;
  try {
    const state = await DayTraceNative.getNativePendingState();
    return { ...state, pendingEvents: state.pendingEvents || state.pendingLogs || [] };
  } catch (e) {
    console.warn('Failed to retrieve native pending state:', e);
    return null;
  }
};

export const acknowledgeNativeEvents = async (eventIds: string[]): Promise<number> => {
  if (!isNativeAndroid() || eventIds.length === 0) return 0;
  try {
    const result = await DayTraceNative.acknowledgeNativeEvents({ eventIds });
    return result.acknowledged;
  } catch (e) {
    console.warn('Failed to acknowledge native accountability events:', e);
    return 0;
  }
};

/**
 * Persists the unified pending sync queue to Android SharedPreferences
 * so NightlySyncWorker and background services access the same dataset as manual sync
 */
export const persistNativeSyncQueue = async (queue: {
  pendingTimeline: any[];
  pendingTasks: any[];
  pendingAutomations: any[];
  pendingReminders: any[];
  dailySummary?: any;
}) => {
  if (!isNativeAndroid()) return;
  try {
    await DayTraceNative.syncPendingQueue({ queue });
  } catch (e) {
    console.warn('Failed to persist sync queue to native storage:', e);
  }
};

/**
 * Retrieves the unified pending sync queue status from native storage
 */
export const fetchNativeSyncQueue = async (): Promise<{ queue: any; syncStatus: string; lastQueuedAt: number } | null> => {
  if (!isNativeAndroid()) return null;
  try {
    return await DayTraceNative.getPendingQueue();
  } catch (e) {
    console.warn('Failed to retrieve native sync queue:', e);
    return null;
  }
};

/**
 * Marks native sync queue as completed after successful Google Sheets sync
 */
export const markNativeSyncCompleted = async () => {
  if (!isNativeAndroid()) return;
  try {
    await DayTraceNative.markNativeSyncCompleted();
  } catch (e) {
    console.warn('Failed to mark native sync completed:', e);
  }
};

/**
 * Synchronizes accountability prompt configuration with native Android AlarmManager
 */
export const syncNativePeriodicPromptConfig = async (config: {
  enabled: boolean;
  intervalMinutes: number;
  wakeUpTime: string;
  bedTime: string;
  gamingModeActive: boolean;
  snoozedUntil?: string | null;
  suggestedTasks: Array<{ id: string; title: string; status: string; priority: number }>;
  lastActivityTimestampMillis?: number;
}) => {
  if (!isNativeAndroid()) return;
  try {
    await DayTraceNative.configurePeriodicPrompt({
      enabled: config.enabled,
      intervalMinutes: config.intervalMinutes,
      wakeUpTime: config.wakeUpTime,
      bedTime: config.bedTime,
      gamingModeActive: config.gamingModeActive,
      snoozedUntilMillis: config.snoozedUntil ? Date.parse(config.snoozedUntil) || 0 : 0,
      suggestedTasks: config.suggestedTasks,
      lastActivityTimestampMillis: config.lastActivityTimestampMillis || 0,
    });
  } catch (e) {
    console.warn('Failed to configure native periodic prompt:', e);
  }
};

/**
 * Triggers a test lock-screen accountability notification (e.g. in 10 seconds)
 */
export const triggerNativeTestPrompt = async (delaySeconds: number = 10): Promise<{ scheduled: boolean; delaySeconds: number }> => {
  if (!isNativeAndroid()) {
    return { scheduled: false, delaySeconds: 0 };
  }
  try {
    return await DayTraceNative.triggerTestPeriodicPrompt({ delaySeconds });
  } catch (e) {
    console.warn('Failed to trigger test prompt:', e);
    return { scheduled: false, delaySeconds: 0 };
  }
};

/**
 * Requests POST_NOTIFICATIONS permission on Android 13+ (API 33+)
 */
export const requestNativeNotificationPermission = async (): Promise<boolean> => {
  if (!isNativeAndroid()) return true;
  try {
    const result = await DayTraceNative.requestNotificationPermission();
    return result.granted;
  } catch (e) {
    console.warn('Failed to request notification permission:', e);
    return false;
  }
};

export const requestAllNativePermissions = async (): Promise<{ notifications: boolean; recordAudio: boolean; location: boolean; granted: boolean }> => {
  if (!isNativeAndroid()) return { notifications: true, recordAudio: true, location: true, granted: true };
  try {
    return await DayTraceNative.requestAllPermissions();
  } catch (e) {
    console.warn('Failed to request all native permissions:', e);
    return { notifications: false, recordAudio: false, location: false, granted: false };
  }
};

export const exportNativeJsonBackup = async (jsonText: string, fileName: string): Promise<{ success: boolean; path?: string }> => {
  if (isNativeAndroid()) {
    try {
      return await DayTraceNative.exportJsonBackup({ jsonText, fileName });
    } catch (e) {
      console.warn('Native backup export error:', e);
    }
  }
  try {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    return { success: true };
  } catch (e) {
    return { success: false };
  }
};

/** Uses Android Google Identity Services instead of loading the browser GIS SDK in a WebView. */
export const requestNativeGoogleSheetsAccess = async (): Promise<string> => {
  if (!isNativeAndroid()) {
    throw new Error('Native Google authorization is only available in the Android app.');
  }
  const result = await DayTraceNative.requestGoogleSheetsAccess();
  if (!result?.accessToken) {
    throw new Error('Google authorization did not return an access token.');
  }
  return result.accessToken;
};

export const getNativeAppIdentity = async (): Promise<NativeAppIdentity | null> => {
  if (!isNativeAndroid()) return null;
  try {
    return await DayTraceNative.getAppIdentity();
  } catch (error) {
    console.warn('Failed to read installed Android app identity:', error);
    return null;
  }
};

export const clearNativeGoogleSheetsAccess = async (): Promise<void> => {
  if (!isNativeAndroid()) return;
  await DayTraceNative.clearGoogleSheetsAccess();
};

export const revokeNativeGoogleSheetsAccess = async (): Promise<void> => {
  if (!isNativeAndroid()) return;
  await DayTraceNative.revokeGoogleSheetsAccess();
};

export const checkNativeNotificationPermission = async (): Promise<NativeNotificationPermissionStatus> => {
  if (!isNativeAndroid()) {
    return { granted: true, status: 'GRANTED', runtimeGranted: true, notificationsEnabled: true, channelEnabled: true, canRequest: false };
  }
  try {
    return await DayTraceNative.checkNotificationPermission();
  } catch (e) {
    console.warn('Failed to check Android notification permission:', e);
    return { granted: false, status: 'DENIED', runtimeGranted: false, notificationsEnabled: false, channelEnabled: false, canRequest: false };
  }
};

export const openNativeNotificationSettings = async (): Promise<boolean> => {
  if (!isNativeAndroid()) return false;
  try {
    const result = await DayTraceNative.openNotificationSettings();
    return result.success;
  } catch (e) {
    console.warn('Failed to open Android notification settings:', e);
    return false;
  }
};

export const getCurrentCoordinates = async (): Promise<{ latitude: number; longitude: number; accuracyMeters: number }> => {
  if (isNativeAndroid()) return DayTraceNative.getCurrentLocation();
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Location is not available on this device.');
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
      }),
      (error) => reject(new Error(error.message || 'Could not get current location.')),
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 15_000 },
    );
  });
};

export const getNativeMeetingRecordingState = async (): Promise<NativeMeetingRecordingState> => {
  if (!isNativeAndroid()) {
    return { meetingId: '', title: '', status: 'IDLE', startedAtMillis: 0, durationSeconds: 0 };
  }
  return DayTraceNative.getMeetingRecordingState();
};

export const startNativeMeetingRecording = async (meetingId: string, title: string): Promise<NativeMeetingRecordingState> => {
  if (!isNativeAndroid()) throw new Error('Background Meeting Mode recording requires the Android app.');
  return DayTraceNative.startMeetingRecording({ meetingId, title });
};

export const pauseNativeMeetingRecording = async (): Promise<NativeMeetingRecordingState> => DayTraceNative.pauseMeetingRecording();
export const resumeNativeMeetingRecording = async (): Promise<NativeMeetingRecordingState> => DayTraceNative.resumeMeetingRecording();
export const stopNativeMeetingRecording = async (): Promise<NativeMeetingRecordingState> => DayTraceNative.stopMeetingRecording();

export const deleteNativeMeetingAudio = async (audioPath: string): Promise<boolean> => {
  if (!isNativeAndroid() || !audioPath) return false;
  const result = await DayTraceNative.deleteMeetingAudio({ audioPath });
  return result.deleted;
};
