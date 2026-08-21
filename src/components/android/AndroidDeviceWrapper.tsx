import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor } from 'lucide-react';
import { isNativeAndroid } from '../../services/nativeBridge';

interface AndroidDeviceWrapperProps {
  children: React.ReactNode;
}

export const AndroidDeviceWrapper: React.FC<AndroidDeviceWrapperProps> = ({ children }) => {
  const [isNative, setIsNative] = useState(false);
  const [deviceFrameMode, setDeviceFrameMode] = useState<boolean>(false);

  useEffect(() => {
    const native = isNativeAndroid();
    setIsNative(native);
    if (!native) {
      // Default to Pixel mockup in browser preview for great visual presentation
      setDeviceFrameMode(true);
    } else {
      // In native Android APK or standalone PWA, never use fake phone frame
      setDeviceFrameMode(false);
    }
  }, []);

  // In native Android APK: Zero outer frames, zero fake bezels, 100% full screen with safe insets
  if (isNative || !deviceFrameMode) {
    return (
      <div className="w-full h-screen min-h-screen bg-[#111318] text-[#E2E2E6] flex flex-col overflow-hidden relative font-sans">
        {/* Real App Full Bleed View */}
        <div className="flex-1 flex flex-col w-full h-full overflow-hidden relative">
          {children}
        </div>

        {/* Browser view switch toggle for desktop previewers only */}
        {!isNative && (
          <div className="fixed bottom-24 right-3 z-50 hidden sm:flex items-center space-x-1.5 bg-[#1D2026]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#44474E]/40 text-xs text-[#C4C6D0] shadow-xl">
            <span className="text-[10px] font-mono text-[#C4C6D0]/60">Preview:</span>
            <button
              onClick={() => setDeviceFrameMode(true)}
              className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs text-[#D1E1FF] hover:bg-[#334867] transition"
              title="Show Pixel Frame"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Frame</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Desktop Web Preview Frame
  return (
    <div className="min-h-screen bg-[#0C0E12] text-[#E2E2E6] flex flex-col items-center justify-center p-0 sm:p-4 md:p-6 select-none font-sans">
      {/* Device View Mode Toggle Button */}
      <div className="fixed top-3 right-3 z-50 hidden sm:flex items-center space-x-1.5 bg-[#1D2026]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#44474E]/40 text-xs text-[#C4C6D0] shadow-xl">
        <span className="text-[11px] font-mono text-[#C4C6D0]/60">View:</span>
        <button
          onClick={() => setDeviceFrameMode(true)}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs transition ${
            deviceFrameMode ? 'bg-[#334867] text-[#D1E1FF] font-semibold shadow-sm' : 'hover:text-[#E2E2E6]'
          }`}
          title="Pixel 9 Device Frame"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Pixel</span>
        </button>
        <button
          onClick={() => setDeviceFrameMode(false)}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs transition ${
            !deviceFrameMode ? 'bg-[#334867] text-[#D1E1FF] font-semibold shadow-sm' : 'hover:text-[#E2E2E6]'
          }`}
          title="Full Responsive Screen"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Full</span>
        </button>
      </div>

      {/* Frame Container */}
      <div className="w-full max-w-[430px] h-[92vh] max-h-[920px] bg-[#1D2026] rounded-[44px] p-2.5 shadow-2xl shadow-blue-950/20 border-4 border-[#44474E]/40 relative flex flex-col overflow-hidden ring-1 ring-[#D1E1FF]/10">
        {/* Top Notch / Camera Punch Hole */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#111318] rounded-full z-40 border border-[#44474E]/60 flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-1.5 bg-[#003062] rounded-full" />
        </div>

        {/* Inner Screen Canvas */}
        <div className="w-full h-full bg-[#111318] rounded-[36px] overflow-hidden flex flex-col relative text-[#E2E2E6]">
          {children}

          {/* Android Navigation Gesture Pill */}
          <div className="w-full h-4 bg-[#111318] flex items-center justify-center pointer-events-none select-none z-30">
            <div className="w-28 h-1 bg-[#E2E2E6]/30 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
