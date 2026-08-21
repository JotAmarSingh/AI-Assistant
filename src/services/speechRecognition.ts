/**
 * Speech Recognition Service for Native Android & Web Capture
 * Supports:
 * 1. Native AndroidBridge Speech Recognition (Android Intent Recognizer)
 * 2. Capacitor / Cordova Speech Recognition Plugin
 * 3. MediaDevices.getUserMedia microphone permissions (Native Webview Audio Stream)
 * 4. Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 */

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
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
    plugins?: {
      speechRecognition?: {
        hasPermission: (success: (has: boolean) => void, error: (err: any) => void) => void;
        requestPermission: (success: () => void, error: (err: any) => void) => void;
        startListening: (success: (matches: string[]) => void, error: (err: any) => void, options?: any) => void;
        stopListening: (success: () => void, error: (err: any) => void) => void;
        isRecognitionAvailable: (success: (available: boolean) => void, error: (err: any) => void) => void;
      };
    };
    onNativeSpeechResult?: (transcript: string, isFinal: boolean) => void;
    onNativeSpeechError?: (errorMessage: string) => void;
  }
}

export type VoiceIntentType = 'TIMELINE_UPDATE' | 'TASK_DONE' | 'NEW_TASK' | 'NEW_REMINDER';

export interface ParsedVoiceIntent {
  rawTranscript: string;
  type: VoiceIntentType;
  titleOrText: string;
  timeHint?: string;
  energyHint?: 'HIGH_FOCUS' | 'NORMAL' | 'LOW_ENERGY';
  locationHint?: string;
  categoryHint?: string;
}

export class SpeechRecognitionService {
  private recognition: any = null;
  private isListening = false;
  private mediaStream: MediaStream | null = null;

  constructor() {
    const SpeechClass = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (SpeechClass) {
      try {
        this.recognition = new SpeechClass();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
      } catch (err) {
        console.warn('SpeechRecognition initialization error:', err);
      }
    }
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.AndroidBridge?.startSpeechRecognition ||
      window.plugins?.speechRecognition ||
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      navigator?.mediaDevices?.getUserMedia
    );
  }

  /**
   * Requests native hardware microphone permission across Android APK, WebView, and browser
   */
  public async requestHardwareMicPermission(): Promise<boolean> {
    // 1. Check Cordova / Capacitor Native Plugin
    if (window.plugins?.speechRecognition) {
      return new Promise((resolve) => {
        window.plugins!.speechRecognition.requestPermission(
          () => resolve(true),
          () => resolve(false)
        );
      });
    }

    // 2. Request Android Native WebView / MediaDevices stream
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaStream = stream;
        // Keep active or release when done
        return true;
      } catch (e: any) {
        console.warn('Microphone hardware permission error:', e);
        return false;
      }
    }

    return true;
  }

  public async startListening(
    onInterim: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (error: string) => void
  ): Promise<boolean> {
    if (this.isListening) {
      this.stopListening();
    }

    // 1. Android Bridge (Native Android app embedding)
    if (window.AndroidBridge?.startSpeechRecognition) {
      try {
        window.onNativeSpeechResult = (transcript: string, isFinal: boolean) => {
          if (isFinal) {
            onFinal(transcript);
            this.isListening = false;
          } else {
            onInterim(transcript);
          }
        };

        window.onNativeSpeechError = (errMsg: string) => {
          onError(errMsg);
          this.isListening = false;
        };

        window.AndroidBridge.startSpeechRecognition();
        this.isListening = true;
        return true;
      } catch (err: any) {
        console.warn('Native AndroidBridge speech error, trying fallback', err);
      }
    }

    // 2. Capacitor / Cordova Native Speech Plugin
    if (window.plugins?.speechRecognition) {
      try {
        window.plugins.speechRecognition.startListening(
          (matches: string[]) => {
            if (matches && matches.length > 0) {
              onFinal(matches[0]);
            }
            this.isListening = false;
          },
          (err: any) => {
            onError(typeof err === 'string' ? err : 'Native speech error');
            this.isListening = false;
          },
          { language: 'en-US', matches: 1 }
        );
        this.isListening = true;
        return true;
      } catch (err) {
        console.warn('Cordova speech recognition error', err);
      }
    }

    // 3. Ensure hardware permission is acquired first for Web / WebView
    const hasMic = await this.requestHardwareMicPermission();
    if (!hasMic && !this.recognition) {
      onError('Microphone permission was not granted. Please allow microphone access in Android app settings.');
      return false;
    }

    // 4. Web Speech API (Chrome / Android System Webview)
    if (!this.recognition) {
      // Re-instantiate if needed
      const SpeechClass = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
      if (SpeechClass) {
        this.recognition = new SpeechClass();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
      }
    }

    if (!this.recognition) {
      onError('Speech Recognition engine not found. You can type directly in the memo box!');
      return false;
    }

    try {
      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (interimTranscript) {
          onInterim(interimTranscript);
        }
        if (finalTranscript) {
          onFinal(finalTranscript.trim());
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('Speech recognition error event:', event.error);
        if (event.error === 'not-allowed') {
          onError('Microphone permission denied. Please enable Microphone permission in Android App Info.');
        } else if (event.error !== 'no-speech') {
          onError(`Mic error: ${event.error}`);
        }
        this.isListening = false;
        this.releaseMicStream();
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.releaseMicStream();
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (e: any) {
      console.warn('Failed to start speech recognition:', e);
      onError(e?.message || 'Could not start microphone');
      this.isListening = false;
      this.releaseMicStream();
      return false;
    }
  }

  public stopListening() {
    if (window.AndroidBridge?.stopSpeechRecognition) {
      try {
        window.AndroidBridge.stopSpeechRecognition();
      } catch {
        // ignore
      }
    }

    if (window.plugins?.speechRecognition) {
      try {
        window.plugins.speechRecognition.stopListening(() => {}, () => {});
      } catch {
        // ignore
      }
    }

    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }

    this.releaseMicStream();
    this.isListening = false;
  }

  private releaseMicStream() {
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      this.mediaStream = null;
    }
  }

  /**
   * Intelligently parses transcript into an actionable intent
   */
  public parseVoiceTranscript(text: string): ParsedVoiceIntent {
    const lower = text.toLowerCase().trim();

    // 1. Reminder Intent
    if (lower.startsWith('remind me') || lower.startsWith('set a reminder') || lower.startsWith("don't forget") || lower.includes('alarm at')) {
      let clean = text
        .replace(/^remind me (to |that )?/i, '')
        .replace(/^set a reminder (to |for )?/i, '')
        .replace(/^don't forget (to )?/i, '');

      let timeHint: string | undefined;
      const timeMatch = clean.match(/(?:at|by|before|for)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (timeMatch) {
        timeHint = timeMatch[1].trim();
      }

      return {
        rawTranscript: text,
        type: 'NEW_REMINDER',
        titleOrText: clean,
        timeHint,
      };
    }

    // 2. Task Completion Intent
    if (lower.startsWith('done with') || lower.startsWith('finished') || lower.startsWith('completed') || lower.startsWith('mark done')) {
      const clean = text
        .replace(/^(done with|finished with|finished|completed|mark done)\s+/i, '')
        .replace(/\.$/, '');

      return {
        rawTranscript: text,
        type: 'TASK_DONE',
        titleOrText: clean,
      };
    }

    // 3. New Task Intent
    if (lower.startsWith('new task') || lower.startsWith('add task') || lower.startsWith('todo') || lower.startsWith('create task')) {
      const clean = text
        .replace(/^(new task|add task|todo|create task)[:\s]+/i, '')
        .replace(/\.$/, '');

      return {
        rawTranscript: text,
        type: 'NEW_TASK',
        titleOrText: clean,
      };
    }

    // 4. Default: Timeline Update / Quick Note
    let energyHint: 'HIGH_FOCUS' | 'NORMAL' | 'LOW_ENERGY' | undefined;
    if (lower.includes('high energy') || lower.includes('in the zone') || lower.includes('hyperfocused') || lower.includes('pumped')) {
      energyHint = 'HIGH_FOCUS';
    } else if (lower.includes('tired') || lower.includes('low energy') || lower.includes('drained') || lower.includes('exhausted')) {
      energyHint = 'LOW_ENERGY';
    }

    let locationHint: string | undefined;
    if (lower.includes('at home') || lower.includes('reached home')) locationHint = 'Home';
    else if (lower.includes('at office') || lower.includes('reached office') || lower.includes('in office')) locationHint = 'Office';
    else if (lower.includes('at gym') || lower.includes('in gym')) locationHint = 'Gym';

    return {
      rawTranscript: text,
      type: 'TIMELINE_UPDATE',
      titleOrText: text,
      energyHint,
      locationHint,
    };
  }
}

export const speechService = new SpeechRecognitionService();
