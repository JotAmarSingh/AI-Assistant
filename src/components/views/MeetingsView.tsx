import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, FileText, ListChecks, Lock, Mic, Plus, ScrollText, Sparkles, Trash2 } from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { MeetingRecord } from '../../types';
import { processMeetingTranscriptLocally } from '../../utils/meetingProcessor';
import { UNCATEGORISED_CATEGORY_ID } from '../../utils/initialState';

const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
const weekKey = () => {
  const date = new Date(); const first = new Date(date.getFullYear(), 0, 1); const week = Math.ceil((((date.getTime() - first.getTime()) / 86400000) + first.getDay() + 1) / 7);
  return `${date.getFullYear()}-${week}`;
};

export const MeetingsView: React.FC = () => {
  const { state, meetings, updateMeeting, deleteMeeting, addTask, setIsVoiceModalOpen, claimMilestone } = useDay();
  const visibleMeetings = useMemo(() => meetings.filter((meeting) => meeting.date === state.date).sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [meetings, state.date]);
  const [expandedId, setExpandedId] = useState<string | null>(visibleMeetings[0]?.id || null);
  const selected = visibleMeetings.find((meeting) => meeting.id === expandedId) || visibleMeetings[0] || null;
  const recordedThisWeek = meetings.filter((meeting) => Date.now() - Date.parse(meeting.startedAt) <= 7 * 86400000).length;
  const summariesThisWeek = meetings.filter((meeting) => meeting.summary && Date.now() - Date.parse(meeting.startedAt) <= 7 * 86400000).length;
  const meetingTasksThisWeek = state.tasks.filter((task) => task.source?.startsWith('MEETING:') && Date.now() - Date.parse(task.createdAt) <= 7 * 86400000).length;
  const activeRecording = meetings.find((meeting) => meeting.status === 'RECORDING' || meeting.status === 'PAUSED');
  const milestoneClaims = state.gamification?.milestoneClaims || [];

  const summarize = (meeting: MeetingRecord | null) => {
    if (!meeting?.transcript?.trim()) return;
    const result = processMeetingTranscriptLocally(meeting.transcript);
    updateMeeting(meeting.id, { ...result, status: 'READY', processingMessage: 'Summary and action items were extracted locally from the reviewed transcript.' });
    setExpandedId(meeting.id);
  };

  const createTasks = (meeting: MeetingRecord | null) => {
    if (!meeting) return;
    const selectedItems = meeting.actionItems.filter((item) => item.selected && !item.taskId);
    if (!selectedItems.length) return;
    const ids = new Map<string, string>();
    selectedItems.forEach((item) => ids.set(item.id, addTask({ title: item.text, category: UNCATEGORISED_CATEGORY_ID, owner: 'ME', status: 'NEXT', priority: 5, source: `MEETING:${meeting.id}` })));
    updateMeeting(meeting.id, { actionItems: meeting.actionItems.map((item) => ids.has(item.id) ? { ...item, taskId: ids.get(item.id) } : item) });
  };

  const quest = (id: string, label: string, value: number, target: number, points: number) => {
    const claimId = `${id}:${weekKey()}`; const claimed = milestoneClaims.some((item) => item.id === claimId); const ready = value >= target && !claimed;
    return <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-3"><div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${ready ? 'bg-amber-300/15 text-amber-300' : 'bg-violet-400/10 text-violet-300'}`}>{claimed ? <CheckCircle2 className="h-5 w-5" /> : ready ? <Sparkles className="h-5 w-5 animate-pulse" /> : <Lock className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="text-xs font-black">{label}</p><p className="text-[10px] text-slate-400">{Math.min(value, target)}/{target}</p><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-gradient-to-r from-violet-400 to-cyan-300" style={{ width: `${Math.min(100, value / target * 100)}%` }} /></div></div><button type="button" disabled={!ready} onClick={() => claimMilestone(claimId, label, points)} className="rounded-xl bg-amber-300 px-2.5 py-2 text-[10px] font-black text-slate-950 disabled:bg-slate-800 disabled:text-slate-500">{claimed ? 'Claimed' : `+${points} XP`}</button></div></div>;
  };

  return (
    <div id="meetings-view" className="daytrace-scene flex h-full flex-1 flex-col overflow-hidden text-slate-100">
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-cyan-300/20 bg-[#050918]/90 px-4 py-3 backdrop-blur-xl"><div><h2 className="text-base font-black">Meetings</h2><p className="text-[10px] text-slate-400">Record, understand and turn decisions into action</p></div><div className="rounded-2xl border border-violet-300/25 bg-violet-400/10 px-3 py-2 text-xs font-black text-violet-200">{state.gamification?.points || 0} XP</div></header>
      <div className="relative flex-1 overflow-y-auto overscroll-contain p-4"><div className="daytrace-stars pointer-events-none absolute inset-0" /><div className="relative z-10 mx-auto max-w-lg space-y-4">
        <section className="rounded-[28px] border border-violet-300/30 bg-gradient-to-br from-violet-950/55 to-slate-950/80 p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-violet-300">Current quest</p><h3 className="mt-1 text-sm font-black">Meeting Momentum</h3><p className="mt-1 text-[10px] text-slate-400">Record 3 useful meetings this week</p></div><div className="text-right"><p className="font-mono text-sm font-black text-amber-300">{Math.min(recordedThisWeek, 3)}/3</p><p className="text-[9px] text-slate-500">real recordings</p></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-gradient-to-r from-violet-400 to-cyan-300" style={{ width: `${Math.min(100, recordedThisWeek / 3 * 100)}%` }} /></div></section>

        <section className="relative flex min-h-64 flex-col items-center justify-center overflow-hidden rounded-[34px] border border-cyan-300/20 bg-slate-950/55 p-5"><div className="daytrace-water pointer-events-none absolute inset-x-0 bottom-0 h-28 opacity-70" /><button id="record-meeting-island" type="button" onClick={() => setIsVoiceModalOpen(true)} className={`relative z-10 flex h-32 w-32 items-center justify-center rounded-full border-[3px] ${activeRecording ? 'animate-pulse border-rose-300 bg-rose-500/15 text-rose-200 shadow-[0_0_45px_rgba(244,63,94,.45)]' : 'border-cyan-300 bg-gradient-to-br from-blue-500/40 to-violet-600/40 text-white shadow-[0_0_45px_rgba(34,211,238,.45)]'}`} aria-label="Record new meeting"><span className="absolute inset-3 rounded-full border border-white/20" /><Mic className="h-12 w-12" /></button><h3 className="relative z-10 mt-4 text-sm font-black">{activeRecording ? activeRecording.status === 'PAUSED' ? 'Meeting paused' : 'Recording in progress' : 'Tap to Begin Quest'}</h3><p className="relative z-10 text-[10px] text-slate-400">{activeRecording ? formatDuration(activeRecording.durationSeconds) : 'Record New Meeting'}</p></section>

        <section className="grid grid-cols-3 gap-2"><button type="button" disabled={!selected} onClick={() => selected && setExpandedId(selected.id)} className="meeting-action text-violet-200"><ScrollText className="h-5 w-5" /><span>Transcribe</span></button><button type="button" disabled={!selected?.transcript?.trim()} onClick={() => summarize(selected)} className="meeting-action text-emerald-200"><Sparkles className="h-5 w-5" /><span>Summarize</span></button><button type="button" disabled={!selected?.actionItems.some((item) => item.selected && !item.taskId)} onClick={() => createTasks(selected)} className="meeting-action text-amber-200"><ListChecks className="h-5 w-5" /><span>Create Tasks</span></button></section>

        <section className="space-y-2"><div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-wider text-slate-300">Quest Progress</h3><span className="text-[10px] text-slate-500">This week</span></div>{quest('meeting-summaries', 'Weekly Clarity', summariesThisWeek, 3, 150)}{quest('meeting-tasks', 'Task Creator', meetingTasksThisWeek, 10, 200)}</section>

        <section className="space-y-2"><h3 className="text-xs font-black uppercase tracking-wider text-slate-300">Your meetings</h3>{visibleMeetings.length === 0 ? <div className="rounded-[28px] border border-dashed border-cyan-300/20 bg-slate-950/45 p-7 text-center"><FileText className="mx-auto h-9 w-9 text-cyan-300/50" /><p className="mt-3 text-sm font-black">No meetings for this day</p><p className="mt-1 text-xs text-slate-400">The recording notification appears only while you are actually recording.</p></div> : visibleMeetings.map((meeting) => {
          const expanded = expandedId === meeting.id;
          return <article key={meeting.id} className="rounded-[26px] border border-cyan-300/20 bg-slate-950/70 p-4"><div className="flex items-start gap-2"><button id={`meeting-card-${meeting.id}`} type="button" onClick={() => setExpandedId(expanded ? null : meeting.id)} className="min-w-0 flex-1 text-left"><h4 className="truncate text-sm font-black">{meeting.title}</h4><p className="mt-0.5 text-[10px] text-slate-400">{new Date(meeting.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {formatDuration(meeting.durationSeconds)} • {meeting.status}</p></button>{expanded ? <ChevronUp className="h-4 w-4 text-cyan-300" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}<button type="button" onClick={() => deleteMeeting(meeting.id, 'ENTIRE')} className="rounded-xl p-1 text-rose-300" aria-label="Delete meeting"><Trash2 className="h-4 w-4" /></button></div>{expanded && <MeetingDetails meeting={meeting} updateMeeting={updateMeeting} summarize={() => summarize(meeting)} createTasks={() => createTasks(meeting)} deleteMeeting={deleteMeeting} />}</article>;
        })}</section>
      </div></div>
    </div>
  );
};

const MeetingDetails: React.FC<{ meeting: MeetingRecord; updateMeeting: ReturnType<typeof useDay>['updateMeeting']; summarize: () => void; createTasks: () => void; deleteMeeting: ReturnType<typeof useDay>['deleteMeeting'] }> = ({ meeting, updateMeeting, summarize, createTasks, deleteMeeting }) => <div className="mt-4 space-y-3 border-t border-cyan-300/10 pt-3"><label className="form-label">Title<input value={meeting.title} onChange={(event) => updateMeeting(meeting.id, { title: event.target.value })} className="form-control" /></label>{meeting.processingMessage && <p className="rounded-xl bg-cyan-300/10 p-2 text-[10px] text-cyan-200">{meeting.processingMessage}</p>}<label className="form-label">Transcript<textarea rows={6} value={meeting.transcript || ''} onChange={(event) => updateMeeting(meeting.id, { transcript: event.target.value })} placeholder="Transcript" className="form-control" /></label><button type="button" disabled={!meeting.transcript?.trim()} onClick={summarize} className="w-full rounded-2xl bg-emerald-300 py-2.5 text-xs font-black text-slate-950 disabled:opacity-40">Create local summary and actions</button><label className="form-label">Summary<textarea rows={4} value={meeting.summary || ''} onChange={(event) => updateMeeting(meeting.id, { summary: event.target.value })} className="form-control" /></label>{meeting.actionItems.length > 0 && <div className="rounded-2xl bg-slate-950/70 p-3"><div className="flex justify-between"><p className="text-xs font-black">Review action items</p><button type="button" onClick={() => updateMeeting(meeting.id, { actionItems: meeting.actionItems.map((item) => ({ ...item, selected: true })) })} className="text-[10px] font-bold text-cyan-300">Select all</button></div><div className="mt-2 space-y-2">{meeting.actionItems.map((item) => <label key={item.id} className="flex gap-2 text-xs text-slate-300"><input type="checkbox" checked={item.selected} disabled={!!item.taskId} onChange={(event) => updateMeeting(meeting.id, { actionItems: meeting.actionItems.map((candidate) => candidate.id === item.id ? { ...candidate, selected: event.target.checked } : candidate) })} className="accent-cyan-300" /><span className={item.taskId ? 'line-through opacity-50' : ''}>{item.text}</span></label>)}</div><button type="button" onClick={createTasks} disabled={!meeting.actionItems.some((item) => item.selected && !item.taskId)} className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-cyan-300 py-2.5 text-xs font-black text-slate-950 disabled:opacity-40"><Plus className="h-4 w-4" />Add selected to Tasks</button></div>}<div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => deleteMeeting(meeting.id, 'AUDIO')} disabled={!meeting.audioPath} className="rounded-xl bg-rose-400/10 py-2 text-[10px] font-bold text-rose-200 disabled:opacity-30">Delete recording only</button><button type="button" onClick={() => deleteMeeting(meeting.id, 'TRANSCRIPT')} disabled={!meeting.transcript && !meeting.summary} className="rounded-xl bg-rose-400/10 py-2 text-[10px] font-bold text-rose-200 disabled:opacity-30">Delete transcript/summary</button></div></div>;
