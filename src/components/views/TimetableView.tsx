import React, { useState } from 'react';
import {
  CalendarClock,
  Dumbbell,
  Utensils,
  Share2,
  Briefcase,
  Coffee,
  Film,
  Moon,
  Plus,
  CheckCircle2,
  Play,
  Check,
  RotateCcw,
  Sparkles,
  Edit3,
  Trash2,
  X,
  Clock,
  MapPin,
  Target,
  Layers,
  ArrowRight,
  Zap,
  Repeat
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { TimetableSlot, TaskCategory, RoutineRecurrence, RoutineSlotStatus } from '../../types';

export const TimetableView: React.FC = () => {
  const {
    state,
    addTimetableSlot,
    updateTimetableSlot,
    deleteTimetableSlot,
    toggleSlotStatus,
    syncTimetableToDailyTasks,
    applyTimetablePreset,
  } = useDay();

  const [filterDay, setFilterDay] = useState<'ALL' | 'TODAY' | 'WEEKDAYS' | 'WEEKENDS'>('TODAY');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Form State for Add / Edit Modal
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<TaskCategory>('HEALTH');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('09:00');
  const [formDays, setFormDays] = useState<RoutineRecurrence>('DAILY');
  const [formLocation, setFormLocation] = useState('HOME');
  const [formTargetMetric, setFormTargetMetric] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIconKey, setFormIconKey] = useState<TimetableSlot['iconKey']>('gym');

  const slots = state.timetable || [];

  // Helper to get matching icon for routine
  const getRoutineIcon = (iconKey?: string, category?: string) => {
    switch (iconKey) {
      case 'gym':
        return <Dumbbell className="w-4 h-4 text-[#D1E1FF]" />;
      case 'breakfast':
      case 'lunch':
        return <Utensils className="w-4 h-4 text-[#D1E1FF]" />;
      case 'social':
        return <Share2 className="w-4 h-4 text-[#D1E1FF]" />;
      case 'work':
        return <Briefcase className="w-4 h-4 text-[#D1E1FF]" />;
      case 'coffee':
        return <Coffee className="w-4 h-4 text-[#D1E1FF]" />;
      case 'script':
        return <Film className="w-4 h-4 text-[#D1E1FF]" />;
      case 'night':
        return <Moon className="w-4 h-4 text-[#D1E1FF]" />;
      default:
        if (category === 'HEALTH') return <Dumbbell className="w-4 h-4 text-[#D1E1FF]" />;
        if (category === 'CONTENT') return <Share2 className="w-4 h-4 text-[#D1E1FF]" />;
        if (category === 'OFFICE' || category === 'CLIENT') return <Briefcase className="w-4 h-4 text-[#D1E1FF]" />;
        return <Clock className="w-4 h-4 text-[#D1E1FF]" />;
    }
  };

  const handleOpenAddModal = (prefill?: Partial<TimetableSlot>) => {
    setEditingSlot(null);
    setFormTitle(prefill?.title || '');
    setFormCategory(prefill?.category || 'HEALTH');
    setFormStartTime(prefill?.startTime || '08:00');
    setFormEndTime(prefill?.endTime || '09:00');
    setFormDays(prefill?.days || 'DAILY');
    setFormLocation(prefill?.location || 'HOME');
    setFormTargetMetric(prefill?.targetMetric || '');
    setFormNotes(prefill?.notes || '');
    setFormIconKey(prefill?.iconKey || 'gym');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (slot: TimetableSlot) => {
    setEditingSlot(slot);
    setFormTitle(slot.title);
    setFormCategory(slot.category);
    setFormStartTime(slot.startTime);
    setFormEndTime(slot.endTime);
    setFormDays(slot.days);
    setFormLocation(slot.location || 'HOME');
    setFormTargetMetric(slot.targetMetric || '');
    setFormNotes(slot.notes || '');
    setFormIconKey(slot.iconKey || 'default');
    setShowAddModal(true);
  };

  const calculateDuration = (start: string, end: string): number => {
    try {
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      const diff = eH * 60 + eM - (sH * 60 + sM);
      return diff > 0 ? diff : 60;
    } catch {
      return 60;
    }
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const durationMinutes = calculateDuration(formStartTime, formEndTime);

    if (editingSlot) {
      updateTimetableSlot(editingSlot.id, {
        title: formTitle.trim(),
        category: formCategory,
        startTime: formStartTime,
        endTime: formEndTime,
        durationMinutes,
        days: formDays,
        location: formLocation,
        targetMetric: formTargetMetric.trim(),
        notes: formNotes.trim(),
        iconKey: formIconKey,
      });
    } else {
      addTimetableSlot({
        title: formTitle.trim(),
        category: formCategory,
        startTime: formStartTime,
        endTime: formEndTime,
        durationMinutes,
        days: formDays,
        status: 'PENDING',
        location: formLocation,
        isRegularHabit: true,
        targetMetric: formTargetMetric.trim(),
        notes: formNotes.trim(),
        iconKey: formIconKey,
      });
    }

    setShowAddModal(false);
  };

  const handleSyncToTasks = () => {
    syncTimetableToDailyTasks();
    setSyncFeedback('Timetable routines synchronized into Today\'s Task Board!');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  // Quick preset templates for rapid slot creation
  const routineTemplates = [
    { title: 'Gym / Workout', category: 'HEALTH', iconKey: 'gym', targetMetric: 'Strength training + cardio', defaultDuration: 60 },
    { title: 'Healthy Breakfast', category: 'HEALTH', iconKey: 'breakfast', targetMetric: 'High protein fuel + water', defaultDuration: 45 },
    { title: 'Social Media Posting', category: 'CONTENT', iconKey: 'social', targetMetric: 'Post 1 reel/thread + reply to comments', defaultDuration: 35 },
    { title: 'Lunch & Screen Break', category: 'HEALTH', iconKey: 'lunch', targetMetric: 'Nutritious meal + 15m walk', defaultDuration: 60 },
    { title: 'Deep Work Block', category: 'OFFICE', iconKey: 'work', targetMetric: 'Uninterrupted deliverable execution', defaultDuration: 120 },
    { title: 'Scriptwriting / Creation', category: 'CONTENT', iconKey: 'script', targetMetric: 'Draft 1 script or Khabarzaar reel', defaultDuration: 60 },
    { title: 'Night Routine & Review', category: 'PERSONAL', iconKey: 'night', targetMetric: 'Day reflection + screen shutdown', defaultDuration: 30 },
  ];

  // Routine Stats
  const completedSlots = slots.filter((s) => s.status === 'COMPLETED').length;
  const activeSlot = slots.find((s) => s.status === 'ACTIVE');
  const completionRate = slots.length > 0 ? Math.round((completedSlots / slots.length) * 100) : 0;

  return (
    <div id="timetable-view" className="flex-1 flex flex-col h-full overflow-hidden bg-[#111318] text-[#E2E2E6] relative">
      {/* Toast Feedback */}
      {syncFeedback && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-[#334867] text-[#D1E1FF] text-xs font-semibold px-4 py-2 rounded-full shadow-xl border border-[#D1E1FF]/30 flex items-center space-x-2 animate-in fade-in zoom-in-95">
          <Sparkles className="w-4 h-4 text-[#D1E1FF]" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Top Controls Header */}
      <div className="px-4 pt-3 pb-2 border-b border-[#44474E]/30 space-y-2 bg-[#111318]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-[#334867] flex items-center justify-center text-[#D1E1FF]">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#E2E2E6] flex items-center space-x-1.5">
                <span>Regular Timetable</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#2E3036] text-[#D1E1FF]">
                  {completedSlots}/{slots.length} Done
                </span>
              </h2>
              <p className="text-[10px] text-[#C4C6D0]">Gym, meals, social posting & daily recurring anchors</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setShowPresetModal(true)}
              className="px-2.5 py-1.5 bg-[#2E3036] hover:bg-[#334867] text-[#D1E1FF] rounded-xl text-xs font-medium border border-[#44474E]/40 flex items-center space-x-1 transition"
              title="AI Timetable Presets"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D1E1FF]" />
              <span className="hidden sm:inline">Presets</span>
            </button>

            <button
              onClick={() => handleOpenAddModal()}
              className="px-3 py-1.5 bg-[#D1E1FF] text-[#003062] hover:bg-white rounded-xl text-xs font-bold flex items-center space-x-1 transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Routine</span>
            </button>
          </div>
        </div>

        {/* Progress Bar & Quick Actions Bar */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex-1 mr-3">
            <div className="flex items-center justify-between text-[10px] text-[#C4C6D0] mb-1">
              <span>Today's Routine Adherence</span>
              <span className="font-mono font-bold text-[#D1E1FF]">{completionRate}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#2E3036] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#D1E1FF] rounded-full transition-all duration-300"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          <button
            onClick={handleSyncToTasks}
            className="px-2.5 py-1 rounded-lg bg-[#334867] hover:bg-[#D1E1FF] text-[#D1E1FF] hover:text-[#003062] text-[10px] font-bold transition flex items-center space-x-1 border border-[#D1E1FF]/20"
            title="Sync all routine slots into today's task list"
          >
            <Repeat className="w-3 h-3" />
            <span>Sync to Tasks</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Schedule Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Active Routine Spotlight (if one is currently in progress) */}
        {activeSlot && (
          <div className="p-3 bg-[#1D2026] border-2 border-[#D1E1FF]/50 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1.5">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D1E1FF] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D1E1FF]"></span>
                </span>
                <span className="text-[10px] font-bold text-[#D1E1FF] uppercase tracking-wider font-mono">
                  Currently Active Routine
                </span>
              </div>
              <span className="text-xs font-mono text-[#D1E1FF] font-bold">
                {activeSlot.startTime} – {activeSlot.endTime}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#334867] flex items-center justify-center text-[#D1E1FF]">
                  {getRoutineIcon(activeSlot.iconKey, activeSlot.category)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#E2E2E6]">{activeSlot.title}</h3>
                  {activeSlot.targetMetric && (
                    <p className="text-[11px] text-[#C4C6D0] flex items-center space-x-1">
                      <Target className="w-3 h-3 text-[#D1E1FF] shrink-0" />
                      <span>{activeSlot.targetMetric}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => toggleSlotStatus(activeSlot.id, 'COMPLETED')}
                  className="px-3 py-1.5 bg-[#D1E1FF] text-[#003062] hover:bg-white rounded-xl text-xs font-bold flex items-center space-x-1 transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Done</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Timetable Slots Chronological List */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold text-[#C4C6D0]/80 uppercase tracking-wider px-1 flex items-center justify-between">
            <span>Daily Regular Blocks</span>
            <span className="text-[10px] font-mono text-[#C4C6D0]/60">24-Hour Cadence</span>
          </div>

          {slots.map((slot) => {
            const isCompleted = slot.status === 'COMPLETED';
            const isActive = slot.status === 'ACTIVE';

            return (
              <div
                key={slot.id}
                className={`p-3 rounded-2xl border transition-all ${
                  isActive
                    ? 'bg-[#1D2026] border-[#D1E1FF]/50 shadow-md'
                    : isCompleted
                    ? 'bg-[#1D2026]/50 border-[#44474E]/20 opacity-80'
                    : 'bg-[#1D2026] border-[#44474E]/40 hover:border-[#44474E]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {/* Status Toggle / Icon */}
                    <button
                      onClick={() =>
                        toggleSlotStatus(
                          slot.id,
                          isCompleted ? 'PENDING' : 'COMPLETED'
                        )
                      }
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition shrink-0 ${
                        isCompleted
                          ? 'bg-[#334867] text-[#D1E1FF]'
                          : 'bg-[#2E3036] text-[#C4C6D0] hover:bg-[#334867]'
                      }`}
                      title={isCompleted ? 'Mark Pending' : 'Mark Completed'}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-[#D1E1FF]" />
                      ) : (
                        getRoutineIcon(slot.iconKey, slot.category)
                      )}
                    </button>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h4
                          className={`text-sm font-bold ${
                            isCompleted
                              ? 'line-through text-[#C4C6D0]/70'
                              : 'text-[#E2E2E6]'
                          }`}
                        >
                          {slot.title}
                        </h4>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium bg-[#2E3036] text-[#D1E1FF] border border-[#44474E]/30">
                          {slot.days}
                        </span>
                      </div>

                      {/* Target Goal / Habit Metric */}
                      {slot.targetMetric && (
                        <p className="text-[11px] text-[#C4C6D0] mt-0.5 flex items-center space-x-1">
                          <Target className="w-3 h-3 text-[#D1E1FF]/80 shrink-0" />
                          <span>{slot.targetMetric}</span>
                        </p>
                      )}

                      {/* Location and Notes */}
                      <div className="flex items-center space-x-2 mt-1 text-[10px] text-[#C4C6D0]/70">
                        {slot.location && (
                          <span className="flex items-center space-x-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            <span>{slot.location}</span>
                          </span>
                        )}
                        {slot.notes && (
                          <span className="truncate max-w-[180px]">
                            • {slot.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Time & Actions */}
                  <div className="flex flex-col items-end space-y-1.5 shrink-0 ml-2">
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-[#D1E1FF]">
                        {slot.startTime} - {slot.endTime}
                      </div>
                      <div className="text-[9px] font-mono text-[#C4C6D0]/60">
                        {slot.durationMinutes} mins
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      {!isCompleted && !isActive && (
                        <button
                          onClick={() => toggleSlotStatus(slot.id, 'ACTIVE')}
                          className="p-1 rounded-lg bg-[#2E3036] hover:bg-[#334867] text-[#D1E1FF] transition"
                          title="Start Now"
                        >
                          <Play className="w-3 h-3" />
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenEditModal(slot)}
                        className="p-1 rounded-lg text-[#C4C6D0] hover:text-[#E2E2E6] hover:bg-[#2E3036] transition"
                        title="Edit Routine"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>

                      <button
                        onClick={() => deleteTimetableSlot(slot.id)}
                        className="p-1 rounded-lg text-[#C4C6D0] hover:text-[#F87171] hover:bg-[#2E3036] transition"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Add Preset Bar at Bottom */}
        <div className="pt-2 border-t border-[#44474E]/30 space-y-1.5">
          <div className="text-[10px] font-bold text-[#C4C6D0]/80 uppercase tracking-wider px-1">
            Quick Add Routine Blueprint
          </div>
          <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none">
            {routineTemplates.map((tpl, i) => (
              <button
                key={i}
                onClick={() =>
                  handleOpenAddModal({
                    title: tpl.title,
                    category: tpl.category as TaskCategory,
                    targetMetric: tpl.targetMetric,
                    iconKey: tpl.iconKey as any,
                    durationMinutes: tpl.defaultDuration,
                  })
                }
                className="px-3 py-1.5 rounded-xl bg-[#2E3036] hover:bg-[#334867] border border-[#44474E]/40 text-xs font-medium text-[#E2E2E6] transition shrink-0 flex items-center space-x-1.5"
              >
                {getRoutineIcon(tpl.iconKey, tpl.category)}
                <span>+ {tpl.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Add / Edit Routine Slot Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#1D2026] border border-[#44474E]/40 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#44474E]/30 pb-3">
              <h3 className="text-sm font-bold text-[#E2E2E6] flex items-center space-x-2">
                <CalendarClock className="w-4 h-4 text-[#D1E1FF]" />
                <span>{editingSlot ? 'Edit Routine Slot' : 'Add Regular Habit Slot'}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-[#C4C6D0] hover:text-[#E2E2E6] hover:bg-[#2E3036] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-3 text-xs">
              {/* Routine Title */}
              <div>
                <label className="block text-[11px] font-bold text-[#C4C6D0] mb-1">
                  Routine / Task Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gym Workout, Breakfast, Social Media Post"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-[#111318] border border-[#44474E]/60 rounded-xl px-3 py-2 text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:outline-none focus:border-[#D1E1FF]"
                />
              </div>

              {/* Time Window */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#C4C6D0] mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full bg-[#111318] border border-[#44474E]/60 rounded-xl px-3 py-2 text-[#E2E2E6] font-mono focus:outline-none focus:border-[#D1E1FF]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#C4C6D0] mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full bg-[#111318] border border-[#44474E]/60 rounded-xl px-3 py-2 text-[#E2E2E6] font-mono focus:outline-none focus:border-[#D1E1FF]"
                  />
                </div>
              </div>

              {/* Days Recurrence & Category */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#C4C6D0] mb-1">
                    Recurrence
                  </label>
                  <select
                    value={formDays}
                    onChange={(e) => setFormDays(e.target.value as RoutineRecurrence)}
                    className="w-full bg-[#111318] border border-[#44474E]/60 rounded-xl px-3 py-2 text-[#E2E2E6] focus:outline-none focus:border-[#D1E1FF]"
                  >
                    <option value="DAILY">Daily (Every Day)</option>
                    <option value="WEEKDAYS">Weekdays (Mon-Fri)</option>
                    <option value="MON_WED_FRI">Mon / Wed / Fri</option>
                    <option value="TUE_THU">Tue / Thu</option>
                    <option value="WEEKENDS">Weekends Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#C4C6D0] mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as TaskCategory)}
                    className="w-full bg-[#111318] border border-[#44474E]/60 rounded-xl px-3 py-2 text-[#E2E2E6] focus:outline-none focus:border-[#D1E1FF]"
                  >
                    <option value="HEALTH">Health & Fitness</option>
                    <option value="CONTENT">Content & Social</option>
                    <option value="OFFICE">Office & Work</option>
                    <option value="CAREER">Career & Followups</option>
                    <option value="PERSONAL">Personal Routine</option>
                    <option value="HOME">Home & Family</option>
                  </select>
                </div>
              </div>

              {/* Target Habit Metric / Goal */}
              <div>
                <label className="block text-[11px] font-bold text-[#C4C6D0] mb-1">
                  Goal / Target Output (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 45 min lift + stretch, 1 LinkedIn post, Protein shake"
                  value={formTargetMetric}
                  onChange={(e) => setFormTargetMetric(e.target.value)}
                  className="w-full bg-[#111318] border border-[#44474E]/60 rounded-xl px-3 py-2 text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:outline-none focus:border-[#D1E1FF]"
                />
              </div>

              {/* Location & Icon */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#C4C6D0] mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GYM, HOME, OFFICE"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full bg-[#111318] border border-[#44474E]/60 rounded-xl px-3 py-2 text-[#E2E2E6] focus:outline-none focus:border-[#D1E1FF]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#C4C6D0] mb-1">
                    Icon Theme
                  </label>
                  <select
                    value={formIconKey}
                    onChange={(e) => setFormIconKey(e.target.value as any)}
                    className="w-full bg-[#111318] border border-[#44474E]/60 rounded-xl px-3 py-2 text-[#E2E2E6] focus:outline-none focus:border-[#D1E1FF]"
                  >
                    <option value="gym">🏋️ Gym / Fitness</option>
                    <option value="breakfast">🍳 Breakfast / Meal</option>
                    <option value="lunch">🍱 Lunch</option>
                    <option value="social">📱 Social Media</option>
                    <option value="work">💼 Work / Focus</option>
                    <option value="coffee">☕ Tea / Recharge</option>
                    <option value="script">🎬 Script / Creator</option>
                    <option value="night">🌙 Night Wind-down</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#44474E]/30">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-[#C4C6D0] hover:text-[#E2E2E6] hover:bg-[#2E3036] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#D1E1FF] text-[#003062] font-bold rounded-xl hover:bg-white transition"
                >
                  {editingSlot ? 'Save Changes' : 'Add Routine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Timetable Blueprint Optimizer Modal */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#1D2026] border border-[#44474E]/40 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#44474E]/30 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-[#D1E1FF]" />
                <h3 className="text-sm font-bold text-[#E2E2E6]">AI Timetable Blueprints</h3>
              </div>
              <button
                onClick={() => setShowPresetModal(false)}
                className="p-1 rounded-lg text-[#C4C6D0] hover:text-[#E2E2E6] hover:bg-[#2E3036] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#C4C6D0] leading-relaxed">
              Select an optimized daily schedule template tailored for high energy, physical fitness, content creation, and deep work blocks.
            </p>

            <div className="space-y-2.5">
              {/* Preset 1: Fitness & Creator First */}
              <div
                onClick={() => {
                  applyTimetablePreset('FITNESS_CREATOR');
                  setShowPresetModal(false);
                  setSyncFeedback('Applied "Fitness & Creator First" Daily Timetable!');
                }}
                className="p-3 bg-[#2E3036] hover:bg-[#334867] border border-[#44474E]/40 hover:border-[#D1E1FF]/40 rounded-2xl cursor-pointer transition space-y-1 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#D1E1FF] group-hover:text-white">
                    🏋️ Fitness & Creator First
                  </span>
                  <span className="text-[10px] font-mono text-[#D1E1FF]">Recommended</span>
                </div>
                <p className="text-[11px] text-[#C4C6D0] leading-tight">
                  Early breakfast (07:00) → Gym (07:45) → Social Posting (09:30) → Deep Work (10:15) → Lunch (13:00) → Scriptwriting (17:30).
                </p>
              </div>

              {/* Preset 2: Deep Work & Sprint Delivery */}
              <div
                onClick={() => {
                  applyTimetablePreset('DEEP_WORK');
                  setShowPresetModal(false);
                  setSyncFeedback('Applied "Deep Work & Sprint Delivery" Daily Timetable!');
                }}
                className="p-3 bg-[#2E3036] hover:bg-[#334867] border border-[#44474E]/40 hover:border-[#D1E1FF]/40 rounded-2xl cursor-pointer transition space-y-1 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#E2E2E6] group-hover:text-[#D1E1FF]">
                    💻 Deep Work & Office Focus
                  </span>
                  <span className="text-[10px] font-mono text-[#C4C6D0]">High Output</span>
                </div>
                <p className="text-[11px] text-[#C4C6D0] leading-tight">
                  Morning Blueprint (07:30) → Deep Block 1 (08:30-11:30) → Social (11:30) → Lunch (12:30) → Deep Block 2 (13:30) → Evening Gym (17:30).
                </p>
              </div>

              {/* Preset 3: Balanced Daily */}
              <div
                onClick={() => {
                  applyTimetablePreset('BALANCED');
                  setShowPresetModal(false);
                  setSyncFeedback('Applied "Balanced Work-Life" Daily Timetable!');
                }}
                className="p-3 bg-[#2E3036] hover:bg-[#334867] border border-[#44474E]/40 hover:border-[#D1E1FF]/40 rounded-2xl cursor-pointer transition space-y-1 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#E2E2E6] group-hover:text-[#D1E1FF]">
                    ⚖️ Balanced Routine Cadence
                  </span>
                  <span className="text-[10px] font-mono text-[#C4C6D0]">Default</span>
                </div>
                <p className="text-[11px] text-[#C4C6D0] leading-tight">
                  Breakfast (07:30) → Gym (08:15) → Social Media (09:40) → Core Office (10:15) → Lunch (13:00) → Evening Review (21:30).
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowPresetModal(false)}
                className="px-4 py-2 bg-[#2E3036] hover:bg-[#334867] text-xs font-bold text-[#C4C6D0] hover:text-[#E2E2E6] rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
