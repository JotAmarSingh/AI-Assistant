/**
 * Real Capacitor 8 Native Bridge for DayTrace
 * Connects React UI layer directly to DayTraceNativePlugin on Pixel 10a / Android 16
 */

import { registerPlugin, Capacitor, PluginListenerHandle } from '@capacitor/core';
import { GeofenceLocation } from '../types';

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
}

export const DayTraceNative = registerPlugin<DayTraceNativePluginInterface>('DayTraceNative');

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
