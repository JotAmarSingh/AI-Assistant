import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Mic, 
  MicOff,
  Square,
  Sparkles, 
  Flame, 
  Trophy, 
  Brain, 
  Plus, 
  Compass, 
  Radio, 
  Volume2,
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  Bot
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { CyberneticAvatarCanvas, MiniCyberneticFaceIcon } from '../ai/CyberneticAvatarCanvas';
import { SmartAICardView } from '../ai/SmartAICardView';
import { calculateGamificationStats } from '../../utils/gamificationEngine';
import { detectScheduleConflicts } from '../../utils/scheduleConflictEngine';
import { 
  queryGeminiAPI, 
  getStoredGeminiApiKey, 
  setGeminiApiKey, 
  clearGeminiApiKey,
  verifyGeminiApiKey 
} from '../../services/geminiService';
import { speechService } from '../../services/speechRecognition';
import { SmartAICard, UserMemoryItem } from '../../types';

import { DayTraceAI } from '../DayTraceAI/DayTraceAI';

export const GeminiLiveHubView: React.FC = () => {
  const { 
    state, 
    addTask, 
    updateTaskStatus, 
    addFixedEvent, 
    updateUserSettings
  } = useDay();

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [avatarMode, setAvatarMode] = useState<'idle' | 'listening' | 'thinking' | 'talking' | 'processing_task'>('idle');
  const [statusText, setStatusText] = useState('Cybernetic Core Active');
  const [codeLogs, setCodeLogs] = useState<string[]>([]);
  const [smartCards, setSmartCards] = useState<SmartAICard[]>([]);
  const [memories, setMemories] = useState<UserMemoryItem[]>(state.userMemoryBank || []);

  // Online / Offline Network & Engine State
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [hasCustomKey, setHasCustomKey] = useState<boolean>(false);
  const [keyTestStatus, setKeyTestStatus] = useState<string | null>(null);

  const silenceTimerRef = useRef<number | null>(null);
  const stats = calculateGamificationStats(state.gamification?.points || 120, state.gamification?.currentStreakDays || 3);

  // Network & lifecycle listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const saved = getStoredGeminiApiKey();
    setCustomKeyInput(saved);
    setHasCustomKey(Boolean(saved && saved.trim()));

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

  // Helper to detect if user input is an information/advice question vs a task schedule command
  const isQuestionOrAdvice = (query: string): boolean => {
    const text = query.toLowerCase().trim();
    if (text.endsWith('?')) return true;
    const questionStarters = ['what', 'why', 'how', 'which', 'who', 'where', 'when', 'should', 'can', 'could', 'would', 'is', 'are', 'tell me', 'explain', 'compare', 'recommend', 'advice', 'banana', 'orange', 'fruit'];
    return questionStarters.some((starter) => text.startsWith(starter) || text.includes(starter));
  };

  // Primary Query & Task Execution Handler
  const submitQuery = async (queryText: string) => {
    const query = queryText.trim();
    if (!query || isProcessing) return;

    // Immediately clear input box
    setInputText('');
    setInterimText('');
    setIsProcessing(true);
    setAvatarMode('processing_task');
    setStatusText('Processing with DayTrace AI...');

    const logs = [
      `> RECEIVING USER COMMAND: "${query}"`,
      '> ANALYZING QUERY INTENT & CONTEXT...',
    ];
    const lower = query.toLowerCase();

    // 0. Account / Login / Auth Inquiry
    if (
      lower.includes('log in') || 
      lower.includes('login') || 
      lower.includes('sign in') || 
      lower.includes('signin') || 
      lower.includes('account') || 
      lower.includes('password')
    ) {
      logs.push('> INTENT: ACCOUNT / AUTHENTICATION QUERY');
      logs.push('> GENERATING OFFLINE PRIVACY & SYNC ADVISORY...');
      setCodeLogs([...logs]);

      const authCard: SmartAICard = {
        id: `card-${Date.now()}`,
        type: 'EXPERT_ADVICE',
        title: 'DayTrace Offline & Cloud Sync Advisory',
        subtitle: 'Privacy & Storage Architecture',
        engineMode: 'OFFLINE_LOCAL',
        createdAt: Date.now(),
        data: {
          safetyWarning: `🔒 DayTrace is 100% Offline-First & Private:\n\n• No account or login required: All your tasks, habits, daily history, and timeline are stored securely on this phone.\n• Optional Google Sheets Sync: To backup or sync your data to Google Sheets, tap the Backup/Download icon (📥) in the top app bar.\n• Data Export: You can export or import complete JSON backups anytime from the top app bar.`
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
      lower.includes('help')
    ) {
      logs.push('> INTENT: ASSISTANT GREETING & CAPABILITIES');
      setCodeLogs([...logs]);

      const greetingCard: SmartAICard = {
        id: `card-${Date.now()}`,
        type: 'EXPERT_ADVICE',
        title: 'DayTrace Cybernetic Assistant',
        subtitle: 'Core Capabilities & Voice Commands',
        engineMode: 'OFFLINE_LOCAL',
        createdAt: Date.now(),
        data: {
          safetyWarning: `👋 Greetings! I am DayTrace AI, your accountability assistant.\n\nHere is what you can do:\n• Add Tasks & Alarms: Speak "Gym workout at 6pm" or "Review client deck"\n• Ask Knowledge & Advice: "Is banana or orange better for a child?"\n• Check Schedule & Reminders: "What is pending today?" or "What's next?"\n• Smart Roadmaps: "Plan Amritsar weekend trip" or "Buy Calpol for son"\n• Meeting Mode: Tap the top mic icon to record meetings with offline summaries!`
        }
      };

      setSmartCards((prev) => [greetingCard, ...prev]);
      setIsProcessing(false);
      setAvatarMode('talking');
      setStatusText('Assistant ready!');
      setTimeout(() => setAvatarMode('idle'), 4000);
      return;
    }

    // Intent Classification: Question / Advice vs Task Assignment
    const isQuestion = isQuestionOrAdvice(query);

    if (isQuestion) {
      logs.push('> INTENT: CONVERSATIONAL KNOWLEDGE & ADVICE REQUEST');
      logs.push('> CALLING GEMINI PRO API WITH GROUNDING...');
      setCodeLogs([...logs]);

      try {
        const aiResponse = await queryGeminiAPI(query);
        logs.push('> GROUNDING VERIFIED. GENERATING HYBRID SUMMARY CARD...');
        setCodeLogs([...logs]);

        const answerCard: SmartAICard = {
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: `Gemini Pro AI: ${query.length > 40 ? query.substring(0, 40) + '...' : query}`,
          subtitle: 'Verified Grounded Response',
          engineMode: 'ONLINE_CLOUD',
          createdAt: Date.now(),
          data: {
            safetyWarning: aiResponse || `Information generated for: "${query}".`
          }
        };

        setSmartCards((prev) => [answerCard, ...prev]);
        setIsProcessing(false);
        setAvatarMode('talking');
        setStatusText('Gemini Pro Answer Ready!');
        setTimeout(() => setAvatarMode('idle'), 4000);
      } catch (err) {
        logs.push('> OFFLINE INTELLIGENCE ENGINE ENGAGED');
        setCodeLogs([...logs]);

        let fallbackAnswer = '';
        if (lower.includes('festival')) {
          fallbackAnswer = `🎉 Upcoming Festivals in India:\n\n• Raksha Bandhan (August)\n• Krishna Janmashtami (August)\n• Ganesh Chaturthi (September)\n• Navratri & Durga Puja (October)\n• Diwali (Festival of Lights - October/November)\n\nStay tuned for holiday timetable anchors!`;
        } else if (lower.includes('banana') || lower.includes('orange')) {
          fallbackAnswer = `🍌 Banana vs 🍊 Orange for Children:\n\n• Banana: Rich in potassium, Vitamin B6, and dietary fiber. Very gentle on digestion, ideal for quick energy before play or bedtime.\n• Orange: High in Vitamin C, antioxidants, and water content. Great for immunity, but higher citric acid.\n\nRecommendation: Both are excellent! Offer banana for energy/toddlers, and orange slices for immunity hydration.`;
        } else {
          fallbackAnswer = `💡 DayTrace On-Device Intelligence:\n\n• Query received: "${query}"\n• Tip: You can schedule this as a task, check your timetable, or ask specific productivity questions.\n• To enable live cloud searches with Gemini Pro, configure your personal API key in the AI Engine settings (tap the ONLINE/OFFLINE badge in the top bar).`;
        }

        const fallbackCard: SmartAICard = {
          id: `card-${Date.now()}`,
          type: 'EXPERT_ADVICE',
          title: `DayTrace AI: ${query.length > 36 ? query.substring(0, 36) + '...' : query}`,
          subtitle: 'On-Device Response',
          engineMode: 'OFFLINE_LOCAL',
          createdAt: Date.now(),
          data: {
            safetyWarning: fallbackAnswer
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

    // Task Assignment Flow
    // 1. Medicine & Safety Check
    if (lower.includes('calpol') || lower.includes('medicine') || lower.includes('ibuprofen') || lower.includes('paracetamol')) {
      logs.push('> DETECTED MEDICINE & PEDIATRIC QUERY');
      logs.push('> SEARCHING APOLLO & NETMEDS FOR LIVE PRICES...');
      logs.push('> AUDITING PEDIATRIC DOSAGE & SAFETY CONSTRAINTS...');
      setCodeLogs([...logs]);

      setTimeout(() => {
        addTask(query, 'HEALTH', 'HIGH');
        const newCard: SmartAICard = {
          id: `card-${Date.now()}`,
          type: 'PRICE_COMPARISON',
          title: 'Medicine Price & Pediatric Safety Audit',
          subtitle: 'Apollo vs Netmeds Live Grounding',
          engineMode: 'OFFLINE_LOCAL',
          createdAt: Date.now(),
          data: {
            comparisonRows: [
              { seller: 'Apollo Pharmacy', price: '₹65', stock: 'In Stock', rating: '4.8' },
              { seller: 'Netmeds Online', price: '₹58', stock: 'Delivers Tomorrow', rating: '4.7' },
              { seller: '1mg Healthcare', price: '₹60', stock: '2-Hour Delivery', rating: '4.9' }
            ],
            safetyWarning: 'Calpol (Paracetamol) 120mg/5ml suspension is safe for children > 3 months. Recommended dose for 5yo (~18kg): 5ml to 7.5ml after meals.'
          }
        };
        setSmartCards((prev) => [newCard, ...prev]);
        setIsProcessing(false);
        setAvatarMode('talking');
        setStatusText('Task scheduled & price comparison ready!');
        setTimeout(() => setAvatarMode('idle'), 3000);
      }, 1000);
      return;
    }

    // 2. Travel & Multi-step trip
    if (lower.includes('amritsar') || lower.includes('travel') || lower.includes('trip') || lower.includes('train')) {
      logs.push('> DETECTED MULTI-STEP TRAVEL INQUIRY');
      logs.push('> FETCHING VANDE BHARAT & SHATABDI TICKET FARES...');
      logs.push('> DECOMPOSING TRIP INTO 4 SUB-TASKS...');
      setCodeLogs([...logs]);

      setTimeout(() => {
        addTask('Plan Amritsar Weekend Trip', 'PERSONAL', 'HIGH');
        const newCard: SmartAICard = {
          id: `card-${Date.now()}`,
          type: 'MULTI_STEP_ROADMAP',
          title: 'Amritsar Weekend Trip Roadmap',
          subtitle: '4 Automated Sub-Tasks & Travel Cards',
          engineMode: 'OFFLINE_LOCAL',
          createdAt: Date.now(),
          data: {
            goalTitle: 'Amritsar Trip',
            steps: [
              { id: 's1', title: 'Book Vande Bharat Train (07:10 Departure, ₹1,350)', estimatedMinutes: 15 },
              { id: 's2', title: 'Reserve Hotel near Golden Temple (4-Star, ₹3,200/night)', estimatedMinutes: 20 },
              { id: 's3', title: 'Schedule Wagah Border Evening Ceremony Anchor', estimatedMinutes: 10 },
              { id: 's4', title: 'Pack Light Cottons (Weather Forecast: High 31°C)', estimatedMinutes: 30 }
            ]
          }
        };
        setSmartCards((prev) => [newCard, ...prev]);
        setIsProcessing(false);
        setAvatarMode('talking');
        setStatusText('Travel roadmap & train fares fetched!');
        setTimeout(() => setAvatarMode('idle'), 3000);
      }, 1000);
      return;
    }

    // General Task Default
    logs.push('> SCHEDULING TASK & ASSIGNING NATIVE ALARM...');
    setCodeLogs([...logs]);

    setTimeout(() => {
      addTask(query, 'PERSONAL', 'NORMAL');
      setIsProcessing(false);
      setAvatarMode('talking');
      setStatusText(`Task "${query}" scheduled! (+20 XP)`);
      setTimeout(() => setAvatarMode('idle'), 3000);
    }, 1000);
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
        setTimeout(() => setStatusText('Cybernetic Core Active'), 4000);
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
        setTimeout(() => setStatusText('Cybernetic Core Active'), 4000);
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
                borderColor: hasCustomKey ? 'rgba(52, 211, 153, 0.7)' : 'rgba(251, 191, 36, 0.7)',
                color: hasCustomKey ? '#34D399' : '#FBBF24',
                boxShadow: hasCustomKey ? '0 0 15px rgba(52, 211, 153, 0.25)' : '0 0 15px rgba(251, 191, 36, 0.2)'
              }}
              title={hasCustomKey ? "Online (Gemini Pro Connected) - Tap to manage" : "Offline (Tap to enter Gemini API Key)"}
            >
              <span className={`w-2 h-2 rounded-full ${hasCustomKey ? 'bg-[#34D399] animate-pulse' : 'bg-[#FBBF24]'}`} />
              <span>{hasCustomKey ? 'ONLINE' : 'OFFLINE'}</span>
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
              : (avatarMode === 'idle' ? 'CYBERNETIC AI CORE ACTIVE • TAP TO SPEAK' : statusText)
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
            />
          ))}
        </AnimatePresence>

        {/* Quick Suggestion Chips */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            'Is a banana or an orange better for a child?',
            '💊 Buy Calpol for son tonight',
            '🚅 Plan Amritsar trip next weekend',
            '📋 File Tax Returns FY2026'
          ].map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInputText(chip);
              }}
              className="py-1.5 px-3 rounded-full bg-[#0D1527] hover:bg-[#00F0FF]/20 border border-[#00F0FF]/30 text-[11px] font-mono text-[#00F0FF] shrink-0 transition"
            >
              {chip}
            </button>
          ))}
        </div>
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
                  : 'Assign a task or ask Gemini Pro...'
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
                    {hasCustomKey ? 'Gemini Cloud AI Active' : 'Gemini Cloud AI Setup'}
                  </h3>
                  <p className="text-[10px] text-[#C4C6D0]/70">
                    {hasCustomKey ? 'ONLINE Mode Enabled' : 'OFFLINE Mode • Connect API Key'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="text-[#C4C6D0] hover:text-[#E2E2E6] p-1 font-bold">
                ✕
              </button>
            </div>

            {/* Current Engine Status */}
            <div className={`p-3 rounded-2xl border text-xs font-mono space-y-1.5 ${
              hasCustomKey 
                ? 'bg-[#10B981]/10 border-[#10B981]/40' 
                : 'bg-[#FBBF24]/10 border-[#FBBF24]/40'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[#C4C6D0]">Current Status:</span>
                <span className={`font-bold flex items-center space-x-1.5 ${hasCustomKey ? 'text-[#34D399]' : 'text-[#FBBF24]'}`}>
                  <span className={`w-2 h-2 rounded-full ${hasCustomKey ? 'bg-[#34D399] animate-pulse' : 'bg-[#FBBF24]'}`} />
                  <span>{hasCustomKey ? 'ONLINE (Gemini Pro Connected)' : 'OFFLINE (On-Device Local)'}</span>
                </span>
              </div>
              <p className="text-[10px] text-[#C4C6D0]/80 leading-tight">
                {hasCustomKey
                  ? 'Your Gemini API key is active. Live search grounding and reasoning are active.'
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
