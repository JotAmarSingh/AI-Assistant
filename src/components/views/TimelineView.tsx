import React, { useState } from 'react';
import { Clock, Plus, MapPin, CheckCircle2, Play, Coffee, Car, Calendar, Trash2 } from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { TimelineEvent, InterruptionClassification } from '../../types';

export const TimelineView: React.FC = () => {
  const { state, addTimelineEvent, deleteTimelineEvent, currentTimeString } = useDay();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New event form state
  const [eventTime, setEventTime] = useState(currentTimeString);
  const [eventType, setEventType] = useState<TimelineEvent['type']>('EVENT');
  const [eventDesc, setEventDesc] = useState('');
  const [eventLocation, setEventLocation] = useState(state.current.location || 'Office');
  const [classification, setClassification] = useState<InterruptionClassification | undefined>(undefined);
  const [plannedTime, setPlannedTime] = useState('');
  const [varianceMinutes, setVarianceMinutes] = useState<number | undefined>(undefined);

  const sortedTimeline = [...state.timeline].sort((a, b) => a.time.localeCompare(b.time));

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventDesc.trim()) return;

    addTimelineEvent({
      time: eventTime || currentTimeString,
      type: eventType,
      description: eventDesc.trim(),
      location: eventLocation,
      classification: eventType === 'INTERRUPTION' ? (classification || 'EXPECTED') : undefined,
      plannedTime: plannedTime.trim() || undefined,
      varianceMinutes: varianceMinutes !== undefined && !isNaN(varianceMinutes) ? Number(varianceMinutes) : undefined,
    });

    setEventDesc('');
    setPlannedTime('');
    setVarianceMinutes(undefined);
    setIsAddModalOpen(false);
  };

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'TASK_COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-[#D1E1FF]" />;
      case 'TASK_STARTED':
        return <Play className="w-4 h-4 text-[#D1E1FF] fill-[#D1E1FF]" />;
      case 'INTERRUPTION':
        return <Coffee className="w-4 h-4 text-[#FDE047]" />;
      case 'MEETING':
        return <Calendar className="w-4 h-4 text-[#D1E1FF]" />;
      case 'DEPARTURE':
        return <Car className="w-4 h-4 text-[#C4C6D0]" />;
      case 'UPDATE':
        return <Clock className="w-4 h-4 text-[#C4C6D0]" />;
      default:
        return <Clock className="w-4 h-4 text-[#D1E1FF]" />;
    }
  };

  return (
    <div id="timeline-view" className="flex-1 flex flex-col h-full bg-[#111318] text-[#E2E2E6] overflow-hidden relative">
      {/* Header Banner */}
      <div className="p-3 bg-[#111318] border-b border-[#44474E]/30 flex items-center justify-between z-10">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#E2E2E6]">
            Today's Chronological Stream
          </h3>
          <p className="text-[11px] text-[#C4C6D0]/70">
            {sortedTimeline.length} recorded events for {state.date}
          </p>
        </div>

        <button
          onClick={() => {
            setEventTime(currentTimeString);
            setIsAddModalOpen(true);
          }}
          className="py-1.5 px-3 rounded-2xl bg-[#D1E1FF] hover:bg-white text-[#003062] text-xs font-bold flex items-center space-x-1.5 transition shadow-md"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Log Event</span>
        </button>
      </div>

      {/* Timeline Stream Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {sortedTimeline.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-[#C4C6D0]/60">
            <Clock className="w-10 h-10 mb-2 opacity-30 text-[#D1E1FF]" />
            <div className="text-sm font-semibold text-[#E2E2E6]">Timeline is empty</div>
            <div className="text-xs text-[#C4C6D0] mt-1">Events logged throughout the day appear here chronologically.</div>
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 border-l-2 border-[#44474E]/30 ml-3">
            {sortedTimeline.map((item) => (
              <div key={item.id} className="relative group">
                {/* Timeline Dot */}
                <div className="absolute -left-[31px] top-1 w-6 h-6 rounded-full bg-[#1D2026] border-2 border-[#D1E1FF] flex items-center justify-center shadow-md">
                  {getEventIcon(item.type)}
                </div>

                {/* Event Card */}
                <div className="bg-[#1D2026] border border-[#44474E]/40 rounded-[28px] p-3.5 shadow-md space-y-2 transition hover:border-[#44474E]/70">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-[#D1E1FF]">
                        {item.time}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#2E3036] text-[#C4C6D0] border border-[#44474E]/30">
                        {item.type}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteTimelineEvent(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#C4C6D0] hover:text-[#F87171] transition"
                      title="Delete event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs font-medium text-[#E2E2E6] leading-snug">
                    {item.description}
                  </p>

                  {/* Location & Variance Badges */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#C4C6D0] pt-0.5">
                    {item.location && (
                      <span className="flex items-center">
                        <MapPin className="w-3 h-3 mr-0.5 text-[#D1E1FF]" />
                        {item.location}
                      </span>
                    )}

                    {item.classification && (
                      <span className="px-2 py-0.5 rounded-full bg-[#2E3036] text-[#FDE047] border border-[#FDE047]/30 text-[10px] font-mono">
                        {item.classification}
                      </span>
                    )}

                    {item.varianceMinutes !== undefined && item.varianceMinutes > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#2E3036] text-[#F87171] border border-[#F87171]/40 text-[10px] font-mono font-semibold">
                        +{item.varianceMinutes}m variance
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Timeline Event Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}>
          <div
            className="bg-[#1D2026] text-[#E2E2E6] border border-[#44474E]/50 rounded-[36px] p-6 shadow-2xl max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#44474E]/30">
              <h3 className="font-bold text-base text-[#E2E2E6]">Record Timeline Event</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-[#C4C6D0] hover:text-[#E2E2E6] font-semibold text-sm">✕</button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Time (HH:MM)</label>
                  <input
                    type="text"
                    required
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] font-mono focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Event Type</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as any)}
                    className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                  >
                    <option value="EVENT">General Event</option>
                    <option value="TASK_COMPLETED">Task Completed</option>
                    <option value="TASK_STARTED">Task Started</option>
                    <option value="INTERRUPTION">Interruption / Break</option>
                    <option value="DEPARTURE">Departure / Transit</option>
                    <option value="UPDATE">Update</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  placeholder="e.g., Finished review with boss"
                  className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Location</label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="e.g., Office / Home / Transit"
                  className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                />
              </div>

              {eventType === 'INTERRUPTION' && (
                <div>
                  <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Interruption Classification</label>
                  <select
                    value={classification || 'EXPECTED'}
                    onChange={(e) => setClassification(e.target.value as InterruptionClassification)}
                    className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                  >
                    <option value="EXPECTED">EXPECTED (Meal, legitimate break)</option>
                    <option value="UNEXPECTED">UNEXPECTED (Surprise disruption)</option>
                    <option value="AVOIDABLE">AVOIDABLE</option>
                    <option value="UNAVOIDABLE">UNAVOIDABLE</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-[#D1E1FF] hover:bg-white text-[#003062] font-bold rounded-2xl text-xs transition shadow-lg mt-3"
              >
                Save Event to Timeline
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

