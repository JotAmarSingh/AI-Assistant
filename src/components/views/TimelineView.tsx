import React, { useMemo, useState } from 'react';
import { CalendarDays, Clock3, MapPin, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { TimelineEvent } from '../../types';
import { resolveContextualIcon } from '../../services/geminiService';
import { useGeneratedVisual } from '../../hooks/useGeneratedVisual';

const timeToMinutes = (value?: string): number | null => {
  if (!value) return null;
  const match = value.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/i);
  if (!match) return null;
  let hour = Number(match[1]); const minute = Number(match[2]); const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
};

const eventDuration = (event: TimelineEvent) => {
  const start = timeToMinutes(event.startTime || event.time.split(/[–-]/)[0]);
  const end = timeToMinutes(event.endTime || event.time.split(/[–-]/)[1]);
  return start !== null && end !== null && end >= start ? end - start : 0;
};

const formatMinutes = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim() : `${minutes}m`;

const TimelineSticker: React.FC<{ event: TimelineEvent; taskTitle?: string; category?: string }> = ({ event, taskTitle, category }) => {
  const subject = taskTitle || event.description;
  const { imageUrl, isGenerating } = useGeneratedVisual('TASK_STICKER', subject, [category || event.category || event.type]);
  return <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950">{imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-contain p-1" /> : <span className={`text-lg ${isGenerating ? 'animate-pulse' : ''}`}>{resolveContextualIcon(subject, category || event.type)}</span>}</div>;
};

export const TimelineView: React.FC = () => {
  const { state, selectedDate, addTimelineEvent, deleteTimelineEvent } = useDay();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  const events = useMemo(() => [...(state.timeline || [])].sort((left, right) => (left.startTime || left.time).localeCompare(right.startTime || right.time)), [state.timeline]);
  const totalMinutes = events.reduce((sum, event) => sum + eventDuration(event), 0);
  const productiveMinutes = events.filter((event) => event.type !== 'INTERRUPTION').reduce((sum, event) => sum + eventDuration(event), 0);
  const productivePercent = totalMinutes ? Math.round((productiveMinutes / totalMinutes) * 100) : 0;
  const xpEarned = state.tasks.reduce((sum, task) => sum + (task.xpAwarded || 0), 0);
  const longest = [...events].sort((left, right) => eventDuration(right) - eventDuration(left))[0];
  const dateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!description.trim()) return;
    addTimelineEvent({ date: selectedDate, time, type: 'UPDATE', description: description.trim(), location: location.trim() || state.current.location, source: 'MANUAL', syncStatus: 'PENDING', createdAt: new Date().toISOString() });
    setDescription(''); setLocation(''); setIsAddOpen(false);
  };

  return (
    <div id="timeline-view" className="daytrace-scene flex h-full flex-1 flex-col overflow-hidden text-slate-100">
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-cyan-300/20 bg-[#050918]/90 px-4 py-3 backdrop-blur-xl"><div><h2 className="text-base font-black">Timeline</h2><div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400"><CalendarDays className="h-3.5 w-3.5 text-cyan-300" />{dateLabel}</div></div><button id="timeline-add-btn" type="button" onClick={() => setIsAddOpen(true)} className="rounded-full bg-cyan-300 p-2.5 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,.35)]" aria-label="Add timeline entry"><Plus className="h-5 w-5" /></button></header>
      <div className="relative flex-1 overflow-y-auto overscroll-contain p-4"><div className="daytrace-stars pointer-events-none absolute inset-0" /><div className="relative z-10 mx-auto max-w-lg space-y-4">
        <section className="grid grid-cols-3 gap-2 rounded-[28px] border border-cyan-300/20 bg-slate-950/70 p-4 text-center backdrop-blur-xl"><div><p className="text-xl font-black">{formatMinutes(totalMinutes)}</p><p className="text-[9px] uppercase text-slate-400">Tracked</p></div><div className="border-x border-white/10"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-4 border-cyan-300/60 text-xs font-black text-cyan-300">{productivePercent}%</div><p className="mt-1 text-[9px] uppercase text-slate-400">Productive</p></div><div><p className="text-xl font-black text-emerald-300">+{xpEarned}</p><p className="text-[9px] uppercase text-slate-400">XP earned</p></div></section>

        {events.length === 0 ? <section className="flex min-h-[440px] flex-col items-center justify-center rounded-[32px] border border-dashed border-cyan-300/25 bg-slate-950/45 p-7 text-center"><Clock3 className="h-12 w-12 text-cyan-300/70" /><h3 className="mt-4 text-base font-black">Nothing logged yet</h3><p className="mt-2 max-w-xs text-xs text-slate-400">Activities, completed tasks, meetings and location updates will build this path from real events.</p><button type="button" onClick={() => setIsAddOpen(true)} className="mt-5 rounded-2xl bg-cyan-300 px-5 py-3 text-xs font-black text-slate-950">Add first log</button></section> : <section className="relative space-y-3 pl-7"><div className="absolute bottom-5 left-3 top-5 w-px bg-gradient-to-b from-amber-300 via-violet-400 to-cyan-300 shadow-[0_0_10px_#22d3ee]" />{events.map((event) => {
          const expanded = expandedId === event.id; const task = state.tasks.find((item) => item.id === event.relatedTaskId); const duration = eventDuration(event); const completed = event.type === 'TASK_COMPLETED'; const interrupted = event.type === 'INTERRUPTION';
          return <article key={event.id} className={`relative rounded-[24px] border p-3.5 backdrop-blur-xl ${completed ? 'border-emerald-300/35 bg-emerald-950/35' : interrupted ? 'border-rose-300/30 bg-rose-950/30' : event.type === 'TASK_STARTED' ? 'border-violet-300/40 bg-violet-950/40' : 'border-cyan-300/20 bg-slate-950/75'}`}><div className={`absolute -left-8 top-5 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-slate-950 ${completed ? 'border-emerald-300 text-emerald-300' : interrupted ? 'border-rose-300 text-rose-300' : 'border-cyan-300 text-cyan-300'}`}><Sparkles className="h-3.5 w-3.5" /></div><button id={`timeline-event-${event.id}`} type="button" onClick={() => setExpandedId(expanded ? null : event.id)} className="flex w-full items-center gap-3 text-left"><TimelineSticker event={event} taskTitle={task?.title} category={task?.category} /><div className="min-w-0 flex-1"><p className="font-mono text-[10px] font-bold text-cyan-300">{event.time}</p><h3 className="mt-0.5 text-sm font-bold">{event.description}</h3><p className="mt-0.5 text-[10px] text-slate-400">{event.type.replaceAll('_', ' ')}{event.location ? ` • ${event.location}` : ''}</p></div>{duration > 0 && <span className="rounded-full bg-slate-900 px-2 py-1 text-[9px] text-slate-300">{formatMinutes(duration)}</span>}</button>{expanded && <div className="mt-3 flex items-center justify-between border-t border-cyan-300/10 pt-3"><p className="text-[10px] text-slate-400">Source: {event.source || 'DayTrace'}</p><button type="button" onClick={() => deleteTimelineEvent(event.id)} className="flex items-center gap-1 rounded-xl bg-rose-400/10 px-3 py-2 text-[10px] font-bold text-rose-200"><Trash2 className="h-3.5 w-3.5" />Delete</button></div>}</article>;
        })}</section>}

        <section className="rounded-[28px] border border-cyan-300/30 bg-gradient-to-r from-cyan-950/40 via-slate-950/75 to-violet-950/40 p-4"><div className="flex items-start gap-3"><div className="rounded-2xl bg-cyan-300/10 p-2 text-cyan-300"><Sparkles className="h-5 w-5" /></div><div><h3 className="text-xs font-black text-cyan-300">DayTrace Insight</h3><p className="mt-1 text-xs leading-relaxed text-slate-300">{longest && eventDuration(longest) > 0 ? `Your longest tracked block was “${longest.description}” for ${formatMinutes(eventDuration(longest))}.` : events.length ? `You have ${events.length} real event${events.length === 1 ? '' : 's'} logged. Add start and end times to unlock duration insights.` : 'Insights will appear after you log real activity.'}</p></div></div></section>
      </div></div>
      {isAddOpen && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 sm:items-center" onClick={() => setIsAddOpen(false)}><form onSubmit={submit} onClick={(event) => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-[30px] border border-cyan-300/25 bg-[#090e1d] p-5"><div className="flex justify-between"><h3 className="font-black">Add timeline log</h3><button type="button" onClick={() => setIsAddOpen(false)}><X className="h-5 w-5" /></button></div><label className="form-label">Time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="form-control" /></label><label className="form-label">What happened<input autoFocus value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Activity" className="form-control" /></label><label className="form-label">Location<div className="relative"><MapPin className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" /><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Optional" className="form-control pl-9" /></div></label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setIsAddOpen(false)} className="rounded-2xl bg-slate-800 py-3 text-xs font-bold">Cancel</button><button type="submit" disabled={!description.trim()} className="rounded-2xl bg-cyan-300 py-3 text-xs font-black text-slate-950">Save log</button></div></form></div>}
    </div>
  );
};
