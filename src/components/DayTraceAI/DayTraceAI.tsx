import React, { useEffect, useRef, useState } from 'react';
import { isNativeAndroid } from '../../services/nativeBridge';
import './DayTraceAI.css';

export interface DayTraceAIProps {
  active?: boolean;
  mode?: 'idle' | 'listening' | 'thinking' | 'talking' | 'alert';
  statusText?: string;
  height?: number | string;
  assetPath?: string;
  onClick?: () => void;
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
  active = true,
  mode = 'idle',
  statusText = 'CYBERNETIC AI CORE ACTIVE',
  height = 360,
  assetPath = '/assets/daytrace-ai.webp',
  onClick
}) => {
  const rainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isGlitching, setIsGlitching] = useState(false);
  const [isAppVisible, setIsAppVisible] = useState(true);

  // 3D Gyroscope / Accelerator Motion State
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({});

  // Combine Active prop, Document visibility, and Window Focus
  const isFullyActive = active && isAppVisible && !document.hidden;

  // 1. Lifecycle Listener (Native App Pause/Resume + Tab Visibility)
  useEffect(() => {
    const handleVisibility = () => setIsAppVisible(!document.hidden);
    const handleResume = () => setIsAppVisible(true);
    const handlePause = () => setIsAppVisible(false);

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('resume', handleResume);
    document.addEventListener('pause', handlePause);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('resume', handleResume);
      document.removeEventListener('pause', handlePause);
    };
  }, []);

  // 2. 3D Gyroscope, Accelerometer Physical Mobile Sensor & Touch/Mouse Parallax Motion Engine
  useEffect(() => {
    if (!isFullyActive) return;

    let targetRotateX = 0;
    let targetRotateY = 0;
    let currentRotateX = 0;
    let currentRotateY = 0;
    let hasSensorInput = false;

    // Mobile Sensor Orientation Handler (Device Gyroscope)
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma !== null && event.beta !== null) {
        hasSensorInput = true;
        // gamma: left-to-right tilt in degrees [-90, 90] -> mapped to [-35, 35]
        // beta: front-to-back tilt in degrees [-180, 180] -> normalized around 45-degree hand holding angle
        const clampedGamma = Math.max(-35, Math.min(35, event.gamma));
        const normalizedBeta = event.beta - 45;
        const clampedBeta = Math.max(-35, Math.min(35, normalizedBeta));

        targetRotateY = clampedGamma * 0.65; // Rotate Y axis for left/right tilt
        targetRotateX = -clampedBeta * 0.55; // Rotate X axis for up/down tilt
      }
    };

    // Mouse & Touch Parallax for Desktop and Mobile Touch Interaction
    const handlePointerCoord = (clientX: number, clientY: number) => {
      const { innerWidth, innerHeight } = window;
      const xPercent = (clientX / (innerWidth || 360)) - 0.5;
      const yPercent = (clientY / (innerHeight || 640)) - 0.5;

      targetRotateY = xPercent * 24;
      targetRotateX = -yPercent * 24;
    };

    const handleMouseMove = (event: MouseEvent) => {
      handlePointerCoord(event.clientX, event.clientY);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches && event.touches[0]) {
        handlePointerCoord(event.touches[0].clientX, event.touches[0].clientY);
      }
    };

    // Auto-request DeviceOrientation permission on iOS if available
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      const requestIOSPerm = () => {
        (DeviceOrientationEvent as any).requestPermission().then((state: string) => {
          if (state === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          }
        }).catch(() => {});
        window.removeEventListener('click', requestIOSPerm);
      };
      window.addEventListener('click', requestIOSPerm);
    } else if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    // Smooth Lerp Animation Loop for 3D Motion with subtle organic breathing oscillation
    let motionAnimFrame: number;
    let startTime = Date.now();

    const animateMotion = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      // Gentle organic micro-sway when sensor is stationary
      const idleSwayX = hasSensorInput ? 0 : Math.sin(elapsed * 1.2) * 1.5;
      const idleSwayY = hasSensorInput ? 0 : Math.cos(elapsed * 0.9) * 2.0;

      currentRotateX += ((targetRotateX + idleSwayX) - currentRotateX) * 0.12;
      currentRotateY += ((targetRotateY + idleSwayY) - currentRotateY) * 0.12;

      setTiltStyle({
        transform: `perspective(1000px) rotateX(${currentRotateX.toFixed(2)}deg) rotateY(${currentRotateY.toFixed(2)}deg) translateZ(12px)`,
        transformStyle: 'preserve-3d',
        transition: 'transform 0.04s ease-out'
      });

      motionAnimFrame = requestAnimationFrame(animateMotion);
    };

    motionAnimFrame = requestAnimationFrame(animateMotion);

    return () => {
      if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      cancelAnimationFrame(motionAnimFrame);
    };
  }, [isFullyActive]);

  // 3. Matrix Code Rain & Particles Canvas Engine (Capped at 30 FPS, Completely Stopped when Inactive)
  useEffect(() => {
    if (!isFullyActive) return;

    let animFrameId: number;
    let lastFrameTime = 0;
    const fpsInterval = 1000 / 30;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const rainCanvas = rainCanvasRef.current;
    const rainCtx = rainCanvas?.getContext('2d');
    const particleCanvas = particleCanvasRef.current;
    const particleCtx = particleCanvas?.getContext('2d');

    if (!rainCanvas || !rainCtx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = (rainCanvas.width = (rainCanvas.parentElement?.clientWidth || 360) * dpr) / dpr;
    const heightNum = (rainCanvas.height = (typeof height === 'number' ? height : 360) * dpr) / dpr;

    rainCtx.scale(dpr, dpr);
    if (particleCanvas && particleCtx) {
      particleCanvas.width = width * dpr;
      particleCanvas.height = heightNum * dpr;
      particleCtx.scale(dpr, dpr);
    }

    const chars = '010101A7SYS<>[]{}0010';
    const fontSize = 11;
    const columns = Math.floor(width / fontSize);
    const drops: number[] = Array(columns).fill(1);
    const streamDepths: number[] = Array.from({ length: columns }, () => (Math.random() > 0.5 ? 1 : 2));

    let particles: Particle[] = [];
    if (particleCanvas && particleCtx) {
      particles = Array.from({ length: 18 }, () => ({
        x: Math.random() * width,
        y: Math.random() * heightNum,
        vx: (Math.random() - 0.5) * 0.3,
        vy: - (Math.random() * 0.3 + 0.1),
        size: Math.random() > 0.7 ? 3 : Math.random() > 0.4 ? 2 : 1,
        alpha: Math.random() * 0.5 + 0.2,
        pulseSpeed: Math.random() * 0.015 + 0.005
      }));
    }

    const render = (currentTime: number) => {
      animFrameId = requestAnimationFrame(render);

      const delta = currentTime - lastFrameTime;
      if (delta < fpsInterval) return;
      lastFrameTime = currentTime - (delta % fpsInterval);

      // --- Matrix Code Rain ---
      rainCtx.fillStyle = 'rgba(7, 10, 16, 0.22)';
      rainCtx.fillRect(0, 0, width, heightNum);

      const faceCenterX = width / 2;
      const faceCenterY = heightNum * 0.45;
      const faceRadiusX = 70;
      const faceRadiusY = 80;

      for (let i = 0; i < drops.length; i++) {
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        const depth = streamDepths[i];

        const dx = (x - faceCenterX) / faceRadiusX;
        const dy = (y - faceCenterY) / faceRadiusY;
        const isInsideFaceZone = dx * dx + dy * dy < 1.0;

        if (!isInsideFaceZone || Math.random() > 0.85) {
          const char = chars[Math.floor(Math.random() * chars.length)];
          const isLeading = Math.random() > 0.95;
          rainCtx.fillStyle = isLeading ? '#FFFFFF' : depth === 1 ? '#0088FF' : '#00F0FF';
          
          const baseAlpha = depth === 1 ? 0.25 : 0.55;
          rainCtx.globalAlpha = isInsideFaceZone ? 0.05 : baseAlpha;
          rainCtx.font = `${depth === 1 ? 9 : 11}px monospace`;
          
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

      // --- Floating Cyan Particles ---
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
          if (p.alpha > 0.75 || p.alpha < 0.15) p.pulseSpeed = -p.pulseSpeed;

          particleCtx.beginPath();
          particleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          particleCtx.fillStyle = `rgba(0, 240, 255, ${Math.max(0.1, p.alpha)})`;
          particleCtx.shadowBlur = p.size > 2 ? 6 : 0;
          particleCtx.shadowColor = '#00F0FF';
          particleCtx.fill();
          particleCtx.shadowBlur = 0;
        }

        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.hypot(dx, dy);

            if (dist < 35 && Math.random() > 0.85) {
              particleCtx.beginPath();
              particleCtx.moveTo(particles[i].x, particles[i].y);
              particleCtx.lineTo(particles[j].x, particles[j].y);
              particleCtx.strokeStyle = `rgba(0, 240, 255, ${0.12 * (1 - dist / 35)})`;
              particleCtx.stroke();
            }
          }
        }
      }
    };

    animFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [isFullyActive, height]);

  // 4. Micro Glitch Controller
  useEffect(() => {
    if (!isFullyActive) return;

    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.5) {
        setIsGlitching(true);
        setTimeout(() => setIsGlitching(false), 120);
      }
    }, 10000);

    return () => clearInterval(glitchInterval);
  }, [isFullyActive]);

  const isAlert = mode === 'alert';
  const isListening = mode === 'listening';
  const isThinking = mode === 'thinking';

  return (
    <div 
      onClick={onClick}
      className={`daytrace-ai-container ${!isFullyActive ? 'paused' : ''} ${isGlitching ? 'glitching' : ''} ${isListening ? 'mode-listening' : ''} ${onClick ? 'interactive' : ''}`} 
      style={{ height }}
      title={onClick ? (isListening ? "Listening... Tap to stop" : "Tap AI to speak") : undefined}
    >
      {/* Layer 2: Matrix Code Rain Canvas */}
      <canvas
        ref={rainCanvasRef}
        className="absolute inset-0 opacity-45 pointer-events-none z-0"
      />

      {/* Layer 3: Rotating Holographic Energy Rings */}
      <div className={`daytrace-ai-ring ring-outer ${isListening ? 'border-[#FF8D80] animate-pulse' : ''}`} />
      <div className={`daytrace-ai-ring ring-middle ${isListening ? 'border-[#FFB4AB]' : ''}`} />
      <div className={`daytrace-ai-ring ring-inner ${isListening ? 'border-[#FF8D80]' : ''}`} />

      {/* Layer 4: 3D Sensor Motion Tilt Wrapper */}
      <div className="daytrace-ai-tilt-wrapper" style={tiltStyle}>
        {/* Layer 4b: Humanoid Visual Asset OR Clean Holographic Projection Field */}
        <div className="daytrace-ai-humanoid-wrapper">
          {!imageError && (
            <img
              src={assetPath}
              alt=""
              className={`daytrace-ai-image ${imageLoaded ? 'loaded' : ''}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true);
                console.warn('DayTrace AI Asset Not Found (/assets/daytrace-ai.webp) - Rendering empty holographic field');
              }}
            />
          )}

          {imageError && (
            /* Clean Empty Holographic Projection Field (NO TEXT, NO BROKEN ICON, NO FABRICATED VECTOR FACE) */
            <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-4">
              <div className="w-24 h-24 rounded-full border border-[#00F0FF]/30 bg-[#00F0FF]/5 flex items-center justify-center shadow-[0_0_25px_rgba(0,240,255,0.15)] animate-pulse" />
            </div>
          )}

          {/* Layer 7: Extremely Subtle Chest Core */}
          {!imageError && imageLoaded && (
            <div className="daytrace-ai-core" style={{ backgroundColor: isAlert || isListening ? '#F87171' : '#00F0FF' }}>
              <div className="daytrace-ai-core-pulse" style={{ borderColor: isAlert || isListening ? '#F87171' : '#00F0FF' }} />
            </div>
          )}
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
      <div className={`absolute bottom-3 left-4 right-4 z-30 flex items-center justify-between px-3.5 py-1.5 rounded-full backdrop-blur-md text-xs font-mono transition ${
        isListening 
          ? 'bg-[#1D0A0A]/90 border border-[#FF8D80]/60 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
          : 'bg-[#070A10]/90 border border-[#00F0FF]/30'
      }`}>
        <div className="flex items-center space-x-2 truncate">
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            !isFullyActive ? 'bg-[#C4C6D0]/40' :
            isAlert ? 'bg-[#F87171] animate-ping' :
            isListening ? 'bg-[#FF8D80] animate-ping' :
            isThinking ? 'bg-[#C084FC] animate-pulse' :
            'bg-[#00F0FF] animate-pulse'
          }`} />
          <span className={`text-[11px] font-bold truncate ${isListening ? 'text-[#FFD8D3]' : 'text-[#E2E2E6]'}`}>
            {statusText}
          </span>
        </div>

        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 border ${
          isListening
            ? 'bg-[#BA1A1A]/30 text-[#FF8D80] border-[#FF8D80]/50 animate-pulse'
            : 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/40'
        }`}>
          {isListening ? '🔴 MIC LIVE' : 'DAYTRACE V2.5'}
        </span>
      </div>
    </div>
  );
};
