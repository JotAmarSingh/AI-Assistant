import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Compass, 
  CalendarClock, 
  Layers, 
  History, 
  Bell, 
  FileCheck, 
  FileJson,
  ExternalLink 
} from 'lucide-react';
import { AndroidTab } from './AndroidNavigationBar';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: AndroidTab) => void;
}

interface TutorialStep {
  title: string;
  subtitle: string;
  tab: AndroidTab;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  highlights: string[];
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose, onNavigateTab }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (!isOpen) return null;

  const steps: TutorialStep[] = [
    {
      title: '1. Today Hub',
      subtitle: 'Natural Logging & Focus Engine',
      tab: 'hub',
      icon: Compass,
      description: 'Your central command center. Type or voice messy natural language updates (e.g. "Reached office at 9:10, submitted workflow"). DayTrace automatically parses events, moves tasks, and computes your single Next Best Action.',
      highlights: [
        'Single Next Best Action based on priority and time windows',
        'Auto-learned quick chips that get smarter the more you log',
        'Direct voice dictation powered by native speech recognition',
      ],
    },
    {
      title: '2. Timetable Routines',
      subtitle: 'Habits & Time-Block Architecture',
      tab: 'timetable',
      icon: CalendarClock,
      description: 'Structure your day around high-leverage habits (Gym, Meals, Focus Blocks, Content, Night Wind-down). Track routine completion and apply customized productivity presets.',
      highlights: [
        'One-tap routine status toggles (Completed, Active, Skipped)',
        'Built-in presets: Balanced, Fitness & Creator, Deep Work',
        'Sync habits directly into your actionable daily task list',
      ],
    },
    {
      title: '3. Task Decision Board',
      subtitle: 'Eisenhower & Dependency Matrix',
      tab: 'board',
      icon: Layers,
      description: 'Manage tasks across dynamic status columns (Next, Active, Waiting, Blocked, Captured, Done). When a blocker task completes, DayTrace automatically unlocks dependent tasks.',
      highlights: [
        'Do, Delegate, Delay, Drop prioritization',
        'Smart delegation tracking (Waiting for IT, Boss, Client)',
        'Automatic dependency unblocking cascade',
      ],
    },
    {
      title: '4. Daily Timeline',
      subtitle: 'Chronological Audit Trail',
      tab: 'timeline',
      icon: History,
      description: 'A continuous, objective audit log of your day. Captures planned vs actual departure times, task completion timestamps, and interruption classifications (Avoidable vs Unavoidable).',
      highlights: [
        'Departure variance tracking (e.g. 10m traffic delay)',
        'Visual timeline with category badges and location tags',
        'Zero emotional judgment—pure objective day audit',
      ],
    },
    {
      title: '5. Anchors & Context Reminders',
      subtitle: 'Fixed Events & Smart Alarms',
      tab: 'reminders',
      icon: Bell,
      description: 'Set fixed meetings and appointments that act as structural planning anchors. Schedule time-based exact alarms, proximity-based location reminders, and event-triggered alerts.',
      highlights: [
        'Fixed anchors structure deep work windows',
        'Exact Android AlarmManager scheduling for deep sleep',
        'Continuous geofencing & event trigger automation',
      ],
    },
    {
      title: '6. End-of-Day Review',
      subtitle: 'Reflect & Plan Tomorrow',
      tab: 'review',
      icon: FileCheck,
      description: 'Close your mental loop each evening with an AI-generated objective review. Analyze planned vs actual routine variance, detect recurring productivity patterns, and carry forward pending tasks.',
      highlights: [
        'Planned vs actual schedule breakdown',
        'Recurring friction pattern identification',
        'Tomorrow blueprint generation & win celebration',
      ],
    },
    {
      title: '7. Backup & Restore',
      subtitle: 'Private JSON files',
      tab: 'hub',
      icon: FileJson,
      description: 'Your data belongs to you. Export your complete DayTrace state to a local JSON backup file and restore it whenever needed.',
      highlights: [
        'One-tap JSON backup saved to Downloads',
        '100% persistent local storage on your device',
        'Full JSON restore capability across devices',
      ],
    },
  ];

  const currentStep = steps[currentStepIndex];
  const StepIcon = currentStep.icon;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleJumpToTab = () => {
    onNavigateTab?.(currentStep.tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <div 
        className="bg-[#1D2026] text-[#E2E2E6] border border-[#44474E]/60 rounded-[32px] p-6 shadow-2xl max-w-md w-full space-y-5 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#44474E]/30">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#334867] flex items-center justify-center text-[#D1E1FF] shadow-inner">
              <StepIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#E2E2E6]">{currentStep.title}</h3>
              <p className="text-[11px] text-[#C4C6D0]">{currentStep.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-[#C4C6D0] hover:text-[#E2E2E6] hover:bg-[#2E3036] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Indicators */}
        <div className="grid grid-cols-7 gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStepIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStepIndex
                  ? 'bg-[#D1E1FF] w-full'
                  : i < currentStepIndex
                  ? 'bg-[#334867]'
                  : 'bg-[#44474E]/40'
              }`}
            />
          ))}
        </div>

        {/* Step Body */}
        <div className="space-y-4 overflow-y-auto flex-1 pr-1 text-xs text-[#C4C6D0] leading-relaxed">
          <p className="text-[#E2E2E6] text-xs leading-relaxed bg-[#2E3036]/50 p-3.5 rounded-2xl border border-[#44474E]/30">
            {currentStep.description}
          </p>

          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-[#D1E1FF] uppercase tracking-wider">Key Capabilities:</h4>
            <div className="space-y-1.5">
              {currentStep.highlights.map((highlight, idx) => (
                <div key={idx} className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#D1E1FF] mt-1.5 shrink-0" />
                  <span className="text-[#E2E2E6] text-xs">{highlight}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleJumpToTab}
            className="w-full py-2 px-3 rounded-xl bg-[#2E3036] hover:bg-[#334867] text-[#D1E1FF] text-xs font-semibold flex items-center justify-center space-x-1.5 transition border border-[#44474E]/40"
          >
            <span>Open {currentStep.title.split('. ')[1]} Tab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-3 border-t border-[#44474E]/30">
          <button
            onClick={handlePrevious}
            disabled={currentStepIndex === 0}
            className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center space-x-1 transition ${
              currentStepIndex === 0
                ? 'opacity-30 cursor-not-allowed text-[#C4C6D0]'
                : 'text-[#E2E2E6] hover:bg-[#2E3036]'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <span className="text-[11px] font-mono text-[#C4C6D0]/60">
            {currentStepIndex + 1} of {steps.length}
          </span>

          <button
            onClick={handleNext}
            className="px-4 py-2 rounded-2xl bg-[#D1E1FF] hover:bg-white text-[#003062] text-xs font-bold flex items-center space-x-1 transition shadow-md"
          >
            <span>{currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
