import React, { useEffect, useRef, useState } from 'react';
import './DayTraceAI.css';

export interface DayTraceAIProps {
  mode?: 'idle' | 'listening' | 'thinking' | 'talking' | 'alert';
  statusText?: string;
  height?: number | string;
  assetPath?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  pulseSpeed: number;
}

export const DayTraceAI: React.FC<DayTraceAIProps> = ({
  mode = 'idle',
  statusText = 'CYBERNETIC AI CORE ACTIVE',
  height = 380,
  assetPath = '/assets/daytrace-ai.webp'
}) => {
  const rainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [imageError, setImageError] = useState(false);
  const [isGlitching, setIsGlitching] = useState(false);

  // 1. Matrix Code Rain & Particles Animation Engine (Capped at 30 FPS)
  useEffect(() => {
    let animFrameId: number;
    let lastFrameTime = 0;
    const fpsInterval = 1000 / 30; // 30 FPS cap for battery optimization

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Rain Canvas Setup
    const rainCanvas = rainCanvasRef.current;
    const rainCtx = rainCanvas?.getContext('2d');
    if (rainCanvas && rainCtx) {
      const width = (rainCanvas.width = rainCanvas.parentElement?.clientWidth || 360);
      const heightNum = (rainCanvas.height = typeof height === 'number' ? height : 380);

      const chars = '010101A7SYS<>[]{}0010';
      const fontSize = 11;
      const columns = Math.floor(width / fontSize);
      const drops: number[] = Array(columns).fill(1);

      // Particle Setup
      const particleCanvas = particleCanvasRef.current;
      const particleCtx = particleCanvas?.getContext('2d');
      let particles: Particle[] = [];

      if (particleCanvas && particleCtx) {
        particleCanvas.width = width;
        particleCanvas.height = heightNum;

        // Initialize 24 subtle cyan floating particles
        particles = Array.from({ length: 24 }, () => ({
          x: Math.random() * width,
          y: Math.random() * heightNum,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4 - 0.2, // Drift upward
          size: Math.random() * 2 + 1,
          alpha: Math.random() * 0.6 + 0.2,
          pulseSpeed: Math.random() * 0.02 + 0.01
        }));
      }

      // Main Render Loop (30 FPS)
      const render = (currentTime: number) => {
        animFrameId = requestAnimationFrame(render);

        // Pause loop if document is backgrounded
        if (document.hidden) return;

        const delta = currentTime - lastFrameTime;
        if (delta < fpsInterval) return;
        lastFrameTime = currentTime - (delta % fpsInterval);

        // --- Render Matrix Rain ---
        rainCtx.fillStyle = 'rgba(7, 10, 16, 0.25)';
        rainCtx.fillRect(0, 0, width, heightNum);

        rainCtx.font = `${fontSize}px monospace`;

        const faceCenterX = width / 2;
        const faceCenterY = heightNum * 0.45;

        for (let i = 0; i < drops.length; i++) {
          const x = i * fontSize;
          const y = drops[i] * fontSize;

          // Keep matrix rain sparse directly over the AI face region
          const distToFace = Math.hypot(x - faceCenterX, y - faceCenterY);
          const isOverFace = distToFace < 65;

          if (!isOverFace || Math.random() > 0.7) {
            const char = chars[Math.floor(Math.random() * chars.length)];
            rainCtx.fillStyle = Math.random() > 0.85 ? '#0088FF' : '#00F0FF';
            rainCtx.globalAlpha = isOverFace ? 0.25 : 0.65;
            rainCtx.fillText(char, x, y);
          }

          if (y > heightNum && Math.random() > 0.975) {
            drops[i] = 0;
          }
          if (!prefersReducedMotion) {
            drops[i]++;
          }
        }
        rainCtx.globalAlpha = 1.0;

        // --- Render Floating Cyan Particles ---
        if (particleCtx && particleCanvas) {
          particleCtx.clearRect(0, 0, width, heightNum);

          for (let p of particles) {
            if (!prefersReducedMotion) {
              p.x += p.vx;
              p.y += p.vy;

              if (p.x < 0) p.x = width;
              if (p.x > width) p.x = 0;
              if (p.y < 0) p.y = heightNum;
              if (p.y > heightNum) p.y = 0;
            }

            p.alpha += p.pulseSpeed;
            if (p.alpha > 0.8 || p.alpha < 0.2) p.pulseSpeed = -p.pulseSpeed;

            particleCtx.beginPath();
            particleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            particleCtx.fillStyle = `rgba(0, 240, 255, ${Math.max(0.1, p.alpha)})`;
            particleCtx.shadowBlur = 8;
            particleCtx.shadowColor = '#00F0FF';
            particleCtx.fill();
            particleCtx.shadowBlur = 0;
          }

          // Subtle Connecting Lines between nearby particles
          for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
              const dx = particles[i].x - particles[j].x;
              const dy = particles[i].y - particles[j].y;
              const dist = Math.hypot(dx, dy);

              if (dist < 60) {
                particleCtx.beginPath();
                particleCtx.moveTo(particles[i].x, particles[i].y);
                particleCtx.lineTo(particles[j].x, particles[j].y);
                particleCtx.strokeStyle = `rgba(0, 240, 255, ${0.15 * (1 - dist / 60)})`;
                particleCtx.stroke();
              }
            }
          }
        }
      };

      animFrameId = requestAnimationFrame(render);
    }

    // Visibility Change Handler (Pause when tab is hidden)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animFrameId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animFrameId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [height]);

  // 2. Micro Digital Glitch Interval Controller (Occasional 150ms flickers)
  useEffect(() => {
    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.4) {
        setIsGlitching(true);
        setTimeout(() => setIsGlitching(false), 150);
      }
    }, 8000);

    return () => clearInterval(glitchInterval);
  }, []);

  const isAlert = mode === 'alert';
  const isListening = mode === 'listening';
  const isThinking = mode === 'thinking';

  return (
    <div 
      className={`daytrace-ai-container ${isGlitching ? 'glitching' : ''}`} 
      style={{ height }}
    >
      {/* Layer 2: Matrix Code Rain Canvas */}
      <canvas
        ref={rainCanvasRef}
        className="absolute inset-0 opacity-40 pointer-events-none z-0"
      />

      {/* Layer 3: Rotating Holographic Energy Rings */}
      <div className="daytrace-ai-ring ring-outer" />
      <div className="daytrace-ai-ring ring-middle" />
      <div className="daytrace-ai-ring ring-inner" />

      {/* Layer 4: High-Quality Cybernetic Humanoid Visual Asset */}
      <div className="daytrace-ai-humanoid-wrapper">
        {!imageError ? (
          <img
            src={assetPath}
            alt="DayTrace AI Holographic Humanoid"
            className="daytrace-ai-image"
            onError={() => setImageError(true)}
          />
        ) : (
          /* High-Precision 3D Sci-Fi Humanoid Vector Fallback */
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            <svg className="w-48 h-56 text-[#00F0FF] filter drop-shadow-[0_0_20px_#00F0FF]" viewBox="0 0 100 120" fill="none">
              {/* Humanoid Head & Neck Contour */}
              <path d="M50 10 C26 10, 16 32, 16 58 C16 88, 34 112, 50 112 C66 112, 84 88, 84 58 C84 32, 74 10, 50 10 Z" stroke="#00F0FF" strokeWidth="1.6" strokeOpacity="0.9" fill="rgba(0, 240, 255, 0.08)" />
              
              {/* Forehead Wireframe Mesh */}
              <path d="M30 24 Q50 30 70 24 M24 36 Q50 42 76 36" stroke="#0088FF" strokeWidth="0.8" strokeOpacity="0.6" />

              {/* Almond Eye Socket Vectors & Ocular Target Lenses */}
              <path d="M28 48 C32 42, 42 42, 46 48 C42 54, 32 54, 28 48 Z" stroke="#00F0FF" strokeWidth="1.2" fill="rgba(0, 240, 255, 0.2)" />
              <circle cx="37" cy="48" r="3.5" fill={isAlert ? '#F87171' : isListening ? '#FBBF24' : '#00F0FF'} />

              <path d="M54 48 C58 42, 68 42, 72 48 C68 54, 58 54, 54 48 Z" stroke="#00F0FF" strokeWidth="1.2" fill="rgba(0, 240, 255, 0.2)" />
              <circle cx="63" cy="48" r="4.5" stroke="#0088FF" strokeWidth="1" strokeDasharray="3 2" />
              <circle cx="63" cy="48" r="2" fill="#00F0FF" />

              {/* Nose Bridge & Nostril Vectors */}
              <path d="M50 36 L50 66 C47 68, 44 69, 44 72 L56 72 C56 69, 53 68, 50 66" stroke="#00F0FF" strokeWidth="1.2" strokeOpacity="0.85" />
              
              {/* Cheekbone & Jaw Vectors */}
              <path d="M20 58 Q34 66 44 68 M80 58 Q66 66 56 68" stroke="#0088FF" strokeWidth="0.8" strokeOpacity="0.5" />
              <path d="M36 84 C42 81, 58 81, 64 84 C58 90, 42 90, 36 84 Z" stroke="#00F0FF" strokeWidth="1.2" fill="rgba(0, 240, 255, 0.15)" />

              {/* Cybernetic Neck & Shoulder Armor Lines */}
              <path d="M34 104 L20 120 M66 104 L80 120 M50 108 L50 120" stroke="#00F0FF" strokeWidth="1.4" strokeOpacity="0.7" />
            </svg>
          </div>
        )}

        {/* Layer 7: Chest AI Core Glow */}
        <div className="daytrace-ai-core" style={{ backgroundColor: isAlert ? '#F87171' : '#00F0FF' }}>
          <div className="daytrace-ai-core-pulse" style={{ borderColor: isAlert ? '#F87171' : '#00F0FF' }} />
        </div>
      </div>

      {/* Layer 5: Fine Scanlines & Periodic Vertical Laser Beam */}
      <div className="daytrace-ai-scanlines" />
      <div className="daytrace-ai-laser-beam" />

      {/* Layer 6: Floating Digital Particles Canvas */}
      <canvas
        ref={particleCanvasRef}
        className="absolute inset-0 pointer-events-none z-20"
      />

      {/* Bottom AI Status Bar */}
      <div className="absolute bottom-3 left-4 right-4 z-30 flex items-center justify-between px-3.5 py-1.5 rounded-full bg-[#070A10]/90 border border-[#00F0FF]/30 backdrop-blur-md text-xs font-mono">
        <div className="flex items-center space-x-2">
          <span className={`w-2 h-2 rounded-full ${
            isAlert ? 'bg-[#F87171] animate-ping' :
            isListening ? 'bg-[#FBBF24] animate-ping' :
            isThinking ? 'bg-[#C084FC] animate-pulse' :
            'bg-[#00F0FF] animate-pulse'
          }`} />
          <span className="text-[11px] font-bold text-[#E2E2E6]">
            {statusText}
          </span>
        </div>

        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/40">
          DAYTRACE V2.5
        </span>
      </div>
    </div>
  );
};
