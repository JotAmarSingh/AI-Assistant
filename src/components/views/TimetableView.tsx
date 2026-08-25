import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Clock3, Edit3, MapPin, Play, Plus, Trash2, X } from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { RoutineRecurrence, TimetableSlot } from '../../types';
import { resolveContextualIcon } from '../../services/geminiService';
import { useGeneratedVisual } from '../../hooks/useGeneratedVisual';
import { UNCATEGORISED_CATEGORY_ID } from '../../utils/initialState';

const durationMinutes = (start: string, end: string) => {
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  return Math.max(1, (endHour * 60 + endMinute) - (startHour * 60 + startMinute));
};

const formatDuration = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim() : `${minutes}m`;

const SlotVisual: React.FC<{ slot: TimetableSlot; categoryLabel: string }> = ({ slot, categoryLabel }) => {
  const { imageUrl, isGenerating } = useGeneratedVisual('TASK_STICKER', slot.title, [categoryLabel]);
  return <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/25 bg-slate-950">{imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-contain p-1" /> : <span className={isGenerating ? 'animate-pulse' : ''}>{resolveContextualIcon(slot.title, categoryLabel)}</span>}</div>;
};

export const TimetableView: React.FC = () => {
  const { state, selectedDate, isViewingToday, addTimetableSlot, updateTimetableSlot, deleteTimetableSlot, toggleSlotStatus, taskCategories } = useDay();
  const slots = useMemo(() => [...(state.timetable || [])].sort((left, right) => left.startTime.localeCompare(right.startTime)), [state.timetable]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const plannedMinutes = slots.reduce((sum, slot) => sum + (slot.durationMinutes || durationMinutes(slot.startTime, slot.endTime)), 0);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const categories = taskCategories.length ? taskCategories : [{ id: UNCATEGORISED_CATEGORY_ID, label: 'Uncategorised' } as any];
  const categoryLabel = (id: string) => categories.find((category) => category.id === id)?.label || id;

  const openNew = () => { setEditingSlot(null); setIsEditorOpen(true); };
  const currentLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div id="timetable-view" className="daytrace-scene flex h-full flex-1 flex-col overflow-hidden text-slate-100">
      <header className="z-20 shrink-0 border-b border-cyan-300/20 bg-[#050918]/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between"><div><h2 className="text-base font-black">Timetable</h2><p className="text-[10px] text-slate-400">Plan the day before it becomes your timeline</p></div><button id="timetable-add-btn" type="button" onClick={openNew} className="rounded-full border border-cyan-300 bg-cyan-300/10 p-2.5 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,.3)]" aria-label="Add time block"><Plus className="h-5 w-5" /></button></div>
        <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-slate-950/70 px-4 py-2 text-xs"><CalendarDays className="h-4 w-4 text-cyan-300" /><span className="font-bold">{isViewingToday ? 'Today' : currentLabel}</span><span className="text-slate-500">•</span><span className="font-mono text-slate-300">{selectedDate}</span></div>
      </header>

      <div className="relative flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-4">
        <div className="daytrace-time-river pointer-events-none absolute inset-0" />
        <div className="relative z-10 mx-auto max-w-lg space-y-4">
          <section className="grid grid-cols-2 gap-3 rounded-[28px] border border-cyan-300/20 bg-slate-950/70 p-4 backdrop-blur-xl"><div className="flex items-center gap-3"><div className="rounded-2xl bg-cyan-300/10 p-2.5 text-cyan-300"><Clock3 className="h-5 w-5" /></div><div><p className="text-xl font-black">{formatDuration(plannedMinutes)}</p><p className="text-[10px] text-slate-400">Planned</p></div></div><div className="flex items-center gap-3 border-l border-white/10 pl-4"><div className="rounded-2xl bg-violet-400/10 p-2.5 text-violet-300"><CalendarDays className="h-5 w-5" /></div><div><p className="text-xl font-black">{slots.length}</p><p className="text-[10px] text-slate-400">Scheduled</p></div></div></section>

          <section className="relative min-h-[520px] rounded-[36px] border border-cyan-300/10 bg-slate-950/35 px-3 py-5 backdrop-blur-sm">
            <div className="absolute bottom-8 left-11 top-8 w-1 rounded-full bg-gradient-to-b from-amber-300 via-cyan-400 to-violet-500 shadow-[0_0_18px_rgba(34,211,238,.5)]" />
            {['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM'].map((label, index) => <div key={label} className="absolute left-2 flex items-center gap-2 text-[10px] font-mono text-slate-500" style={{ top: `${6 + index * 17}%` }}><span>{label}</span><span className="h-1.5 w-1.5 rounded-full bg-cyan-300/70" /></div>)}
            {isViewingToday && <div className="absolute left-20 z-20 flex -translate-y-1/2 items-center gap-2" style={{ top: `${Math.min(94, Math.max(6, ((nowMinutes - 360) / 900) * 88 + 6))}%` }}><span className="rounded-lg border border-cyan-300 bg-slate-950 px-2 py-1 text-[9px] font-black text-cyan-300">NOW</span><span className="h-px w-14 bg-cyan-300 shadow-[0_0_8px_#22d3ee]" /></div>}

            {slots.length === 0 ? <div className="absolute inset-x-14 top-1/2 -translate-y-1/2 rounded-[28px] border border-cyan-300/30 bg-[#071126]/90 p-5 text-center shadow-[0_0_26px_rgba(34,211,238,.16)]"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-300"><Plus className="h-6 w-6" /></div><h3 className="mt-3 text-base font-black">No plans for this day</h3><p className="mt-1 text-xs text-slate-400">Add a time block to begin.</p><button type="button" onClick={openNew} className="mt-4 rounded-2xl bg-cyan-300 px-5 py-3 text-xs font-black text-slate-950">Plan First Time Block</button></div> : (
              <div className="relative ml-14 space-y-3 pl-5">
                {slots.map((slot) => {
                  const expanded = expandedId === slot.id;
                  const [hour, minute] = slot.startTime.split(':').map(Number);
                  const startMinute = hour * 60 + minute;
                  const isNow = isViewingToday && startMinute <= nowMinutes && nowMinutes < startMinute + slot.durationMinutes;
                  const done = slot.status === 'COMPLETED';
                  return <article key={slot.id} className={`relative rounded-[24px] border p-3 backdrop-blur-xl ${isNow || slot.status === 'ACTIVE' ? 'border-cyan-300 bg-cyan-950/50 shadow-[0_0_20px_rgba(34,211,238,.2)]' : done ? 'border-emerald-300/30 bg-emerald-950/30' : 'border-violet-300/20 bg-slate-950/80'}`}><span className={`absolute -left-[30px] top-6 h-4 w-4 rounded-full border-2 ${done ? 'border-emerald-200 bg-emerald-400' : isNow ? 'animate-pulse border-cyan-100 bg-cyan-400 shadow-[0_0_12px_#22d3ee]' : 'border-violet-300 bg-slate-950'}`} /><button id={`timetable-slot-${slot.id}`} type="button" onClick={() => setExpandedId(expanded ? null : slot.id)} className="flex w-full items-center gap-3 text-left"><SlotVisual slot={slot} categoryLabel={categoryLabel(slot.category)} /><div className="min-w-0 flex-1"><p className="font-mono text-[10px] font-bold text-cyan-300">{slot.startTime} – {slot.endTime}</p><h3 className={`mt-0.5 text-sm font-bold ${done ? 'line-through opacity-60' : ''}`}>{slot.title}</h3><p className="mt-0.5 text-[10px] text-slate-400">{categoryLabel(slot.category)}{slot.location ? ` • ${slot.location}` : ''}</p></div>{expanded ? <ChevronUp className="h-4 w-4 text-cyan-300" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}</button>{expanded && <div className="mt-3 grid grid-cols-2 gap-2 border-t border-cyan-300/10 pt-3 sm:grid-cols-4"><button type="button" onClick={() => toggleSlotStatus(slot.id, slot.status === 'ACTIVE' ? 'PENDING' : 'ACTIVE')} className="task-action text-cyan-200"><Play className="h-3.5 w-3.5" />{slot.status === 'ACTIVE' ? 'Pause' : 'Start'}</button><button type="button" onClick={() => toggleSlotStatus(slot.id, done ? 'PENDING' : 'COMPLETED')} className="task-action text-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" />{done ? 'Reopen' : 'Complete'}</button><button type="button" onClick={() => { setEditingSlot(slot); setIsEditorOpen(true); }} className="task-action text-violet-200"><Edit3 className="h-3.5 w-3.5" />Edit</button><button type="button" onClick={() => deleteTimetableSlot(slot.id)} className="task-action text-rose-200"><Trash2 className="h-3.5 w-3.5" />Delete</button></div>}</article>;
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {isEditorOpen && <TimeBlockEditor slot={editingSlot} categories={categories as any} onClose={() => setIsEditorOpen(false)} onSave={(values) => { if (editingSlot) updateTimetableSlot(editingSlot.id, values); else addTimetableSlot(values); setIsEditorOpen(false); }} />}
    </div>
  );
};

const TimeBlockEditor: React.FC<{ slot: TimetableSlot | null; categories: Array<{ id: string; label: string }>; onClose: () => void; onSave: (slot: Omit<TimetableSlot, 'id'>) => void }> = ({ slot, categories, onClose, onSave }) => {
  const [title, setTitle] = useState(slot?.title || ''); const [startTime, setStartTime] = useState(slot?.startTime || '09:00'); const [endTime, setEndTime] = useState(slot?.endTime || '10:00'); const [category, setCategory] = useState(slot?.category || categories[0]?.id || UNCATEGORISED_CATEGORY_ID); const [location, setLocation] = useState(slot?.location || ''); const [days, setDays] = useState<RoutineRecurrence>(slot?.days || 'DAILY');
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 sm:items-center" onClick={onClose}><form onSubmit={(event) => { event.preventDefault(); if (!title.trim()) return; onSave({ title: title.trim(), category, startTime, endTime, durationMinutes: durationMinutes(startTime, endTime), days, status: slot?.status || 'PENDING', location: location.trim() || undefined, isRegularHabit: days !== 'CUSTOM', notes: slot?.notes, targetMetric: slot?.targetMetric, iconKey: slot?.iconKey }); }} onClick={(event) => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-[30px] border border-cyan-300/25 bg-[#090e1d] p-5"><div className="flex justify-between"><div><h3 className="font-black">{slot ? 'Edit time block' : 'Plan time block'}</h3><p className="text-[10px] text-slate-400">This will appear only from your saved data.</p></div><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div><label className="form-label">Title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Time block title" className="form-control" /></label><div className="grid grid-cols-2 gap-2"><label className="form-label">Start<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="form-control" /></label><label className="form-label">End<input type="time" value={endTime} min={startTime} onChange={(event) => setEndTime(event.target.value)} className="form-control" /></label></div><div className="grid grid-cols-2 gap-2"><label className="form-label">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="form-control">{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="form-label">Repeats<select value={days} onChange={(event) => setDays(event.target.value as RoutineRecurrence)} className="form-control"><option value="DAILY">Daily</option><option value="WEEKDAYS">Weekdays</option><option value="WEEKENDS">Weekends</option><option value="MON_WED_FRI">Mon/Wed/Fri</option><option value="TUE_THU">Tue/Thu</option><option value="CUSTOM">One day / Custom</option></select></label></div><label className="form-label">Location or link<div className="relative"><MapPin className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" /><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Optional" className="form-control pl-9" /></div></label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={onClose} className="rounded-2xl bg-slate-800 py-3 text-xs font-bold">Cancel</button><button type="submit" disabled={!title.trim()} className="rounded-2xl bg-cyan-300 py-3 text-xs font-black text-slate-950">Save block</button></div></form></div>;
};
