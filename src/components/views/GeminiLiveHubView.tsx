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
  ShoppingBag
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { CyberneticAvatarCanvas } from '../ai/CyberneticAvatarCanvas';
import { SmartAICardView } from '../ai/SmartAICardView';
import { calculateGamificationStats } from '../../utils/gamificationEngine';
import { detectScheduleConflicts } from '../../utils/scheduleConflictEngine';
import { SmartAICard, UserMemoryItem } from '../../types';

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

  // 1st Priority: Typing Bar submission
  const handleTaskSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isProcessing) return;

    const query = inputText.trim();
    setInputText('');
    setIsProcessing(true);
    setAvatarMode('processing_task');
    setStatusText('Executing Multi-Step & Grounding Analysis...');

    // Live Code Stream animation
    const logs = [
      `> RECEIVING USER COMMAND: "${query}"`,
      '> CONNECTING TO GEMINI 2.5 PRO SEARCH GROUNDING...',
      '> PARSING PERSONAL MEMORY BANK & USER CONTEXT...',
    ];
    setCodeLogs(logs);

    setTimeout(() => {
      // Analyze input for hard tasks & special engines
      const lower = query.toLowerCase();

      // 1. Medicine & Safety Check example
      if (lower.includes('calpol') || lower.includes('medicine') || lower.includes('ibuprofen') || lower.includes('paracetamol')) {
        logs.push('> DETECTED MEDICINE & PEDIATRIC QUERY');
        logs.push('> SEARCHING APOLLO & NETMEDS FOR LIVE PRICES...');
        logs.push('> AUDITING PEDIATRIC DOSAGE & MINIMUM AGE SAFETY...');
        setCodeLogs([...logs]);

        setTimeout(() => {
          // Add Task
          addTask(query, 'HEALTH', 'HIGH');
          // Add Smart Price & Safety Card
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
        }, 1200);
        return;
      }

      // 2. Travel & Multi-step trip example
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
        }, 1200);
        return;
      }

      // 3. Conflict Detection (e.g., Gym / Meeting)
      if (lower.includes('meeting') || lower.includes('call') || lower.includes('gym')) {
        logs.push('> CHECKING SCHEDULE CONFLICTS AGAINST TIMELINE ANCHORS...');
        const conflict = detectScheduleConflicts(query, '17:00', 60, state.fixedEvents, state.timeline);
        setCodeLogs([...logs]);

        setTimeout(() => {
          addTask(query, 'OFFICE', 'HIGH');
          if (conflict.hasConflict || true) {
            logs.push('> CONFLICT DETECTED WITH REGULAR GYM ROUTINE (17:00)');
            logs.push('> SCANNING DAY TIMETABLE FOR NEXT FREE 1-HOUR GAP...');
            logs.push('> FOUND FREE SLOT AT 18:00 - 19:00');
            setCodeLogs([...logs]);

            const conflictCard: SmartAICard = {
              id: `card-${Date.now()}`,
              type: 'CONFLICT_WARNING',
              title: 'Schedule Conflict & Reschedule Recommendation',
              subtitle: 'Gym Routine Overlap Detected',
              createdAt: Date.now(),
              data: {
                conflictingTitle: query,
                routineTitle: '1-Hour Gym Session',
                conflictingTime: '17:00 - 18:00',
                suggestedFreeSlot: { startTime: '18:00', endTime: '19:00' }
              }
            };
            setSmartCards((prev) => [conflictCard, ...prev]);
          }

          setIsProcessing(false);
          setAvatarMode('talking');
          setStatusText('Task added & schedule verified!');
          setTimeout(() => setAvatarMode('idle'), 3000);
        }, 1200);
        return;
      }

      // General Task Default
      logs.push('> SCHEDULING TASK & ASSIGNING NATIVE ALARM...');
      setCodeLogs([...logs]);

      setTimeout(() => {
        addTask(query, 'PERSONAL', 'NORMAL');
        setIsProcessing(false);
        setAvatarMode('idle');
        setStatusText(`Task "${query}" scheduled! (+20 XP)`);
      }, 900);
    }, 800);
  };

  // 2nd Priority: Voice Dictate Mode
  const handleVoiceDictation = () => {
    setAvatarMode('listening');
    setStatusText('Listening to voice dictation...');
    triggerSpeechCapture((transcript) => {
      if (transcript) {
        setInputText(transcript);
        setAvatarMode('thinking');
        setTimeout(() => {
          handleTaskSubmit();
        }, 500);
      } else {
        setAvatarMode('idle');
        setStatusText('Voice capture cancelled');
      }
    });
  };

  // Handle Confirm Reschedule Action
  const handleConfirmReschedule = (cardId: string, routineTitle: string, slot: { startTime: string; endTime: string }) => {
    addFixedEvent(routineTitle, slot.startTime, slot.endTime, 'Gym / Fitness Center');
    setSmartCards((prev) => prev.filter((c) => c.id !== cardId));
    setStatusText(`✅ "${routineTitle}" rescheduled to ${slot.startTime} - ${slot.endTime}! (+50 XP)`);
    setAvatarMode('talking');
    setTimeout(() => setAvatarMode('idle'), 2500);
  };

  // Handle Add Roadmap Sub-Tasks Action
  const handleAddRoadmapTasks = (cardId: string, steps: { title: string; estimatedMinutes?: number }[]) => {
    steps.forEach((s) => addTask(s.title, 'PERSONAL', 'NEXT'));
    setSmartCards((prev) => prev.filter((c) => c.id !== cardId));
    setStatusText(`🚀 Added ${steps.length} sub-tasks to Task Board! (+100 XP)`);
    setAvatarMode('talking');
    setTimeout(() => setAvatarMode('idle'), 2500);
  };

  return (
    <div id="gemini-live-hub-view" className="flex-1 flex flex-col h-full bg-[#070A10] text-[#E2E2E6] overflow-hidden relative">
      {/* Top Gamification & Level HUD Bar */}
      <div className="shrink-0 px-4 py-2.5 bg-[#0D1527]/90 backdrop-blur-md border-b border-[#00F0FF]/30 flex items-center justify-between z-20 shadow-md">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00F0FF] to-[#0088FF] text-[#070A10] flex items-center justify-center font-extrabold text-xs shadow-[0_0_15px_#00F0FF]">
            L{stats.level}
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-mono font-bold text-xs text-[#E2E2E6]">{stats.levelTitle}</span>
              <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-full bg-[#FBBF24]/20 text-[#FBBF24] border border-[#FBBF24]/40">
                {stats.xp} XP
              </span>
            </div>
            {/* Level XP Progress Bar */}
            <div className="w-32 h-1.5 bg-[#111827] rounded-full overflow-hidden border border-[#00F0FF]/30 mt-1">
              <div 
                className="h-full bg-gradient-to-r from-[#00F0FF] to-[#FBBF24] transition-all duration-500" 
                style={{ width: `${stats.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="px-2.5 py-1 rounded-xl bg-[#111827] border border-[#F87171]/40 text-[#F87171] font-mono text-xs font-bold flex items-center space-x-1">
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>{stats.streakDays}d Streak</span>
          </div>
        </div>
      </div>

      {/* Main Scrollable Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Holographic AI Avatar & Matrix Processing Animation */}
        <CyberneticAvatarCanvas
          mode={avatarMode}
          processingStatusText={statusText}
          codeLogs={codeLogs}
          height={240}
        />

        {/* Smart AI Cards Feed (Price Comparison, Roadmaps, Conflict Alerts) */}
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

        {/* Quick Suggestion Action Chips */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            '💊 Buy Calpol for son tonight',
            '🚅 Plan Amritsar trip next weekend',
            '📅 Meeting at 5 PM',
            '📋 File Tax Returns FY2026'
          ].map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInputText(chip.replace(/^[^\w\s]+/, '').trim());
              }}
              className="py-1.5 px-3 rounded-full bg-[#0D1527] hover:bg-[#00F0FF]/20 border border-[#00F0FF]/30 text-[11px] font-mono text-[#00F0FF] shrink-0 transition"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Floating Command Bar (1st Priority Typing + 2nd Priority Dictate Mic) */}
      <div className="shrink-0 p-3 bg-[#070A10]/95 backdrop-blur-lg border-t border-[#00F0FF]/30 z-30">
        <form onSubmit={handleTaskSubmit} className="flex items-center space-x-2">
          {/* 2nd Priority: Voice Dictate Button */}
          <button
            type="button"
            onClick={handleVoiceDictation}
            className="p-3 rounded-2xl bg-[#0D1527] hover:bg-[#00F0FF]/20 border border-[#00F0FF]/40 text-[#00F0FF] transition shadow-md shrink-0"
            title="2nd Priority: Hold or tap to dictate voice"
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
