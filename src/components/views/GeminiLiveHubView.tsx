import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Send, Mic, Square, Sparkles, Flame } from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { SmartAICardView } from '../ai/SmartAICardView';
import { calculateGamificationStats } from '../../utils/gamificationEngine';
import {
  queryGeminiAPI, 
  queryGroundedReminderPlan,
  getStoredGeminiApiKey, 
  setGeminiApiKey, 
  clearGeminiApiKey,
  verifyGeminiApiKey,
  AppContextPayload,
  CloudConversationTurn,
  DayTraceActionPlan,
  GroundedReminderPlan,
  planDayTraceActions,
} from '../../services/geminiService';
import { speechService } from '../../services/speechRecognition';
import { getCurrentCoordinates, getDeviceCapabilityContext, openRelevantExternalApp, parseReminderTriggerTime, requestNativeGeofencePermissions } from '../../services/nativeBridge';
import { calculateDistanceMeters } from '../../services/locationService';
import { SmartAICard } from '../../types';
import { classifyAIAgentRoute, requiresLiveGrounding, shouldUseCloudActionPlanner } from '../../utils/aiRouting';
import { extractExplicitTime } from '../../utils/offlineParser';
import { parseVoiceAutomations } from '../../utils/localAutomationParser';

import { DayTraceAI } from '../DayTraceAI/DayTraceAI';

export const GeminiLiveHubView: React.FC = () => {
  const { 
    state, 
    addTask, 
    addFixedEvent, 
    addReminder,
    addAutomation,
    editReminder,
    addTimelineEvent,
    editTask,
    updateTaskStatus,
    saveCurrentLocation,
    logActivity,
    saveMemory,
    updateMemory,
    deleteMemory,
    updateUserSettings,
    processUserInput,
    mode,
    setMode,
  } = useDay();

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [avatarMode, setAvatarMode] = useState<'idle' | 'listening' | 'thinking' | 'talking' | 'processing_task'>('idle');
  const [statusText, setStatusText] = useState('DayTrace AI ready');
  const [smartCards, setSmartCards] = useState<SmartAICard[]>([]);

  // Online / Offline Network & Engine State
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [hasCustomKey, setHasCustomKey] = useState<boolean>(false);
  const [keyTestStatus, setKeyTestStatus] = useState<string | null>(null);
  const cloudReady = hasCustomKey && isOnline;

  const silenceTimerRef = useRef<number | null>(null);
  const onlineConversationRef = useRef<CloudConversationTurn[]>([]);
  const onlineConversationUpdatedAtRef = useRef(0);
  const onlineConversationRequiresGroundingRef = useRef(false);
  const lastLocalActionAtRef = useRef(0);
  const pendingReminderPlanRef = useRef<GroundedReminderPlan | null>(null);
  const pendingTaskCreationRef = useRef<{ title: string; date: string } | null>(null);
  const pendingGymSkipReasonRef = useRef<{ override: boolean } | null>(null);
  const pendingOfficeExitTaskRef = useRef<{ title: string; suggestedTime: string } | null>(null);
  const lastShoppingTaskIdRef = useRef<string | null>(null);
  const pendingMemoryByCardRef = useRef(new Map<string, string>());
  const managedMemoryByCardRef = useRef(new Map<string, string>());
  const sourceQueryByCardRef = useRef(new Map<string, string>());
  const pendingModeActionByCardRef = useRef(new Map<string, string>());
  const pendingOnlineQueryRef = useRef<string | null>(null);
  const stats = calculateGamificationStats(state.gamification?.points || 0, state.gamification?.currentStreakDays || 0);
  const learnedPromptFrequency = (state.conversationHistory || [])
    .filter((entry) => entry.sender === 'user' && entry.text.trim().length > 3)
    .reduce<Record<string, { text: string; count: number }>>((accumulator, entry) => {
      const normalized = entry.text.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
      if (!normalized) return accumulator;
      const existing = accumulator[normalized];
      accumulator[normalized] = existing
        ? { text: entry.text.trim(), count: existing.count + 1 }
        : { text: entry.text.trim(), count: 1 };
      return accumulator;
    }, {});
  const learnedPromptChips = (Object.values(learnedPromptFrequency) as Array<{ text: string; count: number }>)
    .filter((entry) => entry.count >= 2)
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);

  // Network & lifecycle listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const saved = getStoredGeminiApiKey();
    setCustomKeyInput(saved || '');
    setHasCustomKey(Boolean(saved && saved.trim()));
    pendingOnlineQueryRef.current = localStorage.getItem('daytrace_pending_online_query_v1');

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      speechService.stopListening();
    };
  }, []);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const resetSilenceTimer = (callback: () => void) => {
    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(callback, 6500);
  };

  const ONLINE_CONTEXT_TTL_MS = 15 * 60 * 1000;

  const hasRecentOnlineContext = () =>
    onlineConversationRef.current.length > 0
    && Date.now() - onlineConversationUpdatedAtRef.current <= ONLINE_CONTEXT_TTL_MS;

  const rememberOnlineExchange = (userText: string, assistantText: string, liveGrounded = false) => {
    onlineConversationRef.current = [
      ...onlineConversationRef.current,
      { role: 'user', text: userText },
      { role: 'assistant', text: assistantText },
    ].slice(-4);
    onlineConversationUpdatedAtRef.current = Date.now();
    onlineConversationRequiresGroundingRef.current = liveGrounded;
    lastLocalActionAtRef.current = 0;
  };

  const rememberLocalAction = () => {
    lastLocalActionAtRef.current = Date.now();
    onlineConversationRef.current = [];
    onlineConversationUpdatedAtRef.current = 0;
    onlineConversationRequiresGroundingRef.current = false;
  };

  const findNamedArrival = (input: string): string | null => {
    const match = input.trim().match(/^(?:i(?:'m| am)|we(?:'re| are))\s+at\s+(.+?)\s*[.!]?$/i)
      || input.trim().match(/^(?:i\s+)?(?:reached|arrived at)\s+(.+?)\s*[.!]?$/i);
    const label = match?.[1]?.trim();
    if (!label || /^(home|office|work|workplace|gym|fitness center)$/i.test(label)) return null;
    return label.replace(/\bhouse$/i, 'House');
  };

  const contextualMemoryNudges = (input: string): string[] => {
    const lower = input.toLowerCase();
    const isRelevantPurchase = /\b(buy|buying|bought|get|getting|groceries|shopping)\b/i.test(lower)
      && /\b(food|grocery|groceries|sweet|sweets|dessert|ice cream|drink|snack|cake|chocolate|family treat)\b/i.test(lower);
    if (!isRelevantPurchase) return [];
    return (state.memories || [])
      .filter((memory) => (memory.status || 'ACTIVE') === 'ACTIVE')
      .filter((memory) => /sugar[- ]?free/i.test(memory.fact) && /wife|simran/i.test(memory.fact))
      .map(() => 'Remember to choose a sugar-free option for your wife.')
      .slice(0, 1);
  };

  const localDateKey = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const findPendingTaskForPlan = (reference: string) => {
    const normalized = reference.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = normalized.split(' ').filter((word) => word.length > 2);
    return state.tasks
      .filter((task) => task.status !== 'DONE' && task.status !== 'CANCELLED')
      .map((task) => {
        const title = task.title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        const exact = title === normalized ? 100 : title.includes(normalized) || normalized.includes(title) ? 50 : 0;
        const overlap = words.filter((word) => title.includes(word)).length;
        return { task, score: exact + overlap };
      })
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)[0]?.task;
  };

  const executeCloudActionPlan = async (plan: DayTraceActionPlan): Promise<{
    confirmation: string;
    followUps: string[];
    completedCount: number;
    needsClarification: boolean;
  }> => {
    const results: string[] = [];
    let completedCount = 0;
    let plannedLocation: string | undefined;
    let requiredClarification = plan.clarification;
    let requiredOptions = plan.clarificationOptions || [];

    for (const action of plan.actions) {
      try {
        if (action.type === 'SAVE_CURRENT_LOCATION' && action.label) {
          const result = await saveCurrentLocation(action.label);
          const saved = /current location (?:saved as|updated for)/i.test(result);
          plannedLocation = action.label;
          results.push(`${saved ? '✓ ' : ''}${result}`);
          if (saved) completedCount += 1;
          continue;
        }
        if (action.type === 'LOG_ACTIVITY' && action.description) {
          results.push(logActivity(action.description, { location: plannedLocation }));
          completedCount += 1;
          continue;
        }
        if (action.type === 'CREATE_TASK' && action.title) {
          if (!action.scheduledAt) {
            results.push(`Needs a reminder time before creating task: ${action.title}`);
            requiredClarification ||= `At what time should I remind you about “${action.title}”?`;
            if (requiredOptions.length === 0) requiredOptions = ['9:00 AM', '1:00 PM', '6:00 PM'];
            continue;
          }
          const target = new Date(action.scheduledAt);
          if (!Number.isFinite(target.getTime()) || target.getTime() <= Date.now()) {
            results.push(`Could not create “${action.title}”: Gemini did not provide a valid future time.`);
            continue;
          }
          addTask({
            date: localDateKey(target),
            title: action.title,
            category: action.category?.trim() || 'UNCATEGORISED',
            owner: 'ME',
            status: 'NEXT',
            priority: action.priority || 7,
            scheduledAt: target.toISOString(),
            source: 'GEMINI_ACTION_PLAN',
            persistent: true,
          });
          results.push(`✓ Task and linked reminder created for ${target.toLocaleString()}: ${action.title}`);
          completedCount += 1;
          continue;
        }
        if (action.type === 'CREATE_REMINDER' && action.scheduledAt) {
          const target = new Date(action.scheduledAt);
          const message = action.reminderMessage || action.title;
          if (!message || !Number.isFinite(target.getTime()) || target.getTime() <= Date.now()) {
            results.push('Could not create reminder: a valid future time and message are required.');
            continue;
          }
          addReminder({
            date: localDateKey(target),
            type: 'TIME_BASED',
            triggerCondition: target.toISOString(),
            message,
          });
          results.push(`✓ Reminder created for ${target.toLocaleString()}: ${message}`);
          completedCount += 1;
          continue;
        }
        if (action.type === 'CREATE_LOCATION_REMINDER' && action.triggerType) {
          const reminderMessage = action.reminderMessage || action.title;
          let savedPlace = action.locationReference === 'SAVED_PLACE' && action.locationName
            ? (state.geofenceLocations || []).find((location) =>
              location.name.toLowerCase() === action.locationName?.toLowerCase())
            : undefined;
          if (action.locationReference === 'CURRENT' || !savedPlace) {
            try {
              const coordinates = await getCurrentCoordinates();
              savedPlace = (state.geofenceLocations || [])
                .map((location) => ({
                  location,
                  distance: calculateDistanceMeters(coordinates, {
                    latitude: location.latitude,
                    longitude: location.longitude,
                  }),
                }))
                .filter(({ location, distance }) => distance <= Math.max(50, location.radiusMeters || 200))
                .sort((left, right) => left.distance - right.distance)[0]?.location;
            } catch (error) {
              console.warn('Could not resolve live GPS for the location reminder', error);
            }
            if (!savedPlace && state.current.location && state.current.location !== 'Unknown') {
              savedPlace = (state.geofenceLocations || []).find((location) =>
                location.name.toLowerCase() === state.current.location.toLowerCase());
            }
          }
          if (!reminderMessage || !savedPlace) {
            results.push('Location reminder needs a saved current place before it can be activated.');
            requiredClarification ||= 'What name should I save for this current location?';
            continue;
          }
          const permissions = await requestNativeGeofencePermissions();
          if (!permissions.foregroundGranted || !permissions.backgroundGranted) {
            results.push('Location reminder needs “Allow all the time” location permission.');
            requiredClarification ||= 'Enable background location permission, then retry this reminder.';
            continue;
          }
          updateUserSettings({ geofenceEnabled: true });
          addAutomation({
            title: action.title || reminderMessage,
            originalVoiceText: plan.intentSummary,
            triggerType: action.triggerType,
            locationId: savedPlace.id,
            locationName: savedPlace.name,
            reminderText: reminderMessage,
            status: 'PENDING',
          });
          results.push(`✓ ${action.triggerType === 'GEOFENCE_EXIT' ? 'Leaving' : 'Arriving at'} ${savedPlace.name} → ${reminderMessage}`);
          completedCount += 1;
          continue;
        }
        if (action.type === 'COMPLETE_TASK') {
          const reference = action.taskReference || action.title;
          const matchingTask = reference ? findPendingTaskForPlan(reference) : undefined;
          if (!matchingTask) {
            results.push(`Could not safely match a pending task for “${reference || 'that task'}”.`);
            requiredClarification ||= 'Which pending task should I mark complete?';
            if (requiredOptions.length === 0) {
              requiredOptions = state.tasks
                .filter((task) => task.status !== 'DONE' && task.status !== 'CANCELLED')
                .slice(0, 4)
                .map((task) => task.title);
            }
            continue;
          }
          updateTaskStatus(matchingTask.id, 'DONE');
          results.push(`✓ Completed task: ${matchingTask.title}`);
          completedCount += 1;
          continue;
        }
        if (action.type === 'SAVE_MEMORY' && action.fact) {
          saveMemory(action.fact, {
            category: action.memoryCategory || 'GENERAL',
            source: 'GEMINI_ACTION_PLAN',
            status: 'ACTIVE',
          });
          results.push(`✓ Saved to local memory: ${action.fact}`);
          completedCount += 1;
        }
      } catch (error) {
        results.push(`Could not complete ${action.type.replace(/_/g, ' ').toLowerCase()}: ${error instanceof Error ? error.message : 'device operation failed'}`);
      }
    }

    if (requiredClarification) results.push(requiredClarification);
    return {
      confirmation: results.join('\n') || 'No safe local action was executed.',
      followUps: requiredOptions,
      completedCount,
      needsClarification: Boolean(requiredClarification),
    };
  };

  const ONLINE_CACHE_KEY = 'daytrace_verified_online_cache_v1';
  const cacheVerifiedAnswer = (query: string, answer: string) => {
    try {
      const existing = JSON.parse(localStorage.getItem(ONLINE_CACHE_KEY) || '{}') as Record<string, unknown>;
      const key = query.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().slice(0, 120);
      const next = {
        ...existing,
        [key]: { query, answer, fetchedAt: new Date().toISOString() },
      };
      const limited = Object.fromEntries(Object.entries(next).slice(-20));
      localStorage.setItem(ONLINE_CACHE_KEY, JSON.stringify(limited));
    } catch (error) {
      console.warn('Could not cache verified online answer', error);
    }
  };

  const readLastVerifiedAnswer = (query: string): { query: string; answer: string; fetchedAt: string } | null => {
    try {
      const stored = JSON.parse(localStorage.getItem(ONLINE_CACHE_KEY) || '{}') as Record<string, { query: string; answer: string; fetchedAt: string }>;
      const words = new Set(query.toLowerCase().match(/[a-z0-9]+/g) || []);
      const ranked = Object.values(stored)
        .map((entry) => ({
          entry,
          score: (entry.query.toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => words.has(word)).length,
        }))
        .sort((a, b) => b.score - a.score || Date.parse(b.entry.fetchedAt) - Date.parse(a.entry.fetchedAt));
      return ranked[0]?.score > 0 ? ranked[0].entry : null;
    } catch {
      return null;
    }
  };

  const createReminderFromPlan = (plan: GroundedReminderPlan, timeText?: string): string => {
    let scheduledAt = plan.scheduledAt;
    if (!scheduledAt) {
      const clock = timeText ? extractExplicitTime(timeText) : null;
      if (!clock) throw new Error(`What time on ${plan.reminderDate} should I remind you?`);
      const [year, month, day] = plan.reminderDate.split('-').map(Number);
      const [hours, minutes] = clock.split(':').map(Number);
      const target = new Date(year, month - 1, day, hours, minutes, 0, 0);
      if (target.getTime() <= Date.now()) throw new Error('That reminder time is already in the past. Choose another time.');
      scheduledAt = target.toISOString();
    }
    addReminder({
      date: plan.reminderDate,
      type: 'TIME_BASED',
      triggerCondition: scheduledAt,
      message: plan.reminderTitle,
    });
    pendingReminderPlanRef.current = null;
    rememberLocalAction();
    const displayTime = new Date(scheduledAt).toLocaleString([], {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
    return `✓ ${plan.answer}\nReminder created for ${displayTime}: ${plan.reminderTitle}`;
  };

  const applyRecentReminderTimeCorrection = (input: string): string | null => {
    if (Date.now() - lastLocalActionAtRef.current > ONLINE_CONTEXT_TTL_MS) return null;
    if (!/^(?:no\b|actually\b|make it\b|change it\b|move it\b)/i.test(input.trim())) return null;
    const clock = extractExplicitTime(input);
    if (!clock) return null;
    const latest = [...state.reminders].reverse().find((reminder) => !reminder.isDone);
    if (!latest) return null;
    const baselineMillis = parseReminderTriggerTime(latest.triggerCondition) || Date.now();
    const target = new Date(baselineMillis);
    const [hours, minutes] = clock.split(':').map(Number);
    target.setHours(hours, minutes, 0, 0);
    if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
    editReminder(latest.id, { triggerCondition: target.toISOString() });
    return `✓ Updated “${latest.message}” to ${target.toLocaleString([], {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })}.`;
  };

  const tomorrowDateKey = (): string => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const extractUnderspecifiedTomorrowTask = (input: string): { title: string; date: string } | null => {
    if (!/\btomorrow\b/i.test(input) || extractExplicitTime(input)) return null;
    if (!/\b(i need to|i have to|add (?:a )?task|create (?:a )?task|task:)\b/i.test(input)) return null;
    const title = input
      .replace(/^.*?\b(?:i need to|i have to|add (?:a )?task(?: to)?|create (?:a )?task(?: to)?|task:)\s*/i, '')
      .replace(/\btomorrow\b/ig, '')
      .replace(/[.!?]+$/g, '')
      .trim();
    if (!title) return null;
    return { title: title.charAt(0).toUpperCase() + title.slice(1), date: tomorrowDateKey() };
  };

  const extractScheduledTask = (input: string): { title: string; target: Date } | null => {
    if (!extractExplicitTime(input)) return null;
    if (!/\b(i need to|i have to|i want to|i must|i plan to|add (?:a )?task|create (?:a )?task|task:)\b/i.test(input)) return null;
    const targetMillis = parseReminderTriggerTime(input);
    if (!targetMillis) return null;
    const target = new Date(targetMillis);
    const title = input
      .replace(/^.*?\b(?:i need to|i have to|i want to|i must|i plan to|add (?:a )?task(?: to)?|create (?:a )?task(?: to)?|task:)\s*/i, '')
      .replace(/\b(?:today|tomorrow|tonight)\b/ig, '')
      .replace(/\b(?:at|by)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/ig, '')
      .replace(/[.!?]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!title) return null;
    return { title: title.charAt(0).toUpperCase() + title.slice(1), target };
  };

  const createPendingTaskAtTime = (timeText: string): string => {
    const pending = pendingTaskCreationRef.current;
    if (!pending) throw new Error('There is no pending task waiting for a time.');
    const clock = extractExplicitTime(timeText);
    if (!clock) throw new Error(`What time on ${pending.date} should I remind you?`);
    const [year, month, day] = pending.date.split('-').map(Number);
    const [hours, minutes] = clock.split(':').map(Number);
    const target = new Date(year, month - 1, day, hours, minutes, 0, 0);
    if (target.getTime() <= Date.now()) throw new Error('That time is already in the past. Choose another time.');
    addTask({
      date: pending.date,
      title: pending.title,
      category: 'PERSONAL',
      owner: 'ME',
      status: 'NEXT',
      priority: 6,
      scheduledAt: target.toISOString(),
    });
    pendingTaskCreationRef.current = null;
    rememberLocalAction();
    return `✓ Task and linked reminder created for ${target.toLocaleString([], {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })}: ${pending.title}`;
  };

  const createOfficeExitTask = (timeText: string): string => {
    const pending = pendingOfficeExitTaskRef.current;
    if (!pending) throw new Error('There is no Office-exit task waiting for confirmation.');
    const clock = extractExplicitTime(timeText);
    if (!clock) throw new Error('Tell me the exact Office leaving time for today.');
    const target = new Date();
    const [hours, minutes] = clock.split(':').map(Number);
    target.setHours(hours, minutes, 0, 0);
    if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
    const date = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
    const taskId = addTask({
      date,
      title: pending.title,
      category: /milk|curd|grocery|ice cream|buy/i.test(pending.title) ? 'HOME' : 'PERSONAL',
      owner: 'ME',
      status: 'NEXT',
      priority: 7,
      scheduledAt: target.toISOString(),
      context: 'ERRAND',
      trigger: 'Leaving Office',
    });
    if (/milk|curd|grocery|ice cream|buy/i.test(pending.title)) lastShoppingTaskIdRef.current = taskId;
    pendingOfficeExitTaskRef.current = null;
    rememberLocalAction();
    return `✓ Task and linked reminder created for ${target.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}: ${pending.title}`;
  };

  const gymWeekKey = (date = new Date()): string => {
    const monday = new Date(date);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  };

  const readGymSkips = (): Array<{ week: string; reason: string; at: string }> => {
    try {
      return JSON.parse(localStorage.getItem('daytrace_gym_skip_reasons_v1') || '[]');
    } catch {
      return [];
    }
  };

  const saveGymSkipReason = (reason: string, override: boolean): string => {
    const clean = reason.trim();
    if (!clean) throw new Error('Tell me the reason for skipping Gym today.');
    const skips = readGymSkips();
    const record = { week: gymWeekKey(), reason: clean, at: new Date().toISOString() };
    localStorage.setItem('daytrace_gym_skip_reasons_v1', JSON.stringify([...skips, record].slice(-52)));
    pendingGymSkipReasonRef.current = null;
    const normalized = clean.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    const repeated = skips.filter((item) => item.reason.toLowerCase().replace(/[^a-z0-9 ]/g, '') === normalized).length + 1;
    const pattern = repeated >= 2
      ? `\n\nI found this same reason ${repeated} times. This is becoming a pattern. I will prioritise a smaller rescue workout or an earlier protected Gym slot next time.`
      : '';
    return `${override ? '⚠ Weekly Gym skip rule overridden. ' : ''}Gym skip reason saved: ${clean}.${pattern}`;
  };

  // Primary Query & Task Execution Handler
  const submitQuery = async (queryText: string, options: { forceOnlineFollowUp?: boolean; bypassModeGuard?: boolean } = {}) => {
    const query = queryText.trim();
    if (!query || isProcessing) return;

    // Immediately clear input box
    setInputText('');
    setInterimText('');
    setIsProcessing(true);
    setAvatarMode('processing_task');
    setStatusText('Processing with DayTrace AI...');

    const lower = query.toLowerCase();

    if (mode !== 'ACCOUNTABILITY' && !options.bypassModeGuard) {
      const modeLabel = mode === 'NORMAL_CHAT' ? 'Normal Chat' : mode === 'RESEARCH' ? 'Research' : 'Creative';
      const explicitMutation = /^(?:add|remind|schedule|create|log|start|stop|mark|save|set|move|reschedule|plan|complete|finish|cancel|delete|remove|pause|resume|skip|remember|turn this into)\b/i.test(query)
        || /\b(?:remind me|add (?:this|it) (?:as|to)|save (?:this|it)|log (?:this|it)|create (?:a )?(?:task|reminder))\b/i.test(query);

      if (explicitMutation) {
        const cardId = `card-${Date.now()}`;
        const followUps = ['Switch to Accountability and continue', `Keep ${modeLabel} read-only`];
        pendingModeActionByCardRef.current.set(cardId, query);
        setSmartCards((prev) => [{
          id: cardId,
          type: 'EXPERT_ADVICE',
          title: `${modeLabel} is read-only`,
          subtitle: 'No task, reminder, memory or timeline data changed',
          engineMode: 'OFFLINE_LOCAL',
          followUpQuestions: followUps,
          createdAt: Date.now(),
          data: {
            safetyWarning: `“${query}” is an action. Switch to Accountability mode before I apply it?`,
            followUpQuestions: followUps,
          },
        }, ...prev]);
        setIsProcessing(false);
        setAvatarMode('talking');
        setStatusText('Confirmation needed');
        setTimeout(() => setAvatarMode('idle'), 3000);
        return;
      }

      try {
        if (!cloudReady) {
          throw new Error(!hasCustomKey
            ? 'Online AI needs a verified Gemini API key. Tap OFFLINE to add it once.'
            : 'The device is offline. This read-only mode will answer when Online AI is available.');
        }
        const forceLiveSearch = mode === 'RESEARCH' || requiresLiveGrounding(query);
        const aiResponse = await queryGeminiAPI(query, undefined, {
          conversationTurns: hasRecentOnlineContext() ? onlineConversationRef.current : [],
          forceLiveSearch,
          assistantMode: mode,
        });
        rememberOnlineExchange(query, aiResponse.answer, forceLiveSearch);
        const card: SmartAICard = {
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: `${modeLabel} response`,
          subtitle: `${forceLiveSearch ? 'Live verified' : 'Online'} • read-only`,
          engineMode: 'ONLINE_CLOUD',
          followUpQuestions: aiResponse.followUps,
          createdAt: Date.now(),
          data: { safetyWarning: aiResponse.answer, followUpQuestions: aiResponse.followUps },
        };
        setSmartCards((prev) => [card, ...prev]);
        setStatusText(`${modeLabel} answer ready`);
        setAvatarMode('talking');
        setTimeout(() => setAvatarMode('idle'), 3500);
      } catch (error) {
        setSmartCards((prev) => [{
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: `${modeLabel} unavailable`,
          subtitle: 'Read-only mode • no local data changed',
          engineMode: 'OFFLINE_LOCAL',
          createdAt: Date.now(),
          data: { safetyWarning: error instanceof Error ? error.message : 'Online AI could not be reached.' },
        }, ...prev]);
        setStatusText('Online AI unavailable');
        setAvatarMode('idle');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (pendingOfficeExitTaskRef.current) {
      if (/^no\b/i.test(query) && !extractExplicitTime(query)) {
        const followUps = ['6:30 PM', '7:00 PM', '8:00 PM'];
        setSmartCards((prev) => [{
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: 'Office leaving time needed',
          subtitle: 'Today may be an overtime day',
          engineMode: 'OFFLINE_LOCAL',
          followUpQuestions: followUps,
          createdAt: Date.now(),
          data: {
            safetyWarning: 'What exact time are you leaving Office today?',
            followUpQuestions: followUps,
          },
        }, ...prev]);
        setIsProcessing(false);
        setAvatarMode('talking');
        setStatusText('Tell me today’s leaving time');
        return;
      }
      try {
        const timeText = /^yes\b/i.test(query)
          ? pendingOfficeExitTaskRef.current.suggestedTime
          : query;
        const response = createOfficeExitTask(timeText);
        setSmartCards((prev) => [{
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: 'Office-exit task scheduled',
          subtitle: 'Task and reminder linked',
          engineMode: 'OFFLINE_LOCAL',
          createdAt: Date.now(),
          data: { safetyWarning: response },
        }, ...prev]);
        setStatusText('Office-exit reminder created');
        setAvatarMode('talking');
        setTimeout(() => setAvatarMode('idle'), 3000);
      } catch (error) {
        setStatusText(error instanceof Error ? error.message : 'Tell me the leaving time');
        setAvatarMode('idle');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (pendingGymSkipReasonRef.current) {
      try {
        const response = saveGymSkipReason(query, pendingGymSkipReasonRef.current.override);
        addTimelineEvent({
          date: state.date,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          type: 'INTERRUPTION',
          description: 'Gym skipped',
          category: 'HEALTH',
          notes: query,
          source: 'CHECK_IN',
          syncStatus: 'PENDING',
        });
        setSmartCards((prev) => [{
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: 'Gym skip recorded',
          subtitle: 'Reason saved for habit learning',
          engineMode: 'OFFLINE_LOCAL',
          createdAt: Date.now(),
          data: { safetyWarning: response },
        }, ...prev]);
        setStatusText('Gym reason saved');
        setAvatarMode('talking');
        setTimeout(() => setAvatarMode('idle'), 3500);
      } catch (error) {
        setStatusText(error instanceof Error ? error.message : 'Tell me the Gym skip reason');
        setAvatarMode('idle');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (pendingTaskCreationRef.current) {
      try {
        const confirmation = createPendingTaskAtTime(query);
        setSmartCards((prev) => [{
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: 'Task and reminder created',
          subtitle: 'On-device • linked commitment',
          engineMode: 'OFFLINE_LOCAL',
          createdAt: Date.now(),
          data: { safetyWarning: confirmation },
        }, ...prev]);
        setStatusText('Task and reminder scheduled');
        setAvatarMode('talking');
        setTimeout(() => setAvatarMode('idle'), 3500);
      } catch (error) {
        const followUps = ['9:00 AM', '1:00 PM', '6:00 PM'];
        setSmartCards((prev) => [{
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: 'Task time needed',
          subtitle: `Scheduled date • ${pendingTaskCreationRef.current?.date}`,
          engineMode: 'OFFLINE_LOCAL',
          followUpQuestions: followUps,
          createdAt: Date.now(),
          data: {
            safetyWarning: error instanceof Error ? error.message : 'Tell me the reminder time.',
            followUpQuestions: followUps,
          },
        }, ...prev]);
        setStatusText('Tell me the task time');
        setAvatarMode('idle');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // A grounded event date was already verified; only the missing clock time
    // remains. Complete the local reminder without making another cloud call.
    if (pendingReminderPlanRef.current) {
      try {
        const confirmation = createReminderFromPlan(pendingReminderPlanRef.current, query);
        setSmartCards((prev) => [{
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: 'Verified reminder created',
          subtitle: 'Live date • local Android reminder',
          engineMode: 'OFFLINE_LOCAL',
          createdAt: Date.now(),
          data: { safetyWarning: confirmation },
        }, ...prev]);
        setStatusText('Verified reminder scheduled');
        setAvatarMode('talking');
        setTimeout(() => setAvatarMode('idle'), 3500);
      } catch (error) {
        setSmartCards((prev) => [{
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: 'Reminder time needed',
          subtitle: `Date verified • ${pendingReminderPlanRef.current?.reminderDate}`,
          engineMode: 'OFFLINE_LOCAL',
          followUpQuestions: ['9:00 AM', '6:00 PM', '7:30 PM'],
          createdAt: Date.now(),
          data: {
            safetyWarning: error instanceof Error ? error.message : 'Tell me the reminder time.',
            followUpQuestions: ['9:00 AM', '6:00 PM', '7:30 PM'],
          },
        }, ...prev]);
        setStatusText('Tell me the reminder time');
        setAvatarMode('idle');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // 0. Account / Login / Auth Inquiry
    if (
      lower.includes('log in') || 
      lower.includes('login') || 
      lower.includes('sign in') || 
      lower.includes('signin') || 
      lower.includes('account') || 
      lower.includes('password')
    ) {

      const authCard: SmartAICard = {
        id: `card-${Date.now()}`,
        type: 'EXPERT_ADVICE',
        title: 'DayTrace Privacy & Backup',
        subtitle: 'Local-first storage',
        engineMode: 'OFFLINE_LOCAL',
        createdAt: Date.now(),
        data: {
          safetyWarning: `🔒 DayTrace is local-first and private:\n\n• No account or login is required for tasks, reminders, history, saved places, or meetings.\n• Online AI is optional and uses the Gemini key you add on this device.\n• Export or restore your complete local JSON backup from Settings.`
        }
      };

      setSmartCards((prev) => [authCard, ...prev]);
      setIsProcessing(false);
      setAvatarMode('talking');
      setStatusText('Offline privacy advisory ready!');
      setTimeout(() => setAvatarMode('idle'), 4000);
      return;
    }

    // 1. Assistant Greeting / Capabilities Inquiry
    if (
      lower === 'hi' || 
      lower === 'hello' || 
      lower === 'hey' || 
      lower.startsWith('hi ') || 
      lower.startsWith('hello ') || 
      lower.startsWith('hey ') ||
      lower.includes('who are you') || 
      lower.includes('what can you do') ||
      lower === 'help' ||
      lower === 'help me'
    ) {

      const greetingCard: SmartAICard = {
        id: `card-${Date.now()}`,
        type: 'EXPERT_ADVICE',
        title: 'DayTrace AI Assistant',
        subtitle: 'Core Capabilities & Voice Commands',
        engineMode: 'OFFLINE_LOCAL',
        createdAt: Date.now(),
        data: {
          safetyWarning: `👋 I am DayTrace AI, your accountability assistant.\n\n• Add tasks and exact reminders with voice or typing.\n• Ask online questions and continue with follow-up prompts.\n• Ask “Where am I?” to match a saved place or identify an untagged area.\n• Check today’s tasks, timetable, and reminders.\n• Record meetings and review local summaries/action items.\n• Export or restore your complete local JSON backup.`
        }
      };

      setSmartCards((prev) => [greetingCard, ...prev]);
      setIsProcessing(false);
      setAvatarMode('talking');
      setStatusText('Assistant ready!');
      setTimeout(() => setAvatarMode('idle'), 4000);
      return;
    }

    const route = classifyAIAgentRoute(query, {
      hasRecentOnlineTurn: hasRecentOnlineContext(),
      hasRecentLocalAction: Date.now() - lastLocalActionAtRef.current <= ONLINE_CONTEXT_TTL_MS,
      forcedOnlineFollowUp: options.forceOnlineFollowUp,
    });

    // Location reminders are executable DayTrace commands, not medical or
    // general-knowledge questions. Resolve them before any Gemini answer path
    // so words inside the reminder message (for example “medicine”) cannot
    // hijack routing.
    if (route === 'LOCAL_ACTION' && !shouldUseCloudActionPlanner(query) && /\b(?:remind|reminder|notify|alert)\b/i.test(query)
      && /\b(?:leave|leaving|depart|departing|exit|exiting|arrive|arriving|reach|reaching|enter|entering)\b/i.test(query)) {
      const parsed = parseVoiceAutomations(
        query,
        state,
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      );
      const locationAutomations = parsed.automations.filter((automation) =>
        automation.triggerType === 'GEOFENCE_EXIT' || automation.triggerType === 'GEOFENCE_ENTER');
      if (locationAutomations.length > 0) {
        const unresolved = locationAutomations.find((automation) => {
          if (!automation.locationName) return true;
          return !(state.geofenceLocations || []).some((location) =>
            location.id === automation.locationId
            || location.name.toLowerCase() === automation.locationName?.toLowerCase());
        });
        if (unresolved) {
          const followUps = ['Save this location', 'Open saved places'];
          setSmartCards((prev) => [{
            id: `card-${Date.now()}`,
            type: 'EXPERT_ADVICE',
            title: 'Location name needed',
            subtitle: 'No reminder created yet',
            engineMode: 'OFFLINE_LOCAL',
            followUpQuestions: followUps,
            createdAt: Date.now(),
            data: {
              safetyWarning: 'I can create this exit reminder, but this GPS place is not saved yet. Tell me “Save this location as [name]”, then repeat the reminder.',
              followUpQuestions: followUps,
            },
          }, ...prev]);
          setIsProcessing(false);
          setAvatarMode('talking');
          setStatusText('Save this place first');
          return;
        }

        let permissions: { foregroundGranted: boolean; backgroundGranted: boolean };
        try {
          permissions = await requestNativeGeofencePermissions();
        } catch (error) {
          console.warn('Could not request geofence permissions', error);
          permissions = { foregroundGranted: false, backgroundGranted: false };
        }
        if (!permissions.foregroundGranted || !permissions.backgroundGranted) {
          setSmartCards((prev) => [{
            id: `card-${Date.now()}`,
            type: 'EXPERT_ADVICE',
            title: 'Background location needed',
            subtitle: 'No reminder created yet',
            engineMode: 'OFFLINE_LOCAL',
            createdAt: Date.now(),
            data: {
              safetyWarning: 'Allow DayTrace location access “All the time” so it can detect leaving this place while the app is closed. Then repeat the command.',
            },
          }, ...prev]);
          setIsProcessing(false);
          setAvatarMode('talking');
          setStatusText('Background location permission needed');
          return;
        }

        updateUserSettings({ geofenceEnabled: true });
        locationAutomations.forEach((automation) => addAutomation({
          title: automation.title,
          originalVoiceText: automation.originalVoiceText || query,
          triggerType: automation.triggerType,
          locationId: automation.locationId,
          locationName: automation.locationName,
          reminderText: automation.reminderText,
          status: 'PENDING',
          relatedContext: automation.relatedContext,
        }));
        const confirmation = locationAutomations.map((automation) =>
          `✓ ${automation.triggerType === 'GEOFENCE_EXIT' ? 'Leaving' : 'Arriving at'} ${automation.locationName} → ${automation.reminderText}`,
        ).join('\n');
        setSmartCards((prev) => [{
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: 'Location reminder created',
          subtitle: 'Native geofence • works in background',
          engineMode: 'OFFLINE_LOCAL',
          createdAt: Date.now(),
          data: { safetyWarning: confirmation },
        }, ...prev]);
        rememberLocalAction();
        setIsProcessing(false);
        setAvatarMode('talking');
        setStatusText('Location reminder is active');
        setTimeout(() => setAvatarMode('idle'), 3000);
        return;
      }
    }

    if (route === 'PENDING_MEMORY') {
      const cardId = `card-${Date.now()}`;
      saveMemory(query, { status: 'PENDING', source: 'AI_AGENT_PENDING' });
      pendingMemoryByCardRef.current.set(cardId, query);
      const followUps = ['Continue this message', 'Save as a preference or rule', 'Turn it into a task or reminder'];
      setSmartCards((prev) => [{
        id: cardId,
        type: 'PERSISTENT_MEMORY',
        title: 'Saved to Pending Memory',
        subtitle: 'Incomplete information is saved but not active',
        engineMode: 'OFFLINE_LOCAL',
        followUpQuestions: followUps,
        createdAt: Date.now(),
        data: {
          memoryFact: query,
          memoryCategory: 'PENDING',
          safetyWarning: `I saved this locally so it is not lost. What should I do with it?\n\n“${query}”`,
          followUpQuestions: followUps,
        },
      }, ...prev]);
      setIsProcessing(false);
      setAvatarMode('talking');
      setStatusText('Pending message saved');
      setTimeout(() => setAvatarMode('idle'), 3000);
      return;
    }

    if (route === 'HYBRID_GROUNDED_REMINDER') {
      try {
        const plan = await queryGroundedReminderPlan(query, {
          conversationTurns: hasRecentOnlineContext() ? onlineConversationRef.current : [],
        });
        rememberOnlineExchange(query, plan.answer, true);
        cacheVerifiedAnswer(query, plan.answer);
        let responseText: string;
        let followUps: string[] = [];
        if (plan.scheduledAt) {
          responseText = createReminderFromPlan(plan);
        } else {
          pendingReminderPlanRef.current = plan;
          responseText = `${plan.answer}\n\nThe reminder date is ${plan.reminderDate}. What time should I remind you?`;
          followUps = ['9:00 AM', '6:00 PM', '7:30 PM'];
        }
        setSmartCards((prev) => [{
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: plan.scheduledAt ? 'Live fact verified • reminder created' : 'Live fact verified • time needed',
          subtitle: 'Google Search grounded • minimal context',
          engineMode: 'ONLINE_CLOUD',
          followUpQuestions: followUps,
          createdAt: Date.now(),
          data: { safetyWarning: responseText, followUpQuestions: followUps },
        }, ...prev]);
        setStatusText(plan.scheduledAt ? 'Verified reminder created' : 'Tell me the reminder time');
        setAvatarMode('talking');
        setTimeout(() => setAvatarMode('idle'), 4000);
      } catch (error) {
        const followUps = ['Fetch when online', 'Show last stored result', 'Open the relevant app'];
        const cardId = `card-${Date.now()}`;
        sourceQueryByCardRef.current.set(cardId, query);
        setSmartCards((prev) => [{
          id: cardId,
          type: 'EXPERT_ADVICE',
          title: 'Live verification unavailable',
          subtitle: 'No unverified reminder was created',
          engineMode: 'OFFLINE_LOCAL',
          followUpQuestions: followUps,
          createdAt: Date.now(),
          data: {
            safetyWarning: error instanceof Error ? error.message : 'The device is offline, so I cannot verify this safely.',
            followUpQuestions: followUps,
          },
        }, ...prev]);
        setStatusText('Live verification needed');
        setAvatarMode('idle');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (route === 'LOCAL_QUERY') {
      try {
        const localAnswer = await processUserInput(query);
        setSmartCards((prev) => [{
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: 'DayTrace local answer',
          subtitle: 'On-device data • no cloud tokens',
          engineMode: 'OFFLINE_LOCAL',
          createdAt: Date.now(),
          data: { safetyWarning: localAnswer },
        }, ...prev]);
        rememberLocalAction();
        setAvatarMode('talking');
        setStatusText('Local answer ready');
        setTimeout(() => setAvatarMode('idle'), 3000);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (route === 'ONLINE_KNOWLEDGE' || route === 'ONLINE_FOLLOW_UP') {
      const isCapabilityQuery = lower.includes('permission') || lower.includes('feature') || lower.includes('what can you do') || lower.includes('can you access') || lower.includes('access do you have');
      const isOutfitQuery = /\b(what should i wear|what to wear|outfit|dress suggestion|clothes for today)\b/i.test(lower);
      const isNearbyQuery = /\b(nearest|nearby|near me|closest)\b/i.test(lower);
      const isDirectLocationQuery = !isCapabilityQuery && (lower.includes('where am i') || lower.includes('where i am') || lower.includes('my current location') || lower.includes('where are we') || lower.includes('what city') || lower.includes('where is this'));
      const isLocationQuery = isDirectLocationQuery || isNearbyQuery;


      let liveCoords: { latitude: number; longitude: number } | undefined;
      let savedPlace: string | undefined;
      let locationPermission: AppContextPayload['locationPermission'] = 'UNKNOWN';

      if (isLocationQuery || isOutfitQuery) {
        try {
          const fetched = await getCurrentCoordinates();
          if (fetched && Number.isFinite(fetched.latitude) && Number.isFinite(fetched.longitude)) {
            liveCoords = { latitude: fetched.latitude, longitude: fetched.longitude };
            locationPermission = 'GRANTED';
            const matchedPlace = (state.geofenceLocations || [])
              .map((place) => ({
                place,
                distance: calculateDistanceMeters(liveCoords!, {
                  latitude: place.latitude,
                  longitude: place.longitude,
                }),
              }))
              .filter(({ place, distance }) => distance <= Math.max(50, place.radiusMeters || 200))
              .sort((a, b) => a.distance - b.distance)[0]?.place;
            savedPlace = matchedPlace?.name;
          }
        } catch (locErr) {
          locationPermission = 'DENIED';
          console.warn('GPS location fetch error:', locErr);
        }
      }

      const capabilityContext = isCapabilityQuery ? await getDeviceCapabilityContext() : undefined;

      const appContext: AppContextPayload = {
        location: isLocationQuery || isOutfitQuery ? state.current.location : undefined,
        coords: liveCoords,
        savedPlace,
        locationPermission,
        activeFocusTask: state.tasks.find(t => t.id === state.current.focusTaskId || t.status === 'ACTIVE')?.title,
        memories: state.memories?.map(m => ({ category: m.category, fact: m.fact })),
        pendingTasks: state.tasks.filter(t => t.status === 'NEXT' || t.status === 'ACTIVE').slice(0, 3).map(t => ({
          title: t.title,
          category: t.category,
          priority: t.priority
        })),
        timetableSlots: isOutfitQuery
          ? state.timetable
            .filter((slot) => slot.status !== 'SKIPPED')
            .slice(0, 8)
            .map((slot) => ({ time: `${slot.startTime}-${slot.endTime}`, title: slot.title, status: slot.status }))
          : undefined,
        features: capabilityContext?.features,
        permissions: capabilityContext?.permissions,
      };

      // A live GPS match against a user-named place is already authoritative;
      // answer locally instead of spending a Gemini request on reverse geocoding.
      if (isDirectLocationQuery && savedPlace) {
        const followUps = ['What are my pending tasks?', 'Save another location'];
        setSmartCards((prev) => [{
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: 'Current location',
          subtitle: 'Live GPS • saved-place match • no cloud tokens',
          engineMode: 'OFFLINE_LOCAL',
          followUpQuestions: followUps,
          createdAt: Date.now(),
          data: {
            safetyWarning: `📍 You are at ${savedPlace}.`,
            followUpQuestions: followUps,
          },
        }, ...prev]);
        setIsProcessing(false);
        setAvatarMode('talking');
        setStatusText(`You are at ${savedPlace}`);
        setTimeout(() => setAvatarMode('idle'), 3000);
        return;
      }

      try {
        const forceLiveSearch = requiresLiveGrounding(query)
          || (route === 'ONLINE_FOLLOW_UP' && onlineConversationRequiresGroundingRef.current);
        const aiResponse = await queryGeminiAPI(query, appContext, {
          conversationTurns: hasRecentOnlineContext() ? onlineConversationRef.current : [],
          forceLiveSearch,
        });
        rememberOnlineExchange(query, aiResponse.answer, forceLiveSearch);
        if (forceLiveSearch) cacheVerifiedAnswer(query, aiResponse.answer);

        const answerCard: SmartAICard = {
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: `Gemini AI: ${query.length > 40 ? query.substring(0, 40) + '...' : query}`,
          subtitle: savedPlace ? `Saved place • ${savedPlace}` : isLocationQuery ? 'Live GPS • grounded lookup' : 'Online response',
          engineMode: 'ONLINE_CLOUD',
          followUpQuestions: aiResponse.followUps,
          createdAt: Date.now(),
          data: {
            safetyWarning: aiResponse.answer || `Information generated for: "${query}".`,
            followUpQuestions: aiResponse.followUps
          }
        };

        setSmartCards((prev) => [answerCard, ...prev]);
        setIsProcessing(false);
        setAvatarMode('talking');
        setStatusText('Gemini answer ready!');
        setTimeout(() => setAvatarMode('idle'), 4000);
      } catch (err) {

        let fallbackAnswer = '';
        let fallbackFollowUps: string[] = [];

        if (isDirectLocationQuery) {
          if (savedPlace) {
            fallbackAnswer = `📍 You are at ${savedPlace}.\n\nThis is a live GPS match against the place you saved on this device.`;
          } else if (liveCoords) {
            fallbackAnswer = `📍 Current GPS: ${liveCoords.latitude.toFixed(5)}, ${liveCoords.longitude.toFixed(5)}\n\nThis location is not tagged yet. Connect Online AI to identify the nearest verifiable road, neighborhood, and city, or save this spot with your own name.`;
          } else {
            fallbackAnswer = '📍 I could not read your live location. Check the app location permission and Location Services, then try again.';
          }
          fallbackFollowUps = [
            'Save this location',
            'Which location permission is enabled?',
          ];
        } else if (isCapabilityQuery && capabilityContext) {
          const permissionLines = Object.entries(capabilityContext.permissions)
            .map(([name, value]) => `• ${name}: ${value}`)
            .join('\n');
          fallbackAnswer = `DayTrace supports ${capabilityContext.features.join(', ')}.\n\nCurrent device permissions:\n${permissionLines}`;
        } else if (requiresLiveGrounding(query) || onlineConversationRequiresGroundingRef.current) {
          fallbackAnswer = 'The device is offline or live verification failed. I cannot safely verify this changing information, so I will not give you a stale answer.';
          fallbackFollowUps = [
            'Fetch when online',
            'Show last stored result',
            /weather|forecast/i.test(query) ? 'Open the weather app' : 'Open the relevant app',
          ];
        } else {
          const needsSetup = !getStoredGeminiApiKey();
          fallbackAnswer = needsSetup
            ? 'Online AI needs a verified Gemini API key. Tap OFFLINE once to add it; after verification the key is saved and reused automatically.'
            : 'Gemini could not be reached. Your verified key remains saved; check the internet connection and retry.';
          fallbackFollowUps = [
            'What can DayTrace do offline?',
            'Which app permissions are enabled?',
          ];
        }

        const fallbackCardId = `card-${Date.now()}`;
        if (requiresLiveGrounding(query) || onlineConversationRequiresGroundingRef.current) {
          sourceQueryByCardRef.current.set(fallbackCardId, query);
        }
        const fallbackCard: SmartAICard = {
          id: fallbackCardId,
          type: 'EXPERT_ADVICE',
          title: `DayTrace AI: ${query.length > 36 ? query.substring(0, 36) + '...' : query}`,
          subtitle: isDirectLocationQuery ? 'Smart Geofence Location' : 'On-Device Response',
          engineMode: 'OFFLINE_LOCAL',
          followUpQuestions: fallbackFollowUps,
          createdAt: Date.now(),
          data: {
            safetyWarning: fallbackAnswer,
            followUpQuestions: fallbackFollowUps
          }
        };

        setSmartCards((prev) => [fallbackCard, ...prev]);
        setIsProcessing(false);
        setAvatarMode('talking');
        setStatusText('Answer ready!');
        setTimeout(() => setAvatarMode('idle'), 4000);
      }
      return;
    }

    // Compound commands use Gemini as a semantic planner, then execute only
    // allowlisted operations on-device. If planning fails, the offline parser
    // remains available below and the user's command is not discarded.
    if (cloudReady && shouldUseCloudActionPlanner(query)) {
      try {
        const capabilityContext = await getDeviceCapabilityContext();
        const mentionsLocation = /\b(location|place|spot|here|arriv|reach|desk|home|office|gym)\b/i.test(query);
        const mentionsTasks = /\b(task|todo|complete|finish|done|remind|schedule)\b/i.test(query);
        const plan = await planDayTraceActions(query, {
          now: new Date(),
          currentLocation: state.current.location,
          savedLocationNames: mentionsLocation
            ? (state.geofenceLocations || []).map((location) => location.name)
            : [],
          pendingTaskTitles: mentionsTasks
            ? state.tasks
              .filter((task) => task.status !== 'DONE' && task.status !== 'CANCELLED')
              .slice(0, 12)
              .map((task) => task.title)
            : [],
          features: capabilityContext.features,
          permissions: capabilityContext.permissions,
        });
        const execution = await executeCloudActionPlan(plan);
        const actionCard: SmartAICard = {
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: execution.needsClarification
            ? execution.completedCount > 0 ? 'Actions applied • information needed' : 'Information needed'
            : execution.completedCount > 0 ? 'DayTrace actions completed' : 'Action could not be completed',
          subtitle: 'Gemini understood • DayTrace executed locally',
          engineMode: 'ONLINE_CLOUD',
          followUpQuestions: execution.followUps,
          createdAt: Date.now(),
          data: {
            safetyWarning: execution.confirmation,
            followUpQuestions: execution.followUps,
          },
        };
        setSmartCards((prev) => [actionCard, ...prev]);
        rememberLocalAction();
        setIsProcessing(false);
        setAvatarMode('talking');
        setStatusText(execution.needsClarification
          ? 'Waiting for required information'
          : execution.completedCount > 0 ? 'Requested actions completed' : 'Action needs attention');
        setTimeout(() => setAvatarMode('idle'), 3500);
        return;
      } catch (plannerError) {
        console.warn('Cloud action planning failed; using the on-device parser:', plannerError);
        setStatusText('Using on-device action parser');
      }
    }

    // Simple device actions are routed through the deterministic local parser so
    // reminders, geofences and native alarms use the same tested path everywhere.

    try {
      let confirmation = applyRecentReminderTimeCorrection(query);

      const scheduledTask = !confirmation ? extractScheduledTask(query) : null;
      if (scheduledTask) {
        const date = `${scheduledTask.target.getFullYear()}-${String(scheduledTask.target.getMonth() + 1).padStart(2, '0')}-${String(scheduledTask.target.getDate()).padStart(2, '0')}`;
        const isShopping = /\b(buy|milk|curd|grocery|groceries|ice cream)\b/i.test(scheduledTask.title);
        const taskId = addTask({
          date,
          title: scheduledTask.title,
          category: isShopping ? 'HOME' : 'PERSONAL',
          owner: 'ME',
          status: 'NEXT',
          priority: 7,
          scheduledAt: scheduledTask.target.toISOString(),
          ...(isShopping ? { context: 'ERRAND' as const } : {}),
        });
        if (isShopping) lastShoppingTaskIdRef.current = taskId;
        confirmation = `✓ Task and linked reminder created for ${scheduledTask.target.toLocaleString([], {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        })}: ${scheduledTask.title}`;
      }

      const stopMemoryMatch = !confirmation
        ? query.match(/^(?:stop|pause|disable)\s+(?:the\s+)?(?:reminders?|rule|memory)?\s*(?:about|for)?\s*(.+?)\s*[.!]?$/i)
        : null;
      if (stopMemoryMatch?.[1]) {
        const topicWords = stopMemoryMatch[1].toLowerCase().match(/[a-z0-9]+/g) || [];
        const matchingMemory = (state.memories || [])
          .filter((memory) => (memory.status || 'ACTIVE') === 'ACTIVE')
          .map((memory) => ({
            memory,
            score: topicWords.filter((word) => memory.fact.toLowerCase().includes(word)).length,
          }))
          .sort((a, b) => b.score - a.score)[0];
        if (matchingMemory?.score) {
          const cardId = `card-${Date.now()}`;
          managedMemoryByCardRef.current.set(cardId, matchingMemory.memory.id);
          const followUps = ['Pause this memory', 'Disable reminder rule', 'Forget saved preference'];
          setSmartCards((prev) => [{
            id: cardId,
            type: 'PERSISTENT_MEMORY',
            title: 'Manage saved preference',
            subtitle: 'Choose how strongly to stop it',
            engineMode: 'OFFLINE_LOCAL',
            followUpQuestions: followUps,
            createdAt: Date.now(),
            data: {
              safetyWarning: `I found this active memory: “${matchingMemory.memory.fact}”\n\nPause keeps it saved for later. Disable turns off proactive reminders. Forget removes it from active memory.`,
              followUpQuestions: followUps,
            },
          }, ...prev]);
          setIsProcessing(false);
          setAvatarMode('talking');
          setStatusText('Choose how to manage the memory');
          return;
        }
      }

      const additionalErrandItems = !confirmation
        ? query.match(/^also\s+add\s+(.+?)\s*[.!]?$/i)?.[1]?.trim()
        : undefined;
      if (additionalErrandItems) {
        const shoppingTask = state.tasks.find((task) => task.id === lastShoppingTaskIdRef.current)
          || state.tasks.find((task) => task.status !== 'DONE' && (task.context === 'ERRAND' || /\b(buy|shopping|grocery|milk|curd)\b/i.test(task.title)));
        if (shoppingTask) {
          const updatedTitle = `${shoppingTask.title}, ${additionalErrandItems}`;
          editTask(shoppingTask.id, { title: updatedTitle });
          const linkedReminder = state.reminders.find((reminder) => reminder.relatedTaskId === shoppingTask.id && !reminder.isDone);
          if (linkedReminder) editReminder(linkedReminder.id, { message: updatedTitle });
          lastShoppingTaskIdRef.current = shoppingTask.id;
          confirmation = `✓ Added ${additionalErrandItems} to the same shopping task and grouped reminder.`;
        }
      }

      if (!confirmation && /\bskip\b[^.]{0,30}\b(?:gym|workout)\b|\b(?:gym|workout)\b[^.]{0,30}\bskip\b/i.test(query)) {
        const alreadySkipped = readGymSkips().some((item) => item.week === gymWeekKey());
        pendingGymSkipReasonRef.current = { override: alreadySkipped };
        setSmartCards((prev) => [{
          id: `card-${Date.now()}`,
          type: alreadySkipped ? 'CONFLICT_WARNING' : 'EXPERT_ADVICE',
          title: alreadySkipped ? 'Weekly Gym rule warning' : 'Gym skip reason required',
          subtitle: alreadySkipped ? 'Your one normal skip is already used' : 'Reason will be saved for habit learning',
          engineMode: 'OFFLINE_LOCAL',
          createdAt: Date.now(),
          data: {
            safetyWarning: alreadySkipped
              ? 'This is a second Gym skip this week and breaks your weekly rule. You chose to allow an override only after saving the reason. Why are you skipping today?'
              : 'Why are you skipping Gym today?',
          },
        }, ...prev]);
        setIsProcessing(false);
        setAvatarMode('talking');
        setStatusText('Tell me the Gym skip reason');
        setTimeout(() => setAvatarMode('idle'), 3000);
        return;
      }

      const officeExitMatch = !confirmation
        ? query.match(/^(?:i\s+)?(?:need|have|want)\s+to\s+(.+?)\s+when\s+i\s+leave\s+(?:the\s+)?office\s*[.!]?$/i)
        : null;
      if (officeExitMatch?.[1]) {
        const title = officeExitMatch[1].trim().replace(/^to\s+/i, '');
        const suggestedTime = state.userSettings.officeLeavingTime || '18:30';
        pendingOfficeExitTaskRef.current = {
          title: title.charAt(0).toUpperCase() + title.slice(1),
          suggestedTime,
        };
        const [hours, minutes] = suggestedTime.split(':').map(Number);
        const suggestedDisplay = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const followUps = [`Yes, use ${suggestedDisplay}`, 'No, choose another time'];
        setSmartCards((prev) => [{
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: 'Confirm today’s Office leaving time',
          subtitle: 'Overtime-aware reminder',
          engineMode: 'OFFLINE_LOCAL',
          followUpQuestions: followUps,
          createdAt: Date.now(),
          data: {
            safetyWarning: `Are you leaving Office at ${suggestedDisplay} today? If yes, I will create the task and linked reminder.`,
            followUpQuestions: followUps,
          },
        }, ...prev]);
        setIsProcessing(false);
        setAvatarMode('talking');
        setStatusText('Confirm today’s leaving time');
        setTimeout(() => setAvatarMode('idle'), 3000);
        return;
      }

      const underspecifiedTask = !confirmation ? extractUnderspecifiedTomorrowTask(query) : null;
      if (underspecifiedTask) {
        pendingTaskCreationRef.current = underspecifiedTask;
        const followUps = ['9:00 AM', '1:00 PM', '6:00 PM'];
        setSmartCards((prev) => [{
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: 'Task date understood • time needed',
          subtitle: `Tomorrow • ${underspecifiedTask.date}`,
          engineMode: 'OFFLINE_LOCAL',
          followUpQuestions: followUps,
          createdAt: Date.now(),
          data: {
            safetyWarning: `I will create “${underspecifiedTask.title}” with its linked reminder. What time tomorrow should I remind you?`,
            followUpQuestions: followUps,
          },
        }, ...prev]);
        setIsProcessing(false);
        setAvatarMode('talking');
        setStatusText('Tell me the reminder time');
        setTimeout(() => setAvatarMode('idle'), 3000);
        return;
      }

      const rememberedFact = !confirmation
        ? query.match(/^remember(?: that)?\s+(.+?)\s*[.!]?$/i)?.[1]?.trim()
        : undefined;
      if (rememberedFact) {
        const isFamily = /wife|husband|son|daughter|family|simran/i.test(rememberedFact);
        const isPreference = /prefer|likes?|dislikes?|favourite|favorite|sugar[- ]?free/i.test(rememberedFact);
        saveMemory(rememberedFact, {
          status: 'ACTIVE',
          category: isFamily ? 'FAMILY' : isPreference ? 'PREFERENCE' : 'GENERAL',
          source: 'EXPLICIT_REMEMBER',
          triggerKeywords: /sugar[- ]?free/i.test(rememberedFact)
            ? ['groceries', 'sweets', 'dessert', 'ice cream', 'family treat']
            : undefined,
        });
        confirmation = `✓ Saved privately as an active memory: ${rememberedFact}`;
      }

      const namedArrival = !confirmation ? findNamedArrival(query) : null;
      if (namedArrival) {
        const saved = await saveCurrentLocation(namedArrival);
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        addTimelineEvent({
          date: state.date,
          time,
          type: 'GEOFENCE',
          description: `Arrived at ${namedArrival}`,
          location: namedArrival,
          source: 'CHECK_IN',
          syncStatus: 'PENDING',
        });
        confirmation = `✓ Logged arrival at ${namedArrival}. ${saved}`;
      }

      if (!confirmation) confirmation = await processUserInput(query);
      const nudges = contextualMemoryNudges(query);
      if (nudges.length) confirmation = `${confirmation}\n\n${nudges.map((nudge) => `💡 ${nudge}`).join('\n')}`;
      rememberLocalAction();
      const gymInterrupted = /\bgym\b/i.test(query) && /\brain/i.test(query) && /\b(?:back|returned|came)\b[^.]{0,20}\bhome\b/i.test(query);
      const gymFollowUps = gymInterrupted
        ? [
            'Reschedule Gym to the next available timetable slot',
            'Remind me to go to Gym every hour',
            ...(readGymSkips().some((item) => item.week === gymWeekKey()) ? [] : ['Skip Gym today']),
          ]
        : [];
      const actionCard: SmartAICard = {
        id: `card-${Date.now()}`,
        type: 'EXPERT_ADVICE',
        title: 'DayTrace action completed',
        subtitle: 'On-device • no cloud tokens used',
        engineMode: 'OFFLINE_LOCAL',
        followUpQuestions: gymFollowUps,
        createdAt: Date.now(),
        data: {
          safetyWarning: confirmation || 'The action was processed on this device.',
          followUpQuestions: gymFollowUps,
        },
      };
      setSmartCards((prev) => [actionCard, ...prev]);
      setIsProcessing(false);
      setAvatarMode('talking');
      setStatusText('Action completed on device');
      setTimeout(() => setAvatarMode('idle'), 3000);
    } catch (error) {
      setIsProcessing(false);
      setAvatarMode('idle');
      setStatusText(error instanceof Error ? error.message : 'Could not complete the action');
    }
  };

  // Form Submit from typing bar
  const handleTaskSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    const query = inputText.trim();
    setInputText('');
    void submitQuery(query);
  };

  // Voice Dictation Toggle & Speech Handler
  const handleVoiceDictation = async () => {
    if (isListening) {
      // User tapped Stop button manually
      clearSilenceTimer();
      await speechService.stopListening();
      setIsListening(false);
      const captured = interimText.trim() || inputText.trim();
      setInterimText('');
      if (captured) {
        setInputText(captured);
        setStatusText(`Captured: "${captured}"`);
        setAvatarMode('thinking');
        setTimeout(() => void submitQuery(captured), 500);
      } else {
        setAvatarMode('idle');
        setStatusText('Listening stopped');
      }
      return;
    }

    // Start listening
    setIsListening(true);
    setInterimText('');
    setAvatarMode('listening');
    setStatusText('Listening... Speak now (tap stop when done)');

    resetSilenceTimer(async () => {
      await speechService.stopListening();
      setIsListening(false);
      const textToSubmit = interimText.trim();
      setInterimText('');
      if (textToSubmit) {
        setInputText(textToSubmit);
        setStatusText(`Captured: "${textToSubmit}"`);
        setAvatarMode('thinking');
        void submitQuery(textToSubmit);
      } else {
        setAvatarMode('idle');
        setStatusText('No speech detected. Tap mic to retry.');
        setTimeout(() => setStatusText('DayTrace AI ready'), 4000);
      }
    });

    const started = await speechService.startListening(
      (interim) => {
        setInterimText(interim);
        setStatusText(`Hearing: "${interim.length > 25 ? interim.substring(0, 25) + '...' : interim}"`);
        resetSilenceTimer(async () => {
          await speechService.stopListening();
          setIsListening(false);
          setInterimText('');
          if (interim.trim()) {
            setInputText(interim.trim());
            setStatusText(`Captured: "${interim.trim()}"`);
            setAvatarMode('thinking');
            void submitQuery(interim.trim());
          }
        });
      },
      (finalText) => {
        clearSilenceTimer();
        setIsListening(false);
        setInterimText('');
        if (finalText && finalText.trim()) {
          const query = finalText.trim();
          setInputText(query);
          setStatusText(`Captured: "${query.length > 25 ? query.substring(0, 25) + '...' : query}"`);
          setAvatarMode('thinking');
          setTimeout(() => {
            void submitQuery(query);
          }, 400);
        } else {
          setAvatarMode('idle');
          setStatusText('Voice input complete');
        }
      },
      (err) => {
        clearSilenceTimer();
        setIsListening(false);
        setInterimText('');
        setAvatarMode('idle');
        setStatusText(`Mic error: ${err}`);
        setTimeout(() => setStatusText('DayTrace AI ready'), 4000);
      },
      () => {
        // onEnd callback
        clearSilenceTimer();
        setIsListening(false);
      }
    );

    if (!started) {
      clearSilenceTimer();
      setIsListening(false);
      setAvatarMode('idle');
      setStatusText('Microphone unavailable or permission needed');
    }
  };

  const handleConfirmReschedule = (cardId: string) => {
    addFixedEvent('18:00', '19:00', 'Rescheduled Task / Gym Session', 'Gym');
    setSmartCards((prev) => prev.filter((c) => c.id !== cardId));
    setStatusText('Rescheduled to 18:00 - 19:00 free slot!');
  };

  const handleAddRoadmapTasks = (steps: any[]) => {
    steps.forEach((step) => {
      addTask(step.title, 'PERSONAL', 'NORMAL', step.estimatedMinutes);
    });
    setStatusText(`Added ${steps.length} sub-tasks to your Task Board!`);
  };

  const handleCardFollowUp = async (card: SmartAICard, choice: string) => {
    const pendingModeAction = pendingModeActionByCardRef.current.get(card.id);
    if (pendingModeAction) {
      if (/^switch to accountability/i.test(choice)) {
        pendingModeActionByCardRef.current.delete(card.id);
        setMode('ACCOUNTABILITY');
        setSmartCards((prev) => prev.filter((item) => item.id !== card.id));
        setStatusText('Accountability mode enabled');
        void submitQuery(pendingModeAction, { bypassModeGuard: true });
      } else {
        pendingModeActionByCardRef.current.delete(card.id);
        setSmartCards((prev) => prev.map((item) => item.id === card.id ? {
          ...item,
          subtitle: 'Kept read-only • no data changed',
          followUpQuestions: [],
          data: {
            ...item.data,
            safetyWarning: 'Nothing was logged, scheduled, saved or changed.',
            followUpQuestions: [],
          },
        } : item));
        setStatusText('Read-only mode kept');
      }
      return;
    }

    const managedMemoryId = managedMemoryByCardRef.current.get(card.id);
    if (managedMemoryId) {
      const action = /^pause/i.test(choice) ? 'PAUSED' : /^disable/i.test(choice) ? 'DISABLED' : /forget/i.test(choice) ? 'FORGOTTEN' : null;
      if (action) {
        if (action === 'FORGOTTEN') {
          deleteMemory(managedMemoryId);
        } else {
          updateMemory(managedMemoryId, {
            status: action,
            ...(action === 'DISABLED' ? { triggerKeywords: [] } : {}),
          });
        }
        managedMemoryByCardRef.current.delete(card.id);
        setSmartCards((prev) => prev.map((item) => item.id === card.id ? {
          ...item,
          subtitle: action === 'PAUSED' ? 'Memory paused' : action === 'FORGOTTEN' ? 'Memory forgotten' : 'Proactive rule disabled',
          followUpQuestions: [],
          data: {
            ...item.data,
            safetyWarning: action === 'PAUSED'
              ? '✓ Paused. The preference stays on this device but will not trigger reminders until reactivated.'
              : action === 'FORGOTTEN'
                ? '✓ Forgotten. The saved preference has been removed from this device.'
                : '✓ Disabled. DayTrace will no longer use this preference for proactive reminders.',
            followUpQuestions: [],
          },
        } : item));
        setStatusText(action === 'PAUSED' ? 'Memory paused' : action === 'FORGOTTEN' ? 'Memory forgotten' : 'Preference disabled');
        return;
      }
    }

    if (/^reschedule gym/i.test(choice)) {
      const now = new Date();
      const todayGymSlot = state.timetable
        .filter((slot) => /gym|workout|exercise/i.test(slot.title) && slot.status === 'PENDING')
        .map((slot) => {
          const [hours, minutes] = slot.startTime.split(':').map(Number);
          const date = new Date(now);
          date.setHours(hours, minutes, 0, 0);
          return { slot, date };
        })
        .filter(({ date }) => date.getTime() > now.getTime())
        .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
      const target = todayGymSlot?.date || (() => {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(6, 0, 0, 0);
        return tomorrow;
      })();
      addTask({
        date: `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`,
        title: 'Rescheduled Gym session',
        category: 'HEALTH',
        owner: 'ME',
        status: 'NEXT',
        priority: 9,
        scheduledAt: target.toISOString(),
      });
      setStatusText(`Gym rescheduled for ${target.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`);
      return;
    }
    if (/gym every hour/i.test(choice)) {
      const now = new Date();
      let created = 0;
      for (let hoursAhead = 1; hoursAhead <= 4; hoursAhead += 1) {
        const target = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
        if (target.getHours() >= 22) break;
        addReminder({
          date: `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`,
          type: 'TIME_BASED',
          triggerCondition: target.toISOString(),
          message: 'Gym is still pending. Go now or reschedule it.',
        });
        created += 1;
      }
      setStatusText(created ? `${created} hourly Gym reminders created` : 'No useful hourly window remains today');
      return;
    }

    const pendingFact = pendingMemoryByCardRef.current.get(card.id);
    if (pendingFact) {
      if (/^continue/i.test(choice)) {
        setInputText(`${pendingFact} `);
        setStatusText('Continue the saved message in the typing bar');
        return;
      }
      if (/preference|rule/i.test(choice)) {
        saveMemory(pendingFact, { status: 'ACTIVE', category: 'PREFERENCE', source: 'USER_CLASSIFIED' });
        pendingMemoryByCardRef.current.delete(card.id);
        setSmartCards((prev) => prev.map((item) => item.id === card.id ? {
          ...item,
          subtitle: 'Active local preference/rule',
          followUpQuestions: [],
          data: {
            ...item.data,
            memoryCategory: 'PREFERENCE',
            safetyWarning: `✓ Saved as an active local preference/rule:\n${pendingFact}`,
            followUpQuestions: [],
          },
        } : item));
        setStatusText('Memory rule activated');
        return;
      }
      if (/task|reminder/i.test(choice)) {
        setInputText(`Create a task from this: ${pendingFact}. `);
        setStatusText('Add the date and reminder time');
        return;
      }
    }

    const sourceQuery = sourceQueryByCardRef.current.get(card.id);
    if (/fetch when online/i.test(choice) && sourceQuery) {
      if (navigator.onLine) {
        void submitQuery(sourceQuery, { forceOnlineFollowUp: true });
      } else {
        pendingOnlineQueryRef.current = sourceQuery;
        localStorage.setItem('daytrace_pending_online_query_v1', sourceQuery);
        setStatusText('Saved • I will fetch this when the device reconnects');
      }
      return;
    }
    if (/last stored/i.test(choice) && sourceQuery) {
      const cached = readLastVerifiedAnswer(sourceQuery);
      const answer = cached
        ? `${cached.answer}\n\nStored result fetched: ${new Date(cached.fetchedAt).toLocaleString()}`
        : 'No previously verified result is stored for this question.';
      setSmartCards((prev) => [{
        id: `card-${Date.now()}`,
        type: 'EXPERT_ADVICE',
        title: 'Last stored verified result',
        subtitle: cached ? 'Cached data • timestamp shown' : 'No matching cache',
        engineMode: 'OFFLINE_LOCAL',
        createdAt: Date.now(),
        data: { safetyWarning: answer },
      }, ...prev]);
      return;
    }
    if (/open the weather app/i.test(choice)) {
      await openRelevantExternalApp('WEATHER', sourceQuery || 'weather near me');
      return;
    }
    if (/open the relevant app/i.test(choice)) {
      await openRelevantExternalApp(/location|near|pharmacy|route/i.test(sourceQuery || '') ? 'MAPS' : 'BROWSER', sourceQuery);
      return;
    }

    void submitQuery(choice, { forceOnlineFollowUp: card.engineMode === 'ONLINE_CLOUD' });
  };

  useEffect(() => {
    if (!isOnline || isProcessing || !pendingOnlineQueryRef.current || !getStoredGeminiApiKey()) return;
    const queued = pendingOnlineQueryRef.current;
    pendingOnlineQueryRef.current = null;
    localStorage.removeItem('daytrace_pending_online_query_v1');
    void submitQuery(queued, { forceOnlineFollowUp: true });
  }, [isOnline, isProcessing]);

  return (
    <div id="gemini-live-hub" className="flex-1 flex flex-col h-full bg-[#070A10] text-[#E2E2E6] overflow-hidden relative">
      {/* Scrollable Main Content Feed with Bottom Padding to clear Fixed Input Bar */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* Top RPG Gamification HUD Bar */}
        <div className="p-3.5 rounded-[24px] bg-gradient-to-r from-[#0D1527] via-[#111827] to-[#0D1527] border border-[#00F0FF]/30 shadow-[0_0_20px_rgba(0,240,255,0.15)] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00F0FF]/20 border border-[#00F0FF]/50 text-[#00F0FF] flex items-center justify-center font-mono font-extrabold text-sm shadow-md">
              L{stats.level}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-mono font-bold text-xs text-[#E2E2E6]">{stats.levelTitle}</h3>
                <span className="text-[10px] font-mono text-[#FBBF24] font-extrabold">{stats.xp} XP</span>
              </div>

              <div className="w-32 h-1.5 bg-[#111827] rounded-full overflow-hidden border border-[#00F0FF]/20 mt-1">
                <div className="h-full bg-[#00F0FF] transition-all duration-500" style={{ width: `${stats.progressPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Streak Pill */}
            <div className="flex items-center space-x-1 px-2.5 py-1.5 rounded-2xl bg-[#070A10] border border-[#FBBF24]/40 text-[#FBBF24] text-xs font-mono font-bold">
              <Flame className="w-3.5 h-3.5 fill-current text-[#FBBF24]" />
              <span>{stats.streakDays}d</span>
            </div>

            {/* AI Engine & Network Status Badge (Clickable to open AI Config Modal) */}
            <button
              type="button"
              onClick={() => {
                setKeyTestStatus(null);
                setCustomKeyInput(getStoredGeminiApiKey());
                setShowConfigModal(true);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-2xl bg-[#070A10] border transition text-xs font-mono font-bold shadow-md active:scale-95 cursor-pointer"
              style={{
                borderColor: cloudReady ? 'rgba(52, 211, 153, 0.7)' : 'rgba(251, 191, 36, 0.7)',
                color: cloudReady ? '#34D399' : '#FBBF24',
                boxShadow: cloudReady ? '0 0 15px rgba(52, 211, 153, 0.25)' : '0 0 15px rgba(251, 191, 36, 0.2)'
              }}
              title={cloudReady ? "Online (Gemini connected) - Tap to manage" : hasCustomKey ? "API key saved; waiting for internet" : "Offline (Tap to enter Gemini API Key)"}
            >
              <span className={`w-2 h-2 rounded-full ${cloudReady ? 'bg-[#34D399] animate-pulse' : 'bg-[#FBBF24]'}`} />
              <span>{cloudReady ? 'ONLINE' : 'OFFLINE'}</span>
            </button>
          </div>
        </div>

        {/* Center Futuristic AI Holographic Humanoid (DayTraceAI Hero Component - Tap to Speak) */}
        <DayTraceAI
          active={true}
          mode={avatarMode === 'processing_task' ? 'thinking' : (avatarMode as any)}
          statusText={
            isListening
              ? (interimText ? `Hearing: "${interimText.length > 20 ? interimText.substring(0, 20) + '...' : interimText}"` : '🎙️ LISTENING... (TAP TO STOP)')
              : (avatarMode === 'idle' ? 'DAYTRACE AI READY • TAP TO SPEAK' : statusText)
          }
          height={360}
          onClick={handleVoiceDictation}
        />

        {/* Smart AI Cards Feed */}
        <AnimatePresence>
          {smartCards.map((card) => (
            <SmartAICardView
              key={card.id}
              card={card}
              onConfirmReschedule={handleConfirmReschedule}
              onAddRoadmapTasks={handleAddRoadmapTasks}
              onDismissCard={(id) => setSmartCards((prev) => prev.filter((c) => c.id !== id))}
              onSelectFollowUp={(q) => void handleCardFollowUp(card, q)}
            />
          ))}
        </AnimatePresence>

        {/* Learned suggestions appear only after the user repeats a real prompt. */}
        {learnedPromptChips.length > 0 && <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
          {learnedPromptChips.map((chip) => (
            <button
              key={chip.text}
              type="button"
              onClick={() => {
                setInputText(chip.text);
              }}
              className="py-1.5 px-3 rounded-full bg-[#0D1527] hover:bg-[#00F0FF]/20 border border-[#00F0FF]/30 text-[11px] font-mono text-[#00F0FF] shrink-0 transition"
            >
              {chip.text.length > 54 ? `${chip.text.slice(0, 51)}…` : chip.text}
            </button>
          ))}
        </div>}
      </div>

      {/* Bottom Fixed Command Bar (Pinned above Bottom Navigation Bar & Soft Keyboard) */}
      <div className="shrink-0 p-3 bg-[#070A10]/95 backdrop-blur-xl border-t border-[#00F0FF]/40 shadow-2xl sticky bottom-0 z-40 pb-safe">
        {/* Floating live voice transcription banner when listening */}
        {isListening && (
          <div className="max-w-lg mx-auto mb-2 px-3 py-1.5 rounded-2xl bg-[#BA1A1A]/25 border border-[#FF8D80]/50 backdrop-blur-md flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center space-x-2 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF8D80] animate-ping shrink-0" />
              <span className="text-[11px] font-mono text-[#FFD8D3] truncate">
                {interimText ? `"${interimText}"` : 'Listening to your voice... Speak now'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleVoiceDictation}
              className="px-2.5 py-1 rounded-xl bg-[#BA1A1A] hover:bg-[#DC2626] text-white text-[10px] font-mono font-bold flex items-center space-x-1 shrink-0 ml-2 shadow-md"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>Stop & Send</span>
            </button>
          </div>
        )}

        <form onSubmit={handleTaskSubmit} className="flex items-center space-x-2 max-w-lg mx-auto">
          {/* Voice Dictate & Stop Button */}
          <button
            type="button"
            onClick={handleVoiceDictation}
            className={`p-3 rounded-2xl transition shadow-md shrink-0 active:scale-95 relative ${
              isListening
                ? 'bg-[#BA1A1A] hover:bg-[#DC2626] border-2 border-[#FF8D80] text-white shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse'
                : 'bg-[#0D1527] hover:bg-[#00F0FF]/20 border border-[#00F0FF]/40 text-[#00F0FF]'
            }`}
            title={isListening ? "Listening... Tap here to STOP recording" : "Dictate voice query (tap to speak)"}
          >
            {isListening ? (
              <>
                <Square className="w-4 h-4 fill-current text-white" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#FF8D80] rounded-full animate-ping" />
              </>
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Primary Typing Input Bar */}
          <div className="relative flex-1">
            <input
              type="text"
              value={isListening && interimText ? interimText : inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isListening 
                  ? '🎙️ Listening... Speak your query' 
                  : 'Assign a task or ask Gemini...'
              }
              disabled={isProcessing}
              className={`w-full py-3 pl-4 pr-11 rounded-2xl border text-xs font-mono placeholder-[#C4C6D0]/40 focus:outline-none shadow-inner transition ${
                isListening
                  ? 'bg-[#180A0A] border-[#FF8D80]/60 text-[#FFD8D3] focus:ring-2 focus:ring-[#FF8D80]'
                  : 'bg-[#111827] border-[#00F0FF]/40 text-[#E2E2E6] focus:ring-2 focus:ring-[#00F0FF]'
              }`}
            />

            <button
              type="submit"
              disabled={(!inputText.trim() && !interimText.trim()) || isProcessing}
              className={`absolute right-1.5 top-1.5 p-2 rounded-xl transition ${
                (inputText.trim() || interimText.trim()) && !isProcessing
                  ? 'bg-[#00F0FF] text-[#070A10] shadow-[0_0_15px_#00F0FF]'
                  : 'bg-[#1D2026] text-[#C4C6D0]/30 cursor-not-allowed'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* AI Engine & API Key Configuration Modal */}
      {showConfigModal && (
        <div 
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setShowConfigModal(false)}
        >
          <div 
            className="bg-[#1D2026] text-[#E2E2E6] border border-[#00F0FF]/40 rounded-[28px] p-5 sm:p-6 max-w-sm w-full shadow-2xl space-y-4 my-auto max-h-[85vh] overflow-y-auto shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#44474E]/40">
              <div className="flex items-center space-x-2">
                <div className={`p-2 rounded-xl ${hasCustomKey ? 'bg-[#10B981]/20 text-[#34D399]' : 'bg-[#FBBF24]/20 text-[#FBBF24]'}`}>
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#E2E2E6]">
                    {cloudReady ? 'Gemini Cloud AI Active' : hasCustomKey ? 'Gemini API Key Saved' : 'Gemini Cloud AI Setup'}
                  </h3>
                  <p className="text-[10px] text-[#C4C6D0]/70">
                    {cloudReady ? 'ONLINE Mode Enabled' : hasCustomKey ? 'OFFLINE • Waiting for internet' : 'OFFLINE Mode • Connect API Key'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="text-[#C4C6D0] hover:text-[#E2E2E6] p-1 font-bold">
                ✕
              </button>
            </div>

            {/* Current Engine Status */}
            <div className={`p-3 rounded-2xl border text-xs font-mono space-y-1.5 ${
              cloudReady
                ? 'bg-[#10B981]/10 border-[#10B981]/40' 
                : 'bg-[#FBBF24]/10 border-[#FBBF24]/40'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[#C4C6D0]">Current Status:</span>
                <span className={`font-bold flex items-center space-x-1.5 ${cloudReady ? 'text-[#34D399]' : 'text-[#FBBF24]'}`}>
                  <span className={`w-2 h-2 rounded-full ${cloudReady ? 'bg-[#34D399] animate-pulse' : 'bg-[#FBBF24]'}`} />
                  <span>{cloudReady ? 'ONLINE (Gemini connected)' : 'OFFLINE (On-Device Local)'}</span>
                </span>
              </div>
              <p className="text-[10px] text-[#C4C6D0]/80 leading-tight">
                {cloudReady
                  ? 'Your saved Gemini API key is active. Grounded location lookup is available when needed.'
                  : hasCustomKey
                  ? 'Your verified API key is saved on this device and will reconnect automatically when internet returns.'
                  : 'Enter your Gemini API key below to convert the OFFLINE button to ONLINE.'}
              </p>
            </div>

            {/* Custom Gemini API Key Form */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#00F0FF] uppercase tracking-wider block">
                Google Gemini API Key
              </label>
              <input
                type="password"
                value={customKeyInput}
                onChange={(e) => setCustomKeyInput(e.target.value)}
                placeholder="Paste Gemini API key (AIzaSy...)"
                className="w-full p-2.5 rounded-xl bg-[#111318] border border-[#00F0FF]/40 text-xs font-mono text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:outline-none focus:ring-2 focus:ring-[#00F0FF]"
              />

              <div className="text-[10px] text-[#C4C6D0]/70 flex items-center justify-between">
                <span>Free API key from Google AI Studio</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00F0FF] hover:underline font-bold"
                >
                  Get Key ↗
                </a>
              </div>

              {keyTestStatus && (
                <div className={`p-2.5 rounded-xl text-xs font-mono transition animate-in fade-in ${
                  keyTestStatus.startsWith('✓') 
                    ? 'bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/50 font-bold' 
                    : 'bg-[#EF4444]/20 text-[#F87171] border border-[#EF4444]/50'
                }`}>
                  {keyTestStatus}
                </div>
              )}

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    const keyToVerify = customKeyInput.trim();
                    if (!keyToVerify) {
                      setKeyTestStatus('❌ Please paste a valid Gemini API Key first.');
                      return;
                    }
                    setKeyTestStatus('⏳ Verifying with Google Cloud API...');
                    try {
                      const result = await verifyGeminiApiKey(keyToVerify);
                      if (result.success) {
                        setHasCustomKey(true);
                        setKeyTestStatus('✓ Verified! Converted to ONLINE mode.');
                        setTimeout(() => {
                          setShowConfigModal(false);
                          setKeyTestStatus(null);
                        }, 1200);
                      } else {
                        setKeyTestStatus(`❌ ${result.message}`);
                      }
                    } catch (err: any) {
                      setKeyTestStatus(`❌ ${err?.message || 'Verification failed.'}`);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#00F0FF] hover:bg-[#38F9D7] text-[#070A10] text-xs font-bold font-mono transition shadow-lg flex items-center justify-center space-x-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Verify & Convert to ONLINE</span>
                </button>

                {hasCustomKey && (
                  <button
                    type="button"
                    onClick={() => {
                      clearGeminiApiKey();
                      setCustomKeyInput('');
                      setHasCustomKey(false);
                      setKeyTestStatus('✓ Disconnected. Switched to OFFLINE mode.');
                    }}
                    className="px-3 py-2.5 rounded-xl bg-[#2E3036] hover:bg-[#BA1A1A]/30 text-xs text-[#C4C6D0] hover:text-[#F87171] font-mono transition"
                    title="Disconnect and switch back to OFFLINE"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
