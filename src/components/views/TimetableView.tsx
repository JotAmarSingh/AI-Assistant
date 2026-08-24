import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CalendarClock, 
  Plus, 
  CheckCircle2, 
  Play, 
  Trash2, 
  Edit3, 
  ChevronDown, 
  ChevronUp, 
  MapPin, 
  Clock, 
  AlertCircle,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { TimetableSlot } from '../../types';
import { resolveContextualIcon } from '../../services/geminiService';

export const TimetableView: React.FC = () => {
  const {
    state,
    addTimetableSlot,
    updateTimetableSlot,
    deleteTimetableSlot,
    toggleSlotStatus,
    syncTimetableToDailyTasks,
  } = useDay();

  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formLocation, setFormLocation] = useState('');

  const slots = state.timetableSlots || [
    { id: '1', startTime: '08:00', endTime: '09:00', title: 'Breakfast (2 chapati with curd and dal)', location: 'Home Dining', status: 'COMPLETED' },
    { id: '2', startTime: '09:18', endTime: '10:52', title: 'Video & Reel Editing (32yo Sikh Avatar)', location: 'Studio Workstation', status: 'NOW' },
    { id: '3', startTime: '11:00', endTime: '12:00', title: 'Growth Strategy Meeting', location: 'Conference Room A', status: 'UPCOMING' },
    { id: '4', startTime: '14:00', endTime: '15:00', title: 'Client Feedback Sync', location: 'Google Meet', status: 'MISSED' }
  ];

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'NOW':
      case 'ACTIVE':
        return { label: 'NOW', bg: 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]' };
      case 'MISSED':
      case 'OVERDUE':
        return { label: 'MISSED', bg: 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]' };
      case 'COMPLETED':
      case 'DONE':
        return { label: 'DONE', bg: 'bg-[#334867]/40 text-[#C4C6D0]/60 border-[#334867]' };
      case 'UPCOMING':
      default:
        return { label: 'UPCOMING', bg: 'bg-[#FBBF24]/20 text-[#FBBF24] border-[#FBBF24]' };
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    addTimetableSlot({
      title: formTitle.trim(),
      startTime: formStartTime,
      endTime: formEndTime,
      location: formLocation || undefined,
      category: 'OFFICE',
      recurrence: 'DAILY'
    });

    setFormTitle('');
    setShowAddModal(false);
  };

  return (
    <div id="timetable-view" className="flex-1 flex flex-col h-full bg-[#070A10] text-[#E2E2E6] overflow-hidden relative">
      {/* Top Bar Header */}
      <div className="shrink-0 px-4 py-3 bg-[#0D1527]/95 backdrop-blur-md border-b border-[#00F0FF]/30 flex items-center justify-between z-20 shadow-md">
        <div className="flex items-center space-x-2">
          <CalendarClock className="w-4 h-4 text-[#00F0FF]" />
          <div>
            <h2 className="font-mono font-bold text-sm text-[#E2E2E6]">Minimalistic Mechanical Timetable</h2>
            <p className="text-[10px] text-[#C4C6D0]/70 font-mono">Ultra-Sleek Single Line Accordion Cadence</p>
          </div>
        </div>

        <button
          onClick={() => syncTimetableToDailyTasks()}
          className="px-2.5 py-1 rounded-full bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[#00F0FF] text-[10px] font-mono font-bold hover:bg-[#00F0FF]/25 transition"
        >
          Sync to Tasks
        </button>
      </div>

      {/* Main Timetable Slots Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {slots.map((slot: any) => {
          const isExpanded = expandedSlotId === slot.id;
          const statusInfo = getStatusBadge(slot.status);
          const icon = resolveContextualIcon(slot.title, slot.location);

          return (
            <motion.div
              key={slot.id}
              layout
              className={`rounded-2xl border transition shadow-sm overflow-hidden ${
                slot.status === 'NOW' ? 'bg-[#0D1527] border-[#10B981] shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-1 ring-[#10B981]' :
                slot.status === 'MISSED' ? 'bg-[#1C0E11] border-[#EF4444]/60' :
                slot.status === 'COMPLETED' ? 'bg-[#070A10]/60 border-[#334867]/40 opacity-75' :
                'bg-[#0D1527]/90 border-[#00F0FF]/30'
              }`}
            >
              {/* Collapsed Single-Line Mechanical Bar */}
              <div
                onClick={() => setExpandedSlotId(isExpanded ? null : slot.id)}
                className="p-3.5 flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center space-x-3 min-w-0 pr-2">
                  <span className="text-xs font-mono font-bold text-[#00F0FF] shrink-0">
                    {slot.startTime} - {slot.endTime}
                  </span>

                  <span className="text-sm p-1 rounded-lg bg-[#070A10] border border-[#00F0FF]/30 font-mono shrink-0">
                    {icon}
                  </span>

                  <span className={`text-xs font-bold truncate ${slot.status === 'COMPLETED' ? 'line-through text-[#C4C6D0]/50' : 'text-[#E2E2E6]'}`}>
                    {slot.title}
                  </span>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${statusInfo.bg}`}>
                    {statusInfo.label}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-[#00F0FF]" /> : <ChevronDown className="w-4 h-4 text-[#C4C6D0]/50" />}
                </div>
              </div>

              {/* Expanded Details (On Tap) */}
              {isExpanded && (
                <div className="px-4 pb-3.5 pt-1 border-t border-[#00F0FF]/15 space-y-2 bg-[#070A10]/60 text-xs">
                  {slot.location && (
                    <div className="flex items-center space-x-1.5 text-[11px] text-[#C4C6D0] font-mono">
                      <MapPin className="w-3.5 h-3.5 text-[#00F0FF]" />
                      <span>{slot.location}</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-2 pt-2 border-t border-[#00F0FF]/10">
                    <button
                      type="button"
                      onClick={() => toggleSlotStatus(slot.id)}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] font-mono font-bold text-[11px] flex items-center justify-center space-x-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{slot.status === 'COMPLETED' ? 'Mark Active' : 'Mark Complete'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteTimetableSlot(slot.id)}
                      className="p-2 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#EF4444]"
                      title="Delete routine block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Floating Quick Add Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed right-5 bottom-20 p-3.5 rounded-full bg-[#00F0FF] text-[#070A10] shadow-[0_0_25px_#00F0FF] transition hover:scale-105 z-30"
        title="Add Timetable Slot"
      >
        <Plus className="w-5 h-5 font-extrabold" />
      </button>

      {/* Add Slot Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-[#070A10]/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-[28px] bg-[#0D1527] border border-[#00F0FF]/40 p-5 space-y-4 shadow-2xl"
            >
              <h3 className="text-sm font-bold font-mono text-[#00F0FF]">Add Timetable Slot</h3>
              <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-mono text-[#C4C6D0] uppercase mb-1">Slot Title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Breakfast (2 chapati with curd and dal)"
                    className="w-full p-2.5 rounded-xl bg-[#111827] border border-[#00F0FF]/30 text-[#E2E2E6]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-[#C4C6D0] uppercase mb-1">Start Time</label>
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#111827] border border-[#00F0FF]/30 text-[#E2E2E6]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-[#C4C6D0] uppercase mb-1">End Time</label>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#111827] border border-[#00F0FF]/30 text-[#E2E2E6]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-[#C4C6D0] uppercase mb-1">Location / Link</label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Home Dining or Google Meet"
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
                    Save Slot
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
