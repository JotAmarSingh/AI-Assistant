import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu } from 'lucide-react';

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [matrixLines, setMatrixLines] = useState<string[]>([]);

  // Matrix Digital Rain Effect (Falling Letters/Numbers in Background)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const width = (canvas.width = canvas.parentElement?.clientWidth || 340);
    const heightNum = (canvas.height = typeof height === 'number' ? height : 240);

    const chars = '010101010101ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$&*<>[]{}';
    const fontSize = 10;
    const columns = Math.floor(width / fontSize);
    const drops: number[] = Array(columns).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(7, 10, 16, 0.2)';
      ctx.fillRect(0, 0, width, heightNum);

      ctx.fillStyle = '#00F0FF';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillStyle = Math.random() > 0.85 ? '#0088FF' : '#00F0FF';
        ctx.fillText(text, x, y);

        if (y > heightNum && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [height]);

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
      className="relative w-full rounded-[32px] overflow-hidden bg-[#070A10] border border-[#00F0FF]/40 shadow-[0_0_45px_rgba(0,240,255,0.2)] flex flex-col items-center justify-center p-4 transition-all duration-500"
      style={{ height }}
    >
      {/* Falling Code Matrix Background Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 opacity-30 pointer-events-none z-0"
      />

      {/* Cybernetic Frontal Human Face Mesh */}
      <div className="relative flex items-center justify-center z-10 my-auto">
        {/* Holographic Ring Aura */}
        <motion.div
          animate={{
            scale: isWorking ? [1, 1.25, 1] : isListening ? [1, 1.35, 1] : [1, 1.05, 1],
            opacity: isWorking ? [0.4, 0.8, 0.4] : [0.25, 0.5, 0.25],
          }}
          transition={{ repeat: Infinity, duration: isWorking ? 2 : 4, ease: 'easeInOut' }}
          className="absolute w-44 h-44 rounded-full border border-[#00F0FF]/30 shadow-[0_0_35px_rgba(0,240,255,0.25)]"
        />

        {/* High-Precision 3D Cybernetic Human Face Mesh */}
        <div className="relative w-32 h-36 rounded-[40%] bg-gradient-to-b from-[#0088FF]/30 via-[#00F0FF]/15 to-[#070A10] border border-[#00F0FF]/60 shadow-[0_0_45px_rgba(0,240,255,0.45)] flex flex-col items-center justify-center overflow-hidden">
          <svg className="w-28 h-32 text-[#00F0FF]" viewBox="0 0 100 120" fill="none">
            {/* Anatomical Head Contour */}
            <path d="M50 10 C26 10, 16 32, 16 58 C16 88, 34 112, 50 112 C66 112, 84 88, 84 58 C84 32, 74 10, 50 10 Z" stroke="#00F0FF" strokeWidth="1.6" strokeOpacity="0.9" fill="rgba(0, 240, 255, 0.08)" />
            
            {/* Forehead Wireframe Grid Lines */}
            <path d="M30 24 Q50 30 70 24 M24 36 Q50 42 76 36" stroke="#0088FF" strokeWidth="0.8" strokeOpacity="0.6" />

            {/* Left Eye Anatomical Contour & Target Iris */}
            <path d="M28 48 C32 42, 42 42, 46 48 C42 54, 32 54, 28 48 Z" stroke="#00F0FF" strokeWidth="1.2" fill="rgba(0, 240, 255, 0.15)" />
            <circle cx="37" cy="48" r="4" fill="#00F0FF" />
            <circle cx="37" cy="48" r="1.5" fill="#FBBF24" />

            {/* Right Eye Ocular HUD & Target Iris */}
            <path d="M54 48 C58 42, 68 42, 72 48 C68 54, 58 54, 54 48 Z" stroke="#00F0FF" strokeWidth="1.2" fill="rgba(0, 240, 255, 0.15)" />
            <circle cx="63" cy="48" r="5" stroke="#0088FF" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx="63" cy="48" r="2" fill="#00F0FF" />

            {/* Anatomical Nose Bridge & Nostril Curves */}
            <path d="M50 36 L50 66 C47 68, 44 69, 44 72 L56 72 C56 69, 53 68, 50 66" stroke="#00F0FF" strokeWidth="1.2" strokeOpacity="0.85" />
            
            {/* Cheekbone Wireframe Lines */}
            <path d="M20 58 Q34 66 44 68 M80 58 Q66 66 56 68" stroke="#0088FF" strokeWidth="0.8" strokeOpacity="0.5" />

            {/* Anatomical Lip Contour Vector & Equalizer Mouth */}
            <path d="M36 84 C42 81, 58 81, 64 84 C58 90, 42 90, 36 84 Z" stroke="#00F0FF" strokeWidth="1.2" fill="rgba(0, 240, 255, 0.15)" />
            <motion.path 
              d="M38 84 Q50 87 62 84" 
              stroke={isTalking ? '#FBBF24' : '#00F0FF'} 
              strokeWidth="2" 
              strokeLinecap="round" 
              animate={{ d: isTalking ? ["M38 82 Q50 92 62 82", "M38 85 Q50 80 62 85"] : "M38 84 Q50 87 62 84" }}
              transition={{ repeat: Infinity, duration: 0.3 }}
            />

            {/* Jawline & Chin Structure Lines */}
            <path d="M30 98 Q50 106 70 98" stroke="#00F0FF" strokeWidth="0.8" strokeOpacity="0.6" />
          </svg>

          {/* Active Processing Scanning Beam */}
          {isWorking && (
            <motion.div
              animate={{ y: [-60, 60, -60] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              className="absolute left-0 right-0 h-1 bg-[#00F0FF] shadow-[0_0_20px_#00F0FF]"
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
            className="absolute inset-x-3 top-3 bottom-10 bg-[#070A10]/95 backdrop-blur-md rounded-2xl border border-[#00F0FF]/50 p-3 font-mono text-[10px] text-[#00F0FF] space-y-1.5 overflow-hidden z-20 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#00F0FF]/30">
              <span className="font-bold text-[#FBBF24] flex items-center gap-1">
                <Cpu className="w-3 h-3 animate-spin text-[#FBBF24]" />
                CYBERNETIC AI EXECUTING TASK...
              </span>
              <span className="text-[9px] text-[#00F0FF]/70">GEMINI PRO 2.5</span>
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
          MATRIX AI
        </span>
      </div>
    </div>
  );
};

export const MiniCyberneticFaceIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-full border border-[#00F0FF]/60 shadow-[0_0_8px_#00F0FF]"
      />
      <svg className="w-full h-full text-[#00F0FF]" viewBox="0 0 100 120" fill="none">
        <path d="M50 10 C26 10, 16 32, 16 58 C16 88, 34 112, 50 112 C66 112, 84 88, 84 58 C84 32, 74 10, 50 10 Z" stroke="#00F0FF" strokeWidth="2.5" fill="rgba(0,240,255,0.2)" />
        <circle cx="37" cy="48" r="4" fill="#00F0FF" />
        <circle cx="63" cy="48" r="4" fill="#00F0FF" />
        <path d="M50 36 L50 66 L54 66" stroke="#00F0FF" strokeWidth="1.5" />
        <path d="M38 84 Q50 87 62 84" stroke="#00F0FF" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
};
