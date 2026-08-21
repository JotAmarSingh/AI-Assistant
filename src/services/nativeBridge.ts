/**
 * Native Android & On-Device AI Bridge for DayTrace
 * Implements Android AICore / Prompt API, SpeechRecognizer, AlarmManager, and Geofencing bridge
 */

declare global {
  interface Window {
    AndroidBridge?: {
      promptGeminiNano?: (prompt: string) => string | Promise<string>;
      startSpeechRecognition?: () => void;
      stopSpeechRecognition?: () => void;
      scheduleExactAlarm?: (reminderId: string, triggerTimeMillis: number, title: string, message: string) => void;
      cancelAlarm?: (reminderId: string) => void;
      startLocationUpdates?: () => void;
      getDeviceModel?: () => string;
      isAiCoreAvailable?: () => boolean;
    };
    ai?: {
      languageModel?: {
        capabilities?: () => Promise<{ available: string }>;
        create?: (options?: any) => Promise<{
          prompt: (text: string) => Promise<string>;
          destroy?: () => void;
        }>;
      };
    };
    onNativeSpeechResult?: (transcript: string, isFinal: boolean) => void;
    onNativeSpeechError?: (errorMessage: string) => void;
    onNativeGeofenceTrigger?: (locationName: string) => void;
  }
}

export const isNativeAndroid = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.AndroidBridge ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    (window.navigator as any).standalone
  );
};

export const hasOnDeviceAi = async (): Promise<boolean> => {
  if (window.AndroidBridge?.isAiCoreAvailable) {
    try {
      return Boolean(window.AndroidBridge.isAiCoreAvailable());
    } catch {
      return false;
    }
  }

  if (window.ai?.languageModel) {
    try {
      const caps = await window.ai.languageModel.capabilities?.();
      return caps?.available === 'readily' || caps?.available === 'after-download';
    } catch {
      return false;
    }
  }

  return false;
};

/**
 * Executes a prompt directly on Pixel's on-device NPU / Gemini Nano
 */
export const promptOnDeviceAi = async (promptText: string): Promise<string | null> => {
  // 1. Android AICore bridge
  if (window.AndroidBridge?.promptGeminiNano) {
    try {
      const res = await window.AndroidBridge.promptGeminiNano(promptText);
      return res;
    } catch (e) {
      console.warn('AICore bridge error, falling back', e);
    }
  }

  // 2. Chrome Built-in Prompt API (window.ai)
  if (window.ai?.languageModel) {
    try {
      const session = await window.ai.languageModel.create();
      const output = await session.prompt(promptText);
      session.destroy?.();
      return output;
    } catch (e) {
      console.warn('window.ai Prompt API error, falling back', e);
    }
  }

  return null;
};

/**
 * Schedules an exact native Android Alarm
 */
export const scheduleNativeReminder = (reminderId: string, timeStr: string, message: string) => {
  if (window.AndroidBridge?.scheduleExactAlarm) {
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const target = new Date();
      target.setHours(hours || 9, minutes || 0, 0, 0);
      if (target.getTime() <= Date.now()) {
        target.setDate(target.getDate() + 1); // schedule for tomorrow if time already passed
      }
      window.AndroidBridge.scheduleExactAlarm(reminderId, target.getTime(), 'DayTrace Reminder', message);
    } catch (e) {
      console.warn('Failed to schedule native alarm', e);
    }
  }
};

/**
 * Cancels a scheduled native Android Alarm
 */
export const cancelNativeReminder = (reminderId: string) => {
  if (window.AndroidBridge?.cancelAlarm) {
    try {
      window.AndroidBridge.cancelAlarm(reminderId);
    } catch (e) {
      console.warn('Failed to cancel native alarm', e);
    }
  }
};
