import React, { useState } from 'react';
import { Sparkles, X, Check, Gamepad2, BellOff, Send, Clock, Play, Zap } from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { motion, AnimatePresence } from 'motion/react';

interface PeriodicPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PeriodicPromptModal: React.FC<PeriodicPromptModalProps> = ({ isOpen, onClose }) => {
  const { state, processUserInput, isProcessing, updateUserSettings, snoozePrompts, currentTimeString, recordPeriodicPromptCompletion } = useDay();
  const [logText, setLogText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentTask = state.tasks.find(t => t.id === state.current.focusTaskId || t.status === 'ACTIVE') ||
    state.tasks.find(t => t.status === 'NEXT');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!logText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await processUserInput(logText.trim());
      recordPeriodicPromptCompletion();
      setLogText('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLog = async (text: string) => {
    setIsSubmitting(true);
    try {
      await processUserInput(text);
      recordPeriodicPromptCompletion();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        id="periodic-accountability-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="bg-[#1D2026] text-[#E2E2E6] border border-[#D1E1FF]/40 rounded-[36px] p-6 shadow-2xl max-w-md w-full space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#44474E]/30">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#334867] text-[#D1E1FF] flex items-center justify-center font-bold text-sm shadow-md border border-[#D1E1FF]/30">
                <Sparkles className="w-5 h-5 text-[#D1E1FF]" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#E2E2E6]">{state.userSettings?.periodicPromptIntervalMinutes || 30}-Min Accountability Check</h3>
                <span className="text-[11px] text-[#C4C6D0]/70 font-mono">{currentTimeString} • Activity Pulse</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-[#2E3036] text-[#C4C6D0] hover:text-[#E2E2E6] hover:bg-[#334867] transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Prompt Message */}
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-[#E2E2E6] leading-snug">
              What task are you working on right now?
            </p>
            <p className="text-xs text-[#C4C6D0]/70 leading-relaxed">
              Log your current activity to maintain an accurate timeline. This prompt recurs every {state.userSettings?.periodicPromptIntervalMinutes || 30} minutes until sleep time.
            </p>
          </div>

          {/* Quick Context / Ongoing Task suggestion */}
          {currentTask && (
            <div className="p-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-[#D1E1FF] font-bold uppercase tracking-wider block">Targeted Task</span>
                <span className="text-xs font-semibold text-[#E2E2E6] truncate block">{currentTask.title}</span>
              </div>
              <button
                type="button"
                onClick={() => handleQuickLog(`Working on: ${currentTask.title}`)}
                className="py-1.5 px-3 bg-[#334867] hover:bg-[#D1E1FF] hover:text-[#003062] text-[#D1E1FF] font-semibold text-xs rounded-xl transition flex items-center space-x-1 shrink-0"
              >
                <span>Still On It</span>
              </button>
            </div>
          )}

          {/* Quick Chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickLog('Focused deep work at desk')}
              className="py-1 px-2.5 rounded-full bg-[#2E3036] hover:bg-[#334867] text-[11px] text-[#C4C6D0] hover:text-[#E2E2E6] transition border border-[#44474E]/30"
            >
              💻 Deep Work
            </button>
            <button
              type="button"
              onClick={() => handleQuickLog('Short break / tea')}
              className="py-1 px-2.5 rounded-full bg-[#2E3036] hover:bg-[#334867] text-[11px] text-[#C4C6D0] hover:text-[#E2E2E6] transition border border-[#44474E]/30"
            >
              ☕ Short Break
            </button>
            <button
              type="button"
              onClick={() => handleQuickLog('In team discussion / call')}
              className="py-1 px-2.5 rounded-full bg-[#2E3036] hover:bg-[#334867] text-[11px] text-[#C4C6D0] hover:text-[#E2E2E6] transition border border-[#44474E]/30"
            >
              📞 Call / Meeting
            </button>
            <button
              type="button"
              onClick={() => handleQuickLog('Handled unplanned urgent task')}
              className="py-1 px-2.5 rounded-full bg-[#2E3036] hover:bg-[#334867] text-[11px] text-[#C4C6D0] hover:text-[#E2E2E6] transition border border-[#44474E]/30"
            >
              ⚡ Urgent Interruption
            </button>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={logText}
                onChange={(e) => setLogText(e.target.value)}
                placeholder="e.g., Drafting Q3 report, reviewing emails..."
                autoFocus
                disabled={isSubmitting || isProcessing}
                className="w-full py-3 pl-3.5 pr-11 rounded-2xl bg-[#111318] border border-[#44474E]/50 text-xs text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!logText.trim() || isSubmitting || isProcessing}
                className={`absolute right-1.5 top-1.5 p-2 rounded-xl transition ${
                  logText.trim() && !isSubmitting && !isProcessing
                    ? 'bg-[#D1E1FF] text-[#003062] shadow-sm'
                    : 'bg-[#2E3036] text-[#C4C6D0]/40 cursor-not-allowed'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Snooze & Override Controls */}
          <div className="pt-2 border-t border-[#44474E]/30 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => {
                  snoozePrompts(60);
                  onClose();
                }}
                className="py-1.5 px-2.5 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[#C4C6D0] hover:text-[#E2E2E6] transition flex items-center space-x-1 text-[11px]"
                title="Pause prompts for 1 hour"
              >
                <Clock className="w-3.5 h-3.5 text-[#FDE047]" />
                <span>Snooze 1 hr</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  updateUserSettings({ gamingModeActive: true });
                  onClose();
                }}
                className="py-1.5 px-2.5 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[#C4C6D0] hover:text-[#E2E2E6] transition flex items-center space-x-1 text-[11px]"
                title="Activate Gaming Mode to stop all prompts"
              >
                <Gamepad2 className="w-3.5 h-3.5 text-[#D1E1FF]" />
                <span>Gaming Mode</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                updateUserSettings({ periodicPromptEnabled: false });
                onClose();
              }}
              className="text-[11px] text-[#C4C6D0]/60 hover:text-[#F87171] hover:underline"
            >
              Turn off
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
