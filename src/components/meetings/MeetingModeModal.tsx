import React, { useEffect, useMemo, useState } from 'react';
import { Mic, Pause, Play, Square, X } from 'lucide-react';
import { useDay } from '../../context/DayContext';
import {
  getNativeMeetingRecordingState,
  isNativeAndroid,
  pauseNativeMeetingRecording,
  resumeNativeMeetingRecording,
  startNativeMeetingRecording,
  stopNativeMeetingRecording,
} from '../../services/nativeBridge';
import { MeetingRecord } from '../../types';

interface MeetingModeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatDuration = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export const MeetingModeModal: React.FC<MeetingModeModalProps> = ({ isOpen, onClose }) => {
  const { meetings, addMeeting, updateMeeting } = useDay();
  const [title, setTitle] = useState('');
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [status, setStatus] = useState<'CONFIRM' | 'STARTING' | 'RECORDING' | 'PAUSED' | 'STOPPING' | 'ERROR'>('CONFIRM');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const activeMeeting = useMemo(() => meetings.find((meeting) => meeting.id === activeMeetingId), [activeMeetingId, meetings]);

  useEffect(() => {
    if (!isOpen || !isNativeAndroid()) return;
    void getNativeMeetingRecordingState().then((nativeState) => {
      if (nativeState.status !== 'RECORDING' && nativeState.status !== 'PAUSED') return;
      setActiveMeetingId(nativeState.meetingId);
      setTitle(nativeState.title);
      setStatus(nativeState.status);
      setDurationSeconds(nativeState.durationSeconds);
      if (!meetings.some((meeting) => meeting.id === nativeState.meetingId)) {
        const startedAt = new Date(nativeState.startedAtMillis).toISOString();
        addMeeting({
          id: nativeState.meetingId,
          title: nativeState.title,
          date: startedAt.slice(0, 10),
          startedAt,
          durationSeconds: nativeState.durationSeconds,
          status: nativeState.status,
          audioPath: nativeState.audioPath,
          actionItems: [],
          createdAt: startedAt,
          updatedAt: new Date().toISOString(),
        });
      }
    }).catch(() => undefined);
  }, [addMeeting, isOpen, meetings]);

  useEffect(() => {
    if (!isOpen || (status !== 'RECORDING' && status !== 'PAUSED')) return;
    const interval = window.setInterval(async () => {
      try {
        const nativeState = await getNativeMeetingRecordingState();
        setDurationSeconds(nativeState.durationSeconds);
        if (activeMeetingId) updateMeeting(activeMeetingId, { durationSeconds: nativeState.durationSeconds });
      } catch {
        if (status === 'RECORDING') setDurationSeconds((seconds) => seconds + 1);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeMeetingId, isOpen, status, updateMeeting]);

  if (!isOpen) return null;

  const startRecording = async () => {
    setError(null);
    if (!isNativeAndroid()) {
      setStatus('ERROR');
      setError('Background Meeting Mode recording is available in the Android app.');
      return;
    }
    setStatus('STARTING');
    const meetingId = `meeting-${Date.now()}`;
    const meetingTitle = title.trim() || `Meeting ${new Date().toLocaleDateString()}`;
    try {
      const nativeState = await startNativeMeetingRecording(meetingId, meetingTitle);
      const startedAt = new Date(nativeState.startedAtMillis || Date.now()).toISOString();
      const meeting: MeetingRecord = {
        id: meetingId,
        title: meetingTitle,
        objective: title.trim() || undefined,
        date: startedAt.slice(0, 10),
        startedAt,
        durationSeconds: 0,
        status: 'RECORDING',
        actionItems: [],
        createdAt: startedAt,
        updatedAt: startedAt,
      };
      addMeeting(meeting);
      setActiveMeetingId(meetingId);
      setStatus('RECORDING');
    } catch (startError: any) {
      setStatus('ERROR');
      setError(startError?.message || 'Meeting recording could not start.');
    }
  };

  const togglePause = async () => {
    if (!activeMeetingId) return;
    try {
      if (status === 'PAUSED') {
        await resumeNativeMeetingRecording();
        setStatus('RECORDING');
        updateMeeting(activeMeetingId, { status: 'RECORDING' });
      } else {
        await pauseNativeMeetingRecording();
        setStatus('PAUSED');
        updateMeeting(activeMeetingId, { status: 'PAUSED' });
      }
    } catch (pauseError: any) {
      setError(pauseError?.message || 'Could not change recording state.');
    }
  };

  const stopRecording = async () => {
    if (!activeMeetingId) return;
    setStatus('STOPPING');
    try {
      await stopNativeMeetingRecording();
      await new Promise((resolve) => window.setTimeout(resolve, 600));
      const nativeState = await getNativeMeetingRecordingState();
      updateMeeting(activeMeetingId, {
        endedAt: new Date(nativeState.endedAtMillis || Date.now()).toISOString(),
        durationSeconds: nativeState.durationSeconds || durationSeconds,
        audioPath: nativeState.audioPath,
        status: nativeState.status === 'FAILED' ? 'FAILED' : nativeState.status === 'INTERRUPTED' ? 'INTERRUPTED' : 'NEEDS_TRANSCRIPT',
        processingMessage: 'Recording saved privately. Add or correct the transcript in Meetings to create the offline summary and action items.',
      });
      setActiveMeetingId(null);
      setStatus('CONFIRM');
      setTitle('');
      onClose();
    } catch (stopError: any) {
      setStatus('ERROR');
      setError(stopError?.message || 'Could not stop the meeting recording safely. Use Stop in the recording notification.');
    }
  };

  const recording = status === 'RECORDING' || status === 'PAUSED' || status === 'STOPPING';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => { if (!recording) onClose(); }}>
      <div className="w-full max-w-md rounded-[32px] border border-[#44474E] bg-[#1D2026] p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Mic className={`h-5 w-5 ${recording ? 'text-[#F87171]' : 'text-[#D1E1FF]'}`} /><h2 className="text-sm font-bold">Meeting Mode</h2></div>
          {!recording && <button onClick={onClose} className="p-1 text-[#C4C6D0]"><X className="h-5 w-5" /></button>}
        </div>

        {!recording && status !== 'STARTING' ? (
          <div className="mt-4">
            <h3 className="text-sm font-bold">Do you want to start meeting recording?</h3>
            <p className="mt-1 text-xs text-[#C4C6D0]">Recording starts only after confirmation and continues with the screen locked through an Android microphone foreground service.</p>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional meeting objective or title" className="mt-4 w-full rounded-2xl border border-[#44474E] bg-[#111318] px-3 py-2.5 text-xs outline-none" />
            {error && <p className="mt-2 rounded-xl bg-[#7F1D1D]/30 p-2 text-[11px] text-[#FCA5A5]">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button autoFocus onClick={onClose} className="flex-1 rounded-2xl bg-[#2E3036] py-2.5 text-xs font-bold">Cancel</button>
              <button onClick={startRecording} className="flex-1 rounded-2xl bg-[#BA1A1A] py-2.5 text-xs font-bold text-white">Start recording</button>
            </div>
          </div>
        ) : status === 'STARTING' ? (
          <div className="py-12 text-center text-sm font-bold text-[#D1E1FF]">Starting private recorder…</div>
        ) : (
          <div className="mt-5 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#BA1A1A] text-white shadow-2xl shadow-red-950/60">
              <Mic className={`h-10 w-10 ${status === 'RECORDING' ? 'animate-pulse' : ''}`} />
            </div>
            <p className="mt-4 text-lg font-mono font-bold">{formatDuration(durationSeconds)}</p>
            <p className="text-xs text-[#C4C6D0]">{activeMeeting?.title || title || 'Meeting'} • {status === 'PAUSED' ? 'Paused' : status === 'STOPPING' ? 'Saving…' : 'Recording'}</p>
            {error && <p className="mt-2 text-[11px] text-[#FCA5A5]">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button disabled={status === 'STOPPING'} onClick={togglePause} className="flex-1 rounded-2xl bg-[#334867] py-3 text-xs font-bold text-[#D1E1FF] disabled:opacity-40">
                {status === 'PAUSED' ? <span className="flex items-center justify-center gap-1"><Play className="h-4 w-4" /> Resume</span> : <span className="flex items-center justify-center gap-1"><Pause className="h-4 w-4" /> Pause</span>}
              </button>
              <button disabled={status === 'STOPPING'} onClick={stopRecording} className="flex-1 rounded-2xl bg-[#BA1A1A] py-3 text-xs font-bold text-white disabled:opacity-40"><span className="flex items-center justify-center gap-1"><Square className="h-4 w-4" /> Stop & save</span></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
