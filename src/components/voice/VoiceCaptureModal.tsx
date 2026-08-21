import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  Check, 
  X, 
  Clock, 
  CheckCircle2, 
  PlusCircle, 
  AlertCircle,
  Zap,
  Volume2,
  CornerDownLeft
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { speechService, ParsedVoiceIntent } from '../../services/speechRecognition';

interface VoiceCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceCaptureModal: React.FC<VoiceCaptureModalProps> = ({ isOpen, onClose }) => {
  const { executeVoiceTranscript } = useDay();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedIntent, setParsedIntent] = useState<ParsedVoiceIntent | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const isSupported = speechService.isSupported();

  useEffect(() => {
    if (isOpen && isSupported) {
      handleToggleListen();
    } else if (!isOpen) {
      speechService.stopListening();
      setIsListening(false);
      setTranscript('');
      setParsedIntent(null);
      setMicError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (transcript.trim()) {
      const parsed = speechService.parseVoiceTranscript(transcript);
      setParsedIntent(parsed);
    } else {
      setParsedIntent(null);
    }
  }, [transcript]);

  if (!isOpen) return null;

  const handleToggleListen = async () => {
    if (isListening) {
      speechService.stopListening();
      setIsListening(false);
    } else {
      setMicError(null);
      const started = await speechService.startListening(
        (interim) => {
          setTranscript(interim);
        },
        (finalText) => {
          setTranscript(finalText);
          setIsListening(false);
        },
        (err) => {
          setMicError(err);
          setIsListening(false);
        }
      );
      if (started) {
        setIsListening(true);
      }
    }
  };

  const handleConfirmExecute = () => {
    if (!transcript.trim()) return;
    executeVoiceTranscript(transcript.trim());
    onClose();
  };

  const handleApplyPreset = (text: string) => {
    setTranscript(text);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#1D2026] text-[#E2E2E6] border border-[#44474E]/60 rounded-[32px] p-6 max-w-md w-full shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#44474E]/30">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-2xl bg-[#D1E1FF]/10 text-[#D1E1FF]">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-[#E2E2E6]">Hands-Free Voice Memo Capture</h2>
              <p className="text-[11px] text-[#C4C6D0]/70">Auto-parse reminders, completed tasks, & timeline logs</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#C4C6D0] hover:text-[#E2E2E6] p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Interactive Mic Radar */}
        <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-[#111318] border border-[#44474E]/40 relative overflow-hidden">
          {/* Pulsing Audio Waves */}
          {isListening && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-32 h-32 rounded-full bg-[#D1E1FF]/20 animate-ping" />
              <div className="w-24 h-24 rounded-full bg-[#D1E1FF]/30 animate-pulse" />
            </div>
          )}

          <button
            id="voice-record-mic-btn"
            type="button"
            onClick={handleToggleListen}
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 relative z-10 ${
              isListening
                ? 'bg-[#BA1A1A] text-white scale-105 ring-4 ring-[#FFB4AB]/40'
                : 'bg-[#D1E1FF] text-[#003062] hover:bg-[#B6D4FE] active:scale-95'
            }`}
          >
            {isListening ? (
              <MicOff className="w-8 h-8 animate-pulse" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </button>

          <span className="text-xs font-semibold text-[#E2E2E6] mt-4 z-10 flex items-center space-x-1.5">
            {isListening ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#FFB4AB] animate-ping" />
                <span>Listening... speak naturally</span>
              </>
            ) : (
              <span>Tap microphone to record voice memo</span>
            )}
          </span>

          {micError && (
            <span className="text-[11px] text-[#F87171] font-semibold mt-2 text-center z-10 bg-[#7F1D1D]/30 px-3 py-1 rounded-xl">
              {micError}
            </span>
          )}
        </div>

        {/* Live Transcript & Input Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#D1E1FF] uppercase tracking-wider">Voice Memo Transcript</label>
            {parsedIntent && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                parsedIntent.type === 'NEW_REMINDER' ? 'bg-[#9333EA]/20 text-[#D8B4FE] border-[#9333EA]/40' :
                parsedIntent.type === 'TASK_DONE' ? 'bg-[#064E3B]/20 text-[#86EFAC] border-[#059669]/40' :
                parsedIntent.type === 'NEW_TASK' ? 'bg-[#1E3A8A]/20 text-[#93C5FD] border-[#2563EB]/40' :
                'bg-[#334867]/20 text-[#D1E1FF] border-[#334867]/40'
              }`}>
                {parsedIntent.type === 'NEW_REMINDER' ? '🔔 Reminder' :
                 parsedIntent.type === 'TASK_DONE' ? '✅ Task Completed' :
                 parsedIntent.type === 'NEW_TASK' ? '📝 New Task' : '⏱️ Timeline Log'}
              </span>
            )}
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="e.g. 'Remind me to review invoice at 4pm' or 'Done with morning workout' or 'Reached office, energy high'..."
            rows={3}
            className="w-full p-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:outline-hidden focus:border-[#D1E1FF]"
          />
        </div>

        {/* Quick Example Voice Chips */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-[#C4C6D0]/70 font-semibold block">Quick Voice Examples:</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Remind me to call accountant at 4:30pm',
              'Done with client proposal review',
              'Reached office, high energy focus',
              'Add task: publish newsletter draft',
            ].map((eg, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(eg)}
                className="text-[10px] px-2.5 py-1 rounded-xl bg-[#111318] hover:bg-[#2E3036] text-[#C4C6D0] hover:text-[#E2E2E6] border border-[#44474E]/30 transition truncate max-w-full"
              >
                "{eg}"
              </button>
            ))}
          </div>
        </div>

        {/* Confirm Action Button */}
        <div className="flex space-x-2 pt-2 border-t border-[#44474E]/30">
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-4 rounded-2xl bg-[#2E3036] hover:bg-[#44474E]/50 text-[#C4C6D0] font-semibold text-xs transition flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmExecute}
            disabled={!transcript.trim()}
            className="py-3 px-5 rounded-2xl bg-[#D1E1FF] hover:bg-[#B6D4FE] text-[#003062] font-bold text-xs flex items-center justify-center space-x-2 transition disabled:opacity-50 flex-[2] shadow-lg"
          >
            <Check className="w-4 h-4" />
            <span>Parse & Record</span>
          </button>
        </div>
      </div>
    </div>
  );
};
