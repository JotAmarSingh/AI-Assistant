import React, { useState } from 'react';
import { Sparkles, X, Check, Gamepad2, BellOff, Send, Clock, Play, Zap } from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { motion, AnimatePresence } from 'motion/react';
import { TaskUsageStat } from '../../utils/autoLearning';

interface PeriodicPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PeriodicPromptModal: React.FC<PeriodicPromptModalProps> = ({ isOpen, onClose }) => {
  const {
    state,
    processUserInput,
    isProcessing,
    updateUserSettings,
    snoozePrompts,
    currentTimeString,
    recordPeriodicPromptCompletion,
    learningProfile,
    startAccountabilityTask,
  } = useDay();
  const [logText, setLogText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomDelay, setShowCustomDelay] = useState(false);
  const [delayHours, setDelayHours] = useState(1);
  const [delayMinutes, setDelayMinutes] = useState(30);

  if (!isOpen) return null;

  const suggestions: Array<{ id?: string; title: string; category?: string; learned?: boolean }> = [];
  const seen = new Set<string>();
  const addSuggestion = (candidate?: { id?: string; title: string; category?: string; learned?: boolean }) => {
    if (!candidate?.title || suggestions.length >= 4) return;
    const key = candidate.id || candidate.title.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push(candidate);
  };

  addSuggestion(state.tasks.find((task) => task.id === state.current.focusTaskId));
  state.tasks.filter((task) => task.status === 'ACTIVE').forEach(addSuggestion);
  (Object.values(learningProfile.taskUsage) as TaskUsageStat[])
    .sort((a, b) => b.totalInteractions - a.totalInteractions)
    .forEach((stat) => addSuggestion({
      id: stat.taskId,
      title: stat.title,
      category: stat.category,
      learned: true,
    }));
  state.tasks
    .filter((task) => task.status === 'NEXT')
    .sort((a, b) => b.priority - a.priority)
    .forEach(addSuggestion);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!logText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      startAccountabilityTask({ title: logText.trim() });
      setLogText('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTaskSuggestion = (task: { id?: string; title: string; category?: string }) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      startAccountabilityTask(task);
      onClose();
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

          {/* Stable learned/current task buttons. These bypass the AI parser. */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] text-[#D1E1FF] font-bold uppercase tracking-wider">Suggested Tasks</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestions.map((task) => (
                  <button
                    key={task.id || task.title}
                    type="button"
                    onClick={() => handleTaskSuggestion(task)}
                    disabled={isSubmitting}
                    className="p-2.5 rounded-2xl bg-[#111318] border border-[#44474E]/40 hover:border-[#D1E1FF]/50 text-left transition min-w-0"
                  >
                    <span className="text-xs font-semibold text-[#E2E2E6] truncate block">{task.title}</span>
                    <span className="text-[9px] text-[#C4C6D0]">{task.learned ? 'Learned task' : 'Current task'} • tap to start</span>
                  </button>
                ))}
              </div>
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
                placeholder="Add a new task and start it..."
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

          {/* Snooze & Delay Controls */}
          <div className="pt-2.5 border-t border-[#44474E]/30 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#D1E1FF] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#FDE047]" />
                Delay Pending Task Reminder
              </span>
              <button
                type="button"
                onClick={() => setShowCustomDelay(!showCustomDelay)}
                className="text-[11px] text-[#D1E1FF] hover:underline font-semibold"
              >
                {showCustomDelay ? 'Hide Picker' : 'Choose Hours & Mins'}
              </button>
            </div>

            {showCustomDelay ? (
              <div className="p-2.5 rounded-2xl bg-[#111318] border border-[#44474E]/50 space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold text-[#C4C6D0] uppercase mb-0.5">Hours</label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={delayHours}
                      onChange={(e) => setDelayHours(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full py-1.5 px-2.5 rounded-xl bg-[#1D2026] border border-[#44474E]/40 text-xs font-mono font-bold text-[#E2E2E6] focus:ring-1 focus:ring-[#D1E1FF] focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold text-[#C4C6D0] uppercase mb-0.5">Minutes</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={delayMinutes}
                      onChange={(e) => setDelayMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      className="w-full py-1.5 px-2.5 rounded-xl bg-[#1D2026] border border-[#44474E]/40 text-xs font-mono font-bold text-[#E2E2E6] focus:ring-1 focus:ring-[#D1E1FF] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const totalMins = (delayHours * 60) + delayMinutes;
                      if (totalMins > 0) {
                        snoozePrompts(totalMins);
                        onClose();
                      }
                    }}
                    disabled={(delayHours * 60 + delayMinutes) <= 0}
                    className="mt-4 py-1.5 px-3 rounded-xl bg-[#D1E1FF] text-[#003062] text-xs font-bold hover:bg-[#B3C8FF] transition disabled:opacity-40"
                  >
                    Confirm Delay
                  </button>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {[
                    { label: '30m', h: 0, m: 30 },
                    { label: '1 hr', h: 1, m: 0 },
                    { label: '1.5 hrs', h: 1, m: 30 },
                    { label: '2 hrs', h: 2, m: 0 },
                    { label: '4 hrs', h: 4, m: 0 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setDelayHours(preset.h);
                        setDelayMinutes(preset.m);
                      }}
                      className="py-1 px-2 rounded-lg bg-[#2E3036] hover:bg-[#334867] text-[10px] text-[#C4C6D0] font-semibold transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      snoozePrompts(30);
                      onClose();
                    }}
                    className="py-1.5 px-2.5 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[#C4C6D0] hover:text-[#E2E2E6] transition flex items-center space-x-1 text-[11px]"
                  >
                    <span>Delay 30m</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      snoozePrompts(60);
                      onClose();
                    }}
                    className="py-1.5 px-2.5 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[#C4C6D0] hover:text-[#E2E2E6] transition flex items-center space-x-1 text-[11px]"
                  >
                    <span>Delay 1 hr</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateUserSettings({ gamingModeActive: true });
                      onClose();
                    }}
                    className="py-1.5 px-2.5 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[#C4C6D0] hover:text-[#E2E2E6] transition flex items-center space-x-1 text-[11px]"
                    title="Activate Gaming Mode to stop prompts"
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
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
