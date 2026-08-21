import React from 'react';
import { X, CheckCircle2, PauseCircle, Play, Bell, Calendar, Sparkles, MapPin, Zap } from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { motion, AnimatePresence } from 'motion/react';

interface AndroidNotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidNotificationCenter: React.FC<AndroidNotificationCenterProps> = ({ isOpen, onClose }) => {
  const { state, updateTaskStatus, toggleReminder, currentTimeString } = useDay();

  const activeTask = state.tasks.find((t) => t.id === state.current.focusTaskId || t.status === 'ACTIVE');
  const pendingReminders = state.reminders.filter((r) => !r.isDone);
  const nextMeeting = state.fixedEvents[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="android-notification-overlay" className="fixed inset-0 z-50 flex flex-col justify-start bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="w-full max-w-md mx-auto bg-[#1D2026] text-[#E2E2E6] rounded-b-[36px] shadow-2xl shadow-blue-950/40 p-5 border-b border-[#44474E]/50 space-y-4 max-h-[85vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#44474E]/30">
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-[#E2E2E6]">{currentTimeString}</span>
                <span className="text-xs text-[#C4C6D0] font-mono">• {state.date}</span>
              </div>
              <button
                id="close-notifications-btn"
                onClick={onClose}
                className="p-2 rounded-full bg-[#2E3036] text-[#C4C6D0] hover:text-[#E2E2E6] hover:bg-[#334867] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick System Status Tiles (Sophisticated Dark Control Tiles) */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-[#2E3036] p-3 rounded-2xl border border-[#44474E]/40 flex flex-col items-center justify-center text-center">
                <MapPin className="w-4 h-4 text-[#D1E1FF] mb-1" />
                <span className="text-[10px] text-[#C4C6D0]/70 uppercase font-mono tracking-wider">Location</span>
                <span className="text-xs font-semibold text-[#E2E2E6] truncate w-full">{state.current.location}</span>
              </div>
              <div className="bg-[#2E3036] p-3 rounded-2xl border border-[#44474E]/40 flex flex-col items-center justify-center text-center">
                <Zap className="w-4 h-4 text-[#D1E1FF] mb-1" />
                <span className="text-[10px] text-[#C4C6D0]/70 uppercase font-mono tracking-wider">Energy</span>
                <span className="text-xs font-semibold text-[#E2E2E6]">{state.current.energy}</span>
              </div>
              <div className="bg-[#2E3036] p-3 rounded-2xl border border-[#44474E]/40 flex flex-col items-center justify-center text-center">
                <Calendar className="w-4 h-4 text-[#D1E1FF] mb-1" />
                <span className="text-[10px] text-[#C4C6D0]/70 uppercase font-mono tracking-wider">Anchors</span>
                <span className="text-xs font-semibold text-[#E2E2E6]">{state.fixedEvents.length} Today</span>
              </div>
            </div>

            {/* Notification 1: Active Focus Task */}
            {activeTask ? (
              <div className="bg-gradient-to-br from-[#334867]/90 to-[#1D2026] border border-[#D1E1FF]/30 rounded-[28px] p-4.5 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-xl bg-[#D1E1FF]/20 text-[#D1E1FF]">
                      <Sparkles className="w-4 h-4 text-[#D1E1FF]" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-[#D1E1FF] uppercase tracking-wider">Ongoing Focus</div>
                      <div className="text-sm font-semibold text-[#E2E2E6] line-clamp-1">{activeTask.title}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#111318] text-[#D1E1FF] border border-[#44474E]/50">
                    {activeTask.category}
                  </span>
                </div>

                <div className="text-xs text-[#C4C6D0] flex items-center justify-between">
                  <span>Priority Level: {activeTask.priority}/10</span>
                  <span>Est. {activeTask.estimatedMinutes || 30} mins</span>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <button
                    id="notif-mark-done-btn"
                    onClick={() => {
                      updateTaskStatus(activeTask.id, 'DONE');
                      onClose();
                    }}
                    className="flex-1 py-2 px-3 bg-[#D1E1FF] hover:bg-white text-[#003062] font-bold rounded-2xl text-xs flex items-center justify-center space-x-1.5 transition shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#003062]" />
                    <span>Complete</span>
                  </button>
                  <button
                    id="notif-pause-btn"
                    onClick={() => {
                      updateTaskStatus(activeTask.id, 'NEXT');
                    }}
                    className="py-2 px-3 bg-[#2E3036] hover:bg-[#334867] border border-[#44474E]/40 text-[#E2E2E6] rounded-2xl text-xs font-semibold flex items-center justify-center space-x-1 transition"
                  >
                    <PauseCircle className="w-4 h-4 text-[#C4C6D0]" />
                    <span>Pause</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#2E3036]/60 border border-[#44474E]/30 rounded-2xl p-4 text-center text-xs text-[#C4C6D0]">
                No active focus running right now. Pick an action from the Today Hub.
              </div>
            )}

            {/* Notification 2: Upcoming Anchor Event */}
            {nextMeeting && (
              <div className="bg-[#2E3036] border border-[#44474E]/50 rounded-2xl p-3.5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-[#334867] text-[#D1E1FF]">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#E2E2E6]">{nextMeeting.title}</div>
                    <div className="text-[11px] text-[#D1E1FF] font-mono">Today at {nextMeeting.time} • {nextMeeting.location || 'Online'}</div>
                  </div>
                </div>
                <span className="text-[10px] bg-[#111318] text-[#C4C6D0] border border-[#44474E]/40 px-2.5 py-1 rounded-full font-mono">Anchor</span>
              </div>
            )}

            {/* Notification 3: Reminders */}
            {pendingReminders.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#C4C6D0] uppercase tracking-wider px-1">
                  Active Reminders ({pendingReminders.length})
                </div>
                {pendingReminders.map((rem) => (
                  <div key={rem.id} className="bg-[#2E3036] border border-[#44474E]/40 rounded-2xl p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <Bell className="w-3.5 h-3.5 text-[#D1E1FF] shrink-0" />
                      <div>
                        <div className="text-xs text-[#E2E2E6]">{rem.message}</div>
                        <div className="text-[10px] text-[#D1E1FF]/80 font-mono">{rem.triggerCondition} ({rem.type.replace('_', ' ')})</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleReminder(rem.id)}
                      className="p-1.5 text-[#C4C6D0] hover:text-[#D1E1FF] hover:bg-[#334867] rounded-xl transition"
                      title="Mark reminder done"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Handle */}
            <div className="pt-2 flex justify-center">
              <div className="w-12 h-1 bg-[#44474E] rounded-full opacity-60" />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

