/**
 * Speech Recognition Service for Pixel 10a / Android 16 & Web Fallback
 * Primary: Real Native SpeechRecognizer via DayTraceNative Capacitor plugin (On-Device Preferred)
 * Fallback: Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 */

import { DayTraceNative, isNativeAndroid } from './nativeBridge';
import { PluginListenerHandle } from '@capacitor/core';

export type VoiceIntentType = 'QUERY' | 'TIMELINE_UPDATE' | 'TASK_DONE' | 'NEW_TASK' | 'NEW_REMINDER';

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
  private nativeListeners: PluginListenerHandle[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechClass) {
        try {
          this.recognition = new SpeechClass();
          this.recognition.continuous = false;
          this.recognition.interimResults = true;
          this.recognition.lang = 'en-US';
        } catch (err) {
          console.warn('SpeechRecognition init error:', err);
        }
      }
    }
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return isNativeAndroid() || Boolean(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      navigator?.mediaDevices?.getUserMedia
    );
  }

  public async startListening(
    onInterim: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (error: string) => void
  ): Promise<boolean> {
    if (this.isListening) {
      await this.stopListening();
    }

    // 1. PRIMARY: Native Pixel Android SpeechRecognizer via Capacitor Plugin
    if (isNativeAndroid()) {
      try {
        // Clear previous native listeners
        for (const handle of this.nativeListeners) {
          await handle.remove();
        }
        this.nativeListeners = [];

        const resultHandle = await DayTraceNative.addListener('speechResult', (data) => {
          if (data.isFinal) {
            onFinal(data.transcript);
            this.isListening = false;
          } else {
            onInterim(data.transcript);
          }
        });
        this.nativeListeners.push(resultHandle);

        const errorHandle = await DayTraceNative.addListener('speechError', (data) => {
          onError(data.error || 'Native speech recognition error');
          this.isListening = false;
        });
        this.nativeListeners.push(errorHandle);

        const startRes = await DayTraceNative.startSpeechRecognition();
        this.isListening = true;
        return Boolean(startRes?.started);
      } catch (err: any) {
        console.warn('Native DayTraceNative speech error, falling back to Web Speech API', err);
      }
    }

    // 2. FALLBACK: Web Speech API (for browser preview)
    if (!this.recognition && typeof window !== 'undefined') {
      const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechClass) {
        this.recognition = new SpeechClass();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
      }
    }

    if (!this.recognition) {
      onError('Speech Recognition engine not available. You can type directly in the memo box!');
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
      console.warn('Failed to start web speech recognition:', e);
      onError(e?.message || 'Could not start microphone');
      this.isListening = false;
      this.releaseMicStream();
      return false;
    }
  }

  public async stopListening() {
    if (isNativeAndroid()) {
      try {
        await DayTraceNative.stopSpeechRecognition();
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

    // 0. Query Intent (Question detection)
    if (
      lower.startsWith("what's") ||
      lower.startsWith('what is') ||
      lower.startsWith('what are') ||
      lower.startsWith('which') ||
      lower.startsWith('do i have') ||
      lower.startsWith('anything pending') ||
      lower.startsWith('what do i') ||
      lower.startsWith('what should i') ||
      lower.startsWith('what reminder') ||
      lower.startsWith('what task') ||
      lower.startsWith('tell me what') ||
      lower.startsWith('remind me what') ||
      lower.startsWith('remind me which') ||
      lower.startsWith("what's next") ||
      lower.startsWith('what have i') ||
      lower.startsWith('what did i') ||
      lower.endsWith('?')
    ) {
      return {
        rawTranscript: text,
        type: 'QUERY',
        titleOrText: text,
      };
    }

    // 1. Reminder Intent (Only if not a query like "remind me what")
    if (
      (lower.startsWith('remind me') && !lower.startsWith('remind me what') && !lower.startsWith('remind me which')) ||
      lower.startsWith('set a reminder') ||
      lower.startsWith("don't forget") ||
      lower.includes('alarm at')
    ) {
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
