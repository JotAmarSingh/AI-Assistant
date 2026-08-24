import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Clock, 
  Plus, 
  Calendar,
  ChevronDown,
  Star
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { resolveContextualIcon } from '../../services/geminiService';
import { MiniCyberneticFaceIcon } from '../ai/CyberneticAvatarCanvas';
import { TimelineEvent } from '../../types';

export const TimelineView: React.FC = () => {
  const { state, addTimelineEvent, selectedDate } = useDay();
  const [showAddModal, setShowAddModal] = useState(false);
  const [timeInput, setTimeInput] = useState('08:20 AM');
  const [titleInput, setTitleInput] = useState('');
  const [locationInput, setLocationInput] = useState('');

  const events: (TimelineEvent & { duration?: string; xp?: string; accent?: string; isMajorFocus?: boolean; subtitle?: string })[] = [
    { 
      id: '1', 
      type: 'EVENT',
      time: '08:20 AM - 08:45 AM', 
      description: 'Breakfast', 
      subtitle: '2 Chapatis, Curd & Dal',
      duration: '25m',
      xp: '+20 XP',
      accent: 'gold' 
    },
    { 
      id: '2', 
      type: 'EVENT',
      time: '09:18 AM - 10:52 AM', 
      description: 'Video Editing', 
      subtitle: 'Client Reel Workstation',
      duration: '1h 34m',
      xp: '+120 XP',
      accent: 'purple',
      isMajorFocus: true 
    },
    { 
      id: '3', 
      type: 'EVENT',
      time: '10:52 AM - 11:04 AM', 
      description: 'Coffee Break', 
      subtitle: 'Short Break & Steaming Coffee',
      duration: '12m',
      xp: '+15 XP',
      accent: 'emerald' 
    }
  ];

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleInput.trim()) return;
    addTimelineEvent(timeInput, titleInput, locationInput || undefined);
    setTitleInput('');
    setLocationInput('');
    setShowAddModal(false);
  };

  return (
    <div id="timeline-view" className="flex-1 flex flex-col h-full bg-[#070A10] text-[#E2E2E6] overflow-hidden relative">
      {/* Top Bar Header (Matching Concept 6) */}
      <div className="shrink-0 px-4 py-3 bg-[#0D1527]/90 backdrop-blur-md border-b border-[#00F0FF]/30 flex items-center justify-between z-20">
        <button className="flex items-center space-x-1 text-sm font-bold font-mono text-[#E2E2E6]">
          <span>{selectedDate || 'Tue, 24 May'}</span>
          <ChevronDown className="w-4 h-4 text-[#00F0FF]" />
        </button>
        <div className="px-2.5 py-1 rounded-full bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[#00F0FF] font-mono text-[10px] font-bold flex items-center space-x-1.5 shadow-[0_0_10px_rgba(0,240,255,0.3)]">
          <MiniCyberneticFaceIcon className="w-3.5 h-3.5" />
          <span>AI Mode</span>
        </div>
      </div>

      {/* Main Scrollable Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Daily Progress Summary Card */}
        <div className="p-4 rounded-[28px] bg-gradient-to-r from-[#0D1527] to-[#111827] border border-[#00F0FF]/30 shadow-[0_0_30px_rgba(0,240,255,0.12)] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#C4C6D0]/60 font-mono block uppercase">Total Tracked</span>
            <span className="text-xl font-mono font-extrabold text-[#E2E2E6]">6h 42m</span>
          </div>

          {/* Circular Progress Ring (73% Productive) */}
          <div className="flex flex-col items-center">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#111827]"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#00F0FF]"
                  strokeDasharray="73, 100"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-xs font-mono font-extrabold text-[#00F0FF]">73%</span>
              </div>
            </div>
            <span className="text-[9px] text-[#C4C6D0]/70 font-mono mt-0.5">Productive</span>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-[#C4C6D0]/60 font-mono block uppercase">XP Earned</span>
            <span className="text-lg font-mono font-extrabold text-[#10B981] flex items-center justify-end">
              +320 <span className="text-xs ml-1 text-[#FBBF24]">XP</span>
            </span>
          </div>
        </div>

        {/* Vertical Glowing Timeline Path & Entries */}
        <div className="relative pl-6 space-y-4 pt-2">
          {/* Glowing Thin Neon Path */}
          <div className="absolute left-3.5 top-3 bottom-3 w-0.5 bg-gradient-to-b from-[#FBBF24] via-[#C084FC] to-[#10B981] shadow-[0_0_10px_#00F0FF]" />

          {events.map((event, idx) => {
            const icon = resolveContextualIcon(event.description, event.subtitle);
            const isGold = event.accent === 'gold';
            const isPurple = event.accent === 'purple';
            const isEmerald = event.accent === 'emerald';

            return (
              <motion.div
                key={event.id || idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="relative flex items-start space-x-3"
              >
                {/* Glowing Checkpoint Node Icon */}
                <div className={`absolute -left-6 top-3 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs shadow-lg z-10 ${
                  isPurple ? 'bg-[#C084FC]/20 border-[#C084FC] text-[#C084FC] shadow-[0_0_15px_#C084FC]' :
                  isGold ? 'bg-[#FBBF24]/20 border-[#FBBF24] text-[#FBBF24] shadow-[0_0_12px_#FBBF24]' :
                  'bg-[#10B981]/20 border-[#10B981] text-[#10B981] shadow-[0_0_12px_#10B981]'
                }`}>
                  <span>{isPurple ? '★' : isGold ? '🫓' : '☕'}</span>
                </div>

                {/* Task Card Surface */}
                <div className={`flex-1 p-4 rounded-[24px] border backdrop-blur-md transition shadow-md relative overflow-hidden ${
                  event.isMajorFocus 
                    ? 'bg-[#1D122A]/90 border-[#C084FC] shadow-[0_0_25px_rgba(192,132,252,0.3)] ring-1 ring-[#C084FC]/50 scale-[1.02]' 
                    : isGold 
                    ? 'bg-[#1C160C]/85 border-[#FBBF24]/40' 
                    : 'bg-[#061A14]/85 border-[#10B981]/40'
                }`}>
                  {/* Active Major Focus Golden Star Badge */}
                  {event.isMajorFocus && (
                    <div className="absolute top-2 right-3 flex items-center space-x-1 text-[10px] font-mono font-bold text-[#FBBF24]">
                      <Star className="w-3 h-3 fill-current text-[#FBBF24]" />
                      <span>Major Focus Session</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-[#C4C6D0]/80">{event.time}</span>
                  </div>

                  <div className="flex items-start justify-between mt-1">
                    <div>
                      <h4 className="font-bold text-sm text-[#E2E2E6]">{event.description}</h4>
                      {event.subtitle && (
                        <span className="text-[11px] text-[#C4C6D0]/70 block font-mono mt-0.5">
                          {event.subtitle}
                        </span>
                      )}

                      <div className="flex items-center space-x-2 mt-2">
                        {event.duration && (
                          <span className="text-[10px] font-mono text-[#C4C6D0]/60 px-2 py-0.5 rounded-full bg-[#111827] border border-[#00F0FF]/20">
                            {event.duration}
                          </span>
                        )}
                        {event.xp && (
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            isPurple ? 'bg-[#C084FC]/20 text-[#C084FC] border-[#C084FC]/40' :
                            isGold ? 'bg-[#FBBF24]/20 text-[#FBBF24] border-[#FBBF24]/40' :
                            'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40'
                          }`}>
                            {event.xp}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detailed Contextual Clipart Badge */}
                    <div className="text-xl p-2 rounded-2xl bg-[#070A10]/70 border border-[#00F0FF]/30 shadow-inner shrink-0 ml-2">
                      {icon}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* AI Insight Card (Matching Concept 6) */}
        <div className="p-4 rounded-[28px] bg-gradient-to-r from-[#0D1527] via-[#111827] to-[#0D1527] border border-[#00F0FF]/50 shadow-[0_0_30px_rgba(0,240,255,0.2)] flex items-center justify-between">
          <div className="space-y-1 pr-2">
            <span className="text-xs font-bold text-[#00F0FF] font-mono block">AI Insight</span>
            <p className="text-xs text-[#C4C6D0] leading-relaxed">
              Your strongest uninterrupted focus session was <strong className="text-[#00F0FF]">Video Editing</strong> from <strong className="text-[#00F0FF]">9:18 AM to 10:52 AM</strong>.
            </p>
          </div>

          {/* Universal Cybernetic AI Face Avatar on Right Side */}
          <div className="w-12 h-12 rounded-2xl bg-[#070A10] border border-[#00F0FF]/50 shadow-[0_0_15px_rgba(0,240,255,0.4)] flex items-center justify-center shrink-0">
            <MiniCyberneticFaceIcon className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Floating Add Log Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed right-5 bottom-20 p-3.5 rounded-full bg-[#00F0FF] text-[#070A10] shadow-[0_0_25px_#00F0FF] transition hover:scale-105 z-30"
        title="Add Timeline Log"
      >
        <Plus className="w-5 h-5 font-extrabold" />
      </button>
    </div>
  );
};
