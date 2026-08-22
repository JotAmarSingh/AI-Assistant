import React, { useMemo, useState } from 'react';
import { FileText, Mic, Plus, Trash2 } from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { processMeetingTranscriptLocally } from '../../utils/meetingProcessor';

const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

export const MeetingsView: React.FC = () => {
  const { state, meetings, updateMeeting, deleteMeeting, addTask, setIsVoiceModalOpen } = useDay();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const visibleMeetings = useMemo(() => meetings.filter((meeting) => meeting.date === state.date).sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [meetings, state.date]);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-[#111318] text-[#E2E2E6]">
      <div className="flex items-center justify-between border-b border-[#44474E]/30 p-4">
        <div><h2 className="text-sm font-bold">Meetings</h2><p className="text-[10px] text-[#C4C6D0]">Recordings, corrected transcripts, summaries and reviewed actions</p></div>
        <button onClick={() => setIsVoiceModalOpen(true)} className="flex items-center gap-1 rounded-2xl bg-[#BA1A1A] px-3 py-2 text-xs font-bold text-white"><Mic className="h-4 w-4" /> Record</button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {visibleMeetings.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center rounded-[28px] border border-dashed border-[#44474E] text-center">
            <FileText className="h-9 w-9 text-[#D1E1FF]/40" />
            <p className="mt-2 text-sm font-bold">No meetings for {state.date}</p>
            <p className="mt-1 max-w-xs text-xs text-[#C4C6D0]">Meeting Mode starts only after your confirmation and keeps no recording notification while inactive.</p>
          </div>
        )}

        {visibleMeetings.map((meeting) => {
          const expanded = expandedId === meeting.id;
          return (
            <article key={meeting.id} className="rounded-[28px] border border-[#44474E]/40 bg-[#1D2026] p-4">
              <div className="flex items-start justify-between gap-2">
                <button className="min-w-0 flex-1 text-left" onClick={() => setExpandedId(expanded ? null : meeting.id)}>
                  <h3 className="truncate text-sm font-bold">{meeting.title}</h3>
                  <p className="text-[10px] text-[#C4C6D0]">{new Date(meeting.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {formatDuration(meeting.durationSeconds)} • {meeting.status}</p>
                </button>
                <button onClick={() => deleteMeeting(meeting.id, 'ENTIRE')} className="rounded-xl p-2 text-[#FCA5A5]" title="Delete meeting"><Trash2 className="h-4 w-4" /></button>
              </div>

              {expanded && (
                <div className="mt-4 space-y-3 border-t border-[#44474E]/30 pt-3">
                  <label className="block text-[10px] font-bold text-[#C4C6D0]">Title / objective
                    <input value={meeting.title} onChange={(event) => updateMeeting(meeting.id, { title: event.target.value })} className="mt-1 w-full rounded-xl bg-[#111318] px-3 py-2 text-xs text-[#E2E2E6] outline-none" />
                  </label>
                  {meeting.processingMessage && <p className="rounded-xl bg-[#334867]/25 p-2 text-[10px] text-[#D1E1FF]">{meeting.processingMessage}</p>}
                  <label className="block text-[10px] font-bold text-[#C4C6D0]">Transcript (editable)
                    <textarea value={meeting.transcript || ''} onChange={(event) => updateMeeting(meeting.id, { transcript: event.target.value })} rows={6} placeholder="Add or correct the transcript. DayTrace will process this text locally." className="mt-1 w-full rounded-xl bg-[#111318] px-3 py-2 text-xs text-[#E2E2E6] outline-none" />
                  </label>
                  <button
                    disabled={!meeting.transcript?.trim()}
                    onClick={() => {
                      const result = processMeetingTranscriptLocally(meeting.transcript || '');
                      updateMeeting(meeting.id, { ...result, status: 'READY', processingMessage: 'Summary and action items were extracted locally from the corrected transcript.' });
                    }}
                    className="w-full rounded-xl bg-[#334867] py-2.5 text-xs font-bold text-[#D1E1FF] disabled:opacity-40"
                  >
                    Create offline summary & actions
                  </button>
                  <label className="block text-[10px] font-bold text-[#C4C6D0]">Summary (editable)
                    <textarea value={meeting.summary || ''} onChange={(event) => updateMeeting(meeting.id, { summary: event.target.value })} rows={4} className="mt-1 w-full rounded-xl bg-[#111318] px-3 py-2 text-xs text-[#E2E2E6] outline-none" />
                  </label>

                  {meeting.actionItems.length > 0 && (
                    <div className="rounded-2xl bg-[#111318] p-3">
                      <div className="flex items-center justify-between"><p className="text-xs font-bold">Review action items</p><button onClick={() => updateMeeting(meeting.id, { actionItems: meeting.actionItems.map((item) => ({ ...item, selected: true })) })} className="text-[10px] font-bold text-[#D1E1FF]">Select all</button></div>
                      <div className="mt-2 space-y-2">
                        {meeting.actionItems.map((item) => (
                          <label key={item.id} className="flex items-start gap-2 text-xs text-[#C4C6D0]">
                            <input type="checkbox" checked={item.selected} disabled={!!item.taskId} onChange={(event) => updateMeeting(meeting.id, { actionItems: meeting.actionItems.map((candidate) => candidate.id === item.id ? { ...candidate, selected: event.target.checked } : candidate) })} />
                            <span className={item.taskId ? 'line-through opacity-60' : ''}>{item.text}</span>
                          </label>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          const selected = meeting.actionItems.filter((item) => item.selected && !item.taskId);
                          selected.forEach((item) => addTask({ title: item.text, category: 'UNCATEGORISED', owner: 'ME', status: 'NEXT', priority: 5, source: `MEETING:${meeting.id}` }));
                          updateMeeting(meeting.id, { actionItems: meeting.actionItems.map((item) => item.selected && !item.taskId ? { ...item, taskId: `created-${Date.now()}-${item.id}` } : item) });
                        }}
                        disabled={!meeting.actionItems.some((item) => item.selected && !item.taskId)}
                        className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-[#D1E1FF] py-2.5 text-xs font-bold text-[#003062] disabled:opacity-40"
                      ><Plus className="h-4 w-4" /> Add selected to Tasks</button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => deleteMeeting(meeting.id, 'AUDIO')} disabled={!meeting.audioPath} className="rounded-xl bg-[#2E3036] py-2 text-[10px] font-bold text-[#FCA5A5] disabled:opacity-30">Delete recording only</button>
                    <button onClick={() => deleteMeeting(meeting.id, 'TRANSCRIPT')} disabled={!meeting.transcript && !meeting.summary} className="rounded-xl bg-[#2E3036] py-2 text-[10px] font-bold text-[#FCA5A5] disabled:opacity-30">Delete transcript/summary</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};
