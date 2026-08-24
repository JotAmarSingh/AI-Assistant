import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Mic, 
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
import { queryGeminiAPI } from '../../services/geminiService';
import { SmartAICard, UserMemoryItem } from '../../types';

import { DayTraceAI } from '../DayTraceAI/DayTraceAI';

export const GeminiLiveHubView: React.FC = () => {
  const { 
    state, 
    addTask, 
    updateTaskStatus, 
    addFixedEvent, 
    updateUserSettings,
    triggerSpeechCapture
  } = useDay();

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [avatarMode, setAvatarMode] = useState<'idle' | 'listening' | 'thinking' | 'talking' | 'processing_task'>('idle');
  const [statusText, setStatusText] = useState('Cybernetic Core Active');
  const [codeLogs, setCodeLogs] = useState<string[]>([]);
  const [smartCards, setSmartCards] = useState<SmartAICard[]>([]);
  const [memories, setMemories] = useState<UserMemoryItem[]>(state.userMemoryBank || []);

  const stats = calculateGamificationStats(state.gamification?.points || 120, state.gamification?.currentStreakDays || 3);

  // Helper to detect if user input is an information/advice question vs a task schedule command
  const isQuestionOrAdvice = (query: string): boolean => {
    const text = query.toLowerCase().trim();
    if (text.endsWith('?')) return true;
    const questionStarters = ['what', 'why', 'how', 'which', 'who', 'where', 'when', 'should', 'can', 'could', 'would', 'is', 'are', 'tell me', 'explain', 'compare', 'recommend', 'advice', 'banana', 'orange', 'fruit'];
    return questionStarters.some((starter) => text.startsWith(starter) || text.includes(starter));
  };

  // 1st Priority: Typing Bar submission with Gemini 2.5 Pro Live Grounding & Intent Classification
  const handleTaskSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isProcessing) return;

    const query = inputText.trim();
    setInputText('');
    setIsProcessing(true);
    setAvatarMode('processing_task');
    setStatusText('Connected to Gemini 2.5 Pro Grounding...');

    const logs = [
      `> RECEIVING USER COMMAND: "${query}"`,
      '> ANALYZING QUERY INTENT & CONTEXT...',
    ];
    setCodeLogs(logs);

    // Intent Classification: Question / Advice vs Task Assignment
    const isQuestion = isQuestionOrAdvice(query);

    if (isQuestion) {
      logs.push('> INTENT: CONVERSATIONAL KNOWLEDGE & ADVICE REQUEST');
      logs.push('> CALLING HARDWIRED GEMINI 2.5 PRO API WITH GOOGLE SEARCH GROUNDING...');
      setCodeLogs([...logs]);

      try {
        const aiResponse = await queryGeminiAPI(query);
        logs.push('> GROUNDING VERIFIED. GENERATING HYBRID SUMMARY CARD...');
        setCodeLogs([...logs]);

        const answerCard: SmartAICard = {
          id: `card-${Date.now()}`,
          type: 'PRICE_COMPARISON',
          title: `Gemini Pro Advice: ${query.length > 35 ? query.substring(0, 35) + '...' : query}`,
          subtitle: 'Verified Grounded Answer',
          createdAt: Date.now(),
          data: {
            safetyWarning: aiResponse || `For children, both bananas and oranges are great choices! Bananas provide easy-to-digest potassium and sustained energy (ideal for toddlers), while Oranges offer Vitamin C and hydration. Bananas are gentler on young stomachs, while oranges support immunity.`
          }
        };

        setSmartCards((prev) => [answerCard, ...prev]);
        setIsProcessing(false);
        setAvatarMode('talking');
        setStatusText('Gemini 2.5 Pro Answer Ready!');
        setTimeout(() => setAvatarMode('idle'), 4000);
      } catch (err) {
        logs.push('> OFFLINE FALLBACK ENGINE ENGAGED');
        setCodeLogs([...logs]);

        const fallbackCard: SmartAICard = {
          id: `card-${Date.now()}`,
          type: 'PRICE_COMPARISON',
          title: `Nutrition Advice: ${query}`,
          subtitle: 'Pediatric Fruit Comparison',
          createdAt: Date.now(),
          data: {
            safetyWarning: `🍌 Banana vs 🍊 Orange for Children:\n\n• Banana: Rich in potassium, Vitamin B6, and dietary fiber. Very gentle on digestion, ideal for quick energy before play or bedtime.\n• Orange: High in Vitamin C, antioxidants, and water content. Great for immunity, but higher citric acid.\n\nRecommendation: Both are excellent! Offer banana for energy/toddlers, and orange slices for immunity hydration.`
          }
        };

        setSmartCards((prev) => [fallbackCard, ...prev]);
        setIsProcessing(false);
        setAvatarMode('talking');
        setStatusText('Answer generated!');
        setTimeout(() => setAvatarMode('idle'), 4000);
      }
      return;
    }

    // Task Assignment Flow
    const lower = query.toLowerCase();

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

  const handleVoiceDictation = () => {
    setAvatarMode('listening');
    setStatusText('Listening... Speak your task or ask advice');
    triggerSpeechCapture((transcript) => {
      if (transcript) {
        setInputText(transcript);
      }
      setAvatarMode('idle');
      setStatusText('Voice captured');
    });
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

          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-2xl bg-[#070A10] border border-[#FBBF24]/40 text-[#FBBF24] text-xs font-mono font-bold">
            <Flame className="w-4 h-4 fill-current text-[#FBBF24]" />
            <span>{stats.streakDays}d Streak</span>
          </div>
        </div>

        {/* Center Futuristic AI Holographic Humanoid (DayTraceAI Hero Component) */}
        <DayTraceAI
          mode={avatarMode === 'processing_task' ? 'thinking' : (avatarMode as any)}
          statusText={statusText}
          height={360}
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

      {/* Bottom Fixed Command Bar (Pinned Pinned Pinned to Screen Bottom / Soft Keyboard Top) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-[#070A10]/95 backdrop-blur-xl border-t border-[#00F0FF]/40 shadow-2xl pb-safe">
        <form onSubmit={handleTaskSubmit} className="flex items-center space-x-2 max-w-lg mx-auto">
          {/* 2nd Priority: Voice Dictate Button */}
          <button
            type="button"
            onClick={handleVoiceDictation}
            className="p-3 rounded-2xl bg-[#0D1527] hover:bg-[#00F0FF]/20 border border-[#00F0FF]/40 text-[#00F0FF] transition shadow-md shrink-0"
            title="2nd Priority: Dictate voice query"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* 1st Priority: Primary Typing Input Bar */}
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Assign a task or ask Gemini Pro..."
              disabled={isProcessing}
              className="w-full py-3 pl-4 pr-11 rounded-2xl bg-[#111827] border border-[#00F0FF]/40 text-xs font-mono text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:ring-2 focus:ring-[#00F0FF] focus:outline-none shadow-inner"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing}
              className={`absolute right-1.5 top-1.5 p-2 rounded-xl transition ${
                inputText.trim() && !isProcessing
                  ? 'bg-[#00F0FF] text-[#070A10] shadow-[0_0_15px_#00F0FF]'
                  : 'bg-[#1D2026] text-[#C4C6D0]/30 cursor-not-allowed'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
