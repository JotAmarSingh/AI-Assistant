import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Terminal, ShieldAlert, Cpu, CheckCircle2 } from 'lucide-react';

interface CyberneticAvatarCanvasProps {
  mode?: 'idle' | 'listening' | 'thinking' | 'talking' | 'processing_task';
  processingStatusText?: string;
  codeLogs?: string[];
  height?: number | string;
}

export const CyberneticAvatarCanvas: React.FC<CyberneticAvatarCanvasProps> = ({
  mode = 'idle',
  processingStatusText = 'AI Core Active',
  codeLogs = [],
  height = 240
}) => {
  const [matrixLines, setMatrixLines] = useState<string[]>([]);

  useEffect(() => {
    if (mode === 'processing_task' || mode === 'thinking') {
      const defaultLogs = [
        '01001001 01001110 01001001 01010100 01001001 01000001 01010100 01001001 01001110 01010100',
        '> CONNECTED TO GEMINI 2.5 PRO SEARCH GROUNDING',
        '> RUNNING CONFLICT_SCANNER ON TIMELINE ANCHORS...',
        '> AUDITING SAFETY & PEDIATRIC DOSAGE CONSTRAINTS...',
        '> PARSING MULTI-STEP ROADMAP SUB-TASKS...',
        '> RESCHEDULING CONFLICTING ROUTINES TO FREE WINDOW...'
      ];
      setMatrixLines(codeLogs.length > 0 ? codeLogs : defaultLogs);
    }
  }, [mode, codeLogs]);

  const isWorking = mode === 'processing_task' || mode === 'thinking';
  const isListening = mode === 'listening';
  const isTalking = mode === 'talking';

  return (
    <div 
      className="relative w-full rounded-[32px] overflow-hidden bg-[#070A10] border border-[#00F0FF]/30 shadow-[0_0_40px_rgba(0,240,255,0.15)] flex flex-col items-center justify-center p-4 transition-all duration-500"
      style={{ height }}
    >
      {/* Background Cyber Grid */}
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#00F0FF 1px, transparent 1px), linear-gradient(to right, rgba(0,240,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,240,255,0.05) 1px, transparent 1px)`,
          backgroundSize: '24px 24px, 16px 16px, 16px 16px'
        }}
      />

      {/* Cybernetic AI Avatar Hologram */}
      <div className="relative flex items-center justify-center z-10 my-auto">
        {/* Outer Pulsing Aura Rings */}
        <motion.div
          animate={{
            scale: isWorking ? [1, 1.25, 1] : isListening ? [1, 1.4, 1] : [1, 1.08, 1],
            opacity: isWorking ? [0.3, 0.7, 0.3] : [0.2, 0.4, 0.2],
            rotate: isWorking ? 360 : 0
          }}
          transition={{ repeat: Infinity, duration: isWorking ? 4 : isListening ? 1.5 : 6, ease: 'easeInOut' }}
          className="absolute w-44 h-44 rounded-full border border-[#00F0FF]/40 shadow-[0_0_30px_rgba(0,240,255,0.3)]"
        />

        <motion.div
          animate={{
            scale: isTalking ? [1, 1.2, 1] : [1, 1.05, 1],
            rotate: isWorking ? -360 : 0
          }}
          transition={{ repeat: Infinity, duration: isWorking ? 6 : 8, ease: 'linear' }}
          className="absolute w-36 h-36 rounded-full border border-dashed border-[#0088FF]/60"
        />

        {/* Central Glowing Cyber Humanoid Avatar Core */}
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-b from-[#00F0FF]/20 via-[#0088FF]/10 to-[#070A10] border-2 border-[#00F0FF] shadow-[0_0_35px_rgba(0,240,255,0.5)] flex items-center justify-center overflow-hidden">
          {/* Cybernetic Skeleton Grid Simulation */}
          <svg className="w-16 h-16 text-[#00F0FF] opacity-90" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="30" r="14" stroke="#00F0FF" strokeWidth="2" fill="rgba(0,240,255,0.15)" />
            <path d="M50 44 L50 78 M32 54 L68 54 M36 78 L50 64 L64 78" stroke="#00F0FF" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M40 30 L60 30 M50 20 L50 40" stroke="#0088FF" strokeWidth="1.5" />
            <circle cx="50" cy="30" r="3" fill="#FBBF24" />
            <circle cx="32" cy="54" r="2.5" fill="#00F0FF" />
            <circle cx="68" cy="54" r="2.5" fill="#00F0FF" />
            <circle cx="50" cy="64" r="2.5" fill="#FBBF24" />
          </svg>

          {/* Active Processing Scanning Line */}
          {isWorking && (
            <motion.div
              animate={{ y: [-40, 40, -40] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="absolute left-0 right-0 h-1 bg-[#00F0FF] shadow-[0_0_15px_#00F0FF]"
            />
          )}
        </div>
      </div>

      {/* Code Stream Overlay (When Processing Tasks / Thinking) */}
      <AnimatePresence>
        {isWorking && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute inset-x-3 top-3 bottom-10 bg-[#070A10]/95 backdrop-blur-md rounded-2xl border border-[#00F0FF]/40 p-3 font-mono text-[10px] text-[#00F0FF] space-y-1.5 overflow-hidden z-20 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#00F0FF]/30">
              <span className="font-bold text-[#FBBF24] flex items-center gap-1">
                <Cpu className="w-3 h-3 animate-spin text-[#FBBF24]" />
                CYBERNETIC AI EXECUTING TASK...
              </span>
              <span className="text-[9px] text-[#00F0FF]/70">GEMINI PRO HYBRID</span>
            </div>

            <div className="space-y-1 max-h-32 overflow-y-auto">
              {matrixLines.map((line, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center space-x-1.5"
                >
                  <span className="text-[#FBBF24] font-bold">›</span>
                  <span className={line.startsWith('>') ? 'text-[#00F0FF] font-semibold' : 'text-[#0088FF]/70'}>
                    {line}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Badge & Mode Footer */}
      <div className="relative z-10 mt-auto pt-2 flex items-center justify-between w-full text-xs border-t border-[#00F0FF]/20">
        <div className="flex items-center space-x-2">
          <span className={`w-2 h-2 rounded-full ${
            isListening ? 'bg-[#FBBF24] animate-ping' : isTalking ? 'bg-[#00F0FF] animate-pulse' : 'bg-[#0088FF]'
          }`} />
          <span className="text-[11px] font-mono font-bold text-[#E2E2E6]">
            {isListening ? '🎙️ Listening to Voice Dictation...' : isTalking ? '🗣️ Gemini AI Speaking...' : isWorking ? '⚙️ Executing Multi-Step Action...' : processingStatusText}
          </span>
        </div>

        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/40">
          PRO AI 2.5
        </span>
      </div>
    </div>
  );
};
