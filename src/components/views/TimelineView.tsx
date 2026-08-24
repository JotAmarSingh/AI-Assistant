import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Clock, 
  Flame, 
  Trophy, 
  Plus, 
  TrendingUp, 
  CheckCircle2, 
  Calendar,
  Activity,
  Award
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { resolveContextualIcon } from '../../services/geminiService';
import { MiniCyberneticFaceIcon } from '../ai/CyberneticAvatarCanvas';
import { TimelineEvent } from '../../types';

export const TimelineView: React.FC = () => {
  const { state, addTimelineEvent, selectedDate } = useDay();
  const [showAddModal, setShowAddModal] = useState(false);
  const [timeInput, setTimeInput] = useState('09:00 AM');
  const [titleInput, setTitleInput] = useState('');
  const [locationInput, setLocationInput] = useState('');

  const events: TimelineEvent[] = state.timeline && state.timeline.length > 0 ? state.timeline : [
    { id: '1', time: '08:42 AM', description: 'Morning Routine', location: 'Home' },
    { id: '2', time: '09:00 AM', description: 'Breakfast (2 chapati with curd and dal)', location: 'Home Dining' },
    { id: '3', time: '09:18 AM', description: 'Deep Work - CRM Workflow (1h 34m)', location: 'Office' },
    { id: '4', time: '10:52 AM', description: 'Coffee Break & Recharge', location: 'Café' },
    { id: '5', time: '11:04 AM', description: 'Video & Reel Editing (1h 11m)', location: 'Studio' },
    { id: '6', time: '12:00 PM', description: 'Growth Strategy Meeting', location: 'Conference Room A' }
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
    <div id="timeline-view" className="flex-1 flex flex-col h-full bg-[#090D16] text-[#E2E2E6] overflow-hidden relative">
      {/* Top Bar Date & Mode Indicator */}
      <div className="shrink-0 px-4 py-3 bg-[#0D1527]/90 backdrop-blur-md border-b border-[#00F0FF]/30 flex items-center justify-between z-20">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-[#00F0FF]" />
          <span className="font-mono font-bold text-sm text-[#E2E2E6]">{selectedDate}</span>
        </div>
        <div className="px-2.5 py-1 rounded-full bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[#00F0FF] font-mono text-[10px] font-bold flex items-center space-x-1.5">
          <MiniCyberneticFaceIcon className="w-3.5 h-3.5" />
          <span>AI Day Map</span>
        </div>
      </div>

      {/* Main Scrollable Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Top Summary Dashboard Card (Matching Reference Image) */}
        <div className="p-4 rounded-[28px] bg-gradient-to-r from-[#0D1527] to-[#111827] border border-[#00F0FF]/30 shadow-[0_0_30px_rgba(0,240,255,0.1)] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#C4C6D0]/60 font-mono block uppercase">Total Tracked</span>
            <span className="text-xl font-mono font-extrabold text-[#E2E2E6]">6h 42m</span>
          </div>

          {/* Productivity Radial Progress Gauge */}
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

          <div>
            <span className="text-[10px] text-[#C4C6D0]/60 font-mono block uppercase">XP Earned</span>
            <span className="text-lg font-mono font-extrabold text-[#10B981] flex items-center">
              +320 <span className="text-xs ml-1 text-[#FBBF24]">XP</span>
            </span>
          </div>
        </div>

        {/* Vertical Glowing Timeline Rail & Cards */}
        <div className="relative pl-6 space-y-3 pt-2">
          {/* Vertical Glowing Neon Rail */}
          <div className="absolute left-3.5 top-3 bottom-3 w-0.5 bg-gradient-to-b from-[#00F0FF] via-[#0088FF] to-[#C084FC] shadow-[0_0_10px_#00F0FF]" />

          {events.map((event, idx) => {
            const icon = resolveContextualIcon(event.description, event.location);
            const isBreakfast = event.description.toLowerCase().includes('chapati') || event.description.toLowerCase().includes('breakfast');
            const isGrowthMeeting = event.description.toLowerCase().includes('growth') || event.description.toLowerCase().includes('meeting');
            const isDeepWork = event.description.toLowerCase().includes('deep work');

            return (
              <motion.div
                key={event.id || idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="relative flex items-start space-x-3"
              >
                {/* Left Glowing Node Circle Icon */}
                <div className={`absolute -left-6 top-2.5 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs shadow-lg z-10 ${
                  isDeepWork ? 'bg-[#FBBF24]/20 border-[#FBBF24] text-[#FBBF24] shadow-[0_0_12px_#FBBF24]' :
                  isBreakfast ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]' :
                  isGrowthMeeting ? 'bg-[#00F0FF]/20 border-[#00F0FF] text-[#00F0FF]' :
                  'bg-[#0D1527] border-[#0088FF] text-[#0088FF]'
                }`}>
                  <span>{icon}</span>
                </div>

                {/* Timeline Card */}
                <div className={`flex-1 p-3.5 rounded-2xl border backdrop-blur-md transition shadow-md ${
                  isDeepWork ? 'bg-[#1C160C]/90 border-[#FBBF24]/50 shadow-[0_0_20px_rgba(251,191,36,0.15)]' :
                  isBreakfast ? 'bg-[#061A14]/90 border-[#10B981]/40' :
                  isGrowthMeeting ? 'bg-[#091827]/90 border-[#00F0FF]/40' :
                  'bg-[#0D1527]/80 border-[#0088FF]/30'
                }`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-[#C4C6D0]/70">{event.time}</span>
                    {isDeepWork && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#FBBF24]/20 text-[#FBBF24] border border-[#FBBF24]/40">
                        +120 XP
                      </span>
                    )}
                    {isBreakfast && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">
                        +25 XP
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <div>
                      <h4 className="font-bold text-xs text-[#E2E2E6]">{event.description}</h4>
                      {event.location && (
                        <span className="text-[10px] text-[#C4C6D0]/60 block font-mono mt-0.5">
                          📍 {event.location}
                        </span>
                      )}
                    </div>

                    {/* AI Generated Dynamic Icon Badge (Small & Minimal) */}
                    <div className="text-xs px-1.5 py-0.5 rounded-lg bg-[#070A10]/80 border border-[#00F0FF]/30 shadow-xs shrink-0 opacity-90 font-mono">
                      {icon}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom AI Insight Box (Matching Reference Image) */}
        <div className="p-4 rounded-[28px] bg-gradient-to-r from-[#0D1527] via-[#111827] to-[#0D1527] border border-[#00F0FF]/40 shadow-[0_0_25px_rgba(0,240,255,0.15)] flex items-start space-x-3">
          <div className="w-9 h-9 rounded-2xl bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40 flex items-center justify-center shrink-0">
            <MiniCyberneticFaceIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#00F0FF] font-mono block">AI Insight</span>
            <p className="text-xs text-[#C4C6D0] leading-relaxed mt-0.5">
              You had your longest uninterrupted work session between <strong className="text-[#00F0FF]">9:18 AM – 10:52 AM</strong>. Peak focus time achieved!
            </p>
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

      {/* Add Log Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-[#070A10]/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-[28px] bg-[#0D1527] border border-[#00F0FF]/40 p-5 space-y-4 shadow-2xl"
            >
              <h3 className="text-sm font-bold font-mono text-[#00F0FF]">Add Timeline Activity</h3>
              <form onSubmit={handleAddEvent} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-mono text-[#C4C6D0] uppercase mb-1">Time</label>
                  <input
                    type="text"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    placeholder="e.g. 09:00 AM"
                    className="w-full p-2.5 rounded-xl bg-[#111827] border border-[#00F0FF]/30 text-[#E2E2E6] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-[#C4C6D0] uppercase mb-1">Description</label>
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder="e.g. Breakfast (2 chapati with curd and dal)"
                    className="w-full p-2.5 rounded-xl bg-[#111827] border border-[#00F0FF]/30 text-[#E2E2E6]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-[#C4C6D0] uppercase mb-1">Location (Optional)</label>
                  <input
                    type="text"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    placeholder="e.g. Home Dining"
                    className="w-full p-2.5 rounded-xl bg-[#111827] border border-[#00F0FF]/30 text-[#E2E2E6]"
                  />
                </div>
                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-[#111827] text-[#C4C6D0] font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-[#00F0FF] text-[#070A10] font-bold font-mono shadow-[0_0_15px_#00F0FF]"
                  >
                    Add Log
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
