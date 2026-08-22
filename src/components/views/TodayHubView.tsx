import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Mic, 
  MicOff, 
  Send, 
  Play, 
  CheckCircle2, 
  PauseCircle, 
  Clock, 
  Check, 
  CornerDownRight, 
  AlertCircle,
  BrainCircuit,
  TrendingUp,
  RotateCcw,
  Zap,
  Info,
  X,
  ChevronRight,
  CalendarClock,
  Dumbbell,
  Utensils,
  Share2,
  Briefcase,
  ArrowRight,
  Flame,
  Gift,
  MapPin,
  Timer
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { computeAutoLearnedQuickUpdates, LearnedQuickOption, TaskUsageStat } from '../../utils/autoLearning';
import { speechService } from '../../services/speechRecognition';
import { taskIsForTodayHub } from '../../utils/dailyHistory';

interface TodayHubViewProps {
  onNavigateToTimetable?: () => void;
}

export const TodayHubView: React.FC<TodayHubViewProps> = ({ onNavigateToTimetable }) => {
  const { 
    state, 
    processUserInput, 
    isProcessing, 
    updateTaskStatus,
    learningProfile,
    recordCustomRoutine,
    resetLearnedShortcuts,
    toggleSlotStatus,
    notificationToast,
    dismissToast,
    setIsFocusModalOpen,
    setIsVoiceModalOpen,
    setIsRewardsModalOpen,
    setIsGeofenceModalOpen,
    startFocusTimer,
    focusTimer
  } = useDay();

  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'MOST_USED' | 'ROUTINE' | 'DELEGATION'>('ALL');
  const [showLearningModal, setShowLearningModal] = useState(false);
  const [showResetLearningConfirm, setShowResetLearningConfirm] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat history to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.conversationHistory, isProcessing]);

  // Temporary feedback toast timer
  useEffect(() => {
    if (feedbackToast) {
      const timer = setTimeout(() => setFeedbackToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [feedbackToast]);

  // Speech Recognition support check
  useEffect(() => {
    setSpeechSupported(speechService.isSupported());
  }, []);

  const toggleVoiceRecording = async () => {
    if (isRecording) {
      speechService.stopListening();
      setIsRecording(false);
    } else {
      setInputText('');
      const started = await speechService.startListening(
        (interim) => {
          setInputText(interim);
        },
        (finalText) => {
          setInputText(finalText);
          setIsRecording(false);
        },
        (err) => {
          setFeedbackToast(`Mic: ${err}`);
          setIsRecording(false);
        }
      );
      if (started) {
        setIsRecording(true);
      }
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText;
    if (!textToSend.trim() || isProcessing) return;

    setInputText('');
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    await processUserInput(textToSend);
  };

  const todayTasks = state.tasks.filter((task) => taskIsForTodayHub(task, state.date, state.date));
  const todayState = { ...state, tasks: todayTasks };

  // Compute dynamically learned quick updates only against the selected day.
  const allLearnedUpdates = computeAutoLearnedQuickUpdates(todayState, learningProfile);
  
  const filteredLearnedUpdates = allLearnedUpdates.filter((opt) => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'MOST_USED') return opt.category === 'MOST_USED' || opt.category === 'CURRENT_FLOW';
    if (selectedFilter === 'ROUTINE') return opt.category === 'ROUTINE';
    if (selectedFilter === 'DELEGATION') return opt.category === 'DELEGATION';
    return true;
  });

  const handleQuickOptionClick = (option: LearnedQuickOption) => {
    recordCustomRoutine(option.id, option.label, option.prompt);
    setFeedbackToast(`Learned habit reinforced (${(option.frequency || 0) + 1}x)`);
    setInputText(option.prompt);
  };

  const handleInstantSendOption = async (option: LearnedQuickOption) => {
    recordCustomRoutine(option.id, option.label, option.prompt);
    setFeedbackToast(`Executed & recorded: ${option.label}`);
    await handleSendMessage(option.prompt);
  };

  // Active focus task and Next Best Action computation
  const activeTask = todayTasks.find((t) => t.id === state.current.focusTaskId || t.status === 'ACTIVE');
  const nextAction = state.nextBestAction?.taskId
    && !todayTasks.some((task) => task.id === state.nextBestAction?.taskId)
    ? null
    : state.nextBestAction;
  const nextTargetTask = nextAction?.taskId
    ? todayTasks.find((t) => t.id === nextAction.taskId)
    : todayTasks.find((t) => t.status === 'NEXT');

  // Next fixed event calculation
  const nextFixedEvent = state.fixedEvents[0];

  // Top learned tasks ranked
  const sortedTaskStats: TaskUsageStat[] = (Object.values(learningProfile.taskUsage) as TaskUsageStat[]).sort(
    (a, b) => b.totalInteractions - a.totalInteractions
  );

  return (
    <div id="today-hub-view" className="flex-1 flex flex-col h-full overflow-hidden bg-[#111318] text-[#E2E2E6] relative">
      {/* Learned Feedback Toast */}
      {feedbackToast && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-[#334867] text-[#D1E1FF] text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg border border-[#D1E1FF]/30 flex items-center space-x-1.5 animate-bounce">
          <BrainCircuit className="w-3.5 h-3.5 text-[#D1E1FF]" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Scrollable Main Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Real-time Notification Toast for Location & Event Triggers */}
        {notificationToast && (
          <div className="bg-[#334867] border border-[#D1E1FF]/40 p-3 rounded-2xl flex items-center justify-between shadow-lg animate-pulse">
            <span className="text-xs font-semibold text-[#D1E1FF]">{notificationToast}</span>
            <button 
              onClick={dismissToast} 
              className="text-[#D1E1FF] hover:text-white text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[#2E3036] transition ml-2 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Next Best Action Card / Ongoing Focus */}
        <section id="next-best-action-card" className="bg-gradient-to-br from-[#334867] via-[#1D2026] to-[#1A1C1E] text-[#E2E2E6] rounded-[32px] p-5 shadow-2xl shadow-blue-950/30 border border-[#D1E1FF]/20 relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#D1E1FF]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-2 relative z-10">
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D1E1FF] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D1E1FF]"></span>
              </span>
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#D1E1FF]">
                {activeTask ? 'Active Focus' : 'Next Best Action'}
              </span>
            </div>
            {nextTargetTask && (
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#111318]/80 text-[#D1E1FF] border border-[#44474E]/40">
                {nextTargetTask.category}
              </span>
            )}
          </div>

          {/* Primary Action Title */}
          <h2 className="text-base sm:text-lg font-bold text-[#E2E2E6] tracking-tight leading-snug mb-1 relative z-10">
            {activeTask?.title || nextAction?.title || nextTargetTask?.title || 'All high priorities completed!'}
          </h2>

          {/* Rationale & Decision Rationale */}
          <p className="text-xs text-[#C4C6D0] leading-relaxed mb-3.5 relative z-10">
            {nextAction?.rationale || 'Prioritized based on available time window, energy, and commitment proximity.'}
          </p>

          {/* Quick Action Buttons */}
          <div className="flex items-center space-x-2 relative z-10">
            {activeTask ? (
              <>
                <button
                  id="hub-complete-focus-btn"
                  onClick={() => updateTaskStatus(activeTask.id, 'DONE')}
                  className="flex-1 py-2.5 px-3 bg-[#D1E1FF] hover:bg-white text-[#003062] font-bold rounded-2xl text-xs flex items-center justify-center space-x-1.5 transition shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#003062]" />
                  <span>Mark Done</span>
                </button>
                <button
                  id="hub-pause-focus-btn"
                  onClick={() => updateTaskStatus(activeTask.id, 'NEXT')}
                  className="py-2.5 px-3 bg-[#2E3036] hover:bg-[#334867] border border-[#44474E]/40 text-[#E2E2E6] font-semibold rounded-2xl text-xs flex items-center justify-center space-x-1 transition"
                >
                  <PauseCircle className="w-4 h-4 text-[#C4C6D0]" />
                  <span>Pause</span>
                </button>
                <button
                  onClick={() => {
                    startFocusTimer('POMODORO_25', activeTask.id, activeTask.title);
                    setIsFocusModalOpen(true);
                  }}
                  className="py-2.5 px-3 bg-[#003062] hover:bg-[#334867] border border-[#D1E1FF]/40 text-[#D1E1FF] font-semibold rounded-2xl text-xs flex items-center justify-center space-x-1.5 transition"
                  title="Launch Pomodoro Timer"
                >
                  <Timer className="w-4 h-4 text-[#D1E1FF]" />
                  <span>Pomodoro</span>
                </button>
              </>
            ) : nextTargetTask ? (
              <>
                <button
                  id="hub-start-focus-btn"
                  onClick={() => updateTaskStatus(nextTargetTask.id, 'ACTIVE')}
                  className="flex-1 py-2.5 px-4 bg-[#D1E1FF] hover:bg-white text-[#003062] font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 transition shadow-lg"
                >
                  <Play className="w-4 h-4 fill-[#003062]" />
                  <span>Start Focus ({nextTargetTask.estimatedMinutes || 30}m)</span>
                </button>
                <button
                  onClick={() => {
                    startFocusTimer('POMODORO_25', nextTargetTask.id, nextTargetTask.title);
                    setIsFocusModalOpen(true);
                  }}
                  className="py-2.5 px-3 bg-[#2E3036] hover:bg-[#334867] border border-[#D1E1FF]/40 text-[#D1E1FF] font-semibold rounded-2xl text-xs flex items-center justify-center space-x-1.5 transition"
                  title="Launch 25m Pomodoro"
                >
                  <Timer className="w-4 h-4 text-[#D1E1FF]" />
                  <span>25m</span>
                </button>
              </>
            ) : null}
          </div>

          {/* Secondary Recommendations */}
          {nextAction?.secondaryRecommendations && nextAction.secondaryRecommendations.length > 0 && (
            <div className="mt-3.5 pt-2.5 border-t border-[#44474E]/40 text-[11px] text-[#C4C6D0] space-y-1">
              <span className="font-semibold text-[#D1E1FF]">Secondary Available Actions:</span>
              {nextAction.secondaryRecommendations.slice(0, 2).map((sec, idx) => (
                <div key={idx} className="flex items-center space-x-1.5 truncate">
                  <span className="text-[#D1E1FF]">•</span>
                  <span className="truncate">{sec}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4 Super-Feature Quick Access Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Pomodoro */}
          <button
            onClick={() => setIsFocusModalOpen(true)}
            className="bg-[#1D2026] hover:bg-[#2E3036] border border-[#44474E]/40 p-3 rounded-2xl flex flex-col items-start transition text-left group"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <div className="p-1.5 rounded-xl bg-[#334867] text-[#D1E1FF] group-hover:scale-110 transition">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono text-[#D1E1FF]">25m / 50m</span>
            </div>
            <span className="text-xs font-bold text-[#E2E2E6]">Deep Focus</span>
            <span className="text-[10px] text-[#C4C6D0]/70">Pomodoro & Stopwatch</span>
          </button>

          {/* Voice Memo */}
          <button
            onClick={() => setIsVoiceModalOpen(true)}
            className="bg-[#1D2026] hover:bg-[#2E3036] border border-[#44474E]/40 p-3 rounded-2xl flex flex-col items-start transition text-left group"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <div className="p-1.5 rounded-xl bg-[#334867] text-[#D1E1FF] group-hover:scale-110 transition">
                <Mic className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono text-[#86EFAC]">Hands-free</span>
            </div>
            <span className="text-xs font-bold text-[#E2E2E6]">Voice Capture</span>
            <span className="text-[10px] text-[#C4C6D0]/70">Speech to action</span>
          </button>

          {/* Rewards & Streak */}
          <button
            onClick={() => setIsRewardsModalOpen(true)}
            className="bg-[#1D2026] hover:bg-[#2E3036] border border-[#FBBF24]/30 p-3 rounded-2xl flex flex-col items-start transition text-left group"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <div className="p-1.5 rounded-xl bg-[#FBBF24]/20 text-[#FBBF24] group-hover:scale-110 transition">
                <Flame className="w-4 h-4 fill-current text-[#F87171]" />
              </div>
              <span className="text-[10px] font-bold font-mono text-[#FBBF24]">🪙 {state.gamification?.points || 120}</span>
            </div>
            <span className="text-xs font-bold text-[#E2E2E6]">Streak & Vault</span>
            <span className="text-[10px] text-[#C4C6D0]/70">Candies, iPhone</span>
          </button>

          {/* Geofence Automation */}
          <button
            onClick={() => setIsGeofenceModalOpen(true)}
            className="bg-[#1D2026] hover:bg-[#2E3036] border border-[#44474E]/40 p-3 rounded-2xl flex flex-col items-start transition text-left group"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <div className="p-1.5 rounded-xl bg-[#334867] text-[#D1E1FF] group-hover:scale-110 transition">
                <MapPin className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono text-[#D1E1FF]">{state.current.location}</span>
            </div>
            <span className="text-xs font-bold text-[#E2E2E6]">Smart Geofence</span>
            <span className="text-[10px] text-[#C4C6D0]/70">Arrival routines</span>
          </button>
        </section>

        {/* Real-Time Planning Context (Anchors & Available Window) */}
        {nextFixedEvent && (
          <div className="bg-[#1D2026] border border-[#44474E]/40 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-[#334867] text-[#D1E1FF]">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#E2E2E6]">{nextFixedEvent.title}</div>
                <div className="text-[11px] text-[#C4C6D0]">
                  Starts at <span className="font-semibold text-[#D1E1FF]">{nextFixedEvent.time}</span> • {nextFixedEvent.location || 'Office'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 bg-[#2E3036] rounded-full text-[#D1E1FF] border border-[#44474E]/40 font-semibold">
              Anchor
            </span>
          </div>
        )}

        {/* Daily Regular Routine & Timetable Section */}
        <section id="hub-timetable-widget" className="space-y-2 pt-1 border-t border-[#44474E]/30">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-1.5">
              <CalendarClock className="w-4 h-4 text-[#D1E1FF]" />
              <span className="text-xs font-bold text-[#E2E2E6]">Regular Daily Timetable</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-md bg-[#2E3036] text-[#D1E1FF] font-semibold">
                {(state.timetable || []).filter((s) => s.status === 'COMPLETED').length}/{(state.timetable || []).length}
              </span>
            </div>

            {onNavigateToTimetable && (
              <button
                onClick={onNavigateToTimetable}
                className="text-[11px] text-[#D1E1FF] hover:underline flex items-center space-x-1 font-semibold"
              >
                <span>Full Schedule</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Routine Chips Carousel */}
          <div className="flex space-x-2.5 overflow-x-auto pb-1.5 scrollbar-none">
            {(state.timetable || []).map((slot) => {
              const isDone = slot.status === 'COMPLETED';
              const isActive = slot.status === 'ACTIVE';

              return (
                <div
                  key={slot.id}
                  className={`flex flex-col justify-between p-2.5 rounded-2xl border transition-all shrink-0 min-w-[140px] max-w-[170px] ${
                    isActive
                      ? 'bg-[#1D2026] border-[#D1E1FF]/50 shadow-md'
                      : isDone
                      ? 'bg-[#1D2026]/50 border-[#44474E]/20 opacity-80'
                      : 'bg-[#1D2026] border-[#44474E]/40 hover:border-[#44474E]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono font-bold text-[#D1E1FF]">
                        {slot.startTime}
                      </span>
                      <button
                        onClick={() =>
                          toggleSlotStatus(
                            slot.id,
                            isDone ? 'PENDING' : 'COMPLETED'
                          )
                        }
                        className={`p-1 rounded-lg transition ${
                          isDone
                            ? 'bg-[#334867] text-[#D1E1FF]'
                            : 'bg-[#2E3036] text-[#C4C6D0] hover:text-[#D1E1FF]'
                        }`}
                        title={isDone ? 'Mark Incomplete' : 'Mark Completed'}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#D1E1FF]" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-[#C4C6D0]" />
                        )}
                      </button>
                    </div>

                    <h4
                      className={`text-xs font-bold truncate leading-tight ${
                        isDone ? 'line-through text-[#C4C6D0]/60' : 'text-[#E2E2E6]'
                      }`}
                    >
                      {slot.title}
                    </h4>

                    {slot.targetMetric && (
                      <p className="text-[9px] text-[#C4C6D0]/80 truncate mt-0.5">
                        {slot.targetMetric}
                      </p>
                    )}
                  </div>

                  <div className="mt-2 pt-1 border-t border-[#44474E]/20 flex items-center justify-between text-[9px] text-[#C4C6D0]/60">
                    <span>{slot.durationMinutes}m</span>
                    <span className="font-mono">{slot.days}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Conversation / Decision Stream */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#C4C6D0]/70">AI Day-Tracker Log</h3>
            <span className="text-[10px] text-[#C4C6D0]/60 font-mono">Natural Language State Machine</span>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {state.conversationHistory.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl text-xs transition ${
                  item.sender === 'user'
                    ? 'bg-[#2E3036] text-[#E2E2E6] ml-6 rounded-tr-xs border border-[#44474E]/30'
                    : 'bg-[#1D2026] border border-[#44474E]/40 text-[#E2E2E6] mr-4 rounded-tl-xs shadow-md'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-[#C4C6D0]/70 mb-1 font-mono">
                  <span className="font-semibold">{item.sender === 'user' ? 'You' : 'DayTrace AI'}</span>
                  <span>{item.timestamp}</span>
                </div>

                <p className="leading-relaxed text-[#E2E2E6]">{item.text}</p>

                {/* Structured Changes Summary Pill */}
                {item.changesSummary && (
                  <div className="mt-2.5 pt-2 border-t border-[#44474E]/30 grid grid-cols-1 gap-1 text-[10px]">
                    {item.changesSummary.tasksDone && item.changesSummary.tasksDone.length > 0 && (
                      <div className="flex items-center space-x-1.5 text-[#D1E1FF] font-medium">
                        <Check className="w-3 h-3 shrink-0 text-[#D1E1FF]" />
                        <span>Completed: {item.changesSummary.tasksDone.join(', ')}</span>
                      </div>
                    )}
                    {item.changesSummary.tasksWaiting && item.changesSummary.tasksWaiting.length > 0 && (
                      <div className="flex items-center space-x-1.5 text-[#FDE047]">
                        <CornerDownRight className="w-3 h-3 shrink-0" />
                        <span>Waiting: {item.changesSummary.tasksWaiting.join(', ')}</span>
                      </div>
                    )}
                    {item.changesSummary.tasksBlocked && item.changesSummary.tasksBlocked.length > 0 && (
                      <div className="flex items-center space-x-1.5 text-[#F87171]">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>Blocked: {item.changesSummary.tasksBlocked.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isProcessing && (
              <div className="bg-[#1D2026] border border-[#44474E]/40 p-3.5 rounded-2xl mr-6 text-xs text-[#C4C6D0] flex items-center space-x-2 animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-[#D1E1FF] animate-spin" />
                <span>Extracting facts, timeline, dependencies & recalculating priorities...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </section>

        {/* Auto-Learned Quick Updates Section */}
        <section id="auto-learned-updates-section" className="space-y-2 pt-1 border-t border-[#44474E]/30">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-1.5">
              <BrainCircuit className="w-3.5 h-3.5 text-[#D1E1FF]" />
              <span className="text-[11px] font-bold text-[#E2E2E6]">Auto-Learned Quick Updates</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-[#334867] text-[#D1E1FF] font-semibold">
                Adaptive
              </span>
            </div>
            
            <button
              onClick={() => setShowLearningModal(true)}
              className="text-[10px] text-[#C4C6D0] hover:text-[#D1E1FF] flex items-center space-x-1 font-medium transition"
              title="View your learned habits and interaction statistics"
            >
              <TrendingUp className="w-3 h-3" />
              <span>Insights</span>
            </button>
          </div>

          {/* Quick Filter Categories */}
          <div className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px]">
            <button
              onClick={() => setSelectedFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                selectedFilter === 'ALL'
                  ? 'bg-[#D1E1FF] text-[#003062] font-bold'
                  : 'bg-[#1D2026] text-[#C4C6D0] hover:bg-[#2E3036]'
              }`}
            >
              All Learned ({allLearnedUpdates.length})
            </button>
            <button
              onClick={() => setSelectedFilter('MOST_USED')}
              className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                selectedFilter === 'MOST_USED'
                  ? 'bg-[#D1E1FF] text-[#003062] font-bold'
                  : 'bg-[#1D2026] text-[#C4C6D0] hover:bg-[#2E3036]'
              }`}
            >
              🌟 Top Tasks
            </button>
            <button
              onClick={() => setSelectedFilter('ROUTINE')}
              className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                selectedFilter === 'ROUTINE'
                  ? 'bg-[#D1E1FF] text-[#003062] font-bold'
                  : 'bg-[#1D2026] text-[#C4C6D0] hover:bg-[#2E3036]'
              }`}
            >
              ⚡ Routines
            </button>
            <button
              onClick={() => setSelectedFilter('DELEGATION')}
              className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                selectedFilter === 'DELEGATION'
                  ? 'bg-[#D1E1FF] text-[#003062] font-bold'
                  : 'bg-[#1D2026] text-[#C4C6D0] hover:bg-[#2E3036]'
              }`}
            >
              🎯 Triggers
            </button>
          </div>

          {/* Scrollable Learned Action Chips */}
          <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
            {filteredLearnedUpdates.map((option) => (
              <div
                key={option.id}
                className="group flex items-center rounded-xl bg-[#2E3036] hover:bg-[#334867] border border-[#44474E]/40 transition shrink-0 overflow-hidden"
              >
                {/* Populate into text field */}
                <button
                  onClick={() => handleQuickOptionClick(option)}
                  className="px-3 py-1.5 text-xs text-left flex items-center space-x-2 text-[#E2E2E6]"
                  title={`Click to fill prompt: "${option.prompt}"`}
                >
                  <span className="font-medium whitespace-nowrap">{option.label}</span>
                  {option.badge && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#1D2026] text-[#D1E1FF] border border-[#44474E]/40 font-mono">
                      {option.badge}
                    </span>
                  )}
                </button>

                {/* Instant Execute Button */}
                <button
                  onClick={() => handleInstantSendOption(option)}
                  disabled={isProcessing}
                  className="px-2 py-1.5 bg-[#334867] group-hover:bg-[#D1E1FF] text-[#D1E1FF] group-hover:text-[#003062] border-l border-[#44474E]/40 transition disabled:opacity-40"
                  title="Instant One-Click Execute"
                >
                  <Zap className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Interactive Natural Language Input Bar */}
      <div className="p-3 bg-[#111318] border-t border-[#44474E]/30 z-20">
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center space-x-2">
          {/* Voice Input Button */}
          <button
            type="button"
            id="voice-dictation-btn"
            onClick={toggleVoiceRecording}
            className={`p-2.5 rounded-2xl transition ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse shadow-lg'
                : 'bg-[#2E3036] text-[#D1E1FF] hover:bg-[#334867] border border-[#44474E]/40'
            }`}
            title={isRecording ? 'Listening... click to stop' : 'Speak day update (Voice-to-Text)'}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <input
              id="day-update-input"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isRecording ? 'Listening to speech...' : 'Tell me what happened or what changed...'}
              disabled={isProcessing}
              className="w-full py-2.5 pl-3.5 pr-10 rounded-2xl bg-[#1D2026] border border-[#44474E]/40 text-xs text-[#E2E2E6] placeholder-[#C4C6D0]/50 focus:outline-none focus:ring-2 focus:ring-[#D1E1FF] disabled:opacity-50"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            id="send-update-btn"
            disabled={!inputText.trim() || isProcessing}
            className="p-2.5 rounded-2xl bg-[#D1E1FF] hover:bg-white disabled:opacity-30 text-[#003062] transition shadow-md font-bold"
            title="Process Natural Language Update"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Auto-Learning Insights Dialog Modal */}
      {showLearningModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#1D2026] border border-[#44474E]/40 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#44474E]/30 pb-3">
              <div className="flex items-center space-x-2">
                <BrainCircuit className="w-5 h-5 text-[#D1E1FF]" />
                <h3 className="text-sm font-bold text-[#E2E2E6]">Auto-Learning Intelligence</h3>
              </div>
              <button
                onClick={() => setShowLearningModal(false)}
                className="p-1 rounded-lg text-[#C4C6D0] hover:text-[#E2E2E6] hover:bg-[#2E3036] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-[#C4C6D0] leading-relaxed">
                The tracker continuously analyzes your daily logs, task starts, and completions. As you work, your most frequent workflows automatically bubble up into single-tap shortcuts.
              </p>

              {/* Stats Overview */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-[#2E3036] p-2.5 rounded-2xl border border-[#44474E]/30">
                  <div className="text-lg font-bold text-[#D1E1FF]">
                    {learningProfile.totalLearnedInteractions}
                  </div>
                  <div className="text-[10px] text-[#C4C6D0]">Learned Interactions</div>
                </div>
                <div className="bg-[#2E3036] p-2.5 rounded-2xl border border-[#44474E]/30">
                  <div className="text-lg font-bold text-[#D1E1FF]">
                    {sortedTaskStats.length}
                  </div>
                  <div className="text-[10px] text-[#C4C6D0]">Tracked Tasks</div>
                </div>
              </div>

              {/* Top Tasks List */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-[#E2E2E6] flex items-center justify-between">
                  <span>Top Frequent Tasks</span>
                  <span className="text-[10px] text-[#C4C6D0]/70 font-mono">Frequency</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {sortedTaskStats.length === 0 && (
                    <div className="p-3 text-center text-[11px] text-[#C4C6D0] bg-[#2E3036] rounded-xl border border-[#44474E]/30">
                      No learned tasks yet. DayTrace will learn from tasks you start and complete.
                    </div>
                  )}
                  {sortedTaskStats.slice(0, 5).map((stat) => (
                    <div
                      key={stat.taskId}
                      className="p-2 bg-[#2E3036] rounded-xl border border-[#44474E]/30 flex items-center justify-between text-xs"
                    >
                      <div className="truncate mr-2">
                        <div className="font-medium text-[#E2E2E6] truncate">{stat.title}</div>
                        <div className="text-[9px] text-[#C4C6D0]">
                          {stat.startCount} started • {stat.completeCount} completed
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#334867] text-[#D1E1FF] text-[10px] font-bold font-mono shrink-0">
                        {stat.totalInteractions}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-[#44474E]/30">
              <button
                onClick={() => setShowResetLearningConfirm(true)}
                className="text-[11px] text-[#C4C6D0] hover:text-[#F87171] flex items-center space-x-1 transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Learning</span>
              </button>

              <button
                onClick={() => setShowLearningModal(false)}
                className="px-4 py-2 bg-[#D1E1FF] text-[#003062] text-xs font-bold rounded-xl hover:bg-white transition"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetLearningConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-[#1D2026] border border-[#F87171]/40 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#E2E2E6]">Reset all learned memory?</h3>
              <p className="text-xs text-[#C4C6D0] mt-1.5 leading-relaxed">
                This permanently purges learned tasks, routines, frequencies and shortcut history. Your actual tasks and timeline will not be deleted.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowResetLearningConfirm(false)}
                className="px-4 py-2 rounded-xl bg-[#2E3036] text-[#E2E2E6] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resetLearnedShortcuts();
                  setFeedbackToast('Learning memory purged');
                  setShowResetLearningConfirm(false);
                  setShowLearningModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#F87171] text-[#111318] text-xs font-bold"
              >
                Purge Memory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
